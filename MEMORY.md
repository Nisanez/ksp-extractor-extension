# Project memory

Notes for future sessions. Things that were non-obvious or cost time to discover, so we don't relearn them.

## How KSP serves its pages

- **It's a fully client-rendered React SPA.** `curl https://ksp.co.il/web/cat/245` returns just `<div id="root"></div>` and a JS bundle. No useful HTML for scrapers.
- **The internal JSON API (`/m_action/api/...`) is behind a Cloudflare challenge** (HTTP 403 + "Just a moment..." page) when called without a real browser. Don't try to reverse-engineer it — it's not worth it.
- **Conclusion:** any "give it a URL" Python tool needs Playwright (~150 MB browser). That's why we pivoted to a browser extension — runs in the already-loaded DOM, no Cloudflare, no headless install.

## The MUI class-name hash trick

KSP uses Material-UI which generates classes like `product-0-3-312`, `productTitle-0-3-341`, `currentPrice-0-3-366`. **The trailing number rebuilds on every deploy** (different category pages within the same session can have different suffixes — `input.txt` had `product-0-3-557` while `sample.html` had `product-0-3-312`).

Selector rule: **match the prefix only**, never the full class.

```js
// What works:
const CARD_RE = /(^|\s)product-0-3-\d+(\s|$)/;
document.querySelectorAll('div[class*="product-0-3-"]')   // candidate cards

// Then for each card, prefix-match the inner selectors:
card.querySelector('a[class*="productTitle"]')
card.querySelector('[class*="regularPriceWrapper"] [aria-label^="מחיר המוצר"]')
card.querySelector('[class*="eilatPriceWrapper"] [class*="currentPrice"]')
card.querySelector('[class*="brandWrapper"] img')         // brand from img alt
card.querySelector('[class*="skuWrapper"]')               // SKU from aria-label digits
```

The regular price is most reliable via the **aria-label** (`"מחיר המוצר 1,249"`) — it's a clean integer with no shekel sign or comma issues.

The `[class*="product-0-3-"]` selector would also match the nested `productContent-0-3-…` divs without the regex post-filter — so the two-step (querySelector + regex test) is necessary, not a paranoid extra.

## Browser-extension gotchas we hit

### Mozilla AMO lint requires Firefox 128+ for `optional_host_permissions`
Earlier `strict_min_version` (e.g. 115) causes `KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` errors. Bump to `"128.0"` for both `gecko` and `gecko_android`.

### Cross-browser background — declare BOTH `service_worker` and `scripts`
Chrome MV3 requires `background.service_worker`. Firefox MV3 doesn't support it — it wants `background.scripts: [...]`. The cross-browser pattern is to include both keys with the same file:

```json
"background": {
  "service_worker": "src/background/service_worker.js",
  "scripts": ["src/background/service_worker.js"],
  "type": "module"
}
```

Each browser ignores the key it doesn't understand. `web-ext lint` will print a benign warning for the unused one — accept it.

### No `innerHTML`, ever — even with escaped content
AMO's linter fires `UNSAFE_VAR_ASSIGNMENT` on any `el.innerHTML = ...`, *including* clearing with `""`. Use:
- `panel.replaceChildren()` to clear.
- DOM construction (`document.createElement` + `append` + `createTextNode`) for content.
- For a Markdown-ish renderer, parse line-by-line and build `<strong>`/`<br>`/text nodes — see `extension/src/popup/tabs/ai.js#renderMarkdownInto` for the pattern.

### Future-required: `data_collection_permissions`
AMO is starting to require `browser_specific_settings.gecko.data_collection_permissions`. For an extension that collects nothing, set:
```json
"data_collection_permissions": { "required": ["none"] }
```

### Anthropic API from a browser context
`POST https://api.anthropic.com/v1/messages` blocks browser-origin calls by default. Add the header:
```
anthropic-dangerous-direct-browser-access: true
```
plus `anthropic-version: 2023-06-01`. This is the documented way for extensions to call Anthropic directly — no proxy needed.

### Optional host permissions need a user gesture
`chrome.permissions.request({origins: [...]})` only works from a user-gesture stack frame. **The cleanest UX** is to request when the user clicks Save on the options page (which already is a click) — that way the popup's "Ask" flow never has to surface a permission prompt mid-request. The background SW just checks `chrome.permissions.contains(...)` and throws `host_permission_missing` if it's not granted.

### Popup needs `chrome.tabs.sendMessage`, not `chrome.scripting`
If a content script is already declared in the manifest for the target URL, the popup can talk to it via `chrome.tabs.sendMessage(tabId, {type: "extract-now"})` and a listener in the content script. **No `scripting` permission needed** — keeps the install dialog short, which reviewers like.

### Cache extraction by URL
The background SW caches the last extraction. **Always check `cached.pageUrl === currentTabUrl` before reusing** — otherwise you'll show category A's products to a user who's now on category B (very easy to hit in the SPA).

## Hebrew / RTL specifics

- Set `<html lang="he" dir="rtl">` in popup.html and options.html. `manifest.default_locale: "he"` makes the Web Store listing default to Hebrew for IL users.
- **Wrap prices in `dir="ltr"`** cells (`<span dir="ltr">₪3,499</span>`). Without this, BiDi reorders the digits around the shekel sign. Per the design's yellow post-it on § ③.
- Provider system prompts include the line `Respond in Hebrew unless the user writes in English.` so even GPT/Gemini answer in Hebrew without user effort.
- The font KSP itself uses is **Assistant** — putting it first in the popup's font stack makes the extension feel native.

## Design source of truth

`Design/KSP LLM Wireframes.html` is the authoritative UI spec. Every popup tab, every state, every copy string is in there. Implementation tracks it line-by-line:

| Wireframe | Implementation |
|---|---|
| § ① `FloatBtnDemo` (lines 511–568) | `extension/src/content/inject.js` + `inject.css` |
| § ② `Shell` (lines 146–199) — Variant A | `extension/src/popup/popup.html` + `popup.css` |
| § ③ `Prod*` (lines 242–309) | `extension/src/popup/tabs/products.js` |
| § ④ `AI*` (lines 311–394) | `extension/src/popup/tabs/ai.js` |
| § ⑤ `SettingsMini` (396–439), `OptionsPage` (441–508) | `extension/src/popup/tabs/settings_mini.js`, `extension/src/options/` |
| Color/font tokens (lines 22–32) | `extension/src/styles/tokens.css` |

Post-it constraints — these are non-negotiable, baked into the design:
- § ① Floating button stays **bottom-LEFT** (KSP's add-to-cart sits on the right).
- § ③ Prices **always LTR**, never bidi-flipped.
- § ④ "Copy only" path is **first-class**; AI is secondary.
- § ⑤ Privacy notice is **always visible**, not behind a toggle.

## Local dev loop

```bash
npm install
npm run lint       # web-ext lint --self-hosted → must be 0 errors
npm run zip        # → dist/*.zip (exactly what gets uploaded to the store)
npm run run:firefox  # opens a fresh Firefox with the extension loaded
```

For Chrome: `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`.

For node sanity-check: `for f in $(find extension/src -name '*.js'); do node --check "$f"; done`.

## Where the legacy Python script lives

`legacy-python/ksp_extract.py` — the original prototype, kept for power users who want to pipe extracted data into scripts. **Don't delete it** — it's also the cleanest reference for the selector logic when porting changes (it's still tested via `legacy-python/sample.html` and `input.txt`).

## What's intentionally out of scope (v0.1)

- **Single-item pages.** The content script matches `/web/item/*` so the floating button could appear there, but the extractor returns 0 cards (item pages don't have `product-0-3-*` divs). Decided in planning: grids only.
- **Auto-fetch by URL from outside the browser.** That'd require Playwright; we chose the extension path instead. The Python script handles file/clipboard.
- **Streaming LLM responses.** All three adapters use single-shot `fetch`. Streaming is nice-to-have but adds chunk-parsing per provider; not worth it for short responses.
- **Build step (bundler / TS).** Vanilla JS keeps the contribution barrier low and store review fast. Revisit if we need shared imports across content/popup contexts.
