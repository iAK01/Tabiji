'use client';

// Notification settings and the inbox, shared across components (the bell, its
// drawer, the profile settings card) through small module-level stores. Writes
// go through sendOrQueue so they work offline and replay later.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { patchSavedData, sendOrQueue, type SavedDataUpdates } from '@/lib/offline/writes';
import { assertSaved, reportSaveFailure } from '@/lib/offline/saveErrors';
import { resolvePrefs, type NotificationPrefs } from '@/lib/push/prefs';
import { setAppBadge } from '@/lib/push/client';

const PREFS_URL = '/api/user/notification-preferences';
const INBOX_URL = '/api/user/notifications';

// ── Tiny store ──────────────────────────────────────────────────────────────

function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => { value = next; listeners.forEach(l => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

// ── Settings ────────────────────────────────────────────────────────────────

const prefsStore = store<NotificationPrefs | null>(null);
let prefsLoading: Promise<void> | null = null;

function loadPrefs(): Promise<void> {
  prefsLoading ??= fetch(PREFS_URL)
    .then(res => (res.ok ? res.json() : null))
    .then(data => { if (data?.prefs) prefsStore.set(resolvePrefs(data.prefs)); })
    .catch(() => {})
    .finally(() => { prefsLoading = null; });
  return prefsLoading;
}

export type PrefsPatch = {
  categories?:    Partial<NotificationPrefs['categories']>;
  quietHours?:    Partial<NotificationPrefs['quietHours']>;
  briefingTimes?: Partial<NotificationPrefs['briefingTimes']>;
  mute?:          { tripId: string; muted: boolean };
};

function applyPatch(prefs: NotificationPrefs, patch: PrefsPatch): NotificationPrefs {
  const next = resolvePrefs({
    categories:    { ...prefs.categories,    ...patch.categories },
    quietHours:    { ...prefs.quietHours,    ...patch.quietHours },
    briefingTimes: { ...prefs.briefingTimes, ...patch.briefingTimes },
    mutedTrips:    prefs.mutedTrips,
  });
  if (patch.mute) {
    next.mutedTrips = patch.mute.muted
      ? [...new Set([...next.mutedTrips, patch.mute.tripId])]
      : next.mutedTrips.filter(id => id !== patch.mute!.tripId);
  }
  return next;
}

export function useNotificationPrefs() {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.get, () => null);

  useEffect(() => { if (!prefsStore.get()) loadPrefs(); }, []);

  const update = useCallback(async (patch: PrefsPatch) => {
    const current = prefsStore.get() ?? resolvePrefs(null);
    const next    = applyPatch(current, patch);
    prefsStore.set(next);
    const saved: SavedDataUpdates = { [PREFS_URL]: () => ({ prefs: next }) };
    try {
      const res = await sendOrQueue(
        { type: 'SET_NOTIFICATION_PREFS', payload: patch },
        () => fetch(PREFS_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
        saved,
      );
      if (!res) return;
      assertSaved(res);
      await patchSavedData(saved);                   // keep the offline copy current
    } catch (err) {
      prefsStore.set(current);                       // rejected — put it back
      reportSaveFailure('your notification settings', err);
    }
  }, []);

  return { prefs, update };
}

// ── Inbox ───────────────────────────────────────────────────────────────────

export interface InboxItem {
  id:       string;
  tripId:   string;
  tripName: string | null;
  category: string | null;
  title:    string;
  body:     string;
  url:      string;
  sentAt:   string;
  read:     boolean;
}

const inboxStore = store<{ items: InboxItem[]; unread: number; loaded: boolean }>({ items: [], unread: 0, loaded: false });
let inboxLoading: Promise<void> | null = null;

function loadInbox(): Promise<void> {
  inboxLoading ??= fetch(INBOX_URL)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (!data) return;
      inboxStore.set({ items: data.notifications ?? [], unread: data.unread ?? 0, loaded: true });
      setAppBadge(data.unread ?? 0);
    })
    .catch(() => {})
    .finally(() => { inboxLoading = null; });
  return inboxLoading;
}

export function useNotificationInbox() {
  const inbox = useSyncExternalStore(inboxStore.subscribe, inboxStore.get, inboxStore.get);

  useEffect(() => { loadInbox(); }, []);

  const markRead = useCallback(async () => {
    const { items, unread } = inboxStore.get();
    if (!unread) return;
    const read = items.map(i => ({ ...i, read: true }));
    inboxStore.set({ items: read, unread: 0, loaded: true });
    setAppBadge(0);
    const saved: SavedDataUpdates = {
      [INBOX_URL]: copy => copy && { ...copy, unread: 0, notifications: (copy.notifications ?? []).map((n: any) => ({ ...n, read: true })) },
    };
    const res = await sendOrQueue(
      { type: 'MARK_NOTIFICATIONS_READ' },
      () => fetch(INBOX_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read' }) }),
      saved,
    );
    if (res?.ok) await patchSavedData(saved);
  }, []);

  return { ...inbox, refresh: loadInbox, markRead };
}

/** Go to an in-app link: same page → pushState (instant, offline-safe), else a normal navigation. */
export function openAppUrl(href: string): void {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) { window.open(url.href, '_blank', 'noopener'); return; }
  if (url.pathname === window.location.pathname) window.history.pushState(null, '', url.pathname + url.search);
  else window.location.assign(url.href);
}
