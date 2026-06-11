/* Background service worker (MV3, module).
 * Responsibilities:
 *   1. Cache the latest extraction pushed by the content script so that
 *      reopening the popup is instant (no re-scrape needed).
 *   2. Route llm-ask requests to the correct provider adapter and
 *      transparently request the optional host permission on first use. */

import { ask as askClaude } from "./providers/claude.js";
import { ask as askOpenAI } from "./providers/openai.js";
import { ask as askGemini } from "./providers/gemini.js";

const PROVIDERS = {
  claude: {
    storageKey: "claudeKey",
    origin: "https://api.anthropic.com/*",
    label: "Claude",
    ask: askClaude,
  },
  openai: {
    storageKey: "openaiKey",
    origin: "https://api.openai.com/*",
    label: "OpenAI",
    ask: askOpenAI,
  },
  gemini: {
    storageKey: "geminiKey",
    origin: "https://generativelanguage.googleapis.com/*",
    label: "Gemini",
    ask: askGemini,
  },
};

let lastExtracted = null; // { products, pageUrl, ts }

/* Persist the most recent ask so that closing/reopening the popup doesn't
 * lose tokens. Fetches run in the SW and complete regardless of whether
 * the popup is alive — we just need to remember the result.
 *
 * Shape: { id, status: 'loading'|'done'|'error', providerId, question,
 *   productsKey, text, error, startedAt, finishedAt } */
let lastAsk = null;
const ASK_TTL_MS = 15 * 60 * 1000;

/* Persistent history of completed asks. Survives popup close, browser
 * restart, and SW shutdown — lives in chrome.storage.local. Capped to
 * the most recent N entries; oldest pruned on push. */
const HISTORY_KEY = "askHistory";
const HISTORY_MAX = 20;

async function pushHistoryEntry(entry) {
  try {
    const cfg = await chrome.storage.local.get(HISTORY_KEY);
    const cur = Array.isArray(cfg[HISTORY_KEY]) ? cfg[HISTORY_KEY] : [];
    cur.unshift(entry);
    while (cur.length > HISTORY_MAX) cur.pop();
    await chrome.storage.local.set({ [HISTORY_KEY]: cur });
  } catch (_) {
    /* Storage quota exceeded etc — silently drop. History is a
       convenience, not a correctness requirement. */
  }
}

function productsKey(products) {
  if (!Array.isArray(products) || !products.length) return "empty";
  return products.map((p) => p.sku || p.url || p.name || "").join("|");
}

function pruneLastAsk() {
  if (!lastAsk) return;
  const t = lastAsk.finishedAt || lastAsk.startedAt || 0;
  if (Date.now() - t > ASK_TTL_MS) lastAsk = null;
}

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

/* === Message router === */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "extracted") {
    lastExtracted = {
      products: msg.products || [],
      pageUrl: msg.pageUrl,
      ts: Date.now(),
    };
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "get-last-extracted") {
    sendResponse(lastExtracted || { products: [] });
    return;
  }

  if (msg.type === "get-last-ask") {
    pruneLastAsk();
    sendResponse(lastAsk || null);
    return;
  }

  if (msg.type === "clear-last-ask") {
    lastAsk = null;
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "get-history") {
    chrome.storage.local
      .get(HISTORY_KEY)
      .then((cfg) => sendResponse(Array.isArray(cfg[HISTORY_KEY]) ? cfg[HISTORY_KEY] : []))
      .catch(() => sendResponse([]));
    return true;
  }

  if (msg.type === "clear-history") {
    chrome.storage.local
      .remove(HISTORY_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "delete-history-entry") {
    chrome.storage.local
      .get(HISTORY_KEY)
      .then((cfg) => {
        const cur = Array.isArray(cfg[HISTORY_KEY]) ? cfg[HISTORY_KEY] : [];
        const filtered = cur.filter((e) => e.id !== msg.id);
        return chrome.storage.local.set({ [HISTORY_KEY]: filtered });
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "llm-ask") {
    /* Stamp the in-flight state BEFORE awaiting so that if the popup
       closes mid-request, a re-opened popup can poll get-last-ask and
       restore the loading view. */
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    lastAsk = {
      id,
      status: "loading",
      providerId: msg.providerId,
      question: msg.question || "",
      productsKey: productsKey(msg.products),
      startedAt: Date.now(),
    };
    handleLLMAsk(msg)
      .then((text) => {
        const finishedAt = Date.now();
        if (lastAsk && lastAsk.id === id) {
          lastAsk = { ...lastAsk, status: "done", text, finishedAt };
        }
        /* Fire-and-forget — popup doesn't need to wait on storage write
           to see the answer in its own reply. */
        pushHistoryEntry({
          id,
          ts: finishedAt,
          providerId: msg.providerId,
          question: msg.question || "",
          response: text,
          pageUrl: msg.pageUrl || null,
          productCount: Array.isArray(msg.products) ? msg.products.length : 0,
          productSample:
            msg.products && msg.products[0]
              ? String(msg.products[0].name || "").slice(0, 80)
              : null,
        });
        sendResponse({ ok: true, text });
      })
      .catch((e) => {
        const error = String(e && e.message ? e.message : e);
        if (lastAsk && lastAsk.id === id) {
          lastAsk = { ...lastAsk, status: "error", error, finishedAt: Date.now() };
        }
        sendResponse({ ok: false, error });
      });
    return true; // async
  }
});

async function handleLLMAsk({ providerId, question, products }) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error("unknown_provider");

  const hasOrigin = await new Promise((resolve) =>
    chrome.permissions.contains({ origins: [provider.origin] }, resolve)
  );
  if (!hasOrigin) {
    /* The options page is supposed to request this when the user saves
       their key. If we still get here without it, surface a clear error
       that the popup can route to the options link. */
    throw new Error("host_permission_missing");
  }

  const cfg = await chrome.storage.local.get([provider.storageKey]);
  const apiKey = cfg[provider.storageKey];
  if (!apiKey) throw new Error("missing_key");

  const system = t("defaultSystemPrompt");
  const user = buildUserPrompt(question, products);
  return provider.ask({ apiKey, system, user });
}

function buildUserPrompt(question, products) {
  const lines = [t("promptHeader", products.length), ""];
  products.forEach((p, i) => {
    const price = p.priceNis == null ? "" : ` — ₪${p.priceNis.toLocaleString("en-US")}`;
    const eilat = p.eilatPriceNis == null ? "" : ` (אילת: ₪${p.eilatPriceNis.toLocaleString("en-US")})`;
    const brand = p.brand ? ` [${p.brand}]` : "";
    const url = p.url ? `\n   ${p.url}` : "";
    lines.push(`${i + 1}. ${p.name}${brand}${price}${eilat}${url}`);
  });
  lines.push("", question);
  return lines.join("\n");
}

