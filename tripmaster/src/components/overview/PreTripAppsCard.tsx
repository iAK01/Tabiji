'use client';

import React from 'react';
import {
  Box, Typography, Paper, Button, alpha,
} from '@mui/material';
import DownloadIcon      from '@mui/icons-material/Download';
import LocalTaxiIcon     from '@mui/icons-material/LocalTaxi';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import TrainIcon         from '@mui/icons-material/Train';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import { getCountryTransport, resolvePreDownload } from '@/lib/data/ground-transport';
import { openApp } from '@/lib/utils/openApp';

const D = {
  terra:   '#C4714A',
  navy:    '#1D2642',
  green:   '#6B7C5C',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

const CATEGORY_COLOR: Record<string, string> = {
  ride:    D.terra,
  transit: '#0369a1',
  rail:    '#5c35a0',
};

const CATEGORY_LABEL: Record<string, string> = {
  ride:    'Taxi / Ride',
  transit: 'Transit',
  rail:    'Rail',
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  ride:    LocalTaxiIcon,
  transit: DirectionsBusIcon,
  rail:    TrainIcon,
};

interface Props {
  countryCode: string;
  cityName:    string;
}

export default function PreTripAppsCard({ countryCode, cityName }: Props) {
  const data = getCountryTransport(countryCode);
  if (!data) return null;

  const apps = resolvePreDownload(data.preDownload);
  if (apps.length === 0) return null;

  return (
    <Paper elevation={0} sx={{
      border:       `1.5px solid ${D.rule}`,
      borderTop:    `3px solid ${D.green}`,
      borderRadius: '12px',
      background:   `linear-gradient(135deg, ${alpha(D.green, 0.05)} 0%, transparent 60%)`,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        display:    'flex',
        alignItems: 'center',
        gap:         1,
        px: { xs: 2, sm: 2.5 },
        pt:          2,
        pb:          1.25,
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '10px',
          backgroundColor: alpha(D.green, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <DownloadIcon sx={{ fontSize: 19, color: D.green }} />
        </Box>
        <Box>
          <Typography sx={{
            fontFamily: D.display,
            fontSize:   '1.05rem',
            color:       D.navy,
            lineHeight:  1.2,
          }}>
            Before you go
          </Typography>
          <Typography sx={{
            fontFamily: D.body,
            fontSize:   '0.78rem',
            color:       D.muted,
          }}>
            These apps for {cityName} might be worth downloading before your trip.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {apps.map(svc => {
          const color     = CATEGORY_COLOR[svc.category] ?? D.navy;
          const Icon      = CATEGORY_ICON[svc.category] ?? DirectionsBusIcon;
          const catLabel  = CATEGORY_LABEL[svc.category] ?? svc.category;

          return (
            <Box
              key={svc.id}
              sx={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:             1,
                py:              0.75,
                borderBottom:   `1px solid ${D.rule}`,
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{
                  width: 30, height: 30, borderRadius: '8px',
                  backgroundColor: alpha(color, 0.10),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon sx={{ fontSize: 15, color }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{
                    fontFamily: D.body,
                    fontSize:   '0.88rem',
                    fontWeight:  700,
                    color:       D.navy,
                    lineHeight:  1.3,
                  }}>
                    {svc.name}
                  </Typography>
                  <Typography sx={{
                    fontFamily: D.body,
                    fontSize:   '0.72rem',
                    color:       D.muted,
                    lineHeight:  1.35,
                  }}>
                    {svc.reason}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Box sx={{
                  px: 0.75, py: 0.2,
                  borderRadius: '4px',
                  backgroundColor: alpha(color, 0.08),
                  border: `1px solid ${alpha(color, 0.15)}`,
                }}>
                  <Typography sx={{
                    fontFamily:    D.body,
                    fontSize:      '0.62rem',
                    fontWeight:    700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color,
                  }}>
                    {catLabel}
                  </Typography>
                </Box>

                <Button
                  onClick={() => openApp({ deepLink: svc.deepLink, iosStore: svc.iosStore, androidStore: svc.androidStore, webUrl: svc.webUrl })}
                  size="small"
                  sx={{
                    minHeight:       26,
                    py:              0.3,
                    px:              1,
                    borderRadius:    '6px',
                    textTransform:   'none',
                    fontSize:        '0.75rem',
                    fontWeight:      700,
                    fontFamily:      D.body,
                    backgroundColor: alpha(color, 0.09),
                    color,
                    border:          `1px solid ${alpha(color, 0.18)}`,
                    '&:hover':       { backgroundColor: alpha(color, 0.16) },
                  }}
                >
                  Get
                </Button>
              </Box>
            </Box>
          );
        })}

        {/* Cash warning */}
        {data.payment.cashHeavy && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, pt: 0.75 }}>
            <WarningAmberIcon sx={{ fontSize: 14, color: '#b45309', mt: '2px', flexShrink: 0 }} />
            <Typography sx={{
              fontFamily: D.body,
              fontSize:   '0.78rem',
              color:       '#b45309',
              lineHeight:  1.4,
            }}>
              {data.payment.note ?? `Cash is common in ${cityName} — withdraw local currency before you go.`}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
