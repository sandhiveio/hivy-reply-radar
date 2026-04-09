# 🚀 Hivy Reply Radar

Beautiful frontend widget for finding engaging LinkedIn posts and generating high-quality draft replies/reposts in seconds.

## 🌐 Live Demo (Very Visible)

## **👉 [Open Hivy Reply Radar](https://sandhiveio.github.io/hivy-reply-radar/) 👈**

---

## ✨ What it does

- Pulls LinkedIn posts via RapidAPI (`linkedin-posts-search-api`).
- Displays a clean post card with:
  - author and post link;
  - engagement stats;
  - AI-generated reply or repost suggestion.
- Shows **live logs in the top-left corner** so you can track what the app is doing in real time.
- Lets you mark suggestions as:
  - **Relevant**
  - **Not relevant**
  - **Next**
- Uses caching to stay fast and API-friendly:
  - feed cache: **20 minutes**
  - shown posts / post metadata / feedback: **7 days**
- Applies a low-signal filter (hiring/congrats/empty-style posts) to keep feed quality high.

---

## ⚡ Quick Start

1. Create local config:

   ```bash
   cp api-config.example.js api-config.js
   ```

2. Add your short-lived RapidAPI key to `api-config.js`.
3. Open `index.html` in your browser.

> `api-config.js` is gitignored to prevent accidental key leaks.

---

## 🔗 Official Links

- **LinkedIn:** https://www.linkedin.com/in/alexeykirsanov/
- **X (Twitter):** https://x.com/IronRedSandHive
- **Website:** https://www.sandhive.io/
- **Telegram:** https://t.me/Abiron
