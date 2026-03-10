'use client';
// VenueCard.tsx → src/components/logistics/VenueCard.tsx

import { Box, Chip, IconButton, Paper, Typography } from '@mui/material';
import LaunchIcon     from '@mui/icons-material/Launch';
import MoreVertIcon   from '@mui/icons-material/MoreVert';
import NavigateButton from '@/components/ui/NavigateButton';
import DestinationMap from '@/components/ui/DestinationMap';
import { D, DOT_COLOUR, VENUE_TYPES, venueIcon, type MenuKind } from './logistics.helpers';

interface VenueCardProps {
  v:       any;
  i:       number;
  onMenu:  (e: React.MouseEvent<HTMLElement>, kind: MenuKind, index: number) => void;
  fmtDate: (d: string) => string;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const dayNum = (d: string) =>
  d ? new Date(d).getDate().toString() : '';

const monthShort = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IE', { month: 'short' }).toUpperCase() : '';

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

export default function VenueCard({ v, i, onMenu }: VenueCardProps) {
  const venueTypeLabel = VENUE_TYPES.find(vt => vt.value === v.type)?.label ?? 'Venue';

  return (
    <Box sx={{ mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: D.paper,
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderRadius: v.address ? '12px 12px 0 0' : '12px',
          borderBottom: v.address ? 'none' : undefined,
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
          {venueIcon(v.type, {})}
        </Box>

        {/* Hero: two zones */}
        <Box sx={{ display: 'flex', pt: 2.5, px: 2.5 }}>

          {/* LEFT: date hero */}
          <Box sx={{ flexShrink: 0, minWidth: 80 }}>
            <SectionTag>Date</SectionTag>
            <Typography sx={{ fontFamily: D.display, fontSize: '2.8rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {dayNum(v.date) || '—'}
            </Typography>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.terra, letterSpacing: '0.04em', mt: 0.25 }}>
              {monthShort(v.date)}
            </Typography>
            {v.time && (
              <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy, mt: 0.5, letterSpacing: '-0.01em' }}>
                {v.time}{v.endTime ? ` → ${v.endTime}` : ''}
              </Typography>
            )}
          </Box>

          {/* Vertical rule */}
          <Box sx={{ width: '1px', bgcolor: 'rgba(29,38,66,0.10)', alignSelf: 'stretch', mx: 2.5, flexShrink: 0 }} />

          {/* RIGHT: venue details */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, lineHeight: 1.2 }}>
              {v.name || venueTypeLabel}
            </Typography>

            {/* Type badge + address on one row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
              <Chip
                label={venueTypeLabel}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.62rem', height: 18,
                  fontFamily: D.body,
                  borderColor: 'rgba(29,38,66,0.20)',
                  color: 'text.secondary',
                }}
              />
              {v.address && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary' }}>
                  {v.address}
                </Typography>
              )}
            </Box>

            {/* Website chip */}
            {v.website && (
              <Box sx={{ mt: 0.75 }}>
                <Chip
                  label="Website"
                  size="small"
                  component="a"
                  href={v.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  icon={<LaunchIcon sx={{ fontSize: '0.7rem !important' }} />}
                  sx={{ fontSize: '0.62rem', height: 20, fontFamily: D.body }}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Dashed strip: status + nav + more vert */}
        <Box sx={{ display: 'flex', alignItems: 'center', mx: 2.5, my: 1.5, gap: 1 }}>
          <DashedRule />
          <NavigateButton
            destination={{ name: v.name, address: v.address, coordinates: v.coordinates ?? null }}
            suggestedMode="walking"
            size="medium"
          />
          <StatusPill status={v.status} />
          <IconButton size="small" onClick={e => onMenu(e, 'venue', i)} sx={{ ml: 0.25 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Ref strip */}
        {(v.confirmationNumber || v.cost) && (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pb: 2.5, gap: 1.5 }}>
            {v.confirmationNumber && (
              <Typography sx={{ fontFamily: D.display, fontSize: '1.0rem', color: D.terra, letterSpacing: '0.06em' }}>
                {v.confirmationNumber}
              </Typography>
            )}
            {v.cost && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.secondary' }}>
                €{v.cost}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      {v.address && (
        <Box sx={{
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          border: '1.5px solid rgba(29,38,66,0.08)',
          borderTop: 'none',
        }}>
          <DestinationMap coordinates={v.coordinates ?? null} address={v.address} />
        </Box>
      )}
    </Box>
  );
}