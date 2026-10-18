'use client';

// Adds a pass straight to its booking: tap, pick the screenshot from Photos,
// done — several at once for several travellers. When the result isn't simply
// the pass (nothing to scan in the image, or it was another flight's pass),
// it says so underneath; a failed upload keeps the pictures for Retry.

import { useRef, useState } from 'react';
import { Box, Button, ButtonBase, CircularProgress, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { uploadPass } from '@/lib/passes/client';
import { addPassLabel, legFlight } from '@/lib/passes/passes';
import { SaveError, reportCantSave } from '@/lib/offline/saveErrors';
import { isOffline } from '@/lib/offline/connectivity';
import { D } from '@/components/logistics/logistics.helpers';

interface AddPassButtonProps {
  tripId:   string;
  index:    number;           // the booking, in logistics.transportation
  t:        any;
  onAdded:  (files: any[]) => void;
  variant?: 'tile' | 'text';  // tile on a booking, text inside the pass view
}

function failure(err: unknown): string {
  if (isOffline() || err instanceof TypeError) return 'You’re offline — try again when you have signal.';
  if (err instanceof SaveError && err.status === 401) return 'You’ve been signed out — sign in again, then retry.';
  return 'Couldn’t upload it. Please try again.';
}

export default function AddPassButton({ tripId, index, t, onAdded, variant = 'tile' }: AddPassButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy,  setBusy]  = useState(false);
  const [kept,  setKept]  = useState<File[]>([]);       // what didn't upload, for Retry
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const add = async (images: File[]) => {
    if (!images.length) return;
    setBusy(true); setError(null); setNotes([]);
    const added: any[] = [];
    const left: File[] = [];
    let lastErr: unknown = null;
    for (const image of images) {
      try { added.push(await uploadPass(tripId, index, t, image)); }
      catch (err) { left.push(image); lastErr = err; }
    }
    setBusy(false);
    setKept(left);

    const next: string[] = [];
    const unread = added.filter(f => !f.barcode).length;
    if (unread) next.push(unread === 1
      ? 'No barcode found in that picture — it’s attached as a document.'
      : `No barcode found in ${unread} pictures — they’re attached as documents.`);
    for (const f of added) {
      const leg = f.barcode?.bcbp?.legs?.[0];
      if (leg && f.linkedTo?.entryId !== String(index)) next.push(`That’s the pass for ${legFlight(leg, t?.departureTime)} — added it there.`);
    }
    setNotes(next);

    if (left.length) {
      const msg = failure(lastErr);
      setError(left.length < images.length ? `${left.length} of ${images.length} didn’t upload. ${msg}` : msg);
      // The rest landed, so this button may be about to give way to the pass — say it app-wide too.
      if (added.length) reportCantSave(`${left.length} of ${images.length} passes didn’t upload. ${msg}`);
    }
    if (added.length) onAdded(added);
  };

  const reading = (t?.type || 'flight') === 'flight' ? 'Reading pass…' : 'Reading ticket…';
  const label   = busy ? reading : addPassLabel(t);
  const icon  = busy ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <AddIcon sx={{ fontSize: '1.2rem' }} />;

  return (
    <Box>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />
      {variant === 'tile' ? (
        <ButtonBase
          disabled={busy}
          onClick={() => input.current?.click()}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.25, width: '100%',
            minHeight: 48, px: 1.5, borderRadius: 2, border: '1.5px dashed rgba(29,38,66,0.22)',
            color: D.navy, fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem',
          }}
        >
          {icon}{label}
        </ButtonBase>
      ) : (
        <ButtonBase
          disabled={busy}
          onClick={() => input.current?.click()}
          sx={{ minHeight: 44, px: 2, gap: 1, borderRadius: 2, color: 'text.secondary', fontFamily: D.body, fontWeight: 600, fontSize: '0.85rem' }}
        >
          {icon}{busy ? label : 'Add another'}
        </ButtonBase>
      )}

      {notes.map(n => (
        <Typography key={n} sx={{ mt: 0.75, fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary' }}>{n}</Typography>
      ))}
      {error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', fontWeight: 700, color: 'error.main' }}>{error}</Typography>
          {kept.length > 0 && (
            <Button size="small" onClick={() => add(kept)} disabled={busy} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}>
              Retry
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
