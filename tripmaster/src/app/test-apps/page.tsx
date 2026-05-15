'use client';

import { Box, Typography, Button, Chip, alpha } from '@mui/material';
import { TRANSPORT_SERVICES, MY_APPS_CATALOG } from '@/lib/data/ground-transport';
import { openApp } from '@/lib/utils/openApp';

const D = {
  navy: '#1D2642',
  body: '"Archivo", "Inter", sans-serif',
  display: '"Archivo Black", sans-serif',
  rule: 'rgba(29,38,66,0.10)',
  muted: 'rgba(29,38,66,0.45)',
};

export default function TestAppsPage() {
  const allTestApps = MY_APPS_CATALOG.flatMap(g => g.ids)
    .map(id => TRANSPORT_SERVICES[id])
    .filter(Boolean);

  return (
    <Box sx={{ p: 3, maxWidth: 480, mx: 'auto', fontFamily: D.body }}>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.3rem', color: D.navy, mb: 0.5 }}>
        Deep Link Test
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: D.muted, mb: 3 }}>
        Tap each button — on mobile it should open the app (if installed) or redirect to the store.
        On desktop it opens the web URL.
      </Typography>

      {MY_APPS_CATALOG.map(group => {
        const svcs = group.ids.map(id => TRANSPORT_SERVICES[id]).filter(Boolean);
        return (
          <Box key={group.category} sx={{ mb: 3 }}>
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: D.muted, mb: 1,
            }}>
              {group.label}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {svcs.map(svc => (
                <Box key={svc.id} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: `1px solid ${D.rule}`, borderRadius: '10px', px: 1.5, py: 1,
                }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: D.navy }}>
                      {svc.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: D.muted }}>
                      {svc.deepLink
                        ? `deep link → app (store fallback if not installed)`
                        : svc.iosStore
                          ? `no deep link → App Store`
                          : `no deep link → opens website`}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => openApp({
                      deepLink:     svc.deepLink,
                      iosStore:     svc.iosStore,
                      androidStore: svc.androidStore,
                      webUrl:       svc.webUrl,
                    })}
                    sx={{
                      fontFamily: D.body, fontWeight: 700, textTransform: 'none',
                      fontSize: '0.78rem', borderRadius: '8px', flexShrink: 0,
                      backgroundColor: D.navy, '&:hover': { backgroundColor: '#2d3a5e' },
                    }}
                  >
                    Open
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
