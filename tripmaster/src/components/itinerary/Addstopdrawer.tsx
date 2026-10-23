'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField,
  IconButton, Collapse, Drawer,
} from '@mui/material';
import { alpha }          from '@mui/material/styles';
import CloseIcon          from '@mui/icons-material/Close';
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore';
import FlightIcon         from '@mui/icons-material/Flight';
import HotelIcon          from '@mui/icons-material/Hotel';
import EventIcon          from '@mui/icons-material/Event';
import AddressSearch      from '@/components/ui/AddressSearch';
import type { ResolvedAddress } from '@/components/ui/AddressSearch';
import {
  STOP_CONFIG, QUICK_ADD_TYPES, DEFAULT_DURATIONS, D,
} from './Itinerary.config';
import type { Stop, KnownLocation } from './Itinerary.config';
import { stopDuration, fmtDuration } from './Itinerary.helpers';
import { clockMinutes, NIGHT_ENDS_MIN } from '@/lib/itinerary/nights';
import { REMINDER_OPTIONS, stopLeadMins } from '@/lib/push/leads';

interface Props {
  open:           boolean;
  onClose:        () => void;
  // Each resolves true once saved or queued offline; false means it failed (and has
  // already been undone and reported), so the drawer stays open with the input.
  onAdd:          (stop: Partial<Stop>) => Promise<boolean>;
  onUpdate:       (stop: Partial<Stop>) => Promise<boolean>;
  onDelete?:      () => Promise<boolean>;
  defaultTime:    string;
  defaultType:    string;
  /** The reminder a stop of this type gets without its own (trip setting, then yours, then by type). */
  inheritedLeadFor?: (type: string) => number | null;
  editStop?:      Stop;
  isMobile:       boolean;
  knownLocations: KnownLocation[];
  // An early-hours time on a day's page means either that date's morning or,
  // after midnight, the night running on from it. Labels for the two dates; null
  // when there's no choice (the trip's last day).
  nightDates?:    { morning: string; afterMidnight: string } | null;
  // Which of the two is pre-selected for a start (minutes after midnight)
  nightDefault?:  (mins: number) => boolean;
}

// Which known location a stop is at. Rooms/stages at one venue all geocode to the
// same street address, so the address alone can't tell them apart: prefer the
// saved chip name, then a lone address match, then the room named in notes/name.
function resolveLocationName(stop: Stop, locs: KnownLocation[]): string {
  if (stop.locationName) return stop.locationName;
  if (!stop.address) return '';
  const sameAddress = locs.filter(l => (l.address ?? l.label) === stop.address);
  if (sameAddress.length === 1) return sameAddress[0].label;
  const text = `${stop.name ?? ''} ${stop.notes ?? ''}`.toLowerCase();
  const named = sameAddress
    .filter(l => text.includes(l.label.toLowerCase()))
    .sort((a, b) => b.label.length - a.label.length);   // "Film Room (Sala…)" over "Film Room"
  return named[0]?.label ?? '';
}

// Adaptive placeholder for the reference field based on stop name
function referencePlaceholder(name: string): string {
  const n = name.toLowerCase();
  if (/train|rail|intercit|tgv|eurostar|ice |db |sncf|thalys|avlo|renfe|trenitalia/.test(n)) return 'Platform · Carriage · Seat';
  if (/uber|taxi|bolt|lyft|free\s*now|cab|chauffeur|grab/.test(n)) return 'Booking code · Driver name';
  if (/bus|coach|flixbus|megabus|greyhound|national express/.test(n)) return 'Bay · Platform · Seat';
  if (/ferry|boat|vessel|cruise|stena|irish ferries/.test(n)) return 'Berth · Cabin · Deck';
  if (/tram|metro|tube|subway|luas|dart|mrt|brt|s-bahn|u-bahn/.test(n)) return 'Direction · Platform';
  if (/car hire|rental|hertz|avis|europcar|sixt|enterprise|budget/.test(n)) return 'Pickup point · Booking ref';
  return 'Platform · Seat · Ref';
}

export function AddStopDrawer({
  open, onClose, onAdd, onUpdate, onDelete,
  defaultTime, defaultType, inheritedLeadFor, editStop,
  isMobile, knownLocations, nightDates = null, nightDefault,
}: Props) {
  const isEditing   = !!editStop;
  const isFromLogistics = editStop?.source === 'logistics';

  const NOTIFY_OPTIONS = REMINDER_OPTIONS;

  const [form, setForm] = useState({
    name:                  '',
    type:                  defaultType,
    scheduledStart:        defaultTime,
    duration:              60,
    reference:             '',
    notes:                 '',
    address:               '',
    locationName:          '',
    coordinates:           undefined as { lat: number; lng: number } | undefined,
    // undefined = follow the trip / your default; only sent once picked
    notificationLeadMins:  undefined as number | null | undefined,
    lateNight:             undefined as boolean | undefined,   // picked here; else nightDefault
  });
  const [saving,       setSaving]       = useState(false);
  const [showExtras,   setShowExtras]   = useState(false);
  const [showAllLocs,  setShowAllLocs]  = useState(false);

  useEffect(() => {
    if (editStop) {
      const timeStr = editStop.scheduledStart
        ? editStop.scheduledStart.includes('T')
          ? editStop.scheduledStart.split('T')[1]?.slice(0, 5) ?? defaultTime
          : editStop.scheduledStart
        : defaultTime;
      setForm({
        name:                 editStop.name ?? '',
        type:                 editStop.type ?? defaultType,
        scheduledStart:       timeStr,
        duration:             stopDuration(editStop),
        reference:            editStop.reference ?? '',
        notes:                editStop.notes ?? '',
        address:              editStop.address ?? '',
        locationName:         resolveLocationName(editStop, knownLocations),
        coordinates:          editStop.coordinates,
        // Its own setting if it has one (Off stays off), else it follows the default
        notificationLeadMins: editStop.notificationLeadMins,
        lateNight:            undefined,
      });
      setShowExtras(!!(editStop.notes || editStop.address));
    } else {
      setForm({
        name:                 '',
        type:                 defaultType,
        scheduledStart:       defaultTime,
        duration:             DEFAULT_DURATIONS[defaultType] ?? 60,
        reference:            '',
        notes:                '',
        address:              '',
        locationName:         '',
        coordinates:          undefined,
        notificationLeadMins: undefined,
        lateNight:            undefined,
      });
      setShowExtras(false);
    }
  }, [defaultTime, defaultType, editStop, open, knownLocations]);

  const handleAddressChange = (result: ResolvedAddress | null) => {
    setForm(f => ({
      ...f,
      address:      result?.address     ?? '',
      locationName: '',
      coordinates:  result?.coordinates ?? undefined,
      name: f.name || result?.address?.split(',')[0] || f.name,
    }));
  };

  const handleLocationChip = (loc: KnownLocation) => {
    setForm(f => ({ ...f, address: loc.address ?? loc.label, locationName: loc.label, coordinates: loc.coordinates }));
  };

  const adjustDuration = (delta: number) => {
    setForm(f => ({
      ...f,
      duration: Math.max(15, Math.min(480, f.duration + delta)),
    }));
  };

  // Before 06:00: this date's early hours, or after midnight at the end of its night
  const startMins  = clockMinutes({ scheduledStart: form.scheduledStart });
  const earlyHours = startMins !== null && startMins < NIGHT_ENDS_MIN;
  const offerNight = earlyHours && !!nightDates && !isFromLogistics;
  const lateNight  = offerNight && (form.lateNight ?? nightDefault?.(startMins) ?? false);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const stop = { ...form, lateNight: earlyHours ? lateNight : null };
      const saved = isEditing
        ? await onUpdate({ ...editStop, ...stop })
        : await onAdd(stop);
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!onDelete || saving) return;
    setSaving(true);
    try {
      if (await onDelete()) onClose();
    } finally {
      setSaving(false);
    }
  };

  const cfg = STOP_CONFIG[form.type] ?? STOP_CONFIG.other;

  // A big extracted programme can mean a dozen rooms/stages — show a handful,
  // always including the selected one.
  const LOC_COLLAPSED  = 6;
  const locCollapsible = knownLocations.length > LOC_COLLAPSED + 1;
  const shownLocs = !locCollapsible || showAllLocs
    ? knownLocations
    : knownLocations.filter((l, i) => i < LOC_COLLAPSED || l.label === form.locationName);

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ── Scrollable body — the CTA below stays put however long this gets ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mx: -0.5, px: 0.5 }}>

        {/* ── Header ── */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', mb: 2,
        }}>
          <Box>
            <Typography sx={{
              fontFamily: D.display, fontSize: '1rem',
              color: D.navy, lineHeight: 1,
            }}>
              {isEditing ? 'Edit stop' : 'Add to day'}
            </Typography>
            {isFromLogistics && (
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.68rem', color: D.muted, mt: 0.4, lineHeight: 1.3,
              }}>
                From Logistics — your timing is kept when bookings change.
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ p: 0.75, color: D.muted }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* ── Name — the primary field, front and centre ── */}
        <TextField
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter' && form.name.trim()) submit(); }}
          autoFocus={!isMobile}
          placeholder="What's happening?"
          variant="standard"
          fullWidth
          InputProps={{
            disableUnderline: false,
            sx: {
              fontFamily:  D.display,
              fontSize:    isMobile ? '1.5rem' : '1.35rem',
              color:       D.navy,
              lineHeight:  1.2,
              pb:          0.5,
            },
          }}
          sx={{
            mb: 2.5,
            '& .MuiInput-root:before': { borderColor: D.rule },
            '& .MuiInput-root:after':  { borderColor: cfg.color },
          }}
        />

        {/* ── Type grid — 4 per row, emoji + label ── */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0.75,
          mb: 2.5,
        }}>
          {QUICK_ADD_TYPES.map(t => {
            const c        = STOP_CONFIG[t];
            const isActive = form.type === t;
            return (
              <Box
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t, duration: DEFAULT_DURATIONS[t] ?? 60 }))}
                sx={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            0.4,
                  py:             isMobile ? 1.1 : 0.9,
                  px:             0.5,
                  borderRadius:   '10px',
                  border:         `1.5px solid ${isActive ? c.color : alpha(D.navy, 0.10)}`,
                  backgroundColor: isActive ? alpha(c.color, 0.10) : 'transparent',
                  cursor:         'pointer',
                  transition:     'all 0.12s',
                  '&:hover': {
                    backgroundColor: alpha(c.color, 0.07),
                    borderColor:     alpha(c.color, 0.4),
                  },
                  '&:active': { transform: 'scale(0.96)' },
                }}
              >
                <c.Icon sx={{ fontSize: isMobile ? '1.4rem' : '1.2rem', color: isActive ? c.color : D.muted }} />
                <Typography sx={{
                  fontFamily:    D.body,
                  fontSize:      '0.6rem',
                  fontWeight:    isActive ? 800 : 500,
                  color:         isActive ? c.color : D.muted,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight:    1,
                  textAlign:     'center',
                }}>
                  {c.label.replace(/^\S+\s*/, '') || c.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* ── Transport reference (platform, seat, booking code, etc.) ── */}
        {form.type === 'transport' && (
          <TextField
            value={form.reference}
            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            placeholder={referencePlaceholder(form.name)}
            label="Platform / Seat / Ref"
            variant="outlined"
            size="small"
            fullWidth
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                fontFamily: D.body,
                fontSize: '0.95rem',
                '& fieldset': { borderColor: '#0369a1' },
                '&:hover fieldset': { borderColor: '#0369a1' },
                '&.Mui-focused fieldset': { borderColor: '#0369a1' },
              },
              '& .MuiInputLabel-root': { color: '#0369a1', fontFamily: D.body, fontSize: '0.85rem' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#0369a1' },
            }}
            InputProps={{
              sx: {
                backgroundColor: 'rgba(3,105,161,0.04)',
              },
            }}
          />
        )}

        {/* ── Time + Duration row ── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, alignItems: 'flex-end' }}>

          {/* Time picker */}
          <TextField
            label="Time"
            type="time"
            value={form.scheduledStart}
            onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
            InputProps={{ sx: { fontFamily: D.body, fontSize: '1rem' } }}
          />

          {/* Duration stepper */}
          <Box sx={{
            flex: 1,
            border: `1px solid rgba(0,0,0,0.23)`,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 0.5,
            height: 56,
          }}>
            <IconButton
              onClick={() => adjustDuration(-15)}
              disabled={form.duration <= 15}
              sx={{ p: 0.75, color: D.navy }}
            >
              <Typography sx={{ fontFamily: D.body, fontSize: '1.2rem', lineHeight: 1, fontWeight: 700 }}>−</Typography>
            </IconButton>

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{
                fontFamily: D.display,
                fontSize:   '1rem',
                color:      D.navy,
                lineHeight: 1,
              }}>
                {fmtDuration(form.duration)}
              </Typography>
              <Typography sx={{
                fontFamily:    D.body,
                fontSize:      '0.58rem',
                color:         D.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                mt:            0.3,
              }}>
                Duration
              </Typography>
            </Box>

            <IconButton
              onClick={() => adjustDuration(15)}
              disabled={form.duration >= 480}
              sx={{ p: 0.75, color: D.navy }}
            >
              <Typography sx={{ fontFamily: D.body, fontSize: '1.2rem', lineHeight: 1, fontWeight: 700 }}>+</Typography>
            </IconButton>
          </Box>
        </Box>

        {/* ── Which date an early-hours time is on ── */}
        {offerNight && nightDates && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: -1.25, mb: 2.5 }}>
            {[
              { late: false, label: `Early hours · ${nightDates.morning}` },
              { late: true,  label: `After midnight · ${nightDates.afterMidnight}` },
            ].map(opt => {
              const isActive = lateNight === opt.late;
              return (
                <Box
                  key={String(opt.late)}
                  onClick={() => setForm(f => ({ ...f, lateNight: opt.late }))}
                  sx={{
                    display: 'flex', alignItems: 'center',
                    minHeight: isMobile ? 44 : 32, px: 1.5,
                    borderRadius: '20px',
                    border: `1.5px solid ${isActive ? D.navy : alpha(D.navy, 0.15)}`,
                    backgroundColor: isActive ? D.navy : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    '&:hover': { borderColor: alpha(D.navy, 0.4) },
                    '&:active': { transform: 'scale(0.97)' },
                  }}
                >
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.2,
                    color: isActive ? '#fff' : D.muted,
                  }}>
                    {opt.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* ── Notify me ── */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{
            fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: D.muted, mb: 0.75,
          }}>
            Notify me before{form.notificationLeadMins === undefined ? ' · default' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {NOTIFY_OPTIONS.map(opt => {
              const effective = form.notificationLeadMins === undefined
                ? (inheritedLeadFor?.(form.type) ?? stopLeadMins({ type: form.type }))
                : form.notificationLeadMins;
              const isActive = effective === opt.value;
              return (
                <Box
                  key={String(opt.value)}
                  onClick={() => setForm(f => ({ ...f, notificationLeadMins: opt.value }))}
                  sx={{
                    px: 1.25, py: 0.4,
                    borderRadius: '20px',
                    border: `1.5px solid ${isActive ? D.navy : alpha(D.navy, 0.15)}`,
                    backgroundColor: isActive ? D.navy : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    '&:hover': { borderColor: alpha(D.navy, 0.4) },
                    '&:active': { transform: 'scale(0.95)' },
                  }}
                >
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700,
                    color: isActive ? '#fff' : D.muted,
                    lineHeight: 1.4,
                  }}>
                    {opt.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── More details (collapsed by default) ── */}
        <Box
          onClick={() => setShowExtras(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            cursor: 'pointer', mb: showExtras ? 1.5 : 0,
            color: D.muted,
            userSelect: 'none',
            '&:hover': { color: D.navy },
          }}
        >
          <ExpandMoreIcon sx={{
            fontSize: 18,
            transform: showExtras ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }} />
          <Typography sx={{
            fontFamily: D.body, fontSize: '0.75rem',
            fontWeight: 600, letterSpacing: '0.04em',
          }}>
            {showExtras ? 'Hide details' : 'Add location / details'}
          </Typography>
        </Box>

        <Collapse in={showExtras}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>

            {/* Known trip locations */}
            {knownLocations.length > 0 && (
              <Box>
                <Typography sx={{
                  fontSize: '0.62rem', fontWeight: 800,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: D.muted, fontFamily: D.body, mb: 0.75,
                }}>
                  Trip locations
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {shownLocs.map(loc => {
                    const isSelected = loc.label === form.locationName;
                    const LocIcon    = loc.type === 'hotel'   ? HotelIcon
                                     : loc.type === 'airport' ? FlightIcon
                                     : EventIcon;
                    return (
                      <Box
                        key={loc.label}
                        onClick={() => handleLocationChip(loc)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 1.25, py: 0.5, borderRadius: 5,
                          border: `1.5px solid ${isSelected ? D.navy : alpha(D.navy, 0.18)}`,
                          backgroundColor: isSelected ? alpha(D.navy, 0.08) : 'transparent',
                          cursor: 'pointer',
                          '&:hover': { borderColor: alpha(D.navy, 0.4) },
                        }}
                      >
                        <LocIcon sx={{ fontSize: 12, color: D.navy, opacity: isSelected ? 1 : 0.45 }} />
                        <Typography sx={{
                          fontFamily: D.body, fontSize: '0.78rem',
                          fontWeight: isSelected ? 700 : 400, color: D.navy,
                        }}>
                          {loc.label}
                        </Typography>
                      </Box>
                    );
                  })}
                  {locCollapsible && (
                    <Box
                      onClick={() => setShowAllLocs(v => !v)}
                      sx={{
                        display: 'flex', alignItems: 'center',
                        px: 1.25, py: 0.5, borderRadius: 5,
                        backgroundColor: alpha('#000', 0.04),
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: alpha('#000', 0.08) },
                      }}
                    >
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', fontWeight: 700, color: D.muted }}>
                        {showAllLocs ? 'Less' : `+${knownLocations.length - shownLocs.length} more`}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            <AddressSearch
              label="Location (optional)"
              value={form.address}
              placeholder="Search for a place…"
              onChange={handleAddressChange}
              noValidation
            />

            <TextField
              label="Details"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              placeholder="Details, links, confirmation numbers…"
              InputProps={{ sx: isMobile ? { fontSize: '0.95rem' } : {} }}
            />
          </Box>
        </Collapse>
      </Box>

      {/* ── CTA ── */}
      <Box sx={{
        flexShrink: 0, pt: 1.5, mt: 1,
        borderTop: `1px solid ${D.rule}`,
        display: 'flex', flexDirection: 'column', gap: 0.5,
      }}>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!form.name.trim() || saving}
          fullWidth
          sx={{
            backgroundColor: D.navy,
            color:           '#fff',
            fontFamily:      D.display,
            fontSize:        '0.9rem',
            letterSpacing:   '0.06em',
            py:              isMobile ? 1.75 : 1.5,
            borderRadius:    '10px',
            boxShadow:       'none',
            '&:hover':       { backgroundColor: alpha(D.navy, 0.88), boxShadow: 'none' },
            '&:disabled':    { backgroundColor: alpha(D.navy, 0.2), color: alpha(D.navy, 0.4) },
          }}
        >
          {saving ? '…' : isEditing ? 'Save changes' : 'Add to itinerary'}
        </Button>
        {isEditing && onDelete && (
          <Button
            variant="text"
            fullWidth
            onClick={remove}
            disabled={saving}
            sx={{
              color:        'error.main',
              fontFamily:   D.body,
              fontWeight:   700,
              fontSize:     '0.82rem',
              py:           isMobile ? 1 : 0.75,
              borderRadius: '10px',
              '&:hover':    { backgroundColor: alpha('#ef4444', 0.06) },
            }}
          >
            Delete stop
          </Button>
        )}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius:  20,
            borderTopRightRadius: 20,
            px: 2.5, pt: 1.5,
            pb: 'max(env(safe-area-inset-bottom, 16px), 32px)',
            maxHeight: '92vh',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            backgroundColor: '#ffffff',
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.12) }} />
        </Box>
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 360, p: 3, backgroundColor: '#ffffff',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        },
      }}
    >
      {content}
    </Drawer>
  );
}