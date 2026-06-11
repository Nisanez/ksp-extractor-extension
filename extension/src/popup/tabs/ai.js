/* tabs/ai.js — implements § ④ of the wireframes.
 * Four states: default (ready), loading, response, error.
 * Provider list is owned by background/providers/*. Keys read from
 * chrome.storage.local on render. */

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

const PROVIDERS = [
  { id: "claude", labelKey: "providerClaude" },
  { id: "openai", labelKey: "providerOpenAI" },
  { id: "gemini", labelKey: "providerGemini" },
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

/* Module-local view state (kept across re-renders within this tab). */
const view = {
  phase: "default", // default | loading | response | error
  providerId: "claude",
  question: "",
  response: "",
  error: null,
  hasKey: { claude: false, openai: false, gemini: false },
  restoredFromSW: false, // true once we've checked the SW cache this session
  history: [],           // populated on render from chrome.storage.local
  historyLoaded: false,
  isHistorical: false,   // true when current response was loaded from history
};

function relativeTime(ts) {
  if (!ts) return "";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return t("aiTimeJustNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("aiTimeMinutesAgo", min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("aiTimeHoursAgo", hr);
  const day = Math.floor(hr / 24);
  return t("aiTimeDaysAgo", day);
}

async function loadHistory() {
  try {
    const arr = await chrome.runtime.sendMessage({ type: "get-history" });
    view.history = Array.isArray(arr) ? arr : [];
  } catch (_) {
    view.history = [];
  }
  view.historyLoaded = true;
}

function showHistoryEntry(entry, handlers) {
  view.phase = "response";
  view.providerId = entry.providerId || view.providerId;
  view.response = entry.response || "";
  view.question = entry.question || "";
  view.isHistorical = true;
  handlers.rerender();
}

function renderHistoryPanel(handlers) {
  if (!view.history.length) return null;
  const wrap = el("div", {
    style: "border:1.5px solid var(--c-border); border-radius:6px; padding:8px; margin-bottom:10px; background: var(--c-subtle);"
  });
  const head = el("div", {
    style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"
  });
  head.append(el("span", {
    style: "font-size:11px; font-weight:600; color: var(--c-muted);"
  }, t("aiHistoryTitle")));
  const clearBtn = el("a", {
    style: "font-size:10px; color: var(--c-muted); cursor:pointer; text-decoration:underline;"
  }, t("aiHistoryClear"));
  clearBtn.addEventListener("click", async () => {
    try { await chrome.runtime.sendMessage({ type: "clear-history" }); } catch (_) {}
    view.history = [];
    handlers.rerender();
  });
  head.append(clearBtn);
  wrap.append(head);

  /* Show up to 5 most recent entries. */
  const list = el("div");
  for (const entry of view.history.slice(0, 5)) {
    const row = el("div", {
      style: "display:flex; align-items:center; gap:6px; padding:5px 4px; border-radius:4px; cursor:pointer; font-size:11px;"
    });
    row.addEventListener("mouseenter", () => { row.style.background = "var(--c-bg)"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
    row.addEventListener("click", () => showHistoryEntry(entry, handlers));

    row.append(el("span", { class: "chip", style: "font-size:9px; padding:2px 6px;" }, providerShortLabel(entry.providerId)));
    const qText = (entry.question || "").trim();
    const qSpan = el("span", {
      style: "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;",
      title: qText,
    }, qText || "—");
    row.append(qSpan);
    row.append(el("span", {
      style: "font-size:10px; color: var(--c-muted); white-space:nowrap;"
    }, relativeTime(entry.ts)));
    list.append(row);
  }
  wrap.append(list);
  return wrap;
}

function providerShortLabel(id) {
  if (id === "claude") return "Claude";
  if (id === "openai") return "GPT";
  if (id === "gemini") return "Gemini";
  return id || "?";
}

let pollHandle = null;

function productsKey(products) {
  if (!Array.isArray(products) || !products.length) return "empty";
  return products.map((p) => p.sku || p.url || p.name || "").join("|");
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

function startPolling(handlers) {
  stopPolling();
  pollHandle = setInterval(async () => {
    let last = null;
    try {
      last = await chrome.runtime.sendMessage({ type: "get-last-ask" });
    } catch (_) { return; }
    if (!last || last.status === "loading") return;
    stopPolling();
    if (last.status === "done") {
      view.phase = "response";
      view.response = last.text || "";
      view.providerId = last.providerId || view.providerId;
    } else if (last.status === "error") {
      view.phase = "error";
      view.error = last.error || "unknown";
      view.providerId = last.providerId || view.providerId;
    }
    handlers.rerender();
  }, 1500);
}

async function refreshKeyStatus() {
  const cfg = await chrome.storage.local.get(["claudeKey", "openaiKey", "geminiKey", "defaultProvider"]);
  view.hasKey.claude = !!cfg.claudeKey;
  view.hasKey.openai = !!cfg.openaiKey;
  view.hasKey.gemini = !!cfg.geminiKey;
  if (cfg.defaultProvider && PROVIDERS.find((p) => p.id === cfg.defaultProvider)) {
    view.providerId = cfg.defaultProvider;
  }
}

function providerLabel(id) {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ? t(p.labelKey) : id;
}

/* === Renders === */

function renderDefault(state, handlers) {
  const wrap = el("div", { class: "ai-pad" });

  /* History panel above provider select — surfaces past answers so the
     user can review them even after switching browser tabs (which kills
     the popup). */
  const hist = renderHistoryPanel(handlers);
  if (hist) wrap.append(hist);

  wrap.append(el("div", { class: "ai-label" }, t("aiProviderLabel")));
  wrap.append(providerSelect(handlers));

  wrap.append(el("div", { class: "ai-label", style: "margin-top:10px;" }, t("aiQuestionLabel")));
  const ta = el("textarea", {
    class: "textarea",
    dir: "rtl",
    placeholder: t("aiQuestionPlaceholder"),
  });
  ta.value = view.question;
  ta.addEventListener("input", () => { view.question = ta.value; });
  wrap.append(ta);

  const foot = el("div", { class: "ai-foot" });
  foot.append(el("span", { class: "ai-attach" }, t("aiAttachedCount", state.products.length)));
  const askBtn = el("button", { class: "btn primary small" }, t("aiAsk"));
  askBtn.addEventListener("click", () => onAsk(state, handlers));
  foot.append(askBtn);
  wrap.append(foot);

  wrap.append(el("hr", { class: "hr" }));
  wrap.append(el("div", {
    style: "text-align:center; font-size:11px; color: var(--c-muted);"
  }, t("aiPlaceholder")));
  return wrap;
}

function providerSelect(handlers) {
  const sel = el("select", { class: "select", dir: "rtl" });
  for (const p of PROVIDERS) {
    const opt = el("option", { value: p.id }, t(p.labelKey) + (view.hasKey[p.id] ? "  ✓" : ""));
    if (p.id === view.providerId) opt.setAttribute("selected", "");
    sel.append(opt);
  }
  sel.addEventListener("change", () => {
    view.providerId = sel.value;
  });
  return sel;
}

function renderLoading(state, handlers) {
  const wrap = el("div", { class: "ai-pad" });
  wrap.append(providerSelect(handlers));

  const taBox = el("div", { style: "margin: 8px 0; opacity: 0.5;" });
  const ta = el("textarea", {
    class: "textarea",
    dir: "rtl",
    disabled: "",
  });
  ta.value = view.question;
  taBox.append(ta);
  wrap.append(taBox);

  const foot = el("div", { class: "ai-foot", style: "margin-bottom: 10px;" });
  foot.append(el("span", { class: "ai-attach" }, t("aiAsking", providerLabel(view.providerId))));
  const cancel = el("button", { class: "btn ghost small" }, t("aiCancel"));
  cancel.addEventListener("click", async () => {
    stopPolling();
    try { await chrome.runtime.sendMessage({ type: "clear-last-ask" }); } catch (_) {}
    view.phase = "default";
    handlers.rerender();
  });
  foot.append(cancel);
  wrap.append(foot);

  wrap.append(el("hr", { class: "hr" }));
  const skel = el("div", { style: "padding: 8px 0;" });
  skel.append(el("div", { style: "font-size:11px; color: var(--c-muted); margin-bottom: 9px;" }, t("aiWaiting")));
  for (const w of [88, 70, 80, 55, 62]) {
    skel.append(el("div", { class: "skel", style: `width:${w}%; height:10px; margin-bottom:7px;` }));
  }
  wrap.append(skel);
  return wrap;
}

function renderResponse(state, handlers) {
  const wrap = el("div", { class: "ai-pad" });
  const head = el("div", { class: "ai-foot", style: "margin-bottom: 9px;" });
  head.append(el("span", { class: "chip" }, providerLabel(view.providerId)));
  if (view.isHistorical) {
    head.append(el("span", {
      style: "font-size:10px; color: var(--c-muted); margin-inline-start:4px;"
    }, t("aiHistoryBadge")));
  }
  const copyBtn = el("button", { class: "btn small" }, t("aiCopyAnswer"));
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(view.response); } catch (_) {}
    const o = copyBtn.textContent;
    copyBtn.textContent = t("copied");
    setTimeout(() => { copyBtn.textContent = o; }, 1300);
  });
  head.append(copyBtn);
  wrap.append(head);

  const body = el("div", { class: "ai-response" });
  renderMarkdownInto(body, view.response);
  wrap.append(body);
  wrap.append(el("hr", { class: "hr" }));
  const newBtn = el("button", { class: "btn full", style: "font-size:12px;" }, t("aiNewQuestion"));
  newBtn.addEventListener("click", async () => {
    try { await chrome.runtime.sendMessage({ type: "clear-last-ask" }); } catch (_) {}
    view.phase = "default";
    view.response = "";
    view.question = "";
    view.isHistorical = false;
    handlers.rerender();
  });
  wrap.append(newBtn);
  return wrap;
}

function renderError(state, handlers) {
  const wrap = el("div", { class: "ai-pad" });
  wrap.append(providerSelect(handlers));
  const taBox = el("div", { style: "margin: 10px 0; opacity: 0.5;" });
  const ta = el("textarea", { class: "textarea", dir: "rtl", disabled: "" });
  ta.value = view.question;
  taBox.append(ta);
  wrap.append(taBox);

  const err = el("div", { class: "ai-error" });
  if (view.error === "missing_key") {
    err.append(el("b", {}, t("aiErrorMissingKey")));
    err.append(document.createElement("br"));
    const hint = el("span", { style: "color: var(--c-muted);" }, t("aiErrorMissingKeyHint"));
    const link = el("a", { onclick: handlers.openOptions }, t("settingsLink"));
    err.append(hint, link);
  } else {
    err.append(el("b", {}, t("aiErrorGeneric", view.error || "")));
  }
  wrap.append(err);
  const tryAgain = el("button", { class: "btn full", style: "font-size:12px; margin-top:9px;" }, t("aiNewQuestion"));
  tryAgain.addEventListener("click", async () => {
    try { await chrome.runtime.sendMessage({ type: "clear-last-ask" }); } catch (_) {}
    view.phase = "default";
    view.error = null;
    handlers.rerender();
  });
  wrap.append(tryAgain);
  return wrap;
}

/* === Markdown — minimal DOM renderer (bold + bullets + line breaks) ===
   Builds DOM nodes directly so we never pass model output through
   innerHTML. Supports: **bold**, leading "- " or "* " bullets, line
   breaks. Everything else is rendered as text. */
function renderMarkdownInto(host, raw) {
  if (!raw) return;
  const lines = String(raw).split(/\n/);
  lines.forEach((line, idx) => {
    let work = line;
    const m = work.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      host.append(document.createTextNode("• "));
      work = m[1];
    }
    /* Bold spans inside the line. */
    const parts = work.split(/(\*\*[^*]+\*\*)/);
    for (const p of parts) {
      if (!p) continue;
      const bm = p.match(/^\*\*([^*]+)\*\*$/);
      if (bm) host.append(el("strong", {}, bm[1]));
      else host.append(document.createTextNode(p));
    }
    if (idx < lines.length - 1) host.append(document.createElement("br"));
  });
}

/* === Ask flow === */
async function onAsk(state, handlers) {
  if (!view.hasKey[view.providerId]) {
    view.phase = "error";
    view.error = "missing_key";
    handlers.rerender();
    return;
  }
  view.phase = "loading";
  view.error = null;
  handlers.rerender();
  /* Kick the SW. We deliberately do NOT await this promise to drive the
     UI — the SW now stamps lastAsk synchronously, so even if THIS popup
     dies before the fetch resolves, a re-opened popup will pick up the
     result via get-last-ask. The await below still updates the live
     popup if it stays open. */
  startPolling(handlers);
  try {
    const reply = await chrome.runtime.sendMessage({
      type: "llm-ask",
      providerId: view.providerId,
      question: view.question || t("aiQuestionPlaceholder"),
      products: state.products,
      pageUrl: state.pageUrl || null,
    });
    stopPolling();
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || "unknown");
    view.response = reply.text;
    view.phase = "response";
    view.isHistorical = false;
    /* Reload history so the just-completed ask appears the next time
       the user goes back to the default state. */
    loadHistory();
  } catch (e) {
    stopPolling();
    view.phase = "error";
    view.error = String(e && e.message ? e.message : e);
  }
  handlers.rerender();
}

/* On first render of this tab in a popup lifetime, check the SW for an
   in-flight or recently completed ask. If it matches the current product
   set, restore the view so the user gets their answer back. */
async function maybeRestoreFromSW(state) {
  if (view.restoredFromSW) return;
  view.restoredFromSW = true;
  let last = null;
  try {
    last = await chrome.runtime.sendMessage({ type: "get-last-ask" });
  } catch (_) { return; }
  if (!last) return;
  const curKey = productsKey(state.products);
  if (last.productsKey !== curKey) return; // stale; different products
  view.providerId = last.providerId || view.providerId;
  view.question = last.question || view.question;
  if (last.status === "loading") {
    view.phase = "loading";
  } else if (last.status === "done") {
    view.phase = "response";
    view.response = last.text || "";
  } else if (last.status === "error") {
    view.phase = "error";
    view.error = last.error || "unknown";
  }
}

/* === Public API === */
export async function renderAITab(panel, state, hostHandlers) {
  await refreshKeyStatus();
  await maybeRestoreFromSW(state);
  if (!view.historyLoaded) await loadHistory();
  const handlers = {
    ...hostHandlers,
    rerender: () => renderAITab(panel, state, hostHandlers),
  };

  /* If we restored a loading state from the SW (popup was closed
     mid-request), resume polling so the answer lands when ready. */
  if (view.phase === "loading" && !pollHandle) startPolling(handlers);

  panel.replaceChildren();
  if (view.phase === "loading") panel.append(renderLoading(state, handlers));
  else if (view.phase === "response") panel.append(renderResponse(state, handlers));
  else if (view.phase === "error") panel.append(renderError(state, handlers));
  else panel.append(renderDefault(state, handlers));
}
