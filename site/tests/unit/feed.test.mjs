// node --test tests/unit — description fallback and RSS items for CMS posts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postDescription, rssItems } from '../../functions/_lib/feed.js';
import { listPublished } from '../../functions/_lib/posts.js';
import { onRequestGet } from '../../functions/rss.xml.js';
import { createD1 } from './helpers/d1.mjs';

const post = (o) => ({ slug: 's', title: 'T', excerpt: '', content: '## h\n\nFirst **para** here.\n\nSecond.', published_at: '2026-10-18T01:00:00Z', ...o });

test('an empty excerpt falls back to the first paragraph, as on the static pages', () => {
  assert.equal(postDescription(post({})), 'First para here.');
  assert.equal(postDescription(post({ excerpt: 'Written' })), 'Written');
  assert.equal(postDescription(post({ content: '## only a heading' })), '');
});

test('rss items use the fallback description and skip an invalid published_at', () => {
  const xml = rssItems([post({}), post({ slug: 'bad', published_at: null }), post({ slug: 'bad2', published_at: 'x' })], 'https://yunoxia.one');
  assert.match(xml, /<description>First para here\.<\/description>/);
  assert.match(xml, /\/log\/p\/s\//);
  assert.doesNotMatch(xml, /bad|Invalid Date/);
});

test('the rss Function reads bodies from D1 and survives a bad date row', async () => {
  const DB = createD1();
  const insert = (slug, at) =>
    DB.raw.prepare("INSERT INTO posts (id, slug, title, content, excerpt, tags, status, created_at, updated_at, published_at) VALUES (?, ?, 'T', 'Body text.', '', '[]', 'published', ?, ?, ?)").run(slug, slug, at, at, at);
  insert('good', '2026-10-18T01:00:00Z');
  insert('bad', 'not a date');
  const feed = new Response('<rss><channel><item>old</item></channel></rss>', { status: 200 });
  const res = await onRequestGet({
    request: new Request('https://yunoxia.one/rss.xml'),
    env: { DB },
    next: async () => feed,
  });
  const text = await res.text();
  assert.match(text, /<description>Body text\.<\/description>/);
  assert.doesNotMatch(text, /Invalid Date|\/log\/p\/bad\//);
});

test('listPublished with content reads only the start of each body', async () => {
  const DB = createD1();
  DB.raw.prepare("INSERT INTO posts (id, slug, title, content, excerpt, tags, status, created_at, updated_at, published_at) VALUES ('l', 'l', 'T', ?, '', '[]', 'published', '2026-10-18T01:00:00Z', '2026-10-18T01:00:00Z', '2026-10-18T01:00:00Z')").run('First paragraph.\n\n' + 'x'.repeat(10000));
  const [post] = await listPublished(DB, 20, { withContent: true });
  assert.equal(post.content.length, 4000);
  assert.equal(postDescription(post), 'First paragraph.');
});
