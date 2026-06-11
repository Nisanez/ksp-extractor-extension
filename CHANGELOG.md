# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-09

Initial public release. Browser extension (Chrome MV3 + Firefox MV3) that
extracts product listings from ksp.co.il and pipes them to Claude, OpenAI,
or Gemini — Hebrew-first UI for Israeli shoppers.

### Added
- **Content script** — extracts product cards from KSP category, search,
  brand, and shop grids. Uses MUI class-name *prefix* matching (`product-0-3-*`)
  so the extractor survives MUI's per-build hash regeneration. Ports the
  selector logic from the original `legacy-python/ksp_extract.py` POC.
- **Floating "Analyze with AI" button** — fixed to bottom-left so it doesn't
  collide with KSP's add-to-cart on the right. Three visual states
  (default / hover / extracting) and SPA-route-aware via MutationObserver.
- **Popup with three tabs** — Hebrew-first, RTL by default:
  - **Products** — extracted table with name / brand / price / Eilat price /
    item link. Prices wrapped in `dir="ltr"` to keep ₪ glyph order intact.
    Copy as Markdown, JSON, or LLM-ready prompt. All four states ship
    (loading / loaded / empty / error).
  - **Ask AI** — provider dropdown (Claude / OpenAI / Gemini), question
    textarea, response panel with copy-to-clipboard. All four states ship
    (default / loading / response / error).
  - **Settings (mini)** — per-provider key status, language toggle
    (עברית / English), link to the full options page.
- **Full options page** — API key entry for all three providers with
  links to each provider's console; default-provider picker; always-visible
  privacy notice (per the design's "trust = key" post-it).
- **Three LLM provider adapters** in the background service worker:
  - **Claude** — `claude-sonnet-4-5` via `api.anthropic.com/v1/messages`
    with the `anthropic-dangerous-direct-browser-access: true` header that
    Anthropic requires for non-server origins.
  - **OpenAI** — `gpt-4o-mini` via `api.openai.com/v1/chat/completions`.
  - **Gemini** — `gemini-2.0-flash` via the Google AI Studio endpoint.
- **In-flight request survival** — the service worker stamps `lastAsk`
  *before* the fetch resolves and updates it on completion, so closing
  and reopening the popup mid-request restores the loading state or the
  finished answer instead of losing tokens.
- **Bilingual i18n** — `_locales/he` (default) + `_locales/en` with 68
  message keys each. Hebrew is primary because `default_locale: "he"`
  in `manifest.json`.
- **Privacy by design** — API keys live in `chrome.storage.local` only;
  requests go straight from the user's browser to the chosen provider with
  no proxy server. Documented in [`docs/privacy-policy.md`](docs/privacy-policy.md).
- **CI** — `.github/workflows/build.yml` lints with `web-ext` on every PR
  and, on `v*` tag push, builds the zip and attaches it to a GitHub Release
  with auto-generated notes.
- **Legacy Python script** preserved at `legacy-python/ksp_extract.py` for
  power users who want to pipe extractions into shell scripts.

### Design source of truth
- `Design/KSP LLM Wireframes.html` is the authoritative UI spec — every
  popup tab, every state, every copy string is rendered there.
  Implementation tracks it section-by-section.

### Permissions
- Required: `storage`, `activeTab`, `host_permissions: https://ksp.co.il/*`.
- Optional (requested on key save in Options): the three LLM API origins.

[Unreleased]: https://github.com/Nisanez/ksp-extractor-extension/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Nisanez/ksp-extractor-extension/releases/tag/v0.1.0
