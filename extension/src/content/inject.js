/* inject.js — § ① floating button + SPA route observer.
 * The button shows only when KSPExtract.findCards() reports ≥1 product
 * (so it's hidden on the home page and item pages), and follows the
 * three visual states from FloatBtnDemo in the wireframes:
 *   default → hover (tooltip) → busy (pulse while extracting).
 */
(function () {
  if (window.__kspLlmInjected) return;
  window.__kspLlmInjected = true;

  const T = (k, ...subs) => {
    try {
      return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
    } catch (_) {
      return k;
    }
  };

  let btn, tip;

  function ensureUI() {
    if (btn) return;
    btn = document.createElement("button");
    btn.id = "ksp-llm-float-btn";
    btn.type = "button";
    btn.textContent = T("floatBtnLabel");
    btn.addEventListener("click", onExtractClick);
    btn.addEventListener("mouseenter", positionTip);

    tip = document.createElement("div");
    tip.id = "ksp-llm-float-tip";

    document.body.appendChild(btn);
    document.body.appendChild(tip);
  }

  function positionTip() {
    if (!btn || !tip) return;
    const count = window.KSPExtract.findCards().length;
    tip.textContent = T("floatBtnTooltip", count);
    const r = btn.getBoundingClientRect();
    tip.style.left = r.left + "px";
    tip.style.bottom = window.innerHeight - r.top + 8 + "px";
  }

  function refreshVisibility() {
    ensureUI();
    const count = window.KSPExtract.findCards().length;
    if (count > 0) btn.classList.add("ksp-visible");
    else btn.classList.remove("ksp-visible");
  }

  async function onExtractClick() {
    btn.classList.add("ksp-busy");
    btn.textContent = T("floatBtnExtracting");
    try {
      // Yield a frame so the visual state actually paints.
      await new Promise((r) => requestAnimationFrame(r));
      const products = window.KSPExtract.extractAll();
      await chrome.runtime.sendMessage({
        type: "extracted",
        products,
        pageUrl: location.href,
      });
      // Open the action popup if the browser allows it programmatically.
      // (Some browsers block this — fall back to a notification toast.)
      try {
        await chrome.action.openPopup();
      } catch (_) {
        flashToast(T("copied"));
      }
    } finally {
      btn.classList.remove("ksp-busy");
      btn.textContent = T("floatBtnLabel");
    }
  }

  function flashToast(text) {
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, {
      position: "fixed",
      bottom: "70px",
      left: "20px",
      zIndex: 2147483600,
      background: "#1f9c6a",
      color: "#fff",
      padding: "8px 14px",
      borderRadius: "6px",
      fontFamily: "Assistant, sans-serif",
      fontSize: "13px",
      boxShadow: "0 3px 10px rgba(0,0,0,.2)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  /* SPA navigation: KSP is a React Router app; the URL changes without a
     full reload. Watch #root for grid changes and re-check visibility.
     Debounced to avoid thrashing during lazy hydration. */
  let debounceTimer = null;
  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshVisibility, 500);
  }

  function start() {
    refreshVisibility();
    const root = document.getElementById("root") || document.body;
    new MutationObserver(scheduleRefresh).observe(root, {
      childList: true,
      subtree: true,
    });
    // Patch history methods to catch SPA route changes too.
    const fire = () => window.dispatchEvent(new Event("ksp-locationchange"));
    for (const k of ["pushState", "replaceState"]) {
      const orig = history[k];
      history[k] = function () {
        const r = orig.apply(this, arguments);
        fire();
        return r;
      };
    }
    window.addEventListener("popstate", fire);
    window.addEventListener("ksp-locationchange", scheduleRefresh);
  }

  /* Respond to popup-initiated extraction requests so the popup doesn't
     need the broad "scripting" permission. */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "extract-now") {
      try {
        sendResponse({
          ok: true,
          products: window.KSPExtract.extractAll(),
          pageUrl: location.href,
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
