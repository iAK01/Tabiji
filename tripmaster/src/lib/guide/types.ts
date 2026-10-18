// ─── Destination guide (Wikivoyage) — shared by the guide API and Discover ────
// Wikivoyage text is CC BY-SA: anywhere it's shown must credit Wikivoyage and link
// the article (Guide.url).

import { slug } from './wikitext';

// Identity of a Discover pick — briefings from before picks had ids fall back to the name.
export function pickKey(h: { id?: string; name: string }): string {
  return h.id ?? `ai:${slug(h.name)}`;
}

export type ListingKind = 'see' | 'do' | 'eat' | 'drink' | 'buy' | 'go';

export interface LatLng { lat: number; lng: number }

export interface GuideListing {
  id:           string;        // `${kind}:${slug}` — stable across refreshes of the same article
  kind:         ListingKind;
  group?:       string;        // the guide's own sub-heading, e.g. "Museums", "Tapas bars"
  district?:    string;        // district label, for cities split into district articles
  name:         string;
  alt?:         string;
  description?: string;
  address?:     string;
  directions?:  string;
  coordinates?: LatLng;
  hours?:       string;
  price?:       string;
  url?:         string;
  phone?:       string;
  wikipedia?:   string;
  image?:       string;        // Wikimedia Commons file name
  lastEdit?:    string;        // YYYY-MM-DD — when a Wikivoyage editor last checked the details
  article?:     string;        // Go next: the destination's own Wikivoyage article
}

export interface GuideBlock   { heading?: string; paragraphs: string[] }
export interface GuideSection { key: string; heading: string; blocks: GuideBlock[] }

export interface GuideDistrict {
  name:        string;
  title:       string;         // Wikivoyage article, e.g. "Madrid/La Latina-Austrias"
  description: string;
}

export interface GuidePhoto {
  url:      string;
  link:     string;            // Commons file page
  credit?:  string;
  licence?: string;
}

export interface Guide {
  title:        string;
  url:          string;
  revision:     number;
  fetchedAt:    string;
  intro:        string[];
  photo:        GuidePhoto | null;
  coordinates?: LatLng;
  sections:     GuideSection[];
  districts:    GuideDistrict[];
  listings:     GuideListing[];
}

// What the guide endpoint returns: the shared article plus this trip's own anchor.
export interface TripGuide {
  guide: Guide | null;
  stay:  { name: string; coordinates: LatLng } | null;
}

export const KIND_LABELS: Record<ListingKind, string> = {
  see:   'See',
  do:    'Do',
  eat:   'Eat',
  drink: 'Drink',
  buy:   'Shop',
  go:    'Day trips',
};
