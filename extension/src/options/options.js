/* options.js — load / save settings to chrome.storage.local.
 * Pure DOM, no framework. */

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

const STORAGE_KEYS = ["claudeKey", "openaiKey", "geminiKey", "defaultProvider", "uiLang"];

/* Map each provider's storage key to the host it talks to. We request
   the optional host permission whenever the user saves a non-empty key,
   so the popup's "Ask" flow never has to deal with a permission prompt
   mid-request. */
const PROVIDER_HOSTS = {
  claudeKey: "https://api.anthropic.com/*",
  openaiKey: "https://api.openai.com/*",
  geminiKey: "https://generativelanguage.googleapis.com/*",
};

function hydrateI18n() {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-host]")) {
    el.textContent = t("optionsGetKey", el.dataset.host);
  }
}

async function loadCurrent() {
  const cfg = await chrome.storage.local.get(STORAGE_KEYS);
  for (const input of document.querySelectorAll(".key-input")) {
    input.value = cfg[input.dataset.key] || "";
  }
  const def = cfg.defaultProvider || "claude";
  document.getElementById("defaultProvider").value = def;

  const lang = cfg.uiLang || (chrome.i18n.getUILanguage().startsWith("he") ? "he" : "en");
  for (const b of document.querySelectorAll("#langPills button")) {
    b.classList.toggle("active", b.dataset.lang === lang);
  }
}

function wireLangPills() {
  for (const b of document.querySelectorAll("#langPills button")) {
    b.addEventListener("click", () => {
      for (const other of document.querySelectorAll("#langPills button")) {
        other.classList.toggle("active", other === b);
      }
    });
  }
}

async function save() {
  const data = {};
  const hostsToRequest = [];
  for (const input of document.querySelectorAll(".key-input")) {
    const val = input.value.trim();
    data[input.dataset.key] = val;
    if (val && PROVIDER_HOSTS[input.dataset.key]) {
      hostsToRequest.push(PROVIDER_HOSTS[input.dataset.key]);
    }
  }
  data.defaultProvider = document.getElementById("defaultProvider").value;
  const activeLang = document.querySelector("#langPills button.active");
  if (activeLang) data.uiLang = activeLang.dataset.lang;

  /* Request host permissions for any provider that now has a key set.
     chrome.permissions.request() must be called from a user gesture —
     the click on #saveBtn qualifies. */
  if (hostsToRequest.length) {
    try {
      await new Promise((resolve) =>
        chrome.permissions.request({ origins: hostsToRequest }, resolve)
      );
    } catch (_) {
      /* User declined — that's fine, the key is still saved and we'll
         surface a host_permission_missing error if they try to ask. */
    }
  }

  await chrome.storage.local.set(data);
  const toast = document.getElementById("savedToast");
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2000);
}

hydrateI18n();
loadCurrent();
wireLangPills();
document.getElementById("saveBtn").addEventListener("click", save);
