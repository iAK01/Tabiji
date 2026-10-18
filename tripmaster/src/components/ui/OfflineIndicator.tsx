'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Box } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { isOffline, subscribeConnectivity } from '@/lib/offline/connectivity';
import { getQueueCount, subscribeQueue } from '@/lib/offline/db';

// Offline state plus how many changes are still waiting to sync — a queued change is
// never invisible, online or off.
export default function OfflineIndicator() {
  const offline = useSyncExternalStore(subscribeConnectivity, isOffline, () => false);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    const refresh = () => { getQueueCount().then(setWaiting).catch(() => {}); };
    refresh();
    const unsubscribe = subscribeQueue(refresh);
    // Another tab may have flushed or queued; recheck when this one comes back.
    document.addEventListener('visibilitychange', refresh);
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  if (!offline && !waiting) return null;
  const changes = `${waiting} change${waiting === 1 ? '' : 's'}`;
  const label   = offline
    ? (waiting ? `Offline · ${changes} waiting to sync` : 'Offline')
    : `${changes} waiting to sync`;

  return (
    <Box role="status" sx={{
      position: 'fixed', zIndex: t => t.zIndex.snackbar,
      left:   'max(12px, env(safe-area-inset-left))',
      bottom: 'max(12px, env(safe-area-inset-bottom))',
      display: 'flex', alignItems: 'center', gap: 0.75,
      px: 1.5, py: 0.75, borderRadius: 999,
      backgroundColor: '#2C3E50', color: '#FDFAF5',
      fontFamily: '"Archivo", "Inter", sans-serif', fontSize: '0.78rem', fontWeight: 600,
      boxShadow: '0 2px 10px rgba(44,62,80,0.25)', pointerEvents: 'none',
    }}>
      {offline ? <CloudOffIcon sx={{ fontSize: 16 }} /> : <CloudSyncIcon sx={{ fontSize: 16 }} />}
      {label}
    </Box>
  );
}
