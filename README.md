<div align="right" dir="rtl">

# KSP × AI ✨

**תוסף דפדפן בעברית שמחלץ מוצרים מ-KSP ושולח אותם לבינה מלאכותית.**

קונים הרבה ב-KSP ומתייעצים עם AI? עכשיו אפשר לעשות את זה בלחיצה אחת.
פתחו עמוד קטגוריה / חיפוש / מותג ב-KSP, לחצו על הכפתור הצף, וקבלו את הרשימה
מוכנה להעתקה ל-Claude / GPT / Gemini — או שלחו אותה ישירות מתוך התוסף.

[English ↓](#english)

</div>

<!-- A demo GIF will live at docs/screenshots/demo.gif once recorded. -->

<div align="right" dir="rtl">

## תכונות עיקריות

- 🔍 **חילוץ אוטומטי** — כפתור צף בעמודי קטגוריה, חיפוש, מותג וחנויות.
- 🇮🇱 **עברית קודם** — כל הממשק בעברית עם תמיכה ב-RTL; אפשר לעבור לאנגלית.
- 🤖 **שלושה ספקי AI** — Claude (Anthropic), OpenAI GPT, Google Gemini. אתה
  מספק את המפתח שלך, הוא נשמר רק במכשיר שלך.
- 📋 **גם בלי AI** — העתק כ-Markdown, JSON, או פרומפט מוכן לכל מודל.
- 🔒 **פרטיות מלאה** — אין שרתים, אין אנליטיקה, אין טלמטריה. ראה
  [מדיניות פרטיות](docs/privacy-policy.md).

## התקנה

### Chrome / Edge (טעינה ידנית עד אישור בחנות)

1. הורד את קובץ ה-`.zip` האחרון מ-[Releases](../../releases).
2. פתח `chrome://extensions` והפעל "מצב מפתח".
3. גרור את ה-zip לחלון, או לחץ "Load unpacked" ובחר את תיקיית `extension/`
   מהריפו אם שיבטת אותו.

### Firefox

1. `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → בחר את
   `extension/manifest.json`.

### מתוך קוד מקור

```bash
git clone https://github.com/Nisanez/ksp-extractor-extension
cd ksp-extractor-extension
npm install
npm run lint
npm run zip   # מייצר dist/ksp_ai_-0.1.0.zip
```

## שימוש

1. פתח עמוד קטגוריה ב-KSP, למשל
   [DJI Mics](https://ksp.co.il/web/cat/2085..96463..96485).
2. לחץ על "✨ נתח עם AI" בפינה השמאלית התחתונה (או על אייקון התוסף).
3. בלשונית "מוצרים" — לחץ "פרומפט" כדי להעתיק טקסט מוכן לדבק בכל בוט.
4. בלשונית "שאל AI" — בחר ספק, רשום שאלה (ברירת המחדל: "איזה מוצר הכי משתלם
   כאן? ענה בעברית.") וקבל תשובה.

## פיתוח

עיין ב-[`Design/KSP LLM Wireframes.html`](Design/KSP%20LLM%20Wireframes.html)
כדי לראות את ה-wireframes המלאים — הוא משמש כמקור האמת לעיצוב. הקוד הוא JS
ווניל ללא שלב build.

| תיקייה | תוכן |
|---|---|
| `extension/` | קוד התוסף שמוטען ל-Chrome / Firefox |
| `extension/src/content/` | תסריט חילוץ + כפתור צף |
| `extension/src/popup/` | חלון התוסף עם 3 לשוניות |
| `extension/src/background/` | service worker + מתאמים ל-Claude/OpenAI/Gemini |
| `extension/src/options/` | עמוד הגדרות מלא |
| `Design/` | wireframes (HTML + JSX) |
| `legacy-python/` | התסריט ב-Python ששימש כ-POC |

## מתי לחפש איפה ב-DOM?

KSP הוא SPA של React + Material-UI. שמות ה-class מתחילים בתבנית קבועה אך
מסתיימים במספר רץ (`product-0-3-312` → `-557` במבנה הבא). הקוד תופס רק את
הקידומת, אז אם MUI ימחזר את ה-hash התוסף ימשיך לעבוד. ראה
[`extension/src/content/extract.js`](extension/src/content/extract.js).

</div>

---

<a name="english"></a>

# KSP × AI ✨ (English)

A Hebrew-first browser extension that extracts product listings from
[ksp.co.il](https://ksp.co.il) — Israel's largest electronics retailer — and
turns them into something an LLM can chew on. Buy a lot from KSP and consult
with AI before deciding? This is for you.

## Features

- 🔍 **One-click extraction** from category, search, brand, and shop pages.
- 🇮🇱 **Hebrew-first UI** with full RTL; English is one toggle away.
- 🤖 **Three LLM providers** — Claude (Anthropic), OpenAI GPT, Google Gemini.
  Bring your own API key; it never leaves your device.
- 📋 **Works without AI** — copy as Markdown, JSON, or a ready-to-paste prompt.
- 🔒 **Privacy by default** — no servers, no analytics. See
  [privacy policy](docs/privacy-policy.md).

## Install

Download the latest `.zip` from [Releases](../../releases), then load it
unpacked in `chrome://extensions` (Developer mode on) or Firefox's
`about:debugging`.

## Develop

```bash
git clone https://github.com/Nisanez/ksp-extractor-extension
cd ksp-extractor-extension
npm install
npm run lint    # web-ext lint
npm run zip     # builds dist/*.zip — exactly what gets uploaded to the store
```

The design is the source of truth: open `Design/KSP LLM Wireframes.html` in a
browser to see every screen and state. Implementation tracks it line-by-line.

## License

[MIT](LICENSE).
