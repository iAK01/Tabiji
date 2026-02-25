'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box, TextField, Paper, Typography, InputAdornment,
  CircularProgress, alpha,
} from '@mui/material';
import PlaceIcon      from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ResolvedAddress {
  address:     string;                    // full human-readable place name
  coordinates: { lat: number; lng: number }; // verified geocoded coordinates
}

interface AddressSearchProps {
  label:        string;
  value:        string;                   // display text (controlled by parent)
  onChange:     (result: ResolvedAddress | null) => void;
  placeholder?: string;
  required?:    boolean;
  disabled?:    boolean;
  size?:        'small' | 'medium';
  /** Pass this to suppress validation warning (e.g. fields where text-only is fine) */
  noValidation?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddressSearch({
  label,
  value,
  onChange,
  placeholder = 'Search for a place or address…',
  required    = false,
  disabled    = false,
  size        = 'medium',
  noValidation = false,
}: AddressSearchProps) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [verified,    setVerified]    = useState(false); // true once user selected a suggestion
  const [dirty,       setDirty]       = useState(false); // true once user has typed since last selection
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<string>('');   // tracks the last selected address text

  // Keep display in sync if parent resets the value
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
      setVerified(!!value && value === selectedRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const search = (q: string) => {
    setQuery(q);
    setVerified(false);
    setDirty(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        const res   = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${token}&types=poi,address,place&limit=6`,
        );
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const select = (feature: any) => {
    const address    = feature.place_name as string;
    const [lng, lat] = feature.center as [number, number];
    selectedRef.current = address;
    setQuery(address);
    setSuggestions([]);
    setVerified(true);
    setDirty(false);
    onChange({ address, coordinates: { lat, lng } });
  };

  const handleBlur = () => {
    // Small delay so click on suggestion registers before blur hides the list
    setTimeout(() => setSuggestions([]), 150);
  };

  // Warning: user typed something but hasn't selected a verified suggestion
  const showWarning = !noValidation && dirty && !verified && query.length > 2;

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        label={label}
        value={query}
        onChange={e => search(e.target.value)}
        onBlur={handleBlur}
        fullWidth
        size={size}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {searching
                ? <CircularProgress size={16} />
                : verified
                ? <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                : <PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              }
            </InputAdornment>
          ),
        }}
        helperText={
          showWarning
            ? 'Select a suggestion to verify the location — navigation may not work otherwise'
            : verified
            ? 'Location verified ✓'
            : undefined
        }
        FormHelperTextProps={{
          sx: {
            color: showWarning ? 'warning.dark' : 'success.main',
            fontSize: '0.72rem',
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': showWarning
            ? { '& fieldset': { borderColor: 'warning.main' } }
            : {},
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
              key={i}
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