# Reply Radar (frontend-only)

A local frontend widget that fetches LinkedIn posts and suggests draft comments.

## Features

- Sends requests to RapidAPI `linkedin-posts-search-api`.
- Shows a post card, engagement metrics, a draft comment, and CTA.
- Action buttons: **Relevant / Not relevant / Next**.
- Caches data:
  - post feed for 20 minutes to avoid excessive API calls;
  - each post and post-view marker for **7 days**.
- If comment count is low (less than 8), suggests leaving a comment.
- If comment count is high, suggests making a quote post.

## Quick start

1. Copy the config template:

```bash
cp api-config.example.js api-config.js
```

2. Put your short-lived API key into `api-config.js`.
3. Open `index.html` in your browser.

> Important: `api-config.js` is ignored by Git to prevent key leaks.
