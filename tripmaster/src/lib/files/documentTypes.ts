// The single source of truth for TripFile `type` values on uploaded documents.
// Used by the Files tab dropdown, Smart Extract classification, and the model enum.

export interface DocType {
  value: string;
  label: string;
  /** How Smart Extract should route this document's contents. */
  extract:
    | 'transport'       // → Logistics · Transport
    | 'accommodation'   // → Logistics · Accommodation
    | 'events'          // → Itinerary stops (+ venues)
    | 'everything'      // a whole-trip document — pull all four groups
    | 'reference';      // personal / admin doc — classify + file, import nothing unless it plainly contains a booking
}

export const DOCUMENT_TYPE_GROUPS: { group: string; types: DocType[] }[] = [
  {
    group: 'Transport',
    types: [
      { value: 'flight_booking',   label: 'Flight booking / e-ticket',        extract: 'transport' },
      { value: 'boarding_pass',    label: 'Boarding pass',                    extract: 'transport' },
      { value: 'train_ticket',     label: 'Rail ticket',                      extract: 'transport' },
      { value: 'bus_ticket',       label: 'Bus / coach ticket',               extract: 'transport' },
      { value: 'ferry_ticket',     label: 'Ferry ticket',                     extract: 'transport' },
      { value: 'car_hire',         label: 'Car hire',                        extract: 'transport' },
      { value: 'airport_transfer', label: 'Airport transfer booking',         extract: 'transport' },
      { value: 'airport_parking',  label: 'Airport parking booking',          extract: 'transport' },
      { value: 'rail_pass',        label: 'Rail pass (Interrail / Eurail)',    extract: 'reference' },
    ],
  },
  {
    group: 'Accommodation',
    types: [
      { value: 'hotel_confirmation', label: 'Accommodation confirmation',     extract: 'accommodation' },
    ],
  },
  {
    group: 'Events & activities',
    types: [
      { value: 'event_brief',       label: 'Event brief / schedule',          extract: 'events' },
      { value: 'ticket',            label: 'Event ticket',                    extract: 'events' },
      { value: 'attraction_ticket', label: 'Attraction / museum ticket',      extract: 'events' },
      { value: 'tour_voucher',      label: 'Tour / excursion voucher',        extract: 'events' },
      { value: 'reservation',       label: 'Reservation (restaurant, tour…)',  extract: 'events' },
    ],
  },
  {
    group: 'Entry & ID',
    types: [
      { value: 'passport',             label: 'Passport copy',                extract: 'reference' },
      { value: 'visa',                 label: 'Visa',                         extract: 'reference' },
      { value: 'travel_authorization', label: 'ESTA / eTA / ETIAS',           extract: 'reference' },
      { value: 'driving_permit',       label: 'International Driving Permit',  extract: 'reference' },
      { value: 'invitation_letter',    label: 'Letter of invitation',         extract: 'reference' },
    ],
  },
  {
    group: 'Health & insurance',
    types: [
      { value: 'insurance',   label: 'Travel insurance',                      extract: 'reference' },
      { value: 'vaccination', label: 'Vaccination / health certificate',      extract: 'reference' },
      { value: 'medical',     label: 'Prescription / medical letter',         extract: 'reference' },
    ],
  },
  {
    group: 'Trip reference',
    types: [
      { value: 'trip_itinerary',     label: 'Master itinerary / trip plan',   extract: 'everything' },
      { value: 'emergency_contacts', label: 'Emergency contacts sheet',       extract: 'reference' },
    ],
  },
  {
    group: 'Money & work',
    types: [
      { value: 'receipt',         label: 'Invoice / receipt',                 extract: 'reference' },
      { value: 'travel_approval', label: 'Travel approval / authorization',   extract: 'reference' },
    ],
  },
  {
    group: 'Other',
    types: [
      { value: 'other', label: 'Other', extract: 'everything' },
    ],
  },
];

export const DOCUMENT_TYPES: DocType[] = DOCUMENT_TYPE_GROUPS.flatMap(g => g.types);

export const DOCUMENT_TYPE_VALUES: string[] = DOCUMENT_TYPES.map(t => t.value);

export const DOC_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(DOCUMENT_TYPES.map(t => [t.value, t.label]));

export const DOC_TYPE_EXTRACT: Record<string, DocType['extract']> =
  Object.fromEntries(DOCUMENT_TYPES.map(t => [t.value, t.extract]));
