// yunoxia CMS admin. Same-origin only; the token lives in sessionStorage so it ends with the tab.

(() => {
  'use strict';

  const TOKEN_KEY = 'yunoxia_admin_token';
  const $ = (id) => document.getElementById(id);

  let posts = [];
  let filter = 'all';
  let currentId = null;
  let fileTarget = 'content'; // where an uploaded image goes: 'content' or 'featured'

  // ---- API ----------------------------------------------------------------

  const token = {
    get: () => sessionStorage.getItem(TOKEN_KEY),
    set: (value) => sessionStorage.setItem(TOKEN_KEY, value),
    clear: () => sessionStorage.removeItem(TOKEN_KEY),
  };

  async function api(path, { method = 'GET', body, form } = {}) {
    const headers = {};
    const t = token.get();
    if (t) headers.Authorization = `Bearer ${t}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && path !== '/auth/login') {
      token.clear();
      show('login');
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ---- Views --------------------------------------------------------------

  function show(view) {
    $('login').hidden = view !== 'login';
    $('app').hidden = view === 'login';
    $('view-list').hidden = view !== 'list';
    $('view-editor').hidden = view !== 'editor';
  }

  function formatDate(iso) {
    return iso ? iso.slice(0, 10).replaceAll('-', '.') : '';
  }

  function renderList() {
    const list = $('posts');
    list.replaceChildren();
    const visible = posts.filter((p) => filter === 'all' || p.status === filter);
    $('list-status').textContent = visible.length ? '' : '記事はありません。';

    for (const post of visible) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';

      const left = document.createElement('span');
      const title = document.createElement('span');
      title.textContent = post.title;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = ` ${formatDate(post.published_at || post.updated_at)}${post.tags.length ? ` · ${post.tags.join(', ')}` : ''}`;
      left.append(title, meta);

      const state = document.createElement('span');
      state.className = `state ${post.status === 'published' ? 'published' : 'draft'}`;
      state.textContent = post.status === 'published' ? '公開' : '下書き';

      button.append(left, state);
      button.addEventListener('click', () => openEditor(post.id));
      li.append(button);
      list.append(li);
    }
  }

  async function loadList() {
    show('list');
    $('list-status').textContent = '読み込み中…';
    try {
      posts = (await api('/posts?status=all&limit=50')).posts;
      renderList();
    } catch (e) {
      $('list-status').textContent = `読み込みに失敗しました（${e.message}）`;
    }
  }

  // ---- Editor -------------------------------------------------------------

  function setFeatured(url) {
    $('featured').value = url || '';
    $('featured-preview').hidden = !url;
    $('featured-remove').hidden = !url;
    if (url) $('featured-preview').src = url;
    else $('featured-preview').removeAttribute('src');
  }

  async function openEditor(id = null) {
    currentId = id;
    $('save-status').textContent = '';
    let post = { title: '', slug: '', excerpt: '', tags: [], status: 'draft', content: '', featured_image: '' };
    if (id) {
      try {
        post = (await api(`/posts?status=all&id=${encodeURIComponent(id)}`)).post;
      } catch (e) {
        alert(`記事を開けませんでした：${e.message}`);
        return;
      }
    }
    $('title').value = post.title;
    $('slug').value = post.slug;
    $('excerpt').value = post.excerpt;
    $('tags').value = post.tags.join(', ');
    $('status').value = post.status;
    $('content').value = post.content;
    $('delete').hidden = !id;
    setFeatured(post.featured_image);
    show('editor');
    refreshPreview();
  }

  function collect() {
    return {
      title: $('title').value,
      slug: $('slug').value.trim(),
      excerpt: $('excerpt').value,
      tags: $('tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      status: $('status').value,
      content: $('content').value,
      featured_image: $('featured').value,
    };
  }

  async function save() {
    if (!$('view-editor').reportValidity()) return;
    $('save-status').textContent = '保存中…';
    try {
      const data = collect();
      const result = currentId
        ? await api('/posts', { method: 'PUT', body: { id: currentId, ...data } })
        : await api('/posts', { method: 'POST', body: data });
      currentId = result.id;
      $('slug').value = result.slug;
      $('delete').hidden = false;
      const url = `/log/p/${result.slug}/`;
      $('save-status').textContent = result.status === 'published' ? `保存しました。公開URL：${url}` : '下書きを保存しました。';
    } catch (e) {
      $('save-status').textContent = `保存に失敗しました：${e.message}`;
    }
  }

  async function remove() {
    if (!currentId || !confirm('この記事を削除します。元に戻せません。よろしいですか？')) return;
    try {
      await api(`/posts?id=${encodeURIComponent(currentId)}`, { method: 'DELETE' });
      loadList();
    } catch (e) {
      $('save-status').textContent = `削除に失敗しました：${e.message}`;
    }
  }

  async function refreshPreview() {
    try {
      // The server renderer escapes all input and allow-lists URLs, so its output is safe to insert.
      $('preview').innerHTML = (await api('/preview', { method: 'POST', body: { content: $('content').value } })).html;
    } catch (e) {
      $('preview').textContent = `プレビューに失敗しました：${e.message}`;
    }
  }

  async function upload(file) {
    const form = new FormData();
    form.append('file', file);
    const { url } = await api('/upload', { method: 'POST', form });
    return url;
  }

  function insertAtCursor(text) {
    const area = $('content');
    const { selectionStart: s, selectionEnd: e, value } = area;
    area.value = value.slice(0, s) + text + value.slice(e);
    area.selectionStart = area.selectionEnd = s + text.length;
    area.focus();
  }

  // ---- Wiring -------------------------------------------------------------

  function init() {
    $('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formEl = event.currentTarget;
      const form = new FormData(formEl);
      $('login-error').hidden = true;
      try {
        const { token: t } = await api('/auth/login', {
          method: 'POST',
          body: { username: form.get('username'), password: form.get('password') },
        });
        token.set(t);
        formEl.reset();
        loadList();
      } catch (e) {
        $('login-error').textContent = e.message === 'Invalid credentials' ? 'ユーザー名かパスワードが違います。' : e.message;
        $('login-error').hidden = false;
      }
    });

    $('logout').addEventListener('click', () => {
      token.clear();
      show('login');
    });

    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        renderList();
      });
    });

    $('new-post').addEventListener('click', () => openEditor());
    $('back').addEventListener('click', loadList);
    $('delete').addEventListener('click', remove);
    $('refresh-preview').addEventListener('click', refreshPreview);
    $('view-editor').addEventListener('submit', (event) => {
      event.preventDefault();
      save();
    });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's' && !$('view-editor').hidden) {
        event.preventDefault();
        save();
      }
    });

    $('insert-image').addEventListener('click', () => {
      fileTarget = 'content';
      $('file').click();
    });
    $('featured-upload').addEventListener('click', () => {
      fileTarget = 'featured';
      $('file').click();
    });
    $('featured-remove').addEventListener('click', () => setFeatured(''));

    $('file').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      $('save-status').textContent = 'アップロード中…';
      try {
        const url = await upload(file);
        if (fileTarget === 'featured') setFeatured(url);
        else insertAtCursor(`![](${url})`);
        $('save-status').textContent = 'アップロードしました。';
      } catch (e) {
        $('save-status').textContent = `アップロードに失敗しました：${e.message}`;
      }
    });

    if (!token.get()) {
      show('login');
      return;
    }
    api('/auth/verify').then(loadList, () => show('login'));
  }

  init();
})();
