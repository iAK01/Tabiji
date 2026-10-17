'use client';

// The sheet a notification opens: one booking with everything needed to act on
// it (directions, documents, the proof expenses still wants), or — after
// landing — the arrival guide for wherever you've just arrived. Driven by
// ?sheet=transport|accommodation|venue|arrival&i=<logistics index>, so it works
// from a cold start, from a tap while the app is open, and offline.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DateTime } from 'luxon';
import {
  Box, Button, Chip, Dialog, Divider, IconButton, Typography, alpha, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon               from '@mui/icons-material/Close';
import FlightIcon              from '@mui/icons-material/Flight';
import TrainIcon               from '@mui/icons-material/Train';
import DirectionsBusIcon       from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon      from '@mui/icons-material/DirectionsBoat';
import DirectionsCarIcon       from '@mui/icons-material/DirectionsCar';
import HotelIcon               from '@mui/icons-material/Hotel';
import EventIcon               from '@mui/icons-material/Event';
import FlightLandIcon          from '@mui/icons-material/FlightLand';
import ContentCopyIcon         from '@mui/icons-material/ContentCopy';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongIcon         from '@mui/icons-material/ReceiptLong';
import OpenInNewIcon           from '@mui/icons-material/OpenInNew';
import ChevronRightIcon        from '@mui/icons-material/ChevronRight';
import NavigateButton          from '@/components/ui/NavigateButton';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import ArrivalTransportCard    from '@/components/trips/ArrivalTransportCard';
import { buildLegs, coords, departurePoint, placeName, stayOn, type Leg } from '@/lib/push/journey';
import { placeTz, tripZones, wallClock, ymd } from '@/lib/push/timezones';
import { COUNTRY_META } from '@/lib/data/countries';
import { getProofSlots } from '@/lib/logistics/expenseProofs';
import { resolveCheckIn, normaliseTime } from '@/lib/itinerary/checkInTiming';
import { openAppUrl } from '@/lib/push/useNotifications';

const NAVY  = '#2C3E50';
const GREEN = '#55702C';
const TERRA = '#C4714A';
const PAPER = '#FDFAF5';

type Kind = 'transport' | 'accommodation' | 'venue' | 'arrival';
const KINDS: Kind[] = ['transport', 'accommodation', 'venue', 'arrival'];

const TYPE_LABEL: Record<string, string> = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry', car_hire: 'Car hire',
  taxi: 'Taxi', private_transfer: 'Transfer', car: 'Drive', bicycle: 'Cycle', parking: 'Parking',
  concert: 'Concert', conference: 'Conference', restaurant: 'Restaurant', sports: 'Sport',
  attraction: 'Sightseeing', business: 'Meeting', other: 'Event',
};

function typeIcon(type: string) {
  switch (type) {
    case 'flight':   return FlightIcon;
    case 'train':    return TrainIcon;
    case 'bus':      return DirectionsBusIcon;
    case 'ferry':    return DirectionsBoatIcon;
    case 'car_hire':
    case 'taxi':
    case 'private_transfer':
    case 'car':      return DirectionsCarIcon;
    default:         return EventIcon;
  }
}

// Stored times are wall-clock — show them as written, no conversion.
function shown(value: string | null | undefined, format = 'EEE d MMM · HH:mm'): string | null {
  const dt = wallClock(value, 'UTC');
  return dt ? dt.toFormat(format) : null;
}

function dateShown(value: string | null | undefined): string | null {
  return value ? DateTime.fromISO(ymd(value)).toFormat('EEE d MMM') : null;
}

// ── Small building blocks ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'text.secondary', mb: 1,
      }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.6, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

function RefChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Chip
      size="small"
      icon={<ContentCopyIcon sx={{ fontSize: '0.9rem !important' }} />}
      label={copied ? 'Copied' : value}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
      }}
      sx={{ fontWeight: 700, fontFamily: 'monospace', backgroundColor: alpha(NAVY, 0.06) }}
    />
  );
}

function Documents({ files, onOpen }: { files: any[]; onOpen: (f: any) => void }) {
  if (!files.length) return null;
  return (
    <Section title="Documents">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {files.map(f => (
          <Button
            key={f._id}
            variant="outlined"
            startIcon={f.gcsUrl ? <DescriptionOutlinedIcon /> : <OpenInNewIcon />}
            onClick={() => onOpen(f)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: NAVY }}
          >
            {f.name}
          </Button>
        ))}
      </Box>
    </Section>
  );
}

function ProofButtons({ tripId, expense, category }: { tripId: string; expense: any | null; category: string }) {
  if (!expense) return null;
  const missing = getProofSlots(category).filter(s =>
    s.required && !(expense.proofs ?? []).some((p: any) => p.key === s.key));
  if (!missing.length) return null;
  return (
    <Section title="For expenses">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {missing.map(slot => (
          <Button
            key={slot.key}
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => openAppUrl(`/trips/${tripId}?tab=expenses&expense=${expense._id}&proof=${slot.key}`)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700, borderColor: alpha(TERRA, 0.4), color: TERRA }}
          >
            Add {slot.label.toLowerCase()}
          </Button>
        ))}
      </Box>
    </Section>
  );
}

// ── The sheet ─────────────────────────────────────────────────────────────────

interface Loaded {
  logistics: any;
  files:     any[];
  expenses:  any[];
  days:      any[];
  user:      any;
}

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default function TravelSheet({ trip }: { trip: any }) {
  const searchParams = useSearchParams();
  const theme        = useTheme();
  const mobile       = useMediaQuery(theme.breakpoints.down('sm'));

  const kindParam = searchParams.get('sheet');
  const kind      = (KINDS as string[]).includes(kindParam ?? '') ? (kindParam as Kind) : null;
  const index     = Number(searchParams.get('i'));
  const open      = !!kind && Number.isInteger(index) && index >= 0;

  const [data,   setData]   = useState<Loaded | null>(null);
  const [viewer, setViewer] = useState<ViewableFile | null>(null);

  // Fresh every time it opens — a proof uploaded or a booking edited since the
  // last tap shows up (offline, the saved copies answer).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = trip._id;
    Promise.all([
      getJson(`/api/trips/${id}/logistics`),
      getJson(`/api/trips/${id}/files`),
      getJson(`/api/trips/${id}/expenses`),
      getJson(`/api/trips/${id}/itinerary`),
      getJson('/api/user/profile'),
    ]).then(([lg, fl, ex, it, pr]) => {
      if (cancelled) return;
      setData({
        logistics: lg?.logistics ?? null,
        files:     fl?.files ?? [],
        expenses:  ex?.expenses ?? [],
        days:      it?.days ?? [],
        user:      pr?.user ?? null,
      });
    });
    return () => { cancelled = true; };
  }, [open, kind, index, trip._id]);

  const close = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('sheet');
    params.delete('i');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, []);

  const openFile = (f: any) => {
    if (f.gcsUrl) setViewer({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl });
    else if (f.linkUrl) window.open(f.linkUrl, '_blank', 'noopener');
  };

  const homeCountry = data?.user?.homeLocation?.countryCode ?? trip.origin?.countryCode ?? null;
  const homeZone    = placeTz(data?.user?.homeLocation) ?? placeTz(trip.origin) ?? undefined;
  const legs = useMemo(
    () => (data?.logistics ? buildLegs(trip, data.logistics.transportation ?? [], { countryCode: homeCountry, zone: homeZone }) : []),
    [data, trip, homeCountry, homeZone],
  );

  if (!open) return null;

  const tripId = String(trip._id);
  const lg     = data?.logistics;
  const linked = (collection: string) => (data?.files ?? []).filter(f =>
    f.resourceType !== 'todo' && f.linkedTo?.collection === collection && f.linkedTo?.entryId === String(index));
  const expenseFor = (collection: string) => (data?.expenses ?? []).find(e =>
    e.linkedTo?.collection === collection && e.linkedTo?.entryId === String(index)) ?? null;
  const toLogistics = (section: string) => openAppUrl(`/trips/${tripId}?tab=logistics&section=${section}`);

  let title = '';
  let Icon: React.ElementType = EventIcon;
  let body: React.ReactNode = null;

  // ── Transport ──
  if (kind === 'transport' && lg?.transportation?.[index]) {
    const t    = lg.transportation[index];
    const leg  = legs.find(l => l.index === index) ?? null;
    const type = t.type || 'flight';
    Icon  = typeIcon(type);
    title = type === 'flight'
      ? [t.details?.airline, t.details?.flightNumber].filter(Boolean).join(' ') || 'Flight'
      : [t.details?.operator || t.details?.rentalCompany, TYPE_LABEL[type]].filter(Boolean).join(' ');
    const point = leg
      ? departurePoint(leg)
      : { name: t.details?.pickupLocation || t.departureLocation, coords: coords(t.details?.pickupCoordinates ?? t.departureCoordinates), address: t.departureLocation };
    const buffer = data?.user?.preferences?.airportBufferMins ?? 120;
    const atAirport = type === 'flight' && leg && !leg.isConnection
      ? leg.dep.minus({ minutes: buffer }).toFormat('HH:mm')
      : null;
    const airline = t.details?.airline;

    body = (
      <>
        {(t.departureLocation || t.arrivalLocation) && (
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: NAVY }}>
            {placeName(t.departureLocation) || t.departureLocation} → {placeName(t.arrivalLocation) || t.arrivalLocation}
          </Typography>
        )}
        <Box sx={{ mt: 1.5 }}>
          {t.departureTime && <Fact label="Departs" value={shown(t.departureTime)} />}
          {t.arrivalTime && <Fact label="Arrives" value={shown(t.arrivalTime)} />}
          {atAirport && <Fact label="At the airport by" value={atAirport} />}
          {leg?.isConnection && <Fact label="Connection" value="You're already airside" />}
          {t.details?.seat && <Fact label="Seat" value={t.details.seat} />}
          {t.confirmationNumber && <Fact label="Booking ref" value={<RefChip value={t.confirmationNumber} />} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          {!leg?.isConnection && (
            <NavigateButton
              variant="button"
              label={type === 'flight' ? 'Directions to the airport' : 'Directions'}
              destination={{ name: point.name, address: point.address ?? point.name, coordinates: point.coords }}
              suggestedMode={['train', 'bus', 'ferry'].includes(type) ? 'transit' : 'driving'}
            />
          )}
          {type === 'flight' && airline && (
            <Button
              variant="outlined"
              href={`https://www.google.com/search?q=${encodeURIComponent(`${airline} online check-in`)}`}
              target="_blank" rel="noopener"
              startIcon={<OpenInNewIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: NAVY }}
            >
              Online check-in
            </Button>
          )}
        </Box>
        <Documents files={linked('transport')} onOpen={openFile} />
        <ProofButtons tripId={tripId} expense={expenseFor('transport')} category={type} />
        <Button onClick={() => toLogistics('transport')} endIcon={<ChevronRightIcon />} sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, color: NAVY }}>
          Open in Logistics
        </Button>
      </>
    );
  }

  // ── Accommodation ──
  if (kind === 'accommodation' && lg?.accommodation?.[index]) {
    const a = lg.accommodation[index];
    Icon  = HotelIcon;
    title = a.name || 'Accommodation';
    const checkIn = a.checkIn
      ? resolveCheckIn({
          checkInDate:         ymd(a.checkIn),
          propertyCheckInTime: a.checkInTime,
          arrivals:            (lg.transportation ?? []).map((t: any) => t.arrivalTime ?? null),
        }).time
      : null;
    body = (
      <>
        {a.address && <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary' }}>{a.address}</Typography>}
        <Box sx={{ mt: 1.5 }}>
          {a.checkIn && <Fact label="Check-in" value={`${dateShown(a.checkIn)}${checkIn ? ` · from ${checkIn}` : ''}`} />}
          {a.checkOut && <Fact label="Check-out" value={`${dateShown(a.checkOut)} · by ${normaliseTime(a.checkOutTime) ?? '11:00'}`} />}
          {a.confirmationNumber && <Fact label="Booking ref" value={<RefChip value={a.confirmationNumber} />} />}
        </Box>
        {(a.address || a.coordinates) && (
          <Box sx={{ mt: 2 }}>
            <NavigateButton variant="button" label="Directions"
              destination={{ name: a.name, address: a.address, coordinates: coords(a.coordinates) }} />
          </Box>
        )}
        <Documents files={linked('accommodation')} onOpen={openFile} />
        <ProofButtons tripId={tripId} expense={expenseFor('accommodation')} category={a.type} />
        <Button onClick={() => toLogistics('accommodation')} endIcon={<ChevronRightIcon />} sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, color: NAVY }}>
          Open in Logistics
        </Button>
      </>
    );
  }

  // ── Venue ──
  if (kind === 'venue' && lg?.venues?.[index]) {
    const v = lg.venues[index];
    Icon  = EventIcon;
    title = v.name || 'Event';
    const time = normaliseTime(v.time);
    body = (
      <>
        {v.address && <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary' }}>{v.address}</Typography>}
        <Box sx={{ mt: 1.5 }}>
          <Fact label="What" value={TYPE_LABEL[v.type] ?? 'Event'} />
          {v.date && <Fact label="When" value={`${dateShown(v.date)}${time ? ` · ${time}` : ''}`} />}
          {v.confirmationNumber && <Fact label="Booking ref" value={<RefChip value={v.confirmationNumber} />} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          {(v.address || v.coordinates) && (
            <NavigateButton variant="button" label="Directions"
              destination={{ name: v.name, address: v.address, coordinates: coords(v.coordinates) }} />
          )}
          {v.website && (
            <Button variant="outlined" href={v.website} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: NAVY }}>
              Website
            </Button>
          )}
        </Box>
        <Documents files={linked('venue')} onOpen={openFile} />
        <ProofButtons tripId={tripId} expense={expenseFor('venue')} category={v.type} />
        <Button onClick={() => toLogistics('venues')} endIcon={<ChevronRightIcon />} sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, color: NAVY }}>
          Open in Logistics
        </Button>
      </>
    );
  }

  // ── Arrival ──
  if (kind === 'arrival' && lg) {
    const leg = legs.find(l => l.index === index) ?? null;
    if (leg) {
      Icon  = FlightLandIcon;
      body  = <Arrival trip={trip} leg={leg} legs={legs} data={data!} />;
      title = `Welcome to ${leg.arrCity || trip.destination?.city || 'your destination'}`;
    }
  }

  return (
    <>
      <Dialog
        open
        onClose={close}
        fullScreen={mobile}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { backgroundColor: PAPER, borderRadius: { sm: 2.5 } } }}
      >
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5,
          pt: mobile ? 'calc(env(safe-area-inset-top) + 12px)' : 1.5,
          backgroundColor: NAVY, color: 'white',
        }}>
          <Icon fontSize="small" />
          <Typography sx={{ fontWeight: 800, flexGrow: 1, minWidth: 0 }} noWrap>
            {title || (data ? 'Not found' : 'Loading…')}
          </Typography>
          <IconButton color="inherit" size="small" onClick={close} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ px: 2.5, py: 2, pb: 'calc(env(safe-area-inset-bottom) + 24px)', overflowY: 'auto' }}>
          {body ?? (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              {data ? 'This booking has changed or been removed.' : 'Loading…'}
            </Typography>
          )}
        </Box>
      </Dialog>
      <DocumentViewer file={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

// ── Arrival guide ─────────────────────────────────────────────────────────────

function Arrival({ trip, leg, legs, data }: { trip: any; leg: Leg; legs: Leg[]; data: Loaded }) {
  const tripId   = String(trip._id);
  const zone     = leg.arr?.zoneName ?? tripZones(trip)();
  const homeZone = placeTz(data.user?.homeLocation) ?? placeTz(trip.origin) ?? zone;
  const homeCC   = data.user?.homeLocation?.countryCode ?? trip.origin?.countryCode ?? null;
  const country  = leg.arrCountry;
  const city     = leg.arrCity || trip.destination?.city || '';

  const [now, setNow] = useState(() => DateTime.now());
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const local  = now.setZone(zone);
  const hours  = (local.offset - now.setZone(homeZone).offset) / 60;
  const offset = hours
    ? `${Number.isInteger(hours) ? Math.abs(hours) : Math.abs(hours).toFixed(1)}h ${hours > 0 ? 'ahead of' : 'behind'} home`
    : 'Same time as home';

  const date   = leg.arr!.toISODate()!;
  const accom  = data.logistics?.accommodation ?? [];
  const stay   = stayOn(accom, date) ?? (leg.arr!.hour < 6 ? stayOn(accom, leg.arr!.minus({ days: 1 }).toISODate()!) : null);
  const checkIn = stay?.a.checkIn
    ? resolveCheckIn({
        checkInDate:         ymd(stay.a.checkIn),
        propertyCheckInTime: stay.a.checkInTime,
        arrivals:            (data.logistics?.transportation ?? []).map((t: any) => t.arrivalTime ?? null),
      }).time
    : null;

  // The trip's AI journey plan covers the first arrival into the main destination.
  const firstArrival = legs.find(l => !l.landsInTransit && !l.arrivesHome && l.arr);
  const plan = firstArrival?.index === leg.index ? trip.groundTransport?.arrivalLeg : null;
  const steps = plan?.userPlan?.note
    ? [{ label: plan.userPlan.note }]
    : (plan?.steps ?? []).filter((s: any) => !(plan.dismissedSteps ?? []).includes(s.label));

  const meta     = country ? COUNTRY_META[country] : undefined;
  const homeMeta = homeCC ? COUNTRY_META[homeCC] : undefined;

  const day   = data.days.find((d: any) => d.date && ymd(d.date) === date);
  const after = leg.arr!.toFormat('HH:mm');
  const later = (day?.stops ?? [])
    .map((s: any) => ({ s, time: s.scheduledStart ? wallClock(s.scheduledStart, 'UTC')?.toFormat('HH:mm') : s.time }))
    .filter((x: any) => x.time && x.time > after && x.s.metadata?.phase !== 'arrival')
    .sort((a: any, b: any) => a.time.localeCompare(b.time));

  // Each weather day carries its stop's city (v1 cached days don't — those were
  // always the main destination), so a multi-city leg gets its own forecast and
  // landing back home never shows the destination's.
  const weather = (trip.weather?.days ?? []).find((w: any) =>
    w.date === date && (w.city ?? trip.destination?.city) === city);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: NAVY, lineHeight: 1 }}>
          {local.toFormat('HH:mm')}
        </Typography>
        <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
          local time · {offset}
        </Typography>
      </Box>
      {weather && (
        <Typography sx={{ mt: 0.75, fontSize: '0.88rem' }}>
          {weather.icon} {weather.condition}, {Math.round(weather.tempMax)}° / {Math.round(weather.tempMin)}°
        </Typography>
      )}

      {(stay || steps.length > 0) && (
        <Section title={stay ? `Getting to ${stay.a.name || 'your stay'}` : 'Getting into town'}>
          {stay && (
            <Box sx={{ mb: 1.25 }}>
              {stay.a.address && <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>{stay.a.address}</Typography>}
              {checkIn && <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mt: 0.25 }}>Check-in from {checkIn}</Typography>}
              {(stay.a.address || stay.a.coordinates) && (
                <Box sx={{ mt: 1 }}>
                  <NavigateButton variant="button" label="Directions"
                    destination={{ name: stay.a.name, address: stay.a.address, coordinates: coords(stay.a.coordinates) }} />
                </Box>
              )}
            </Box>
          )}
          {steps.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {steps.map((step: any, i: number) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.25 }}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1,
                    backgroundColor: alpha(GREEN, 0.12), color: GREEN,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800,
                  }}>
                    {i + 1}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      {step.label}{step.estimatedDuration ? ` · ${step.estimatedDuration}` : ''}
                    </Typography>
                    {step.description && (
                      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{step.description}</Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Section>
      )}

      {country && (
        <Box sx={{ mt: 2.5 }}>
          <ArrivalTransportCard countryCode={country} cityName={city} />
        </Box>
      )}

      {meta && (
        <Section title="Money and power">
          <Fact label="Currency" value={`${meta.currency} (${meta.currencySymbol})`} />
          <Fact
            label="Plugs"
            value={`Type ${meta.electricalPlug}${homeMeta && homeMeta.electricalPlug !== meta.electricalPlug ? ` · yours are ${homeMeta.electricalPlug}` : ''}`}
          />
          <Fact label="Emergency" value={<a href={`tel:${meta.emergency}`} style={{ color: 'inherit' }}>{meta.emergency}</a>} />
          {homeMeta && homeMeta.drivingSide !== meta.drivingSide && (
            <Fact label="Traffic" value={`Drives on the ${meta.drivingSide}`} />
          )}
        </Section>
      )}

      {later.length > 0 && (
        <Section title="Rest of today">
          {later.map(({ s, time }: any, i: number) => (
            <Box
              key={s._id ?? i}
              onClick={() => s._id && day?.dayNumber && s.source !== 'logistics'
                ? openAppUrl(`/trips/${tripId}?tab=itinerary&day=${day.dayNumber}&stop=${s._id}`)
                : openAppUrl(`/trips/${tripId}?tab=itinerary${day?.dayNumber ? `&day=${day.dayNumber}` : ''}`)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
            >
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: GREEN, width: 44 }}>{time}</Typography>
              <Typography sx={{ fontSize: '0.88rem', flexGrow: 1 }}>{s.name}</Typography>
              <ChevronRightIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </Box>
          ))}
        </Section>
      )}

      <Divider sx={{ mt: 3 }} />
      <Button
        onClick={() => openAppUrl(`/trips/${tripId}?tab=logistics&section=transport`)}
        endIcon={<ChevronRightIcon />}
        sx={{ mt: 1, textTransform: 'none', fontWeight: 700, color: NAVY }}
      >
        Open in Logistics
      </Button>
    </>
  );
}
