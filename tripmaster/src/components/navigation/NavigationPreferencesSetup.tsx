'use client';

import { useState, useEffect }  from 'react';
import {
  Box, Typography, Button, Dialog, Drawer,
  Paper, useTheme, useMediaQuery, alpha, IconButton,
} from '@mui/material';
import CloseIcon    from '@mui/icons-material/Close';
import DirectionsWalkIcon   from '@mui/icons-material/DirectionsWalk';
import DirectionsCarIcon    from '@mui/icons-material/DirectionsCar';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import { detectPlatform }   from '@/lib/navigation/useNavigation';
import type { NavApp, NavPreferences } from '@/lib/navigation/useNavigation';

// ─── App definitions ──────────────────────────────────────────────────────────
interface AppOption {
  value:    NavApp;
  label:    string;
  emoji:    string;
  iOSOnly?: boolean;
}

const APP_OPTIONS: AppOption[] = [
  { value: 'apple_maps',  label: 'Apple Maps',  emoji: '🗺️',  iOSOnly: true },
  { value: 'google_maps', label: 'Google Maps', emoji: '📍' },
  { value: 'waze',        label: 'Waze',        emoji: '🚗' },
];

const MODES = [
  { key: 'walking' as const,  label: 'Walking',  Icon: DirectionsWalkIcon },
  { key: 'driving' as const,  label: 'Driving',  Icon: DirectionsCarIcon },
  { key: 'transit' as const,  label: 'Transit',  Icon: DirectionsTransitIcon },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface NavigationPreferencesSetupProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (prefs: Omit<NavPreferences, 'setupComplete'>) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NavigationPreferencesSetup({
  open,
  onClose,
  onSave,
}: NavigationPreferencesSetupProps) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const platform = detectPlatform();
  const isIOS    = platform === 'ios';

  // Filter out Apple Maps on non-iOS
  const availableApps = APP_OPTIONS.filter(a => !a.iOSOnly || isIOS);

  const [prefs, setPrefs] = useState<Omit<NavPreferences, 'setupComplete'>>({
    walking: isIOS ? 'apple_maps' : 'google_maps',
    driving: isIOS ? 'apple_maps' : 'google_maps',
    transit: 'google_maps',
  });
  const [saving, setSaving] = useState(false);

  // Reset defaults when opened (in case platform changed)
  useEffect(() => {
    if (open) {
      setPrefs({
        walking: isIOS ? 'apple_maps' : 'google_maps',
        driving: isIOS ? 'apple_maps' : 'google_maps',
        transit: 'google_maps',
      });
    }
  }, [open, isIOS]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(prefs);
    setSaving(false);
  };

  const content = (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Navigation preferences</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Choose which map app to open for each travel mode. You can change this any time in settings.
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ mt: -0.5, mr: -0.5 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Mode selectors */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {MODES.map(({ key, label, Icon }) => (
          <Box key={key}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.06em' }}>
                {label}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {availableApps.map(app => {
                const selected = prefs[key] === app.value;
                return (
                  <Paper
                    key={app.value}
                    onClick={() => setPrefs(p => ({ ...p, [key]: app.value }))}
                    elevation={selected ? 2 : 0}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      backgroundColor: selected ? alpha('#6B7C5C', 0.08) : 'background.paper',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      minWidth: isMobile ? 'calc(50% - 4px)' : 120,
                      '&:active': { opacity: 0.85 },
                    }}
                  >
                    <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{app.emoji}</Typography>
                    <Typography
                      variant="body2"
                      fontWeight={selected ? 700 : 500}
                      color={selected ? 'primary.main' : 'text.primary'}
                      sx={{ lineHeight: 1.2 }}
                    >
                      {app.label}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Save button */}
      <Button
        variant="contained"
        fullWidth
        onClick={handleSave}
        disabled={saving}
        sx={{ mt: 3, py: isMobile ? 1.75 : 1.25, fontSize: isMobile ? '1rem' : undefined, borderRadius: 2 }}
      >
        {saving ? 'Saving…' : 'Save preferences & navigate'}
      </Button>
    </Box>
  );

  // ── Mobile: bottom sheet ── Desktop: centred dialog ───────────────────────
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius:  16,
            borderTopRightRadius: 16,
            px: 2.5,
            pt: 1.5,
            pb: 'max(env(safe-area-inset-bottom, 16px), 32px)',
            maxHeight: '90vh',
            overflowY: 'auto',
          },
        }}
      >
        {/* Drag pill */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.15) }} />
        </Box>
        {content}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ p: 3 }}>{content}</Box>
    </Dialog>
  );
}