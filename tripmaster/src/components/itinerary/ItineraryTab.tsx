'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  DndContext, DragEndEvent,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Box, Typography, Paper, Button,
  IconButton, Chip, CircularProgress, Tooltip, Menu, MenuItem,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { alpha }              from '@mui/material/styles';
import { useTheme, useMediaQuery } from '@mui/material';
import AddIcon            from '@mui/icons-material/Add';
import RouteIcon          from '@mui/icons-material/Route';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import LockIcon           from '@mui/icons-material/Lock';
import HotelIcon          from '@mui/icons-material/Hotel';
import CalendarMonthIcon  from '@mui/icons-material/CalendarMonth';
import ViewDayIcon        from '@mui/icons-material/ViewDay';
import ViewAgendaIcon     from '@mui/icons-material/ViewAgenda';
import EditIcon           from '@mui/icons-material/Edit';
import CheckIcon          from '@mui/icons-material/Check';
import ZoomInIcon         from '@mui/icons-material/ZoomIn';
import ZoomOutIcon        from '@mui/icons-material/ZoomOut';
import CloseIcon          from '@mui/icons-material/Close';
import NightsStayIcon     from '@mui/icons-material/NightsStay';
import ChevronRightIcon   from '@mui/icons-material/ChevronRight';
import NavigateButton     from '@/components/ui/NavigateButton';
import ExportCalendarDialog from '@/components/calendar/ExportCalendarDialog';
import { saveTripCache, getTripCache } from '@/lib/offline/db';
import { sendOrQueue } from '@/lib/offline/writes';
import { readSaved, reportSaveFailure, reportCantSave } from '@/lib/offline/saveErrors';
import { useNotificationPrefs } from '@/lib/push/useNotifications';
import { CATEGORY_OPTIONS, type NotificationCategory } from '@/lib/push/prefs';
import { reminderGroup, stopLeadMins, type BookingCollection } from '@/lib/push/leads';
import {
  DAY_START_HOUR, DAY_END_HOUR,
  PX_PER_MIN_MOBILE, PX_PER_MIN_DESKTOP,
  SNAP_MINS, QUICK_ADD_TYPES, STOP_CONFIG, D,
} from './Itinerary.config';
import type { Day, Stop, KnownLocation } from './Itinerary.config';
import {
  stopStartMinutes, stopDuration, formatTime,
  freeSlots, freeLabelText, computeStopColumns, isUntimed, concurrentWith,
  dayPages, carriesOnPage,
} from './Itinerary.helpers';
import { clockMinutes, daysBetween, insertByTime, DAY_MINS, NIGHT_ENDS_MIN } from '@/lib/itinerary/nights';
import { localYmd }             from '@/lib/trips/onTrip';
import { HourRuler, GridLines, FreeGap, TravelConnector } from './Timelinechrome';
import { StopBlock }            from './Stopblock';
import { AddStopDrawer }        from './Addstopdrawer';
import { FreeSuggestionsModal } from './FreeSuggestionsModal';
import { StopDetailSheet }      from './StopDetailSheet';
import { ItineraryList }        from './ItineraryList';
import { useUrlParam }          from '@/lib/hooks/useUrlParam';
import { useFlights }           from '@/lib/flights/useFlights';
import { stopNote }             from '@/lib/flights/status';
import { haversineKm }          from '@/lib/geo/geocode';
import type { TravelOrigin }    from '@/lib/navigation/useTravelTimes';

const VIEW_MODES = ['timeline', 'list'] as const;
const MIN_ZOOM   = 1;
const MAX_ZOOM   = 3;
const clampZoom  = (z: number) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 20) / 20;

// Stable identity for a stop (a few logistics mirrors may lack an _id)
const stopKey = (s: Stop) => s._id ?? `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}`;

const ymdOf    = (v: string) => String(v).split('T')[0];
const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${ymdOf(date)}T12:00:00`).toLocaleDateString('en-IE', opts);

// Minutes from a day's midnight to now — past 24:00 in the small hours after it
const minutesSince = (date: string, now = new Date()) =>
  daysBetween(ymdOf(date), localYmd(now)) * DAY_MINS + now.getHours() * 60 + now.getMinutes();

// When a page's last stop finishes, in its minutes
const pageEnd = (stops: Stop[]) =>
  Math.max(-Infinity, ...stops.map(s => {
    const m = stopStartMinutes(s);
    return m === null ? -Infinity : m + stopDuration(s);
  }));

// Which night a time picked on the timeline is part of: after midnight past 24:00,
// the date's own early hours above 06:00, else no question
const lateAt = (mins: number) => (mins >= DAY_MINS ? true : mins < NIGHT_ENDS_MIN ? false : undefined);

interface Props {
  tripId:           string;
  startDate:        string;
  endDate:          string;
  fabTrigger?:      { action: string; seq: number } | null;
  onSwitchToDiscover?:  () => void;
  onSwitchToLogistics?: () => void;
}

// Stops whose pin is a departure point, not somewhere you'll be afterwards.
const NOT_A_PLACE = new Set(['flight', 'transport', 'transfer', 'checkin']);

interface Accom {
  name:         string;
  address?:     string;
  coordinates?: { lat: number; lng: number } | null;
  checkIn:      string;   // YYYY-MM-DD
  checkOut:     string;   // YYYY-MM-DD
}

export default function ItineraryTab({ tripId, fabTrigger, onSwitchToDiscover, onSwitchToLogistics }: Props) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const searchParams = useSearchParams();
  const pathname     = usePathname();

  const basePxPerMin = isMobile ? PX_PER_MIN_MOBILE : PX_PER_MIN_DESKTOP;

  // ── State ────────────────────────────────────────────────────────────────────
  const [days,           setDays]           = useState<Day[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filesByStop,    setFilesByStop]    = useState<Map<string, Array<{ _id: string; name: string; mimeType?: string; gcsUrl?: string }>>>(new Map());
  const [activeDayIdx,   setActiveDayIdx]   = useState(0);
  const [calculating,    setCalculating]    = useState(false);
  const [quickAddAnchor, setQuickAddAnchor] = useState<HTMLElement | null>(null);
  const [showAllDay,     setShowAllDay]     = useState(false);
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [accoms,         setAccoms]         = useState<Accom[]>([]);
  const [drawer, setDrawer] = useState<{
    open:       boolean;
    time:       string;
    type:       string;
    editStop?:  Stop;
    lateNight?: boolean;   // early hours: after midnight (true) or the date's own morning
  }>({ open: false, time: '09:00', type: 'activity' });
  const [suggestionSlot, setSuggestionSlot] = useState<{ start: number; mins: number } | null>(null);
  const [exportOpen,     setExportOpen]     = useState(false);

  // ── Reading a busy day ──────────────────────────────────────────────────────
  // View mode is the default: taps open the detail sheet and nothing can be
  // dragged. Edit mode turns on drag / resize / delete.
  const [viewMode,    setViewMode]    = useUrlParam('view', VIEW_MODES, 'timeline');
  const [editMode,    setEditMode]    = useState(false);
  const [zoom,        setZoom]        = useState(1);
  const [typeFilter,  setTypeFilter]  = useState<string[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [sheetKey,    setSheetKey]    = useState<string | null>(null);
  const zoomRef  = useRef(1);
  const pinchRef = useRef<HTMLDivElement>(null);
  zoomRef.current = zoom;
  const pxPerMin = basePxPerMin * zoom;

  const nowLineRef = useRef<HTMLDivElement>(null);

  // What each day's page shows: a night that runs past midnight keeps its
  // early-hours stops (stored on the next date) at the end of its own page.
  const pages       = useMemo(() => dayPages(days), [days]);
  const activeStops = pages[activeDayIdx]?.stops ?? [];
  // The calendar day after the viewed one, where its after-midnight stops are stored
  const nextIdx = days[activeDayIdx] && days[activeDayIdx + 1] &&
    daysBetween(days[activeDayIdx].date, days[activeDayIdx + 1].date) === 1 ? activeDayIdx + 1 : -1;

  // When each stop's notification goes out — same planner the sender uses.
  const [transport,     setTransport]     = useState<any[]>([]);
  const flights = useFlights(tripId);
  const [reminders,     setReminders]     = useState<Array<{ local: string; sent: boolean; ref?: { stopId?: string; collection?: string; index?: number; phase?: string } }>>([]);
  // Whether anything will be sent at all, and which bookings had theirs switched off
  const [reminderState, setReminderState] = useState<{
    enabled: boolean; muted: boolean;
    bookingsOff: Array<{ collection: string; index: number; group: string }>;
  }>({ enabled: true, muted: false, bookingsOff: [] });
  const { prefs: notifPrefs } = useNotificationPrefs();
  // A notification link (?stop=) landing on a stop: ring it for a moment.
  const [highlightStop, setHighlightStop] = useState<string | null>(null);
  const deepLinkedRef = useRef(false);

  // ── Pick the initial day: ?day=<dayNumber> if present, else today (or last night) ──
  // Only on the initial load — must not re-fire every time `days` changes (e.g. after
  // adding a stop), or the active day tab snaps back mid-edit.
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (days.length === 0 || hasAutoSelectedRef.current) return;
    hasAutoSelectedRef.current = true;
    const dayParam = searchParams.get('day');
    if (dayParam) {
      const byNum = days.findIndex(d => String(d.dayNumber) === dayParam);
      if (byNum !== -1) { setActiveDayIdx(byNum); return; }
    }
    // In the small hours while last night's programme is still on, that's the day
    const now       = new Date();
    const today     = localYmd(now);
    const lastNight = days.findIndex(d => daysBetween(ymdOf(d.date), today) === 1);
    const idx = lastNight !== -1 && minutesSince(days[lastNight].date, now) < pageEnd(pages[lastNight]?.stops ?? [])
      ? lastNight
      : days.findIndex(d => ymdOf(d.date) === today);
    // Write it to the URL too, so the address bar always names the day on screen
    selectDay(idx !== -1 ? idx : 0);
  }, [days, pages, searchParams]);

  // ── Keep the active day in the URL so refresh / back / deep-links land right ──
  const selectDay = (i: number) => {
    setActiveDayIdx(i);
    const dn = days[i]?.dayNumber;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('tab', 'itinerary');
    if (dn != null) params.set('day', String(dn));
    // Native replaceState (synced into useSearchParams by Next) — router.replace would
    // re-request the page from the server, which fails offline.
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };

  // React to the day param changing under us (back/forward button).
  useEffect(() => {
    const dayParam = searchParams.get('day');
    if (!dayParam || days.length === 0) return;
    const idx = days.findIndex(d => String(d.dayNumber) === dayParam);
    if (idx !== -1) setActiveDayIdx(prev => (prev === idx ? prev : idx));
  }, [searchParams, days]);

  // ── Notification link to a stop: open its day, scroll to it, ring it ─────────
  useEffect(() => {
    const stopId = searchParams.get('stop');
    if (!stopId || days.length === 0) return;
    // The page it's shown on — an after-midnight stop is on the night before's
    const idx = pages.findIndex(p => p.stops.some(s => s._id === stopId));
    // Drop the param either way so it doesn't fire again; keep tab and day.
    const params = new URLSearchParams(window.location.search);
    params.delete('stop');
    if (idx !== -1 && days[idx].dayNumber != null) params.set('day', String(days[idx].dayNumber));
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    if (idx === -1) return;
    deepLinkedRef.current = true;
    setActiveDayIdx(idx);
    setHighlightStop(stopId);
    setTimeout(() => {
      document.querySelector(`[data-stop-id="${stopId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    setTimeout(() => setHighlightStop(cur => (cur === stopId ? null : cur)), 4000);
  }, [days, pages, searchParams, pathname]);

  // ── Reminder times for the bells — refreshed shortly after any change ────────
  const loadReminders = useCallback(() => {
    fetch(`/api/trips/${tripId}/reminders`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        setReminders(data.reminders ?? []);
        setReminderState({ enabled: data.enabled !== false, muted: !!data.muted, bookingsOff: data.bookingsOff ?? [] });
      })
      .catch(() => {});
  }, [tripId]);

  useEffect(() => {
    if (days.length === 0) return;
    const t = setTimeout(loadReminders, 1500);
    return () => clearTimeout(t);
  }, [days, loadReminders, notifPrefs]);

  // Live gate / delay / landing for stops that mirror a flight
  const flightFor = (stop: Stop) => {
    const lr = (stop as any).logisticsRef as { collection: string; index: number } | undefined;
    const t  = stop.source === 'logistics' && lr?.collection === 'transport' ? transport[lr.index] : null;
    return t && (t.type || 'flight') === 'flight'
      ? { t, fs: flights[lr!.index] ?? null, phase: (stop as any).metadata?.phase as string | undefined }
      : null;
  };
  const liveFor = (stop: Stop) => {
    const f = flightFor(stop);
    return f?.fs ? stopNote(f.fs, f.phase) : null;
  };

  const reminderFor = (stop: Stop) => {
    const lr = (stop as any).logisticsRef as { collection: string; index: number } | undefined;
    return reminders.find(r =>
      (!!r.ref?.stopId && r.ref.stopId === stop._id) ||
      (stop.source === 'logistics' && !!lr && r.ref?.collection === lr.collection && r.ref?.index === lr.index &&
        (!r.ref.phase || r.ref.phase === (stop as any).metadata?.phase)),
    ) ?? null;
  };

  // ── Per-stop reminder control (from the stop's sheet) ────────────────────────
  // Your own stops: a lead time, or off. A booking's stop: its reminders on/off
  // (the timing comes from the booking — leave-by, check-in time…).
  const bookingOf = (stop: Stop) => {
    const lr = (stop as any).logisticsRef as { collection: BookingCollection; index: number } | undefined;
    if (stop.source !== 'logistics' || !lr) return null;
    const group = reminderGroup(lr.collection, (stop as any).metadata?.phase);
    return group ? { collection: lr.collection, index: lr.index, group } : null;
  };

  const reminderSettingFor = (stop: Stop) => {
    if (!stop._id || !(stop.scheduledStart || (stop as any).time)) return null;
    if (stop.source !== 'logistics') return { mode: 'lead' as const, value: stopLeadMins(stop) };
    const b = bookingOf(stop);
    if (!b) return null;
    const off = reminderState.bookingsOff.some(o => o.collection === b.collection && o.index === b.index && o.group === b.group);
    // Only where there's something to switch: a reminder planned, or one switched off
    return off || reminderFor(stop) ? { mode: 'booking' as const, on: !off } : null;
  };

  const reminderNoticeFor = (stop: Stop): string | null => {
    if ((notifPrefs ? !notifPrefs.enabled : !reminderState.enabled)) return 'All notifications are off';
    if (notifPrefs ? notifPrefs.mutedTrips.includes(tripId) : reminderState.muted) return 'Notifications for this trip are muted';
    const b = bookingOf(stop);
    const category: NotificationCategory = !b || b.collection === 'venue' ? 'itinerary' : b.group === 'arrival' ? 'landed' : 'travel';
    if (notifPrefs && !notifPrefs.categories[category]) {
      return `${CATEGORY_OPTIONS.find(c => c.key === category)?.label ?? 'These'} are switched off in notification settings`;
    }
    return null;
  };

  const setStopReminder = async (stop: Stop, lead: number | null) => {
    if (!stop._id) return;
    const prevDays    = days;
    const updatedDays = changeStop(days, stop._id, s => ({ ...s, notificationLeadMins: lead }));
    setDays(updatedDays);
    setReminders(rs => rs.filter(r => r.ref?.stopId !== stop._id));   // the old time no longer applies
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });
      const res = await sendOrQueue(
        { type: 'RESCHEDULE_STOP', tripId, payload: { stopId: stop._id, notificationLeadMins: lead } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stop._id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ notificationLeadMins: lead }),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
    } catch (err) {
      await undoDays(prevDays);
      reportSaveFailure(`the reminder for ${quoted(stop)}`, err);
    }
  };

  const setBookingReminder = async (stop: Stop, on: boolean) => {
    const b = bookingOf(stop);
    if (!b) return;
    const prev = reminderState;
    const same = (o: { collection: string; index: number; group: string }) =>
      o.collection === b.collection && o.index === b.index && o.group === b.group;
    const bookingsOff = on ? prev.bookingsOff.filter(o => !same(o)) : [...prev.bookingsOff.filter(o => !same(o)), b];
    setReminderState({ ...prev, bookingsOff });
    if (!on) setReminders(rs => rs.filter(r => !(r.ref?.collection === b.collection && r.ref?.index === b.index)));
    try {
      const res = await sendOrQueue(
        { type: 'SET_BOOKING_REMINDERS', tripId, payload: { ...b, off: !on } },
        () => fetch(`/api/trips/${tripId}/logistics/reminders`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...b, off: !on }),
        }),
        { [`/api/trips/${tripId}/reminders`]: (saved: any) => saved && { ...saved, bookingsOff } },
      );
      if (res) { await readSaved(res); loadReminders(); }
    } catch (err) {
      setReminderState(prev);
      loadReminders();
      reportSaveFailure(`the reminder for ${quoted(stop)}`, err);
    }
  };

  // ── Scroll to current time when the page on screen has it ─────────────────────
  // The line only renders on the page now falls in (today, or last night's page
  // in the small hours), so its presence is the test.
  useEffect(() => {
    if (!nowLineRef.current || deepLinkedRef.current) return;
    setTimeout(() => {
      nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [activeDayIdx, days]);

  // ── Pinch (touch) / ctrl+wheel (trackpad pinch) zooms the timeline ─────────
  // Native listeners: React's touch handlers are passive and can't stop the
  // browser zooming the whole page instead.
  useEffect(() => {
    const el = pinchRef.current;
    if (!el) return;
    let startDist = 0, startZoom = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { startDist = dist(e.touches); startZoom = zoomRef.current; }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      setZoom(clampZoom(startZoom * dist(e.touches) / startDist));
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) startDist = 0; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(clampZoom(zoomRef.current * Math.exp(-e.deltaY / 150)));
    };
    const noGesture = (e: Event) => e.preventDefault();   // iOS Safari page-zoom gesture
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', noGesture);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', noGesture);
    };
  }, [viewMode, loading, activeDayIdx]);

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // ── Load itinerary ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadItinerary() {
      try {
        const res  = await fetch(`/api/trips/${tripId}/itinerary`);
        const data = await res.json();
        setDays(data.days ?? []);
        const cached = await getTripCache(tripId);
        await saveTripCache(tripId, { ...(cached ?? {}), itinerary: data.days ?? [] });
      } catch {
        const cached = await getTripCache(tripId);
        if (cached?.itinerary) setDays(cached.itinerary);
      } finally {
        setLoading(false);
      }
    }
    loadItinerary();
  }, [tripId]);

  // ── Load files linked to itinerary stops ─────────────────────────────────────
  useEffect(() => {
    fetch(`/api/trips/${tripId}/files`)
      .then(r => r.json())
      .then(data => {
        const files: any[] = data.files ?? [];
        const map = new Map<string, Array<{ _id: string; name: string; mimeType?: string; gcsUrl?: string }>>();
        for (const f of files) {
          if (f.resourceType === 'file' && f.linkedTo?.entryId && f.gcsUrl) {
            const entry = { _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl };
            // Index by entryId (itinerary stop _id)
            if (!map.has(f.linkedTo.entryId)) map.set(f.linkedTo.entryId, []);
            map.get(f.linkedTo.entryId)!.push(entry);
            // Also index by collection:entryId for logistics-sourced stops
            if (f.linkedTo.collection) {
              const logKey = `${f.linkedTo.collection}:${f.linkedTo.entryId}`;
              if (!map.has(logKey)) map.set(logKey, []);
              map.get(logKey)!.push(entry);
            }
          }
        }
        setFilesByStop(map);
      })
      .catch(() => {});
  }, [tripId]);

  // ── Load known locations from logistics ──────────────────────────────────────
  useEffect(() => {
    fetch(`/api/trips/${tripId}/logistics`)
      .then(r => r.json())
      .then(data => {
        const logistics = data.logistics ?? data;
        const ymd = (v: any) => (v ? String(v).split('T')[0] : '');
        setTransport(logistics.transportation ?? []);
        setAccoms(
          (logistics.accommodation ?? [])
            .filter((a: any) => a.name && a.checkIn)
            .map((a: any) => ({
              name: a.name, address: a.address, coordinates: a.coordinates ?? null,
              checkIn: ymd(a.checkIn), checkOut: ymd(a.checkOut || a.checkIn),
            })),
        );
        const locs: KnownLocation[] = [];
        (logistics.accommodation ?? []).forEach((a: any) => {
          if (a.name) locs.push({ label: a.name, address: a.address, coordinates: a.coordinates, type: 'hotel' });
        });
        (logistics.venues ?? []).forEach((v: any) => {
          if (v.name) locs.push({ label: v.name, address: v.address, coordinates: v.coordinates, type: 'venue' });
        });
        (logistics.transportation ?? []).forEach((t: any) => {
          if (t.departureLocation) locs.push({ label: t.departureLocation, type: 'airport' });
          if (t.arrivalLocation)   locs.push({ label: t.arrivalLocation,   type: 'airport' });
        });
        const seen = new Set<string>();
        setKnownLocations(locs.filter(l => {
          if (seen.has(l.label)) return false;
          seen.add(l.label); return true;
        }));
      })
      .catch(() => {});
  }, [tripId]);

  // ── FAB trigger ──────────────────────────────────────────────────────────────
  const openDrawer = (time: string, type = 'activity', editStop?: Stop, lateNight?: boolean) =>
    setDrawer({ open: true, time, type, editStop, lateNight: lateNight ?? (editStop?.afterMidnight || undefined) });

  const handleStopClick = (stop: Stop) => {
    // View mode: read first — the detail sheet, with what else is on at the same time
    if (!editMode) { setSheetKey(stopKey(stop)); return; }
    // Fact from a booking → send the user to the Logistics
    // record, the only place it can actually be changed.
    if (stop.source === 'logistics' && stop.locked) {
      onSwitchToLogistics?.();
      return;
    }
    // Everything else (incl. derived logistics stops) → edit here.
    if (stop._id) {
      const t = stopStartMinutes(stop);
      openDrawer(t !== null ? formatTime(t) : '09:00', stop.type, stop);
    }
  };

  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.action === 'stop') openDrawer('09:00', 'activity');
  }, [fabTrigger]);

  // ── Where a time on this page is stored ──────────────────────────────────────
  // A start on the viewed page — minutes from its midnight, past 24:00 after it —
  // as it's saved: on the date it really falls, and for early hours which night.
  const placeMinutes = (mins: number) => {
    const late   = mins >= DAY_MINS && nextIdx !== -1;
    const dayIdx = late ? nextIdx : activeDayIdx;
    const clock  = mins % DAY_MINS;
    return {
      dayIdx,
      scheduledStart: `${ymdOf(days[dayIdx].date)}T${formatTime(clock)}:00`,
      lateNight:      clock < NIGHT_ENDS_MIN ? late : null,
    };
  };

  // A drawer time ("HH:MM") on the viewed page. Early hours are after midnight when
  // picked so — or, unpicked, when they'd carry on this page's evening.
  const placeTime = (time: string, lateNight?: boolean | null) => {
    const m = clockMinutes({ scheduledStart: time });
    if (m === null) {
      return { dayIdx: activeDayIdx, scheduledStart: `${ymdOf(days[activeDayIdx].date)}T${time}:00`, lateNight: null };
    }
    const late = m < NIGHT_ENDS_MIN && nextIdx !== -1 && (lateNight ?? carriesOnPage(activeStops, m));
    return placeMinutes(late ? m + DAY_MINS : m);
  };

  // One stop changed, and moved to the day its new time falls on — as the server does
  const changeStop = (src: Day[], stopId: string, change: (s: Stop) => Stop): Day[] => {
    const from = src.findIndex(d => d.stops.some(s => s._id === stopId));
    if (from === -1) return src;
    const updated = change(src[from].stops.find(s => s._id === stopId)!);
    const to      = src.findIndex(d => ymdOf(d.date) === updated.scheduledStart?.slice(0, 10));
    return src.map((d, i) => {
      if (to === -1 || to === from) {
        return i === from ? { ...d, stops: d.stops.map(s => (s._id === stopId ? updated : s)) } : d;
      }
      if (i === from) return { ...d, stops: d.stops.filter(s => s._id !== stopId) };
      if (i === to)   return { ...d, stops: insertByTime(d.stops, updated) };
      return d;
    });
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  // Optimistic days written into the saved itinerary when a change is queued offline.
  const savedDays = (updatedDays: Day[]) => ({
    [`/api/trips/${tripId}/itinerary`]: (saved: any) => ({ ...saved, days: updatedDays }),
  });

  // Each stop write below shows its change at once (and in the offline copy), then sends
  // or queues it. On any failure the change is undone and the error toast names the stop;
  // add / update / delete resolve false then, so their drawer stays open.
  const quoted = (s?: Partial<Stop>) => (s?.name?.trim() ? `“${s.name.trim()}”` : 'this stop');

  const daysFrom = async (res: Response): Promise<Day[]> => {
    const data = await readSaved(res);
    if (!Array.isArray(data.days)) throw new Error('No itinerary days in response');
    return data.days;
  };

  const undoDays = async (prevDays: Day[]) => {
    setDays(prevDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: prevDays });
    } catch (err) {
      console.error('[itinerary] could not restore the offline copy', err);
    }
  };

  const addStop = async (input: Partial<Stop>): Promise<boolean> => {
    const { afterMidnight: _view, ...form } = input;
    // After midnight → stored on the next date (still shown on this page)
    const placed      = placeTime(form.scheduledStart ?? '', form.lateNight);
    const stop        = { ...form, lateNight: placed.lateNight };   // time stays HH:MM: queue replay joins it to dayDate
    const day         = days[placed.dayIdx];
    const prevDays    = days;
    const updatedDays = [...days];
    updatedDays[placed.dayIdx] = {
      ...day,
      stops: [
        ...day.stops,
        {
          ...stop,
          scheduledStart: placed.scheduledStart,
          duration: stop.duration ?? 60,
        } as Stop,
      ],
    };
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'ADD_STOP', tripId, payload: { dayDate: day.date, stop } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            dayDate: day.date,
            stop: { ...stop, scheduledStart: placed.scheduledStart },
          }),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
      return true;
    } catch (err) {
      await undoDays(prevDays);
      reportSaveFailure(quoted(stop), err);
      return false;
    }
  };

  const updateStop = async (input: Partial<Stop>): Promise<boolean> => {
    const { afterMidnight: _view, ...stop } = input;   // view-only, never stored
    const stopId = stop._id;
    if (!stopId) { reportSaveFailure(`your changes to ${quoted(stop)}`); return false; }
    const prevDays = days;
    const { scheduledStart, lateNight } = placeTime(stop.scheduledStart ?? '', stop.lateNight);
    const change   = { ...stop, scheduledStart, lateNight };

    const updatedDays = changeStop(days, stopId, s => ({ ...s, ...change }));
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'RESCHEDULE_STOP', tripId, payload: { stopId, ...change } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(change),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
      return true;
    } catch (err) {
      await undoDays(prevDays);
      reportSaveFailure(`your changes to ${quoted(stop)}`, err);
      return false;
    }
  };

  const deleteStop = async (stopId: string): Promise<boolean> => {
    const prevDays    = days;
    const target      = days.flatMap(d => d.stops).find(s => s._id === stopId);
    const updatedDays = days.map(day => ({
      ...day,
      stops: day.stops.filter(s => s._id !== stopId),
    }));
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'DELETE_STOP', tripId, stopId },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, { method: 'DELETE' }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
      return true;
    } catch (err) {
      await undoDays(prevDays);
      reportSaveFailure(`the deletion of ${quoted(target)}`, err);
      return false;
    }
  };

  // "Not going" — reversible; skipped stops leave the plan, reminders and exports
  const skipStop = async (stop: Stop, skipped: boolean) => {
    if (!stop._id) return;
    const prevDays    = days;
    const updatedDays = days.map(d => ({
      ...d,
      stops: d.stops.map(s => (s._id === stop._id ? { ...s, skipped } : s)),
    }));
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'RESCHEDULE_STOP', tripId, payload: { stopId: stop._id, skipped } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stop._id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ skipped }),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
    } catch (err) {
      await undoDays(prevDays);
      reportSaveFailure(`${skipped ? '“Not going”' : '“Going after all”'} for ${quoted(stop)}`, err);
    }
  };

  const rescheduleStop = async (stopId: string, newStartMin: number) => {
    const prevDays = days;
    const target   = activeStops.find(s => s._id === stopId);
    const { scheduledStart, lateNight } = placeMinutes(newStartMin);

    const updatedDays = changeStop(days, stopId, s => ({ ...s, scheduledStart, lateNight }));
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'RESCHEDULE_STOP', tripId, payload: { stopId, scheduledStart, lateNight } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ scheduledStart, lateNight }),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
    } catch (err) {
      // Snap it back to where it was
      await undoDays(prevDays);
      reportSaveFailure(`the new time for ${quoted(target)}`, err);
    }
  };

  // A stop with no server id has nothing to PATCH, so a move would only ever exist on
  // screen and vanish on reload. Refuse it out loud instead.
  const cantMove = (stop: Stop) =>
    reportCantSave(`${quoted(stop)} can’t be moved yet — it hasn’t been saved to the server. Reload and try again.`);

  const resizeStop = async (stop: Stop, newStartMin: number, newDuration: number) => {
    const stopId = stop._id;
    if (!stopId) { cantMove(stop); return; }
    const prevDays = days;
    const { scheduledStart, lateNight } = placeMinutes(newStartMin);
    const change   = { scheduledStart, lateNight, duration: newDuration };

    const updatedDays = changeStop(days, stopId, s => ({ ...s, ...change }));
    setDays(updatedDays);
    try {
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: updatedDays });

      const res = await sendOrQueue(
        { type: 'RESCHEDULE_STOP', tripId, payload: { stopId, ...change } },
        () => fetch(`/api/trips/${tripId}/itinerary/stops/${stopId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(change),
        }),
        savedDays(updatedDays),
      );
      if (res) setDays(await daysFrom(res));
    } catch (err) {
      // Snap it back to its old start and length
      await undoDays(prevDays);
      reportSaveFailure(`the new time for ${quoted(stop)}`, err);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const stopId = active.id as string;
    const stop   = activeStops.find(s =>
      s._id === stopId ||
      `${s.name}-${s.scheduledStart ?? s.time ?? 'notime'}` === stopId,
    );
    if (!stop) return;

    const startMin = stopStartMinutes(stop);
    if (startMin === null) return;

    const deltaMin = Math.round((delta.y / pxPerMin) / SNAP_MINS) * SNAP_MINS;
    if (deltaMin === 0) return;

    const { min, max } = dragBounds(stop);
    const newStartMin  = Math.max(min, Math.min(max, startMin + deltaMin));

    if (newStartMin !== startMin) {
      if (stop._id) rescheduleStop(stop._id, newStartMin);
      else cantMove(stop);
    }
  };

  const calculateTravel = async () => {
    setCalculating(true);
    try {
      const res = await sendOrQueue(
        { type: 'CALCULATE_TRAVEL', tripId },
        () => fetch(`/api/trips/${tripId}/itinerary/calculate-travel`, { method: 'POST' }),
      );
      if (!res) return;
      const calculated = await daysFrom(res);
      setDays(calculated);
      await saveTripCache(tripId, { ...(await getTripCache(tripId)), itinerary: calculated });
    } catch (err) {
      // Nothing was changed on screen or offline — the current plan stays as it is.
      reportSaveFailure('the travel times', err);
    } finally {
      setCalculating(false);
    }
  };

  // ── Loading / empty ───────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
  if (!days.length) return (
    <Typography sx={{ py: 4, textAlign: 'center', color: D.muted, fontFamily: D.body }}>
      No itinerary days found.
    </Typography>
  );

  const activeDay        = days[activeDayIdx];
  const prevDay          = activeDayIdx > 0 ? days[activeDayIdx - 1] : undefined;
  const nextDay          = nextIdx !== -1 ? days[nextIdx] : undefined;
  // This date's early-hours stops, shown at the end of the night before
  const movedBack        = pages[activeDayIdx]?.movedBack ?? [];
  // What you're actually doing — skipped stops don't count as busy
  const committed        = activeStops.filter(s => !s.skipped);
  const skippedCount     = activeStops.length - committed.length;
  const typesToday       = Array.from(new Set(committed.map(s => s.type))).filter(t => STOP_CONFIG[t]);
  const visibleStops     = activeStops.filter(s =>
    (showSkipped || !s.skipped) && (typeFilter.length === 0 || typeFilter.includes(s.type)),
  );
  const freeLabel        = activeDay ? freeLabelText(committed) : '';
  const timedStops       = visibleStops.filter(s => !isUntimed(s));
  const allDayStops      = visibleStops.filter(isUntimed);
  // Short blocks render at a minimum height — reserve that in the layout
  const stopCols         = computeStopColumns(timedStops, Math.ceil((isMobile ? 40 : 32) / pxPerMin));
  const maxCols          = Math.max(1, ...stopCols.map(c => c.totalCols));
  // Zoom widens the grid only when there's a clash to pull apart
  const timelineWidthPct = 100 * (maxCols > 1 ? zoom : 1);

  const filesFor = (stop: Stop) =>
    (stop._id && filesByStop.get(stop._id)?.length)
      ? filesByStop.get(stop._id)!
      : (stop as any).logisticsRef
      ? filesByStop.get(`${(stop as any).logisticsRef.collection}:${String((stop as any).logisticsRef.index)}`) ?? []
      : [];

  const sheetStop = sheetKey ? activeStops.find(s => stopKey(s) === sheetKey) ?? null : null;
  const ALL_DAY_COLLAPSED = 6;
  const shownAllDay      = showAllDay ? allDayStops : allDayStops.slice(0, ALL_DAY_COLLAPSED);

  // Which accommodation covers the day being viewed — the persistent "you're
  // based here" anchor a business traveller wants without hunting through Logistics.
  const activeDayYmd = activeDay ? String(activeDay.date).split('T')[0] : '';
  const basedAt = activeDayYmd
    ? accoms.find(a => a.checkIn <= activeDayYmd && activeDayYmd <= a.checkOut) ?? null
    : null;

  // Where a stop's Navigate times start when you're not near it yet: the stop
  // before it that day, else where you're based. Travel stops are skipped — their
  // pin is where you set off from, not where you'll be.
  const navFromFor = (stop: Stop): TravelOrigin | null => {
    const at    = stop.coordinates;
    const start = stopStartMinutes(stop);
    const elsewhere = (c?: { lat: number; lng: number } | null): c is { lat: number; lng: number } =>
      !!c && (!at || haversineKm(c.lat, c.lng, at.lat, at.lng) > 0.05);
    const prev = start === null ? undefined : activeStops
      .filter(s => s !== stop && !s.skipped && !NOT_A_PLACE.has(s.type) && elsewhere(s.coordinates))
      .map(s => ({ s, m: stopStartMinutes(s) }))
      .filter((x): x is { s: Stop; m: number } => x.m !== null && x.m < start)
      .sort((a, b) => a.m - b.m)
      .pop()?.s;
    if (prev?.coordinates) return { name: prev.name, coordinates: prev.coordinates };
    return elsewhere(basedAt?.coordinates) ? { name: basedAt!.name, coordinates: basedAt!.coordinates! } : null;
  };

  // Per-day effective timeline bounds — expands upward for early flights, downward for late-night events
  const stopMins = activeStops
    .map(s => stopStartMinutes(s))
    .filter((m): m is number => m !== null);
  const effectiveStartHour = stopMins.length
    ? Math.min(DAY_START_HOUR, Math.floor(Math.min(...stopMins) / 60))
    : DAY_START_HOUR;
  const effectiveEndHour = activeStops.length
    ? Math.max(DAY_END_HOUR, ...activeStops.map(s => {
        const m = stopStartMinutes(s);
        return m !== null ? Math.ceil((m + stopDuration(s)) / 60) : 0;
      }))
    : DAY_END_HOUR;
  const effectiveTimelineH = (effectiveEndHour - effectiveStartHour) * 60 * pxPerMin;

  // Where a dragged stop may start. Past midnight only into a next day the trip
  // has, and not for booking stops — their logistics sync keys on the date.
  const dragBounds = (stop: Stop) => {
    const endHour = nextIdx !== -1 && stop.source !== 'logistics'
      ? effectiveEndHour
      : Math.min(effectiveEndHour, DAY_END_HOUR);
    return { min: effectiveStartHour * 60, max: endHour * 60 - stopDuration(stop) };
  };

  // Now, on this page's clock — today, or past 24:00 on last night's page
  const nowMins = activeDay ? minutesSince(activeDay.date) : null;

  // The early-hours choice in the drawer: what's pre-selected for a time
  const nightDates = activeDay && nextDay
    ? {
        morning:       dayLabel(activeDay.date, { weekday: 'short', day: 'numeric' }),
        afterMidnight: dayLabel(nextDay.date,   { weekday: 'short', day: 'numeric' }),
      }
    : null;
  const nightDefault = (mins: number) =>
    drawer.lateNight ??
    // Moving a morning stop earlier means earlier that morning, not tonight
    (drawer.editStop && !drawer.editStop.afterMidnight && (stopStartMinutes(drawer.editStop) ?? 0) < 12 * 60
      ? false
      : carriesOnPage(activeStops, mins));

  // From this date's page to the night before, where its early hours are shown
  const showLastNight = () => {
    const first = [...movedBack]
      .sort((a, b) => (stopStartMinutes(a) ?? 0) - (stopStartMinutes(b) ?? 0))
      .find(s => s._id)?._id;
    selectDay(activeDayIdx - 1);
    if (!first) return;
    setHighlightStop(first);
    setTimeout(() => {
      document.querySelector(`[data-stop-id="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    setTimeout(() => setHighlightStop(cur => (cur === first ? null : cur)), 4000);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box>

      {/* ── Page header ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', mb: 2.5, gap: 1,
      }}>
        <Typography sx={{
          fontFamily: D.display,
          fontSize:   { xs: '1.1rem', sm: '1.25rem' },
          color:      D.navy, lineHeight: 1,
        }}>
          Itinerary
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isMobile ? (
            <Tooltip title="Calculate A-to-B travel times">
              <span>
                <IconButton
                  onClick={calculateTravel}
                  disabled={calculating}
                  size="medium"
                  sx={{
                    border: `1.5px solid ${D.rule}`,
                    borderRadius: 1.5, minWidth: 44, minHeight: 44,
                    color: D.muted,
                  }}
                >
                  {calculating ? <CircularProgress size={18} /> : <RouteIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="outlined" size="small"
              onClick={calculateTravel}
              disabled={calculating}
              startIcon={calculating ? <CircularProgress size={14} /> : <DirectionsWalkIcon />}
              sx={{ fontFamily: D.body, fontWeight: 700 }}
            >
              {calculating ? 'Calculating…' : 'Calculate A-to-B'}
            </Button>
          )}
          {isMobile ? (
            <Tooltip title="Export to calendar">
              <span>
                <IconButton
                  onClick={() => setExportOpen(true)}
                  size="medium"
                  sx={{ border: `1.5px solid ${D.rule}`, borderRadius: 1.5, minWidth: 44, minHeight: 44, color: D.muted }}
                >
                  <CalendarMonthIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="outlined" size="small"
              onClick={() => setExportOpen(true)}
              startIcon={<CalendarMonthIcon />}
              sx={{ fontFamily: D.body, fontWeight: 700 }}
            >
              Export
            </Button>
          )}
          <Button
            variant="contained"
            size={isMobile ? 'medium' : 'small'}
            startIcon={<AddIcon />}
            onClick={() => openDrawer('09:00', 'activity')}
            sx={{
              fontFamily: D.display,
              fontSize:   '0.78rem',
              letterSpacing: '0.04em',
              ...(isMobile && { minHeight: 44, px: 2 }),
            }}
          >
            Add
          </Button>
        </Box>
      </Box>

      <ExportCalendarDialog tripId={tripId} open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* ── Day selector — full-width grid ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days.length}, 1fr)`,
        mb: 2,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${D.rule}`,
        backgroundColor: '#ffffff',
      }}>
        {days.map((day, i) => {
          const d        = new Date(day.date);
          const dow      = d.toLocaleDateString('en-IE', { weekday: 'short' });
          const dayNum   = d.toLocaleDateString('en-IE', { day: 'numeric' });
          const mon      = d.toLocaleDateString('en-IE', { month: 'short' });
          const hasStops = (pages[i]?.stops.length ?? 0) > 0;
          const active   = i === activeDayIdx;

          return (
            <Box
              key={day.date}
              onClick={() => selectDay(i)}
              sx={{
                textAlign:       'center',
                py:              1,
                px:              0.5,
                cursor:          'pointer',
                backgroundColor: active ? D.navy : 'transparent',
                borderRight:     i < days.length - 1 ? `1px solid ${D.rule}` : 'none',
                transition:      'background-color 0.15s',
                '&:hover':       !active ? { backgroundColor: alpha(D.navy, 0.04) } : {},
                '&:active':      { opacity: 0.85 },
              }}
            >
              {/* DOW */}
              <Typography sx={{
                fontSize:      '0.52rem',
                fontWeight:    800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily:    D.body,
                color:         active ? 'rgba(255,255,255,0.55)' : D.muted,
                lineHeight:    1,
                mb:            0.5,
              }}>
                {dow}
              </Typography>

              {/* Day number */}
              <Typography sx={{
                fontFamily: D.display,
                fontSize:   isMobile ? '1.4rem' : '1.6rem',
                lineHeight: 1,
                color:      active ? '#ffffff' : D.navy,
              }}>
                {dayNum}
              </Typography>

              {/* Month */}
              <Typography sx={{
                fontSize:      '0.52rem',
                fontWeight:    700,
                letterSpacing: '0.08em',
                fontFamily:    D.body,
                color:         active ? 'rgba(255,255,255,0.55)' : D.muted,
                lineHeight:    1,
                mt:            0.5,
              }}>
                {mon}
              </Typography>

              {/* Stop dot */}
              <Box sx={{
                width: 4, height: 4, borderRadius: '50%', mx: 'auto', mt: 0.75,
                backgroundColor: hasStops
                  ? active ? 'rgba(255,255,255,0.5)' : D.terra
                  : 'transparent',
              }} />
            </Box>
          );
        })}
      </Box>

      {/* ── Day header — one line, so the timeline starts near the top ── */}
      {activeDay && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
            <Typography sx={{
              fontFamily: D.display, fontSize: { xs: '1.3rem', sm: '1.5rem' },
              lineHeight: 1, color: D.navy, whiteSpace: 'nowrap',
            }}>
              Day {activeDay.dayNumber}
            </Typography>
            <Typography sx={{
              fontFamily: D.body, fontSize: { xs: '0.8rem', sm: '0.9rem' }, fontWeight: 600,
              color: D.muted, lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {new Date(activeDay.date).toLocaleDateString('en-IE', {
                weekday: isMobile ? 'short' : 'long', day: 'numeric', month: isMobile ? 'short' : 'long',
              })}
            </Typography>
          </Box>

          {/* Stat chips */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <Chip
              size="small"
              label={`${committed.filter(s => s.source !== 'logistics').length} planned`}
              sx={{
                backgroundColor: alpha(D.green, 0.12),
                color: D.green, fontWeight: 700,
                fontFamily: D.body, fontSize: '0.7rem',
              }}
            />
            <Chip
              size="small"
              label={freeLabel}
              sx={{
                backgroundColor: alpha(D.navy, 0.07),
                color: D.navy, fontWeight: 700,
                fontFamily: D.body, fontSize: '0.7rem',
              }}
            />
            {skippedCount > 0 && (
              <Chip
                size="small"
                label={showSkipped ? `Hide ${skippedCount} not going` : `${skippedCount} not going`}
                onClick={() => setShowSkipped(v => !v)}
                variant={showSkipped ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, fontFamily: D.body, fontSize: '0.7rem', color: D.navy, borderColor: alpha(D.navy, 0.2) }}
              />
            )}
            {activeStops.filter(s => s.source === 'logistics').length > 0 && (
              <Chip
                size="small"
                icon={<LockIcon sx={{ fontSize: '11px !important' }} />}
                label={`${activeStops.filter(s => s.source === 'logistics').length} from logistics`}
                sx={{
                  backgroundColor: alpha(D.terra, 0.10),
                  color: D.terra, fontWeight: 700,
                  fontFamily: D.body, fontSize: '0.7rem',
                  '& .MuiChip-icon': { color: D.terra },
                }}
              />
            )}
          </Box>

          {/* Quick add — pick a type, drawer opens pre-set */}
          <Button
            variant="outlined" size="small"
            startIcon={<AddIcon />}
            onClick={e => setQuickAddAnchor(e.currentTarget)}
            sx={{ flexShrink: 0, fontFamily: D.body, fontWeight: 700, ...(isMobile && { minHeight: 36 }) }}
          >
            Quick add
          </Button>
          <Menu
            anchorEl={quickAddAnchor}
            open={!!quickAddAnchor}
            onClose={() => setQuickAddAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {QUICK_ADD_TYPES.map(t => {
              const c = STOP_CONFIG[t];
              return (
                <MenuItem
                  key={t}
                  onClick={() => { setQuickAddAnchor(null); openDrawer('09:00', t); }}
                  sx={{ fontFamily: D.body, fontWeight: 600, fontSize: '0.88rem', color: c.color, gap: 1 }}
                >
                  <c.Icon sx={{ fontSize: 18 }} />
                  {c.label.replace(/^\S+\s*/, '') || c.label}
                </MenuItem>
              );
            })}
          </Menu>
        </Box>
      )}

      {/* ── "Based at" — one slim line: the hotel for the day being viewed ── */}
      {basedAt && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 1.5, px: 1.25, py: 0.5,
          borderRadius: '8px',
          border: `1px solid ${alpha('#5c35a0', 0.25)}`,
          backgroundColor: alpha('#5c35a0', 0.06),
        }}>
          <HotelIcon sx={{ fontSize: 16, color: '#5c35a0', flexShrink: 0 }} />
          <Typography sx={{
            fontFamily: D.body, fontSize: '0.8rem', color: D.navy, lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
          }}>
            <Box component="span" sx={{ fontWeight: 800 }}>{basedAt.name}</Box>
            {basedAt.address && <Box component="span" sx={{ color: D.muted }}> · {basedAt.address}</Box>}
          </Typography>
          {(basedAt.address || basedAt.coordinates) && (
            <NavigateButton
              destination={{ name: basedAt.name, address: basedAt.address, coordinates: basedAt.coordinates ?? null }}
              suggestedMode="driving"
              size="small"
              sx={{ flexShrink: 0, minWidth: 32, minHeight: 32 }}
            />
          )}
        </Box>
      )}

      {/* ── View controls — one slim row ── */}
      {activeDay && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <ToggleButtonGroup
            size="small" exclusive value={viewMode}
            onChange={(_, v) => { if (v) { setViewMode(v); if (v === 'list') setEditMode(false); } }}
            sx={{ flexShrink: 0, '& .MuiToggleButton-root': { px: 1.25, gap: 0.5, fontFamily: D.body, fontWeight: 700, fontSize: '0.72rem', minHeight: 36 } }}
          >
            <ToggleButton value="timeline" aria-label="Timeline"><ViewDayIcon sx={{ fontSize: 18 }} />{!isMobile && 'Timeline'}</ToggleButton>
            <ToggleButton value="list" aria-label="List"><ViewAgendaIcon sx={{ fontSize: 18 }} />{!isMobile && 'List'}</ToggleButton>
          </ToggleButtonGroup>

          {/* Type filter — one scrolling line */}
          <Box sx={{
            flex: 1, minWidth: 0, display: 'flex', gap: 0.5, overflowX: 'auto',
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          }}>
            {typesToday.length > 1 && (
              <Chip
                label="All"
                onClick={() => setTypeFilter([])}
                sx={{
                  flexShrink: 0, height: 32, fontFamily: D.body, fontWeight: 700, fontSize: '0.72rem',
                  border: `1.5px solid ${typeFilter.length === 0 ? D.navy : alpha(D.navy, 0.2)}`,
                  backgroundColor: typeFilter.length === 0 ? D.navy : 'transparent',
                  color: typeFilter.length === 0 ? '#fff' : D.navy,
                  '&:hover': { backgroundColor: typeFilter.length === 0 ? D.navy : alpha(D.navy, 0.06) },
                }}
              />
            )}
            {typesToday.length > 1 && typesToday.map(t => {
              const c  = STOP_CONFIG[t];
              const on = typeFilter.includes(t);
              return (
                <Chip
                  key={t}
                  label={c.label.replace(/^\S+\s*/, '') || c.label}
                  onClick={() => setTypeFilter(f => (on ? f.filter(x => x !== t) : [...f, t]))}
                  sx={{
                    flexShrink: 0, height: 32, fontFamily: D.body, fontWeight: 700, fontSize: '0.72rem',
                    border: `1.5px solid ${on ? c.color : alpha(c.color, 0.3)}`,
                    backgroundColor: on ? alpha(c.color, 0.14) : 'transparent',
                    color: c.color,
                  }}
                />
              );
            })}
          </Box>

          {viewMode === 'timeline' && (
            <>
              {!isMobile && (
                <IconButton size="small" onClick={() => setZoom(z => clampZoom(z - 0.5))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              )}
              {(zoom > 1 || !isMobile) && (
                <Chip
                  size="small" label={`${zoom.toFixed(zoom % 1 ? 1 : 0)}×`}
                  onClick={zoom > 1 ? () => setZoom(1) : undefined}
                  title={zoom > 1 ? 'Reset zoom' : 'Pinch or ctrl-scroll to zoom'}
                  sx={{ flexShrink: 0, fontFamily: D.body, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 44 }}
                />
              )}
              {!isMobile && (
                <IconButton size="small" onClick={() => setZoom(z => clampZoom(z + 0.5))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              )}
              <Button
                size="small"
                variant={editMode ? 'contained' : 'outlined'}
                startIcon={editMode ? <CheckIcon /> : <EditIcon />}
                onClick={() => setEditMode(v => !v)}
                sx={{
                  flexShrink: 0, fontFamily: D.body, fontWeight: 700, minHeight: 36,
                  ...(editMode && { backgroundColor: D.terra, '&:hover': { backgroundColor: D.terra } }),
                }}
              >
                {editMode ? 'Done' : 'Edit'}
              </Button>
            </>
          )}
        </Box>
      )}

      {/* ── Timeline / list ── */}
      {activeDay && (
        <Paper sx={{
          backgroundColor: '#ffffff',
          overflow: 'hidden',
          borderRadius: '2px',
          // Edit mode is unmistakable without taking any space
          border: editMode && viewMode === 'timeline' ? `2px solid ${D.terra}` : `1px solid ${D.rule}`,
        }}>
          {/* ── This date's early hours are on the night before's page ── */}
          {movedBack.length > 0 && prevDay && (
            <Box
              role="button"
              onClick={showLastNight}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                minHeight: 44, px: 1.5,
                borderBottom: `1px solid ${D.rule}`,
                backgroundColor: alpha(D.navy, 0.04),
                cursor: 'pointer',
                '&:active': { backgroundColor: alpha(D.navy, 0.08) },
                '@media (hover: hover)': { '&:hover': { backgroundColor: alpha(D.navy, 0.06) } },
              }}
            >
              <NightsStayIcon sx={{ fontSize: 18, color: D.navy, flexShrink: 0 }} />
              <Typography sx={{
                flex: 1, minWidth: 0,
                fontFamily: D.body, fontSize: '0.8rem', fontWeight: 700, color: D.navy,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {movedBack.length} {movedBack.length === 1 ? 'stop' : 'stops'} after midnight · on {dayLabel(prevDay.date, { weekday: 'long' })} night
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 20, color: D.muted, flexShrink: 0 }} />
            </Box>
          )}

          {/* ── All-day strip — venues/places known only by date, no time ── */}
          {allDayStops.length > 0 && (
            <Box sx={{ display: 'flex', borderBottom: `1px solid ${D.rule}`, backgroundColor: alpha(D.navy, 0.02) }}>
              <Box sx={{
                flexShrink: 0, width: 58, borderRight: `1px solid ${D.rule}`,
                display: 'flex', justifyContent: 'center', pt: 1.4,
              }}>
                <Typography sx={{
                  fontFamily: D.body, fontSize: '0.58rem', fontWeight: 800,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: D.muted, lineHeight: 1.2, textAlign: 'center',
                }}>
                  All day
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75, p: 1 }}>
                {shownAllDay.map((stop, i) => {
                  const c      = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
                  const isFact = stop.source === 'logistics' && stop.locked;
                  return (
                    <Box
                      key={stop._id ?? i}
                      onClick={() => handleStopClick(stop)}
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        maxWidth: '100%', px: 1, py: 0.5,
                        borderRadius: '6px',
                        borderLeft: `3px solid ${c.color}`,
                        backgroundColor: '#ffffff',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        '&:hover': { boxShadow: `0 0 0 1.5px ${alpha(c.color, 0.5)}` },
                      }}
                    >
                      <Typography sx={{
                        fontFamily: D.body, fontSize: '0.75rem', fontWeight: 700, color: D.navy,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {stop.name?.trim() || 'Unnamed stop'}
                      </Typography>
                      {isFact && <LockIcon sx={{ fontSize: 10, color: alpha(D.navy, 0.35), flexShrink: 0 }} />}
                    </Box>
                  );
                })}
                {allDayStops.length > ALL_DAY_COLLAPSED && (
                  <Chip
                    size="small"
                    label={showAllDay ? 'Less' : `+${allDayStops.length - ALL_DAY_COLLAPSED} more`}
                    onClick={() => setShowAllDay(v => !v)}
                    sx={{
                      alignSelf: 'center',
                      backgroundColor: alpha('#000', 0.04),
                      color: D.muted, fontFamily: D.body, fontWeight: 700, fontSize: '0.7rem',
                    }}
                  />
                )}
              </Box>
            </Box>
          )}

          {viewMode === 'list' ? (
            <ItineraryList
              stops={timedStops}
              onOpen={s => setSheetKey(stopKey(s))}
              onSkip={skipStop}
              live={liveFor}
              afterMidnightLabel={nextDay ? dayLabel(nextDay.date, { weekday: 'short', day: 'numeric' }) : undefined}
            />
          ) : (
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <Box ref={pinchRef} sx={{ display: 'flex', position: 'relative', height: effectiveTimelineH + 32, touchAction: 'pan-x pan-y' }}>

              {/* Hour ruler column */}
              <Box sx={{
                flexShrink: 0, width: 58, position: 'relative',
                borderRight: `1px solid ${D.rule}`, pt: 2,
              }}>
                <HourRuler
                  pxPerMin={pxPerMin} startHour={effectiveStartHour} endHour={effectiveEndHour}
                  nextDayLabel={nextDay ? dayLabel(nextDay.date, { weekday: 'short' }) : undefined}
                />
              </Box>

              {/* Timeline column — scrolls sideways when zoomed into a clash */}
              <Box sx={{ flex: 1, minWidth: 0, overflowX: timelineWidthPct > 100 ? 'auto' : 'hidden', overflowY: 'hidden' }}>
              <Box
                sx={{
                  width: `${timelineWidthPct}%`, height: '100%',
                  position: 'relative', pt: 2, pb: 2,
                  cursor: isMobile ? 'default' : 'crosshair',
                }}
                onClick={e => {
                  if (isMobile) return;
                  const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const relY    = e.clientY - rect.top - 16;
                  const mins    = Math.round(relY / pxPerMin / 15) * 15 + effectiveStartHour * 60;
                  const clamped = Math.max(effectiveStartHour * 60, Math.min(effectiveEndHour * 60 - 30, mins));
                  openDrawer(formatTime(clamped), 'activity', undefined, lateAt(clamped));
                }}
              >
                <GridLines pxPerMin={pxPerMin} startHour={effectiveStartHour} endHour={effectiveEndHour} />

                {/* Current time indicator — only on the page now falls in */}
                {(() => {
                  if (nowMins === null) return null;
                  const sinceTop = nowMins - effectiveStartHour * 60;
                  if (sinceTop < 0 || sinceTop > effectiveTimelineH / pxPerMin) return null;
                  const top = sinceTop * pxPerMin + 16;
                  return (
                    <Box
                      ref={nowLineRef}
                      sx={{
                        position:  'absolute',
                        top,
                        left:      0,
                        right:     0,
                        height:    2,
                        backgroundColor: '#e53935',
                        zIndex:    10,
                        pointerEvents: 'none',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -4,
                          top: -4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: '#e53935',
                        },
                      }}
                    />
                  );
                })()}

                {(() => {
                  const slots      = freeSlots(committed);
                  const largestIdx = slots.reduce((best, s, i) => s.mins > (slots[best]?.mins ?? 0) ? i : best, 0);
                  return slots.map((slot, i) => (
                    <FreeGap
                      key={i}
                      slot={slot}
                      onQuickAdd={time => openDrawer(time, 'activity', undefined, lateAt(slot.start))}
                      onDiscover={i === largestIdx && slot.mins >= 120 ? () => setSuggestionSlot(slot) : undefined}
                      pxPerMin={pxPerMin}
                      isMobile={isMobile}
                      startHour={effectiveStartHour}
                    />
                  ));
                })()}

                {(() => {
                  const cols = stopCols;
                  return timedStops.map((stop, i) => (
                    <Box key={stop._id ?? i}>
                      <StopBlock
                        stop={stop}
                        onDelete={stop._id ? () => deleteStop(stop._id!) : undefined}
                        onClick={() => handleStopClick(stop)}
                        onResize={(newStartMin, newDuration) => resizeStop(stop, newStartMin, newDuration)}
                        pxPerMin={pxPerMin}
                        isMobile={isMobile}
                        colIndex={cols[i].col}
                        totalCols={cols[i].totalCols}
                        colSpan={cols[i].span}
                        startHour={effectiveStartHour}
                        linkedFiles={filesFor(stop)}
                        reminder={reminderFor(stop)}
                        live={liveFor(stop)}
                        highlighted={!!stop._id && highlightStop === stop._id}
                        editMode={editMode}
                        navFrom={navFromFor(stop)}
                        bounds={dragBounds(stop)}
                      />
                      <TravelConnector stop={stop} pxPerMin={pxPerMin} startHour={effectiveStartHour} />
                    </Box>
                  ));
                })()}

                {/* Empty state */}
                {timedStops.length === 0 && (
                  <Box sx={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1.5, pointerEvents: 'none',
                  }}>
                    <Typography sx={{
                      fontFamily: D.body, fontSize: '0.88rem', color: D.muted,
                    }}>
                      {isMobile ? 'Tap Add to start planning your day' : 'Click anywhere to add a stop'}
                    </Typography>
                    {isMobile && (
                      <Box sx={{ pointerEvents: 'auto' }}>
                        <Button
                          variant="outlined" size="small"
                          startIcon={<AddIcon />}
                          onClick={() => openDrawer('09:00', 'activity')}
                          sx={{ borderRadius: 2, fontFamily: D.body, fontWeight: 700 }}
                        >
                          Add first stop
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
              </Box>
            </Box>
          </DndContext>
          )}
        </Paper>
      )}

      {/* ── Tap a stop → the full picture ── */}
      <StopDetailSheet
        stop={sheetStop}
        concurrent={sheetStop ? concurrentWith(sheetStop, activeStops) : []}
        isMobile={isMobile}
        linkedFiles={sheetStop ? filesFor(sheetStop) : []}
        reminder={sheetStop ? reminderFor(sheetStop) : null}
        reminderSetting={sheetStop ? reminderSettingFor(sheetStop) : null}
        reminderNotice={sheetStop ? reminderNoticeFor(sheetStop) : null}
        onReminderChange={(s, v) => (typeof v === 'boolean' ? setBookingReminder(s, v) : setStopReminder(s, v))}
        flight={sheetStop ? flightFor(sheetStop) : null}
        navFrom={sheetStop ? navFromFor(sheetStop) : null}
        onClose={() => setSheetKey(null)}
        onSelect={s => setSheetKey(stopKey(s))}
        onSkip={skipStop}
        onEdit={s => {
          setSheetKey(null);
          const t = stopStartMinutes(s);
          openDrawer(t !== null ? formatTime(t) : '09:00', s.type, s);
        }}
        onDelete={async s => {
          // Closes once deleted or queued; a failed delete puts the stop (and this sheet) back
          if (s._id && await deleteStop(s._id)) setSheetKey(k => (k === s._id ? null : k));
        }}
        onOpenLogistics={() => { setSheetKey(null); onSwitchToLogistics?.(); }}
        onFilterType={t => { setSheetKey(null); setTypeFilter([t]); }}
      />

      {/* ── Filter on → a floating way back to everything, wherever you've scrolled ── */}
      {typeFilter.length > 0 && (
        <Button
          variant="contained"
          onClick={() => setTypeFilter([])}
          endIcon={<CloseIcon />}
          sx={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', zIndex: 1100,
            borderRadius: 99, px: 2.25, minHeight: 48, maxWidth: 'calc(100vw - 120px)',
            backgroundColor: D.navy, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            fontFamily: D.body, fontWeight: 700, textTransform: 'none', fontSize: '0.88rem',
            '&:hover': { backgroundColor: D.navy },
          }}
        >
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {typeFilter.map(t => (STOP_CONFIG[t]?.label.replace(/^\S+\s*/, '') || t)).join(', ')} only · Show all
          </Box>
        </Button>
      )}

      {/* ── Free-slot suggestions modal ── */}
      <FreeSuggestionsModal
        open={!!suggestionSlot}
        onClose={() => setSuggestionSlot(null)}
        tripId={tripId}
        slot={suggestionSlot}
        onAdd={s => addStop({ ...s, lateNight: suggestionSlot ? lateAt(suggestionSlot.start) : undefined })}
        onSwitchToDiscover={onSwitchToDiscover}
      />

      {/* ── Add / edit drawer ── */}
      <AddStopDrawer
        open={drawer.open}
        onClose={() => setDrawer(d => ({ ...d, open: false, editStop: undefined }))}
        onAdd={addStop}
        onUpdate={updateStop}
        onDelete={
          drawer.editStop?._id && drawer.editStop.source !== 'logistics'
            ? () => deleteStop(drawer.editStop!._id!)
            : undefined
        }
        defaultTime={drawer.time}
        defaultType={drawer.type}
        editStop={drawer.editStop}
        isMobile={isMobile}
        knownLocations={knownLocations}
        nightDates={nightDates}
        nightDefault={nightDefault}
      />
    </Box>
  );
}