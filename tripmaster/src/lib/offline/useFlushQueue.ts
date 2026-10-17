'use client';

import { useEffect } from 'react';
import { flushQueue } from './db';
import { isOffline, subscribeConnectivity } from './connectivity';
import { refreshSavedData } from './warm';

// Replays any queued offline actions on mount (if already online) and whenever a working
// connection comes back — including recovering from wifi that was connected but not
// getting through, which never fires the browser's 'online' event. Shared by the dashboard
// and the trip detail page so there's one reconnect-flush behaviour, not two.
export function useFlushQueueOnReconnect() {
  useEffect(() => {
    const flush = () => {
      flushQueue()
        .then(({ synced }) => synced.forEach(a => refreshSavedData(a.tripId)))
        .catch(() => {});
    };
    flush();
    let wasOffline = isOffline();
    return subscribeConnectivity(() => {
      const offline = isOffline();
      if (wasOffline && !offline) flush();
      wasOffline = offline;
    });
  }, []);
}
