// Blog CMS - Frontend Logic
// Handles blog list rendering, single post display, pagination, and tag filtering

(function () {
  'use strict';

  const API_BASE = '/api/posts';
  const POSTS_PER_PAGE = 10;

  // Detect which page we're on
  function getCurrentPage() {
    const path = location.pathname;
    if (path.includes('blog-post')) return 'post';
    if (path.includes('blog')) return 'list';
    return null;
  }

  // Format date string
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  // Render markdown to sanitized HTML
  function renderMarkdown(md) {
    if (typeof marked === 'undefined') return md;

    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return code;
      },
    });

    const rawHtml = marked.parse(md);

    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['target', 'rel', 'loading'],
      });
    }
    return rawHtml;
  }

  // Create tag element
  function createTag(tag, isActive, onClick) {
    const span = document.createElement('span');
    span.className = 'blog-tag' + (isActive ? ' active' : '');
    span.textContent = tag;
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', '0');
    if (onClick) {
      span.addEventListener('click', onClick);
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      });
    }
    return span;
  }

  // Fetch posts from API
  async function fetchPosts(params = {}) {
    const url = new URL(API_BASE, location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  // ===== Blog List Page =====
  async function initBlogList() {
    const listEl = document.getElementById('blog-list');
    const tagsEl = document.getElementById('blog-tags');
    const paginationEl = document.getElementById('blog-pagination');

    if (!listEl) return;

    const urlParams = new URLSearchParams(location.search);
    const currentPage = parseInt(urlParams.get('page') || '1', 10);
    const currentTag = urlParams.get('tag') || null;

    try {
      const data = await fetchPosts({
        page: currentPage,
        limit: POSTS_PER_PAGE,
        tag: currentTag,
      });

      // Render tag filter
      if (tagsEl && data.posts.length > 0) {
        const allTags = new Set();
        data.posts.forEach((post) => {
          (post.tags || []).forEach((tag) => allTags.add(tag));
        });

        if (allTags.size > 0) {
          // "All" button
          const allBtn = createTag('All', !currentTag, () => {
            const url = new URL(location.href);
            url.searchParams.delete('tag');
            url.searchParams.set('page', '1');
            navigateBlog(url.pathname + url.search);
          });
          tagsEl.appendChild(allBtn);

          allTags.forEach((tag) => {
            const tagEl = createTag(tag, currentTag === tag, () => {
              const url = new URL(location.href);
              url.searchParams.set('tag', tag);
              url.searchParams.set('page', '1');
              navigateBlog(url.pathname + url.search);
            });
            tagsEl.appendChild(tagEl);
          });
        }
      }

      // Render post list
      if (data.posts.length === 0) {
        listEl.innerHTML = `
          <div class="blog-empty fade-in">
            <p style="color: var(--muted); font-size: 0.875rem; text-align: center; padding: 3rem 0;">
              ${currentTag ? `「${currentTag}」タグの記事はまだありません。` : 'まだ記事がありません。'}
            </p>
          </div>`;
        return;
      }

      listEl.innerHTML = '';
      data.posts.forEach((post, i) => {
        const direction = i % 2 === 0 ? 'fade-in-left' : 'fade-in-right';
        const isLast = i === data.posts.length - 1;
        const article = document.createElement('article');
        article.className = `blog-entry ${direction}`;
        article.style.cssText = `padding: 1.75rem 0;${isLast ? '' : ' border-bottom: 1px solid var(--border);'}`;

        article.innerHTML = `
          <time style="color: var(--muted); font-size: 0.75rem; letter-spacing: 0.1em; font-weight: 300;"
                datetime="${post.published_at || post.created_at}">
            ${formatDate(post.published_at || post.created_at)}
          </time>
          <h3 style="margin: 0.5rem 0 0.75rem; font-size: 1.0625rem; font-weight: 500; letter-spacing: -0.01em;">
            <a href="blog-post.html?slug=${encodeURIComponent(post.slug)}"
               style="color: inherit; text-decoration: none;">
              ${escapeHtml(post.title)}
            </a>
          </h3>
          ${post.excerpt ? `<p style="color: var(--muted); line-height: 1.9; font-size: 0.875rem; font-weight: 300;">${escapeHtml(post.excerpt)}</p>` : ''}
          ${(post.tags && post.tags.length > 0) ? `
            <div style="margin-top: 0.75rem; display: flex; gap: 0.375rem; flex-wrap: wrap;">
              ${post.tags.map((t) => `<span class="blog-tag-inline">${escapeHtml(t)}</span>`).join('')}
            </div>` : ''}
        `;

        listEl.appendChild(article);
      });

      // Render pagination
      if (paginationEl && data.pagination.totalPages > 1) {
        renderPagination(paginationEl, data.pagination, currentTag);
      }

      // Re-initialize observers for fade-in
      if (typeof window.BlogReinit === 'function') {
        window.BlogReinit();
      }
    } catch (err) {
      listEl.innerHTML = `
        <div class="blog-error fade-in">
          <p style="color: var(--muted); font-size: 0.875rem; text-align: center; padding: 3rem 0;">
            記事の読み込みに失敗しました。<br>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent); color: var(--secondary); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.8125rem;">
              再読み込み
            </button>
          </p>
        </div>`;
    }
  }

  // Render pagination controls
  function renderPagination(container, pagination, currentTag) {
    container.innerHTML = '';
    const { page, totalPages, hasPrev, hasNext } = pagination;

    function pageUrl(p) {
      const url = new URL(location.href);
      url.searchParams.set('page', p);
      if (currentTag) url.searchParams.set('tag', currentTag);
      return url.pathname + url.search;
    }

    if (hasPrev) {
      const prev = document.createElement('a');
      prev.href = pageUrl(page - 1);
      prev.className = 'blog-page-link';
      prev.textContent = '← 前へ';
      prev.addEventListener('click', (e) => {
        e.preventDefault();
        navigateBlog(pageUrl(page - 1));
      });
      container.appendChild(prev);
    }

    const info = document.createElement('span');
    info.className = 'blog-page-info';
    info.textContent = `${page} / ${totalPages}`;
    container.appendChild(info);

    if (hasNext) {
      const next = document.createElement('a');
      next.href = pageUrl(page + 1);
      next.className = 'blog-page-link';
      next.textContent = '次へ →';
      next.addEventListener('click', (e) => {
        e.preventDefault();
        navigateBlog(pageUrl(page + 1));
      });
      container.appendChild(next);
    }
  }

  // ===== Single Post Page =====
  async function initBlogPost() {
    const postEl = document.getElementById('blog-post');
    if (!postEl) return;

    const urlParams = new URLSearchParams(location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
      postEl.innerHTML = `
        <div class="blog-error">
          <p style="color: var(--muted);">記事が指定されていません。</p>
          <a href="blog.html" style="color: var(--accent);">Blog一覧に戻る</a>
        </div>`;
      return;
    }

    try {
      const data = await fetchPosts({ slug });
      const post = data.post;

      if (!post) {
        postEl.innerHTML = `
          <div class="blog-error">
            <p style="color: var(--muted);">記事が見つかりません。</p>
            <a href="blog.html" style="color: var(--accent);">Blog一覧に戻る</a>
          </div>`;
        return;
      }

      // Update page title and meta tags
      document.title = `${post.title} - yunoxia.one`;
      updateMeta('description', post.excerpt || post.title);
      updateMeta('og:title', `${post.title} - yunoxia.one`);
      updateMeta('og:description', post.excerpt || post.title);
      updateMeta('twitter:title', `${post.title} - yunoxia.one`);
      updateMeta('twitter:description', post.excerpt || post.title);
      if (post.featured_image) {
        updateMeta('og:image', post.featured_image);
        updateMeta('twitter:image', post.featured_image);
      }

      // Render post
      const contentHtml = renderMarkdown(post.content);

      postEl.innerHTML = `
        <header class="blog-post-header">
          <time style="color: var(--muted); font-size: 0.75rem; letter-spacing: 0.1em; font-weight: 300;"
                datetime="${post.published_at || post.created_at}">
            ${formatDate(post.published_at || post.created_at)}
          </time>
          <h2 class="text-gradient" style="margin: 0.75rem 0 1rem; font-size: 1.5rem;">
            ${escapeHtml(post.title)}
          </h2>
          ${(post.tags && post.tags.length > 0) ? `
            <div style="display: flex; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 2rem;">
              ${post.tags.map((t) => `<span class="blog-tag-inline">${escapeHtml(t)}</span>`).join('')}
            </div>` : ''}
        </header>
        <div class="blog-post-content prose">
          ${contentHtml}
        </div>
        <footer class="blog-post-footer" style="margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
          <div class="blog-share" style="display: flex; gap: 0.75rem; align-items: center;">
            <span style="color: var(--muted); font-size: 0.8125rem;">共有:</span>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(location.href)}"
               target="_blank" rel="noopener noreferrer"
               style="color: var(--muted); font-size: 0.8125rem; text-decoration: none;">
              Twitter
            </a>
          </div>
        </footer>
      `;

      // Highlight code blocks
      if (typeof hljs !== 'undefined') {
        postEl.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }

      // Re-initialize observers
      if (typeof window.BlogReinit === 'function') {
        window.BlogReinit();
      }
    } catch (err) {
      postEl.innerHTML = `
        <div class="blog-error">
          <p style="color: var(--muted);">記事の読み込みに失敗しました。</p>
          <a href="blog.html" style="color: var(--accent);">Blog一覧に戻る</a>
        </div>`;
    }
  }

  // Navigate without full page reload (works with PJAX)
  function navigateBlog(url) {
    if (typeof window.PJAX !== 'undefined' && window.PJAX.loadContent) {
      window.PJAX.loadContent(url, true);
    } else {
      history.pushState(null, '', url);
      init();
    }
  }

  // Update meta tag content
  function updateMeta(name, content) {
    let el = document.querySelector(`meta[property="${name}"]`) ||
             document.querySelector(`meta[name="${name}"]`);
    if (el) el.setAttribute('content', content);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialize based on current page
  function init() {
    const page = getCurrentPage();
    if (page === 'list') initBlogList();
    else if (page === 'post') initBlogPost();
  }

  // Expose reinit for PJAX
  window.BlogInit = init;

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
