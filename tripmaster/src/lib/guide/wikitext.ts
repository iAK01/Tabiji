// Just enough wikitext handling for Wikivoyage articles: find templates by name, split
// their parameters, and turn inline markup (links, bold, unit templates…) into plain text.

export interface Heading  { pos: number; level: number; text: string }
export interface Template { pos: number; name: string; params: Record<string, string>; positional: string[] }

// Commented-out listings and footnotes would otherwise show up as real content.
export function stripNoise(wt: string): string {
  return wt
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
}

export function headings(wt: string): Heading[] {
  const out: Heading[] = [];
  const re = /^(={2,5})\s*(.+?)\s*\1\s*$/gm;
  for (let m = re.exec(wt); m; m = re.exec(wt)) {
    out.push({ pos: m.index, level: m[1].length, text: toText(m[2]) });
  }
  return out;
}

// The innermost level-2 and level-3 headings above a position.
export function sectionAt(hs: Heading[], pos: number): { section?: string; group?: string } {
  let section: string | undefined;
  let group:   string | undefined;
  for (const h of hs) {
    if (h.pos > pos) break;
    if (h.level === 2)      { section = h.text; group = undefined; }
    else if (h.level === 3) group = h.text;
  }
  return { section, group };
}

// The text of one level-2 section (heading line excluded).
export function sectionText(wt: string, hs: Heading[], name: string): string {
  const i = hs.findIndex(h => h.level === 2 && h.text.toLowerCase() === name.toLowerCase());
  if (i < 0) return '';
  const start = wt.indexOf('\n', hs[i].pos) + 1;
  const next  = hs.slice(i + 1).find(h => h.level <= 2);
  return wt.slice(start, next ? next.pos : wt.length);
}

// Every top-level-or-nested template whose name matches.
export function templates(wt: string, names: RegExp): Template[] {
  const out: Template[] = [];
  const re = /\{\{\s*([^|{}\n]+?)\s*[|}]/g;
  for (let m = re.exec(wt); m; m = re.exec(wt)) {
    if (!names.test(m[1].trim())) continue;
    const end = matchBraces(wt, m.index);
    if (end < 0) continue;
    const body  = wt.slice(m.index + 2, end - 2);
    const parts = splitTop(body);
    const params: Record<string, string> = {};
    const positional: string[] = [];
    for (const part of parts.slice(1)) {
      const eq = part.indexOf('=');
      const nested = part.search(/\{\{|\[\[/);
      if (eq > 0 && (nested < 0 || eq < nested)) {
        params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
      } else {
        positional.push(part.trim());
      }
    }
    out.push({ pos: m.index, name: m[1].trim().toLowerCase(), params, positional });
    re.lastIndex = end;
  }
  return out;
}

// Index just past the "}}" closing the template that opens at `start`, or -1.
function matchBraces(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length - 1; i++) {
    if (s[i] === '{' && s[i + 1] === '{')      { depth++; i++; }
    else if (s[i] === '}' && s[i + 1] === '}') { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

// Splits on "|" that aren't inside a nested template or link.
function splitTop(body: string): string[] {
  const parts: string[] = [];
  let depth = 0, last = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[')      { depth++; i++; }
    else if (two === '}}' || two === ']]') { depth--; i++; }
    else if (body[i] === '|' && depth === 0) { parts.push(body.slice(last, i)); last = i + 1; }
  }
  parts.push(body.slice(last));
  return parts;
}

// Templates whose visible output is their last positional argument.
const PASS_THROUGH = new Set(['lang', 'nowrap', 'w', 'small', 'smaller', 'iata', 'nobr', 'sic', 'unbulleted list']);
const UNITS        = new Set(['km', 'mi', 'm', 'ft', 'km2', 'mi2', 'kg', 'lb', 'c', 'f', 'ha', 'acre']);

function templateText(inner: string): string {
  const parts = splitTop(inner);
  const name  = parts[0].trim().toLowerCase();
  const args  = parts.slice(1);
  const named = Object.fromEntries(args
    .filter(a => /^[^=]+=/.test(a))
    .map(a => [a.slice(0, a.indexOf('=')).trim().toLowerCase(), a.slice(a.indexOf('=') + 1).trim()]));
  const pos   = args.filter(a => !/^[^=]+=/.test(a)).map(a => a.trim());

  if (UNITS.has(name) && pos[0]) return `${pos[0]} ${name}`;
  if (PASS_THROUGH.has(name))    return pos[pos.length - 1] ?? '';
  if (named.name)                return named.name;
  return '';
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—',
  euro: '€', pound: '£', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g,          (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi,       (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// Inline wikitext → readable plain text.
export function toText(wt: string | undefined): string {
  if (!wt) return '';
  let s = stripNoise(wt);
  // Templates, innermost first
  for (let i = 0; i < 6 && s.includes('{{'); i++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => templateText(inner));
  }
  s = s
    .replace(/\[\[(?:File|Image|Category):[^[\]]*(?:\[\[[^\]]*\]\][^[\]]*)*\]\]/gi, '')
    .replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, (_, t) => t.replace(/#.*$/, ''))
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\]/g, '')
    .replace(/'{2,}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

// A [[Target|Label]] or [[Target]] link's target and label.
export function firstLink(wt: string): { target: string; label: string } | null {
  const m = wt.match(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|([^\]]+))?\]\]/);
  if (!m || /^(file|image|category):/i.test(m[1])) return null;
  return { target: m[1].trim(), label: toText(m[2] ?? m[1]) };
}

export function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
