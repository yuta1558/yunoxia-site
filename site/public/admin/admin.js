// yunoxia CMS admin. Same-origin only; the token lives in sessionStorage so it ends with the tab.

(() => {
  'use strict';

  const TOKEN_KEY = 'yunoxia_admin_token';
  const $ = (id) => document.getElementById(id);

  // Same theme as the site: the stored choice, then the system setting
  try {
    const stored = localStorage.getItem('theme');
    const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {}

  let posts = [];
  let filter = 'all';
  let currentId = null;
  let fileTarget = 'content'; // where an uploaded image goes: 'content' or 'featured'
  let dirty = false; // the editor has changes that are not saved yet
  let body = null; // the body editor (editor.js), or the plain textarea if it did not load

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
      // The API caps a page at 50 posts, so walk every page
      posts = [];
      for (let page = 1; ; page++) {
        const res = await api(`/posts?status=all&limit=50&page=${page}`);
        posts.push(...res.posts);
        if (!res.pagination || !res.pagination.hasNext) break;
      }
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
    body.setValue(post.content);
    $('delete').hidden = !id;
    setFeatured(post.featured_image);
    dirty = false;
    show('editor');
    showTab('write');
  }

  // Leaving the editor with unsaved changes asks first
  const confirmLeave = () => !dirty || confirm('保存していない変更があります。破棄して戻りますか？');

  function collect() {
    return {
      title: $('title').value,
      slug: $('slug').value.trim(),
      excerpt: $('excerpt').value,
      tags: $('tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      status: $('status').value,
      content: body.getValue(),
      featured_image: $('featured').value,
    };
  }

  async function save() {
    if (!$('view-editor').reportValidity()) return;
    if (!body.getValue().trim()) {
      $('save-status').textContent = '本文が空です。';
      body.focus();
      return;
    }
    $('save-status').textContent = '保存中…';
    try {
      const data = collect();
      const result = currentId
        ? await api('/posts', { method: 'PUT', body: { id: currentId, ...data } })
        : await api('/posts', { method: 'POST', body: data });
      currentId = result.id;
      $('slug').value = result.slug;
      $('delete').hidden = false;
      dirty = false;
      const status = $('save-status');
      if (result.status === 'published') {
        const link = document.createElement('a');
        link.href = `/log/p/${result.slug}/`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = link.getAttribute('href');
        status.replaceChildren('保存しました。公開URL：', link);
      } else {
        status.textContent = '下書きを保存しました。';
      }
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
      $('preview').innerHTML = (await api('/preview', { method: 'POST', body: { content: body.getValue() } })).html;
    } catch (e) {
      $('preview').textContent = `プレビューに失敗しました：${e.message}`;
    }
  }

  // Photos are shrunk to MAX_SIDE on the long side and re-encoded before upload. Re-encoding also
  // drops EXIF, so a phone photo's GPS position never reaches the site. GIF (may be animated) and
  // AVIF (no canvas encoder) go up as they are.
  const MAX_SIDE = 2000;

  const encode = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return file;
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // WebP where the browser can encode it; otherwise keep JPEG for photos and PNG for the rest
    let blob = await encode(canvas, 'image/webp', 0.85);
    if (!blob || blob.type !== 'image/webp') {
      blob = file.type === 'image/jpeg' ? await encode(canvas, 'image/jpeg', 0.85) : await encode(canvas, 'image/png');
    }
    if (!blob) return file;
    const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[blob.type];
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type });
  }

  async function upload(original) {
    const file = await shrink(original);
    const form = new FormData();
    form.append('file', file);
    const { url } = await api('/upload', { method: 'POST', form });
    return url;
  }

  // The live-preview editor when editor.js loaded, else the textarea with the same interface
  function mountBody() {
    const area = $('content');
    if (window.YxEditor) {
      area.hidden = true;
      return window.YxEditor.mount($('editor-host'), {
        onChange: () => {
          dirty = true;
        },
        upload,
        onStatus: (text) => {
          $('save-status').textContent = text;
        },
      });
    }
    document.querySelectorAll('.format [data-cmd], .format .sep').forEach((b) => (b.hidden = true));
    area.addEventListener('input', () => (dirty = true));
    return {
      getValue: () => area.value,
      setValue: (value) => (area.value = value),
      insert(text) {
        const { selectionStart: s, selectionEnd: e, value } = area;
        area.value = value.slice(0, s) + text + value.slice(e);
        area.selectionStart = area.selectionEnd = s + text.length;
        area.focus();
        dirty = true;
      },
      focus: () => area.focus(),
      command: () => false,
    };
  }

  function showTab(name) {
    const preview = name === 'preview';
    $('tab-write').setAttribute('aria-selected', String(!preview));
    $('tab-preview').setAttribute('aria-selected', String(preview));
    $('pane-write').hidden = preview;
    $('pane-preview').hidden = !preview;
    document.querySelector('.format').classList.toggle('off', preview);
    if (preview) refreshPreview();
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
    $('back').addEventListener('click', () => {
      if (confirmLeave()) loadList();
    });

    body = mountBody();

    // Track unsaved changes in the fields (the body editor reports its own)
    $('view-editor').addEventListener('input', () => {
      dirty = true;
    });

    // Toolbar: keep the editor's selection on click, and write into the editor even from the preview tab
    document.querySelectorAll('.format button').forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
    });
    document.querySelectorAll('[data-cmd]').forEach((button) => {
      button.addEventListener('click', () => {
        showTab('write');
        body.command(button.dataset.cmd);
      });
    });
    $('tab-write').addEventListener('click', () => {
      showTab('write');
      body.focus();
    });
    $('tab-preview').addEventListener('click', () => showTab('preview'));
    addEventListener('beforeunload', (event) => {
      if (dirty && !$('view-editor').hidden) event.preventDefault();
    });
    $('delete').addEventListener('click', remove);
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
      showTab('write');
      fileTarget = 'content';
      $('file').click();
    });
    $('featured-upload').addEventListener('click', () => {
      fileTarget = 'featured';
      $('file').click();
    });
    $('featured-remove').addEventListener('click', () => {
      setFeatured('');
      dirty = true;
    });

    $('file').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      $('save-status').textContent = 'アップロード中…';
      try {
        const url = await upload(file);
        if (fileTarget === 'featured') setFeatured(url);
        else body.insert(`![](${url})\n`);
        dirty = true;
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
