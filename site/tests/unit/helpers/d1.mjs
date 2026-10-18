// A D1 stand-in on node:sqlite, so tests run the real SQL (upserts, RETURNING) in memory.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../../../migrations/', import.meta.url)).sort()) {
    db.exec(readFileSync(new URL(`../../../migrations/${f}`, import.meta.url), 'utf8'));
  }
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind: (...p) => statement(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
  });
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    // D1 runs a batch as one transaction
    batch: async (stmts) => {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => ({ results: db.prepare(s.sql).all(...s.params) }));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
