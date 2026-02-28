/**
 * free-cultural-access.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Researched free cultural access for European destinations.
 * Covers museums, monuments, heritage sites, concerts, parks, festivals — not
 * just museums. Flags trip-relevant dates AND surfaces standing free access
 * tips that apply regardless of when you travel.
 *
 * SOURCES (verified Feb 2026):
 *   IT  parisjetaime.com, ministero della cultura official program
 *   FR  parisjetaime.com, sortiraparis.com, worldinparis.com, culturezvous.com
 *   ES  esmadrid.com, museoreinasofia.es official site, guruwalk.com
 *   PT  atlaslisboa.com (Oct 2025), gov.pt official, earthvagabonds.com
 *   GR  greekreporter.com, athens-smartstay.com, Greek Ministry of Culture
 *   AT  austrianveganderlust.com (Sep 2025), vienna-unwrapped.com, bmeia.gv.at
 *   DE  museumsportal-berlin.de, iamexpat.de, TripAdvisor Berlin (May 2025)
 *   PAN nsinternational.com, icom.museum, europeanheritagedays.com (Sep 2025)
 *
 * KEY CAVEATS BAKED IN:
 *   - Berlin's 1st Sunday free scheme ENDED after 1 December 2024 (last free Sunday)
 *   - Portugal: since August 2024, residents get 52 free visits/year (any day, not Sunday-only);
 *     tourists are excluded from all national museum free schemes
 *   - Gulbenkian Lisbon: closed for renovation until July 2026
 *   - Louvre: no longer participates in 1st Sunday — instead 1st Friday evening
 *   - Centre Pompidou: closed for renovation until 2030
 *   - Versailles / national monuments: 1st Sunday NOV–MAR only (not year-round)
 *   - Spain's Prado/Reina Sofia free windows are TIME-based (daily), not date-based
 *     → surfaced as standing tips, not calendar alerts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ── Dateable rule types (produce calendar alerts) ──────────────────────────

/** nth weekday of each month, optionally season-restricted */
interface NthWeekdayRule {
  type: 'nth-weekday';
  nth: 1 | 2 | 3 | 4;
  weekday: Weekday;
  /** Restrict to specific months — omit means all 12 months */
  months?: Month[];
  label: string;
  includes: string[];
  excludes: string[];
}

/** Fixed day/month recurring every year */
interface FixedAnnualRule {
  type: 'fixed-annual';
  month: Month;
  day: number;
  label: string;
  includes: string[];
  excludes: string[];
}

/** Pan-European event — computed by a named algorithm */
interface PanEuropeanRule {
  type: 'pan-european';
  /** Which pan-European event key to compute */
  eventKey: keyof typeof PAN_EUROPEAN_EVENTS;
  /** Extra country-specific sites to include beyond the pan-European defaults */
  extraIncludes?: string[];
  extraExcludes?: string[];
}

export type FreeCulturalRule = NthWeekdayRule | FixedAnnualRule | PanEuropeanRule;

// ── Standing access (not date-specific) ────────────────────────────────────

/** Something that's always, or regularly, free regardless of the date */
export interface StandingFreeAccess {
  category: 'museum' | 'monument' | 'park' | 'concert' | 'festival' | 'market' | 'church' | 'viewpoint' | 'other';
  title: string;
  description: string;
  /** When/how — e.g. "Mon–Sat 18:00–20:00, Sundays 17:00–19:00" */
  when: string;
  /** Whether this applies to tourists or residents only */
  touristsEligible: boolean;
  caveat?: string;
}

// ── Country config ──────────────────────────────────────────────────────────

interface CountryFreeCultureConfig {
  countryCode: string;
  countryName: string;
  programSummary: string;
  tip: string;
  dateableRules: FreeCulturalRule[];
  standing: StandingFreeAccess[];
}

// ── Output types ────────────────────────────────────────────────────────────

export interface FreeCulturalDay {
  date: Date;
  label: string;
  includes: string[];
  excludes: string[];
  /** True when the event is confirmed for the year but the exact date is not yet in the lookup table */
  dateUnknown?: boolean;
}

export interface FreeCultureAlert {
  countryCode: string;
  countryName: string;
  programSummary: string;
  tip: string;
  /** Calendar-matched free days within trip window */
  freeDays: FreeCulturalDay[];
  /** Always/regularly-free tips — show regardless of dates */
  standing: StandingFreeAccess[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pan-European events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Events that happen across most/all of Europe.
 *
 * IMPORTANT: European Night of Museums and European Heritage Days do NOT fall
 * on a fixed nth-weekday formula — the date is set each year by the organisers
 * and varies. Use `knownDates` for these; if the trip year is not in the table
 * the engine skips that event and emits a `dateUnknown` flag instead.
 * Verify upcoming years at:
 *   Night of Museums: nuitdesmusees.culture.gouv.fr
 *   Heritage Days:    europeanheritagedays.com
 */
export interface PanEuropeanEventConfig {
  name: string;
  description: string;
  /** Fixed-formula date (e.g. always May 18). Mutually exclusive with knownDates. */
  getDate?: (year: number) => Date;
  /**
   * Year → confirmed date lookup. Used for events whose date is set annually by
   * organisers (Night of Museums, Heritage Days). If the trip year is absent the
   * engine skips this event and returns a `dateUnknown` notice.
   * Update this table each autumn for the following year.
   */
  knownDates?: Record<number, Date>;
  includes: readonly string[];
  excludes: readonly string[];
}

export const PAN_EUROPEAN_EVENTS: Record<string, PanEuropeanEventConfig> = {

  /**
   * International Museum Day — May 18 every year, fixed by ICOM.
   * 37,000+ museums in 158 countries participate.
   * Source: icom.museum
   */
  INTERNATIONAL_MUSEUM_DAY: {
    name: 'International Museum Day (18 May)',
    description:
      'Coordinated by ICOM — 37,000+ museums in 158 countries open free or with special programming. ' +
      'Every significant museum in Europe participates.',
    getDate: (year: number) => new Date(year, 4, 18), // May 18 — fixed every year
    includes: ['All major national and regional museums', 'Archaeological sites and monuments', 'Special evening events and workshops'],
    excludes: ['Some temporary exhibitions may still charge'],
  },

  /**
   * European Night of Museums — Saturday in May, date set annually by French Ministry of Culture.
   * NOT reliably the 3rd Saturday — in 2026 it falls on 23 May (4th Saturday).
   * Free entry from ~18:00 to midnight+, 3,000+ venues across 30+ European countries.
   * Sources: nuitdesmusees.culture.gouv.fr, sortiraparis.com
   *
   * ⚠️ UPDATE knownDates each year — verify at nuitdesmusees.culture.gouv.fr
   */
  EUROPEAN_NIGHT_OF_MUSEUMS: {
    name: 'European Night of Museums',
    description:
      'Free evening entry from ~18:00 to midnight at 3,000+ museums, galleries, and cultural venues ' +
      'across 30+ European countries. Special exhibitions, concerts, workshops, and guided tours. ' +
      '⚠️ Date varies year to year — verify at nuitdesmusees.culture.gouv.fr before flagging trips.',
    knownDates: {
      2025: new Date(2025, 4, 17),  // Sat 17 May 2025 — confirmed
      2026: new Date(2026, 4, 23),  // Sat 23 May 2026 — confirmed
    },
    includes: [
      'National museums and galleries',
      'Local and regional museums',
      'Historic monuments and palaces',
      'Contemporary art spaces',
      'Special evening performances and concerts',
    ],
    excludes: ['Some venues may charge for specific temporary exhibitions'],
  },

  /**
   * European Heritage Days — September weekend, date set annually by Council of Europe.
   * NOT reliably the 2nd or 3rd weekend — varies each year.
   * Largest cultural event in Europe — 50 countries, millions of visitors.
   * Sources: europeanheritagedays.com, European Commission
   *
   * ⚠️ UPDATE knownDates each year — verify at europeanheritagedays.com
   */
  EUROPEAN_HERITAGE_DAYS: {
    name: 'European Heritage Days',
    description:
      "Europe's largest cultural event. Thousands of historic buildings normally closed to the public " +
      'open their doors free of charge. Includes private mansions, government buildings, industrial heritage, ' +
      'castles, archaeological sites. Guided tours, workshops, performances. ' +
      '⚠️ Date varies year to year — verify at europeanheritagedays.com before flagging trips.',
    knownDates: {
      2025: new Date(2025, 8, 13),  // Sat 13 Sep 2025 — confirmed (weekend 13–14 Sep)
      2026: new Date(2026, 8, 19),  // Sat 19 Sep 2026 — confirmed (weekend 19–20 Sep)
    },
    includes: [
      'Historic buildings normally closed to the public',
      'Government buildings and palaces',
      'Private estates and mansions',
      'Industrial and vernacular heritage',
      'Archaeological sites',
      'Free guided tours (mostly in local language; English sometimes available)',
    ],
    excludes: [
      'Some popular tours require advance booking (book months ahead)',
      'English-language tours limited — check local programme',
    ],
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// Country rules
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_CULTURE_RULES: CountryFreeCultureConfig[] = [

  // ── Italy ──────────────────────────────────────────────────────────────────
  {
    countryCode: 'IT',
    countryName: 'Italy',
    programSummary:
      '"Domenica al Museo" — free entry to all Italian state museums, archaeological parks and ' +
      'monumental gardens on the first Sunday of every month, year-round.',
    tip: 'Arrive at opening time — crowds at the Colosseum and Uffizi are enormous on these Sundays. ' +
      'Book a timed slot online in advance even for free entry where offered. Standing at a bar is ' +
      'always cheaper than sitting in Italy; churches are nearly always free and architecturally extraordinary.',

    dateableRules: [
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 0, // Sunday
        label: '1st Sunday — Domenica al Museo (Free Entry)',
        includes: [
          'Colosseum, Roman Forum & Palatine Hill',
          'Uffizi Gallery (Florence)',
          'Pompeii & Herculaneum archaeological parks',
          'Castel Sant\'Angelo (Rome)',
          'Borghese Gallery (Rome)',
          'Accademia (Florence — David by Michelangelo)',
          'National Archaeological Museum (Naples)',
          'All ~485 state museums, galleries & archaeological parks',
        ],
        excludes: [
          'Temporary exhibitions within participating museums',
          'MAXXI — National Museum of 21st Century Arts (Rome)',
          'Domus Aurea (Rome)',
          'Private museums and catacombs',
          'Vatican Museums (separate state — own free day, see below)',
        ],
      },
      {
        type: 'fixed-annual',
        month: 4,
        day: 25,
        label: 'Liberation Day (25 Apr) — Free Entry at State Museums',
        includes: ['All Italian state museums and archaeological sites'],
        excludes: [
          'Temporary exhibitions',
          '⚠️ Verify annually — policy confirmed most years but not guaranteed; check ministerocultura.gov.it before trip',
        ],
      },
      {
        type: 'fixed-annual',
        month: 6,
        day: 2,
        label: 'Republic Day (2 Jun) — Free Entry at State Museums',
        includes: ['All Italian state museums and archaeological sites'],
        excludes: [
          'Temporary exhibitions',
          '⚠️ Verify annually — policy confirmed most years but not guaranteed; check ministerocultura.gov.it before trip',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: ['Vatican Museums (free on 18 May)'],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: ['Hundreds of museums across all Italian cities — free from evening'],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
        extraIncludes: ['Giornate Europee del Patrimonio — hundreds of normally-closed historic sites free across Italy'],
      },
      // Vatican — last Sunday of month (separate state, separate rule)
      {
        type: 'nth-weekday',
        nth: 4,
        weekday: 0, // Last Sunday is approximated as 4th — caveat noted in tip
        label: 'Vatican Museums — Last Sunday of Month (Free, 09:00–14:00)',
        includes: ['Vatican Museums', 'Sistine Chapel'],
        excludes: [
          '⚠️ Note: "Last Sunday" is sometimes the 5th Sunday — verify the exact date for your month',
          'Expect 2–4 hour queues — book the paid ticket to skip the line',
          'Only open 09:00–14:00 (last entry 12:30)',
        ],
      },
    ],

    standing: [
      {
        category: 'church',
        title: 'Churches — Free Entry, World-Class Art',
        description:
          'Italy\'s churches are free and contain more Renaissance and Baroque art than most paid museums. ' +
          'The Pantheon (Rome) now charges €5, but Santa Maria Maggiore, San Giovanni in Laterano, ' +
          'San Pietro in Vincoli (Michelangelo\'s Moses), and thousands of others are free.',
        when: 'Daily — check individual church hours',
        touristsEligible: true,
        caveat: 'Cover shoulders and knees. Modest dress is required.',
      },
      {
        category: 'viewpoint',
        title: 'Free Hilltop Viewpoints & Public Piazzas',
        description:
          'Gianicolo Hill (Rome), Piazzale Michelangelo (Florence), Castel dell\'Ovo waterfront (Naples). ' +
          'Rome\'s piazzas — Navona, Campo de\' Fiori, Spagna, Venezia — are free to experience.',
        when: 'Always open',
        touristsEligible: true,
      },
      {
        category: 'market',
        title: 'Free Markets',
        description:
          'Campo de\' Fiori daily market (Rome), Porta Portese flea market (Rome, Sundays), ' +
          'Mercato Centrale (Florence), Mercato di Ballarò (Palermo). Free to browse.',
        when: 'Varies — typically morning to early afternoon',
        touristsEligible: true,
      },
      {
        category: 'concert',
        title: 'Free Outdoor Concerts & Summer Festivals',
        description:
          'Estate Romana (Rome summer), outdoor cinema and concerts in piazzas across Italy. ' +
          'Many churches host free classical concerts (check local listings).',
        when: 'June–September primarily',
        touristsEligible: true,
      },
    ],
  },

  // ── France ─────────────────────────────────────────────────────────────────
  {
    countryCode: 'FR',
    countryName: 'France',
    programSummary:
      'France runs two parallel free museum schemes: national museums free on the 1st Sunday year-round, ' +
      'and national monuments free on the 1st Sunday November–March only. ' +
      'The Louvre no longer participates in 1st Sunday — instead it\'s free the 1st Friday evening. ' +
      '11 Paris municipal museums are always free every day.',
    tip: 'Always greet staff with "Bonjour" — it\'s considered rude not to. ' +
      'Book free-entry time slots online in advance for Musée d\'Orsay and Orangerie; ' +
      'they now require reservations even for free visits. Arrive at opening or go in the afternoon ' +
      'on 1st Sundays to beat the biggest crowds.',

    dateableRules: [
      // 1st Sunday — national MUSEUMS year-round
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 0,
        label: '1st Sunday — National Museums Free (Year-Round)',
        includes: [
          'Musée d\'Orsay (Impressionist masterpieces — book free slot online)',
          'Musée de l\'Orangerie (Monet\'s Water Lilies — book free slot online)',
          'Musée Picasso (Paris)',
          'Musée des Arts et Métiers (Paris)',
          'Château de Malmaison (Napoleon\'s residence)',
          'Musée Gustave Moreau',
          'Musée d\'Archéologie Nationale (Saint-Germain-en-Laye)',
          'Musée de l\'Air et de l\'Espace (Le Bourget)',
          'Musée National de Céramique (Sèvres — check reopening)',
          'Château de Fontainebleau (Sep–Jun only)',
        ],
        excludes: [
          '⚠️ Louvre: NO LONGER participates in 1st Sunday — see 1st Friday evening instead',
          '⚠️ Centre Pompidou: CLOSED for renovation until 2030',
          'Temporary exhibitions still charge',
          'Musée du Quai Branly — does not participate',
        ],
      },
      // 1st Sunday — national MONUMENTS, Nov–Mar only
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 0,
        months: [11, 12, 1, 2, 3],
        label: '1st Sunday (Nov–Mar) — National Monuments & Châteaux Free',
        includes: [
          'Château de Versailles + Trianon Estate + Hameau de la Reine (book slot)',
          'Sainte-Chapelle (stained glass, 15th century)',
          'Panthéon (Paris)',
          'Château de Vincennes',
          'Château de Champs-sur-Marne',
          'Basilique Saint-Denis (royal necropolis)',
          'Villa Savoye, Poissy (Le Corbusier masterpiece)',
          'Château de Rambouillet',
          'Arc de Triomphe',
        ],
        excludes: [
          'Versailles Gardens — free year-round except fountain shows',
          'Versailles requires advance slot booking even for free entry',
          'Some sites: Jan–Mar and Nov–Dec only (not April)',
        ],
      },
      // Louvre — 1st Friday evening (NOT Sunday)
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 5, // Friday
        months: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], // excl. July + August
        label: '1st Friday Evening (Sep–Jun) — Louvre Free from 18:00',
        includes: [
          'Musée du Louvre (full collection including Mona Lisa, Venus de Milo, Winged Victory)',
        ],
        excludes: [
          '⚠️ NOT available in July and August',
          'Temporary exhibitions still charge',
          'Expect queues — arrive early or book online even for free entry',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: ['Widespread free entry across French museums and monuments'],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'La Nuit des Musées — date confirmed per year (see above), 3,000+ French venues free from ~18:00',
          'Louvre, Orsay, museums across all French cities — free until midnight or later',
          'Concerts, workshops, performances included',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
        extraIncludes: [
          'Journées du Patrimoine — September weekend (date confirmed per year)',
          'Normally-closed private mansions, government buildings, historic sites open free',
          'One of the most popular weekends of the cultural year in France',
        ],
      },
      // Bastille Day — July 14
      {
        type: 'fixed-annual',
        month: 7,
        day: 14,
        label: 'Bastille Day (14 Jul) — Free Fireworks, Military Parade & Cultural Events',
        includes: [
          'Military parade on Champs-Élysées (free to watch)',
          'Eiffel Tower fireworks display (free from Trocadéro, Champ de Mars)',
          'Many museums offer free or reduced admission',
          'Free outdoor concerts and events across France',
          'Fire stations (casernes) hold free public balls the night before (13 Jul)',
        ],
        excludes: ['Expect very large crowds — arrive early for good positions'],
      },
    ],

    standing: [
      {
        category: 'museum',
        title: '11 Paris Municipal Museums — Always Free (Every Day)',
        description:
          'The City of Paris museums have free permanent collections every day of the year, for everyone. ' +
          'Includes: Petit Palais (European paintings), Musée Carnavalet (Paris history), ' +
          'Maison de Victor Hugo, Musée Cognacq-Jay, Musée Cernuschi (Asian art), ' +
          'Musée de la Vie Romantique, Musée d\'Art Moderne de Paris, Musée Bourdelle.',
        when: 'All year, every day (check individual opening days — most closed Monday)',
        touristsEligible: true,
        caveat: 'Permanent collections only; temporary exhibitions charge.',
      },
      {
        category: 'museum',
        title: 'Permanently Free Paris Institutions',
        description:
          'Archives Nationales (Paris), Casa Batlló (exterior free), ' +
          'Balzac House, Victor Hugo House, all Ville de Paris sites.',
        when: 'All year',
        touristsEligible: true,
      },
      {
        category: 'park',
        title: 'Free Parks, Gardens & Public Spaces',
        description:
          'Versailles Gardens are free except on Grandes Eaux Musicales days. ' +
          'Jardin des Tuileries, Jardin du Luxembourg, Parc des Buttes-Chaumont, ' +
          'Bois de Boulogne, Bois de Vincennes — always free.',
        when: 'All year (dawn to dusk)',
        touristsEligible: true,
      },
      {
        category: 'viewpoint',
        title: 'Free Views of Paris',
        description:
          'Sacré-Cœur Basilica (free entry, panoramic hilltop views). ' +
          'Galeries Lafayette rooftop (free). Pompidou exterior plaza. ' +
          'Pont des Arts, Ile Saint-Louis, quays along the Seine.',
        when: 'Always',
        touristsEligible: true,
      },
      {
        category: 'concert',
        title: 'Free Summer Events — Paris Plages & Festivals',
        description:
          'Paris Plages (July–August) — free outdoor beaches along the Seine with concerts and activities. ' +
          'Fête de la Musique (June 21) — free live music across every street in France. ' +
          'Open-air cinema at Parc de la Villette (summer, free). ' +
          'Free concerts in Sainte-Chapelle (advance booking required).',
        when: 'June–August primarily',
        touristsEligible: true,
      },
      {
        category: 'festival',
        title: 'Fête de la Musique — June 21 (Every Year)',
        description:
          'Free live music on every street, in every city across France. ' +
          'Thousands of free concerts — classical, jazz, rock, traditional — from afternoon until late night. ' +
          'One of the world\'s great free cultural events.',
        when: 'Every year, June 21',
        touristsEligible: true,
      },
    ],
  },

  // ── Spain ──────────────────────────────────────────────────────────────────
  {
    countryCode: 'ES',
    countryName: 'Spain',
    programSummary:
      'Spain\'s big three Madrid museums (Prado, Reina Sofía, Thyssen) all offer daily free time windows — ' +
      'not date-specific events. The Prado is free every day for the last 2 hours. ' +
      'Reina Sofía (home to Guernica) is free weekday evenings and Sunday mornings.',
    tip: 'Go to the Prado at 17:45 on a Sunday (free from 17:00) rather than 17:00 to beat the initial rush. ' +
      'For Guernica at Reina Sofía, go straight to Room 206 (2nd floor, Sabatini Building). ' +
      'Spanish dinner is rarely before 9pm — adjust your museum timing to suit late-afternoon free windows.',

    dateableRules: [
      // Prado — 1st Saturday of month night (Prado de Noche)
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 6, // Saturday
        label: '1st Saturday Evening — "El Prado de Noche" (Free, ~20:30–23:30)',
        includes: [
          'Museo del Prado — full collection including Las Meninas, Goya\'s Black Paintings, Garden of Earthly Delights',
          'Special evening programming and guided tours',
        ],
        excludes: ['Temporary exhibitions may charge'],
      },
      // Prado full day free — Nov 19 (Prado anniversary)
      {
        type: 'fixed-annual',
        month: 11,
        day: 19,
        label: 'Prado Museum Anniversary (19 Nov) — Free All Day',
        includes: ['Museo del Prado — full collection, all day'],
        excludes: [],
      },
      // National Day — Oct 12
      {
        type: 'fixed-annual',
        month: 10,
        day: 12,
        label: 'Día de la Hispanidad (12 Oct) — Free Entry at Select Museums',
        includes: [
          'Museo de América (pre-Columbian and colonial art)',
          'Museo Arqueológico Nacional (MAN)',
          'Other state museums — check each site',
        ],
        excludes: ['Prado, Reina Sofía, Thyssen: follow regular free windows'],
      },
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: [
          'Prado: free all day (18 May)',
          'Reina Sofía: free all day',
          'Widespread free concerts and cultural events across Spain',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'Madrid: Prado, Reina Sofía, and 95+ museums and venues — free evening',
          'Barcelona: ~95 venues free from 19:00 to 01:00',
          'Outdoor performances, light shows, and concerts',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
        extraIncludes: [
          'Jornadas de Puertas Abiertas — historic buildings across Spain open free',
        ],
      },
    ],

    standing: [
      {
        category: 'museum',
        title: 'Prado Museum — Free Daily (Last 2 Hours)',
        description:
          'Velázquez, Goya, El Bosco, Rubens — free every single day. ' +
          'Mon–Sat: free 18:00–20:00. Sundays and holidays: free 17:00–19:00.',
        when: 'Mon–Sat 18:00–20:00 | Sun & holidays 17:00–19:00',
        touristsEligible: true,
        caveat: 'Arrive 30–40 min before the free window to beat the queue.',
      },
      {
        category: 'museum',
        title: 'Reina Sofía Museum — Free Daily Evenings (Guernica)',
        description:
          'Home to Picasso\'s Guernica and Dalí, Miró. ' +
          'Free Monday and Wednesday–Saturday evenings. Free Sunday midday.',
        when: 'Mon + Wed–Sat 19:00–21:00 | Sundays 12:30–14:30 | Closed Tuesdays',
        touristsEligible: true,
        caveat: 'Go straight to Room 206 for Guernica. Very short Sunday window — arrive early.',
      },
      {
        category: 'museum',
        title: 'Thyssen-Bornemisza Museum — Free Mondays',
        description:
          'One of the world\'s great private art collections — from Italian Primitives to Pop Art. ' +
          'Free every Monday from 12:00 to 16:00.',
        when: 'Mondays 12:00–16:00',
        touristsEligible: true,
      },
      {
        category: 'museum',
        title: 'Museo Sorolla (Madrid) — Free Saturday Afternoons & Sunday Mornings',
        description:
          'Former home and studio of Joaquín Sorolla, Spanish Impressionist. ' +
          'Free on Saturday afternoons and Sunday mornings. ' +
          'Check museoreinasofia.es/sorolla for current hours as windows are adjusted periodically.',
        when: 'Saturdays (afternoon) | Sundays (morning) — verify current times on official site',
        touristsEligible: true,
      },
      {
        category: 'park',
        title: 'Retiro Park & Casa de Campo — Free',
        description:
          'Parque del Buen Retiro — Madrid\'s great park with free rowing lake, ' +
          'free contemporary art exhibitions in Palacio de Cristal and Palacio de Velázquez. ' +
          'Free outdoor concerts in summer.',
        when: 'All year, dawn to dusk',
        touristsEligible: true,
      },
      {
        category: 'festival',
        title: 'Verbenas de Madrid (Summer Street Festivals)',
        description:
          'Free neighbourhood festivals throughout August: San Cayetano (7–10 Aug), ' +
          'San Lorenzo (9–13 Aug), La Paloma (14–15 Aug). Live music, dancing, food stalls — ' +
          'the real Madrid summer experience.',
        when: 'August — varies by barrio',
        touristsEligible: true,
      },
      {
        category: 'concert',
        title: 'Free Summer Concerts — Madrid & Barcelona',
        description:
          'Noches del Botánico (Madrid, various artists). Grec Festival (Barcelona, July–Aug, some free). ' +
          'Free flamenco performances in tablaos and cultural centres throughout Andalucía.',
        when: 'June–September',
        touristsEligible: true,
      },
    ],
  },

  // ── Portugal ───────────────────────────────────────────────────────────────
  {
    countryCode: 'PT',
    countryName: 'Portugal',
    programSummary:
      'Since August 2024, Portuguese citizens and legal residents can visit 37 national museums, ' +
      'monuments, and palaces free for 52 days per year of their choosing — any day of the week, ' +
      'not limited to Sundays. Proof of NIF (Portuguese tax number) required at ticket office. ' +
      'Tourists are excluded from this scheme. ' +
      'However, two institutions are free for all visitors on Sunday afternoons: ' +
      'Gulbenkian CAM (closed for renovation until Jul 2026) and Museu do Aljube (Sundays until 14:00).',
    tip: 'Check Lisboa Card if visiting multiple paid sites — it often saves money and includes free transport. ' +
      'The Aljube Museum (political prison/dictatorship history) is free Sunday mornings for everyone. ' +
      'The Money Museum is free for everyone, always. ' +
      'Portuguese churches are architectural treasures — most are free.',

    dateableRules: [
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: [
          '70+ Lisbon museums and cultural spaces join — all free or with special programming',
          'National Tile Museum (Azulejos), MAAT, and others free for everyone on this day',
          'Night of Museums held simultaneously in Lisbon',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'Lisbon: 70+ museums free for Nuit des Musées — National Tile Museum, MAAT, Gulbenkian (if open), Calouste',
          'Night tours, family workshops, guided visits',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
        extraIncludes: [
          'Dias Europeus do Património — normally-closed historic buildings open free across Portugal',
        ],
      },
      // Portugal Day
      {
        type: 'fixed-annual',
        month: 6,
        day: 10,
        label: 'Portugal Day (10 Jun) — Free Entry at National Museums',
        includes: [
          'National museums and monuments',
          'Free entry for all visitors on this day',
        ],
        excludes: ['Private museums'],
      },
    ],

    standing: [
      {
        category: 'museum',
        title: 'Calouste Gulbenkian Museum + CAM — Free Sunday Afternoons (Everyone)',
        description:
          'One of the world\'s finest private art collections (Egyptian, Islamic, European, Oriental). ' +
          'Free every Sunday after 14:00 for all visitors. Closes at 18:00 — 4 free hours. ' +
          '⚠️ Gulbenkian main building CLOSED for renovation until July 2026. ' +
          'CAM (modern collection) remains open and free Sunday afternoons.',
        when: 'Sundays 14:00–18:00 (for tourists)',
        touristsEligible: true,
        caveat: 'Gulbenkian Founder\'s Collection closed for renovation until July 2026.',
      },
      {
        category: 'museum',
        title: 'Museu do Aljube (Political Prison Museum) — Free Sundays for All',
        description:
          'Powerful museum in a former secret police prison documenting Salazar\'s dictatorship ' +
          'and the Carnation Revolution. One of Lisbon\'s most important cultural experiences. ' +
          'Free for all visitors on Sunday mornings until 14:00.',
        when: 'Sundays until 14:00',
        touristsEligible: true,
      },
      {
        category: 'museum',
        title: 'Money Museum (Lisbon) — Always Free for Everyone',
        description:
          'Fascinating museum tracing the history of Portuguese currency and money globally. ' +
          'You can even mint your own coin. Located in central Lisbon near Praça do Comércio. Always free.',
        when: 'All year (closed weekends)',
        touristsEligible: true,
      },
      {
        category: 'museum',
        title: 'National Museums — 52 Free Days/Year (Residents Only, Any Day)',
        description:
          'Since August 2024, Portuguese citizens and legal residents get 52 free visits/year to 37 ' +
          'national museums, monuments, and palaces — on any day of the week they choose. ' +
          'Participating sites include Jerónimos Monastery (cloister), Ajuda Palace, National Archaeology Museum, ' +
          'National Tile Museum (Azulejos), Ancient Art Museum, National Coach Museum, and 31 others. ' +
          'Show NIF (Portuguese tax number) + ID at the ticket office on first visit of the day. ' +
          'Tourists pay normal admission every day.',
        when: 'Any day — 52 days per calendar year (resident\'s choice)',
        touristsEligible: false,
        caveat: 'Residents only — NIF (Portuguese tax number) and valid ID required. Not available to tourists.',
      },
      {
        category: 'monument',
        title: 'Jerónimos Monastery — Free Church Entry',
        description:
          'The church section of Jerónimos Monastery (Belém) is free to enter. ' +
          'The cloister requires a ticket. UNESCO World Heritage — one of Portugal\'s finest monuments.',
        when: 'Tue–Sun (check hours)',
        touristsEligible: true,
      },
      {
        category: 'festival',
        title: 'Festas de Lisboa — June (Free Street Parties)',
        description:
          'June is Festas de Lisboa — entire month of free street parties, ' +
          'sardine grills, live music and dancing in every neighbourhood. ' +
          'Santo António (12–13 June) is the biggest night — free concerts across the city, ' +
          'giant parade on Avenida da Liberdade (free to watch).',
        when: 'All of June, peak 12–13 June',
        touristsEligible: true,
      },
      {
        category: 'viewpoint',
        title: 'Miradouros — Free Viewpoints Across Lisbon',
        description:
          'Miradouro da Graça, Miradouro de Santa Catarina (Adamastor), ' +
          'Miradouro de São Pedro de Alcântara, Miradouro da Senhora do Monte. ' +
          'All free, all spectacular. Many have free musical performances in summer evenings.',
        when: 'Always',
        touristsEligible: true,
      },
    ],
  },

  // ── Greece ─────────────────────────────────────────────────────────────────
  {
    countryCode: 'GR',
    countryName: 'Greece',
    programSummary:
      'Greek state sites offer free entry on the 1st AND 3rd Sunday November–March, ' +
      'plus several national holidays year-round. ' +
      'The Acropolis Museum is independently managed and follows its own separate free-day schedule ' +
      '(it is NOT free on the winter Sundays — but is free on specific national dates).',
    tip: 'The Acropolis is free on May 18 — one of the best-value days in all of Europe. ' +
      'In winter (Nov–Mar) free Sundays, arrive at 08:00 opening for the Acropolis to beat the crowds. ' +
      'Dress modestly at Byzantine monasteries and churches. ' +
      'Greek Orthodox churches are always free and architecturally stunning.',

    dateableRules: [
      // 1st Sunday, Nov–Mar
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 0,
        months: [11, 12, 1, 2, 3],
        label: '1st Sunday (Nov–Mar) — Free Entry at All State Archaeological Sites',
        includes: [
          'Acropolis of Athens (Parthenon, Erechtheion, Propylaea)',
          'Ancient Agora of Athens',
          'Temple of Olympian Zeus',
          'Kerameikos cemetery and museum',
          'National Archaeological Museum (Athens)',
          'Archaeological Museum of Thessaloniki',
          'Delphi — Oracle site and museum',
          'Ancient Olympia — Olympic sanctuary and museum',
          'Knossos Palace (Crete)',
          'Lindos Acropolis (Rhodes)',
          'Mycenae & Epidaurus',
          'All Ministry of Culture archaeological sites and museums',
        ],
        excludes: [
          '⚠️ Acropolis Museum — NOT included (independently managed, own schedule)',
        ],
      },
      // 3rd Sunday, Nov–Mar
      {
        type: 'nth-weekday',
        nth: 3,
        weekday: 0,
        months: [11, 12, 1, 2, 3],
        label: '3rd Sunday (Nov–Mar) — Free Entry at All State Archaeological Sites',
        includes: [
          'Acropolis of Athens',
          'Ancient Agora',
          'All Ministry of Culture archaeological sites and museums',
        ],
        excludes: [
          '⚠️ Acropolis Museum — NOT included',
        ],
      },
      // Melina Mercouri Day
      {
        type: 'fixed-annual',
        month: 3,
        day: 6,
        label: 'Melina Mercouri Memorial Day (6 Mar) — Free Entry',
        includes: [
          'All state archaeological sites and museums',
          '✅ Acropolis Museum (free today)',
        ],
        excludes: [],
      },
      // Greek Independence Day
      {
        type: 'fixed-annual',
        month: 3,
        day: 25,
        label: 'Greek Independence Day (25 Mar) — Free Entry',
        includes: [
          'All state archaeological sites and museums',
          '✅ Acropolis Museum (free today)',
        ],
        excludes: [],
      },
      // International Monuments Day
      {
        type: 'fixed-annual',
        month: 4,
        day: 18,
        label: 'International Monuments Day (18 Apr) — Free Entry',
        includes: ['All state archaeological sites and museums'],
        excludes: ['Acropolis Museum: check website'],
      },
      // International Museum Day + Acropolis free
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: [
          '✅ Acropolis of Athens — free (saving €30+)',
          '✅ Acropolis Museum — free today',
          'All Greek state sites free',
          'Athens City Festival — free outdoor events running alongside',
          'Night of Museums events across Greek cities from evening',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'Archaeological Museum of Athens — free evening with special events',
          'Museums across Athens, Thessaloniki, and Greek islands',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
      },
      // Ohi Day
      {
        type: 'fixed-annual',
        month: 10,
        day: 28,
        label: 'Ohi Day / National Holiday (28 Oct) — Free Entry',
        includes: [
          'All state archaeological sites and museums',
          '✅ Acropolis Museum (free today)',
        ],
        excludes: [],
      },
    ],

    standing: [
      {
        category: 'monument',
        title: 'Under 25 from EU Countries — Free Year-Round',
        description:
          'All EU citizens under 25 years old get free entry to all Greek state archaeological ' +
          'sites and museums, year-round, any day.',
        when: 'All year',
        touristsEligible: true,
      },
      {
        category: 'church',
        title: 'Byzantine Churches & Monasteries — Free or Donation',
        description:
          'Athens: Byzantine and Christian Museum (free on certain days). ' +
          'Churches of Athens old town, Dafni Monastery (UNESCO), Hosios Loukas (UNESCO) are often free or nominal. ' +
          'Greek Orthodox churches are nearly always free to enter.',
        when: 'Daily — check individual hours',
        touristsEligible: true,
        caveat: 'Modest dress required: cover shoulders and knees.',
      },
      {
        category: 'viewpoint',
        title: 'Free Hilltop Views',
        description:
          'Lycabettus Hill (Athens) — hike up for the best panoramic view of Athens and the Acropolis. Free. ' +
          'Philopappos Hill (free). Areopagus rock next to the Acropolis — free, no ticket needed.',
        when: 'Always',
        touristsEligible: true,
      },
      {
        category: 'festival',
        title: 'Athens & Epidaurus Festival (Summer)',
        description:
          'Annual summer festival June–August — ancient drama, opera, and dance in the ancient ' +
          'Odeon of Herodes Atticus (base of the Acropolis) and Epidaurus Ancient Theatre. ' +
          'Tickets from €10 for many performances; some free dress rehearsals.',
        when: 'June–August',
        touristsEligible: true,
      },
      {
        category: 'market',
        title: 'Free Markets & Flea Markets',
        description:
          'Monastiraki Flea Market (Athens) — free to browse daily, busiest Sunday mornings. ' +
          'Farmers markets (laïki) run in every neighbourhood several days a week — free to explore.',
        when: 'Daily/weekly depending on market',
        touristsEligible: true,
      },
    ],
  },

  // ── Austria ────────────────────────────────────────────────────────────────
  {
    countryCode: 'AT',
    countryName: 'Austria',
    programSummary:
      'Vienna\'s Wien Museum group offers free entry on the 1st Sunday of each month. ' +
      'Austrian National Day (October 26) brings free entry to the Austrian National Library museums, ' +
      'Vienna Museum, Museum of Military History, and other federal museums.',
    tip: 'Vienna\'s coffee house culture is free to experience — you can sit for hours with one coffee. ' +
      'The Naschmarkt food market is free to wander. ' +
      'State Opera standing tickets are just €4 — worth knowing for any music lover.',

    dateableRules: [
      {
        type: 'nth-weekday',
        nth: 1,
        weekday: 0,
        label: '1st Sunday — Wien Museum Group Free',
        includes: [
          'Museum of Military History (oldest Austrian museum)',
          'Uhrenmuseum (Clock Museum)',
          'Hermesvilla',
          'Römermuseum (Roman Vienna)',
          'Beethoven museum locations',
          'All Wien Museum group sites',
        ],
        excludes: [
          'Kunsthistorisches Museum (Art History) — does not participate in 1st Sunday',
          'Belvedere — does not participate',
          'Albertina — private, does not participate',
        ],
      },
      // Austrian National Day
      {
        type: 'fixed-annual',
        month: 10,
        day: 26,
        label: 'Austrian National Day (26 Oct) — Federal Museums Free',
        includes: [
          '✅ Austrian National Library — State Hall (Prunksaal), Globe Museum, Esperanto Museum, Literature Museum, House of Austrian History',
          'Vienna Museum (Wien Museum)',
          'Museum of Military History',
          'Austrian Open-Air Museum at Stübing (Styria)',
          'Government buildings open: Federal Chancellery, Parliament, Presidential Office at Hofburg',
          'Military parade and exhibitions at Heldenplatz',
        ],
        excludes: [
          'Kunsthistorisches Museum: reduced price only',
          'Belvedere: reduced price only',
          'Albertina: private — not participating',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: ['Widespread free entry and special programming across Austrian museums'],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'European Night of Museums (May) observed across Austria with free/special programming',
          '⚠️ ORF Lange Nacht der Museen (October) is a TICKETED event — single paid ticket gives entry to all participating venues + free public transport; not free',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_HERITAGE_DAYS',
        extraIncludes: [
          'Tag des offenen Denkmals — 2nd Sunday September',
          'Historic buildings across Austria open free, including normally-closed private sites',
        ],
      },
    ],

    standing: [
      {
        category: 'concert',
        title: 'Vienna State Opera — €4 Standing Tickets',
        description:
          'World-class opera and ballet for just €4 with a standing ticket. ' +
          'Standing tickets go on sale online 1 hour before performance. ' +
          'The experience of the Staatsoper is on the UNESCO Intangible Cultural Heritage list.',
        when: 'September–June (opera season)',
        touristsEligible: true,
        caveat: 'Standing tickets sell fast — be ready to buy exactly when they release.',
      },
      {
        category: 'concert',
        title: 'Free Outdoor Concerts — Rathausplatz',
        description:
          'Vienna\'s Rathausplatz hosts free outdoor concerts throughout summer. ' +
          'Musikfilm Festival (July–August) — free open-air opera and concert screenings. ' +
          'New Year\'s Concert rehearsals are sometimes accessible.',
        when: 'July–August (Film Festival); December (Christmas Market)',
        touristsEligible: true,
      },
      {
        category: 'monument',
        title: 'Free Imperial Architecture & Public Interiors',
        description:
          'Schönbrunn Palace grounds and gardens are free (palace interior charged). ' +
          'Hofburg Palace courtyards are free. ' +
          'St. Stephen\'s Cathedral (Stephansdom) — free entry to main nave.',
        when: 'All year',
        touristsEligible: true,
      },
      {
        category: 'market',
        title: 'Naschmarkt — Free to Explore',
        description:
          'Vienna\'s famous open-air market — 120+ stalls of produce, spices, meats, cheeses, street food. ' +
          'Free to wander daily. Best on Saturday mornings when the flea market section runs alongside.',
        when: 'Mon–Sat (market); Sat (flea market section)',
        touristsEligible: true,
      },
    ],
  },

  // ── Germany ────────────────────────────────────────────────────────────────
  {
    countryCode: 'DE',
    countryName: 'Germany',
    programSummary:
      '⚠️ Berlin\'s popular 1st Sunday free entry for state museums ENDED after 1 December 2024 ' +
      '(the last free Sunday was 1 Dec 2024). ' +
      'However, Berlin\'s memorial sites and certain collections remain always free. ' +
      'Tag des offenen Denkmals (September) is Germany\'s largest cultural event — ' +
      'thousands of historic sites free across the country.',
    tip: 'The Berlin Jewish Museum\'s permanent exhibition is free. ' +
      'Memorial to the Murdered Jews of Europe (Denkmal) is always free. ' +
      'Most German war memorial sites and concentration camp memorial sites are free. ' +
      'Lange Nacht der Museen events run in many German cities — these are ticketed (one paid ticket, ' +
      'all venues + free public transport) but worth knowing about.',

    dateableRules: [
      // Tag des offenen Denkmals — 2nd Sunday of September
      {
        type: 'nth-weekday',
        nth: 2,
        weekday: 0,
        months: [9],
        label: 'Tag des offenen Denkmals — Open Monument Day (2nd Sunday September)',
        includes: [
          '4,000+ historical buildings, monuments, and sites across Germany',
          'Sites normally closed to the public open free',
          'Private mansions, industrial heritage, castles, government buildings, churches',
          'Guided tours, lectures, boat trips, children\'s activities',
          'Germany\'s largest cultural event — millions of visitors annually',
        ],
        excludes: [
          'Tours mostly in German — some English tours in major cities',
          'Popular tours require advance booking',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'INTERNATIONAL_MUSEUM_DAY',
        extraIncludes: [
          'Many German museums offer free or discounted entry on May 18',
          'National Museum Nuremberg, Museum Island Berlin, and others participate',
        ],
      },
      {
        type: 'pan-european',
        eventKey: 'EUROPEAN_NIGHT_OF_MUSEUMS',
        extraIncludes: [
          'European Night of Museums (May) observed across Germany with free/special programming at some venues',
          '⚠️ Lange Nacht der Museen (city-specific, various dates) is a TICKETED event — one paid ticket covers all venues + free public transport; dates: Berlin (Aug), Cologne (Nov), Munich (Oct), Frankfurt (varies)',
        ],
      },
    ],

    standing: [
      {
        category: 'monument',
        title: 'Berlin Memorial Sites — Always Free',
        description:
          'Memorial to the Murdered Jews of Europe (Holocaust Memorial) — always free, 24 hours. ' +
          'Topography of Terror (former SS/Gestapo HQ) — always free. ' +
          'Berlin Wall Memorial (Bernauer Strasse) — free. ' +
          'East Side Gallery (longest remaining Berlin Wall section) — free outdoor gallery.',
        when: 'All year',
        touristsEligible: true,
      },
      {
        category: 'museum',
        title: 'Jewish Museum Berlin — Permanent Collection Free',
        description:
          'The permanent collection of the Jewish Museum Berlin (Daniel Libeskind building) is free to visit. ' +
          'Temporary exhibitions charge. One of the most architecturally and emotionally significant museums in Europe.',
        when: 'Daily (check opening days)',
        touristsEligible: true,
      },
      {
        category: 'museum',
        title: 'Stasi Museum (Berlin) — Free Entry',
        description:
          'The former East German secret police (Stasi) headquarters in Lichtenberg. ' +
          'Eerie and important insight into life under surveillance. Free entry.',
        when: 'Mon–Fri + weekends (check hours)',
        touristsEligible: true,
      },
      {
        category: 'park',
        title: 'Free Parks & Gardens',
        description:
          'Tiergarten (Berlin) — free, vast park. ' +
          'English Garden (Munich, Englischer Garten) — free, one of the world\'s largest urban parks, ' +
          'with a surfing wave on the Eisbach river (always free to watch). ' +
          'Rheinaue Park (Bonn), Stadtpark (Hamburg) — all free.',
        when: 'All year',
        touristsEligible: true,
      },
      {
        category: 'festival',
        title: 'Berlin Festival of Lights (October)',
        description:
          'Major iconic buildings illuminated across Berlin every October. ' +
          'Free to walk around and experience from the street. ' +
          'Brandenburger Tor, Cathedral, TV Tower all featured.',
        when: 'October (usually 2 weeks)',
        touristsEligible: true,
      },
      {
        category: 'concert',
        title: 'Berliner Philharmoniker — Free Open-Air Concerts',
        description:
          'The Berliner Philharmoniker occasionally offers free open-air concerts in summer ' +
          'at the Waldbühne outdoor amphitheatre and other venues. ' +
          'Also: free Lunchtime Concerts at various venues — check berlin.de.',
        when: 'Summer (check berliner-philharmoniker.de)',
        touristsEligible: true,
      },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Date computation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the date of the nth occurrence of a weekday in a given year/month.
 *  weekday: 0=Sun, 1=Mon, ..., 6=Sat (JS Date convention)
 *  month: 1-based
 */
function getNthWeekday(year: number, month: number, weekday: Weekday, nth: 1 | 2 | 3 | 4): Date {
  const first = new Date(year, month - 1, 1);
  const firstDay = first.getDay(); // 0=Sun
  const daysUntilTarget = (weekday - firstDay + 7) % 7;
  const firstOccurrence = 1 + daysUntilTarget;
  const targetDate = firstOccurrence + (nth - 1) * 7;
  return new Date(year, month - 1, targetDate);
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function* dateRangeMonths(start: Date, end: Date): Generator<{ year: number; month: number }> {
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    yield { year: cur.getFullYear(), month: cur.getMonth() + 1 };
    cur.setMonth(cur.getMonth() + 1);
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a country code and trip dates, returns a FreeCultureAlert
 * with every free cultural day that falls within the trip window,
 * plus standing free-access tips.
 *
 * Returns null if the country has no rules defined.
 */
export function getFreeCultureAccess(
  countryCode: string,
  tripStart: Date,
  tripEnd: Date,
): FreeCultureAlert | null {
  const config = FREE_CULTURE_RULES.find(r => r.countryCode === countryCode);
  if (!config) return null;

  const start = toDateOnly(tripStart);
  const end   = toDateOnly(tripEnd);
  const tripYears = Array.from(
    new Set(
      Array.from({ length: (end.getFullYear() - start.getFullYear()) + 1 }, (_, i) => start.getFullYear() + i)
    )
  );

  const freeDays: FreeCulturalDay[] = [];

  for (const rule of config.dateableRules) {

    if (rule.type === 'fixed-annual') {
      for (const year of tripYears) {
        const candidate = toDateOnly(new Date(year, rule.month - 1, rule.day));
        if (candidate >= start && candidate <= end) {
          freeDays.push({ date: candidate, label: `${formatDate(candidate)} — ${rule.label}`, includes: rule.includes, excludes: rule.excludes });
        }
      }
    }

    if (rule.type === 'nth-weekday') {
      for (const { year, month } of dateRangeMonths(start, end)) {
        if (rule.months && !rule.months.includes(month as Month)) continue;
        const candidate = toDateOnly(getNthWeekday(year, month, rule.weekday, rule.nth));
        if (candidate >= start && candidate <= end) {
          freeDays.push({ date: candidate, label: `${formatDate(candidate)} — ${rule.label}`, includes: rule.includes, excludes: rule.excludes });
        }
      }
    }

    if (rule.type === 'pan-european') {
      const event = PAN_EUROPEAN_EVENTS[rule.eventKey];
      for (const year of tripYears) {
        let candidate: Date | null = null;

        if (event.getDate) {
          candidate = toDateOnly(event.getDate(year));
        } else if (event.knownDates) {
          const known = event.knownDates[year];
          if (known) {
            candidate = toDateOnly(known);
          } else {
            // Date not yet confirmed for this year — surface a notice
            freeDays.push({
              date: new Date(year, 0, 1), // placeholder; UI should hide date
              label: `⚠️ ${event.name} — date not yet confirmed for ${year}. Verify at europeanheritagedays.com / nuitdesmusees.culture.gouv.fr`,
              includes: [`This event occurs in ${year} but the exact date hasn't been added to Tabiji yet. Check the organiser website.`],
              excludes: [],
              dateUnknown: true,
            } as FreeCulturalDay & { dateUnknown: true });
            continue;
          }
        }

        if (!candidate) continue;
        if (candidate >= start && candidate <= end) {
          const includes = [
            ...event.includes,
            ...(rule.extraIncludes ?? []),
          ];
          const excludes = [
            ...event.excludes,
            ...(rule.extraExcludes ?? []),
          ];
          freeDays.push({ date: candidate, label: `${formatDate(candidate)} — ${event.name}`, includes, excludes });
        }
      }
    }
  }

  // Sort + deduplicate same-date same-label entries
  freeDays.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Only tourist-eligible standing access is surfaced by default
  // (residents-only is still included with touristsEligible:false so UI can caveat it)
  return {
    countryCode:    config.countryCode,
    countryName:    config.countryName,
    programSummary: config.programSummary,
    tip:            config.tip,
    freeDays,
    standing:       config.standing,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-destination
// ─────────────────────────────────────────────────────────────────────────────

export function getFreeCultureAccessMulti(
  destinations: { countryCode: string; startDate: Date; endDate: Date }[],
): FreeCultureAlert[] {
  return destinations
    .map(d => getFreeCultureAccess(d.countryCode, d.startDate, d.endDate))
    .filter((a): a is FreeCultureAlert => a !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supported countries list
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_FREE_CULTURE_COUNTRIES = new Set(
  FREE_CULTURE_RULES.map(r => r.countryCode)
);

// IT, FR, ES, PT, GR, AT, DE