// Admin Panel - yunoxia.one Blog CMS
// Handles authentication, post management, and editor functionality

(function () {
  'use strict';

  const API_BASE = '/api';
  const TOKEN_KEY = 'yunoxia_admin_token';

  let editor = null; // EasyMDE instance
  let currentPostId = null;

  // ===== API Helpers =====
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function apiRequest(path, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      removeToken();
      showLogin();
      throw new Error('Unauthorized');
    }

    return res;
  }

  // ===== UI State =====
  function showLogin() {
    document.getElementById('login-screen').hidden = false;
    document.getElementById('admin-dashboard').hidden = true;
  }

  function showDashboard() {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('admin-dashboard').hidden = false;
  }

  function showView(viewId) {
    document.querySelectorAll('.admin-view').forEach((v) => (v.hidden = true));
    document.getElementById(viewId).hidden = false;
  }

  function showStatus(message, duration = 3000) {
    const el = document.getElementById('save-status');
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => (el.hidden = true), duration);
  }

  // ===== Authentication =====
  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'ログインに失敗しました';
        errorEl.hidden = false;
        return;
      }

      setToken(data.token);
      showDashboard();
      loadPosts();
    } catch (err) {
      errorEl.textContent = 'サーバーに接続できません';
      errorEl.hidden = false;
    }
  }

  function handleLogout() {
    removeToken();
    showLogin();
  }

  // ===== Posts List =====
  let currentFilter = 'all';

  async function loadPosts() {
    const listEl = document.getElementById('posts-list');
    listEl.innerHTML = '<p class="admin-loading">読み込み中...</p>';

    try {
      const res = await apiRequest('/posts?status=all&limit=50');
      const data = await res.json();

      if (!data.posts || data.posts.length === 0) {
        listEl.innerHTML =
          '<p class="admin-loading">記事がありません。新規作成してください。</p>';
        return;
      }

      renderPostsList(data.posts);
    } catch (err) {
      listEl.innerHTML =
        '<p class="admin-loading">記事の読み込みに失敗しました。</p>';
    }
  }

  function renderPostsList(posts) {
    const listEl = document.getElementById('posts-list');
    const filtered =
      currentFilter === 'all'
        ? posts
        : posts.filter((p) => p.status === currentFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="admin-loading">${
        currentFilter === 'all' ? '記事がありません。' : `${currentFilter === 'published' ? '公開' : '下書き'}の記事はありません。`
      }</p>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach((post) => {
      const tags = typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags || [];
      const date = post.published_at || post.created_at;
      const formattedDate = date ? new Date(date).toLocaleDateString('ja-JP') : '';

      const item = document.createElement('div');
      item.className = 'admin-post-item';
      item.innerHTML = `
        <div>
          <div class="admin-post-title">${escapeHtml(post.title)}</div>
          <div class="admin-post-meta">
            <span>${formattedDate}</span>
            ${tags.length > 0 ? `<span>${tags.join(', ')}</span>` : ''}
          </div>
        </div>
        <span class="admin-post-status ${post.status}">${
          post.status === 'published' ? '公開' : '下書き'
        }</span>
      `;
      item.addEventListener('click', () => openEditor(post));
      listEl.appendChild(item);
    });

    // Store posts for filter
    listEl.dataset.posts = JSON.stringify(posts);
  }

  function handleFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.admin-filter').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const listEl = document.getElementById('posts-list');
    const posts = JSON.parse(listEl.dataset.posts || '[]');
    renderPostsList(posts);
  }

  // ===== Editor =====
  function initEditor() {
    if (editor) return;

    const textarea = document.getElementById('post-content');
    editor = new EasyMDE({
      element: textarea,
      autofocus: false,
      spellChecker: false,
      status: ['lines', 'words', 'cursor'],
      toolbar: [
        'bold', 'italic', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'code', '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide',
        {
          name: 'upload-image',
          action: () => document.getElementById('featured-image-input').click(),
          className: 'fa fa-upload',
          title: '画像をアップロード',
        },
      ],
      previewRender: (text) => {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
          return DOMPurify.sanitize(marked.parse(text));
        }
        return text;
      },
    });
  }

  function openEditor(post = null) {
    showView('view-editor');
    initEditor();

    const deleteBtn = document.getElementById('delete-post-btn');

    if (post) {
      // Editing existing post
      currentPostId = post.id;
      document.getElementById('post-title').value = post.title || '';
      document.getElementById('post-slug').value = post.slug || '';
      document.getElementById('post-excerpt').value = post.excerpt || '';
      const tags = typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags || [];
      document.getElementById('post-tags').value = tags.join(', ');
      document.getElementById('post-status').value = post.status || 'draft';
      editor.value(post.content || '');
      deleteBtn.hidden = false;

      // Featured image
      if (post.featured_image) {
        showFeaturedImage(post.featured_image);
      } else {
        hideFeaturedImage();
      }
    } else {
      // New post
      currentPostId = null;
      document.getElementById('post-title').value = '';
      document.getElementById('post-slug').value = '';
      document.getElementById('post-excerpt').value = '';
      document.getElementById('post-tags').value = '';
      document.getElementById('post-status').value = 'draft';
      editor.value('');
      deleteBtn.hidden = true;
      hideFeaturedImage();
    }
  }

  function showFeaturedImage(url) {
    const preview = document.getElementById('featured-image-preview');
    const img = document.getElementById('featured-image-img');
    img.src = url;
    preview.hidden = false;
  }

  function hideFeaturedImage() {
    const preview = document.getElementById('featured-image-preview');
    const img = document.getElementById('featured-image-img');
    img.src = '';
    preview.hidden = true;
  }

  // ===== Save / Delete =====
  async function savePost() {
    const title = document.getElementById('post-title').value.trim();
    const content = editor.value().trim();

    if (!title) {
      showStatus('タイトルを入力してください', 3000);
      return;
    }
    if (!content) {
      showStatus('本文を入力してください', 3000);
      return;
    }

    const slug = document.getElementById('post-slug').value.trim();
    const excerpt = document.getElementById('post-excerpt').value.trim();
    const tagsStr = document.getElementById('post-tags').value.trim();
    const tags = tagsStr
      ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const status = document.getElementById('post-status').value;
    const featuredImg = document.getElementById('featured-image-img').src;
    const featured_image = featuredImg && !featuredImg.endsWith('/') ? featuredImg : '';

    const body = {
      title,
      content,
      slug: slug || undefined,
      excerpt,
      tags,
      status,
      featured_image,
    };

    try {
      let res;
      if (currentPostId) {
        body.id = currentPostId;
        res = await apiRequest('/posts', {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        res = await apiRequest('/posts', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        showStatus(`エラー: ${data.error}`, 5000);
        return;
      }

      if (!currentPostId) {
        currentPostId = data.id;
        document.getElementById('delete-post-btn').hidden = false;
      }

      if (data.slug) {
        document.getElementById('post-slug').value = data.slug;
      }

      showStatus('保存しました', 2000);
    } catch (err) {
      showStatus('保存に失敗しました', 5000);
    }
  }

  async function deletePost() {
    if (!currentPostId) return;

    const confirmed = confirm('この記事を削除しますか？この操作は取り消せません。');
    if (!confirmed) return;

    try {
      const res = await apiRequest(`/posts?id=${currentPostId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        showStatus(`エラー: ${data.error}`, 5000);
        return;
      }

      currentPostId = null;
      showView('view-list');
      loadPosts();
      showStatus('記事を削除しました', 2000);
    } catch (err) {
      showStatus('削除に失敗しました', 5000);
    }
  }

  // ===== Slug Generation =====
  function generateSlug() {
    const title = document.getElementById('post-title').value.trim();
    if (!title) return;

    const slug = title
      .toLowerCase()
      .replace(/[^\w\s\u3000-\u9fff\uff00-\uffef-]/g, '')
      .replace(/[\s\u3000]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || `post-${Date.now()}`;

    document.getElementById('post-slug').value = slug;
  }

  // ===== Image Upload =====
  async function handleImageUpload(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        showStatus(`アップロードエラー: ${data.error}`, 5000);
        return null;
      }

      showStatus('画像をアップロードしました', 2000);
      return data.url;
    } catch (err) {
      showStatus('画像のアップロードに失敗しました', 5000);
      return null;
    }
  }

  // ===== Theme Toggle =====
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☽' : '☀';
  }

  // ===== Utilities =====
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Keyboard Shortcuts =====
  function handleKeyboard(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!document.getElementById('view-editor').hidden) {
        savePost();
      }
    }
  }

  // ===== Init =====
  function init() {
    // Check token
    const token = getToken();
    if (token) {
      showDashboard();
      loadPosts();
    } else {
      showLogin();
    }

    // Theme icon
    const theme = document.documentElement.getAttribute('data-theme');
    document.getElementById('theme-icon').textContent = theme === 'dark' ? '☽' : '☀';

    // Event listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('new-post-btn').addEventListener('click', () => openEditor());
    document.getElementById('back-to-list').addEventListener('click', () => {
      showView('view-list');
      loadPosts();
    });
    document.getElementById('save-post-btn').addEventListener('click', savePost);
    document.getElementById('delete-post-btn').addEventListener('click', deletePost);
    document.getElementById('generate-slug-btn').addEventListener('click', generateSlug);
    document.getElementById('theme-toggle-admin').addEventListener('click', toggleTheme);

    // Filter buttons
    document.querySelectorAll('.admin-filter').forEach((btn) => {
      btn.addEventListener('click', () => handleFilter(btn.dataset.filter));
    });

    // Image upload
    const imageInput = document.getElementById('featured-image-input');
    document.getElementById('upload-image-btn').addEventListener('click', () => {
      imageInput.click();
    });
    imageInput.addEventListener('change', async () => {
      const file = imageInput.files[0];
      if (file) {
        const url = await handleImageUpload(file);
        if (url) showFeaturedImage(url);
      }
    });
    document.getElementById('remove-image-btn').addEventListener('click', hideFeaturedImage);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
