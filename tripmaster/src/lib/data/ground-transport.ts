// Ground transport services and country coverage.
// All URLs and coverage verified via live research (May 2026).
// Do not add entries based on assumption — verify first.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransportService {
  id:       string;
  name:     string;
  webUrl:   string;
  category: 'ride' | 'transit' | 'rail';
  note?:    string;
}

export interface CountryTransport {
  rides:       string[];
  transit:     string[];
  payment:     { cashHeavy: boolean; note?: string };
  preDownload: string[];
}

// ─── Service registry ─────────────────────────────────────────────────────────
// Web URLs open in mobile browser and prompt to open native app if installed.

export const TRANSPORT_SERVICES: Record<string, TransportService> = {
  // ── Rides ──────────────────────────────────────────────────────────────────
  uber: {
    id: 'uber', name: 'Uber', category: 'ride',
    webUrl: 'https://m.uber.com',
  },
  bolt: {
    id: 'bolt', name: 'Bolt', category: 'ride',
    webUrl: 'https://bolt.eu',
  },
  freenow: {
    id: 'freenow', name: 'FreeNow', category: 'ride',
    webUrl: 'https://www.free-now.com',
  },
  cabify: {
    id: 'cabify', name: 'Cabify', category: 'ride',
    webUrl: 'https://cabify.com',
  },
  ittaxi: {
    id: 'ittaxi', name: 'itTaxi', category: 'ride',
    webUrl: 'https://www.ittaxi.it',
    note: 'Dominant in Italy — Uber routes through itTaxi in Rome',
  },
  g7: {
    id: 'g7', name: 'G7 Taxi', category: 'ride',
    webUrl: 'https://www.g7.fr',
    note: 'Heritage Paris taxi app, 9,000+ drivers',
  },
  ecabs: {
    id: 'ecabs', name: 'eCabs', category: 'ride',
    webUrl: 'https://ecabs.com.mt',
    note: 'Maltese operator — advance booking + accessibility vehicles',
  },
  taxime_bg: {
    id: 'taxime_bg', name: 'TaxiMe', category: 'ride',
    webUrl: 'https://taxime.bg',
    note: 'Bulgaria only — Uber and Bolt do not operate here',
  },
  norgestaksi: {
    id: 'norgestaksi', name: 'NorgesTaxi', category: 'ride',
    webUrl: 'https://www.norgestaksi.no',
  },
  // ── Transit (city public transport) ────────────────────────────────────────
  google_maps: {
    id: 'google_maps', name: 'Google Maps', category: 'transit',
    webUrl: 'https://maps.google.com',
  },
  citymapper: {
    id: 'citymapper', name: 'Citymapper', category: 'transit',
    webUrl: 'https://citymapper.com',
    note: '430+ cities globally — covers most major EU cities',
  },
  moovit: {
    id: 'moovit', name: 'Moovit', category: 'transit',
    webUrl: 'https://moovitapp.com',
  },
  tfi_live: {
    id: 'tfi_live', name: 'TFI Live', category: 'transit',
    webUrl: 'https://www.transportforireland.ie/available-apps/tfi-live/',
    note: 'Real-time for all Irish operators — Bus Éireann, Dublin Bus, Luas, DART',
  },
  tfi_go: {
    id: 'tfi_go', name: 'TFI Go', category: 'transit',
    webUrl: 'https://www.buseireann.ie/tfi-go-app',
    note: 'Buy Irish public transport tickets in-app',
  },
  bvg: {
    id: 'bvg', name: 'BVG (Berlin)', category: 'transit',
    webUrl: 'https://www.bvg.de/en/subscriptions-and-tickets/bvg-app',
    note: 'Official Berlin S-Bahn, U-Bahn, tram, bus app',
  },
  mvv: {
    id: 'mvv', name: 'MVV (Munich)', category: 'transit',
    webUrl: 'https://www.mvv-muenchen.de/en/mvv-app/',
  },
  ratp: {
    id: 'ratp', name: 'Bonjour RATP', category: 'transit',
    webUrl: 'https://www.bonjour-ratp.fr/en/',
    note: 'Official Paris metro, bus, RER, tram app',
  },
  tmb: {
    id: 'tmb', name: 'TMB (Barcelona)', category: 'transit',
    webUrl: 'https://www.tmb.cat/en/tmb-app-t-mobilitat',
    note: 'Metro + bus, buy T-mobilitat tickets in-app',
  },
  emt_madrid: {
    id: 'emt_madrid', name: 'EMT Madrid', category: 'transit',
    webUrl: 'https://www.emtmadrid.es/Bloques-EMT/EMT-BUS/App-EMT',
  },
  oasa: {
    id: 'oasa', name: 'OASA Telematics', category: 'transit',
    webUrl: 'https://www.oasa.gr/en/passenger-service/tools/telematics-app/',
    note: 'Official Athens bus, trolley, metro real-time app',
  },
  ns9292: {
    id: 'ns9292', name: '9292', category: 'transit',
    webUrl: 'https://9292.nl',
    note: 'Netherlands — covers all operators: train, bus, tram, metro, ferry',
  },
  oebb_app: {
    id: 'oebb_app', name: 'ÖBB', category: 'transit',
    webUrl: 'https://www.oebb.at/en/tickets-kundenkarten/online-mobile-ticketing/oebb-app',
    note: 'Covers almost all Austrian rail and local transit',
  },
  jakdojade: {
    id: 'jakdojade', name: 'Jakdojade', category: 'transit',
    webUrl: 'https://jakdojade.pl',
    note: 'Poland — covers Warsaw, Kraków, Wrocław, Gdańsk and more',
  },
  ruter: {
    id: 'ruter', name: 'Ruter', category: 'transit',
    webUrl: 'https://ruter.no/en',
    note: 'Oslo and Akershus region',
  },
  sl: {
    id: 'sl', name: 'SL (Stockholm)', category: 'transit',
    webUrl: 'https://sl.se',
  },
  skanetrafiken: {
    id: 'skanetrafiken', name: 'Skånetrafiken', category: 'transit',
    webUrl: 'https://www.skanetrafiken.se',
    note: 'Malmö and southern Sweden, including trains to Copenhagen',
  },
  hsl: {
    id: 'hsl', name: 'HSL', category: 'transit',
    webUrl: 'https://www.hsl.fi/en',
    note: 'Helsinki region — bus, tram, metro, commuter rail, Suomenlinna ferry',
  },
  // ── Rail (national) ────────────────────────────────────────────────────────
  db_navigator: {
    id: 'db_navigator', name: 'DB Navigator', category: 'rail',
    webUrl: 'https://int.bahn.de/en',
    note: 'Essential for Germany — national rail + local transit in one app',
  },
  sncf_connect: {
    id: 'sncf_connect', name: 'SNCF Connect', category: 'rail',
    webUrl: 'https://www.sncf-connect.com',
    note: 'France national trains + Paris transit, Navigo top-up',
  },
  trenitalia: {
    id: 'trenitalia', name: 'Trenitalia', category: 'rail',
    webUrl: 'https://www.trenitalia.com',
  },
  renfe: {
    id: 'renfe', name: 'Renfe', category: 'rail',
    webUrl: 'https://www.renfe.com',
    note: 'Spain national rail',
  },
  vy: {
    id: 'vy', name: 'Vy', category: 'rail',
    webUrl: 'https://www.vy.no/en',
    note: 'Norway national trains + regional buses',
  },
};

// ─── Country map (ISO 3166-1 alpha-2) ─────────────────────────────────────────
// rides: in priority order (most useful first)
// transit: universal options first, then city-specific
// preDownload: 2-3 apps worth installing before the trip (excludes Google Maps)

export const COUNTRY_TRANSPORT: Record<string, CountryTransport> = {
  // ── Ireland ────────────────────────────────────────────────────────────────
  IE: {
    rides:       ['freenow', 'bolt', 'uber'],
    transit:     ['tfi_live', 'tfi_go', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false, note: 'Cards widely accepted' },
    preDownload: ['freenow', 'tfi_live', 'tfi_go'],
  },
  // ── United Kingdom ─────────────────────────────────────────────────────────
  GB: {
    rides:       ['uber', 'bolt', 'freenow'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['uber', 'citymapper'],
  },
  // ── Germany ────────────────────────────────────────────────────────────────
  // Uber restricted; FreeNow (now owned by Lyft) is strongest; DB Navigator essential
  DE: {
    rides:       ['freenow', 'bolt', 'uber'],
    transit:     ['db_navigator', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: true, note: 'Many places cash only — bring euros' },
    preDownload: ['db_navigator', 'freenow'],
  },
  // ── France ─────────────────────────────────────────────────────────────────
  FR: {
    rides:       ['uber', 'bolt', 'g7'],
    transit:     ['sncf_connect', 'ratp', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['sncf_connect', 'uber'],
  },
  // ── Spain ──────────────────────────────────────────────────────────────────
  ES: {
    rides:       ['cabify', 'uber', 'freenow', 'bolt'],
    transit:     ['tmb', 'emt_madrid', 'renfe', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: true, note: 'Cash still common outside major cities — 57% of transactions' },
    preDownload: ['cabify', 'renfe'],
  },
  // ── Portugal ───────────────────────────────────────────────────────────────
  PT: {
    rides:       ['uber', 'bolt', 'cabify'],
    transit:     ['citymapper', 'moovit', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['uber', 'bolt'],
  },
  // ── Italy ──────────────────────────────────────────────────────────────────
  // Uber = Black/premium only; itTaxi is essential; FreeNow also operates
  IT: {
    rides:       ['ittaxi', 'freenow', 'uber'],
    transit:     ['trenitalia', 'moovit', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: true, note: 'Cash heavy — 61% of transactions. Carry euros.' },
    preDownload: ['ittaxi', 'trenitalia'],
  },
  // ── Netherlands ────────────────────────────────────────────────────────────
  NL: {
    rides:       ['uber', 'bolt'],
    transit:     ['ns9292', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false, note: 'One of Europe\'s most cashless countries — 22% cash' },
    preDownload: ['ns9292'],
  },
  // ── Belgium ────────────────────────────────────────────────────────────────
  BE: {
    rides:       ['uber', 'bolt', 'freenow'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false, note: '39% cash usage' },
    preDownload: ['uber', 'bolt'],
  },
  // ── Austria ────────────────────────────────────────────────────────────────
  AT: {
    rides:       ['uber', 'bolt', 'freenow'],
    transit:     ['oebb_app', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['oebb_app', 'uber'],
  },
  // ── Greece ─────────────────────────────────────────────────────────────────
  // All apps work via licensed taxis only; FreeNow was formerly Beat (dominant)
  GR: {
    rides:       ['freenow', 'bolt', 'uber'],
    transit:     ['oasa', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['freenow', 'oasa'],
  },
  // ── Malta ──────────────────────────────────────────────────────────────────
  MT: {
    rides:       ['bolt', 'ecabs', 'uber'],
    transit:     ['google_maps'],
    payment:     { cashHeavy: true, note: 'Highest cash usage in EU — 67% of transactions' },
    preDownload: ['bolt', 'ecabs'],
  },
  // ── Poland ─────────────────────────────────────────────────────────────────
  PL: {
    rides:       ['uber', 'bolt'],
    transit:     ['jakdojade', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['jakdojade', 'bolt'],
  },
  // ── Czech Republic ─────────────────────────────────────────────────────────
  CZ: {
    rides:       ['uber', 'bolt'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['uber', 'bolt'],
  },
  // ── Slovakia ───────────────────────────────────────────────────────────────
  // Uber only in Bratislava; Bolt more widely available
  SK: {
    rides:       ['bolt', 'uber'],
    transit:     ['google_maps', 'moovit'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
  // ── Hungary ────────────────────────────────────────────────────────────────
  // Uber banned since 2016 — Bolt only
  HU: {
    rides:       ['bolt'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
  // ── Romania ────────────────────────────────────────────────────────────────
  RO: {
    rides:       ['uber', 'bolt'],
    transit:     ['moovit', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['uber', 'bolt'],
  },
  // ── Bulgaria ───────────────────────────────────────────────────────────────
  // Both Uber and Bolt absent — local apps only
  BG: {
    rides:       ['taxime_bg'],
    transit:     ['moovit', 'google_maps'],
    payment:     { cashHeavy: true, note: 'Cash dominant — Uber and Bolt do not operate here' },
    preDownload: ['taxime_bg'],
  },
  // ── Croatia ────────────────────────────────────────────────────────────────
  HR: {
    rides:       ['uber', 'bolt'],
    transit:     ['google_maps', 'moovit'],
    payment:     { cashHeavy: false },
    preDownload: ['uber', 'bolt'],
  },
  // ── Slovenia ───────────────────────────────────────────────────────────────
  // Uber launched May 2025 (Ljubljana only); Bolt also available
  SI: {
    rides:       ['bolt', 'uber'],
    transit:     ['google_maps', 'moovit'],
    payment:     { cashHeavy: true, note: 'Cash common — 64% of transactions' },
    preDownload: ['bolt'],
  },
  // ── Estonia ────────────────────────────────────────────────────────────────
  // Bolt is Estonian — dominant here
  EE: {
    rides:       ['bolt', 'uber'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
  // ── Latvia ─────────────────────────────────────────────────────────────────
  LV: {
    rides:       ['bolt', 'uber'],
    transit:     ['google_maps', 'moovit'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
  // ── Lithuania ──────────────────────────────────────────────────────────────
  LT: {
    rides:       ['bolt', 'uber'],
    transit:     ['google_maps', 'moovit'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
  // ── Denmark ────────────────────────────────────────────────────────────────
  DK: {
    rides:       ['uber', 'bolt'],
    transit:     ['citymapper', 'google_maps'],
    payment:     { cashHeavy: false, note: 'One of Europe\'s most cashless countries' },
    preDownload: ['uber', 'bolt'],
  },
  // ── Sweden ─────────────────────────────────────────────────────────────────
  SE: {
    rides:       ['uber', 'bolt'],
    transit:     ['sl', 'skanetrafiken', 'citymapper', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['sl', 'uber'],
  },
  // ── Norway ─────────────────────────────────────────────────────────────────
  NO: {
    rides:       ['uber', 'bolt', 'norgestaksi'],
    transit:     ['ruter', 'vy', 'google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['ruter', 'uber'],
  },
  // ── Finland ────────────────────────────────────────────────────────────────
  FI: {
    rides:       ['uber', 'bolt'],
    transit:     ['hsl', 'google_maps'],
    payment:     { cashHeavy: false, note: '27% cash — very card-forward' },
    preDownload: ['hsl', 'uber'],
  },
  // ── Cyprus ─────────────────────────────────────────────────────────────────
  // No Uber; Bolt dominant; island is car-centric with limited public transit
  CY: {
    rides:       ['bolt', 'ecabs'],
    transit:     ['google_maps'],
    payment:     { cashHeavy: false },
    preDownload: ['bolt'],
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCountryTransport(countryCode: string): CountryTransport | null {
  return COUNTRY_TRANSPORT[countryCode.toUpperCase()] ?? null;
}

export function resolveServices(ids: string[]): TransportService[] {
  return ids.map(id => TRANSPORT_SERVICES[id]).filter(Boolean);
}
