// Shared between ExpensesTab.tsx and LogisticsTab.tsx (the "reimbursable?" prompt on
// booking forms) — one definition of these enums, not two that can drift apart.
//
// Matches the actual Logistics type granularity (transport/accommodation/venue
// subtypes) rather than the coarse buckets this used to collapse into — a train and
// a taxi need different proof documents, so they can't share one "transport" bucket.
export const EXPENSE_CATEGORIES = [
  { value: 'flight',           label: 'Flight',            group: 'Transport' },
  { value: 'train',            label: 'Train',             group: 'Transport' },
  { value: 'bus',              label: 'Bus',               group: 'Transport' },
  { value: 'ferry',            label: 'Ferry',             group: 'Transport' },
  { value: 'car',              label: 'Car (personal)',    group: 'Transport' },
  { value: 'car_hire',         label: 'Car hire',          group: 'Transport' },
  { value: 'taxi',             label: 'Taxi',              group: 'Transport' },
  { value: 'private_transfer', label: 'Private transfer',  group: 'Transport' },
  { value: 'bicycle',          label: 'Bicycle',           group: 'Transport' },
  { value: 'parking',          label: 'Parking',           group: 'Transport' },
  { value: 'hotel',            label: 'Hotel',             group: 'Accommodation' },
  { value: 'airbnb',           label: 'Airbnb',            group: 'Accommodation' },
  { value: 'hostel',           label: 'Hostel',            group: 'Accommodation' },
  { value: 'camping',          label: 'Camping',           group: 'Accommodation' },
  { value: 'concert',          label: 'Concert / Gig',     group: 'Venue' },
  { value: 'conference',       label: 'Conference',        group: 'Venue' },
  { value: 'restaurant',       label: 'Restaurant',        group: 'Venue' },
  { value: 'sports',           label: 'Sports',            group: 'Venue' },
  { value: 'attraction',       label: 'Attraction',        group: 'Venue' },
  { value: 'business',         label: 'Business',          group: 'Venue' },
  { value: 'meal',             label: 'Meal',              group: 'Other' },
  { value: 'gratuity',         label: 'Gratuity',          group: 'Other' },
  { value: 'other',            label: 'Other',             group: 'Other' },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];

export const EXPENSE_PAYERS = [
  { value: 'personal',    label: 'Personal' },
  { value: 'company',     label: 'Company' },
  { value: 'promoter',    label: 'Promoter' },
  { value: 'client',      label: 'Client' },
  { value: 'third_party', label: 'Third party' },
  { value: 'tbc',         label: 'TBC' },
];

export const EXPENSE_STATUSES = ['captured', 'confirmed', 'submitted', 'paid'];

// Trip-level real names (set via Edit Trip — often unknown until then) for the
// payer categories that can vary trip-to-trip. Company is included too — not
// assumed constant across trips, some users invoice through different entities
// depending on the trip.
const TRIP_NAME_FIELD: Partial<Record<string, 'companyName' | 'promoterName' | 'clientName' | 'thirdPartyName'>> = {
  company:     'companyName',
  promoter:    'promoterName',
  client:      'clientName',
  third_party: 'thirdPartyName',
};

export interface TripPayerNames {
  companyName?:    string;
  promoterName?:   string;
  clientName?:     string;
  thirdPartyName?: string;
}

export function getPayerLabel(value: string, trip?: TripPayerNames | null): string {
  const field = TRIP_NAME_FIELD[value];
  const name  = field ? trip?.[field] : undefined;
  return name || EXPENSE_PAYERS.find(p => p.value === value)?.label || value;
}

// True if this payer type has a real name slot but it hasn't been filled in yet —
// used to show the "set it via Edit Trip" nudge without being noisy about payer
// types (personal/tbc) that don't have one at all.
export function payerNameMissing(value: string, trip?: TripPayerNames | null): boolean {
  const field = TRIP_NAME_FIELD[value];
  return !!field && !trip?.[field];
}
