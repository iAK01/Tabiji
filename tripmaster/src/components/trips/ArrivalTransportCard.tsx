'use client';

import React from 'react';
import {
  Box, Typography, Paper, Button, IconButton, alpha,
} from '@mui/material';
import LocalTaxiIcon      from '@mui/icons-material/LocalTaxi';
import DirectionsBusIcon  from '@mui/icons-material/DirectionsBus';
import TrainIcon          from '@mui/icons-material/Train';
import CloseIcon          from '@mui/icons-material/Close';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import { getCountryTransport, resolveServices } from '@/lib/data/ground-transport';
import { openApp } from '@/lib/utils/openApp';

const D = {
  terra:   '#C4714A',
  navy:    '#1D2642',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

const CATEGORY_COLOR: Record<string, string> = {
  ride:    D.terra,
  transit: '#0369a1',
  rail:    '#5c35a0',
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  ride:    LocalTaxiIcon,
  transit: DirectionsBusIcon,
  rail:    TrainIcon,
};

interface Props {
  countryCode: string;
  cityName:    string;
  onDismiss:   () => void;
}

export default function ArrivalTransportCard({ countryCode, cityName, onDismiss }: Props) {
  const data = getCountryTransport(countryCode);
  if (!data) return null;

  const rides   = resolveServices(data.rides);
  const transit = resolveServices(data.transit);

  if (rides.length === 0 && transit.length === 0) return null;

  const ridesAndRail  = [...resolveServices(data.rides)];
  const transitOnly   = resolveServices(data.transit);

  return (
    <Paper elevation={0} sx={{
      border:     `1.5px solid ${D.rule}`,
      borderTop:  `3px solid ${D.terra}`,
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${alpha(D.terra, 0.06)} 0%, transparent 60%)`,
      overflow:   'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        px: { xs: 2, sm: 2.5 },
        pt: 2,
        pb: 1.25,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            backgroundColor: alpha(D.terra, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <LocalTaxiIcon sx={{ fontSize: 19, color: D.terra }} />
          </Box>
          <Box>
            <Typography sx={{
              fontFamily: D.display,
              fontSize:   '1.05rem',
              color:       D.navy,
              lineHeight:  1.2,
            }}>
              Get to your hotel
            </Typography>
            <Typography sx={{
              fontFamily: D.body,
              fontSize:   '0.78rem',
              color:       D.muted,
            }}>
              {cityName}
            </Typography>
          </Box>
        </Box>

        <IconButton
          size="small"
          onClick={onDismiss}
          sx={{ p: 0.5, color: D.muted, '&:hover': { color: D.navy } }}
        >
          <CloseIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>

        {/* Rides */}
        {ridesAndRail.length > 0 && (
          <Box>
            <Typography sx={{
              fontFamily:    D.body,
              fontSize:      '0.65rem',
              fontWeight:    700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color:          D.muted,
              mb:             0.75,
            }}>
              Taxi / Ride
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {ridesAndRail.map(svc => {
                const color = CATEGORY_COLOR[svc.category] ?? D.terra;
                const Icon  = CATEGORY_ICON[svc.category] ?? LocalTaxiIcon;
                return (
                  <Button
                    key={svc.id}
                    onClick={() => openApp({ deepLink: svc.deepLink, iosStore: svc.iosStore, androidStore: svc.androidStore, webUrl: svc.webUrl })}
                    size="small"
                    startIcon={<Icon sx={{ fontSize: '0.85rem !important' }} />}
                    sx={{
                      minHeight:       28,
                      py:              0.4,
                      px:              1.25,
                      borderRadius:    '999px',
                      textTransform:   'none',
                      fontSize:        '0.78rem',
                      fontWeight:      700,
                      fontFamily:      D.body,
                      backgroundColor: alpha(color, 0.09),
                      color,
                      border:          `1px solid ${alpha(color, 0.18)}`,
                      '&:hover':       { backgroundColor: alpha(color, 0.16) },
                    }}
                  >
                    {svc.name}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Public transport */}
        {transitOnly.length > 0 && (
          <Box>
            <Typography sx={{
              fontFamily:    D.body,
              fontSize:      '0.65rem',
              fontWeight:    700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color:          D.muted,
              mb:             0.75,
            }}>
              Public Transport
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {transitOnly.map(svc => {
                const color = CATEGORY_COLOR[svc.category] ?? '#0369a1';
                const Icon  = CATEGORY_ICON[svc.category] ?? DirectionsBusIcon;
                return (
                  <Button
                    key={svc.id}
                    onClick={() => openApp({ deepLink: svc.deepLink, iosStore: svc.iosStore, androidStore: svc.androidStore, webUrl: svc.webUrl })}
                    size="small"
                    startIcon={<Icon sx={{ fontSize: '0.85rem !important' }} />}
                    sx={{
                      minHeight:       28,
                      py:              0.4,
                      px:              1.25,
                      borderRadius:    '999px',
                      textTransform:   'none',
                      fontSize:        '0.78rem',
                      fontWeight:      700,
                      fontFamily:      D.body,
                      backgroundColor: alpha(color, 0.09),
                      color,
                      border:          `1px solid ${alpha(color, 0.18)}`,
                      '&:hover':       { backgroundColor: alpha(color, 0.16) },
                    }}
                  >
                    {svc.name}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Cash warning */}
        {data.payment.cashHeavy && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.25 }}>
            <WarningAmberIcon sx={{ fontSize: 15, color: '#b45309', mt: '2px', flexShrink: 0 }} />
            <Typography sx={{
              fontFamily: D.body,
              fontSize:   '0.78rem',
              color:       '#b45309',
              lineHeight:  1.4,
            }}>
              {data.payment.note ?? `Cash is common in ${cityName} — withdraw local currency.`}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
