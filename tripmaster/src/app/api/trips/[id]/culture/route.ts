import { NextResponse }      from 'next/server';
import { getServerSession }  from 'next-auth';
import Anthropic             from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import connectDB             from '@/lib/mongodb/connection';
import Trip                  from '@/lib/mongodb/models/Trip';
import TripLogistics         from '@/lib/mongodb/models/TripLogistics';
import User                  from '@/lib/mongodb/models/User';
import { getFreeCultureAccess } from '@/lib/data/free-cultural-access';
import { uploadFile }        from '@/lib/utils/storage';
import { summaryLine, wetDayCount } from '@/lib/weather-insights';
import { haversineKm, locatePlace, locateArea } from '@/lib/geo/geocode';
import { guideForTrip, stayForTrip } from '@/lib/guide/load';
import { commonsPhotos }     from '@/lib/guide/wikivoyage';
import { slug }              from '@/lib/guide/wikitext';
import { pickKey, type Guide, type GuideListing, type LatLng } from '@/lib/guide/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CultureHighlight {
  id:            string;          // the guide listing's id, or ai:<slug> for places the guide doesn't list
  listingId?:    string;
  source:        'wikivoyage' | 'ai';
  name:          string;
  description:   string;          // why it suits this trip
  type:          'museum' | 'gallery' | 'landmark' | 'experience' | 'food' | 'coffee' | 'park' | 'music' | 'other';
  category:      'cultural' | 'coffee' | 'park' | 'food';
  tip?:          string;
  free?:         boolean;
  address?:      string;
  coordinates?:  { lat: number; lng: number };
  nearVenue?:    string;
  hours?:        string;
  price?:        string;
  website?:      string;
  imageUrl?:     string;
  imageCredit?:  ImageCredit;
  imageChecked?: boolean;         // looked for a photo already — don't keep retrying on every load
}

interface ImageCredit { name: string; username?: string; link: string; source?: 'unsplash' | 'wikimedia'; licence?: string }

export interface CultureBriefing {
  destination:   string;
  highlights:    CultureHighlight[];
  neighbourhood: {
    name:         string;
    description:  string;
    address?:     string;
    coordinates?: { lat: number; lng: number };
  } | null;
  practicalNote: string;
  generatedAt:   string;
}

interface Dismissed { id: string; name: string }

// ─── Prompt ───────────────────────────────────────────────────────────────────

const HIGHLIGHT_TYPES = ['museum', 'gallery', 'landmark', 'experience', 'food', 'coffee', 'park', 'music', 'other'] as const;

const PICKS_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          listingId:   { anyOf: [{ type: 'string' }, { type: 'null' }] },
          name:        { type: 'string' },
          category:    { type: 'string', enum: ['cultural', 'coffee', 'park', 'food'] },
          type:        { type: 'string', enum: HIGHLIGHT_TYPES },
          why:         { type: 'string' },
          tip:         { type: 'string' },
          free:        { type: 'boolean' },
          searchQuery: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['listingId', 'name', 'category', 'type', 'why', 'tip', 'free', 'searchQuery'],
        additionalProperties: false,
      },
    },
    neighbourhood: {
      anyOf: [
        {
          type: 'object',
          properties: {
            name:        { type: 'string' },
            description: { type: 'string' },
            searchQuery: { type: 'string' },
          },
          required: ['name', 'description', 'searchQuery'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    practicalNote: { type: 'string' },
  },
  required: ['picks', 'neighbourhood', 'practicalNote'],
  additionalProperties: false,
} as const;

interface PromptContext {
  city:           string;
  country:        string;
  tripType:       string;
  purpose:        string;
  nights:         number;
  dates:          string | null;
  stayName:       string | null;
  stayAddress:    string | null;
  weatherSummary: string | null;
  rainyDays:      number;
  dismissed:      Dismissed[];
  candidates:     { listing: GuideListing; km: number | null }[];
}

function candidateLine({ listing: l, km }: PromptContext['candidates'][number]): string {
  const where = km == null ? 'distance unknown' : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const about = (l.description ?? '').slice(0, 240);
  return [
    l.id,
    `${l.kind}${l.group ? ` · ${l.group}` : ''}`,
    `${l.name}${l.alt ? ` (${l.alt})` : ''}`,
    where,
    `hours: ${l.hours ?? '—'}`,
    `price: ${l.price ?? '—'}`,
    about,
  ].join(' | ');
}

function buildPrompt(ctx: PromptContext): string {
  const place = `${ctx.city}, ${ctx.country}`;
  const stayLine = ctx.stayName
    ? `Staying at: ${ctx.stayName}${ctx.stayAddress ? `, ${ctx.stayAddress}` : ''}`
    : `Staying at: not booked yet — treat central ${ctx.city} as the base`;
  const weatherLine = ctx.weatherSummary
    ? `Weather: ${ctx.weatherSummary}${ctx.rainyDays > 0 ? ` — ${ctx.rainyDays} rainy day(s) expected, so include at least one indoor option` : ''}`
    : null;
  const dismissedLine = ctx.dismissed.length
    ? `The traveller has ruled these out — don't suggest them again: ${ctx.dismissed.map(d => d.name).join('; ')}`
    : null;

  const searchRule = `give a searchQuery of the place's name, the actual town it is in and the country (e.g. "St Muredach's Cathedral, Ballina, County Mayo, Ireland") — the town, never just an island or region, when the destination "${place}" is one`;
  const source = ctx.candidates.length
    ? `Recommend the places you'd genuinely pick for this trip — real places in ${ctx.city} itself, not other towns.

For reference, here are places listed in the Wikivoyage guide to ${ctx.city}, nearest to the stay first. Each line is: id | section | name | distance from the stay | hours | price | what the guide says. Some listings are years old.

<guide>
${ctx.candidates.map(candidateLine).join('\n')}
</guide>

When a pick is one of these places, copy its id exactly into listingId so its hours, price and map pin come with it. When it isn't in the guide, set listingId to null and ${searchRule}.`
    : `Recommend real places in ${ctx.city} itself — not in other towns. Set listingId to null and ${searchRule}.`;

  return `You're picking highlights for someone visiting ${place}.

Trip:
- Type: ${ctx.tripType}${ctx.purpose ? ` — ${ctx.purpose}` : ''}
- Length: ${ctx.nights === 0 ? 'day trip' : `${ctx.nights} night${ctx.nights !== 1 ? 's' : ''}`}${ctx.dates ? ` (${ctx.dates})` : ''}
- ${stayLine}${weatherLine ? `\n- ${weatherLine}` : ''}${dismissedLine ? `\n- ${dismissedLine}` : ''}

${source}

Choose six picks:
- 3 with category "cultural": museums, galleries, landmarks or experiences
- 1 with category "coffee": the best independent café, not a chain
- 1 with category "park": a green space, riverside walk or outdoor route
- 1 with category "food": somewhere to eat that's distinctly local

Prefer places close to the stay and open on the trip's dates — check listed hours against the weekdays. For each pick:
- why: one or two sentences on why it suits this trip. Specific and opinionated: what to see, do or order. Don't restate the guide.
- tip: one concrete, actionable tip — timing, what to order, what to skip. Don't invent opening hours or prices.
- free: true only if there's no standard admission charge.

${ctx.nights >= 2
    ? 'neighbourhood: the best area for evenings — specific streets, the vibe, what makes it different — with a searchQuery like "Name, ' + place + '".'
    : 'neighbourhood: null.'}
practicalNote: one genuinely useful local tip a guidebook would miss.

Leave out visas, currency, adapters, getting there and packing for the weather — the app covers those elsewhere.`;
}

// ─── Image waterfall: Wikipedia → Unsplash specific → Unsplash city ──────────
// Priority: actual photo of the place > relevant photo > guaranteed something

type ImageResult = { url: string; credit: ImageCredit };

async function tryWikipedia(name: string, city: string): Promise<ImageResult | null> {
  try {
    const q       = encodeURIComponent(`${name} ${city}`);
    const headers = { 'User-Agent': 'TripMaster/1.0 (travel planning app)' };

    // Search for the article
    const searchRes  = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=1`, { headers });
    const searchData = await searchRes.json();
    const hit        = searchData.query?.search?.[0];
    if (!hit) return null;

    // Get the main page image
    const imgRes  = await fetch(`https://en.wikipedia.org/w/api.php?action=query&pageids=${hit.pageid}&prop=pageimages&format=json&pithumbsize=1200`, { headers });
    const imgData = await imgRes.json();
    const thumb   = imgData.query?.pages?.[hit.pageid]?.thumbnail?.source;
    if (!thumb) return null;

    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
    return { url: thumb, credit: { name: 'Wikimedia Commons', username: 'wikimedia', link: pageUrl, source: 'wikimedia' } };
  } catch { return null; }
}

async function tryUnsplash(query: string): Promise<ImageResult | null> {
  try {
    const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
    if (!key) return null;

    const res  = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return null;

    const data  = await res.json();
    const photo = data.results?.[0];
    if (!photo?.urls?.regular) return null;

    return {
      url:    photo.urls.regular,
      credit: { name: photo.user.name, username: photo.user.username, link: photo.links.html, source: 'unsplash' },
    };
  } catch { return null; }
}

async function fetchHighlightImage(
  name:          string,
  city:          string,
  country:       string,
  specificQuery: string,
  tripId:        string,
  slugName:      string,
): Promise<{ imageUrl?: string; imageCredit?: ImageCredit }> {
  const source =
    await tryWikipedia(name, city) ??
    await tryUnsplash(specificQuery) ??
    await tryUnsplash(`${city} ${country}`);

  if (!source) return {};

  try {
    const imgRes = await fetch(source.url);
    if (!imgRes.ok) return {};
    const buffer   = Buffer.from(await imgRes.arrayBuffer());
    const filename = `culture/${tripId}/${slugName}-${Date.now()}.jpg`;
    const imageUrl = await uploadFile(buffer, filename, 'image/jpeg');
    return { imageUrl, imageCredit: source.credit };
  } catch { return {}; }
}

// ─── Generate briefing ────────────────────────────────────────────────────────

function candidatesFrom(guide: Guide | null, anchor: LatLng, dismissed: Dismissed[]): PromptContext['candidates'] {
  if (!guide) return [];
  const ruledOut = new Set(dismissed.map(d => d.id));
  const pool = guide.listings
    .filter(l => ['see', 'do', 'eat', 'drink'].includes(l.kind) && !ruledOut.has(l.id))
    .map(listing => ({
      listing,
      km: listing.coordinates ? haversineKm(anchor.lat, anchor.lng, listing.coordinates.lat, listing.coordinates.lng) : null,
    }))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  const nearest = (kinds: string[], n: number) => pool.filter(c => kinds.includes(c.listing.kind)).slice(0, n);
  return [...nearest(['see', 'do'], 40), ...nearest(['eat'], 15), ...nearest(['drink'], 15)];
}

async function generateBriefing(ctx: PromptContext & {
  destCoords: LatLng;
  anchor:     LatLng;
  tripId:     string;
}): Promise<CultureBriefing> {
  const msg = await anthropic.messages.parse({
    model:         'claude-opus-5-5',
    max_tokens:    16000,
    output_config: { effort: 'medium', format: jsonSchemaOutputFormat(PICKS_SCHEMA) },
    messages:      [{ role: 'user', content: buildPrompt(ctx) }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('The model declined to generate picks');
  const parsed = msg.parsed_output;
  if (!parsed) throw new Error(`No picks in response (stop reason: ${msg.stop_reason})`);

  const byId     = new Map(ctx.candidates.map(c => [c.listing.id, c.listing]));
  const ruledOut = new Set(ctx.dismissed.map(d => d.id));
  const seen     = new Set<string>();
  const chosen   = parsed.picks
    .map(p => ({ p, listing: p.listingId ? byId.get(p.listingId) : undefined }))
    .map(x => ({ ...x, id: x.listing?.id ?? `ai:${slug(x.p.name)}` }))
    .filter(x => !ruledOut.has(x.id) && !seen.has(x.id) && seen.add(x.id));

  const area   = { center: ctx.destCoords, locality: `${ctx.city}, ${ctx.country}`, maxKm: 60 };
  const photos = await commonsPhotos(chosen.flatMap(x => x.listing?.image ? [x.listing.image] : [])).catch(() => new Map());

  const highlights: CultureHighlight[] = await Promise.all(chosen.map(async ({ p, listing, id }) => {
    const name     = listing?.name ?? p.name;
    const slugName = slug(name).slice(0, 40);

    let coordinates = listing?.coordinates;
    let address     = listing?.address;
    if (!coordinates) {
      const geo = await locatePlace({ name, query: p.searchQuery ?? undefined, address: listing?.address }, area);
      if (geo) { coordinates = { lat: geo.lat, lng: geo.lng }; address ??= geo.address; }
    }

    const commons = listing?.image ? photos.get(listing.image) : undefined;
    const image   = commons
      ? { imageUrl: commons.url, imageCredit: { name: commons.credit ?? 'Wikimedia Commons', link: commons.link, source: 'wikimedia' as const, licence: commons.licence } }
      : await fetchHighlightImage(name, ctx.city, ctx.country, `${name} ${ctx.city}`, ctx.tripId, slugName);

    const h: CultureHighlight = {
      id,
      listingId:   listing?.id,
      source:      listing ? 'wikivoyage' : 'ai',
      name,
      description: p.why,
      type:        p.type,
      category:    p.category,
      tip:         p.tip || undefined,
      free:        p.free,
      address,
      coordinates,
      hours:       listing?.hours,
      price:       listing?.price,
      website:     listing?.url,
      ...image,
      imageChecked: true,
    };
    return JSON.parse(JSON.stringify(h));   // drop undefined fields before saving
  }));

  let neighbourhood: CultureBriefing['neighbourhood'] = null;
  if (parsed.neighbourhood) {
    const geo = await locateArea(parsed.neighbourhood.name, parsed.neighbourhood.searchQuery, area);
    neighbourhood = {
      name:        parsed.neighbourhood.name,
      description: parsed.neighbourhood.description,
      address:     geo?.address,
      coordinates: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
    };
  }

  return {
    destination:   `${ctx.city}, ${ctx.country}`,
    highlights,
    neighbourhood,
    practicalNote: parsed.practicalNote ?? '',
    generatedAt:   new Date().toISOString(),
  };
}

// ─── Free culture access ──────────────────────────────────────────────────────

function buildFreeAccess(startDate: Date, endDate: Date, countryCode: string) {
  if (!countryCode) return { freeDays: [], standing: [], summary: null, tip: null };
  const alert = getFreeCultureAccess(countryCode.toUpperCase(), startDate, endDate);
  if (!alert) return { freeDays: [], standing: [], summary: null, tip: null };
  return {
    freeDays: alert.freeDays    ?? [],
    standing: alert.standing    ?? [],
    summary:  alert.programSummary ?? null,
    tip:      alert.tip         ?? null,
  };
}

function cultureResponse(trip: any, briefing: CultureBriefing | null) {
  return {
    culture: {
      briefing,
      freeAccess:  buildFreeAccess(new Date(trip.startDate), new Date(trip.endDate), trip.destination?.countryCode ?? ''),
      generatedAt: briefing?.generatedAt ?? trip.culture?.generatedAt ?? null,
    },
  };
}

async function loadTrip(id: string) {
  const session = await getServerSession();
  if (!session?.user?.email) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { trip };
}

function tripDates(trip: any): string | null {
  if (!trip.startDate || !trip.endDate) return null;
  const f = (d: Date) => d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f(new Date(trip.startDate))} – ${f(new Date(trip.endDate))}`;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await loadTrip(id);
  if (error) return error;
  return NextResponse.json(cultureResponse(trip, trip.culture?.briefing ?? null));
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
// { action: 'dismissPick', id, name } → x out one pick; it stays out of regenerated briefings
// { action: 'backfillImages' }        → fetch photos for picks that never got one

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await loadTrip(id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));

  if (body.action === 'dismissPick') {
    const pickId = String(body.id ?? '');
    if (!pickId) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const briefing = trip.culture?.briefing ?? null;
    const target   = (briefing?.highlights ?? []).find((h: CultureHighlight) => pickKey(h) === pickId);
    const name     = String(target?.name ?? body.name ?? '').slice(0, 200);
    const update: Record<string, unknown> = {
      $addToSet: { 'culture.dismissed': { id: pickId, name } },
    };
    if (briefing) {
      update.$set = { 'culture.briefing.highlights': briefing.highlights.filter((h: CultureHighlight) => pickKey(h) !== pickId) };
    }
    const updated = await Trip.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(cultureResponse(updated, updated.culture?.briefing ?? null));
  }

  const briefing = trip.culture?.briefing;
  if (!briefing) return NextResponse.json({ error: 'No briefing' }, { status: 404 });

  const city    = trip.destination?.city    ?? '';
  const country = trip.destination?.country ?? '';
  const highlights: CultureHighlight[] = briefing.highlights ?? [];
  if (!highlights.some(h => !h.imageUrl && !h.imageChecked)) {
    return NextResponse.json(cultureResponse(trip, briefing));
  }

  const updated: CultureHighlight[] = await Promise.all(
    highlights.map(async (h: CultureHighlight) => {
      if (h.imageUrl || h.imageChecked) return h;
      const imgData = await fetchHighlightImage(h.name, city, country, `${h.name} ${city}`, id, slug(h.name).slice(0, 40));
      return { ...h, ...imgData, imageChecked: true };
    }),
  );

  const updatedBriefing = { ...(briefing.toObject?.() ?? briefing), highlights: updated };
  await Trip.findByIdAndUpdate(id, { 'culture.briefing': updatedBriefing });
  return NextResponse.json(cultureResponse(trip, updatedBriefing));
}

// ─── POST — generate (or regenerate) the picks ───────────────────────────────

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, error } = await loadTrip(id);
  if (error) return error;

  const city    = trip.destination?.city;
  const country = trip.destination?.country;
  if (!city || !country) {
    return NextResponse.json({ error: 'Trip needs a destination city and country' }, { status: 400 });
  }

  // Destination coordinates — used as geocoding anchor
  const destCoords = trip.destination?.coordinates?.lat
    ? { lat: trip.destination.coordinates.lat, lng: trip.destination.coordinates.lng }
    : null;
  if (!destCoords) {
    return NextResponse.json({ error: 'Trip destination has no coordinates — save the trip first to geocode the destination' }, { status: 400 });
  }

  try {
    // The guide is what the picks come from; without one (no article, Wikivoyage down)
    // the model names places itself, as before.
    const guide = await guideForTrip(trip).catch(err => { console.error('Guide unavailable for picks:', err); return null; });
    const stay  = await stayForTrip(id, guide?.coordinates ?? destCoords);
    const logistics = stay ? null : await TripLogistics.findOne({ tripId: id }).lean<{ accommodation?: any[] }>();
    const firstStay = logistics?.accommodation?.[0];

    const dismissed: Dismissed[] = trip.culture?.dismissed ?? [];
    const anchor      = stay?.coordinates ?? destCoords;
    const weatherDays = trip.weather?.days ?? [];

    const briefing = await generateBriefing({
      city, country,
      tripType:       trip.tripType ?? 'leisure',
      purpose:        trip.purpose  ?? '',
      nights:         trip.nights   ?? 0,
      dates:          tripDates(trip),
      stayName:       stay?.name ?? firstStay?.name ?? null,
      stayAddress:    firstStay?.address ?? null,
      weatherSummary: summaryLine(weatherDays),
      rainyDays:      wetDayCount(weatherDays),
      dismissed,
      candidates:     candidatesFrom(guide, anchor, dismissed),
      destCoords,
      anchor,
      tripId:         id,
    });

    await Trip.findByIdAndUpdate(id, {
      'culture.briefing':    briefing,
      'culture.generatedAt': briefing.generatedAt,
    });

    return NextResponse.json(cultureResponse(trip, briefing));
  } catch (err: any) {
    console.error('Culture briefing error:', err);
    return NextResponse.json({ error: 'Failed to generate picks' }, { status: 500 });
  }
}
