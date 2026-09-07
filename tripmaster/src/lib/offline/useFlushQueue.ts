'use client';

import { useEffect } from 'react';
import { flushQueue } from './db';

// Replays any queued offline actions on mount (if already online) and whenever the
// browser regains connectivity. Shared by the dashboard and the trip detail page so
// there's one reconnect-flush behaviour, not two divergent copies of it.
export function useFlushQueueOnReconnect() {
  useEffect(() => {
    flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, []);
}
