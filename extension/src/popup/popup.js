/* popup.js — tab router + i18n hydration.
 * Loads the three tab modules and routes clicks. Holds the in-memory
 * product list extracted from the active tab. */

import { renderProductsTab, copyAsMarkdown, copyAsJSON, copyAsPrompt } from "./tabs/products.js";
import { renderAITab } from "./tabs/ai.js";
import { renderSettingsMini } from "./tabs/settings_mini.js";

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

/* hydrate [data-i18n] / [data-i18n-title] on static markup */
function hydrateI18n(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  }
}

/* App state — products extracted on this popup open. */
const state = {
  products: [],
  pageUrl: location.href,
  activeTab: "products",
};

const panels = {
  products: document.querySelector('[data-panel="products"]'),
  ai: document.querySelector('[data-panel="ai"]'),
  settings: document.querySelector('[data-panel="settings"]'),
};

function showTab(name) {
  state.activeTab = name;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.tab === name);
  }
  for (const [k, el] of Object.entries(panels)) {
    el.classList.toggle("hidden", k !== name);
  }
  renderActive();
}

function renderActive() {
  if (state.activeTab === "products") {
    renderProductsTab(panels.products, state, {
      onCopyMarkdown: () => copyAsMarkdown(state.products),
      onCopyJSON: () => copyAsJSON(state.products),
      onCopyPrompt: () => copyAsPrompt(state.products),
      onRetry: () => requestExtraction(true),
    });
  } else if (state.activeTab === "ai") {
    renderAITab(panels.ai, state, {
      openOptions: () => chrome.runtime.openOptionsPage(),
    });
  } else if (state.activeTab === "settings") {
    renderSettingsMini(panels.settings, {
      openOptions: () => chrome.runtime.openOptionsPage(),
    });
  }
}

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => showTab(tab.dataset.tab))
);

document.querySelector(".shell-close").addEventListener("click", () => window.close());

/* === Extraction === */
async function requestExtraction(force = false) {
  /* Two sources of products:
     1. The content script proactively pushed via runtime.sendMessage when
        the floating button was clicked — picked up in service_worker and
        cached. We ask for the cached value first.
     2. If empty, ask the active tab to extract on demand. */
  state.products = [];
  state.loading = true;
  state.error = null;
  renderActive();

  /* Try the service worker's cache only if it was captured on the same
     URL — otherwise we'd show category A's products while the user is on
     category B (which happens easily when navigating in the SPA). */
  let activeTabUrl = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabUrl = tab && tab.url;
  } catch (_) {}

  try {
    const cached = await chrome.runtime.sendMessage({ type: "get-last-extracted" });
    if (
      cached &&
      cached.products &&
      cached.products.length &&
      !force &&
      cached.pageUrl === activeTabUrl
    ) {
      state.products = cached.products;
      state.pageUrl = cached.pageUrl;
      state.loading = false;
      renderActive();
      return;
    }
  } catch (_) {}

  /* Ask the content script (already injected on KSP pages) for a fresh
     extraction. Uses tabs.sendMessage so we don't need the "scripting"
     permission. */
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url || !tab.url.includes("ksp.co.il")) {
      state.loading = false;
      state.error = "not_ksp";
      renderActive();
      return;
    }
    const reply = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "extract-now" }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response);
      });
    });
    if (!reply) {
      // Content script never replied — usually because the user is on a
      // URL the content script doesn't match (e.g. the home page).
      state.products = [];
    } else if (!reply.ok) {
      state.error = reply.error || "no_content_script";
    } else {
      state.products = reply.products || [];
      state.pageUrl = reply.pageUrl || tab.url;
    }
  } catch (e) {
    state.error = String(e && e.message ? e.message : e);
  } finally {
    state.loading = false;
    renderActive();
  }
}

hydrateI18n();
showTab("products");
requestExtraction(false);
