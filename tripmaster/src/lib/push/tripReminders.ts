'use client';

// Trip-wide reminder times, changed from the notification centre: the reminder
// before each stop on a trip, and "start again". The itinerary listens for
// REMINDERS_CHANGED to pick up stops whose own times were cleared.

import { sendOrQueue, type SavedDataUpdates } from '@/lib/offline/writes';
import { readSaved } from '@/lib/offline/saveErrors';
import { hasOwnLead, type TripLead } from '@/lib/push/leads';

export const REMINDERS_CHANGED = 'tabiji:reminders-changed';

export interface TripLeads {
  trip:     TripLead | null;   // this trip's setting; null = your default
  user:     number | null;     // your default; null = by kind of stop
  ownStops: number;            // stops with a time of their own
}

export type TripRemindersChange =
  | { action: 'setTripLead'; leadMins: TripLead | null; replaceStops: boolean }
  | { action: 'reset' };

export interface RemindersChangedDetail {
  tripId:        string;
  days:          any[] | null;   // the server's itinerary when stops changed
  clearOwnLeads: boolean;        // queued offline: clear stops' own times locally
}

export async function fetchTripLeads(tripId: string): Promise<TripLeads | null> {
  try {
    const res = await fetch(`/api/trips/${tripId}/reminders`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.leads ?? null;
  } catch {
    return null;
  }
}

function withoutOwnLeads(days: any[]): any[] {
  return days.map(d => ({
    ...d,
    stops: (d.stops ?? []).map((s: any) => {
      if (s.source === 'logistics' || !hasOwnLead(s)) return s;
      const { notificationLeadMins: _own, ...rest } = s;
      return rest;
    }),
  }));
}

/** Sends (or queues) a trip-wide change; throws if the server refuses it. */
export async function changeTripReminders(tripId: string, change: TripRemindersChange): Promise<void> {
  const clearOwnLeads = change.action === 'reset' || change.replaceStops;
  const lead          = change.action === 'reset' ? null : change.leadMins;

  // What reopening the trip offline should show if this is queued
  const saved: SavedDataUpdates = {
    [`/api/trips/${tripId}/reminders`]: copy => copy && {
      ...copy,
      leads: { ...copy.leads, trip: lead, ...(clearOwnLeads ? { ownStops: 0 } : {}) },
      ...(change.action === 'reset' ? { bookingsOff: [], muted: false } : {}),
    },
    ...(clearOwnLeads ? {
      [`/api/trips/${tripId}/itinerary`]: (copy: any) => copy?.days && { ...copy, days: withoutOwnLeads(copy.days) },
    } : {}),
  };

  const res = await sendOrQueue(
    { type: 'SET_TRIP_REMINDERS', tripId, payload: change },
    () => fetch(`/api/trips/${tripId}/reminders`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(change),
    }),
    saved,
  );

  const data   = res ? await readSaved(res) : null;
  const detail: RemindersChangedDetail = { tripId, days: data?.days ?? null, clearOwnLeads: !res && clearOwnLeads };
  window.dispatchEvent(new CustomEvent(REMINDERS_CHANGED, { detail }));
}
