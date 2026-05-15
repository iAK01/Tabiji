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

export interface PreDownloadEntry {
  id:     string;
  reason: string;
}

export interface CountryTransport {
  rides:       string[];
  transit:     string[];
  payment:     { cashHeavy: boolean; note?: string };
  preDownload: PreDownloadEntry[];
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
    rides:   ['freenow', 'bolt', 'uber'],
    transit: ['tfi_live', 'tfi_go', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false, note: 'Cards widely accepted' },
    preDownload: [
      { id: 'freenow', reason: 'Most popular taxi app in Ireland — covers Dublin, Cork, Limerick, Galway and more' },
      { id: 'tfi_live', reason: 'Real-time arrivals for every Irish bus, tram and train — essential for getting around' },
      { id: 'tfi_go',   reason: 'Buy public transport tickets on your phone — no card machine needed' },
    ],
  },
  // ── United Kingdom ─────────────────────────────────────────────────────────
  GB: {
    rides:   ['uber', 'bolt', 'freenow'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'uber',       reason: 'Widely available across UK cities' },
      { id: 'citymapper', reason: 'Best transit app for London, Manchester, Birmingham — real-time, offline maps' },
    ],
  },
  // ── Germany ────────────────────────────────────────────────────────────────
  // Uber restricted; FreeNow (now owned by Lyft) is strongest; DB Navigator essential
  DE: {
    rides:   ['freenow', 'bolt', 'uber'],
    transit: ['db_navigator', 'citymapper', 'google_maps'],
    payment: { cashHeavy: true, note: 'Many places cash only — bring euros' },
    preDownload: [
      { id: 'db_navigator', reason: 'Essential for all German travel — national trains, regional rail and local transit in one app' },
      { id: 'freenow',      reason: 'Strongest ride app in Germany — Uber is heavily restricted and rarely available' },
    ],
  },
  // ── France ─────────────────────────────────────────────────────────────────
  FR: {
    rides:   ['uber', 'bolt', 'g7'],
    transit: ['sncf_connect', 'ratp', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'sncf_connect', reason: 'Book French trains and top up your Paris Navigo transit card — one app for everything' },
      { id: 'uber',         reason: 'Most reliable ride app in France, available in Paris and all major cities' },
    ],
  },
  // ── Spain ──────────────────────────────────────────────────────────────────
  ES: {
    rides:   ['cabify', 'uber', 'freenow', 'bolt'],
    transit: ['tmb', 'emt_madrid', 'renfe', 'citymapper', 'google_maps'],
    payment: { cashHeavy: true, note: 'Cash still common outside major cities — 57% of transactions' },
    preDownload: [
      { id: 'cabify', reason: 'More widely available than Uber across Spanish cities — covers Seville, Valencia, Málaga and more' },
      { id: 'renfe',  reason: 'Spain\'s national rail — needed for any intercity train journey' },
    ],
  },
  // ── Portugal ───────────────────────────────────────────────────────────────
  PT: {
    rides:   ['uber', 'bolt', 'cabify'],
    transit: ['citymapper', 'moovit', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'uber', reason: 'Most popular ride app in Portugal — reliable in Lisbon, Porto and the Algarve' },
      { id: 'bolt', reason: 'Often cheaper than Uber — both are widely available across Portuguese cities' },
    ],
  },
  // ── Italy ──────────────────────────────────────────────────────────────────
  // Uber = Black/premium only; itTaxi is essential; FreeNow also operates
  IT: {
    rides:   ['ittaxi', 'freenow', 'uber'],
    transit: ['trenitalia', 'moovit', 'citymapper', 'google_maps'],
    payment: { cashHeavy: true, note: 'Cash heavy — 61% of transactions. Carry euros.' },
    preDownload: [
      { id: 'ittaxi',     reason: 'The essential taxi app in Italy — Uber barely operates here (luxury Black only). itTaxi works in every major city.' },
      { id: 'trenitalia', reason: 'Italy\'s national rail — needed for intercity trains between Rome, Milan, Florence and Naples' },
    ],
  },
  // ── Netherlands ────────────────────────────────────────────────────────────
  NL: {
    rides:   ['uber', 'bolt'],
    transit: ['ns9292', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false, note: 'One of Europe\'s most cashless countries — 22% cash' },
    preDownload: [
      { id: 'ns9292', reason: 'Covers all Dutch public transport in one app — train, bus, tram, metro, ferry, with e-tickets' },
    ],
  },
  // ── Belgium ────────────────────────────────────────────────────────────────
  BE: {
    rides:   ['uber', 'bolt', 'freenow'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false, note: '39% cash usage' },
    preDownload: [
      { id: 'uber', reason: 'Largest user base among ride apps in Belgium' },
      { id: 'bolt', reason: 'Often cheaper than Uber — widely available in Brussels and major Belgian cities' },
    ],
  },
  // ── Austria ────────────────────────────────────────────────────────────────
  AT: {
    rides:   ['uber', 'bolt', 'freenow'],
    transit: ['oebb_app', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'oebb_app', reason: 'Covers almost all Austrian rail and local transit — one app for trains, trams and buses nationwide' },
      { id: 'uber',     reason: 'Available in Vienna, Graz, Salzburg and Linz' },
    ],
  },
  // ── Greece ─────────────────────────────────────────────────────────────────
  // All apps work via licensed taxis only; FreeNow was formerly Beat (dominant)
  GR: {
    rides:   ['freenow', 'bolt', 'uber'],
    transit: ['oasa', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'freenow', reason: 'Largest ride fleet in Greece — was formerly Beat, the dominant local app with 8,000+ drivers' },
      { id: 'oasa',    reason: 'Official Athens bus and metro real-time app — essential for navigating the city cheaply' },
    ],
  },
  // ── Malta ──────────────────────────────────────────────────────────────────
  MT: {
    rides:   ['bolt', 'ecabs', 'uber'],
    transit: ['google_maps'],
    payment: { cashHeavy: true, note: 'Highest cash usage in EU — 67% of transactions' },
    preDownload: [
      { id: 'bolt',  reason: 'Most popular and cheapest ride app on the island — launched 2019, now dominant' },
      { id: 'ecabs', reason: 'Maltese-founded operator — better for advance booking and has accessibility vehicles' },
    ],
  },
  // ── Poland ─────────────────────────────────────────────────────────────────
  PL: {
    rides:   ['uber', 'bolt'],
    transit: ['jakdojade', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'jakdojade', reason: 'Essential for buses and trams across all major Polish cities — real-time schedules and in-app tickets' },
      { id: 'bolt',      reason: 'Most popular ride app in Poland — widely available with competitive pricing' },
    ],
  },
  // ── Czech Republic ─────────────────────────────────────────────────────────
  CZ: {
    rides:   ['uber', 'bolt'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'uber', reason: 'Available across Czech cities including Prague' },
      { id: 'bolt', reason: 'Often cheaper than Uber in Prague — both are widely used' },
    ],
  },
  // ── Slovakia ───────────────────────────────────────────────────────────────
  // Uber only in Bratislava; Bolt more widely available
  SK: {
    rides:   ['bolt', 'uber'],
    transit: ['google_maps', 'moovit'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'Most widely available ride app in Slovakia — Uber only operates in Bratislava' },
    ],
  },
  // ── Hungary ────────────────────────────────────────────────────────────────
  // Uber banned since 2016 — Bolt only
  HU: {
    rides:   ['bolt'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'The only major ride app in Hungary — Uber has been banned since 2016' },
    ],
  },
  // ── Romania ────────────────────────────────────────────────────────────────
  RO: {
    rides:   ['uber', 'bolt'],
    transit: ['moovit', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'uber', reason: 'Reliable and available in Bucharest and major Romanian cities' },
      { id: 'bolt', reason: 'Often 10–15 RON cheaper than Uber for the same journey — worth having both' },
    ],
  },
  // ── Bulgaria ───────────────────────────────────────────────────────────────
  // Both Uber and Bolt absent — local apps only
  BG: {
    rides:   ['taxime_bg'],
    transit: ['moovit', 'google_maps'],
    payment: { cashHeavy: true, note: 'Cash dominant — Uber and Bolt do not operate in Bulgaria' },
    preDownload: [
      { id: 'taxime_bg', reason: 'The main taxi app in Bulgaria — Uber and Bolt do not operate here, so you\'ll need a local alternative' },
    ],
  },
  // ── Croatia ────────────────────────────────────────────────────────────────
  HR: {
    rides:   ['uber', 'bolt'],
    transit: ['google_maps', 'moovit'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'uber', reason: 'Available in Zagreb, Split, Dubrovnik and Zadar' },
      { id: 'bolt', reason: 'Competitive alternative to Uber — both operate across major Croatian cities and tourist areas' },
    ],
  },
  // ── Slovenia ───────────────────────────────────────────────────────────────
  // Uber launched May 2025 (Ljubljana only); Bolt also available
  SI: {
    rides:   ['bolt', 'uber'],
    transit: ['google_maps', 'moovit'],
    payment: { cashHeavy: true, note: 'Cash common — 64% of transactions' },
    preDownload: [
      { id: 'bolt', reason: 'Main ride app in Slovenia — Uber only recently launched (May 2025) and is limited to Ljubljana' },
    ],
  },
  // ── Estonia ────────────────────────────────────────────────────────────────
  // Bolt is Estonian — dominant here
  EE: {
    rides:   ['bolt', 'uber'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'Bolt is an Estonian company — dominant and most reliable here, with the largest driver fleet' },
    ],
  },
  // ── Latvia ─────────────────────────────────────────────────────────────────
  LV: {
    rides:   ['bolt', 'uber'],
    transit: ['google_maps', 'moovit'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'Dominant ride app in Latvia — stronger coverage and more drivers than Uber' },
    ],
  },
  // ── Lithuania ──────────────────────────────────────────────────────────────
  LT: {
    rides:   ['bolt', 'uber'],
    transit: ['google_maps', 'moovit'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'Dominant ride app in Lithuania — stronger coverage and more drivers than Uber' },
    ],
  },
  // ── Denmark ────────────────────────────────────────────────────────────────
  DK: {
    rides:   ['uber', 'bolt'],
    transit: ['citymapper', 'google_maps'],
    payment: { cashHeavy: false, note: 'One of Europe\'s most cashless countries' },
    preDownload: [
      { id: 'uber', reason: 'Available in Copenhagen and major Danish cities' },
      { id: 'bolt', reason: 'Cheaper alternative to Uber — both widely used in Denmark' },
    ],
  },
  // ── Sweden ─────────────────────────────────────────────────────────────────
  SE: {
    rides:   ['uber', 'bolt'],
    transit: ['sl', 'skanetrafiken', 'citymapper', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'sl',   reason: 'Official Stockholm transit app — buy metro, bus and tram tickets directly in the app' },
      { id: 'uber', reason: 'Available across Swedish cities including Stockholm, Gothenburg and Malmö' },
    ],
  },
  // ── Norway ─────────────────────────────────────────────────────────────────
  NO: {
    rides:   ['uber', 'bolt', 'norgestaksi'],
    transit: ['ruter', 'vy', 'google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'ruter', reason: 'Official Oslo transit app — covers all buses, trams, metro, and ferries with mobile tickets' },
      { id: 'uber',  reason: 'Available in Oslo, Bergen, Trondheim and Stavanger' },
    ],
  },
  // ── Finland ────────────────────────────────────────────────────────────────
  FI: {
    rides:   ['uber', 'bolt'],
    transit: ['hsl', 'google_maps'],
    payment: { cashHeavy: false, note: '27% cash — very card-forward' },
    preDownload: [
      { id: 'hsl',  reason: 'Official Helsinki transit app — covers all buses, trams, metro, commuter rail and the Suomenlinna ferry' },
      { id: 'uber', reason: 'Available in Helsinki and other major Finnish cities' },
    ],
  },
  // ── Cyprus ─────────────────────────────────────────────────────────────────
  // No Uber; Bolt dominant; island is car-centric with limited public transit
  CY: {
    rides:   ['bolt', 'ecabs'],
    transit: ['google_maps'],
    payment: { cashHeavy: false },
    preDownload: [
      { id: 'bolt', reason: 'The dominant ride app on Cyprus — Uber does not operate here' },
    ],
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCountryTransport(countryCode: string): CountryTransport | null {
  return COUNTRY_TRANSPORT[countryCode.toUpperCase()] ?? null;
}

export function resolveServices(ids: string[]): TransportService[] {
  return ids.map(id => TRANSPORT_SERVICES[id]).filter(Boolean);
}

export function resolvePreDownload(entries: PreDownloadEntry[]): Array<TransportService & { reason: string }> {
  return entries
    .map(e => {
      const svc = TRANSPORT_SERVICES[e.id];
      if (!svc) return null;
      return { ...svc, reason: e.reason };
    })
    .filter(Boolean) as Array<TransportService & { reason: string }>;
}
