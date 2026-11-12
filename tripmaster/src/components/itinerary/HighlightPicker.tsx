'use client';

import { useState } from 'react';
import { Box, Popover } from '@mui/material';
import { alpha }        from '@mui/material/styles';
import CheckIcon            from '@mui/icons-material/Check';
import FormatColorResetIcon from '@mui/icons-material/FormatColorReset';
import { HIGHLIGHTS, HIGHLIGHT_KEYS, type Highlight } from '@/lib/itinerary/highlight';
import { D } from './Itinerary.config';

// Inside a stop card: a tap here must not open the card or start a drag
const stop     = (e: React.SyntheticEvent) => e.stopPropagation();
const stopKeys = (e: React.KeyboardEvent) => { if (e.key !== 'Escape') e.stopPropagation(); };

const btnSx = (size: number) => ({
  width: size, height: size, p: 0, flexShrink: 0,
  border: 'none', background: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

interface SwatchesProps {
  value?:   Highlight | null;
  onChange: (h: Highlight | null) => void;
  /** Tap target per swatch */
  size?:    number;
}

// The four colours, then none
export function HighlightSwatches({ value, onChange, size = 44 }: SwatchesProps) {
  const dot = Math.round(size * 0.62);
  return (
    <Box role="radiogroup" aria-label="Colour" sx={{ display: 'flex', alignItems: 'center' }}>
      {HIGHLIGHT_KEYS.map(k => {
        const on = value === k;
        const c  = HIGHLIGHTS[k];
        return (
          <Box
            key={k} component="button" type="button" role="radio" aria-checked={on}
            aria-label={c.label} title={c.label}
            onClick={() => { if (!on) onChange(k); }}
            sx={btnSx(size)}
          >
            <Box sx={{
              width: dot, height: dot, borderRadius: '50%', backgroundColor: c.swatch,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${c.swatch}` : 'none',
            }}>
              {on && <CheckIcon sx={{ fontSize: Math.round(dot * 0.62), color: '#fff' }} />}
            </Box>
          </Box>
        );
      })}
      <Box
        component="button" type="button" role="radio" aria-checked={!value}
        aria-label="No colour" title="No colour"
        onClick={() => { if (value) onChange(null); }}
        sx={btnSx(size)}
      >
        <Box sx={{
          width: dot, height: dot, borderRadius: '50%', boxSizing: 'border-box',
          border: `1.5px solid ${alpha(D.navy, value ? 0.3 : 0.6)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FormatColorResetIcon sx={{ fontSize: Math.round(dot * 0.58), color: alpha(D.navy, value ? 0.45 : 0.7) }} />
        </Box>
      </Box>
    </Box>
  );
}

interface DotProps {
  value?:   Highlight | null;
  onChange: (h: Highlight | null) => void;
  /** Tap target */
  size:     number;
  /** The dot itself */
  dot:      number;
  sx?:      object;
}

// The stop's colour as a dot; tap it for the swatches. An empty ring until one is chosen.
export function HighlightDot({ value, onChange, size, dot, sx }: DotProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const c = value ? HIGHLIGHTS[value] : null;
  return (
    <Box
      component="span" sx={{ display: 'contents' }}
      onClick={stop} onPointerDown={stop} onTouchStart={stop} onKeyDown={stopKeys}
    >
      <Box
        component="button" type="button"
        aria-label={c ? `Colour: ${c.label}` : 'Colour'} title={c ? c.label : 'Colour'}
        aria-haspopup="true" aria-expanded={!!anchor}
        onClick={e => setAnchor(e.currentTarget as HTMLElement)}
        sx={{ ...btnSx(size), ...sx }}
      >
        <Box sx={{
          width: dot, height: dot, borderRadius: '50%', boxSizing: 'border-box',
          ...(c
            ? { backgroundColor: c.swatch, boxShadow: '0 0 0 1.5px #fff' }
            : { border: `1.5px solid ${alpha(D.navy, 0.28)}` }),
        }} />
      </Box>
      <Popover
        open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: '12px', px: 0.5 } } }}
      >
        <HighlightSwatches value={value} onChange={h => { setAnchor(null); onChange(h); }} />
      </Popover>
    </Box>
  );
}
