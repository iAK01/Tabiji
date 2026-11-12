// A colour you give a stop while planning (must go / maybe / avoid — yours to decide).
// Stored on the stop as `highlight`; the card is tinted with it.
export const HIGHLIGHTS = {
  green:  { label: 'Green',  swatch: '#3E9B5A', tint: '#E1F1E4' },
  blue:   { label: 'Blue',   swatch: '#3A7BD5', tint: '#E0EBFA' },
  yellow: { label: 'Yellow', swatch: '#E0AC00', tint: '#FBF1C9' },
  red:    { label: 'Red',    swatch: '#D9534F', tint: '#F9DFDE' },
} as const;

export type Highlight = keyof typeof HIGHLIGHTS;

export const HIGHLIGHT_KEYS = Object.keys(HIGHLIGHTS) as Highlight[];

export function isHighlight(v: unknown): v is Highlight {
  return typeof v === 'string' && v in HIGHLIGHTS;
}
