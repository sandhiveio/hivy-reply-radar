const API_URL = 'https://linkedin-posts-search-api.p.rapidapi.com/search-posts';
const API_HOST = 'linkedin-posts-search-api.p.rapidapi.com';
const FEED_CACHE_KEY = 'reply-radar-feed-cache-v1';
const POST_CACHE_KEY = 'reply-radar-post-cache-v1';
const SHOWN_CACHE_KEY = 'reply-radar-shown-posts-v1';
const FEEDBACK_KEY = 'reply-radar-feedback-v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FEED_TTL_MS = 20 * 60 * 1000;
const LOW_COMMENTS_THRESHOLD = 8;

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

const config = window.RAPID_API_CONFIG;
if (!config?.key) {
  setStatus('Не найден API ключ. Добавьте файл api-config.js (см. api-config.example.js).');
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
    setStatus('Собираем посты…');
    const posts = await getPosts({ forceRefresh });
    const visiblePosts = posts.filter((post) => !wasShownRecently(post.postKey));

    queue = visiblePosts;
    if (!queue.length) {
      setStatus('Свежих постов нет: все уже показывались за последние 7 дней. Нажмите «Обновить посты» позже.');
      hideWidget();
      return;
    }

    showWidget();
    showNextPost();
  } catch (error) {
    setStatus(`Ошибка загрузки: ${error.message}`);
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

  const payload = { minLikes: 10, limit: 10, offset: 0 };
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': API_HOST,
      'x-rapidapi-key': config.key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) throw new Error('Некорректный ответ API');

  upsertPostCache(result.data);

  const posts = result.data.map((post) => ({
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
    setStatus('Посты в очереди закончились. Можно обновить фид.');
    hideWidget();
    return;
  }

  currentPost = queue.shift();
  markShown(currentPost.postKey);
  renderPost(currentPost);
}

function renderPost(post) {
  authorLink.textContent = post.author || 'Автор не указан';
  authorLink.href = post.authorUrl || '#';
  postDate.textContent = new Date(post.createdAt).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  postLink.href = post.postUrl;
  postText.textContent = truncate(post.text || 'Без текста', 700);
  likesBadge.textContent = `👍 ${post.likes ?? 0} лайков`;
  commentsBadge.textContent = `💬 ${post.commentsCount ?? 0} комментариев`;

  const lowComments = (post.commentsCount ?? 0) < LOW_COMMENTS_THRESHOLD;
  suggestionBadge.textContent = lowComments ? 'Рекомендация: оставить комментарий' : 'Рекомендация: сделать quote-post';
  commentDraft.textContent = lowComments
    ? 'Классная мысль! Особенно понравилось, как вы описали практический кейс. Я бы добавил, что на этапе внедрения важно заранее определить метрики качества.'
    : 'Сильный тезис, забираю в quote 👏 Отдельно отмечу идею про скорость итераций — в командах это реально становится новым конкурентным преимуществом.';

  loadingState.classList.add('hidden');
  postCard.classList.remove('hidden');
  suggestionPanel.classList.remove('hidden');
  actions.classList.remove('hidden');
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
