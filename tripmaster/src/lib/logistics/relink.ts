import TripFile from '@/lib/mongodb/models/TripFile';
import TripExpense from '@/lib/mongodb/models/TripExpense';

export type BookingKind = 'transport' | 'accommodation' | 'venue';

// Resources and expenses point at a booking by its position. Removing one moves
// every later booking up a place, so their links move with them; what pointed at
// the removed booking stays in Resources / Expenses, unlinked, its label kept.
export async function relinkAfterRemoval(tripId: string, collection: BookingKind, index: number) {
  for (const Model of [TripFile, TripExpense] as any[]) {
    const docs = await Model.find({ tripId, 'linkedTo.collection': collection }, '_id linkedTo').lean();
    const ops: any[] = [];
    for (const d of docs) {
      const at = Number(d.linkedTo?.entryId);
      if (!Number.isInteger(at) || at < index) continue;
      const filter = { _id: d._id, 'linkedTo.entryId': String(at) };
      ops.push(at === index
        ? { updateOne: { filter, update: { $unset: { 'linkedTo.collection': '', 'linkedTo.entryId': '' } } } }
        : { updateOne: { filter, update: { $set: { 'linkedTo.entryId': String(at - 1) } } } });
    }
    if (ops.length) await Model.bulkWrite(ops);
  }
}
