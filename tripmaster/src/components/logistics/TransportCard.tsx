'use client';

import { useState } from 'react';
import { Box, Button, IconButton, Paper, Snackbar, Typography } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MoreVertIcon   from '@mui/icons-material/MoreVert';
import ShareIcon      from '@mui/icons-material/Share';
import NavigateButton from '@/components/ui/NavigateButton';
import DestinationMap from '@/components/ui/DestinationMap';
import {
  D, DOT_COLOUR, TRANSPORT_COLORS,
  transportIcon,
  type MenuKind,
} from './logistics.helpers';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TransportCardProps {
  t:              any;
  i:              number;
  onMenu:         (e: React.MouseEvent<HTMLElement>, kind: MenuKind, index: number) => void;
  fmtDateTime:    (dt: string) => string;
  linkedFiles?:   any[];
  onOpenFile?:    (f: any) => void;
  sequenceLabel?: string;
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

// ── Atoms ─────────────────────────────────────────────────────────────────────

const Tag = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{
    fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'text.secondary', display: 'block', mb: 0.4,
  }}>
    {children}
  </Typography>
);

const StatusPill = ({ status }: { status: string }) => {
  const color = DOT_COLOUR[status] ?? DOT_COLOUR.not_booked;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      px: 1.25, py: 0.5,
      bgcolor: `${color}18`,
      border: `1px solid ${color}30`,
      borderRadius: 99,
      flexShrink: 0,
    }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: '0.75rem', fontFamily: D.body, fontWeight: 700, textTransform: 'capitalize', color }}>
        {status.replace('_', ' ')}
      </Typography>
    </Box>
  );
};

// ── Hero sections ─────────────────────────────────────────────────────────────

function FlightHero({ t, sequenceLabel }: { t: any; sequenceLabel?: string }) {
  const flightNum = t.details?.flightNumber ?? t.flightNumber ?? '';
  const airline   = t.details?.airline ?? t.airline ?? '';
  const from      = t.departureLocation ?? '';
  const to        = t.arrivalLocation ?? '';
  const seat      = t.details?.seat ?? t.seat ?? '';
  const cabin     = t.details?.cabin ?? '';

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {sequenceLabel && <Tag>{sequenceLabel}</Tag>}
        <Typography sx={{ fontFamily: D.display, fontSize: '2rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {flightNum || 'Flight'}
        </Typography>
        {airline && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            {airline}
          </Typography>
        )}
        {(from || to) && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.navy, mt: 0.75, fontWeight: 600 }}>
            {from && to ? `${from} → ${to}` : (from || to)}
          </Typography>
        )}
      </Box>
      {seat && (
        <Box sx={{ textAlign: 'right', flexShrink: 0, pl: 1 }}>
          <Tag>Seat</Tag>
          <Typography sx={{ fontFamily: D.display, fontSize: '3.2rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
            {seat}
          </Typography>
          {cabin && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', color: 'text.secondary', mt: 0.3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {cabin}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function TrainBusFerryHero({ t, sequenceLabel }: { t: any; sequenceLabel?: string }) {
  const from     = t.departureLocation ?? '';
  const to       = t.arrivalLocation ?? '';
  const operator = t.details?.operator ?? '';
  const subtype  = t.details?.railSubtype ?? '';
  const seat     = t.details?.seat ?? '';
  const cabin    = t.details?.cabin ?? '';

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {sequenceLabel && <Tag>{sequenceLabel}</Tag>}
        <Tag>Route</Tag>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.7rem', color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {from && to ? <>{from}<br />→ {to}</> : (from || to || 'Journey')}
        </Typography>
        {(operator || subtype) && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.secondary', mt: 0.75 }}>
            {[operator, subtype].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
      {seat && (
        <Box sx={{ textAlign: 'right', flexShrink: 0, pl: 1 }}>
          <Tag>Coach / Seat</Tag>
          <Typography sx={{ fontFamily: D.display, fontSize: '2.5rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
            {seat}
          </Typography>
          {cabin && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', color: 'text.secondary', mt: 0.3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {cabin}
            </Typography>
          )}
        </Box>
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
    <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
      <Box>
        <Tag>Pickup</Tag>
        <Typography sx={{ fontFamily: D.display, fontSize: '3.4rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {depTime || '—'}
        </Typography>
        {depDate && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.4 }}>
            {depDate}
          </Typography>
        )}
      </Box>
      {(from || to) && (
        <Box sx={{ flex: 1, pt: 3.5 }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', color: D.navy, fontWeight: 600 }}>
            {from || '—'}
          </Typography>
          {to && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>
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
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {company || 'Car hire'}
      </Typography>
      {vehicle && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.secondary', mt: 0.4 }}>
          {vehicle}
        </Typography>
      )}
      {(pickup || depTime) && (
        <Box sx={{ mt: 1 }}>
          <Tag>Pickup</Tag>
          {depTime && <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy }}>{depTime}</Typography>}
          {pickup && <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.2 }}>{pickup}</Typography>}
        </Box>
      )}
      {(dropoff || arrTime) && (
        <Box sx={{ mt: 0.75 }}>
          <Tag>Drop-off</Tag>
          {arrTime && <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy }}>{arrTime}</Typography>}
          {dropoff && <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.2 }}>{dropoff}</Typography>}
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
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Tag>Route</Tag>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.7rem', color: D.navy, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {from && to ? <>{from}<br />→ {to}</> : (from || to || (t.type === 'bicycle' ? 'Bicycle' : 'Drive'))}
      </Typography>
      {vehicle && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.75 }}>
          {vehicle}
        </Typography>
      )}
    </Box>
  );
}

function ParkingHero({ t }: { t: any }) {
  const airport = t.departureLocation ?? '';
  const product = t.details?.parkingProduct ?? '';
  const entry   = t.departureTime ? `${dateShort(t.departureTime)} · ${timeOnly(t.departureTime)}` : '';
  const exit_   = t.arrivalTime   ? `${dateShort(t.arrivalTime)} · ${timeOnly(t.arrivalTime)}`   : '';

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Tag>Parking</Tag>
      <Typography sx={{ fontFamily: D.display, fontSize: '1.6rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {airport || 'Airport parking'}
      </Typography>
      {product && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: 'text.secondary', mt: 0.4 }}>
          {product}
        </Typography>
      )}
      {(entry || exit_) && (
        <Box sx={{ mt: 1 }}>
          <Tag>Entry → Exit</Tag>
          <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', color: D.navy, lineHeight: 1.5 }}>
            {entry}{exit_ ? ` → ${exit_}` : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Time / ref strip ──────────────────────────────────────────────────────────

function TimeRefStrip({ t, type }: { t: any; type: string }) {
  if (['taxi', 'private_transfer', 'car_hire', 'parking'].includes(type)) {
    if (!t.confirmationNumber && !t.cost) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pb: 1.5 }}>
        {t.confirmationNumber && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.0rem', color: D.terra, letterSpacing: '0.06em' }}>
            {t.confirmationNumber}
          </Typography>
        )}
        {t.cost && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', ml: 1.5 }}>
            €{t.cost}
          </Typography>
        )}
      </Box>
    );
  }

  const depTime  = timeOnly(t.departureTime);
  const arrTime  = timeOnly(t.arrivalTime);
  const depDate  = dateShort(t.departureTime);
  const dur      = duration(t.departureTime, t.arrivalTime);
  const durLabel = type === 'flight' ? `${dur} flight` : dur;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', px: 2, pb: 1.5, gap: 2 }}>
      <Box sx={{ flex: 1 }}>
        {(depTime || arrTime) && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.5rem', color: D.navy, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {depTime}{arrTime ? ` → ${arrTime}` : ''}
          </Typography>
        )}
        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary', mt: 0.4 }}>
          {[depDate, durLabel].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        {t.confirmationNumber && (
          <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.terra, letterSpacing: '0.06em' }}>
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

// ── Map target — no map for parking (no exact address stored) ─────────────────

function getMapTarget(t: any) {
  if (['flight', 'parking'].includes(t.type)) return null;
  if (['car', 'bicycle'].includes(t.type)) {
    return t.arrivalLocation ? { address: t.arrivalLocation, coordinates: t.arrivalCoordinates ?? null } : null;
  }
  const address = t.departureLocation ?? t.details?.pickupLocation ?? '';
  return address ? { address, coordinates: t.departureCoordinates ?? t.details?.pickupCoordinates ?? null } : null;
}

// ── Share formatter ───────────────────────────────────────────────────────────

function formatTransportForShare(t: any): string {
  const fmt = (dt: string) =>
    dt ? new Date(dt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const lines: string[] = [];

  switch (t.type) {
    case 'flight': {
      const num     = t.details?.flightNumber ?? '';
      const airline = t.details?.airline ?? '';
      lines.push([num, airline].filter(Boolean).join(' · ') || 'Flight');
      if (t.departureLocation || t.arrivalLocation)
        lines.push(`${t.departureLocation ?? ''} → ${t.arrivalLocation ?? ''}`);
      if (t.departureTime) lines.push(`Departs: ${fmt(t.departureTime)}`);
      if (t.arrivalTime)   lines.push(`Arrives: ${fmt(t.arrivalTime)}`);
      const seat = t.details?.seat; const cabin = t.details?.cabin;
      if (seat || cabin) lines.push([seat && `Seat ${seat}`, cabin].filter(Boolean).join(' · '));
      break;
    }
    case 'parking': {
      lines.push('Airport parking');
      if (t.departureLocation)       lines.push(t.departureLocation);
      if (t.details?.parkingProduct) lines.push(t.details.parkingProduct);
      if (t.departureTime) lines.push(`Entry: ${fmt(t.departureTime)}`);
      if (t.arrivalTime)   lines.push(`Exit:  ${fmt(t.arrivalTime)}`);
      break;
    }
    case 'train': case 'bus': case 'ferry': {
      const label = t.type.charAt(0).toUpperCase() + t.type.slice(1);
      lines.push([t.details?.operator, label].filter(Boolean).join(' · '));
      if (t.departureLocation || t.arrivalLocation)
        lines.push(`${t.departureLocation ?? ''} → ${t.arrivalLocation ?? ''}`);
      if (t.departureTime) lines.push(`Departs: ${fmt(t.departureTime)}`);
      if (t.arrivalTime)   lines.push(`Arrives: ${fmt(t.arrivalTime)}`);
      if (t.details?.seat) lines.push(`Seat: ${t.details.seat}`);
      break;
    }
    case 'car_hire': {
      lines.push(`Car hire — ${t.details?.rentalCompany || 'Car hire'}`);
      if (t.details?.vehicle)         lines.push(t.details.vehicle);
      if (t.details?.pickupLocation)  lines.push(`Pickup: ${fmt(t.departureTime)} — ${t.details.pickupLocation}`);
      if (t.details?.dropoffLocation) lines.push(`Drop-off: ${fmt(t.arrivalTime)} — ${t.details.dropoffLocation}`);
      break;
    }
    case 'taxi': case 'private_transfer': {
      const label = t.type === 'taxi' ? 'Taxi' : 'Transfer';
      lines.push([label, t.details?.operator].filter(Boolean).join(' — '));
      if (t.departureLocation) lines.push(`From: ${t.departureLocation}`);
      if (t.arrivalLocation)   lines.push(`To: ${t.arrivalLocation}`);
      if (t.departureTime)     lines.push(fmt(t.departureTime));
      break;
    }
    default: {
      lines.push(t.type || 'Transport');
      if (t.departureLocation || t.arrivalLocation)
        lines.push(`${t.departureLocation ?? ''} → ${t.arrivalLocation ?? ''}`);
      if (t.departureTime) lines.push(fmt(t.departureTime));
    }
  }

  if (t.confirmationNumber) lines.push(`Ref: ${t.confirmationNumber}`);
  if (t.cost)               lines.push(`€${t.cost}`);
  if (t.notes)              lines.push(t.notes);
  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TransportCard({ t, i, onMenu, linkedFiles, onOpenFile, sequenceLabel }: TransportCardProps) {
  const typeColor = TRANSPORT_COLORS[t.type as string] ?? D.navy;
  const mapTarget = getMapTarget(t);
  const navDest   = mapTarget ? { name: mapTarget.address, address: mapTarget.address, coordinates: mapTarget.coordinates } : null;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = formatTransportForShare(t);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
  };

  const renderHero = () => {
    switch (t.type) {
      case 'flight':           return <FlightHero t={t} sequenceLabel={sequenceLabel} />;
      case 'train':
      case 'bus':
      case 'ferry':            return <TrainBusFerryHero t={t} sequenceLabel={sequenceLabel} />;
      case 'car_hire':         return <CarHireHero t={t} />;
      case 'taxi':
      case 'private_transfer': return <TaxiTransferHero t={t} />;
      case 'car':
      case 'bicycle':          return <CarBicycleHero t={t} />;
      case 'parking':          return <ParkingHero t={t} />;
      default:                 return <TrainBusFerryHero t={t} sequenceLabel={sequenceLabel} />;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          border: '1.5px solid rgba(29,38,66,0.10)',
          borderRadius: mapTarget ? '12px 12px 0 0' : '12px',
          borderBottom: mapTarget ? 'none' : undefined,
          overflow: 'hidden',
          display: 'flex',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        }}
      >
        {/* ── Left icon column ── */}
        <Box sx={{
          width: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: typeColor,
        }}>
          {transportIcon(t.type, { sx: { fontSize: '1.6rem', color: 'rgba(255,255,255,0.92)' } })}
        </Box>

        {/* ── Right content ── */}
        <Box sx={{ flex: 1, minWidth: 0, bgcolor: '#FDFAF5' }}>
          {renderHero()}

          {/* Action strip */}
          <Box sx={{
            display: 'flex', alignItems: 'center',
            px: 1.5, py: 0.25,
            borderTop: '1px solid rgba(29,38,66,0.06)',
            gap: 0.5,
          }}>
            <StatusPill status={t.status} />
            {navDest && <NavigateButton destination={navDest} suggestedMode="driving" size="medium" />}
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={handleShare} sx={{ width: 44, height: 44 }}>
              <ShareIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
            <IconButton onClick={e => onMenu(e, 'transport', i)} sx={{ width: 44, height: 44 }}>
              <MoreVertIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Box>

          {/* Time / ref */}
          <TimeRefStrip t={t} type={t.type} />

          {/* Attached files */}
          {linkedFiles && linkedFiles.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 2, pb: 2, pt: 0 }}>
              {linkedFiles.map((f: any) => (
                <Button
                  key={f._id}
                  size="small"
                  startIcon={<AttachFileIcon sx={{ fontSize: '0.75rem !important' }} />}
                  onClick={() => onOpenFile?.(f)}
                  sx={{
                    fontFamily: D.body, fontSize: '0.7rem',
                    py: 0.3, px: 1, borderRadius: 99,
                    textTransform: 'none',
                    bgcolor: 'rgba(30,144,255,0.08)',
                    color: '#1E90FF',
                    border: '1px solid rgba(30,144,255,0.25)',
                    minWidth: 0,
                    '&:hover': { bgcolor: 'rgba(30,144,255,0.15)' },
                  }}
                >
                  {f.name}
                </Button>
              ))}
            </Box>
          )}
        </Box>
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

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
