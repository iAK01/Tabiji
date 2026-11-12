// Fuzzy matching for packing items. The catalogue page, a trip's packing list and both
// add dialogs share it, so "is this already in there?" gets the same answer everywhere.
// Pure — also used by the API routes to refuse duplicates.

// ─── Normalising ──────────────────────────────────────────────────────────────

/** Lower case, accents and punctuation gone, single spaces: "Driver's Licence (EU)" → "drivers licence eu". */
export function normalize(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Two names are the same item when these match — case, spacing and punctuation
 * ignored, so "T-shirt", "t shirt" and "Tshirt" are one item. The API refuses a second.
 */
export function nameKey(s: string | undefined | null): string {
  return normalize(s).replace(/ /g, '');
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'of', 'and', 'with', 'to', 'in', 'on', 'my']);

// Words people use for the same thing, written without spaces so "sun cream" and
// "suncream" are one entry.
const SYNONYMS: string[][] = [
  ['sunscreen', 'suncream', 'sunblock', 'spf', 'suntanlotion'],
  ['pyjamas', 'pajamas', 'pjs', 'nightwear', 'sleepwear'],
  ['jumper', 'sweater', 'pullover'],
  ['trainers', 'sneakers', 'runners'],
  ['swimsuit', 'swimwear', 'swimmingcostume', 'bathingsuit', 'togs', 'bathers', 'swimshorts', 'swimmingtrunks'],
  ['headphones', 'earphones', 'earbuds', 'airpods'],
  ['phone', 'mobile', 'cellphone', 'smartphone', 'iphone'],
  ['wallet', 'purse'],
  ['torch', 'flashlight'],
  ['headtorch', 'headlamp'],
  ['plaster', 'bandaid'],
  ['washbag', 'toiletbag', 'spongebag', 'toiletrybag', 'toiletriesbag', 'doppkit'],
  ['powerbank', 'batterypack', 'portablecharger', 'portablebattery'],
  ['plugadapter', 'traveladapter', 'poweradapter', 'plugadaptor', 'traveladaptor', 'poweradaptor'],
  ['raincoat', 'rainjacket', 'waterproofjacket', 'waterproof', 'cagoule', 'anorak'],
  ['umbrella', 'brolly'],
  ['flipflops', 'thongs', 'jandals'],
  ['sunglasses', 'shades', 'sunnies'],
  ['razor', 'shaver'],
  ['deodorant', 'antiperspirant', 'deo'],
  ['eyemask', 'sleepmask', 'sleepingmask'],
  ['hairdryer', 'blowdryer'],
  ['tshirt', 'tee', 'teeshirt'],
  ['underwear', 'boxers', 'briefs', 'knickers', 'undies'],
  ['medication', 'medicine', 'meds'],
  ['cash', 'money', 'currency'],
  ['kindle', 'ereader', 'ebookreader'],
  ['laptop', 'macbook'],
  ['tablet', 'ipad'],
  ['travelpillow', 'neckpillow', 'neckcushion'],
  ['waterbottle', 'drinksbottle', 'reusablebottle'],
  ['flask', 'thermos'],
  ['handsanitiser', 'handsanitizer', 'handgel', 'alcoholgel'],
  ['lipbalm', 'chapstick', 'lipsalve'],
  ['moisturiser', 'moisturizer', 'facecream'],
  ['tracksuitbottoms', 'trackies', 'joggers', 'sweatpants'],
  ['jacket', 'coat'],
  ['trousers', 'slacks'],
  ['beanie', 'woollyhat', 'woolyhat', 'bobblehat'],
  ['gloves', 'mittens'],
  ['tights', 'pantyhose'],
  ['nappies', 'diapers'],
  ['pram', 'stroller', 'buggy', 'pushchair'],
  ['dummy', 'pacifier', 'soother'],
  ['bodywash', 'showergel'],
  ['luggagetag', 'bagtag', 'luggagelabel'],
  ['carryon', 'handluggage', 'cabinbag'],
  ['suitcase', 'checkedbag', 'holdluggage'],
  ['sdcard', 'memorycard'],
  ['usbstick', 'usbdrive', 'flashdrive', 'memorystick', 'thumbdrive'],
  ['extensionlead', 'extensioncord', 'powerstrip', 'multiplug', 'powerboard'],
  ['drivinglicence', 'driverslicence', 'drivinglicense', 'driverslicense'],
];

// ─── Word matching ────────────────────────────────────────────────────────────

/** Same word, singular or plural: sock/socks, glass/glasses, battery/batteries. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length < 2) return false;
  if (l.startsWith(s) && (l.length - s.length === 1 ? l.endsWith('s') : l.endsWith('es') && l.length - s.length === 2)) return true;
  return s.endsWith('y') && l === `${s.slice(0, -1)}ies`;
}

function synonymsOf(word: string): string[] {
  const out: string[] = [];
  for (const group of SYNONYMS) {
    if (group.some(e => sameWord(e, word))) out.push(...group.filter(e => !sameWord(e, word)));
  }
  return out;
}

/** Typos allowed in a word this long. */
function typosAllowed(len: number): number {
  return len >= 8 ? 2 : len >= 4 ? 1 : 0;
}

/** Edit distance counting a swapped pair as one (optimal string alignment), capped at max + 1. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev  = cur;
  }
  return prev[b.length];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Prepared {
  compact:   string;
  words:     string[];
  wordSyns:  string[][];
  wholeSyns: string[];
}

function prepare(text: string): Prepared | null {
  const norm = normalize(text);
  if (!norm) return null;
  const all   = norm.split(' ');
  const kept  = all.filter(w => !STOP_WORDS.has(w));
  const words = kept.length ? kept : all;
  const compact = norm.replace(/ /g, '');
  return { compact, words, wordSyns: words.map(synonymsOf), wholeSyns: synonymsOf(compact) };
}

// How well one query word is found in the target, 0 when it isn't.
function wordScore(qw: string, syns: string[], tWords: string[], tCompact: string, loose: boolean): number {
  let best = 0;
  const hasDigit = /\d/.test(qw);
  for (const tw of tWords) {
    if (tw === qw) return 1;
    if (sameWord(qw, tw))                         best = Math.max(best, 0.95);
    else if (tw.startsWith(qw))                   best = Math.max(best, 0.6 + 0.3 * (qw.length / tw.length));
    else if (syns.some(s => sameWord(s, tw)))     best = Math.max(best, 0.85);
    else if (loose && qw.length >= 3 && tw.includes(qw)) best = Math.max(best, 0.7);
    else if (!hasDigit) {
      const max = typosAllowed(qw.length);
      if (max) {
        if (editDistance(qw, tw, max) <= max) best = Math.max(best, 0.85);
        // Still typing the word: "chagr" → "charger"
        else if (tw.length > qw.length && editDistance(qw, tw.slice(0, qw.length), max) <= max) best = Math.max(best, 0.6);
      }
    }
  }
  if (loose && best < 0.8) {
    if (syns.some(s => s.length >= 3 && tCompact.includes(s))) best = Math.max(best, 0.8);
    else if (qw.length >= 3 && tCompact.includes(qw))         best = Math.max(best, 0.7);
  }
  return best;
}

// 0–1, 0 when the target doesn't match. Every query word has to be found. `loose` also
// matches inside words and across spaces ("tooth brush" → "Toothbrush") — for names,
// not for long notes where that turns up nonsense.
function score(q: Prepared, target: string | undefined, loose: boolean): number {
  const t = normalize(target);
  if (!t) return 0;
  const tCompact = t.replace(/ /g, '');
  if (tCompact === q.compact) return 1;
  const tWords = t.split(' ');

  let best = 0;
  if (loose) {
    if (q.words.length === tWords.length && q.words.every((w, i) => sameWord(w, tWords[i]))) return 0.97;
    const ratio = q.compact.length / tCompact.length;
    if (tCompact.startsWith(q.compact))                            best = 0.65 + 0.3 * ratio;
    else if (q.compact.length >= 3 && tCompact.includes(q.compact)) best = 0.6 + 0.2 * ratio;
    if (q.wholeSyns.some(s => s === tCompact))                     best = Math.max(best, 0.9);
    else if (q.wholeSyns.some(s => s.length >= 3 && tCompact.includes(s))) best = Math.max(best, 0.8);
  }

  let sum = 0;
  for (let i = 0; i < q.words.length; i++) {
    const s = wordScore(q.words[i], q.wordSyns[i], tWords, tCompact, loose);
    if (!s) return best;
    sum += s;
  }
  return Math.max(best, 0.9 * (sum / q.words.length));
}

// ─── Public ───────────────────────────────────────────────────────────────────

export interface SearchFields {
  name:  string;
  /** Category, notes and the like — matched word by word, ranked below a name match. */
  also?: (string | undefined | null)[];
}

/** Items matching the query, best first. An empty query returns them all, in order. */
export function searchItems<T>(query: string, items: readonly T[], fields: (item: T) => SearchFields): T[] {
  const q = prepare(query);
  if (!q) return [...items];
  return items
    .map(item => {
      const f = fields(item);
      let s = score(q, f.name, true);
      for (const extra of f.also ?? []) s = Math.max(s, 0.6 * score(q, extra ?? '', false));
      return { item, s, name: f.name };
    })
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name))
    .map(r => r.item);
}

const SIMILAR = 0.7;

export interface Similar<T> { item: T; exact: boolean }

/**
 * Items whose name is the same as, or close to, `name` — for warning before a duplicate
 * is added. `exact` is a same-item match by nameKey; those come first.
 */
export function similarByName<T>(name: string, items: readonly T[], nameOf: (item: T) => string, limit = 4): Similar<T>[] {
  const key = nameKey(name);
  const q   = prepare(name);
  if (key.length < 2 || !q) return [];
  return items
    .map(item => {
      const other = nameOf(item);
      if (nameKey(other) === key) return { item, exact: true, s: 2 };
      const back = prepare(other);
      return { item, exact: false, s: Math.max(score(q, other, true), back ? score(back, name, true) : 0) };
    })
    .filter(r => r.s >= SIMILAR)
    .sort((a, b) => b.s - a.s || nameOf(a.item).localeCompare(nameOf(b.item)))
    .slice(0, limit)
    .map(({ item, exact }) => ({ item, exact }));
}

/** The first item with the same name (by nameKey), if any. */
export function sameName<T extends { name?: string }>(name: string, items: readonly T[]): T | undefined {
  const key = nameKey(name);
  return key ? items.find(i => nameKey(i.name) === key) : undefined;
}
