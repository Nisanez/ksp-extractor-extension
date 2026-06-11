/* extract.js
 * Direct port of legacy-python/ksp_extract.py → parse_product().
 *
 * The page is a Material-UI React app; class names look like
 * `product-0-3-312`, `productTitle-0-3-341`, etc. The numeric suffix
 * regenerates on every build, so we ONLY match the prefix — the same
 * trick that survived the input.txt bug.
 *
 * Exposes window.KSPExtract = { findCards, parseCard, extractAll }.
 */
(function () {
  const KSP_BASE = "https://ksp.co.il";
  /* Grid view: cards have a `product-0-3-NNN` class. */
  const CARD_RE = /(^|\s)product-0-3-\d+(\s|$)/;
  /* List view: cards have no `product-*` class. Instead, each card has a
     child `firstSection-0-3-NNN` (image + title + description) and a
     sibling `secondSection-0-3-NNN` (price + buy button). We detect cards
     as the parent of any firstSection block. */
  const FIRST_SECTION_RE = /(^|\s)firstSection-0-3-\d+(\s|$)/;

  function priceToInt(text) {
    if (!text) return null;
    const digits = String(text).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }

  function absUrl(href) {
    if (!href) return null;
    if (href.startsWith("http")) return href;
    if (href.startsWith("//")) return "https:" + href;
    return KSP_BASE + href;
  }

  function firstText(node) {
    if (!node) return null;
    const text = (node.textContent || "").trim().replace(/\s+/g, " ");
    return text || null;
  }

  function findCards(root) {
    root = root || document;
    // Two-step: prefix match in querySelector, then verify with regex
    // to exclude e.g. `productContent-0-3-...` (which contains "product"
    // but not "product-0-3-").
    const candidates = root.querySelectorAll('div[class*="product-0-3-"]');
    const out = [];
    for (const el of candidates) {
      if (CARD_RE.test(el.className || "")) out.push(el);
    }
    if (out.length) return out;

    /* Grid view found nothing — try list view. Each list card is the
       direct parent of a `firstSection-0-3-NNN` div. We collect parents,
       de-duplicating since some pages have multiple cards rendered in
       the same scroll batch. */
    const firstSections = root.querySelectorAll('div[class*="firstSection-0-3-"]');
    const seen = new Set();
    for (const fs of firstSections) {
      if (!FIRST_SECTION_RE.test(fs.className || "")) continue;
      const card = fs.parentElement;
      if (card && !seen.has(card)) {
        seen.add(card);
        out.push(card);
      }
    }
    return out;
  }

  function parseCard(card) {
    const titleA = card.querySelector('a[class*="productTitle"]');
    if (!titleA) {
      /* No `productTitle` link → this is a list-view card. */
      return parseListCard(card);
    }

    const name = firstText(titleA) || "";
    const url = absUrl(titleA.getAttribute("href"));

    let itemId = null;
    if (url) {
      const m = url.match(/\/item\/(\d+)/);
      if (m) itemId = m[1];
    }

    let sku = null;
    const skuWrap = card.querySelector('[class*="skuWrapper"]');
    if (skuWrap) {
      const aria = skuWrap.getAttribute("aria-label") || "";
      let m = aria.match(/(\d+)/);
      if (m) {
        sku = m[1];
      } else {
        const txt = (skuWrap.textContent || "").replace(/\s+/g, " ");
        m = txt.match(/(\d{4,})/);
        if (m) sku = m[1];
      }
    }

    let brand = null;
    const brandImg = card.querySelector('[class*="brandWrapper"] img');
    if (brandImg) brand = brandImg.getAttribute("alt") || null;

    let priceNis = null;
    const priceNode = card.querySelector(
      '[class*="regularPriceWrapper"] [aria-label^="מחיר המוצר"]'
    );
    if (priceNode) {
      const aria = priceNode.getAttribute("aria-label") || "";
      const m = aria.match(/([\d,]+)/);
      if (m) priceNis = priceToInt(m[1]);
    }
    if (priceNis == null) {
      const anyPrice = card.querySelector('[class*="currentPrice"]');
      if (anyPrice) priceNis = priceToInt(anyPrice.textContent || "");
    }

    let eilatPriceNis = null;
    const eilatWrap = card.querySelector('[class*="eilatPriceWrapper"]');
    if (eilatWrap) {
      const eilatNode = eilatWrap.querySelector('[class*="currentPrice"]');
      if (eilatNode) eilatPriceNis = priceToInt(eilatNode.textContent || "");
    }

    let imageUrl = null;
    const img = card.querySelector('[class*="imageWrapper"] img');
    if (img) {
      const src = img.getAttribute("src") || img.getAttribute("data-src");
      if (src) imageUrl = absUrl(src);
    }

    return {
      name,
      brand,
      sku,
      itemId,
      priceNis,
      eilatPriceNis,
      url,
      imageUrl,
    };
  }

  /* === List view parser ===
     KSP's list view has a different DOM shape than the grid view:
       - Title:  <h3><a href="/web/item/NNN">  (no productTitle class).
       - SKU:    <span aria-label="מספר קטלוגיNNN">  (no skuWrapper).
       - Brand:  <div class="root-0-3-705">…<img alt="Brand name">  — the
                 alt text is literally the placeholder "Brand name", so
                 there's no usable brand string. We leave brand null and
                 rely on the title (which always starts with the brand
                 name in KSP listings).
       - Prices: same regular/eilat wrapper classes exist, but the regular
                 currentPrice no longer carries `aria-label^="מחיר המוצר"`.
                 We read the numeric value from the inner currentPrice
                 element's textContent in both cases. */
  function parseListCard(card) {
    const titleA = card.querySelector('h3 a[href^="/web/item/"]');
    if (!titleA) return null;

    const name = firstText(titleA) || "";
    const url = absUrl(titleA.getAttribute("href"));

    let itemId = null;
    if (url) {
      const m = url.match(/\/item\/(\d+)/);
      if (m) itemId = m[1];
    }

    let sku = null;
    const skuEl = card.querySelector('[aria-label^="מספר קטלוגי"]');
    if (skuEl) {
      const aria = skuEl.getAttribute("aria-label") || "";
      const m = aria.match(/(\d+)/);
      if (m) sku = m[1];
    }

    let priceNis = null;
    const regWrap = card.querySelector('[class*="regularPriceWrapper"]');
    if (regWrap) {
      const curr = regWrap.querySelector('[class*="currentPrice"]');
      if (curr) priceNis = priceToInt(curr.textContent || "");
    }

    let eilatPriceNis = null;
    const eilatWrap = card.querySelector('[class*="eilatPriceWrapper"]');
    if (eilatWrap) {
      const curr = eilatWrap.querySelector('[class*="currentPrice"]');
      if (curr) eilatPriceNis = priceToInt(curr.textContent || "");
    }

    let imageUrl = null;
    const img = card.querySelector('[class*="imageWrapper"] img');
    if (img) {
      const src = img.getAttribute("src") || img.getAttribute("data-src");
      if (src) imageUrl = absUrl(src);
    }

    return {
      name,
      brand: null,
      sku,
      itemId,
      priceNis,
      eilatPriceNis,
      url,
      imageUrl,
    };
  }

  function extractAll(root) {
    const products = [];
    for (const card of findCards(root)) {
      const p = parseCard(card);
      if (p && p.name) products.push(p);
    }
    return products;
  }

  window.KSPExtract = { findCards, parseCard, extractAll, CARD_RE };
})();
