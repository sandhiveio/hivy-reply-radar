const API_URL = 'https://linkedin-posts-search-api.p.rapidapi.com/search-posts';
const API_HOST = 'linkedin-posts-search-api.p.rapidapi.com';
const GENERATOR_API_URL =
  'https://ai-comment-generator-api-human-like-personalized-replies.p.rapidapi.com/api/gate_api.php';
const GENERATOR_API_HOST = 'ai-comment-generator-api-human-like-personalized-replies.p.rapidapi.com';
const FEED_CACHE_KEY = 'reply-radar-feed-cache-v1';
const POST_CACHE_KEY = 'reply-radar-post-cache-v1';
const SHOWN_CACHE_KEY = 'reply-radar-shown-posts-v1';
const FEEDBACK_KEY = 'reply-radar-feedback-v1';
const EMPTY_POST_FILTER_KEY = 'reply-radar-empty-post-filter-enabled-v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FEED_TTL_MS = 20 * 60 * 1000;
const LOW_COMMENTS_THRESHOLD = 8;
const PAGE_LIMIT = 10;
const MAX_OFFSET_ATTEMPTS = 12;
const MIN_LIKES_PER_HOUR = 5;
const EXCLUDE_WORDS_FILTER =
  'hiring join team looking hire opening vacancy apply alert referral cv role position open congratulating congratulations welcome thrilled excited happy proud announce joined joining moving starting role journey chapter career promotion grateful opportunity blessed stay tuned';
const LOW_SIGNAL_POST_PATTERNS = [
  // Hiring and recruiting
  /\b(?:we(?:'re| are)?\s+)?hiring\b/i,
  /\bhiring(?:\s+now|\s+alert|\s+for)?\b/i,
  /\bjoin (?:our|my) team\b/i,
  /\bjoin us\b/i,
  /\bwe are looking for\b/i,
  /\blooking to hire\b/i,
  /\blooking for (?:a|an|our next)\b/i,
  /\bopen(?:ing)?(?:s)?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bjob alert\b/i,
  /\brefer(?:ral|rals)?\b/i,
  /\bsend (?:me|us) (?:your )?cv\b/i,
  /\bdm me\b.*\b(?:role|job|position)\b/i,
  /\bposition (?:is )?open\b/i,
  /\bopportunit(?:y|ies) to join\b/i,

  // Generic low-signal congrats / people updates
  /\bplease join us in congratulating\b/i,
  /\bjoin me in congratulating\b/i,
  /\bcongratulations to\b/i,
  /\bwelcom(?:e|ing)\b.*\bto (?:the )?team\b/i,
  /\bexcited to welcome\b/i,
  /\bthrilled to welcome\b/i,

  // Personal role/achievement announcements
  /\bi'?m thrilled to share\b/i,
  /\bi am thrilled to share\b/i,
  /\bi'?m excited to share\b/i,
  /\bi am excited to share\b/i,
  /\bi'?m happy to share\b/i,
  /\bi am happy to share\b/i,
  /\bi'?m proud to share\b/i,
  /\bi am proud to share\b/i,
  /\bi'?m proud to be (?:a )?part of\b/i,
  /\bi am proud to be (?:a )?part of\b/i,
  /\bi'?m excited to announce\b/i,
  /\bi am excited to announce\b/i,
  /\bi'?m thrilled to announce\b/i,
  /\bi am thrilled to announce\b/i,
  /\bi'?m delighted to announce\b/i,
  /\bi am delighted to announce\b/i,
  /\bi'?m excited to start\b/i,
  /\bi am excited to start\b/i,
  /\bi'?ve joined\b/i,
  /\bi have joined\b/i,
  /\bi'?m joining\b/i,
  /\bi am joining\b/i,
  /\bi'?m moving to\b/i,
  /\bi am moving to\b/i,
  /\bstarting a new position\b/i,
  /\bnew role\b/i,
  /\bnew journey\b/i,
  /\bnext chapter\b/i,
  /\bcareer update\b/i,
  /\bpromotion\b/i,
  /\bhonored to be promoted\b/i,
  /\bgrateful to share that\b/i,
  /\bgrateful to announce\b/i,

  // Empty fluff patterns
  /\bwhat a journey\b/i,
  /\bso grateful for this opportunity\b/i,
  /\bfeeling blessed\b/i,
  /\bdream come true\b/i,
  /\bstay tuned\b/i,
  /\bbig things coming\b/i,
  /\bcan'?t wait for what'?s next\b/i,
  /\bonwards and upwards\b/i,
];
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
const REPOST_STYLE_PROMPT = [
  `## Goal of repost text

- Keep the same positioning as comments:
  - founder-level builder in scraping/crawlers/unofficial APIs/ETL/data quality.
- Repost text should work as a **short accompanying caption** to someone else's post.
- Add useful context for your audience and invite discussion without hijacking the original author's message.

## Style & tone

When you write repost text:

- Keep the same voice as comments: calm, practical, confident, no hype.
- Prefer concise format:
  - usually **2–4 short lines/sentences**.
- Start with a concrete takeaway from the original post (not generic praise).
- Add one of:
  - a practical nuance from your experience, or
  - a specific implementation angle, or
  - a thoughtful question to your network.
- Respect original author:
  - no clickbait, no overclaiming, no "hot take" aggression.
- Avoid sales CTA and avoid sounding like a pitch.
- Mention AI/LLMs only when the original post is clearly about it; otherwise focus on systems, data quality, reliability, and outcomes.`,
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
const copyCommentBtn = document.getElementById('copyCommentBtn');

const refreshBtn = document.getElementById('refreshBtn');
const nextBtn = document.getElementById('nextBtn');
const emptyPostsFilterToggle = document.getElementById('emptyPostsFilterToggle');

let currentPost = null;
let queue = [];
let generationRequestId = 0;
let paginationOffset = 0;
let hasMorePosts = true;
let isFetchingMore = false;

const config = window.RAPID_API_CONFIG;
const fallbackToken = getFallbackToken();
const apiKey = config?.key || fallbackToken;

if (!apiKey) {
  setStatus('API key not found. Add api-config.js (see api-config.example.js).');
  addLog('Missing API key. Configure api-config.js to start.');
} else {
  addLog('API key loaded. Bootstrapping feed.');
  bootstrap();
}

refreshBtn.addEventListener('click', () => {
  addLog('Manual refresh triggered.');
  bootstrap({ forceRefresh: true });
});
nextBtn.addEventListener('click', () => {
  addLog('Moved to next post.');
  showNextPost();
});
emptyPostsFilterToggle.checked = isEmptyPostFilterEnabled();
emptyPostsFilterToggle.addEventListener('change', () => {
  localStorage.setItem(EMPTY_POST_FILTER_KEY, JSON.stringify(emptyPostsFilterToggle.checked));
  addLog(`Low-signal filter ${emptyPostsFilterToggle.checked ? 'enabled' : 'disabled'}.`);
  bootstrap({ forceRefresh: false });
});
document.querySelectorAll('[data-feedback]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!currentPost) return;
    storeFeedback(currentPost.postKey, btn.dataset.feedback);
    addLog(`Feedback "${btn.dataset.feedback}" saved.`);
    showNextPost();
  });
});
copyCommentBtn?.addEventListener('click', () => copyCurrentSuggestion());

async function bootstrap({ forceRefresh = false } = {}) {
  try {
    hasMorePosts = true;
    paginationOffset = 0;
    setStatus('Fetching posts…');
    addLog(`Fetching posts (${forceRefresh ? 'force refresh' : 'cache allowed'}).`);
    queue = [];
    await loadMorePosts({ forceRefresh });
    if (!queue.length) {
      const filterSuffix = isEmptyPostFilterEnabled()
        ? ' (some posts were excluded by the hiring/empty-post filter).'
        : '.';
      setStatus(`No fresh posts: all posts were already shown in the last 7 days${filterSuffix} Click "Refresh posts" later.`);
      addLog('No fresh posts available after filtering and recent-history check.');
      hideWidget();
      return;
    }

    addLog(`Queue prepared with ${queue.length} post(s).`);
    showWidget();
    showNextPost();
  } catch (error) {
    setStatus(`Loading error: ${error.message}`);
    addLog(`Bootstrap failed: ${error.message}`);
    hideWidget();
  }
}

async function getPosts({ forceRefresh, offset = 0 }) {
  pruneStorage();
  if (!forceRefresh) {
    const cachedFeed = readJson(FEED_CACHE_KEY, null);
    if (offset === 0 && cachedFeed && Date.now() - cachedFeed.cachedAt < FEED_TTL_MS) {
      return cachedFeed.posts || [];
    }
  }

  const shownCache = readJson(SHOWN_CACHE_KEY, {});
  const now = Date.now();
  let currentOffset = offset;
  let result = null;

  for (let attempt = 0; attempt < MAX_OFFSET_ATTEMPTS; attempt += 1) {
    const payload = {
      minLikesPerHour: MIN_LIKES_PER_HOUR,
      limit: PAGE_LIMIT,
      offset: currentOffset,
      country: 'www',
    };
    if (isEmptyPostFilterEnabled()) {
      payload.excludeWords = EXCLUDE_WORDS_FILTER;
    }
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

    currentOffset += PAGE_LIMIT;
  }

  const responsePosts = result?.data || [];
  upsertPostCache(responsePosts);

  const posts = responsePosts.map((post) => ({
    ...post,
    cachedAt: Date.now(),
  }));

  if (offset === 0) {
    localStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        posts,
      }),
    );
  }

  return posts;
}

function showNextPost() {
  if (!queue.length) {
    addLog('Queue is empty, requesting another page.');
    loadMorePosts().then(() => {
      if (!queue.length) {
        setStatus('No more posts in the queue. You can refresh the feed.');
        addLog('No more posts available.');
        hideWidget();
        return;
      }
      showNextPost();
    });
    return;
  }

  currentPost = queue.shift();
  addLog(`Rendering post by ${currentPost.author || 'Unknown author'}.`);
  markShown(currentPost.postKey);
  renderPost(currentPost);

  if (queue.length <= 2) {
    loadMorePosts();
  }
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
  addLog(
    `${lowComments ? 'Comment' : 'Repost'} suggestion requested (${post.commentsCount ?? 0} comments).`,
  );
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
        style_prompt: suggestionType === 1 ? GENERATION_STYLE_PROMPT : REPOST_STYLE_PROMPT,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (requestId !== generationRequestId) return;

    const generatedReply = data?.reply?.trim();
    if (!generatedReply) throw new Error('Empty generator response');

    addLog('Suggestion generated successfully.');
    setDraftText(generatedReply);
  } catch (error) {
    if (requestId !== generationRequestId) return;
    setDraftText(
      suggestionType === 1
        ? 'Could not generate comment now. Try Next or Refresh posts.'
        : 'Could not generate repost text now. Try Next or Refresh posts.',
    );
    addLog(`Suggestion generation failed: ${error.message}`);
  }
}

async function loadMorePosts({ forceRefresh = false } = {}) {
  if (isFetchingMore || !hasMorePosts) return;

  isFetchingMore = true;
  setStatus('Fetching posts…');

  try {
    const posts = await getPosts({ forceRefresh, offset: paginationOffset });
    const filteredPosts = isEmptyPostFilterEnabled()
      ? posts.filter((post) => !isLowSignalPost(post.text))
      : posts;
    const visiblePosts = filteredPosts.filter((post) => !wasShownRecently(post.postKey));
    queue.push(...visiblePosts);
    addLog(`Loaded ${posts.length} post(s), ${visiblePosts.length} visible after filtering.`);

    paginationOffset += PAGE_LIMIT;
    if (posts.length < PAGE_LIMIT) {
      hasMorePosts = false;
    }
  } catch (error) {
    setStatus(`Loading error: ${error.message}`);
    addLog(`Feed loading failed: ${error.message}`);
    throw error;
  } finally {
    isFetchingMore = false;
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

async function copyCurrentSuggestion() {
  const text = commentDraft?.textContent?.trim();
  if (!text || commentDraft.classList.contains('is-loading')) return;

  const restoreCopyText = () => {
    copyCommentBtn.innerHTML = '<span aria-hidden="true">📋</span><span>Copy</span>';
  };

  if (!navigator.clipboard?.writeText) {
    copyCommentBtn.textContent = 'Copy unavailable';
    setTimeout(restoreCopyText, 1300);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    addLog('Suggestion copied to clipboard.');
    copyCommentBtn.textContent = 'Copied!';
  } catch {
    addLog('Clipboard write failed.');
    copyCommentBtn.textContent = 'Copy failed';
  }
  setTimeout(restoreCopyText, 1300);
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

function isEmptyPostFilterEnabled() {
  return readJson(EMPTY_POST_FILTER_KEY, true) !== false;
}

function isLowSignalPost(text) {
  if (!text) return false;
  return LOW_SIGNAL_POST_PATTERNS.some((pattern) => pattern.test(text));
}

function addLog(message) {
  void message;
}
