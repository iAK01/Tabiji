'use client';
// TransportCard.tsx → src/components/logistics/TransportCard.tsx

import { Box, IconButton, Paper, Typography } from '@mui/material';
import MoreVertIcon   from '@mui/icons-material/MoreVert';
import NavigateButton from '@/components/ui/NavigateButton';
import DestinationMap from '@/components/ui/DestinationMap';
import {
  D, DOT_COLOUR,
  transportIcon,
  type MenuKind,
} from './logistics.helpers';

interface TransportCardProps {
  t:           any;
  i:           number;
  onMenu:      (e: React.MouseEvent<HTMLElement>, kind: MenuKind, index: number) => void;
  fmtDateTime: (dt: string) => string;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const timeOnly = (dt: string) =>
  dt ? new Date(dt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

const dateShort = (dt: string) =>
  dt ? new Date(dt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '';

const duration = (dep: string, arr: string) => {
  if (!dep || !arr) return '';
  const mins = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ── Shared atoms ──────────────────────────────────────────────────────────────

const SectionTag = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{
    fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'text.secondary', display: 'block', mb: 0.5,
  }}>
    {children}
  </Typography>
);

const StatusPill = ({ status }: { status: string }) => {
  const color = DOT_COLOUR[status] ?? DOT_COLOUR.not_booked;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      px: 1.25, py: 0.4,
      bgcolor: `${color}14`,
      border: `1px solid ${color}28`,
      borderRadius: 99,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.72rem', fontFamily: D.body, fontWeight: 600, textTransform: 'capitalize', color }}>
        {status.replace('_', ' ')}
      </Typography>
    </Box>
  );
};

const GhostIcon = ({ type }: { type: string }) => (
  <Box sx={{
    position: 'absolute', right: -16, bottom: -16,
    opacity: 0.055, transform: 'rotate(-8deg)',
    pointerEvents: 'none', color: D.navy,
    '& .MuiSvgIcon-root': { fontSize: '10rem', width: '10rem', height: '10rem' },
  }}>
    {transportIcon(type, {})}
  </Box>
);

const VertRule = () => (
  <Box sx={{ width: '1px', bgcolor: 'rgba(29,38,66,0.10)', alignSelf: 'stretch', mx: 2.5, flexShrink: 0 }} />
);

const DashedRule = () => (
  <Box sx={{ flex: 1, borderTop: '1px dashed rgba(29,38,66,0.10)' }} />
);

// ── Type-specific hero sections ───────────────────────────────────────────────

function FlightHero({ t }: { t: any }) {
  const flightNum = t.details?.flightNumber ?? t.flightNumber ?? '';
  const airline   = t.details?.airline ?? t.airline ?? '';
  const from      = t.departureLocation ?? '';
  const to        = t.arrivalLocation ?? '';
  const seat      = t.details?.seat ?? t.seat ?? '';
  const cabin     = t.details?.cabin ?? '';

  return (
    <Box sx={{ display: 'flex', pt: 2.5, px: 2.5 }}>
      {/* LEFT: identifier */}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.5rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {flightNum || 'Flight'}
        </Typography>
        {airline && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.secondary', mt: 0.5 }}>
            {airline}
          </Typography>
        )}
        {(from || to) && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
            {from && to ? `${from} → ${to}` : (from || to)}
          </Typography>
        )}
      </Box>

      {/* DIVIDER */}
      {seat && <VertRule />}

      {/* RIGHT: seat hero */}
      {seat && (
        <Box sx={{ textAlign: 'right', minWidth: 80, flexShrink: 0 }}>
          <SectionTag>Seat</SectionTag>
          <Typography sx={{ fontFamily: D.display, fontSize: '3.2rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
            {seat}
          </Typography>
          {cabin && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {cabin}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function TrainBusFerryHero({ t }: { t: any }) {
  const from     = t.departureLocation ?? '';
  const to       = t.arrivalLocation ?? '';
  const operator = t.details?.operator ?? '';
  const subtype  = t.details?.railSubtype ?? '';
  const seat     = t.details?.seat ?? t.seat ?? '';
  const cabin    = t.details?.cabin ?? '';

  return (
    <Box sx={{ display: 'flex', pt: 2.5, px: 2.5 }}>
      {/* LEFT: route hero */}
      <Box sx={{ flex: 1 }}>
        <SectionTag>Route</SectionTag>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {from && to
            ? <>{from}<br />→ {to}</>
            : (from || to || 'Journey')}
        </Typography>
        {(operator || subtype) && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.75 }}>
            {[operator, subtype].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>

      {/* RIGHT: seat hero */}
      {seat && (
        <>
          <VertRule />
          <Box sx={{ textAlign: 'right', minWidth: 80, flexShrink: 0 }}>
            <SectionTag>Coach / Seat</SectionTag>
            <Typography sx={{ fontFamily: D.display, fontSize: '2.4rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {seat}
            </Typography>
            {cabin && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {cabin}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

function TaxiTransferHero({ t }: { t: any }) {
  const from    = t.departureLocation ?? '';
  const to      = t.arrivalLocation ?? '';
  const depTime = timeOnly(t.departureTime);
  const depDate = dateShort(t.departureTime);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5, pt: 2.5, px: 2.5 }}>
      <Box>
        <SectionTag>Pickup</SectionTag>
        <Typography sx={{ fontFamily: D.display, fontSize: '3.8rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {depTime || '—'}
        </Typography>
        {depDate && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
            {depDate}
          </Typography>
        )}
      </Box>
      {(from || to) && (
        <Box sx={{ flex: 1, pt: 3.5 }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.navy, fontWeight: 600 }}>
            {from || '—'}
          </Typography>
          {to && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              → {to}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function CarHireHero({ t }: { t: any }) {
  const company = t.details?.rentalCompany ?? '';
  const vehicle = t.details?.vehicle ?? '';
  const pickup  = t.details?.pickupLocation ?? t.departureLocation ?? '';
  const dropoff = t.details?.dropoffLocation ?? t.arrivalLocation ?? '';
  const depTime = t.departureTime ? `${timeOnly(t.departureTime)} · ${dateShort(t.departureTime)}` : '';
  const arrTime = t.arrivalTime   ? `${timeOnly(t.arrivalTime)} · ${dateShort(t.arrivalTime)}`   : '';

  return (
    <Box sx={{ pt: 2.5, px: 2.5 }}>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.5rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {company || 'Car hire'}
      </Typography>
      {vehicle && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.secondary', mt: 0.5 }}>
          {vehicle}
        </Typography>
      )}
      {(pickup || depTime) && (
        <Box sx={{ mt: 1.25 }}>
          <SectionTag>Pickup</SectionTag>
          {depTime && (
            <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy, lineHeight: 1 }}>
              {depTime}
            </Typography>
          )}
          {pickup && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              {pickup}
            </Typography>
          )}
        </Box>
      )}
      {(dropoff || arrTime) && (
        <Box sx={{ mt: 1 }}>
          <SectionTag>Drop-off</SectionTag>
          {arrTime && (
            <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy, lineHeight: 1 }}>
              {arrTime}
            </Typography>
          )}
          {dropoff && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              {dropoff}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function CarBicycleHero({ t }: { t: any }) {
  const from    = t.departureLocation ?? '';
  const to      = t.arrivalLocation ?? '';
  const vehicle = t.details?.vehicle ?? '';

  return (
    <Box sx={{ pt: 2.5, px: 2.5 }}>
      <SectionTag>Route</SectionTag>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {from && to
          ? <>{from}<br />→ {to}</>
          : (from || to || (t.type === 'bicycle' ? 'Bicycle' : 'Drive'))}
      </Typography>
      {vehicle && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.75 }}>
          {vehicle}
        </Typography>
      )}
    </Box>
  );
}

// ── Bottom time + ref strip ───────────────────────────────────────────────────

function TimeRefStrip({ t, type }: { t: any; type: string }) {
  if (['taxi', 'private_transfer', 'car_hire'].includes(type)) {
    // For these types time is already in the hero — just show ref
    if (!t.confirmationNumber && !t.cost) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pb: 2.5 }}>
        {t.confirmationNumber && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.0rem', color: D.terra, letterSpacing: '0.06em' }}>
            {t.confirmationNumber}
          </Typography>
        )}
        {t.cost && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', ml: 1.5 }}>
            €{t.cost}
          </Typography>
        )}
      </Box>
    );
  }

  const depTime = timeOnly(t.departureTime);
  const arrTime = timeOnly(t.arrivalTime);
  const depDate = dateShort(t.departureTime);
  const dur     = duration(t.departureTime, t.arrivalTime);
  const durLabel = type === 'flight' ? `${dur} flight` : dur;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pb: 2.5, gap: 2 }}>
      <Box>
        {(depTime || arrTime) && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.4rem', color: D.navy, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {depTime}{arrTime ? ` → ${arrTime}` : ''}
          </Typography>
        )}
        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.4 }}>
          {[depDate, durLabel].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Box sx={{ ml: 'auto', textAlign: 'right' }}>
        {t.confirmationNumber && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.0rem', color: D.terra, letterSpacing: '0.06em' }}>
            {t.confirmationNumber}
          </Typography>
        )}
        {t.cost && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            €{t.cost}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── Map target logic ──────────────────────────────────────────────────────────

function getMapTarget(t: any) {
  if (t.type === 'flight') return null;
  if (['car', 'bicycle'].includes(t.type)) {
    return t.arrivalLocation ? { address: t.arrivalLocation, coordinates: t.arrivalCoordinates ?? null } : null;
  }
  const address = t.departureLocation ?? t.details?.pickupLocation ?? '';
  return address ? { address, coordinates: t.departureCoordinates ?? t.details?.pickupCoordinates ?? null } : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TransportCard({ t, i, onMenu }: TransportCardProps) {
  const mapTarget = getMapTarget(t);
  const navDest   = mapTarget ? { name: mapTarget.address, address: mapTarget.address, coordinates: mapTarget.coordinates } : null;

  const renderHero = () => {
    switch (t.type) {
      case 'flight':           return <FlightHero t={t} />;
      case 'train':
      case 'bus':
      case 'ferry':            return <TrainBusFerryHero t={t} />;
      case 'car_hire':         return <CarHireHero t={t} />;
      case 'taxi':
      case 'private_transfer': return <TaxiTransferHero t={t} />;
      case 'car':
      case 'bicycle':          return <CarBicycleHero t={t} />;
      default:                 return <TrainBusFerryHero t={t} />;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: D.paper,
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderRadius: mapTarget ? '12px 12px 0 0' : '12px',
          borderBottom: mapTarget ? 'none' : undefined,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <GhostIcon type={t.type} />

        {/* Hero section */}
        {renderHero()}

        {/* Dashed strip: status + nav + more vert */}
        <Box sx={{ display: 'flex', alignItems: 'center', mx: 2.5, my: 1.5, gap: 1 }}>
          <DashedRule />
          {navDest && (
            <NavigateButton destination={navDest} suggestedMode="driving" size="medium" />
          )}
          <StatusPill status={t.status} />
          <IconButton size="small" onClick={e => onMenu(e, 'transport', i)} sx={{ ml: 0.25 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Time + ref strip */}
        <TimeRefStrip t={t} type={t.type} />
      </Paper>

      {mapTarget && (
        <Box sx={{
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderTop: 'none',
        }}>
          <DestinationMap coordinates={mapTarget.coordinates} address={mapTarget.address} />
        </Box>
      )}
    </Box>
  );
}