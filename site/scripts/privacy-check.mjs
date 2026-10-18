#!/usr/bin/env node
// Look for the forbidden strings (scripts/forbidden.mjs) in the repository's files.
//
//   node scripts/privacy-check.mjs              # every tracked file
//   node scripts/privacy-check.mjs <path>...    # only these files or directories
//
// Hits are reported as "file:line: forbidden string #n", never the string itself, so the output
// can go into a PR comment or a CI log of this public repository. Exits 1 when anything is found.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { FORBIDDEN } from './forbidden.mjs';

const listFiles = (paths) =>
  execFileSync('git', ['ls-files', '-z', '--', ...paths], { encoding: 'utf8' }).split('\0').filter(Boolean);

let hits = 0;
for (const file of listFiles(process.argv.slice(2))) {
  let text;
  try {
    if (!statSync(file).isFile()) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // binary
  text.split('\n').forEach((line, i) => {
    FORBIDDEN.forEach((word, n) => {
      if (line.includes(word)) {
        console.log(`${file}:${i + 1}: forbidden string #${n + 1}`);
        hits++;
      }
    });
  });
}
if (hits) {
  console.log(`${hits} hit(s).`);
  process.exit(1);
}
console.log('No forbidden strings.');
