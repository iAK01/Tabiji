'use client';

import { useState }        from 'react';
import { IconButton, Button, Tooltip, alpha } from '@mui/material';
import NearMeIcon          from '@mui/icons-material/NearMe';
import NearMeDisabledIcon  from '@mui/icons-material/NearMeDisabled';
import { useNavigation }   from '@/lib/navigation/useNavigation';
import type { NavMode, NavigationDestination } from '@/lib/navigation/useNavigation';
import NavigationPreferencesSetup from '@/components/navigation/NavigationPreferencesSetup';

// ─── Props ────────────────────────────────────────────────────────────────────
interface NavigateButtonProps {
  destination:   NavigationDestination;
  /** Suggested travel mode — used to pick the right app from preferences */
  suggestedMode?: NavMode;
  /** 'icon'   = icon-only button (default, used inside cards)
   *  'button' = full text button (used in larger contexts)  */
  variant?:  'icon' | 'button';
  /** Label shown when variant='button'. Defaults to 'Navigate' */
  label?:    string;
  /** MUI size */
  size?:     'small' | 'medium';
  /** Extra sx on the root element */
  sx?:       object;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NavigateButton({
  destination,
  suggestedMode = 'driving',
  variant       = 'icon',
  label         = 'Navigate',
  size          = 'small',
  sx            = {},
}: NavigateButtonProps) {
  const {
    navigate,
    canNavigate,
    savePreferences,
    loading,
    needsSetup,
    setupOpen,
    setSetupOpen,
    onSetupComplete,
  } = useNavigation();

  const able = canNavigate(destination);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();          // don't bubble into parent card click handlers
    if (!able) return;
    navigate(destination, suggestedMode);
  };

  const tooltipTitle = !able
    ? 'No location data — add an address to enable navigation'
    : needsSetup
    ? `Navigate (set up your preferred map app first)`
    : `Navigate to ${destination.name ?? destination.address ?? 'this location'}`;

  // ── Shared icon ─────────────────────────────────────────────────────────────
  const Icon = able ? NearMeIcon : NearMeDisabledIcon;

  return (
    <>
      <Tooltip title={tooltipTitle} placement="top">
        <span> {/* span wrapper needed for Tooltip on disabled elements */}
          {variant === 'icon' ? (
            <IconButton
              size={size}
              onClick={handleClick}
              disabled={!able || loading}
              aria-label={tooltipTitle}
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
              <Icon sx={{ fontSize: size === 'small' ? 18 : 22 }} />
            </IconButton>
          ) : (
            <Button
              size={size}
              variant="outlined"
              onClick={handleClick}
              disabled={!able || loading}
              startIcon={<Icon />}
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

      {/* Preferences setup — rendered inline, shown conditionally */}
      <NavigationPreferencesSetup
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onSave={async (prefs) => {
          await savePreferences(prefs);
          onSetupComplete({ ...prefs, setupComplete: true });
        }}
      />
    </>
  );
}