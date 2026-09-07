// Regenerates src/lib/data/airports.json from the public-domain OurAirports
// dataset, with hand-curated city/name overrides layered on top (OurAirports'
// `municipality` field is often the airport's village, not the city it serves).
//
//   node scripts/build-airports.mjs
//
// Keeps airports that have an IATA code and either run scheduled service, are a
// large airport, or are in the curated override list. Re-run every few months.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = join(HERE, '..', 'src', 'lib', 'data', 'airports.json');
const BASE = 'https://davidmegginson.github.io/ourairports-data';

/** { [IATA]: { name, city, country } } — curated names that beat OurAirports. */
const OVERRIDES = JSON.parse(readFileSync(join(HERE, 'airport-overrides.json'), 'utf8'));

// ── Minimal RFC-4180-ish CSV parser (quoted fields, "" escapes) ───────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const [airportsCsv, countriesCsv] = await Promise.all([
  fetch(`${BASE}/airports.csv`).then(r => r.text()),
  fetch(`${BASE}/countries.csv`).then(r => r.text()),
]);

const countryName = new Map(toObjects(parseCsv(countriesCsv)).map(c => [c.code, c.name]));
const TYPE_RANK = { large_airport: 3, medium_airport: 2, small_airport: 1 };
const byIata = new Map();

for (const a of toObjects(parseCsv(airportsCsv))) {
  const iata = a.iata_code?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) continue;

  const rank = TYPE_RANK[a.type];
  if (!rank) continue;

  const curated = OVERRIDES[iata];
  if (a.scheduled_service !== 'yes' && a.type !== 'large_airport' && !curated) continue;

  const lat = Number(a.latitude_deg);
  const lng = Number(a.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const entry = {
    iata,
    name:    (curated?.name || a.name).replace(/\s+/g, ' ').trim(),
    city:    (curated?.city || a.municipality || a.name)
               .replace(/\s+/g, ' ')
               .replace(/\s*\([A-Z]{2}\)\s*$/, '')   // strip Italian " (VR)" province tags
               .trim(),
    country: curated?.country || countryName.get(a.iso_country) || a.iso_country,
    lat:     Math.round(lat * 10000) / 10000,
    lng:     Math.round(lng * 10000) / 10000,
    _rank:   rank + (a.scheduled_service === 'yes' ? 0.5 : 0) + (curated ? 10 : 0),
  };

  const existing = byIata.get(iata);
  if (!existing || entry._rank > existing._rank) byIata.set(iata, entry);
}

const missing = Object.keys(OVERRIDES).filter(i => !byIata.has(i));
if (missing.length) console.warn(`⚠ curated but not in OurAirports: ${missing.join(', ')}`);

const airports = [...byIata.values()]
  .map(({ _rank, ...rest }) => rest)
  .sort((a, b) => a.iata.localeCompare(b.iata));

writeFileSync(OUT, JSON.stringify(airports) + '\n');
console.log(`Wrote ${airports.length} airports (${(JSON.stringify(airports).length / 1024).toFixed(0)} KB), ${Object.keys(OVERRIDES).length - missing.length} curated`);
