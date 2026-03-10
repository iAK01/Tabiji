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
import { stopDuration } from './Itinerary.helpers';

interface Props {
  open:           boolean;
  onClose:        () => void;
  onAdd:          (stop: Partial<Stop>) => Promise<void>;
  onUpdate:       (stop: Partial<Stop>) => Promise<void>;
  defaultTime:    string;
  defaultType:    string;
  editStop?:      Stop;
  isMobile:       boolean;
  knownLocations: KnownLocation[];
}

// Format minutes → "1h 30m" / "45m"
function fmtDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function AddStopDrawer({
  open, onClose, onAdd, onUpdate,
  defaultTime, defaultType, editStop,
  isMobile, knownLocations,
}: Props) {
  const isEditing = !!editStop;

  const [form, setForm] = useState({
    name:           '',
    type:           defaultType,
    scheduledStart: defaultTime,
    duration:       60,
    notes:          '',
    address:        '',
    coordinates:    undefined as { lat: number; lng: number } | undefined,
  });
  const [saving,       setSaving]       = useState(false);
  const [showExtras,   setShowExtras]   = useState(false);

  useEffect(() => {
    if (editStop) {
      const timeStr = editStop.scheduledStart
        ? editStop.scheduledStart.includes('T')
          ? editStop.scheduledStart.split('T')[1]?.slice(0, 5) ?? defaultTime
          : editStop.scheduledStart
        : defaultTime;
      setForm({
        name:           editStop.name ?? '',
        type:           editStop.type ?? defaultType,
        scheduledStart: timeStr,
        duration:       stopDuration(editStop),
        notes:          editStop.notes ?? '',
        address:        editStop.address ?? '',
        coordinates:    editStop.coordinates,
      });
      // Show extras if editing and they have content
      setShowExtras(!!(editStop.notes || editStop.address));
    } else {
      setForm({
        name:           '',
        type:           defaultType,
        scheduledStart: defaultTime,
        duration:       DEFAULT_DURATIONS[defaultType] ?? 60,
        notes:          '',
        address:        '',
        coordinates:    undefined,
      });
      setShowExtras(false);
    }
  }, [defaultTime, defaultType, editStop, open]);

  const handleAddressChange = (result: ResolvedAddress | null) => {
    setForm(f => ({
      ...f,
      address:     result?.address     ?? '',
      coordinates: result?.coordinates ?? undefined,
      name: f.name || result?.address?.split(',')[0] || f.name,
    }));
  };

  const handleLocationChip = (loc: KnownLocation) => {
    setForm(f => ({ ...f, address: loc.address ?? loc.label, coordinates: loc.coordinates }));
  };

  const adjustDuration = (delta: number) => {
    setForm(f => ({
      ...f,
      duration: Math.max(15, Math.min(480, f.duration + delta)),
    }));
  };

  const submit = async () => {
    setSaving(true);
    if (isEditing) {
      await onUpdate({ ...editStop, ...form });
    } else {
      await onAdd(form);
    }
    setSaving(false);
    onClose();
  };

  const cfg = STOP_CONFIG[form.type] ?? STOP_CONFIG.other;

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', mb: 2,
      }}>
        <Typography sx={{
          fontFamily: D.display, fontSize: '1rem',
          color: D.navy, lineHeight: 1,
        }}>
          {isEditing ? 'Edit stop' : 'Add to day'}
        </Typography>
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
          {showExtras ? 'Hide details' : 'Add location / notes'}
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
                {knownLocations.map((loc, i) => {
                  const isSelected = form.address === (loc.address ?? loc.label);
                  const LocIcon    = loc.type === 'hotel'   ? HotelIcon
                                   : loc.type === 'airport' ? FlightIcon
                                   : EventIcon;
                  return (
                    <Box
                      key={i}
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
            label="Notes"
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

      {/* ── CTA ── */}
      <Box sx={{ mt: 'auto', pt: 1 }}>
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
            overflowY: 'auto',
            backgroundColor: '#ffffff',
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
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
        sx: { width: 360, p: 3, backgroundColor: '#ffffff' },
      }}
    >
      {content}
    </Drawer>
  );
}