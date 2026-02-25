'use client';

import { useState } from 'react';
import {
  Box, Typography, Paper, Chip, Collapse, IconButton,
  Tooltip, alpha,
} from '@mui/material';
import OpenInNewIcon    from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import ExpandLessIcon   from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface BookingLinksProps {
  originIata:   string | undefined;
  destIata:     string | undefined;
  originCity:   string;
  destCity:     string;
  startDate:    string;  // ISO date string
  endDate:      string;  // ISO date string
}

interface Airline {
  name:      string;
  iata:      string;
  colour:    string;
  buildUrl:  (o: string, d: string, dep: string, ret: string) => string;
  note?:     string;
}

// ─── URL builders ─────────────────────────────────────────────────────────────
// Dates arrive as ISO datetime strings — strip to YYYY-MM-DD
function iso(dt: string) { return dt.split('T')[0]; }

const AIRLINES: Airline[] = [
  {
    name:    'Ryanair',
    iata:    'FR',
    colour:  '#073590',
    buildUrl: (o, d, dep, ret) =>
      `https://www.ryanair.com/ie/en/trip/flights/select?adults=1&teens=0&children=0&infants=0` +
      `&dateOut=${iso(dep)}&dateIn=${iso(ret)}&isConnectedFlight=false&isReturn=true` +
      `&originIata=${o}&destinationIata=${d}` +
      `&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0` +
      `&tpStartDate=${iso(dep)}&tpEndDate=${iso(ret)}&tpOriginIata=${o}&tpDestinationIata=${d}`,
  },
  {
    name:    'Aer Lingus',
    iata:    'EI',
    colour:  '#00784a',
    buildUrl: (o, d, dep, ret) =>
      `https://www.aerlingus.com/travel-information/flight-search/?` +
      `originIATA=${o}&destinationIATA=${d}` +
      `&departureDate=${iso(dep)}&returnDate=${iso(ret)}&adults=1&children=0&infants=0`,
  },
  {
    name:    'EasyJet',
    iata:    'U2',
    colour:  '#ff6600',
    buildUrl: (o, d, dep, ret) =>
      `https://www.easyjet.com/en/cheap-flights/${o.toLowerCase()}-${d.toLowerCase()}` +
      `?departDate=${iso(dep)}&returnDate=${iso(ret)}&adults=1`,
  },
  {
    name:    'Lufthansa',
    iata:    'LH',
    colour:  '#05164d',
    buildUrl: (o, d, dep, ret) =>
      `https://www.lufthansa.com/us/en/flight-search` +
      `?origin=${o}&destination=${d}&departureDate=${iso(dep)}&returnDate=${iso(ret)}&adults=1&cabinClass=Y`,
  },
  {
    name:    'British Airways',
    iata:    'BA',
    colour:  '#075aaa',
    buildUrl: (o, d, dep, ret) =>
      `https://www.britishairways.com/travel/booking/public/en_gb?eId=106002` +
      `&from=${o}&to=${d}&depart=${iso(dep).replace(/-/g, '')}&return=${iso(ret).replace(/-/g, '')}&adult=1`,
  },
  {
    name:    'Wizz Air',
    iata:    'W6',
    colour:  '#c6007e',
    buildUrl: (o, d, dep, ret) =>
      `https://wizzair.com/en-gb/booking/select-flight/${o}/${d}/${iso(dep)}/${iso(ret)}/1/0/0/null`,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BookingLinks({
  originIata, destIata, originCity, destCity, startDate, endDate,
}: BookingLinksProps) {
  const [open, setOpen] = useState(false);

  const hasIata   = !!(originIata && destIata);
  const routeLabel = `${originIata ?? originCity} → ${destIata ?? destCity}`;

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, overflow: 'hidden', borderColor: hasIata ? 'divider' : 'warning.light' }}
    >
      {/* Header row — always visible */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          cursor: 'pointer', userSelect: 'none',
          backgroundColor: open ? alpha('#55702C', 0.04) : 'transparent',
          '&:hover': { backgroundColor: alpha('#55702C', 0.04) },
          transition: 'background-color 0.15s',
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
          🔗 Quick booking links — {routeLabel}
        </Typography>

        {!hasIata && (
          <Tooltip title="Add airport IATA codes to your trip to enable pre-filled links">
            <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          </Tooltip>
        )}

        <IconButton size="small" sx={{ p: 0 }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Airline link chips */}
      <Collapse in={open}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pt: 0.5 }}>
          {!hasIata ? (
            <Typography variant="caption" color="text.secondary">
              IATA codes missing on origin or destination. Edit your trip to add the nearest airport for each location and these links will populate automatically.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Opens each airline with your route and dates pre-filled. Links may break if the airline updates their booking flow.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {AIRLINES.map(airline => (
                  <Chip
                    key={airline.iata}
                    label={airline.name}
                    icon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}
                    component="a"
                    href={airline.buildUrl(originIata!, destIata!, startDate, endDate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      backgroundColor: alpha(airline.colour, 0.1),
                      color: airline.colour,
                      border: `1px solid ${alpha(airline.colour, 0.25)}`,
                      '&:hover': {
                        backgroundColor: alpha(airline.colour, 0.18),
                      },
                    }}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}