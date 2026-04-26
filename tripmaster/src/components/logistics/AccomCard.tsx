'use client';
// AccomCard.tsx → src/components/logistics/AccomCard.tsx

import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MoreVertIcon   from '@mui/icons-material/MoreVert';
import HotelIcon      from '@mui/icons-material/Hotel';
import NavigateButton from '@/components/ui/NavigateButton';
import DestinationMap from '@/components/ui/DestinationMap';
import { D, DOT_COLOUR, type MenuKind } from './logistics.helpers';

interface AccomCardProps {
  a:            any;
  i:            number;
  onMenu:       (e: React.MouseEvent<HTMLElement>, kind: MenuKind, index: number) => void;
  fmtDate:      (d: string) => string;
  linkedFiles?: any[];
  onOpenFile?:  (f: any) => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const dayNum = (d: string) =>
  d ? new Date(d).getDate().toString() : '';

const monthShort = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IE', { month: 'short' }).toUpperCase() : '';

const dateShort = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const nightCount = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return null;
  const n = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
  return n > 0 ? n : null;
};

// ── Atoms ─────────────────────────────────────────────────────────────────────

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

const DashedRule = () => (
  <Box sx={{ flex: 1, borderTop: '1px dashed rgba(29,38,66,0.10)' }} />
);

// ── Main export ───────────────────────────────────────────────────────────────

export default function AccomCard({ a, i, onMenu, linkedFiles, onOpenFile }: AccomCardProps) {
  const nights = nightCount(a.checkIn, a.checkOut);

  return (
    <Box sx={{ mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: D.paper,
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderRadius: a.address ? '12px 12px 0 0' : '12px',
          borderBottom: a.address ? 'none' : undefined,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Ghost icon */}
        <Box sx={{
          position: 'absolute', right: -16, bottom: -16,
          opacity: 0.055, transform: 'rotate(-8deg)',
          pointerEvents: 'none', color: D.navy,
          '& .MuiSvgIcon-root': { fontSize: '10rem', width: '10rem', height: '10rem' },
        }}>
          <HotelIcon />
        </Box>

        {/* Hero: two zones */}
        <Box sx={{ display: 'flex', pt: 2.5, px: 2.5 }}>

          {/* LEFT: check-in date hero */}
          <Box sx={{ flexShrink: 0, minWidth: 80 }}>
            <SectionTag>Check-in</SectionTag>
            <Typography sx={{ fontFamily: D.display, fontSize: '2.8rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {dayNum(a.checkIn) || '—'}
            </Typography>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.terra, letterSpacing: '0.04em', mt: 0.25 }}>
              {monthShort(a.checkIn)}
            </Typography>
          </Box>

          {/* Vertical rule */}
          <Box sx={{ width: '1px', bgcolor: 'rgba(29,38,66,0.10)', alignSelf: 'stretch', mx: 2.5, flexShrink: 0 }} />

          {/* RIGHT: property details */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, lineHeight: 1.2, pr: 1 }}>
                {a.name || 'Accommodation'}
              </Typography>
              {/* Night count ghost badge */}
              {nights && (
                <Typography sx={{ fontFamily: D.display, fontSize: '1.8rem', color: D.navy, opacity: 0.10, lineHeight: 1, letterSpacing: '-0.04em', flexShrink: 0 }}>
                  {nights}N
                </Typography>
              )}
            </Box>

            {a.address && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
                {a.address}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
              {a.checkOut && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary' }}>
                  → {dateShort(a.checkOut)}
                </Typography>
              )}
              {a.includesBreakfast && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.green, fontWeight: 600 }}>
                  Breakfast {a.breakfastTime ?? '08:00'}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Dashed strip: status + nav + more vert */}
        <Box sx={{ display: 'flex', alignItems: 'center', mx: 2.5, my: 1.5, gap: 1 }}>
          <DashedRule />
          <NavigateButton
            destination={{ name: a.name, address: a.address, coordinates: a.coordinates ?? null }}
            suggestedMode="driving"
            size="medium"
          />
          <StatusPill status={a.status} />
          <IconButton size="small" onClick={e => onMenu(e, 'accom', i)} sx={{ ml: 0.25 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Ref strip */}
        {(a.confirmationNumber || a.cost) && (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pb: 2.5, gap: 1.5 }}>
            {a.confirmationNumber && (
              <Typography sx={{ fontFamily: D.display, fontSize: '1.0rem', color: D.terra, letterSpacing: '0.06em' }}>
                {a.confirmationNumber}
              </Typography>
            )}
            {a.cost && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary' }}>
                €{a.cost}
              </Typography>
            )}
          </Box>
        )}

        {linkedFiles && linkedFiles.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 2.5, pb: 2, pt: 0.25 }}>
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
      </Paper>

      {a.address && (
        <Box sx={{
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderTop: 'none',
        }}>
          <DestinationMap coordinates={a.coordinates ?? null} address={a.address} />
        </Box>
      )}
    </Box>
  );
}