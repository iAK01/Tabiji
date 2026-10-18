import { isOffline } from '@/lib/offline/connectivity';
import { refreshSavedData } from '@/lib/offline/warm';
import { readSaved, SaveError } from '@/lib/offline/saveErrors';
import { passFileName, ticketDocType, ticketLinkLabel } from './passes';

/** Fired on window (detail: tripId) when scanning found new passes — views showing passes reload. */
export const PASSES_CHANGED = 'tabiji:passes-changed';

const SCANNABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

// A pass screenshot added straight to its booking: filed under the right type
// and name, linked to the booking. The server reads the barcode (and moves it
// to the flight it's really for, if that's another one). Can't wait for signal
// — the barcode is read on upload — so offline it fails, and the caller keeps
// the picked files for a retry.
export async function uploadPass(tripId: string, index: number, t: any, image: File): Promise<any> {
  if (isOffline()) throw new SaveError('You’re offline');
  const fd = new FormData();
  fd.append('resourceType', 'file');
  fd.append('file', image);
  fd.append('name', passFileName(t));
  fd.append('type', ticketDocType(t));
  fd.append('linkedTo', JSON.stringify({ collection: 'transport', entryId: String(index), label: ticketLinkLabel(t) }));
  const { file } = await readSaved<{ file: any }>(await fetch(`/api/trips/${tripId}/files`, { method: 'POST', body: fd }));
  refreshSavedData(tripId);
  if (file?.barcode) window.dispatchEvent(new CustomEvent(PASSES_CHANGED, { detail: tripId }));
  return file;
}

// Screenshots uploaded before scanning existed: have the server look at them
// once, then refresh the offline copy and anything showing passes.
export async function scanPendingPasses(tripId: string, files: any[]): Promise<void> {
  const pending = files.some(f => f.resourceType === 'file' && SCANNABLE.has(f.mimeType) && !f.barcodeScannedAt);
  if (!pending || isOffline()) return;
  try {
    const res = await fetch(`/api/trips/${tripId}/passes`, { method: 'POST' });
    if (!res.ok) return;
    const { found } = await res.json();
    refreshSavedData(tripId);
    if (found) window.dispatchEvent(new CustomEvent(PASSES_CHANGED, { detail: tripId }));
  } catch { /* tried again next time the trip opens */ }
}
