'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, List, ListItemButton,
  ListItemIcon, ListItemText, ListSubheader, Divider, Snackbar, Button, alpha,
} from '@mui/material';
import DirectionsWalkIcon    from '@mui/icons-material/DirectionsWalk';
import DirectionsCarIcon     from '@mui/icons-material/DirectionsCar';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import PlaceIcon             from '@mui/icons-material/Place';
import MapIcon               from '@mui/icons-material/Map';
import NavigationIcon        from '@mui/icons-material/Navigation';
import ContentCopyIcon       from '@mui/icons-material/ContentCopy';
import LocalTaxiIcon         from '@mui/icons-material/LocalTaxi';
import {
  NAV_APP_LABEL, copyableLocation, detectPlatform, isAppScheme, navAppsFor, navLink, uberLink,
  type NavApp, type NavIntent, type NavMode, type NavigationDestination,
} from '@/lib/navigation/links';
import { useTravelTimes, formatTravelMins, type TravelOrigin } from '@/lib/navigation/useTravelTimes';
import { useRideApps } from '@/lib/navigation/useRideApps';
import type { TransportService } from '@/lib/data/ground-transport';
import TransitSummary from './TransitSummary';

const MODES = [
  { key: 'walking' as const, label: 'Walk',    Icon: DirectionsWalkIcon },
  { key: 'driving' as const, label: 'Drive',   Icon: DirectionsCarIcon },
  { key: 'transit' as const, label: 'Transit', Icon: DirectionsTransitIcon },
];

const APP_ICON: Record<NavApp, { Icon: typeof PlaceIcon; color: string }> = {
  google_maps: { Icon: PlaceIcon,      color: '#D93025' },
  apple_maps:  { Icon: MapIcon,        color: '#007AFF' },
  waze:        { Icon: NavigationIcon, color: '#0A8FBF' },
};

// How long a phone gets to leave for the app before we offer the website instead.
const APP_OPEN_GRACE_MS = 1500;

const SECTION_LABEL = {
  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary',
} as const;

function AppBadge({ Icon, color }: { Icon: typeof PlaceIcon; color: string }) {
  return (
    <Box sx={{
      width: 30, height: 30, borderRadius: 1.5, display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: alpha(color, 0.12),
    }}>
      <Icon sx={{ fontSize: 18, color }} />
    </Box>
  );
}

export interface NavNotice {
  text:      string;
  /** Web version of a link whose app didn't open */
  fallback?: string;
}

// ─── Picker ───────────────────────────────────────────────────────────────────
// Shared by NavigateButton's dropdown and the /navigate page. Messages go to the
// parent (onNotice) because the dropdown closes — and unmounts this — on pick.
export default function NavigateOptions({
  destination,
  intent      = 'directions',
  initialMode = 'driving',
  from,
  onPicked,
  onNotice,
  onLayoutChange,
}: {
  destination:  NavigationDestination;
  intent?:      NavIntent;
  initialMode?: NavMode;
  /** Where times start when you're not near the place yet */
  from?:        TravelOrigin | null;
  onPicked?:    () => void;
  onNotice:     (n: NavNotice) => void;
  /** Height changed (transit summary, "Times from…") — lets a dropdown re-fit the screen */
  onLayoutChange?: () => void;
}) {
  const [mode, setMode] = useState<NavMode>(initialMode);
  const platform = detectPlatform();
  const copy     = copyableLocation(destination);
  const title    = destination.name || destination.address || '';
  const { status, times, fromLabel, pickup } = useTravelTimes(destination, from, intent === 'directions');
  const showTransit = intent === 'directions' && mode === 'transit';
  // Only Uber's website books a ride from a computer.
  const rides = useRideApps().filter(svc => intent === 'directions' && (platform !== 'desktop' || svc.id === 'uber'));
  const pasteText = destination.address || destination.name;

  useEffect(() => { onLayoutChange?.(); }, [showTransit, fromLabel, rides.length, onLayoutChange]);

  // Web pages open in a new tab, app schemes in place. A scheme does nothing when
  // the app isn't installed: if we're still on screen shortly after, offer
  // `fallback` rather than leave the tap unanswered.
  const launch = (href: string, label: string, fallback?: string) => {
    if (!isAppScheme(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = href;
    if (!fallback) return;

    let left = false;
    const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
    const onLeave = () => { left = true; };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('blur', onLeave);
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('blur', onLeave);
      if (!left) onNotice({ text: `${label} didn't open`, fallback });
    }, APP_OPEN_GRACE_MS);
  };

  const open = (app: NavApp) => {
    onPicked?.();
    launch(
      navLink(destination, app, mode, intent, platform),
      NAV_APP_LABEL[app],
      app === 'apple_maps' ? undefined : navLink(destination, app, mode, intent, 'desktop'),   // always on iPhone
    );
  };

  // Uber opens with the trip filled in, from where the times start. The others
  // can't be filled in, so the address goes on the clipboard first, ready to paste.
  const ride = async (svc: TransportService) => {
    onPicked?.();
    if (svc.id === 'uber') {
      launch(uberLink(destination, pickup, platform), svc.name, uberLink(destination, pickup, 'desktop'));
      return;
    }
    if (pasteText) {
      try {
        await navigator.clipboard.writeText(pasteText);
        onNotice({ text: `${destination.address ? 'Address' : 'Name'} copied — paste it in ${svc.name}` });
      } catch { /* open the app anyway */ }
    }
    const store = platform === 'ios' ? svc.iosStore : svc.androidStore;
    if (svc.deepLink) launch(svc.deepLink, svc.name, store ?? svc.webUrl);
    else              launch(store ?? svc.webUrl, svc.name);
  };

  const copyLocation = async () => {
    if (!copy) return;
    onPicked?.();
    try {
      await navigator.clipboard.writeText(copy.text);
      onNotice({ text: copy.kind === 'coordinates' ? 'Coordinates copied' : 'Address copied' });
    } catch {
      onNotice({ text: `Couldn't copy — ${copy.text}` });
    }
  };

  return (
    <Box>
      {title && (
        <Typography noWrap sx={{ ...SECTION_LABEL, px: 2, pt: 1.5, pb: 1 }}>
          {intent === 'directions' ? `Directions to ${title}` : title}
        </Typography>
      )}

      {intent === 'directions' && (
        <Box sx={{ px: 1.5, pb: 1, pt: title ? 0 : 1.5 }}>
          <ToggleButtonGroup
            exclusive fullWidth size="small" value={mode}
            onChange={(_, m: NavMode | null) => m && setMode(m)}
          >
            {/* Fixed height, so the list below doesn't jump when the times arrive mid-tap */}
            {MODES.map(({ key, label, Icon }) => (
              <ToggleButton key={key} value={key} sx={{ height: 56, flexDirection: 'column', textTransform: 'none', fontWeight: 700, lineHeight: 1.2 }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icon sx={{ fontSize: 18 }} />
                  {label}
                </Box>
                {times?.[key] != null && (
                  <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, mt: 0.25 }}>
                    {formatTravelMins(times[key]!)}
                  </Box>
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {showTransit && <TransitSummary status={status} times={times} />}

      <List disablePadding>
        {navAppsFor(platform).map(app => {
          const { Icon, color } = APP_ICON[app];
          return (
            <ListItemButton key={app} onClick={() => open(app)} sx={{ minHeight: 48 }}>
              <ListItemIcon sx={{ minWidth: 44 }}>
                <AppBadge Icon={Icon} color={color} />
              </ListItemIcon>
              <ListItemText
                primary={NAV_APP_LABEL[app]}
                secondary={app === 'waze' && intent === 'directions' && mode !== 'driving' ? 'Driving only' : undefined}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </ListItemButton>
          );
        })}
        {rides.length > 0 && (
          <>
            <Divider />
            <ListSubheader disableSticky sx={{ ...SECTION_LABEL, lineHeight: 1, px: 2, pt: 1.5, pb: 0.5, backgroundColor: 'transparent' }}>
              Rides
            </ListSubheader>
            {rides.map(svc => (
              <ListItemButton key={svc.id} onClick={() => ride(svc)} sx={{ minHeight: 48 }}>
                <ListItemIcon sx={{ minWidth: 44 }}>
                  <AppBadge Icon={LocalTaxiIcon} color="#1D2642" />
                </ListItemIcon>
                <ListItemText
                  primary={svc.name}
                  secondary={svc.id !== 'uber' && pasteText ? `Copies the ${destination.address ? 'address' : 'name'}` : undefined}
                  slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                />
              </ListItemButton>
            ))}
          </>
        )}
        {copy && (
          <>
            <Divider />
            <ListItemButton onClick={copyLocation} sx={{ minHeight: 48 }}>
              <ListItemIcon sx={{ minWidth: 44 }}>
                <Box sx={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ContentCopyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={copy.kind === 'coordinates' ? 'Copy GPS coordinates' : 'Copy address'}
                secondary={copy.text}
                slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { noWrap: true } }}
              />
            </ListItemButton>
          </>
        )}
      </List>

      {/* Under everything, so it can't push the options down as it appears */}
      {fromLabel && (
        <Typography sx={{ px: 2, pt: 0.5, pb: 1.25, fontSize: '0.72rem', color: 'text.secondary' }}>
          {fromLabel}
        </Typography>
      )}
    </Box>
  );
}

// ─── Messages (copied / app didn't open) ──────────────────────────────────────
export function NavigateNotice({ notice, onClose }: { notice: NavNotice | null; onClose: () => void }) {
  // Keep the last message on screen while the snackbar animates out.
  const last  = useRef(notice);
  if (notice) last.current = notice;
  const shown = last.current;
  return (
    <Snackbar
      open={!!notice}
      onClose={(_, reason) => { if (reason !== 'clickaway') onClose(); }}
      autoHideDuration={shown?.fallback ? 8000 : 3000}
      message={shown?.text}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      action={shown?.fallback && (
        <Button size="small" color="inherit" sx={{ fontWeight: 700, minHeight: 44 }}
          onClick={() => { window.open(shown.fallback, '_blank', 'noopener,noreferrer'); onClose(); }}>
          Open in browser
        </Button>
      )}
    />
  );
}
