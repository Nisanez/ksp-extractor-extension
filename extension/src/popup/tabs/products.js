/* tabs/products.js — implements § ③ of the wireframes.
 * Four states: loading, loaded, empty, error. The state machine is
 * driven from popup.js — this module is pure render. */

const t = (k, ...subs) => {
  try {
    return chrome.i18n.getMessage(k, subs.length ? subs.map(String) : undefined) || k;
  } catch (_) {
    return k;
  }
};

const NIS = "₪";

function fmtPrice(n) {
  if (n == null) return "—";
  return NIS + n.toLocaleString("en-US");
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      e.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dir") e.setAttribute("dir", v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

/* Builds the "נמצאו <b>N</b> מוצרים" count line as DOM nodes, splitting
   the localized template around the digit placeholder so we never pass
   user-substituted text through innerHTML. */
function buildCount(n) {
  const span = el("span", { class: "count" });
  const msg = t("productsHeaderFound", n);
  const parts = msg.split(/(\d[\d,]*)/);
  for (const p of parts) {
    if (/^\d[\d,]*$/.test(p)) span.append(el("b", {}, p));
    else span.append(document.createTextNode(p));
  }
  return span;
}

/* === States === */

function renderLoading() {
  const wrap = el("div", { class: "loading" });
  wrap.append(
    el("div", { class: "head-line" },
      el("span", { class: "ic" }, "⏳"),
      el("span", {}, t("productsLoading").replace(/^⏳\s*/, ""))
    )
  );
  const widths = [["65%", "30%"], ["50%", "44%"], ["72%", "22%"], ["40%", "54%"]];
  for (const [a, b] of widths) {
    const row = el("div", { class: "row" });
    row.append(
      el("div", { class: "skel", style: `width: ${a};` }),
      el("div", { class: "skel", style: `width: ${b};` })
    );
    wrap.append(row);
  }
  return wrap;
}

function renderEmpty(onRetry) {
  return el("div", { class: "empty" },
    el("div", { class: "ic" }, "🔍"),
    el("div", { class: "title" }, t("productsEmptyTitle")),
    el("div", { class: "hint" }, t("productsEmptyHint")),
    el("button", { class: "btn", onclick: onRetry }, t("productsEmptyRetry"))
  );
}

function renderError(onRetry) {
  return el("div", { class: "error-panel" },
    el("div", { class: "ic" }, "⚠️"),
    el("div", { class: "title" }, t("productsErrorTitle")),
    el("div", { class: "body" }, t("productsErrorBody")),
    el("button", { class: "btn small", onclick: onRetry }, t("productsErrorRetry"))
  );
}

function renderLoaded(state, handlers) {
  const wrap = el("div");

  wrap.append(
    el("div", { class: "prod-head" },
      buildCount(state.products.length),
      el("span", { class: "chip green" }, t("productsChipPage"))
    )
  );

  /* CTAs above the table — they're the primary action, not a footer. */
  const cta = el("div", { class: "cta-row" });
  cta.append(
    copyButton(t("copyPrompt"), handlers.onCopyPrompt, true),
    copyButton(t("copyJson"), handlers.onCopyJSON),
    copyButton(t("copyMarkdown"), handlers.onCopyMarkdown)
  );
  wrap.append(cta);

  const table = el("div", { class: "table" });
  table.append(
    el("div", { class: "tr head" },
      el("span", {}, t("colName")),
      el("span", {}, t("colBrand")),
      el("span", {}, t("colPrice")),
      el("span", {}, t("colEilat")),
      el("span", {}, "")
    )
  );
  state.products.forEach((p, i) => {
    const row = el("div", { class: "tr" + (i % 2 ? " zebra" : "") },
      el("span", { class: "name", title: p.name }, p.name),
      el("span", { class: "brand" }, p.brand || "—"),
      el("span", { class: "price", dir: "ltr" }, fmtPrice(p.priceNis)),
      el("span", { class: "eilat", dir: "ltr" }, fmtPrice(p.eilatPriceNis)),
      p.url
        ? el("a", { class: "open", href: p.url, target: "_blank", rel: "noopener", title: t("openItem") }, "↗")
        : el("span", {}, "")
    );
    table.append(row);
  });
  wrap.append(table);

  return wrap;
}

function copyButton(label, action, primary) {
  const b = el(
    "button",
    { class: "btn small" + (primary ? " primary" : ""), onclick: async () => {
      const original = b.textContent;
      const ok = await action();
      if (ok !== false) {
        b.textContent = t("copied");
        setTimeout(() => { b.textContent = original; }, 1300);
      }
    }},
    label
  );
  return b;
}

/* === Public API === */

export function renderProductsTab(panel, state, handlers) {
  panel.replaceChildren();
  if (state.loading) {
    panel.append(renderLoading());
  } else if (state.error === "not_ksp" || state.products.length === 0 && !state.error) {
    panel.append(renderEmpty(handlers.onRetry));
  } else if (state.error) {
    panel.append(renderError(handlers.onRetry));
  } else {
    panel.append(renderLoaded(state, handlers));
  }
}

/* === Copy formatters — ported from format_text() in ksp_extract.py === */

export async function copyAsJSON(products) {
  const json = JSON.stringify(products, null, 2);
  return copyToClipboard(json);
}

export async function copyAsMarkdown(products) {
  const lines = [`| ${t("colName")} | ${t("colBrand")} | ${t("colPrice")} | ${t("colEilat")} | ${t("openItem")} |`,
                 `|---|---|---|---|---|`];
  for (const p of products) {
    const price = p.priceNis == null ? "—" : `${NIS}${p.priceNis.toLocaleString("en-US")}`;
    const eilat = p.eilatPriceNis == null ? "—" : `${NIS}${p.eilatPriceNis.toLocaleString("en-US")}`;
    const link = p.url ? `[↗](${p.url})` : "";
    lines.push(`| ${escapeMd(p.name)} | ${p.brand || ""} | ${price} | ${eilat} | ${link} |`);
  }
  return copyToClipboard(lines.join("\n"));
}

export async function copyAsPrompt(products) {
  const header = t("promptHeader", products.length);
  const lines = [header, ""];
  products.forEach((p, i) => {
    const price = p.priceNis == null ? "" : ` — ₪${p.priceNis.toLocaleString("en-US")}`;
    const eilat = p.eilatPriceNis == null ? "" : ` (אילת: ₪${p.eilatPriceNis.toLocaleString("en-US")})`;
    const brand = p.brand ? ` [${p.brand}]` : "";
    const url = p.url ? `\n   ${p.url}` : "";
    lines.push(`${i + 1}. ${p.name}${brand}${price}${eilat}${url}`);
  });
  lines.push("", t("promptHebrewSuffix"));
  return copyToClipboard(lines.join("\n"));
}

function escapeMd(s) {
  return String(s || "").replace(/\|/g, "\\|");
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Fallback for restricted contexts.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {}
    ta.remove();
    return ok;
  }
}
