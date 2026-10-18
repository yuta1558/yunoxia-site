// GET /log/ — the static Log list with published CMS posts prepended.
// Assumes CMS posts are newer than the Markdown entries in src/content/log (the Markdown
// log is the archive from before the CMS). Falls back to the static page on any problem.

import { withCmsPosts } from '../_lib/logs.js';

export const onRequestGet = (context) => withCmsPosts(context, { selector: 'ol.logs' });
