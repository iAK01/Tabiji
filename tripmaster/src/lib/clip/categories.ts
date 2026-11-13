// What a clipped thing is, for Discover's "Saved by you". Shared by the server,
// the app and (as plain strings) the Safari clipper.

export const CLIP_CATEGORIES = [
  'sightseeing', 'culture', 'food', 'coffee', 'drinks', 'nightlife', 'shopping', 'nature', 'activity', 'tip',
] as const;

export type ClipCategory = typeof CLIP_CATEGORIES[number];

export const CATEGORY_LABEL: Record<ClipCategory, string> = {
  sightseeing: 'Sightseeing',
  culture:     'Culture',
  food:        'Food',
  coffee:      'Coffee',
  drinks:      'Drinks',
  nightlife:   'Nightlife',
  shopping:    'Shopping',
  nature:      'Outdoors',
  activity:    'Things to do',
  tip:         'Tip',
};

export const CATEGORY_COLOUR: Record<ClipCategory, string> = {
  sightseeing: '#7a4a10',
  culture:     '#1D2642',
  food:        '#5a2020',
  coffee:      '#4a2c0a',
  drinks:      '#6b2a4a',
  nightlife:   '#2a1a4a',
  shopping:    '#1a3d3d',
  nature:      '#2d5a1e',
  activity:    '#3d3035',
  tip:         '#55702C',
};

/** The Discover highlight type a saved place adds to a day as (Addtoitinerarydialog). */
export const HIGHLIGHT_TYPE: Record<ClipCategory, string> = {
  sightseeing: 'landmark',
  culture:     'museum',
  food:        'food',
  coffee:      'coffee',
  drinks:      'food',
  nightlife:   'experience',
  shopping:    'other',
  nature:      'park',
  activity:    'experience',
  tip:         'other',
};

export const isCategory = (v: unknown): v is ClipCategory =>
  typeof v === 'string' && (CLIP_CATEGORIES as readonly string[]).includes(v);
