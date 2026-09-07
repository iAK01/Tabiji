// Airport reference data.
//
// Sourced from the public-domain OurAirports dataset (~4,000 airports that have
// an IATA code and run scheduled service), with hand-curated city/name overrides
// from scripts/airport-overrides.json. Regenerate with:
//   node scripts/build-airports.mjs

import airportsJson from './airports.json';

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export const airports: Airport[] = airportsJson as Airport[];

const byIata = new Map(airports.map(a => [a.iata, a]));

/** Exact IATA-code lookup (case-insensitive). */
export function airportByIata(code: string | undefined | null): Airport | undefined {
  if (!code) return undefined;
  return byIata.get(code.trim().toUpperCase());
}

// Lowercase + strip diacritics so "dusseldorf" matches "Düsseldorf", "krakow" → "Kraków".
const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Precomputed once — searching a 4k list on every keystroke otherwise re-folds ~16k strings.
const index = airports.map(a => ({
  a,
  iata:    a.iata.toLowerCase(),
  city:    fold(a.city),
  name:    fold(a.name),
  country: fold(a.country),
}));

/**
 * Type-ahead search over city / IATA / airport name / country, ranked so the
 * obvious match floats to the top.
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];

  const scored: Array<{ a: Airport; score: number }> = [];

  for (const e of index) {
    let score = 0;
    if (e.iata === q)                 score = 100;
    else if (e.iata.startsWith(q))    score = 80;
    else if (e.city === q)            score = 70;
    else if (e.city.startsWith(q))    score = 55;
    else if (e.city.includes(q))      score = 35;
    else if (e.name.includes(q))      score = 25;
    else if (e.country.startsWith(q)) score = 15;
    else if (e.country.includes(q))   score = 8;

    if (score > 0) scored.push({ a: e.a, score });
  }

  return scored
    .sort((x, y) => y.score - x.score || x.a.city.localeCompare(y.a.city))
    .slice(0, limit)
    .map(s => s.a);
}
