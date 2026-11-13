'use client';

import { Box, Typography, Button, ButtonBase } from '@mui/material';
import { alpha }              from '@mui/material/styles';
import DirectionsWalkIcon     from '@mui/icons-material/DirectionsWalk';
import DirectionsCarIcon      from '@mui/icons-material/DirectionsCar';
import DirectionsBusIcon      from '@mui/icons-material/DirectionsBus';
import FlightIcon             from '@mui/icons-material/Flight';
import HelpOutlineIcon        from '@mui/icons-material/HelpOutline';
import MoreHorizIcon          from '@mui/icons-material/MoreHoriz';
import WarningAmberIcon       from '@mui/icons-material/WarningAmber';
import NavigateButton         from '@/components/ui/NavigateButton';
import { formatTravelMins }   from '@/lib/navigation/useTravelTimes';
import { isOffline }          from '@/lib/offline/connectivity';
import type { Leg, Travel }   from '@/lib/itinerary/dayPlan';
import { D }                  from './Itinerary.config';
import type { Stop }          from './Itinerary.config';
import { formatTime }         from './Itinerary.helpers';

export type GapState = 'open' | 'sorted' | null;

const clean = (s?: string) => (s ?? '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();

/** "9 min walk · 4 min drive", "Flight · 3h 25m", "ALSA Airport Bus · 45 min" */
export function travelText(leg: Leg<Stop>, t: Travel): string {
  if (leg.kind === 'flight') return `Flight${t.minutes ? ` · ${formatTravelMins(t.minutes)}` : ''}`;
  if (leg.kind === 'ride') {
    const name = clean(leg.ride?.name) || 'Transport';
    return `${name}${t.minutes ? ` · ${formatTravelMins(t.minutes)}` : ''}`;
  }
  if (!t.known) return isOffline() ? 'Times when you’re back online' : 'Looking up the way';
  if (!t.mode || t.minutes === null) return 'No route found';
  const main = `${formatTravelMins(t.minutes)} ${t.mode === 'walk' ? 'walk' : 'drive'}`;
  return t.alt ? `${main} · ${formatTravelMins(t.alt.minutes)} ${t.alt.mode === 'walk' ? 'walk' : 'drive'}` : main;
}

export function TravelIcon({ leg, travel, size = 18, color }: { leg: Leg<Stop>; travel: Travel; size?: number; color?: string }) {
  const sx = { fontSize: size, color: color ?? D.muted, flexShrink: 0 };
  if (leg.kind === 'flight') return <FlightIcon sx={{ ...sx, transform: 'rotate(90deg)' }} />;
  if (leg.kind === 'ride')   return <DirectionsBusIcon sx={sx} />;
  if (travel.mode === 'walk')  return <DirectionsWalkIcon sx={sx} />;
  if (travel.mode === 'drive') return <DirectionsCarIcon sx={sx} />;
  return <MoreHorizIcon sx={sx} />;
}

interface Props {
  leg:     Leg<Stop>;
  travel:  Travel;
  gap:     GapState;
  selected?: boolean;
  /** Show it on the map */
  onSelect?: () => void;
  /** A transfer with no way planned: add a transport stop for it */
  onAddTransport?: () => void;
  onSorted?: (sorted: boolean) => void;
  /** Indented to sit inside a list of stops */
  inset?: number;
}

// One leg between two stops: how you get there and how long it takes, with
// Navigate for the route itself. A transfer you can't walk, with nothing planned,
// asks how you're getting there — until you add a way or say it's sorted.
export function LegRow({ leg, travel, gap, selected, onSelect, onAddTransport, onSorted, inset = 2 }: Props) {
  const asking   = gap === 'open';
  const warn     = travel.late !== null ? 'late' : travel.tight ? 'tight' : null;
  const lead     = leg.anchor === 'start' ? `From ${leg.from.name}` : leg.anchor === 'end' ? `Back to ${leg.to.name}` : null;
  const leaveBy  = leg.anchor === 'start' && travel.leaveBy !== null ? `leave by ${formatTime(Math.max(0, travel.leaveBy))}` : null;
  const navigable = leg.kind === 'move';

  return (
    <Box sx={{ px: inset, py: 0.25 }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        borderRadius: '8px',
        backgroundColor: selected ? alpha(D.navy, 0.07) : 'transparent',
      }}>
        <ButtonBase
          onClick={onSelect}
          disabled={!onSelect}
          aria-label={`${lead ? `${lead}: ` : ''}${travelText(leg, travel)}${onSelect ? '. Show on the map' : ''}`}
          sx={{
            flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'flex-start', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, pr: 0.5, borderRadius: '8px',
            borderLeft: `2px ${leg.kind === 'move' && travel.mode === 'walk' ? 'dotted' : 'solid'} ${alpha(asking ? D.terra : D.navy, 0.3)}`,
          }}
        >
          {asking
            ? <HelpOutlineIcon sx={{ fontSize: 18, color: D.terra, flexShrink: 0 }} />
            : <TravelIcon leg={leg} travel={travel} />}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.3,
              color: asking ? D.terra : alpha(D.navy, 0.75),
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lead && <Box component="span" sx={{ color: D.navy }}>{lead} · </Box>}
              {travelText(leg, travel)}
              {leaveBy && <Box component="span" sx={{ color: D.muted, fontWeight: 600 }}> · {leaveBy}</Box>}
            </Typography>
            {warn && (
              <Typography sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                fontFamily: D.body, fontSize: '0.72rem', fontWeight: 800, lineHeight: 1.3,
                color: warn === 'late' ? 'error.main' : 'warning.dark',
              }}>
                <WarningAmberIcon sx={{ fontSize: 13 }} />
                {warn === 'late' ? `${travel.late} min short of the time between them` : 'Tight — under 10 minutes to spare'}
              </Typography>
            )}
          </Box>
        </ButtonBase>
        {gap === 'sorted' && onSorted && (
          <ButtonBase
            onClick={() => onSorted(false)}
            title="Ask about this again"
            aria-label="Sorted. Ask about this again"
            sx={{
              flexShrink: 0, minHeight: 44, px: 0.5, borderRadius: 4,
            }}
          >
            <Box component="span" sx={{
              px: 1, py: 0.25, borderRadius: 4,
              fontFamily: D.body, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.04em',
              color: D.green, backgroundColor: alpha(D.green, 0.12),
            }}>
              Sorted
            </Box>
          </ButtonBase>
        )}
        {navigable && (
          <NavigateButton
            destination={{ name: leg.to.name, address: leg.to.address, coordinates: leg.to.coordinates }}
            origin={{ name: leg.from.name, address: leg.from.address, coordinates: leg.from.coordinates }}
            suggestedMode={travel.mode === 'drive' ? 'driving' : 'walking'}
            size="small"
            sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
          />
        )}
      </Box>

      {asking && (
        <Box sx={{
          ml: 1.5, mt: 0.25, mb: 0.75, p: 1.25, borderRadius: '10px',
          border: `1px solid ${alpha(D.terra, 0.35)}`, backgroundColor: alpha(D.terra, 0.06),
        }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 800, color: D.navy, lineHeight: 1.3 }}>
            How are you getting to {leg.to.name}?
          </Typography>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.25 }}>
            Nothing planned from {leg.from.name}
            {leg.arriveBy !== null ? ` for ${formatTime(leg.arriveBy)}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {onAddTransport && (
              <Button
                variant="contained" onClick={onAddTransport}
                sx={{ minHeight: 44, flex: 1, fontFamily: D.body, fontWeight: 800, backgroundColor: D.navy, boxShadow: 'none', '&:hover': { backgroundColor: D.navy, boxShadow: 'none' } }}
              >
                Add how
              </Button>
            )}
            {onSorted && (
              <Button
                variant="outlined" onClick={() => onSorted(true)}
                sx={{ minHeight: 44, flex: 1, fontFamily: D.body, fontWeight: 800, color: D.navy, borderColor: alpha(D.navy, 0.25) }}
              >
                I’ve sorted this
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
