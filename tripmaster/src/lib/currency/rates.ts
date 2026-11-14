// Mid-market exchange rates from ExchangeRate-API's open access endpoint: free, no
// key, 160+ currencies (the ECB-based free feeds have no MAD, EGP, VND, KES…),
// updated once a day. Its terms ask for a "Rates by Exchange Rate API" credit
// wherever the rates are shown — see components/currency/CurrencyConverter.
const SOURCE = 'https://open.er-api.com/v6/latest/';
export const RATES_CREDIT = { label: 'Rates by Exchange Rate API', href: 'https://www.exchangerate-api.com' };

const HOUR_MS = 60 * 60_000;
const DAY_MS  = 24 * HOUR_MS;

export interface RateTable {
  base:  string;
  rates: Record<string, number>;   // units of each currency to 1 of base
  asOf:  number;                   // ms: when the provider last updated them
}

// Per server instance. The provider says when its next update is due, so each base
// is asked for about once a day (it rate-limits callers that ask much more often).
const held = new Map<string, { table: RateTable; until: number }>();

export async function rateTable(base: string): Promise<RateTable | null> {
  if (!/^[A-Z]{3}$/.test(base)) return null;
  const hit = held.get(base);
  if (hit && Date.now() < hit.until) return hit.table;
  try {
    const res = await fetch(SOURCE + base, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.result !== 'success' || data.base_code !== base || !data.rates || typeof data.rates !== 'object') {
      throw new Error('Unexpected response');
    }
    const rates: Record<string, number> = {};
    for (const [code, v] of Object.entries(data.rates)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) rates[code] = v;
    }
    const asOf = Number(data.time_last_update_unix) * 1000;
    const next = Number(data.time_next_update_unix) * 1000;
    const now  = Date.now();
    const table: RateTable = { base, rates, asOf: Number.isFinite(asOf) ? asOf : now };
    held.set(base, { table, until: Math.min(now + DAY_MS, Math.max(now + HOUR_MS, Number.isFinite(next) ? next : 0)) });
    return table;
  } catch {
    // Provider unreachable: the last table this instance had, however old (asOf says how old)
    return hit?.table ?? null;
  }
}
