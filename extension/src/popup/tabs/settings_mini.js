/* tabs/settings_mini.js — § ⑤ SettingsMini.
 * Compact status panel inside the popup. The full options page lives
 * in src/options/options.html and is reached via "פתח הגדרות מלאות". */

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

const PROVIDERS = [
  { id: "claude", labelKey: "providerClaude", storageKey: "claudeKey" },
  { id: "openai", labelKey: "providerOpenAI", storageKey: "openaiKey" },
  { id: "gemini", labelKey: "providerGemini", storageKey: "geminiKey" },
];

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      e.addEventListener(k.slice(2).toLowerCase(), v);
    } else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export async function renderSettingsMini(panel, handlers) {
  panel.replaceChildren();
  const cfg = await chrome.storage.local.get([
    "claudeKey", "openaiKey", "geminiKey", "uiLang",
  ]);
  const wrap = el("div", { class: "set-pad" });

  wrap.append(el("div", { class: "set-section-title" }, t("settingsApiKeysTitle")));
  for (const p of PROVIDERS) {
    const set = !!cfg[p.storageKey];
    wrap.append(
      el("div", { class: "set-row" },
        el("span", { class: "name" }, providerShort(p)),
        el("span", { class: "status " + (set ? "ok" : "miss") },
          set ? t("settingsKeySet") : t("settingsKeyMissing"))
      )
    );
  }

  wrap.append(el("hr", { class: "hr" }));

  /* Language toggle (header + pill) */
  const langRow = el("div", { class: "set-row", style: "border-bottom: 0; padding: 0;" });
  langRow.append(el("span", { class: "name" }, t("settingsLanguage")));
  const langToggle = el("div", { class: "lang-toggle" });
  const curLang = cfg.uiLang || (chrome.i18n.getUILanguage().startsWith("he") ? "he" : "en");
  for (const lang of ["he", "en"]) {
    const b = el("button", { class: curLang === lang ? "active" : "" },
      lang === "he" ? t("settingsLangHe") : t("settingsLangEn"));
    b.addEventListener("click", async () => {
      await chrome.storage.local.set({ uiLang: lang });
      renderSettingsMini(panel, handlers);
    });
    langToggle.append(b);
  }
  langRow.append(langToggle);
  wrap.append(langRow);

  wrap.append(el("div", { class: "privacy-banner" }, t("settingsPrivacyShort")));

  const fullBtn = el("button", { class: "btn full" }, t("settingsOpenFull"));
  fullBtn.addEventListener("click", handlers.openOptions);
  wrap.append(fullBtn);

  panel.append(wrap);
}

function providerShort(p) {
  return t(p.labelKey).replace(/\s*\(.+\)\s*$/, "").replace(/^OpenAI\s*\/\s*/, "");
}
