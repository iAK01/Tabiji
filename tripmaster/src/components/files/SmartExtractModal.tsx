'use client';

import { useState }        from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Checkbox, CircularProgress, Alert,
} from '@mui/material';
import AutoFixHighIcon    from '@mui/icons-material/AutoFixHigh';
import HotelIcon          from '@mui/icons-material/Hotel';
import LocationOnIcon     from '@mui/icons-material/LocationOn';
import CalendarTodayIcon  from '@mui/icons-material/CalendarToday';

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

export interface ExtractedAccommodation {
  type: string;
  name: string;
  address?: string;
  notes?: string;
}

export interface ExtractedVenue {
  type: string;
  name: string;
  address?: string;
  date?: string | null;
  time?: string | null;
  notes?: string;
}

export interface ExtractedStop {
  name: string;
  type: string;
  date: string;
  scheduledStart: string;
  duration: number;
  address?: string;
  notes?: string;
}

export interface ExtractedData {
  accommodation: ExtractedAccommodation[];
  venues: ExtractedVenue[];
  itineraryStops: ExtractedStop[];
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  tripId:   string;
  data:     ExtractedData;
  filename: string;
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

function CheckItem({ checked, onChange, primary, secondary, note }: {
  checked: boolean; onChange: (v: boolean) => void;
  primary: string; secondary?: string; note?: string;
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

export default function SmartExtractModal({ open, onClose, tripId, data, filename }: Props) {
  const allAccomm = data.accommodation    ?? [];
  const allVenues = data.venues           ?? [];
  const allStops  = data.itineraryStops   ?? [];

  const [selAccomm, setSelAccomm] = useState<boolean[]>(() => allAccomm.map(() => true));
  const [selVenues, setSelVenues] = useState<boolean[]>(() => allVenues.map(() => true));
  const [selStops,  setSelStops]  = useState<boolean[]>(() => allStops.map(() => true));
  const [importing, setImporting] = useState(false);
  const [done,      setDone]      = useState<{ ok: number; failed: string[] } | null>(null);

  const selectedCount =
    selAccomm.filter(Boolean).length +
    selVenues.filter(Boolean).length +
    selStops.filter(Boolean).length;

  const isEmpty = allAccomm.length === 0 && allVenues.length === 0 && allStops.length === 0;

  async function handleImport() {
    setImporting(true);
    let ok = 0;
    const failed: string[] = [];

    for (let i = 0; i < allAccomm.length; i++) {
      if (!selAccomm[i]) continue;
      const a = allAccomm[i];
      try {
        const res = await fetch(`/api/trips/${tripId}/logistics/accommodation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: a.type || 'hotel', name: a.name, address: a.address ?? '', notes: a.notes ?? '', status: 'confirmed' }),
        });
        res.ok ? ok++ : failed.push(a.name);
      } catch { failed.push(a.name); }
    }

    for (let i = 0; i < allVenues.length; i++) {
      if (!selVenues[i]) continue;
      const v = allVenues[i];
      try {
        const res = await fetch(`/api/trips/${tripId}/logistics/venues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: v.type || 'other', name: v.name, address: v.address ?? '', date: v.date ?? '', time: v.time ?? '', notes: v.notes ?? '', status: 'confirmed' }),
        });
        res.ok ? ok++ : failed.push(v.name);
      } catch { failed.push(v.name); }
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
              notes:          s.notes   ?? '',
              source:         'imported',
            },
          }),
        });
        res.ok ? ok++ : failed.push(s.name);
      } catch { failed.push(s.name); }
    }

    setImporting(false);
    setDone({ ok, failed });
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
            {done.ok} item{done.ok !== 1 ? 's' : ''} imported successfully.
            {done.failed.length > 0 && (
              <> Could not add: {done.failed.join(', ')}. These may fall outside the trip dates.</>
            )}
          </Alert>
        ) : isEmpty ? (
          <Alert severity="warning" sx={{ fontFamily: D.body, fontSize: '0.85rem' }}>
            No structured data was found in this document.
          </Alert>
        ) : (
          <>
            {!done && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
                Select what to import into your trip.
              </Typography>
            )}

            {allAccomm.length > 0 && (
              <Section title={`Accommodation · ${allAccomm.length}`} icon={<HotelIcon sx={{ fontSize: 15 }} />} color={D.navy}>
                {allAccomm.map((a, i) => (
                  <CheckItem
                    key={i}
                    checked={selAccomm[i]}
                    onChange={v => setSelAccomm(p => { const n = [...p]; n[i] = v; return n; })}
                    primary={a.name}
                    secondary={[fmtType(a.type), a.address].filter(Boolean).join(' · ')}
                    note={a.notes}
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
                    note={[fmtDate(v.date), fmtTime(v.time), v.notes].filter(Boolean).join(' · ')}
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
                    note={[s.address, s.notes].filter(Boolean).join(' · ')}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={importing}
          sx={{ fontFamily: D.body, fontWeight: 600 }}
        >
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && !isEmpty && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            startIcon={importing ? <CircularProgress size={15} color="inherit" /> : <AutoFixHighIcon />}
            sx={{
              fontFamily: D.body, fontWeight: 700,
              backgroundColor: D.green,
              '&:hover': { backgroundColor: '#5a6b4e' },
              '&.Mui-disabled': { backgroundColor: 'rgba(107,124,92,0.3)' },
            }}
          >
            {importing ? 'Importing…' : `Import ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
