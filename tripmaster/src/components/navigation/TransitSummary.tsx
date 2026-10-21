'use client';

import { Fragment } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import DirectionsWalkIcon    from '@mui/icons-material/DirectionsWalk';
import DirectionsBusIcon     from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon    from '@mui/icons-material/DirectionsBoat';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import TramIcon              from '@mui/icons-material/Tram';
import SubwayIcon            from '@mui/icons-material/Subway';
import TrainIcon             from '@mui/icons-material/Train';
import type { TransitLeg } from '@/lib/geo/travelTimes';
import type { TravelTimesState } from '@/lib/navigation/useTravelTimes';

type Ride = Extract<TransitLeg, { kind: 'ride' }>;

// Google's vehicle types → icon. Anything else gets the generic transit icon.
const VEHICLE_ICON: Record<string, typeof TrainIcon> = {
  BUS: DirectionsBusIcon, INTERCITY_BUS: DirectionsBusIcon, TROLLEYBUS: DirectionsBusIcon, SHARE_TAXI: DirectionsBusIcon,
  TRAM: TramIcon,
  SUBWAY: SubwayIcon, METRO_RAIL: SubwayIcon,
  RAIL: TrainIcon, HEAVY_RAIL: TrainIcon, COMMUTER_TRAIN: TrainIcon, HIGH_SPEED_TRAIN: TrainIcon,
  LONG_DISTANCE_TRAIN: TrainIcon, MONORAIL: TrainIcon,
  FERRY: DirectionsBoatIcon,
};

const NAVY = '#1D2642';

function LineChip({ ride }: { ride: Ride }) {
  const Icon = VEHICLE_ICON[ride.vehicle] ?? DirectionsTransitIcon;
  return (
    <Box
      component="span"
      title={`${ride.vehicleName} ${ride.line}${ride.headsign ? ` towards ${ride.headsign}` : ''}`}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.25, flexShrink: 0,
        px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.3,
        backgroundColor: ride.color ?? alpha(NAVY, 0.1),
        color:           ride.color ? (ride.textColor ?? '#fff') : NAVY,
      }}
    >
      <Icon sx={{ fontSize: 14 }} />
      {ride.line || ride.vehicleName}
    </Box>
  );
}

// What you'd take, shown under the mode toggle while Transit is picked, before you
// jump to a map app: walk 9 › [train] Dart › walk 11, then where to get on and when.
// Fixed height, so it fills in without moving the app list under your finger.
export default function TransitSummary({ status, times }: Pick<TravelTimesState, 'status' | 'times'>) {
  const plan  = times?.transitPlan ?? null;
  const rides = plan?.filter((l): l is Ride => l.kind === 'ride') ?? [];
  const first = rides[0];
  const message =
      status === 'loading' ? 'Checking buses and trains…'
    : status === 'none'    ? 'No transit details — open a map app below'
    : !plan                ? 'No public transport found'
    : !first               ? 'No bus or train needed — it’s a walk'
    : null;

  const after = rides.length > 1
    ? `${rides.length - 1} change${rides.length > 2 ? 's' : ''}`
    : `${first?.stops} stop${first?.stops === 1 ? '' : 's'} to ${first?.to}`;

  return (
    <Box sx={{ height: 52, px: 2, pb: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
      {message || !plan || !first ? (
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{message}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {plan.map((leg, i) => (
              <Fragment key={i}>
                {i > 0 && <Box component="span" sx={{ color: 'text.disabled', fontSize: '0.8rem', flexShrink: 0 }}>›</Box>}
                {leg.kind === 'walk' ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: '0.8rem', color: 'text.secondary' }}>
                    <DirectionsWalkIcon sx={{ fontSize: 16 }} />
                    {leg.minutes}
                  </Box>
                ) : (
                  <LineChip ride={leg} />
                )}
              </Fragment>
            ))}
          </Box>
          <Typography noWrap sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5 }}>
            Board at {first.from}{first.departs && ` ${first.departs}`} · {after}
          </Typography>
        </>
      )}
    </Box>
  );
}
