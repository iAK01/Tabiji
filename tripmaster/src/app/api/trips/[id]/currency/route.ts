import { NextResponse } from 'next/server';
import { ownedTrip } from '@/lib/auth/ownedTrip';
import { homeCurrency, tripCurrencies } from '@/lib/currency/tripCurrencies';
import { rateTable } from '@/lib/currency/rates';

// ─── GET /api/trips/[id]/currency ─────────────────────────────────────────────
// What the currency converter needs: your home currency, each currency the trip's
// destinations use that isn't it, and today's mid-market rate for each (units of
// that currency to 1 of home). No other currency on the trip: currencies is empty
// and the converter stays hidden. Rates unavailable: 502, so the service worker
// answers with the last copy it saved — the converter works offline from that.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedTrip(id);
  if (owned.error) return owned.error;
  const { trip, user } = owned;

  const home       = homeCurrency(user, trip);
  const currencies = home ? tripCurrencies(trip, home) : [];
  if (!home || currencies.length === 0) return NextResponse.json({ home, currencies: [], rates: null, asOf: null });

  const table = await rateTable(home);
  const rates: Record<string, number> = {};
  for (const c of currencies) if (table?.rates[c.code]) rates[c.code] = table.rates[c.code];
  if (!table || Object.keys(rates).length === 0) {
    return NextResponse.json({ home, currencies, rates: null, asOf: null }, { status: 502 });
  }
  return NextResponse.json({ home, currencies, rates, asOf: table.asOf });
}
