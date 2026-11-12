'use client';

import { useCallback, useRef, useState } from 'react';
import { IconButton, Button, Tooltip, Popover, Box, alpha, type PopoverActions } from '@mui/material';
import NearMeIcon          from '@mui/icons-material/NearMe';
import NearMeDisabledIcon  from '@mui/icons-material/NearMeDisabled';
import MapIcon             from '@mui/icons-material/Map';
import { canNavigate }     from '@/lib/navigation/links';
import type { NavIntent, NavMode, NavigationDestination, NavOrigin } from '@/lib/navigation/links';
import NavigateOptions, { NavigateNotice, type NavNotice } from '@/components/navigation/NavigateOptions';
import type { TravelOrigin } from '@/lib/navigation/useTravelTimes';

// ─── Props ────────────────────────────────────────────────────────────────────
interface NavigateButtonProps {
  destination:   NavigationDestination;
  /** Travel mode pre-selected in the dropdown */
  suggestedMode?: NavMode;
  /** 'directions' (default) routes there; 'view' just shows the place */
  intent?:   NavIntent;
  /** Where the dropdown's times start when you're not near the place (stop before, hotel) */
  from?:     TravelOrigin | null;
  /** Route from this place (your hotel) instead of where you are */
  origin?:   NavOrigin | null;
  /** 'icon'   = icon-only button (default, used inside cards)
   *  'button' = full text button (used in larger contexts)
   *  'text'   = icon + label, no outline (a line in a sheet) */
  variant?:  'icon' | 'button' | 'text';
  /** Replaces the navigate icon on 'button' / 'text' */
  icon?:     typeof NearMeIcon;
  /** Label shown when variant='button'. Defaults to 'Navigate' ('Map' for intent='view') */
  label?:    string;
  /** MUI size */
  size?:     'small' | 'medium';
  /** Extra sx on the root element */
  sx?:       object;
}

// The dropdown and snackbar render in portals, and React still bubbles their events
// to this component's parents — stop them reaching card clicks and drag handles.
const stop     = (e: React.SyntheticEvent) => e.stopPropagation();
const stopKeys = (e: React.KeyboardEvent) => { if (e.key !== 'Escape') e.stopPropagation(); };

// ─── Component ────────────────────────────────────────────────────────────────
export default function NavigateButton({
  destination,
  suggestedMode = 'driving',
  intent        = 'directions',
  from,
  origin        = null,
  variant       = 'icon',
  icon,
  label         = intent === 'view' ? 'Map' : 'Navigate',
  size          = 'small',
  sx            = {},
}: NavigateButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<NavNotice | null>(null);
  const popover = useRef<PopoverActions>(null);
  const refit   = useCallback(() => popover.current?.updatePosition(), []);

  const able  = canNavigate(destination, intent);
  const place = destination.name ?? destination.address ?? 'this location';

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();          // don't bubble into parent card click handlers
    if (able) setAnchor(e.currentTarget);
  };

  const tooltipTitle = !able
    ? 'No location data — add an address to enable navigation'
    : intent === 'view' ? `Show ${place} in a map app`
    : origin ? `Route from ${origin.name} to ${place}` : `Navigate to ${place}`;

  // ── Shared icon ─────────────────────────────────────────────────────────────
  const Icon = !able ? NearMeDisabledIcon : intent === 'view' ? MapIcon : NearMeIcon;
  const StartIcon = able && icon ? icon : Icon;

  return (
    <Box component="span" sx={{ display: 'contents' }} onClick={stop} onPointerDown={stop} onKeyDown={stopKeys}>
      <Tooltip title={anchor ? '' : tooltipTitle} placement="top">
        <span> {/* span wrapper needed for Tooltip on disabled elements */}
          {variant === 'icon' ? (
            <IconButton
              size={size}
              onClick={handleClick}
              disabled={!able}
              aria-label={tooltipTitle}
              aria-haspopup="true"
              aria-expanded={!!anchor}
              sx={{
                color:    able ? 'primary.main' : 'text.disabled',
                opacity:  able ? 0.75 : 0.4,
                '&:hover': able ? { opacity: 1, backgroundColor: alpha('#55702C', 0.1) } : {},
                '&:active': { opacity: 1 },
                // Minimum 44×44 touch target (accessibility)
                minWidth:  44,
                minHeight: 44,
                ...sx,
              }}
            >
              <Icon sx={{ fontSize: size === 'small' ? 24 : 32 }} />
            </IconButton>
          ) : variant === 'text' ? (
            <Button
              size={size}
              variant="text"
              onClick={handleClick}
              disabled={!able}
              aria-haspopup="true"
              aria-expanded={!!anchor}
              startIcon={<StartIcon />}
              sx={{ textTransform: 'none', ...sx }}
            >
              {label}
            </Button>
          ) : (
            <Button
              size={size}
              variant="outlined"
              onClick={handleClick}
              disabled={!able}
              aria-haspopup="true"
              aria-expanded={!!anchor}
              startIcon={<StartIcon />}
              sx={{
                borderColor: able ? 'primary.main' : 'divider',
                color:       able ? 'primary.main' : 'text.disabled',
                ...sx,
              }}
            >
              {label}
            </Button>
          )}
        </span>
      </Tooltip>

      <Popover
        action={popover}
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 300, maxWidth: 'calc(100vw - 32px)', borderRadius: 2.5 } } }}
      >
        <NavigateOptions
          destination={destination}
          intent={intent}
          initialMode={suggestedMode}
          from={from}
          origin={origin}
          onPicked={() => setAnchor(null)}
          onNotice={setNotice}
          onLayoutChange={refit}
        />
      </Popover>

      <NavigateNotice notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
