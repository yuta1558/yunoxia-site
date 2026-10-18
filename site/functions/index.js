// GET / — the top page with the newest CMS posts at the head of its Log list (three rows in all).

import { withCmsPosts } from './_lib/logs.js';

export const onRequestGet = (context) => withCmsPosts(context, { selector: 'ul.logs', max: 3 });
