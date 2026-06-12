# KSP Extractor — Privacy Policy

_Last updated: 2026-06-08_

This document is also available [in Hebrew below](#מדיניות-פרטיות-עברית).

## What this extension does

KSP Extractor reads the product cards on pages you visit on `ksp.co.il` and offers
to either copy them to your clipboard or send them, together with a question
you type, to an AI provider (Claude, OpenAI, or Google Gemini) of your choice.

## What data is collected, where it goes

**Nothing is sent to the extension author or any third party we control.** We
have no servers, no analytics, no telemetry.

| Data | Where it lives | Who can read it |
|---|---|---|
| Your API keys (Claude / OpenAI / Gemini) | Only `chrome.storage.local` on your machine | Only this extension on your device |
| Extracted product data | Memory only, while the popup is open | The AI provider you choose, _only_ when you press "Ask" |
| Your question to the AI | Memory only, while the popup is open | Same as above |
| Browsing history | Never read or stored | — |
| Page contents on non-KSP sites | Never read | — |

When you press "Ask", the extension makes a single HTTPS request to the API
endpoint of the provider you chose:

- **Claude** → `https://api.anthropic.com/v1/messages`
- **OpenAI** → `https://api.openai.com/v1/chat/completions`
- **Gemini** → `https://generativelanguage.googleapis.com/v1beta/...`

That request carries your API key, the extracted products, and your question.
The provider's privacy policy governs what they do with it. The extension
author has no access to it.

## Permissions we request and why

- `storage` — to save your API keys and preferences locally.
- `activeTab` — to read the rendered product DOM of the KSP tab you're on.
- `host_permissions` for `https://ksp.co.il/*` — so the floating "Extract"
  button can mount on KSP grid pages.
- `optional_host_permissions` for `api.anthropic.com`, `api.openai.com`, and
  `generativelanguage.googleapis.com` — requested only when you save a key
  for that provider. Decline freely; "Copy" still works without them.

## What you can do

- Remove your keys at any time from the extension's settings page.
- Uninstall the extension — all stored data is removed by your browser.
- Read the source: <https://github.com/Nisanez/ksp-extractor-extension>.

## Contact

Open an issue at the GitHub repo above.

---

<h2 id="מדיניות-פרטיות-עברית" dir="rtl">מדיניות פרטיות</h2>

<div dir="rtl">

**מה התוסף עושה.** התוסף KSP Extractor קורא את כרטיסי המוצרים בעמודים שאתה גולש בהם
ב-`ksp.co.il` ומציע או להעתיק אותם ללוח שלך, או לשלוח אותם — יחד עם שאלה
שאתה כותב — לספק בינה מלאכותית שאתה בוחר (Claude, OpenAI או Google Gemini).

**אילו נתונים נאספים.** **שום דבר לא נשלח למפתח התוסף או לצד שלישי שאנו
מפעילים.** אין לנו שרתים, אין אנליטיקה, אין טלמטריה.

| נתון | היכן נשמר | מי קורא |
|---|---|---|
| מפתחות ה-API שלך | רק `chrome.storage.local` במכשירך | רק התוסף על המכשיר שלך |
| מוצרים שחולצו | בזיכרון בלבד, כל עוד החלון פתוח | ספק ה-AI שבחרת, רק כשתלחץ "שאל" |
| השאלה שלך | בזיכרון בלבד | אותו דבר |
| היסטוריית גלישה | לעולם לא נקראת | — |
| תוכן עמודים שאינם KSP | לעולם לא נקרא | — |

**הרשאות.** `storage` (לשמירת מפתחות), `activeTab` (לקריאת ה-DOM של הטאב שאתה
נמצא בו), והרשאת מארח ל-`ksp.co.il`. הרשאות לכתובות ה-AI מתבקשות **רק** כשאתה
שומר מפתח לאותו ספק.

**מה אתה יכול לעשות.** למחוק מפתחות בכל עת מעמוד ההגדרות, להסיר את התוסף
(שיוסיר את כל הנתונים), או לקרוא את הקוד ב-<https://github.com/Nisanez/ksp-extractor-extension>.

</div>
