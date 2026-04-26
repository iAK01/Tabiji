'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, Collapse, IconButton,
  Tooltip, alpha, Divider,
} from '@mui/material';
import OpenInNewIcon    from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import ExpandLessIcon   from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FlightIcon       from '@mui/icons-material/Flight';
import TrainIcon        from '@mui/icons-material/Train';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import SpeedIcon        from '@mui/icons-material/Speed';
import LoungeIcon       from '@mui/icons-material/AirlineSeatReclineExtra';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';

interface BookingLinksProps {
  originIata:         string | undefined;
  destIata:           string | undefined;
  originCity:         string;
  destCity:           string;
  startDate:          string;  // ISO date string
  endDate:            string;  // ISO date string
  fallbackOriginIata?: string;
  fallbackOriginCity?: string;
}


// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── URL builders ─────────────────────────────────────────────────────────────
function iso(dt: string) { return dt.split('T')[0]; }

const BOOKING_LINKS = [
  {
    name:    'Ryanair',
    colour:  '#073590',
    buildUrl: (o: string, d: string, dep: string, ret: string) =>
      `https://www.ryanair.com/ie/en/trip/flights/select?adults=1&teens=0&children=0&infants=0` +
      `&dateOut=${iso(dep)}&dateIn=${iso(ret)}&isConnectedFlight=false&isReturn=true` +
      `&originIata=${o}&destinationIata=${d}` +
      `&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0` +
      `&tpStartDate=${iso(dep)}&tpEndDate=${iso(ret)}&tpOriginIata=${o}&tpDestinationIata=${d}`,
  },
  {
    name:    'Skyscanner',
    colour:  '#0770e3',
    buildUrl: (o: string, d: string, dep: string, ret: string) => {
      const [dy, dm, dd] = iso(dep).split('-');
      const [ry, rm, rd] = iso(ret).split('-');
      const oym = `${dy.slice(2)}${dm}`;
      const iym = `${ry.slice(2)}${rm}`;
      return `https://www.skyscanner.ie/transport/flights/${o.toLowerCase()}/${d.toLowerCase()}/` +
        `?adultsv2=1&cabinclass=economy&childrenv2=&ref=home&rtn=1` +
        `&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false` +
        `&oym=${oym}&selectedoday=${dd}&iym=${iym}&selectediday=${rd}`;
    },
  },
  {
    name:    'Kiwi.com',
    colour:  '#e5432a',
    buildUrl: (o: string, d: string, dep: string, ret: string) =>
      `https://www.kiwi.com/deep?from=${o}&to=${d}&departure=${iso(dep)}&return=${iso(ret)}`,
  },
  {
    name:    'Google Flights',
    colour:  '#1a73e8',
    buildUrl: (o: string, d: string, dep: string, ret: string) =>
      `https://www.google.com/travel/flights?q=Flights+from+${o}+to+${d}+on+${iso(dep)}+returning+${iso(ret)}`,
  },
];

// ─── Static ground / airport links ────────────────────────────────────────────
// On mobile, if the app is installed the OS intercepts the https:// URL and
// opens the native app — no custom URI scheme needed.
const GROUND_LINKS = [
  {
    name:    'Trainline',
    colour:  '#00b14f',
    Icon:    TrainIcon,
    url:     'https://www.thetrainline.com',
    tooltip: 'Search and book train tickets',
  },
  {
    name:    'DAA Parking',
    colour:  '#003082',
    Icon:    LocalParkingIcon,
    url:     'https://www.dublinairport.com/car-parks',
    tooltip: 'Book parking at Dublin Airport',
  },
  {
    name:    'FastTrack',
    colour:  '#e84c1e',
    Icon:    SpeedIcon,
    url:     'https://www.dublinairport.com/enhance-your-journey/fast-track',
    tooltip: 'Book Dublin Airport FastTrack security',
  },
  {
    name:    'Airport Bus',
    colour:  '#4a2882',
    Icon:    DirectionsBusIcon,
    url:     'https://www.dublincoach.ie',
    tooltip: 'Dublin Coach — city to airport',
  },
  {
    name:    'Lounge',
    colour:  '#8b6914',
    Icon:    LoungeIcon,
    url:     'https://www.dublinairport.com/enhance-your-journey/lounges',
    tooltip: 'Book a lounge at Dublin Airport',
  },
];

// ─── Shared chip renderer ─────────────────────────────────────────────────────
function LinkChip({
  name, colour, url, icon, tooltip,
}: {
  name: string; colour: string; url: string;
  icon: React.ReactNode; tooltip?: string;
}) {
  const chip = (
    <Chip
      label={name}
      icon={<Box sx={{ display: 'flex', alignItems: 'center', '& svg': { fontSize: '0.9rem !important' } }}>{icon}</Box>}
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      clickable
      sx={{
        fontWeight: 700,
        fontSize: '0.8rem',
        fontFamily: D.body,
        backgroundColor: alpha(colour, 0.1),
        color: colour,
        border: `1px solid ${alpha(colour, 0.25)}`,
        '&:hover': { backgroundColor: alpha(colour, 0.18) },
      }}
    />
  );
  return tooltip ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BookingLinks({
  originIata, destIata, originCity, destCity, startDate, endDate,
  fallbackOriginIata, fallbackOriginCity,
}: BookingLinksProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!document.querySelector('#archivo-font')) {
      const link = document.createElement('link');
      link.id   = 'archivo-font';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const hasIata      = !!(originIata && destIata);
  const hasFallback  = !!(fallbackOriginIata && destIata && fallbackOriginIata !== originIata);
  const routeLabel   = `${originIata ?? originCity} → ${destIata ?? destCity}`;

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, overflow: 'hidden', backgroundColor: D.paper, borderColor: hasIata ? D.rule : 'warning.light' }}
    >
      {/* Header row — always visible */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          cursor: 'pointer', userSelect: 'none',
          backgroundColor: open ? alpha(D.green, 0.05) : 'transparent',
          '&:hover': { backgroundColor: alpha(D.green, 0.05) },
          transition: 'background-color 0.15s',
        }}
      >
        <Typography sx={{ flexGrow: 1, fontFamily: D.display, fontSize: '1rem', color: D.navy, letterSpacing: '-0.01em' }}>
          Quick links — {routeLabel}
        </Typography>

        {!hasIata && (
          <Tooltip title="Add airport IATA codes to your trip to enable pre-filled flight links">
            <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          </Tooltip>
        )}

        <IconButton size="small" sx={{ p: 0 }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5, pt: 0.5 }}>

          {/* ── Flight search ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FlightIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Flight search
            </Typography>
          </Box>

          {!hasIata ? (
            <Typography sx={{ fontSize: '0.78rem', fontFamily: D.body, color: D.muted }}>
              IATA codes missing on origin or destination. Edit your trip to add the nearest airport for each location and these links will populate automatically.
            </Typography>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.78rem', fontFamily: D.body, color: D.muted, display: 'block', mb: 1.5 }}>
                Opens with your route and dates pre-filled.
              </Typography>

              {/* Primary origin row */}
              {hasFallback && (
                <Typography sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, color: D.navy, mb: 0.75, opacity: 0.6 }}>
                  {originIata} → {destIata}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: hasFallback ? 2 : 0 }}>
                {BOOKING_LINKS.map(link => (
                  <LinkChip
                    key={link.name}
                    name={link.name}
                    colour={link.colour}
                    url={link.buildUrl(originIata!, destIata!, startDate, endDate)}
                    icon={<OpenInNewIcon />}
                  />
                ))}
              </Box>

              {/* Fallback origin row */}
              {hasFallback && (
                <>
                  <Typography sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, color: D.navy, mb: 0.75, opacity: 0.6 }}>
                    {fallbackOriginIata} → {destIata}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {BOOKING_LINKS.map(link => (
                      <LinkChip
                        key={link.name}
                        name={link.name}
                        colour={link.colour}
                        url={link.buildUrl(fallbackOriginIata!, destIata!, startDate, endDate)}
                        icon={<OpenInNewIcon />}
                      />
                    ))}
                  </Box>
                </>
              )}
            </>
          )}

          {/* ── Ground / airport ── */}
          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TrainIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Airport & ground
            </Typography>
          </Box>

          <Typography sx={{ fontSize: '0.78rem', fontFamily: D.body, color: D.muted, display: 'block', mb: 1.5 }}>
            Opens in browser or native app if installed.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {GROUND_LINKS.map(link => (
              <LinkChip
                key={link.name}
                name={link.name}
                colour={link.colour}
                url={link.url}
                icon={<link.Icon />}
                tooltip={link.tooltip}
              />
            ))}
          </Box>

        </Box>
      </Collapse>
    </Paper>
  );
}