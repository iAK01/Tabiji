'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, ButtonBase, alpha,
} from '@mui/material';
import RocketLaunchIcon    from '@mui/icons-material/RocketLaunch';
import LocalTaxiIcon       from '@mui/icons-material/LocalTaxi';
import DirectionsBusIcon   from '@mui/icons-material/DirectionsBus';
import TrainIcon           from '@mui/icons-material/Train';
import MapIcon             from '@mui/icons-material/Map';
import FlightIcon          from '@mui/icons-material/Flight';
import HotelIcon           from '@mui/icons-material/Hotel';
import LuggageIcon         from '@mui/icons-material/Luggage';
import { TRANSPORT_SERVICES } from '@/lib/data/ground-transport';
import { openApp } from '@/lib/utils/openApp';

const D = {
  navy:    '#1D2642',
  terra:   '#C4714A',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

const CATEGORY_COLOR: Record<string, string> = {
  ride:            D.terra,
  transit:         '#0369a1',
  rail:            '#5c35a0',
  navigation:      '#0f766e',
  airline:         '#0369a1',
  accommodation:   '#b45309',
  trip_management: '#64748b',
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  ride:            LocalTaxiIcon,
  transit:         DirectionsBusIcon,
  rail:            TrainIcon,
  navigation:      MapIcon,
  airline:         FlightIcon,
  accommodation:   HotelIcon,
  trip_management: LuggageIcon,
};

interface Props {
  myAppIds: string[];
}

export default function QuickLaunchCard({ myAppIds }: Props) {
  if (myAppIds.length === 0) return null;

  const apps = myAppIds
    .map(id => TRANSPORT_SERVICES[id])
    .filter(Boolean);

  if (apps.length === 0) return null;

  return (
    <Paper elevation={0} sx={{
      border:       `1.5px solid ${D.rule}`,
      borderTop:    `3px solid ${D.navy}`,
      borderRadius: '12px',
      background:   `linear-gradient(135deg, ${alpha(D.navy, 0.04)} 0%, transparent 60%)`,
      overflow:     'hidden',
    }}>
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
          backgroundColor: alpha(D.navy, 0.10),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <RocketLaunchIcon sx={{ fontSize: 18, color: D.navy }} />
        </Box>
        <Box>
          <Typography sx={{
            fontFamily: D.display,
            fontSize:   '1.05rem',
            color:       D.navy,
            lineHeight:  1.2,
          }}>
            My Apps
          </Typography>
          <Typography sx={{
            fontFamily: D.body,
            fontSize:   '0.78rem',
            color:       D.muted,
          }}>
            Tap to open
          </Typography>
        </Box>
      </Box>

      <Box sx={{
        px: { xs: 2, sm: 2.5 },
        pb: 2,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
      }}>
        {apps.map(svc => {
          const color = CATEGORY_COLOR[svc.category] ?? D.navy;
          const Icon  = CATEGORY_ICON[svc.category] ?? RocketLaunchIcon;
          return (
            <ButtonBase
              key={svc.id}
              onClick={() => openApp({
                deepLink:    svc.deepLink,
                iosStore:    svc.iosStore,
                androidStore: svc.androidStore,
                webUrl:      svc.webUrl,
              })}
              sx={{
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'center',
                gap:              0.5,
                width:            72,
                height:           72,
                borderRadius:    '14px',
                backgroundColor:  alpha(color, 0.08),
                border:          `1px solid ${alpha(color, 0.16)}`,
                transition:      'background-color 0.15s',
                '&:active': { backgroundColor: alpha(color, 0.18) },
              }}
            >
              <Icon sx={{ fontSize: 22, color }} />
              <Typography sx={{
                fontFamily: D.body,
                fontSize:   '0.62rem',
                fontWeight:  700,
                color:       D.navy,
                textAlign:  'center',
                lineHeight:  1.2,
                px:          0.5,
              }}>
                {svc.name}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Paper>
  );
}
