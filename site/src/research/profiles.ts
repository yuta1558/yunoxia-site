// Parse src/research/data/profiles.csv (see README.md for the schema).
// Runs at build time only.

export interface Profile {
  id: string;
  ecosystem: string;
  material: string;
  filler: string;
  volumetricFlow: number;
  nozzleTemp: number;
  coolingAxis: number;
}

const REQUIRED = [
  'profile_id',
  'source_ecosystem',
  'material',
  'filler',
  'max_volumetric_flow_mm3s',
  'nozzle_temp_c',
  'cooling_axis',
] as const;

export function parseProfiles(csv: string): Profile[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new Error(`profiles.csv is missing columns: ${missing.join(', ')}`);
  }
  const col = (name: string) => header.indexOf(name);

  return lines.slice(1).flatMap((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const num = (name: string) => Number(cells[col(name)]);
    const p: Profile = {
      id: cells[col('profile_id')],
      ecosystem: cells[col('source_ecosystem')],
      material: cells[col('material')],
      filler: cells[col('filler')],
      volumetricFlow: num('max_volumetric_flow_mm3s'),
      nozzleTemp: num('nozzle_temp_c'),
      coolingAxis: num('cooling_axis'),
    };
    // Rows with non-numeric physical values are skipped, not guessed
    return [p.volumetricFlow, p.nozzleTemp, p.coolingAxis].every(Number.isFinite) ? [p] : [];
  });
}
