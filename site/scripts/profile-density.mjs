// Bin the public filament profiles into a nozzle-temperature x max-volumetric-flow density grid
// for the Research page. Input: the analysis CSV (not committed). Output: a small JSON of counts.
//
// Data (2026-10-18): one row per filament profile, inheritance resolved, abstract profiles
// (instantiation=false, *common*) dropped. Sources: the OrcaSlicer repository at the commit of that
// date (source "orca", 7,373 rows) and the official Prusa bundle 2.5.12, all printers ("prusa-2.5.12",
// 7,155 rows). Not the 7,000+ four-source corpus the Research text describes; src/research/README.md
// has the full definition.
//
//   node scripts/profile-density.mjs <profiles.csv> > src/research/data/profile-density.json
//
// Only columns that exist in the CSV are used (source, nozzle_temp, mvs). Nothing is derived beyond
// counting, so the figure shows the data as it is, not an analysis result.

import { readFileSync } from 'node:fs';

// Bin sizes follow how the values are written: temperatures in 5 °C steps, flows in whole mm³/s.
// Bins that do not line up with those steps leave empty stripes that are not in the data.
const X_STEP = 5;
const Y_STEP = 2;

// RFC 4180 CSV: quoted fields may contain commas, quotes ("") and newlines
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

const [header, ...rows] = parseCsv(readFileSync(process.argv[2], 'utf8'));
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`missing column: ${name}`);
  return i;
};
const iSource = col('source');
const iTemp = col('nozzle_temp');
const iFlow = col('mvs');

const points = rows.flatMap((r) => {
  const temp = Number(r[iTemp]);
  const flow = Number(r[iFlow]);
  const source = r[iSource].startsWith('prusa') ? 'prusa' : r[iSource];
  return Number.isFinite(temp) && Number.isFinite(flow) && temp > 0 && flow > 0 ? [{ source, temp, flow }] : [];
});

// Axis range: 1st to 99th percentile, rounded outward, so a few extreme profiles do not squash the plot
const temps = points.map((p) => p.temp).sort((a, b) => a - b);
const flows = points.map((p) => p.flow).sort((a, b) => a - b);
const xMin = Math.floor(quantile(temps, 0.01) / 10) * 10;
const xMax = Math.ceil(quantile(temps, 0.99) / 10) * 10;
const yMax = Math.ceil(quantile(flows, 0.99) / 10) * 10;
const x = { min: xMin, max: xMax, bins: (xMax - xMin) / X_STEP };
const y = { min: 0, max: yMax, bins: yMax / Y_STEP };
const X_BINS = x.bins;
const Y_BINS = y.bins;

const sources = {};
let outside = 0;
for (const p of points) {
  const s = (sources[p.source] ??= { n: 0, cells: {} });
  s.n++;
  if (p.temp < x.min || p.temp > x.max || p.flow > y.max) {
    outside++;
    continue;
  }
  const i = Math.min(X_BINS - 1, Math.floor((p.temp - x.min) / X_STEP));
  const j = Math.min(Y_BINS - 1, Math.floor(p.flow / Y_STEP));
  const key = `${i},${j}`;
  s.cells[key] = (s.cells[key] ?? 0) + 1;
}

const out = {
  total: points.length,
  skipped: rows.length - points.length,
  outsideRange: outside,
  x,
  y,
  sources: Object.fromEntries(
    Object.entries(sources)
      .sort()
      .map(([name, s]) => [name, { n: s.n, cells: Object.entries(s.cells).map(([k, c]) => [...k.split(',').map(Number), c]) }]),
  ),
};
process.stdout.write(JSON.stringify(out) + '\n');
