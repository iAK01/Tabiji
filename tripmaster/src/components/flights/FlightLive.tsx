'use client';

// Live flight status wherever a flight shows: the flight card, the sheet a
// notification opens, an itinerary stop, the boarding pass. Before departure:
// terminal, check-in desks, the gate and when bag drop and the gate close. In
// the air: when it lands. After: the landing and the baggage belt.

import { Box, Typography } from '@mui/material';
import type { DateTime } from 'luxon';
import { D } from '@/components/logistics/logistics.helpers';
import { wallClock } from '@/lib/push/timezones';
import {
  arrivalAt, checkedAgo, closingTimes, delayMins, departureAt, flightPhase, previousGate, statusLine,
  DELAY_MIN, FLIGHT_DATA_SOURCE, type FlightStatus, type Tone,
} from '@/lib/flights/status';

export const TONE: Record<Tone, string> = { ok: '#55702C', warn: '#C4714A', bad: '#C62828' };

export interface FlightFact { label: string; value: string; note?: string; tone?: Tone }

const hm = (dt: DateTime | null) => dt?.toFormat('HH:mm') ?? '';

// Closing times only matter until the flight's gone.
function upcoming(t: any): boolean {
  const dep = wallClock(t?.departureTime, 'UTC');
  return !!dep && dep.toMillis() > Date.now() - 24 * 3_600_000;
}

/** What matters about a flight right now, as label/value pairs. `arrival` forces the landing side. */
export function flightFacts(t: any, fs: FlightStatus | null | undefined, side: 'auto' | 'arrival' = 'auto'): FlightFact[] {
  const phase = fs ? flightPhase(fs) : 'scheduled';
  if (phase === 'cancelled' || phase === 'diverted') return [];

  if (side === 'arrival' || phase === 'airborne' || phase === 'landed') {
    if (!fs) return [];
    const eta = arrivalAt(fs);
    return [
      eta && { label: phase === 'landed' ? 'Landed' : 'Lands', value: hm(eta) },
      fs.arr.terminal && { label: 'Terminal', value: fs.arr.terminal },
      fs.arr.belt && { label: 'Bags', value: `Belt ${fs.arr.belt}` },
    ].filter(Boolean) as FlightFact[];
  }

  const close = upcoming(t) ? closingTimes(t) : null;
  const late  = fs && delayMins(fs) >= DELAY_MIN ? departureAt(fs) : null;
  const was   = fs ? previousGate(fs) : null;
  return [
    late && { label: 'Now departs', value: hm(late), tone: 'warn' },
    fs?.dep.terminal && { label: 'Terminal', value: fs.dep.terminal },
    fs?.dep.desk && !fs.dep.gate && { label: 'Check-in', value: fs.dep.desk },
    fs?.dep.gate && { label: 'Gate', value: fs.dep.gate, note: was ? `was ${was}` : undefined, tone: was ? 'warn' : undefined },
    close && !fs?.dep.gate && { label: 'Bag drop closes', value: hm(close.bagDrop) },
    close && { label: 'Gate closes', value: hm(close.gate) },
  ].filter(Boolean) as FlightFact[];
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontFamily: D.body, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.4,
    }}>
      {children}
    </Typography>
  );
}

export function StatusLine({ fs, showAge = true }: { fs: FlightStatus; showAge?: boolean }) {
  const line = statusLine(fs);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: TONE[line.tone], flexShrink: 0 }} />
        <Typography sx={{ fontFamily: D.body, fontWeight: 800, fontSize: '0.88rem', color: TONE[line.tone] }}>
          {line.text}
        </Typography>
      </Box>
      {showAge && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.7rem', color: 'text.secondary', ml: 'auto' }}>
          {checkedAgo(fs)}
        </Typography>
      )}
    </Box>
  );
}

/** The status line and the facts that matter now, with the provider's credit. Nothing when there's nothing to say. */
export default function FlightLive({ t, fs, side = 'auto' }: { t: any; fs?: FlightStatus | null; side?: 'auto' | 'arrival' }) {
  const facts = flightFacts(t, fs, side);
  if (!fs && !facts.length) return null;

  return (
    <Box>
      {fs && <StatusLine fs={fs} />}
      {facts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 1, mt: fs ? 1 : 0 }}>
          {facts.map(f => (
            <Box key={f.label} sx={{ minWidth: 0 }}>
              <Label>{f.label}</Label>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', lineHeight: 1.2, color: f.tone ? TONE[f.tone] : D.navy }}>
                {f.value}
                {f.note && (
                  <Box component="span" sx={{ fontFamily: D.body, fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', ml: 0.75 }}>
                    {f.note}
                  </Box>
                )}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {fs && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.62rem', color: 'text.disabled', mt: 0.75 }}>
          Live data: {FLIGHT_DATA_SOURCE}
        </Typography>
      )}
    </Box>
  );
}
