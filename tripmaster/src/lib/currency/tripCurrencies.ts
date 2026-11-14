import { COUNTRY_LIST, COUNTRY_META, getCountryName } from '@/lib/data/countries';
import { ymd } from '@/lib/trips/presence';

type Place = { country?: string | null; countryCode?: string | null; currency?: string | null } | null | undefined;

export interface TripCurrency {
  code:    string;                                   // ISO 4217
  country: string;
  spans:   { from: string; to: string }[];           // YYYY-MM-DD, the dates you're there with it
}

function countryCodeOf(place: Place): string | null {
  const code = place?.countryCode?.toUpperCase();
  if (code && COUNTRY_META[code]) return code;
  const name = place?.country?.trim().toLowerCase();
  return name ? COUNTRY_LIST.find(c => c.name.toLowerCase() === name)?.code ?? null : null;
}

// Only currencies we actually know for the country — never a guessed default
function currencyOf(place: Place): string | null {
  const code = countryCodeOf(place);
  if (code) return COUNTRY_META[code].currency;
  const stored = place?.currency?.toUpperCase();
  return stored && /^[A-Z]{3}$/.test(stored) ? stored : null;
}

/** The traveller's own currency: home in the profile, else where the trip leaves from. */
export function homeCurrency(user: { homeLocation?: Place }, trip: { origin?: Place }): string | null {
  return currencyOf(user.homeLocation) ?? currencyOf(trip.origin);
}

/** Each currency the trip's destinations use other than `home`, in trip order. */
export function tripCurrencies(trip: any, home: string): TripCurrency[] {
  const stops = [
    { place: trip.destination, from: ymd(trip.startDate), to: ymd(trip.endDate) },
    ...(trip.additionalDestinations ?? []).map((d: any) => ({ place: d, from: ymd(d.arrivalDate), to: ymd(d.departureDate) })),
  ];
  const out: TripCurrency[] = [];
  for (const { place, from, to } of stops) {
    const code = currencyOf(place);
    if (!code || code === home) continue;
    let entry = out.find(c => c.code === code);
    if (!entry) {
      const cc = countryCodeOf(place);
      entry = { code, country: place?.country || (cc ? getCountryName(cc) : code), spans: [] };
      out.push(entry);
    }
    if (from && to) entry.spans.push({ from, to });
  }
  return out;
}
