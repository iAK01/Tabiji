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
  originIata:  string | undefined;
  destIata:    string | undefined;
  originCity:  string;
  destCity:    string;
  startDate:   string;  // ISO date string
  endDate:     string;  // ISO date string
}

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
    name:    'Google Flights',
    colour:  '#1a73e8',
    buildUrl: (o: string, d: string, dep: string, ret: string) =>
      `https://www.google.com/travel/flights?q=Flights+from+${o}+to+${d}+on+${iso(dep)}+returning+${iso(ret)}`,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BookingLinks({
  originIata, destIata, originCity, destCity, startDate, endDate,
}: BookingLinksProps) {
  const [open, setOpen] = useState(false);

  const hasIata    = !!(originIata && destIata);
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

      {/* Booking link chips */}
      <Collapse in={open}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pt: 0.5 }}>
          {!hasIata ? (
            <Typography variant="caption" color="text.secondary">
              IATA codes missing on origin or destination. Edit your trip to add the nearest airport for each location and these links will populate automatically.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Opens with your route and dates pre-filled.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {BOOKING_LINKS.map(link => (
                  <Chip
                    key={link.name}
                    label={link.name}
                    icon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}
                    component="a"
                    href={link.buildUrl(originIata!, destIata!, startDate, endDate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      backgroundColor: alpha(link.colour, 0.1),
                      color: link.colour,
                      border: `1px solid ${alpha(link.colour, 0.25)}`,
                      '&:hover': { backgroundColor: alpha(link.colour, 0.18) },
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