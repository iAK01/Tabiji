// Builds a destination guide from Wikivoyage: the article's readable sections from
// TextExtracts, and its See/Do/Eat/Drink/Buy/Go next listings parsed from the wikitext.
// Cities split into districts (Madrid, Paris…) keep most listings on the district
// pages, so those are fetched too. Four API requests per guide, all batched.

import { haversineKm } from '@/lib/geo/geocode';
import type { Guide, GuideBlock, GuideDistrict, GuideListing, GuidePhoto, GuideSection, LatLng, ListingKind } from './types';
import { decodeEntities, firstLink, headings, sectionAt, sectionText, slug, stripNoise, templates, toText } from './wikitext';

const API     = 'https://en.wikivoyage.org/w/api.php';
const HEADERS = { 'User-Agent': 'TripMaster/1.0 (travel planning app)' };

const MATCH_KM      = 40;   // an exact-title article further than this from the trip is a namesake
const MAX_DISTRICTS = 12;

const PROSE = [
  { key: 'understand', heading: 'Understand' },
  { key: 'get-around', heading: 'Get around' },
  { key: 'stay-safe',  heading: 'Stay safe'  },
  { key: 'respect',    heading: 'Respect'    },
];

const KINDS = new Set<ListingKind>(['see', 'do', 'eat', 'drink', 'buy', 'go']);
const SECTION_KINDS: Record<string, ListingKind> = {
  'see': 'see', 'do': 'do', 'eat': 'eat', 'drink': 'drink', 'buy': 'buy', 'go next': 'go',
};

async function api(params: Record<string, string>, retried = false): Promise<any> {
  const qs  = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetch(`${API}?${qs}`, { headers: HEADERS, cache: 'no-store' });
  if ((res.status === 429 || res.status === 503) && !retried) {
    const wait = Math.min(Number(res.headers.get('retry-after')) || 2, 5);
    await new Promise(r => setTimeout(r, wait * 1000));
    return api(params, true);
  }
  if (!res.ok) throw new Error(`Wikivoyage ${res.status}`);
  return res.json();
}

export function articleUrl(title: string): string {
  return `https://en.wikivoyage.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;
}

// Maps each requested title to the page the API actually answered with.
function titleResolver(query: any): (t: string) => string {
  const hops = new Map<string, string>();
  for (const n of [...(query?.normalized ?? []), ...(query?.redirects ?? [])]) hops.set(n.from, n.to);
  return (t: string) => {
    let cur = t;
    for (let i = 0; i < 3 && hops.has(cur); i++) cur = hops.get(cur)!;
    return cur;
  };
}

// ─── Which article is this trip's destination? ───────────────────────────────

export async function resolveArticle(city: string, country: string, near?: LatLng): Promise<string | null> {
  const data  = await api({
    action: 'query', titles: [city, `${city} (${country})`].join('|'), redirects: '1',
    prop: 'coordinates|pageprops', ppprop: 'disambiguation',
  });
  const pages = (data.query?.pages ?? []).filter((p: any) =>
    !p.missing && !p.invalid && !('disambiguation' in (p.pageprops ?? {})));

  if (!near) return pages[0]?.title ?? null;

  const close = pages
    .map((p: any) => ({ title: p.title as string, c: p.coordinates?.[0] }))
    .filter((p: any) => p.c && haversineKm(near.lat, near.lng, p.c.lat, p.c.lon) <= MATCH_KM)
    .sort((a: any, b: any) =>
      haversineKm(near.lat, near.lng, a.c.lat, a.c.lon) - haversineKm(near.lat, near.lng, b.c.lat, b.c.lon));
  if (close[0]) return close[0].title;

  // Small towns are often titled "Town (County)" — find the nearest article instead.
  const geo  = await api({
    action: 'query', list: 'geosearch', gscoord: `${near.lat}|${near.lng}`,
    gsradius: '10000', gslimit: '10', gsnamespace: '0',
  });
  const hits: { title: string }[] = geo.query?.geosearch ?? [];
  const named = hits.find(h => h.title.toLowerCase().startsWith(city.toLowerCase()));
  const hit   = named ?? hits[0];
  return hit ? hit.title.split('/')[0] : null;   // a district page stands in for its city
}

// ─── Build ────────────────────────────────────────────────────────────────────

export async function buildGuide(title: string): Promise<Guide | null> {
  const main = await api({
    action: 'query', titles: title, redirects: '1',
    prop: 'extracts|revisions|pageimages|coordinates',
    explaintext: '1', exsectionformat: 'wiki',
    rvprop: 'ids|content', rvslots: 'main',
    piprop: 'thumbnail|name', pithumbsize: '1280',
  });
  const page = main.query?.pages?.[0];
  if (!page || page.missing) return null;

  const wt = stripNoise(page.revisions?.[0]?.slots?.main?.content ?? '');
  const hs = headings(wt);
  const { intro, sections } = parseExtract(page.extract ?? '');
  const districts = parseDistricts(page.title, wt, hs);

  const listings = new Map<string, GuideListing>();
  for (const l of [...parseListings(wt), ...parseGoNext(wt, hs)]) addListing(listings, l);

  if (districts.length) {
    const d       = await api({
      action: 'query', titles: districts.map(x => x.title).join('|'), redirects: '1',
      prop: 'revisions', rvprop: 'content', rvslots: 'main',
    });
    const resolve = titleResolver(d.query);
    const byTitle = new Map<string, any>((d.query?.pages ?? []).map((p: any) => [p.title, p]));
    for (const district of districts) {
      const dp = byTitle.get(resolve(district.title));
      const dw = dp?.revisions?.[0]?.slots?.main?.content;
      if (dw) for (const l of parseListings(stripNoise(dw), district.name)) addListing(listings, l);
    }
  }

  // Coordinates for day-trip destinations + licence details for the lead photo, in one go.
  const goNext    = [...listings.values()].filter(l => l.kind === 'go' && l.article && !l.coordinates);
  const photoFile = page.pageimage ? `File:${page.pageimage}` : null;
  let photo: GuidePhoto | null = null;
  const extraTitles = [...new Set(goNext.map(l => l.article!))].slice(0, 45);
  if (photoFile) extraTitles.push(photoFile);
  if (extraTitles.length) {
    const extra   = await api({
      action: 'query', titles: extraTitles.join('|'), redirects: '1',
      prop: 'coordinates|imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1280',
      iiextmetadatafilter: 'Artist|LicenseShortName',
    }).catch(() => null);
    const resolve = titleResolver(extra?.query);
    const byTitle = new Map<string, any>((extra?.query?.pages ?? []).map((p: any) => [p.title, p]));
    for (const l of goNext) {
      const c = byTitle.get(resolve(l.article!))?.coordinates?.[0];
      if (c) l.coordinates = { lat: c.lat, lng: c.lon };
    }
    if (photoFile) photo = photoFrom(byTitle.get(resolve(photoFile))?.imageinfo?.[0], page.thumbnail?.source);
  }

  const c = page.coordinates?.[0];
  return {
    title:       page.title,
    url:         articleUrl(page.title),
    revision:    page.revisions?.[0]?.revid ?? 0,
    fetchedAt:   new Date().toISOString(),
    intro,
    photo,
    coordinates: c ? { lat: c.lat, lng: c.lon } : undefined,
    sections,
    districts,
    listings:    [...listings.values()],
  };
}

// ─── Prose ────────────────────────────────────────────────────────────────────

function parseExtract(extract: string): { intro: string[]; sections: GuideSection[] } {
  const intro: string[] = [];
  const bySection: Record<string, GuideBlock[]> = {};
  let section = '';
  let block: GuideBlock | null = null;

  for (const raw of extract.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^(={2,5})\s*(.+?)\s*\1$/);
    if (h) {
      if (h[1].length === 2) section = h[2];
      block = { heading: h[1].length === 2 ? undefined : h[2], paragraphs: [] };
      (bySection[section] ??= []).push(block);
      continue;
    }
    if (!section) intro.push(line);
    else block?.paragraphs.push(line);
  }

  const sections = PROSE
    .map(p => ({ key: p.key, heading: p.heading, blocks: (bySection[p.heading] ?? []).filter(b => b.paragraphs.length) }))
    .filter(s => s.blocks.length);
  return { intro, sections };
}

// ─── Districts ────────────────────────────────────────────────────────────────

function parseDistricts(title: string, wt: string, hs: ReturnType<typeof headings>): GuideDistrict[] {
  const text = sectionText(wt, hs, 'Districts');
  if (!text) return [];
  const out: GuideDistrict[] = [];

  for (const t of templates(text, /^regionlist$/i)) {
    for (const [key, value] of Object.entries(t.params)) {
      const n    = key.match(/^region(\d+)name$/)?.[1];
      const link = n ? firstLink(value) : null;
      if (!link || !link.target.startsWith(`${title}/`)) continue;
      out.push({ name: link.label, title: link.target, description: toText(t.params[`region${n}description`]) });
    }
  }
  if (!out.length) {
    for (const line of text.split('\n')) {
      if (!line.startsWith('*')) continue;
      const link = firstLink(line);
      if (!link || !link.target.startsWith(`${title}/`)) continue;
      const description = toText(line.replace(/^\*+/, '')).replace(link.label, '').replace(/^[\s\-–—:,.]+/, '');
      out.push({ name: link.label, title: link.target, description });
    }
  }

  const seen = new Set<string>();
  return out.filter(d => !seen.has(d.title) && seen.add(d.title)).slice(0, MAX_DISTRICTS);
}

// ─── Listings ─────────────────────────────────────────────────────────────────

function parseListings(wt: string, district?: string): GuideListing[] {
  const hs  = headings(wt);
  const out: GuideListing[] = [];

  for (const t of templates(wt, /^(see|do|eat|drink|buy|sleep|go|listing|vcard)$/i)) {
    if (t.name === 'sleep') continue;
    const { section, group } = sectionAt(hs, t.pos);
    const typed = (t.params.type ?? '').toLowerCase() as ListingKind;
    const kind  = KINDS.has(t.name as ListingKind) ? t.name as ListingKind
                : KINDS.has(typed)                 ? typed
                : SECTION_KINDS[(section ?? '').toLowerCase()];
    if (!kind) continue;   // transport, embassies, hotels — not things to do
    // {{go}} also marks airports and stations under Get in / Get around
    if (kind === 'go' && SECTION_KINDS[(section ?? '').toLowerCase()] !== 'go') continue;

    const name = toText(t.params.name);
    if (!name) continue;
    const p   = t.params;
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.long ?? p.lon ?? p.lng);

    out.push(prune({
      id:          `${kind}:${slug(name)}`,
      kind,
      group:       group && group !== section ? group : undefined,
      district,
      name,
      alt:         toText(p.alt),
      description: toText(p.content ?? p.description),
      address:     toText(p.address),
      directions:  toText(p.directions),
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
      hours:       toText(p.hours),
      price:       toText(p.price),
      url:         cleanUrl(p.url),
      phone:       toText(p.phone),
      wikipedia:   toText(p.wikipedia),
      image:       p.image?.replace(/^(File|Image):/i, '').trim(),
      lastEdit:    /^\d{4}-\d{2}(-\d{2})?$/.test(p.lastedit ?? '') ? p.lastedit : undefined,
    }));
  }
  return out;
}

// Go next is usually prose bullets linking other articles rather than listing templates.
function parseGoNext(wt: string, hs: ReturnType<typeof headings>): GuideListing[] {
  const text = sectionText(wt, hs, 'Go next');
  const out: GuideListing[] = [];
  let group: string | undefined;

  for (const line of text.split('\n')) {
    const h = line.match(/^={3,5}\s*(.+?)\s*=+\s*$/);
    if (h) { group = toText(h[1]); continue; }
    if (!line.startsWith('*') || /\{\{\s*(see|do|go|listing|marker)\s*\|/i.test(line)) continue;
    const link = firstLink(line);
    if (!link) continue;
    const description = toText(line.replace(/^\*+/, '')).replace(link.label, '').replace(/^[\s\-–—:,.]+/, '');
    out.push(prune({
      id:          `go:${slug(link.label)}`,
      kind:        'go' as const,
      group,
      name:        link.label,
      description,
      article:     link.target,
      url:         articleUrl(link.target),
    }));
  }
  return out;
}

// The same place can appear in the city article and a district article — keep the
// fuller entry.
function addListing(into: Map<string, GuideListing>, l: GuideListing) {
  const prev = into.get(l.id);
  if (!prev) { into.set(l.id, l); return; }
  const score = (x: GuideListing) => (x.coordinates ? 1000 : 0) + (x.description?.length ?? 0);
  if (score(l) > score(prev)) into.set(l.id, { ...l, district: l.district ?? prev.district });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prune<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}

function cleanUrl(raw?: string): string | undefined {
  const m = raw?.match(/(https?:\/\/[^\s\]|]+|www\.[^\s\]|]+)/i)?.[1];
  if (!m) return undefined;
  try { return new URL(m.startsWith('www.') ? `https://${m}` : m).href; } catch { return undefined; }
}

function stripQuery(url: string): string {
  return url.split('?')[0];
}

function photoFrom(info: any, fallback?: string): GuidePhoto | null {
  const url = info?.thumburl ?? info?.url ?? fallback;
  if (!url) return null;
  const meta   = info?.extmetadata ?? {};
  const artist = decodeEntities(String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  return {
    url:     stripQuery(url),
    link:    info?.descriptionurl ?? stripQuery(url),
    credit:  artist || undefined,
    licence: meta.LicenseShortName?.value || undefined,
  };
}

// Commons thumbnails for a set of file names (listing photos), keyed by file name.
export async function commonsPhotos(files: string[], width = 960): Promise<Map<string, GuidePhoto>> {
  const out = new Map<string, GuidePhoto>();
  const unique = [...new Set(files)].slice(0, 45);
  if (!unique.length) return out;
  const data = await api({
    action: 'query', titles: unique.map(f => `File:${f}`).join('|'), redirects: '1',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(width),
    iiextmetadatafilter: 'Artist|LicenseShortName',
  }).catch(() => null);
  const resolve = titleResolver(data?.query);
  const byTitle = new Map<string, any>((data?.query?.pages ?? []).map((p: any) => [p.title, p]));
  for (const f of unique) {
    const photo = photoFrom(byTitle.get(resolve(`File:${f}`))?.imageinfo?.[0]);
    if (photo) out.set(f, photo);
  }
  return out;
}
