// ─── Intelligence shared types ────────────────────────────────────────────────

export interface Phrase {
  id:       string;
  english:  string;
  local:    string;
  phonetic: string;
  usage:    string;
  context:  string;
}

export interface Intelligence {
  destination: { country: string; countryCode: string; city?: string };
  electrical: {
    needsAdapter:    boolean;
    originPlug:      string;
    destinationPlug: string;
    adapterType:     string | null;
    message:         string;
  } | null;
  currency: {
    needsExchange:       boolean;
    originCurrency:      string;
    destinationCurrency: string;
    destinationSymbol:   string;
    message:             string;
  } | null;
  language: {
    sameLanguage:             boolean;
    destinationLanguage:      string;
    destinationLanguageLocal: string | null;
    phrasesAvailable:         boolean;
    essentialPhrases:         Phrase[];
    allPhrases:               Phrase[];
    message:                  string;
  };
  timezone: {
    destinationTimezone: string;
    hoursDifference:     number;
    absDifference:       number;
    jetlagRisk:          'none' | 'mild' | 'moderate' | 'significant';
    direction:           string;
    message:             string;
  };
  emergency: { number: string; country: string; message: string };
  driving: {
    destinationSide: string;
    originSide:      string;
    sameAshome:      boolean;
    message:         string;
  } | null;
  passport: {
    expiry:        string;
    daysAtTravel:  number;
    isWarning:     boolean;
    isExpired:     boolean;
    message:       string;
  } | null;
  visa: {
    available:       boolean;
    required?:       boolean;
    type?:           string;
    typeLabel?:      string;
    name?:           string | null;
    cost?:           string | null;
    processingTime?: string | null;
    applyUrl?:       string | null;
    maxStay?:        string;
    notes?:          string;
    message:         string;
  } | null;
  tipping: {
    culture:     string;
    restaurants: string;
    taxis:       string;
    hotels:      string;
    notes:       string;
    message:     string;
  } | null;
  water: {
    drinkable: boolean;
    notes:     string;
    message:   string;
  } | null;
  payment: {
    cashCulture: string;
    contactless: boolean;
    notes:       string;
    message:     string;
  } | null;
  cultural: {
    dressCode: string;
    notes:     string;
    message:   string;
  } | null;
}

// ─── Culture / Discover types ─────────────────────────────────────────────────

export interface CultureHighlight {
  name:         string;
  description:  string;
  type:         string;
  category:     'cultural' | 'coffee' | 'park';
  tip?:         string;
  free?:        boolean;
  address?:     string;
  coordinates?: { lat: number; lng: number };
  nearVenue?:   string;
}

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

export interface FreeDay {
  date:         Date | string;
  label:        string;
  includes:     string[];
  excludes:     string[];
  dateUnknown?: boolean;
}

export interface StandingAccess {
  title:             string;
  description:       string;
  when?:             string;
  touristsEligible?: boolean;
  caveat?:           string;
}

export interface FreeAccess {
  freeDays: FreeDay[];
  standing: StandingAccess[];
  summary?: string | null;
  tip?:     string | null;
}

export interface CultureData {
  briefing:    CultureBriefing | null;
  freeAccess:  FreeAccess | null;
  generatedAt: string | null;
}

export interface ItineraryDay {
  date:      string;
  dayNumber: number;
  stops:     any[];
}