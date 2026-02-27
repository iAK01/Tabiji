// data/visa-rules.js
// Keyed by passport/nationality country code → destination country code
// Add new passport nationalities as additional top-level keys
// Data reflects requirements as of early 2026 — verify before travel for critical trips

export const visaRules = {

  // ─── Irish passport (IE) ───────────────────────────────────────────────────
  'IE': {

    // ── Europe (EU/EEA/Schengen — all free movement) ──
    'AT': { required: false, type: 'none', maxStay: '90 days', notes: 'EU free movement — no restrictions' },
    'BE': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'BG': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'HR': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'CZ': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'DK': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'EE': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'FI': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'FR': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'DE': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'GR': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'HU': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'IS': { required: false, type: 'none', maxStay: '90 days', notes: 'EEA — visa-free for Irish passport holders' },
    'IT': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'LV': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'LT': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'LU': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'MT': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'NL': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'NO': { required: false, type: 'none', maxStay: '90 days', notes: 'EEA — visa-free for Irish passport holders' },
    'PL': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'PT': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'RO': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'SK': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'SI': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'ES': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'SE': { required: false, type: 'none', maxStay: 'Unlimited', notes: 'EU free movement — no restrictions' },
    'CH': { required: false, type: 'none', maxStay: '90 days', notes: 'Schengen agreement — visa-free for Irish passport holders' },

    // ── United Kingdom (Common Travel Area) ──
    'GB': {
      required: false,
      type: 'none',
      maxStay: 'Unlimited',
      notes: 'Common Travel Area (CTA) — Irish citizens have right to live and work in UK. Passport recommended but not strictly required.'
    },

    // ── North America ──
    'CA': {
      required: true,
      type: 'eta',
      name: 'eTA (Electronic Travel Authorisation)',
      cost: 'CAD $7',
      processingTime: 'Usually minutes, allow 72 hours',
      applyUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html',
      maxStay: '6 months',
      notes: 'Must be linked to passport before flying. Apply online before travel — do not leave until day of flight.'
    },
    'MX': {
      required: false,
      type: 'none',
      maxStay: '180 days',
      notes: 'No visa required for Irish passport holders. Immigration card (FMM) issued on arrival — keep it, you\'ll need it on departure.'
    },
    'US': {
      required: true,
      type: 'esta',
      name: 'ESTA (Electronic System for Travel Authorisation)',
      cost: 'USD $21',
      processingTime: '72 hours recommended (can be instant)',
      applyUrl: 'https://esta.cbp.dhs.gov',
      maxStay: '90 days',
      notes: 'Apply at least 72 hours before travel. Valid for 2 years or until passport expires. Only for tourism, transit, or short business — not for working.'
    },

    // ── Asia Pacific ──
    'AU': {
      required: true,
      type: 'evisitor',
      name: 'eVisitor (Subclass 651)',
      cost: 'Free',
      processingTime: 'Usually instant, allow 24 hours',
      applyUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/evisitor-651',
      maxStay: '3 months per visit (12-month multiple entry)',
      notes: 'Free online application — must be approved before boarding. Do not assume it\'s automatic.'
    },
    'CN': {
      required: true,
      type: 'visa',
      name: 'Chinese Tourist Visa (L Visa)',
      cost: '~€50–80',
      processingTime: '4–7 working days',
      applyUrl: 'https://www.visaforchina.cn',
      maxStay: '30–90 days depending on visa',
      notes: 'Apply at Chinese Visa Application Service Centre in Dublin. Book appointment online. Bring photos, bank statements, hotel bookings, return flight. 144-hour visa-free transit available in some cities.'
    },
    'HK': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders visiting Hong Kong'
    },
    'IN': {
      required: true,
      type: 'evisa',
      name: 'e-Visa (e-Tourist Visa)',
      cost: 'USD $25–80 depending on duration',
      processingTime: '72 hours recommended',
      applyUrl: 'https://indianvisaonline.gov.in/evisa',
      maxStay: '30, 90, or 365 days depending on e-Visa type',
      notes: 'Apply online at least 4 days before travel. Print confirmation to show on arrival. Double-entry e-Visa also available.'
    },
    'ID': {
      required: true,
      type: 'voa',
      name: 'Visa on Arrival (VoA) or e-VOA',
      cost: 'IDR 500,000 (~€30)',
      processingTime: 'On arrival (or apply e-VOA online in advance)',
      applyUrl: 'https://molina.imigrasi.go.id',
      maxStay: '30 days (extendable once for 30 days)',
      notes: 'e-VOA online is faster and avoids queues at the airport. Extendable at immigration office in Bali/Jakarta.'
    },
    'JP': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders. Japan is strict on overstays — depart on time.'
    },
    'MY': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders visiting Malaysia'
    },
    'NZ': {
      required: true,
      type: 'nzeta',
      name: 'NZeTA (New Zealand Electronic Travel Authority)',
      cost: 'NZD $23 (app) or NZD $17 (online) + NZD $35 International Visitor Conservation and Tourism Levy',
      processingTime: '72 hours recommended',
      applyUrl: 'https://www.immigration.govt.nz/new-zealand-visas/apply-for-a-visa/about-visa/nzeta',
      maxStay: '90 days',
      notes: 'Apply via NZeTA app or online before travel. The conservation levy is mandatory and separate from the eTA fee.'
    },
    'PH': {
      required: false,
      type: 'none',
      maxStay: '30 days',
      notes: 'No visa for first 30 days. Extendable at Bureau of Immigration for up to 36 months total. Must have onward/return ticket.'
    },
    'SG': {
      required: false,
      type: 'none',
      maxStay: '30 days',
      notes: 'No visa required. Extensions possible but rarely needed for short visits.'
    },
    'KR': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders. K-ETA requirement suspended for Irish citizens until further notice — confirm before travel.'
    },
    'TW': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders visiting Taiwan'
    },
    'TH': {
      required: false,
      type: 'none',
      maxStay: '60 days',
      notes: 'Visa exemption extended to 60 days for Irish passport holders (increased from 30 days in 2024). Extendable at immigration office for further 30 days.'
    },
    'VN': {
      required: true,
      type: 'evisa',
      name: 'e-Visa',
      cost: 'USD $25',
      processingTime: '3 working days',
      applyUrl: 'https://evisa.xuatnhapcanh.gov.vn',
      maxStay: '90 days (single or multiple entry)',
      notes: 'Apply online before travel. e-Visa covers most entry points. Irish passport holders previously eligible for 45-day visa-free — now e-Visa is standard route.'
    },

    // ── Middle East & Africa ──
    'EG': {
      required: true,
      type: 'voa',
      name: 'Visa on Arrival or e-Visa',
      cost: 'USD $25',
      processingTime: 'On arrival or apply online via e-Visa portal',
      applyUrl: 'https://visa2egypt.gov.eg',
      maxStay: '30 days',
      notes: 'e-Visa recommended to avoid airport queues. Single or multiple entry available. Have USD cash as backup for on-arrival payment.'
    },
    'IL': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required. Israeli border control can ask detailed questions — have accommodation and itinerary details ready. Entry stamp may affect travel to some Arab countries.'
    },
    'JO': {
      required: true,
      type: 'voa',
      name: 'Visa on Arrival or Jordan Pass',
      cost: 'JOD 40 single entry (included free in Jordan Pass)',
      processingTime: 'On arrival',
      applyUrl: 'https://www.jordanpass.jo',
      maxStay: '30 days',
      notes: 'Jordan Pass (from JOD 70) includes visa + Petra entry + 40+ attractions and is almost always better value. Buy before arrival.'
    },
    'KE': {
      required: true,
      type: 'evisa',
      name: 'e-Visa (eTA)',
      cost: 'USD $30',
      processingTime: '3 working days',
      applyUrl: 'https://www.etakenya.go.ke',
      maxStay: '90 days',
      notes: 'Kenya moved to e-Visa system in 2024. Apply online before travel — no longer available on arrival. Print approval letter.'
    },
    'MA': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders visiting Morocco'
    },
    'ZA': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required. Passport must have at least 30 days validity beyond departure and at least one blank page for entry stamp.'
    },
    'AE': {
      required: false,
      type: 'none',
      maxStay: '30 days',
      notes: 'Visa on arrival granted free to Irish passport holders. Extendable to 90 days total at immigration. Must have return/onward ticket and proof of accommodation.'
    },

    // ── South America ──
    'AR': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders. Reciprocity fee abolished.'
    },
    'BR': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'Brazil restored visa-free access for Irish/EU passport holders. No pre-registration required.'
    },
    'CL': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required for Irish passport holders visiting Chile'
    },
    'CO': {
      required: false,
      type: 'none',
      maxStay: '90 days',
      notes: 'No visa required. Registration with Migración Colombia on arrival — straightforward process.'
    },
    'PE': {
      required: false,
      type: 'none',
      maxStay: '183 days',
      notes: 'No visa required for Irish passport holders. One of the most generous allowances for tourists.'
    }
  },

  // ─── Placeholder structure for additional nationalities ───────────────────
  // Add 'DE', 'FR', 'US', 'GB', etc. as additional keys following the same pattern
  // Each key should map to the same 59 destination countries

};

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Get visa requirement for a specific passport → destination pair
 * Returns null if no data available for this passport nationality
 */
export function getVisaRequirement(passportCountryCode, destinationCountryCode) {
  const passportRules = visaRules[passportCountryCode];
  if (!passportRules) return null; // nationality not yet in database

  const requirement = passportRules[destinationCountryCode];
  if (!requirement) return null; // destination not found for this passport

  return requirement;
}

/**
 * Check if visa rules exist for a given passport nationality
 */
export function hasVisaDataForPassport(passportCountryCode) {
  return !!visaRules[passportCountryCode];
}

/**
 * Get a user-friendly status for display
 * Returns: 'none' | 'eta' | 'evisa' | 'voa' | 'visa' | 'unknown'
 */
export function getVisaStatus(passportCountryCode, destinationCountryCode) {
  const req = getVisaRequirement(passportCountryCode, destinationCountryCode);
  if (!req) return 'unknown';
  if (!req.required) return 'none';
  return req.type;
}