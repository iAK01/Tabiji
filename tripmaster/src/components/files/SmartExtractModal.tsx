'use client';

import { useState }        from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Checkbox, CircularProgress, LinearProgress, Alert,
} from '@mui/material';
import AutoFixHighIcon    from '@mui/icons-material/AutoFixHigh';
import HotelIcon          from '@mui/icons-material/Hotel';
import LocationOnIcon     from '@mui/icons-material/LocationOn';
import CalendarTodayIcon  from '@mui/icons-material/CalendarToday';
import DirectionsIcon     from '@mui/icons-material/Directions';

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

interface Located {
  address?: string;
  coordinates?: { lat: number; lng: number } | null;
  addressUnverified?: boolean;
}

export interface ExtractedAccommodation extends Located {
  type: string;
  name: string;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  confirmationNumber?: string | null;
  /** Server-computed: check-in time once flights are accounted for. Display only. */
  checkInHint?: string;
  resolvedCheckInTime?: string;
  notes?: string;
}

export interface ExtractedVenue extends Located {
  type: string;
  name: string;
  date?: string | null;
  time?: string | null;
  notes?: string;
}

export interface ExtractedStop extends Located {
  name: string;
  type: string;
  date: string;
  scheduledStart: string;
  duration: number;
  notes?: string;
}

export interface ExtractedTransport {
  type: string;
  departureLocation?: string;
  arrivalLocation?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  confirmationNumber?: string | null;
  flightNumber?: string | null;
  operator?: string | null;
  notes?: string;
}

export interface ExtractedData {
  accommodation: ExtractedAccommodation[];
  venues: ExtractedVenue[];
  itineraryStops: ExtractedStop[];
  transport: ExtractedTransport[];
}

export interface DocClassification {
  documentType: string;
  summary:      string;
}

// Maps a classified document type → the human label shown in the Files tab.
export const DOC_TYPE_LABEL: Record<string, string> = {
  boarding_pass:      'Boarding pass',
  train_ticket:       'Train / rail ticket',
  hotel_confirmation: 'Accommodation confirmation',
  car_hire:           'Car hire',
  event_brief:        'Event brief / schedule',
  ticket:             'Event ticket',
  reservation:        'Reservation',
  visa:               'Visa',
  insurance:          'Insurance',
  passport:           'Passport copy',
  other:              'Other',
};

interface Props {
  open:     boolean;
  onClose:  () => void;
  tripId:   string;
  data:     ExtractedData;
  filename: string;
  /** When set, the modal can classify + link this file to whatever it creates. */
  fileId?:          string;
  fileCurrentType?: string;
  classification?:  DocClassification | null;
  onFileUpdated?:   (file: any) => void;
}

function fmtDate(d?: string | null) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return d; }
}

function fmtTime(t?: string | null) {
  if (!t) return '';
  // Handle full ISO or bare HH:MM
  const bare = t.includes('T') ? t.split('T')[1]?.slice(0, 5) : t;
  return bare ?? '';
}

function fmtType(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');
}

function transportLabel(t: ExtractedTransport) {
  const route = [t.departureLocation, t.arrivalLocation].filter(Boolean).join(' → ');
  return t.flightNumber || route || fmtType(t.type || 'transport');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, color, children }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontFamily: D.display, fontSize: '0.78rem', color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ border: '1.5px solid rgba(44,62,80,0.08)', borderRadius: 2, overflow: 'hidden', backgroundColor: 'white' }}>
        {children}
      </Box>
    </Box>
  );
}

function CheckItem({ checked, onChange, primary, secondary, note, highlight }: {
  checked: boolean; onChange: (v: boolean) => void;
  primary: string; secondary?: string; note?: string; highlight?: string;
}) {
  return (
    <Box
      onClick={() => onChange(!checked)}
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1,
        px: 1.5, py: 1.25, cursor: 'pointer',
        opacity: checked ? 1 : 0.45,
        transition: 'opacity 0.15s',
        '&:not(:last-child)': { borderBottom: '1px solid rgba(44,62,80,0.06)' },
        '&:hover': { backgroundColor: 'rgba(107,124,92,0.05)' },
      }}
    >
      <Checkbox
        checked={checked}
        onChange={e => { e.stopPropagation(); onChange(e.target.checked); }}
        size="small"
        sx={{ p: 0, pt: 0.25, flexShrink: 0, color: D.green, '&.Mui-checked': { color: D.green } }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem', color: D.navy, lineHeight: 1.3 }}>
          {primary}
        </Typography>
        {secondary && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
            {secondary}
          </Typography>
        )}
        {highlight && (
          <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.74rem', color: D.green, lineHeight: 1.4, mt: 0.25 }}>
            {highlight}
          </Typography>
        )}
        {note && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.disabled', lineHeight: 1.4 }}>
            {note}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function SmartExtractModal({
  open, onClose, tripId, data, filename,
  fileId, fileCurrentType, classification, onFileUpdated,
}: Props) {
  const allAccomm = data.accommodation    ?? [];
  const allVenues = data.venues           ?? [];
  const allStops  = data.itineraryStops   ?? [];
  const allTrans  = data.transport        ?? [];

  const [selAccomm, setSelAccomm] = useState<boolean[]>(() => allAccomm.map(() => true));
  const [selVenues, setSelVenues] = useState<boolean[]>(() => allVenues.map(() => true));
  const [selStops,  setSelStops]  = useState<boolean[]>(() => allStops.map(() => true));
  const [selTrans,  setSelTrans]  = useState<boolean[]>(() => allTrans.map(() => true));
  const [importing, setImporting] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [done,      setDone]      = useState<{ ok: number; failed: string[]; filed?: boolean } | null>(null);

  // File classification + linking (only when opened from a file card / upload)
  const suggestedType = classification?.documentType && classification.documentType !== 'other'
    ? classification.documentType
    : null;
  const canSetType = !!fileId && !!suggestedType && suggestedType !== fileCurrentType;
  const [setType,  setSetType]  = useState(canSetType);
  const [linkFile, setLinkFile] = useState(!!fileId);

  const selectedCount =
    selAccomm.filter(Boolean).length +
    selVenues.filter(Boolean).length +
    selStops.filter(Boolean).length +
    selTrans.filter(Boolean).length;

  const isEmpty = allAccomm.length === 0 && allVenues.length === 0 && allStops.length === 0 && allTrans.length === 0;

  async function handleImport() {
    setImporting(true);
    setProgress(0);
    let ok = 0;
    const failed: string[] = [];
    const step = () => setProgress(p => p + 1);

    // Track the last successful create per category so we can link the file to it.
    let accomLog: any = null, venueLog: any = null, transLog: any = null;

    for (let i = 0; i < allAccomm.length; i++) {
      if (!selAccomm[i]) continue;
      const a = allAccomm[i];
      try {
        const res = await fetch(`/api/trips/${tripId}/logistics/accommodation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: a.type || 'hotel', name: a.name,
            address: a.address ?? '', coordinates: a.coordinates ?? null,
            checkIn: a.checkIn ?? '', checkOut: a.checkOut ?? '',
            checkInTime: a.checkInTime ?? '', checkOutTime: a.checkOutTime ?? '',
            confirmationNumber: a.confirmationNumber ?? '',
            notes: a.notes ?? '', status: 'confirmed',
          }),
        });
        if (res.ok) { ok++; accomLog = (await res.json().catch(() => ({}))).logistics ?? accomLog; }
        else failed.push(a.name);
      } catch { failed.push(a.name); }
      step();
    }

    for (let i = 0; i < allVenues.length; i++) {
      if (!selVenues[i]) continue;
      const v = allVenues[i];
      try {
        const res = await fetch(`/api/trips/${tripId}/logistics/venues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: v.type || 'other', name: v.name, address: v.address ?? '', coordinates: v.coordinates ?? null, date: v.date ?? '', time: v.time ?? '', notes: v.notes ?? '', status: 'confirmed' }),
        });
        if (res.ok) { ok++; venueLog = (await res.json().catch(() => ({}))).logistics ?? venueLog; }
        else failed.push(v.name);
      } catch { failed.push(v.name); }
      step();
    }

    // Ensure itinerary is initialised before adding stops
    if (selStops.some(Boolean)) {
      await fetch(`/api/trips/${tripId}/itinerary`).catch(() => {});
    }

    for (let i = 0; i < allStops.length; i++) {
      if (!selStops[i]) continue;
      const s = allStops[i];
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary/stops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayDate: s.date,
            stop: {
              name:           s.name,
              type:           s.type || 'other',
              scheduledStart: s.scheduledStart,
              duration:       s.duration || 60,
              address:        s.address ?? '',
              coordinates:    s.coordinates ?? null,
              notes:          s.notes   ?? '',
              source:         'imported',
            },
          }),
        });
        res.ok ? ok++ : failed.push(s.name);
      } catch { failed.push(s.name); }
      step();
    }

    for (let i = 0; i < allTrans.length; i++) {
      if (!selTrans[i]) continue;
      const t = allTrans[i];
      const label = transportLabel(t);
      try {
        const res = await fetch(`/api/trips/${tripId}/logistics/transport`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type:               t.type || 'flight',
            status:             'confirmed',
            departureLocation:  t.departureLocation ?? '',
            arrivalLocation:    t.arrivalLocation   ?? '',
            departureTime:      t.departureTime     ?? '',
            arrivalTime:        t.arrivalTime       ?? '',
            confirmationNumber: t.confirmationNumber ?? '',
            notes:              t.notes ?? '',
            details: {
              flightNumber: t.flightNumber ?? '',
              operator:     t.operator ?? '',
            },
          }),
        });
        if (res.ok) { ok++; transLog = (await res.json().catch(() => ({}))).logistics ?? transLog; }
        else failed.push(label);
      } catch { failed.push(label); }
      step();
    }

    // ── Classify + link the source file ─────────────────────────────────────
    let filed = false;
    if (fileId && (setType || linkFile)) {
      const patch: Record<string, any> = {};
      if (setType && suggestedType) patch.type = suggestedType;

      if (linkFile) {
        const pick = (log: any, key: string, coll: string) => {
          const arr = log?.[key];
          if (!Array.isArray(arr) || !arr.length) return null;
          const idx = arr.length - 1;
          return { collection: coll, entryId: String(idx), label: arr[idx]?.name || transportLabel(arr[idx] ?? {} as any) || coll };
        };
        const target =
          pick(accomLog, 'accommodation', 'accommodation') ??
          pick(transLog, 'transportation', 'transport') ??
          pick(venueLog, 'venues', 'venue');
        if (target) patch.linkedTo = target;
      }

      if (Object.keys(patch).length) {
        try {
          const r = await fetch(`/api/trips/${tripId}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (r.ok) { filed = true; onFileUpdated?.((await r.json().catch(() => ({}))).file); }
        } catch { /* non-fatal */ }
      }
    }

    setImporting(false);
    setDone({ ok, failed, filed });
  }

  return (
    <Dialog
      open={open}
      onClose={() => !importing && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundColor: D.paper, borderRadius: 2.5 } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <AutoFixHighIcon sx={{ color: D.green, fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Smart Extract
            </Typography>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.73rem', color: 'text.secondary' }}>
              {filename}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2 }}>
        {done ? (
          <Alert
            severity={done.failed.length === 0 ? 'success' : 'warning'}
            sx={{ fontFamily: D.body, fontSize: '0.85rem' }}
          >
            {done.ok > 0
              ? <>Added {done.ok} item{done.ok !== 1 ? 's' : ''} to your trip — check the Logistics and Itinerary tabs.</>
              : <>Nothing was added.</>}
            {done.filed && <> The file’s been filed and linked.</>}
            {done.failed.length > 0 && (
              <> Couldn’t add: {done.failed.join(', ')}. These may fall outside the trip dates.</>
            )}
          </Alert>
        ) : (
          <>
            {classification?.summary && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: 'rgba(107,124,92,0.08)' }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700, color: D.green, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  Looks like
                </Typography>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', color: D.navy, lineHeight: 1.45 }}>
                  {classification.summary}
                </Typography>
              </Box>
            )}

            {(canSetType || !!fileId) && (
              <Box sx={{ mb: 2 }}>
                {canSetType && (
                  <CheckItem
                    checked={setType}
                    onChange={setSetType}
                    primary={`Set document type → ${DOC_TYPE_LABEL[suggestedType!] ?? suggestedType}`}
                    secondary={fileCurrentType && fileCurrentType !== 'other' ? `currently: ${DOC_TYPE_LABEL[fileCurrentType] ?? fileCurrentType}` : undefined}
                  />
                )}
                {!!fileId && !isEmpty && (
                  <CheckItem
                    checked={linkFile}
                    onChange={setLinkFile}
                    primary="Link this file to what I add"
                    secondary="so it surfaces when you need it on the trip"
                  />
                )}
              </Box>
            )}

            {isEmpty ? (
              <Alert severity={canSetType ? 'info' : 'warning'} sx={{ fontFamily: D.body, fontSize: '0.85rem' }}>
                {canSetType
                  ? 'No hotels, venues, schedule or transport to import — but the document type can still be set above.'
                  : 'Nothing to import — no hotels, venues, schedule or transport were found.'}
              </Alert>
            ) : (
            <>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
              Select what to import into your trip.
            </Typography>

            {allAccomm.length > 0 && (
              <Section title={`Accommodation · ${allAccomm.length}`} icon={<HotelIcon sx={{ fontSize: 15 }} />} color={D.navy}>
                {allAccomm.map((a, i) => (
                  <CheckItem
                    key={i}
                    checked={selAccomm[i]}
                    onChange={v => setSelAccomm(p => { const n = [...p]; n[i] = v; return n; })}
                    primary={a.name}
                    secondary={[
                      fmtType(a.type),
                      a.checkIn && a.checkOut ? `${fmtDate(a.checkIn)} → ${fmtDate(a.checkOut)}` : fmtDate(a.checkIn),
                      a.address,
                    ].filter(Boolean).join(' · ')}
                    highlight={a.checkInHint}
                    note={[a.addressUnverified && '⚠ address not found — add it after import', a.notes].filter(Boolean).join(' · ')}
                  />
                ))}
              </Section>
            )}

            {allVenues.length > 0 && (
              <Section title={`Venues · ${allVenues.length}`} icon={<LocationOnIcon sx={{ fontSize: 15 }} />} color={D.terra}>
                {allVenues.map((v, i) => (
                  <CheckItem
                    key={i}
                    checked={selVenues[i]}
                    onChange={val => setSelVenues(p => { const n = [...p]; n[i] = val; return n; })}
                    primary={v.name}
                    secondary={[fmtType(v.type), v.address].filter(Boolean).join(' · ')}
                    note={[fmtDate(v.date), fmtTime(v.time), v.addressUnverified && '⚠ address not found', v.notes].filter(Boolean).join(' · ')}
                  />
                ))}
              </Section>
            )}

            {allStops.length > 0 && (
              <Section title={`Schedule · ${allStops.length}`} icon={<CalendarTodayIcon sx={{ fontSize: 15 }} />} color={D.green}>
                {allStops.map((s, i) => (
                  <CheckItem
                    key={i}
                    checked={selStops[i]}
                    onChange={val => setSelStops(p => { const n = [...p]; n[i] = val; return n; })}
                    primary={s.name}
                    secondary={[fmtType(s.type), fmtDate(s.date), fmtTime(s.scheduledStart)].filter(Boolean).join(' · ')}
                    note={[s.address, s.addressUnverified && '⚠ address not found', s.notes].filter(Boolean).join(' · ')}
                  />
                ))}
              </Section>
            )}

            {allTrans.length > 0 && (
              <Section title={`Transport · ${allTrans.length}`} icon={<DirectionsIcon sx={{ fontSize: 15 }} />} color={D.navy}>
                {allTrans.map((t, i) => (
                  <CheckItem
                    key={i}
                    checked={selTrans[i]}
                    onChange={val => setSelTrans(p => { const n = [...p]; n[i] = val; return n; })}
                    primary={transportLabel(t)}
                    secondary={[fmtType(t.type), fmtDate(t.departureTime?.split('T')[0]), fmtTime(t.departureTime)].filter(Boolean).join(' · ')}
                    note={[t.confirmationNumber ? `Ref ${t.confirmationNumber}` : '', t.operator, t.notes].filter(Boolean).join(' · ')}
                  />
                ))}
              </Section>
            )}
            </>
            )}
          </>
        )}
      </DialogContent>

      {importing && (
        <Box sx={{ px: 3, pb: 1 }}>
          <LinearProgress
            variant={selectedCount ? 'determinate' : 'indeterminate'}
            value={selectedCount ? Math.round((progress / selectedCount) * 100) : undefined}
            sx={{ borderRadius: 1, height: 5, backgroundColor: 'rgba(107,124,92,0.15)',
              '& .MuiLinearProgress-bar': { backgroundColor: D.green } }}
          />
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
            Adding {Math.min(progress + 1, selectedCount)} of {selectedCount}…
          </Typography>
        </Box>
      )}

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={importing}
          sx={{ fontFamily: D.body, fontWeight: 600 }}
        >
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && (selectedCount > 0 || (setType && canSetType)) && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing}
            startIcon={importing ? <CircularProgress size={15} color="inherit" /> : <AutoFixHighIcon />}
            sx={{
              fontFamily: D.body, fontWeight: 700,
              backgroundColor: D.green,
              '&:hover': { backgroundColor: '#5a6b4e' },
              '&.Mui-disabled': { backgroundColor: 'rgba(107,124,92,0.3)' },
            }}
          >
            {importing
              ? 'Working…'
              : selectedCount > 0
                ? `Add ${selectedCount} & file`
                : 'File this'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
