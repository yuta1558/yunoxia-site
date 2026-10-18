// GET /en/ — the English top page; Log posts are Japanese, so their links carry hreflang="ja".

import { withCmsPosts } from '../_lib/logs.js';

export const onRequestGet = (context) => withCmsPosts(context, { selector: 'ul.logs', max: 3, hreflang: 'ja' });
