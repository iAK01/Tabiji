// Per-category proof requirements for a reimbursable expense — what documents are
// actually needed to get paid back, and when each one realistically exists.
//
// 'booking' phase proofs exist the moment the expense is created (a booking
// confirmation is just the receipt of the purchase). 'after' phase proofs don't
// exist yet at that point — a boarding pass isn't issued until check-in, a final
// hotel folio isn't issued until checkout — so these are empty slots to fill in
// later, not something to gate or nag about early.
export interface ProofSlot {
  key:      string;
  label:    string;
  required: boolean;
  phase:    'booking' | 'after';
  multiple?: boolean; // e.g. one boarding pass per leg on a connecting flight
}

const BOOKING_CONFIRMATION: ProofSlot = { key: 'booking_confirmation', label: 'Booking confirmation', required: true, phase: 'booking' };
const SINGLE_RECEIPT = (label = 'Receipt', required = true): ProofSlot => ({ key: 'receipt', label, required, phase: 'booking' });

// 'car' (personal) isn't proof-checklist shaped at all — it's mileage × rate, or
// fuel receipts, and which one applies depends on the person, not the trip type.
export const CAR_PROOFS_NOT_APPLICABLE = 'car';
export const FUEL_RECEIPT_SLOT: ProofSlot = { key: 'fuel_receipt', label: 'Fuel receipt(s)', required: true, phase: 'booking', multiple: true };

export const EXPENSE_PROOF_REQUIREMENTS: Record<string, ProofSlot[]> = {
  flight: [
    BOOKING_CONFIRMATION,
    { key: 'boarding_pass', label: 'Boarding pass', required: true, phase: 'after', multiple: true },
  ],
  train: [
    BOOKING_CONFIRMATION,
    { key: 'ticket', label: 'Train ticket', required: true, phase: 'after' },
  ],
  bus: [
    BOOKING_CONFIRMATION,
    { key: 'ticket', label: 'Bus ticket', required: true, phase: 'after' },
  ],
  ferry: [
    BOOKING_CONFIRMATION,
    { key: 'boarding_pass', label: 'Boarding pass', required: true, phase: 'after' },
  ],
  car_hire: [
    { key: 'rental_agreement', label: 'Rental agreement', required: true, phase: 'booking' },
    { key: 'final_invoice', label: 'Final invoice', required: true, phase: 'after' },
  ],
  taxi:             [SINGLE_RECEIPT()],
  private_transfer: [SINGLE_RECEIPT()],
  bicycle:          [SINGLE_RECEIPT('Receipt', false)],
  parking:          [SINGLE_RECEIPT()],

  hotel:  [BOOKING_CONFIRMATION, { key: 'final_invoice', label: 'Final invoice / folio', required: true, phase: 'after' }],
  airbnb: [BOOKING_CONFIRMATION, { key: 'final_invoice', label: 'Final invoice / folio', required: true, phase: 'after' }],
  hostel: [BOOKING_CONFIRMATION, { key: 'final_invoice', label: 'Final invoice / folio', required: true, phase: 'after' }],
  camping: [SINGLE_RECEIPT()],

  concert:    [SINGLE_RECEIPT('Receipt / ticket')],
  sports:     [SINGLE_RECEIPT('Receipt / ticket')],
  attraction: [SINGLE_RECEIPT('Receipt / ticket')],
  restaurant: [SINGLE_RECEIPT()],
  conference: [
    SINGLE_RECEIPT('Registration receipt'),
    { key: 'attendance_proof', label: 'Badge / attendance photo', required: false, phase: 'after' },
  ],
  business: [
    SINGLE_RECEIPT('Registration receipt'),
    { key: 'attendance_proof', label: 'Badge / attendance photo', required: false, phase: 'after' },
  ],

  meal:     [SINGLE_RECEIPT()],
  gratuity: [],
  other:    [SINGLE_RECEIPT('Receipt', false)],
};

export function getProofSlots(category: string): ProofSlot[] {
  return EXPENSE_PROOF_REQUIREMENTS[category] ?? [];
}
