'use client';

// An address field. What you type or paste is the address, saved as entered, with or
// without a pick. The map pin comes from Google (/api/trips/[id]/geocode), and only
// for an exact match; without one, Navigate searches the address text instead.
// Suggestions are for finding a place by name: only places in the trip's area and,
// for a full address, in the town it names. Picking one replaces the text with it.

import { useState, useRef, useEffect } from 'react';
import {
  Box, TextField, Paper, Typography, InputAdornment,
  CircularProgress, alpha,
} from '@mui/material';
import PlaceIcon       from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { words } from '@/lib/geo/geocode';
import { inTripArea, namesPlace, type TripArea } from '@/lib/geo/tripAreas';
import type { Pin } from '@/lib/geo/pinAddress';

type LatLng = { lat: number; lng: number };

export interface ResolvedAddress {
  address:     string;
  /** null = not pinned */
  coordinates: LatLng | null;
  /** The place's own name, when a suggestion was picked */
  name?:       string;
}

interface AddressSearchProps {
  label:        string;
  value:        string;
  /** The saved pin, so an existing one shows as pinned */
  coordinates?: LatLng | null;
  onChange:     (result: ResolvedAddress) => void;
  tripId:       string;
  /** tripAreas(trip) */
  areas:        TripArea[];
  placeholder?: string;
}

type PinState =
  | { kind: 'none' }
  | { kind: 'looking' }
  | { kind: 'pinned'; label?: string }
  | { kind: 'unpinned' };

const MIN_CHARS = 3;

const hasPin = (c?: LatLng | null): c is LatLng => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);

const pinStateOf = (address: string, c: LatLng | null): PinState =>
  !address ? { kind: 'none' } : c ? { kind: 'pinned' } : { kind: 'unpinned' };

// A Mapbox suggestion worth offering: a named place or a numbered address (never a
// street's centre), in the trip's area, and in the town a full address names.
function worthOffering(f: any, text: string, typed: Set<string>, areas: TripArea[]): boolean {
  const [lng, lat] = f.center ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (f.place_type?.includes('address') && !f.address) return false;
  if (areas.length && !inTripArea(areas, lat, lng)) return false;
  if (text.includes(',')) {
    const towns: string[] = (f.context ?? [])
      .filter((c: any) => /^(place|locality|neighborhood)\./.test(c.id ?? ''))
      .map((c: any) => c.text);
    if (!towns.some(t => namesPlace(typed, t))) return false;
  }
  return true;
}

export default function AddressSearch({
  label,
  value,
  coordinates,
  onChange,
  tripId,
  areas,
  placeholder = 'Address or place name',
}: AddressSearchProps) {
  const savedPin = hasPin(coordinates) ? coordinates : null;

  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [pin,         setPin]         = useState<PinState>(() => pinStateOf(value, savedPin));
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edits        = useRef(0);                              // an answer for an older edit is dropped
  const pins         = useRef(new Map<string, Pin | null>());  // looked-up text → its pin
  const sent         = useRef<{ address: string; coordinates: LatLng | null }>({ address: value, coordinates: savedPin });

  const emit = (r: ResolvedAddress) => {
    sent.current = { address: r.address, coordinates: r.coordinates };
    onChange(r);
  };

  const cancelTimers = () => {
    for (const t of [suggestTimer, pinTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
  };

  useEffect(() => cancelTimers, []);

  // The parent changed it (a reset, another stop, a location chip): start from that
  useEffect(() => {
    const s = sent.current;
    if (value === s.address && savedPin?.lat === s.coordinates?.lat && savedPin?.lng === s.coordinates?.lng) return;
    cancelTimers();
    edits.current++;
    sent.current = { address: value, coordinates: savedPin };
    setQuery(value);
    setSuggestions([]);
    setPin(pinStateOf(value, savedPin));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, savedPin?.lat, savedPin?.lng]);

  const suggest = async (text: string, edit: number) => {
    suggestTimer.current = null;
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      const near  = areas[0] ? `&proximity=${areas[0].lng},${areas[0].lat}` : '';
      const res   = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
        `?access_token=${token}&types=poi,address&limit=10${near}`,
      );
      const data  = res.ok ? await res.json() : null;
      if (edit !== edits.current) return;
      const typed = new Set(words(text));
      setSuggestions((data?.features ?? []).filter((f: any) => worthOffering(f, text, typed, areas)).slice(0, 6));
    } catch {
      if (edit === edits.current) setSuggestions([]);
    }
  };

  const lookUpPin = async (text: string, edit: number) => {
    pinTimer.current = null;
    let found = pins.current.get(text);
    if (found === undefined) {
      try {
        const res = await fetch(`/api/trips/${tripId}/geocode`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ address: text }),
        });
        if (res.ok) {
          found = ((await res.json()).pin ?? null) as Pin | null;
          pins.current.set(text, found);
        }
      } catch { /* offline — stays unpinned */ }
    }
    if (edit !== edits.current) return;
    if (!found) { setPin({ kind: 'unpinned' }); return; }
    setPin({ kind: 'pinned', label: found.label });
    emit({ address: text, coordinates: { lat: found.lat, lng: found.lng } });
  };

  const type = (q: string) => {
    const text = q.trim();
    const edit = ++edits.current;
    cancelTimers();
    setQuery(q);
    emit({ address: text, coordinates: null });
    if (text.length < MIN_CHARS) {
      setSuggestions([]);
      setPin({ kind: 'none' });
      return;
    }
    setPin({ kind: 'looking' });
    suggestTimer.current = setTimeout(() => suggest(text, edit), 300);
    pinTimer.current     = setTimeout(() => lookUpPin(text, edit), 800);
  };

  const select = (f: any) => {
    const address    = f.place_name as string;
    const [lng, lat] = f.center as [number, number];
    cancelTimers();
    edits.current++;
    setQuery(address);
    setSuggestions([]);
    setPin({ kind: 'pinned' });
    emit({ address, coordinates: { lat, lng }, name: f.text });
  };

  const blur = () => {
    // Small delay so a tap on a suggestion registers before the list goes
    setTimeout(() => setSuggestions([]), 150);
    // Leaving the field: check the pin now rather than after the pause
    if (pinTimer.current) {
      clearTimeout(pinTimer.current);
      lookUpPin(query.trim(), edits.current);
    }
  };

  const helper =
    pin.kind === 'looking'  ? 'Finding it on the map…' :
    pin.kind === 'pinned'   ? (pin.label ? `Pinned to ${pin.label}` : 'Pinned on the map') :
    pin.kind === 'unpinned' ? 'Not pinned — Navigate will search this address' :
    undefined;

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        label={label}
        value={query}
        onChange={e => type(e.target.value)}
        onBlur={blur}
        fullWidth
        placeholder={placeholder}
        autoComplete="off"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {pin.kind === 'looking'
                ? <CircularProgress size={16} />
                : pin.kind === 'pinned'
                ? <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                : <PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              }
            </InputAdornment>
          ),
        }}
        helperText={helper}
        FormHelperTextProps={{
          sx: {
            color: pin.kind === 'pinned' ? 'success.main' : 'text.secondary',
            fontSize: '0.72rem',
          },
        }}
      />

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1400,
            maxHeight: 240,
            overflow: 'auto',
            boxShadow: 6,
            mt: 0.25,
          }}
        >
          {suggestions.map((f: any, i: number) => (
            <Box
              key={f.id ?? i}
              onMouseDown={() => select(f)}   // mouseDown fires before blur
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': { backgroundColor: alpha('#55702C', 0.06) },
                '&:active': { backgroundColor: alpha('#55702C', 0.12) },
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <PlaceIcon sx={{ fontSize: 16, color: 'primary.main', mt: 0.2, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                    {f.text}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ lineHeight: 1.3, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {f.place_name}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
