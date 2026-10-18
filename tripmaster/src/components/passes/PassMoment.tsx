'use client';

// At the airport the boarding pass comes first. Opening the app, or coming
// back to it, from an hour before you're due at the airport until the flight
// leaves shows the pass over whatever page it opened on. Closing it leaves a
// pill that brings it back until departure. Reads only saved trip data, so it
// works offline.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ButtonBase, Typography } from '@mui/material';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import PassView from './PassView';
import { buildLegs } from '@/lib/push/journey';
import { placeTz } from '@/lib/push/timezones';
import { passesForSure, passLabel, type Pass } from '@/lib/passes/passes';
import { PASSES_CHANGED, scanPendingPasses } from '@/lib/passes/client';
import { useFlights } from '@/lib/flights/useFlights';
import { flightPhase } from '@/lib/flights/status';
import { D } from '@/components/logistics/logistics.helpers';

const MIN       = 60_000;
const DAY       = 1440 * MIN;
const EARLY_MIN = 60;          // before the airport buffer: time to get there
const RELOAD_MS = 10 * MIN;    // trip data older than this is fetched again
const TICK_MS   = MIN;

interface Moment {
  key:    string;              // trip, booking and departure time — a moved flight is a new moment
  tripId: string;
  index:  number;            // the booking, in logistics.transportation
  t:      any;
  name:   string;
  passes: Pass[];
  fromMs: number;
  depMs:  number;
}

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Every flight with a pass on a trip happening around now.
async function loadMoments(): Promise<Moment[]> {
  const now   = Date.now();
  const trips = ((await getJson('/api/trips'))?.trips ?? []).filter((trip: any) =>
    trip.status !== 'cancelled' && trip.startDate && trip.endDate &&
    new Date(trip.startDate).getTime() - DAY <= now && now <= new Date(trip.endDate).getTime() + 2 * DAY);
  if (!trips.length) return [];

  const user   = (await getJson('/api/user/profile'))?.user;
  const buffer = user?.preferences?.airportBufferMins ?? 120;
  const moments: Moment[] = [];
  for (const trip of trips) {
    const tripId = String(trip._id);
    const [lg, fl] = await Promise.all([getJson(`/api/trips/${tripId}/logistics`), getJson(`/api/trips/${tripId}/files`)]);
    const files = fl?.files ?? [];
    scanPendingPasses(tripId, files);
    const home = {
      countryCode: user?.homeLocation?.countryCode ?? trip.origin?.countryCode ?? null,
      zone:        placeTz(user?.homeLocation) ?? placeTz(trip.origin) ?? undefined,
    };
    for (const leg of buildLegs(trip, lg?.logistics?.transportation ?? [], home)) {
      if (leg.type !== 'flight') continue;
      const passes = passesForSure(files, leg.index, leg.t);
      if (!passes.length) continue;
      const depMs = leg.dep.toMillis();
      moments.push({
        key:    `${tripId}:${leg.index}:${depMs}`,
        tripId, index: leg.index, t: leg.t, passes, depMs,
        name:   leg.t.details?.flightNumber || 'Flight',
        fromMs: depMs - (buffer + EARLY_MIN) * MIN,
      });
    }
  }
  return moments;
}

function closedKey(m: Moment) { return `tabiji-pass-closed:${m.key}`; }

function wasClosed(m: Moment): boolean {
  try { return localStorage.getItem(closedKey(m)) === '1'; } catch { return false; }
}

function markClosed(m: Moment) {
  try { localStorage.setItem(closedKey(m), '1'); } catch { /* shown again next open */ }
}

export default function PassMoment() {
  const { status } = useSession();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [now,     setNow]     = useState(() => Date.now());
  const [open,    setOpen]    = useState<string | null>(null);   // moment key
  const loadedAt = useRef(0);
  const shownFor = useRef(new Set<string>());                    // auto-opened this session

  const refresh = useCallback(async (force = false) => {
    setNow(Date.now());
    if (!force && Date.now() - loadedAt.current < RELOAD_MS) return;
    loadedAt.current = Date.now();
    setMoments(await loadMoments());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    refresh(true);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const onPasses  = () => refresh(true);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(PASSES_CHANGED, onPasses);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(PASSES_CHANGED, onPasses);
    };
  }, [status, refresh]);

  const due = moments
    .filter(m => m.fromMs <= now && now < m.depMs)
    .sort((a, b) => a.depMs - b.depMs)[0] ?? null;

  // The gate as soon as it shows, on the pill and the pass.
  const flights = useFlights(due?.tripId ?? null);
  const flight  = due ? flights[due.index] ?? null : null;
  const gate    = flight && !['airborne', 'landed'].includes(flightPhase(flight)) ? flight.dep.gate : null;

  // Up front once per flight, unless it was closed or a notification already
  // opened something (?sheet=… shows the pass itself when it was for this).
  useEffect(() => {
    if (!due || shownFor.current.has(due.key) || wasClosed(due)) return;
    shownFor.current.add(due.key);
    if (new URLSearchParams(window.location.search).has('sheet')) return;
    setOpen(due.key);
  }, [due]);

  if (!due) return null;

  const close = () => { markClosed(due); setOpen(null); };

  return (
    <>
      {open !== due.key && (
        <ButtonBase
          onClick={() => setOpen(due.key)}
          sx={{
            position: 'fixed', zIndex: 1250, left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom) + 28px)',
            display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, px: 2.5, borderRadius: 99,
            backgroundColor: D.navy, color: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <QrCodeIcon sx={{ fontSize: '1.3rem' }} />
          <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
            {due.name} · {gate ? `Gate ${gate}` : passLabel(due.passes[0])}
          </Typography>
        </ButtonBase>
      )}
      <PassView
        open={open === due.key} passes={due.passes} t={due.t} flight={flight} onClose={close}
        add={{ tripId: due.tripId, index: due.index, onAdded: () => { /* PASSES_CHANGED reloads it */ } }}
      />
    </>
  );
}
