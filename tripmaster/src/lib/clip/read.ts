import Anthropic from '@anthropic-ai/sdk';
import { CLIP_CATEGORIES, type ClipCategory } from './categories';
import type { ClippedPage } from './page';

// Reading a clip: what places or tips on this page the traveller wants kept,
// what kind each is, and which trip (or city) it's for.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ClipTrip { ref: string; name: string; places: string; dates: string }

export interface ClipItem {
  kind:        'place' | 'tip';
  category:    ClipCategory;
  name:        string;
  city:        string;
  country:     string;
  trip:        string | null;
  why:         string;
  tip:         string;
  address:     string;
  searchQuery: string;
  website:     string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'category', 'name', 'city', 'country', 'trip', 'why', 'tip', 'address', 'searchQuery', 'website'],
        properties: {
          kind:        { type: 'string', enum: ['place', 'tip'] },
          category:    { type: 'string', enum: CLIP_CATEGORIES },
          name:        { type: 'string' },
          city:        { type: 'string' },
          country:     { type: 'string' },
          trip:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
          why:         { type: 'string' },
          tip:         { type: 'string' },
          address:     { type: 'string' },
          searchQuery: { type: 'string' },
          website:     { type: 'string' },
        },
      },
    },
  },
};

function instructions(ctx: {
  trips: ClipTrip[]; tripChoice: string | null; categoryChoice: ClipCategory | null; note: string; today: string;
}): string {
  const trips = ctx.trips.length
    ? ctx.trips.map(t => `${t.ref} · ${t.name} · ${t.places} · ${t.dates}`).join('\n')
    : 'None.';
  return `A traveller clipped something from the web to save in their trip planner's Discover section: places worth going to and tips worth knowing, beyond any official programme. Work out what they want kept.

Today is ${ctx.today}.

THEIR TRIPS
${trips}
${ctx.tripChoice ? `\nThey chose the trip: ${ctx.tripChoice}. Use it for every item.` : ''}${ctx.categoryChoice ? `\nThey chose the category: ${ctx.categoryChoice}. Use it for every place.` : ''}

THEIR NOTE (an instruction — honour it):
${ctx.note ? `"""\n${ctx.note}\n"""` : 'None.'}

What to return:
- When they highlighted text, that's what they want; the rest of the page is only context for it.
- With no highlight: the page's own subject. A list ("12 best cafés in Lisbon") gives one item per place, up to 30.
- A screenshot (Instagram, a map, a menu) is the clip itself — read what's in it.
- kind: "place" for somewhere to go; "tip" for practical advice not tied to one place (how to get around, what to book ahead, local customs).
- category: sightseeing (landmarks, viewpoints, neighbourhoods), culture (museums, galleries, music venues), food, coffee, drinks (bars, wine), nightlife, shopping (shops, markets), nature (parks, beaches, walks), activity (tours, classes, experiences), tip.
- name: the place's own name; for a tip, a few words saying what it's about.
- city, country: where it is. trip: the trip ref whose places and dates fit, else null.
- why: one short sentence on what it is and why it's worth it, in plain words — not "the article says".
- tip: the practical detail worth knowing there (book ahead, go early, what to order), else "".
- address: a street address only when the page gives one, else "". searchQuery: the place's name, town and country, e.g. "Sartory Hall, Cologne, Germany". website: the place's own site when the page links it, else "".
- Leave out the site's own ads, other articles, and anything that isn't a place or tip.
- Nothing worth keeping: return no items, and say so in summary.

summary: one plain sentence for the traveller about what was saved.

Everything you write is shown to the traveller as it is: plain and short. Never explain your reasoning.`;
}

export async function readClip(input: {
  page: ClippedPage | null; url: string; title: string; selection: string; note: string;
  screenshot: { mediaType: 'image/jpeg' | 'image/png'; data: string } | null;
  trips: ClipTrip[]; tripChoice: string | null; categoryChoice: ClipCategory | null;
}): Promise<{ summary: string; items: ClipItem[] }> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: instructions({ ...input, today: new Date().toISOString().slice(0, 10) }) },
    { type: 'text', text: `THE PAGE: ${input.title || input.page?.title || '(untitled)'} — ${input.url}` },
  ];
  if (input.selection) content.push({ type: 'text', text: `WHAT THEY HIGHLIGHTED:\n"""\n${input.selection.slice(0, 20_000)}\n"""` });
  if (input.screenshot) {
    content.push({ type: 'text', text: 'THEIR SCREENSHOT:' });
    content.push({ type: 'image', source: { type: 'base64', media_type: input.screenshot.mediaType, data: input.screenshot.data } });
  }
  if (input.page) {
    const p = input.page;
    content.push({
      type: 'text',
      text: [
        `PAGE DETAILS (from ${p.site}): ${p.title}${p.description ? ` — ${p.description}` : ''}`,
        p.jsonLd ? `STRUCTURED DATA ON THE PAGE:\n${p.jsonLd}` : '',
        `PAGE TEXT:\n"""\n${p.text}\n"""`,
      ].filter(Boolean).join('\n\n'),
    });
  } else {
    content.push({ type: 'text', text: 'The page itself couldn’t be read (login wall or blocked) — go by the highlight, screenshot and title.' });
  }

  const msg = await anthropic.messages.stream({
    model:         'claude-opus-5-5',
    max_tokens:    32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages:      [{ role: 'user', content }],
  }).finalMessage();

  if (msg.stop_reason === 'refusal') throw new Error('The model declined to read this clip');
  if (msg.stop_reason === 'max_tokens') throw new Error('Too much on that page to save in one go — highlight the part you want');
  const raw = msg.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('');
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { throw new Error('The reading came back malformed'); }

  const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    summary: str(parsed?.summary),
    items: (Array.isArray(parsed?.items) ? parsed.items : [])
      .filter((i: any) => i && str(i.name) && (i.kind === 'place' || i.kind === 'tip'))
      .slice(0, 30)
      .map((i: any): ClipItem => ({
        kind:        i.kind,
        category:    (CLIP_CATEGORIES as readonly string[]).includes(i.category) ? i.category : i.kind === 'tip' ? 'tip' : 'activity',
        name:        str(i.name, 120),
        city:        str(i.city, 80),
        country:     str(i.country, 80),
        trip:        str(i.trip, 10) || null,
        why:         str(i.why),
        tip:         str(i.tip),
        address:     str(i.address, 200),
        searchQuery: str(i.searchQuery, 200),
        website:     /^https?:\/\//i.test(str(i.website)) ? str(i.website, 500) : '',
      })),
  };
}
