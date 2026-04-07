const API_URL = 'https://linkedin-posts-search-api.p.rapidapi.com/search-posts';
const API_HOST = 'linkedin-posts-search-api.p.rapidapi.com';
const GENERATOR_API_URL =
  'https://ai-comment-generator-api-human-like-personalized-replies.p.rapidapi.com/api/gate_api.php';
const GENERATOR_API_HOST = 'ai-comment-generator-api-human-like-personalized-replies.p.rapidapi.com';
const FEED_CACHE_KEY = 'reply-radar-feed-cache-v1';
const POST_CACHE_KEY = 'reply-radar-post-cache-v1';
const SHOWN_CACHE_KEY = 'reply-radar-shown-posts-v1';
const FEEDBACK_KEY = 'reply-radar-feedback-v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FEED_TTL_MS = 20 * 60 * 1000;
const LOW_COMMENTS_THRESHOLD = 8;
const PAGE_LIMIT = 10;
const MAX_OFFSET_ATTEMPTS = 5;
const GENERATION_STYLE_PROMPT = [
  `## Goal of comments

- **Network with founders, CTOs, Heads of Data, HRtech/fintech/Web3 people and growth leaders.**
- Be remembered as:
  - The person who understands **scraping, crawlers, unofficial APIs, ETL, data quality**.
  - A calm, practical **partner for data-heavy products**, not a spammy vendor.
- Comments should **start conversations**, not sell or pitch.

## Style & tone

When you write comments:

- Sound like a **senior builder / founder-level engineer**: calm, confident, no hype.
- Prefer **short, dense comments** over long rants:
  - Usually **1–3 sentences**, max 4 if really needed.
- No cheap praise like “Great post!” alone.
  - Always **add specific insight, example or question**.
- Avoid AI-hype words unless the post is explicitly about AI:
  - Don’t lean on “AI”, “LLM”, “gen AI” as the main thing.
  - Focus on **scraping, pipelines, infrastructure, quality, reliability, growth outcomes**.
- Be respectful and curious, even in disagreement.
  - Never aggressive, never condescending.`,
];

const loadingState = document.getElementById('loadingState');
const postCard = document.getElementById('postCard');
const suggestionPanel = document.getElementById('suggestionPanel');
const actions = document.getElementById('actions');

const authorLink = document.getElementById('authorLink');
const postDate = document.getElementById('postDate');
const postLink = document.getElementById('postLink');
const postText = document.getElementById('postText');
const likesBadge = document.getElementById('likesBadge');
const commentsBadge = document.getElementById('commentsBadge');
const suggestionBadge = document.getElementById('suggestionBadge');
const commentDraft = document.getElementById('commentDraft');

const refreshBtn = document.getElementById('refreshBtn');
const nextBtn = document.getElementById('nextBtn');

let currentPost = null;
let queue = [];
let generationRequestId = 0;

const config = window.RAPID_API_CONFIG;
const fallbackToken = getFallbackToken();
const apiKey = config?.key || fallbackToken;

if (!apiKey) {
  setStatus('API key not found. Add api-config.js (see api-config.example.js).');
} else {
  bootstrap();
}

refreshBtn.addEventListener('click', () => bootstrap({ forceRefresh: true }));
nextBtn.addEventListener('click', () => showNextPost());
document.querySelectorAll('[data-feedback]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!currentPost) return;
    storeFeedback(currentPost.postKey, btn.dataset.feedback);
    showNextPost();
  });
});

async function bootstrap({ forceRefresh = false } = {}) {
  try {
    setStatus('Fetching posts…');
    const posts = await getPosts({ forceRefresh });
    const visiblePosts = posts.filter((post) => !wasShownRecently(post.postKey));

    queue = visiblePosts;
    if (!queue.length) {
      setStatus('No fresh posts: all posts were already shown in the last 7 days. Click "Refresh posts" later.');
      hideWidget();
      return;
    }

    showWidget();
    showNextPost();
  } catch (error) {
    setStatus(`Loading error: ${error.message}`);
    hideWidget();
  }
}

async function getPosts({ forceRefresh }) {
  pruneStorage();
  if (!forceRefresh) {
    const cachedFeed = readJson(FEED_CACHE_KEY, null);
    if (cachedFeed && Date.now() - cachedFeed.cachedAt < FEED_TTL_MS) {
      return cachedFeed.posts || [];
    }
  }

  const shownCache = readJson(SHOWN_CACHE_KEY, {});
  const now = Date.now();
  let offset = 0;
  let result = null;

  for (let attempt = 0; attempt < MAX_OFFSET_ATTEMPTS; attempt += 1) {
    const payload = { minLikes: 100, limit: PAGE_LIMIT, offset, country: 'www' };
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    result = await response.json();
    if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid API response');

    const hasUnshownPosts = result.data.some((post) => {
      const shownAt = shownCache[post.postKey];
      return !(shownAt && now - shownAt < WEEK_MS);
    });
    const isLastPage = result.data.length < PAGE_LIMIT;
    if (hasUnshownPosts || isLastPage) break;

    offset += PAGE_LIMIT;
  }

  const responsePosts = result?.data || [];
  upsertPostCache(responsePosts);

  const posts = responsePosts.map((post) => ({
    ...post,
    cachedAt: Date.now(),
  }));

  localStorage.setItem(
    FEED_CACHE_KEY,
    JSON.stringify({
      cachedAt: Date.now(),
      posts,
    }),
  );

  return posts;
}

function showNextPost() {
  if (!queue.length) {
    setStatus('No more posts in the queue. You can refresh the feed.');
    hideWidget();
    return;
  }

  currentPost = queue.shift();
  markShown(currentPost.postKey);
  renderPost(currentPost);
}

function renderPost(post) {
  if (!postText) {
    setStatus('UI error: missing #postText element. Please reload the page.');
    hideWidget();
    return;
  }

  authorLink.textContent = post.author || 'Unknown author';
  authorLink.href = post.authorUrl || '#';
  postDate.textContent = new Date(post.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  postLink.href = post.postUrl;
  postText.textContent = truncate(post.text || 'No text', 700);
  likesBadge.textContent = `👍 ${post.likes ?? 0} likes`;
  commentsBadge.textContent = `💬 ${post.commentsCount ?? 0} comments`;

  const lowComments = (post.commentsCount ?? 0) < LOW_COMMENTS_THRESHOLD;
  suggestionBadge.textContent = lowComments ? 'Suggestion: leave a comment' : 'Suggestion: make a quote post';
  setDraftLoading(lowComments ? 'Generating relevant comment…' : 'Generating relevant repost text…');
  generateSuggestion(post, lowComments ? 1 : 2);

  loadingState.classList.add('hidden');
  postCard.classList.remove('hidden');
  suggestionPanel.classList.remove('hidden');
  actions.classList.remove('hidden');
}

async function generateSuggestion(post, suggestionType) {
  const requestId = ++generationRequestId;

  try {
    const response = await fetch(GENERATOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': GENERATOR_API_HOST,
        'x-rapidapi-key': apiKey,
      },
      body: JSON.stringify({
        tweet: post.text || '',
        user: { account: 'reply-radar' },
        t: suggestionType,
        name: 'reply-radar',
        style_prompt: GENERATION_STYLE_PROMPT,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (requestId !== generationRequestId) return;

    const generatedReply = data?.reply?.trim();
    if (!generatedReply) throw new Error('Empty generator response');

    setDraftText(generatedReply);
  } catch (error) {
    if (requestId !== generationRequestId) return;
    setDraftText(
      suggestionType === 1
        ? 'Could not generate comment now. Try Next or Refresh posts.'
        : 'Could not generate repost text now. Try Next or Refresh posts.',
    );
    console.error('Generation failed:', error);
  }
}

function setStatus(text) {
  loadingState.textContent = text;
  loadingState.classList.remove('hidden');
}

function hideWidget() {
  postCard.classList.add('hidden');
  suggestionPanel.classList.add('hidden');
  actions.classList.add('hidden');
}

function showWidget() {
  postCard.classList.remove('hidden');
  suggestionPanel.classList.remove('hidden');
  actions.classList.remove('hidden');
}

function setDraftLoading(text) {
  commentDraft.textContent = text;
  commentDraft.classList.add('is-loading');
}

function setDraftText(text) {
  commentDraft.textContent = text;
  commentDraft.classList.remove('is-loading');
}

function wasShownRecently(postKey) {
  const shown = readJson(SHOWN_CACHE_KEY, {});
  const shownAt = shown[postKey];
  return Boolean(shownAt && Date.now() - shownAt < WEEK_MS);
}

function markShown(postKey) {
  const shown = readJson(SHOWN_CACHE_KEY, {});
  shown[postKey] = Date.now();
  localStorage.setItem(SHOWN_CACHE_KEY, JSON.stringify(shown));
}

function storeFeedback(postKey, feedback) {
  const data = readJson(FEEDBACK_KEY, {});
  data[postKey] = {
    feedback,
    createdAt: Date.now(),
  };
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data));
}

function upsertPostCache(posts) {
  const cache = readJson(POST_CACHE_KEY, {});
  const now = Date.now();

  posts.forEach((post) => {
    cache[post.postKey] = {
      post,
      cachedAt: now,
      expiresAt: now + WEEK_MS,
    };
  });

  localStorage.setItem(POST_CACHE_KEY, JSON.stringify(cache));
}

function pruneStorage() {
  const now = Date.now();

  const shown = readJson(SHOWN_CACHE_KEY, {});
  Object.keys(shown).forEach((postKey) => {
    if (now - shown[postKey] >= WEEK_MS) delete shown[postKey];
  });
  localStorage.setItem(SHOWN_CACHE_KEY, JSON.stringify(shown));

  const postCache = readJson(POST_CACHE_KEY, {});
  Object.keys(postCache).forEach((postKey) => {
    if ((postCache[postKey]?.expiresAt ?? 0) <= now) delete postCache[postKey];
  });
  localStorage.setItem(POST_CACHE_KEY, JSON.stringify(postCache));

  const feedback = readJson(FEEDBACK_KEY, {});
  Object.keys(feedback).forEach((postKey) => {
    if (now - (feedback[postKey]?.createdAt ?? 0) >= WEEK_MS) delete feedback[postKey];
  });
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function getFallbackToken() {
  const encoded = 'M2FhNzNlYzMzZm1zaGNhZWJmMTEyYmY0NDlmN3AxZjJjOTBqc25hYjBjOTNmOGJiM2Q=';
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}
