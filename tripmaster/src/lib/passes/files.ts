// What scanning an uploaded image adds to its TripFile: the barcode, and for a
// boarding pass, the link to the flight it's for — when nobody linked it, or it
// was added to a different flight than the one it says (the return flight's
// card, say). Plus the "Boarding pass" type when it was filed as Other. Server only.

import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import { scanTicket } from './scan';
import { legMatches, transportForPass } from './bcbp';
import { ticketLinkLabel } from './passes';

export { SCANNABLE_MIME } from './scan';

export async function barcodeFields(
  image:   Uint8Array,
  file:    { type?: string; linkedTo?: { collection?: string; entryId?: string } | null },
  tripId:  string,
): Promise<Record<string, any>> {
  const fields: Record<string, any> = { barcodeScannedAt: new Date() };
  const found = await scanTicket(image);
  if (!found) return fields;
  fields.barcode = found;
  const bcbp = found.bcbp;
  if (!bcbp) return fields;

  if (!file.type || file.type === 'other') fields.type = 'boarding_pass';

  const collection = file.linkedTo?.collection;
  if (collection && collection !== 'transport') return fields;
  const logistics = await TripLogistics.findOne({ tripId }, 'transportation').lean() as any;
  const transport = logistics?.transportation ?? [];
  const linked    = collection ? transport[Number(file.linkedTo?.entryId)] : null;
  if (linked && bcbp.legs.some(l => legMatches(l, linked))) return fields;

  const i = transportForPass(bcbp, transport);
  if (i !== null) fields.linkedTo = { collection: 'transport', entryId: String(i), label: ticketLinkLabel(transport[i]) };
  return fields;
}
