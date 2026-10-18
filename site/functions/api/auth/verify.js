// GET /api/auth/verify — the middleware already rejected bad tokens, so reaching here means valid.

import { json } from '../../_lib/http.js';

export function onRequestGet({ data }) {
  return json({ valid: true, user: data.user.sub, exp: data.user.exp });
}
