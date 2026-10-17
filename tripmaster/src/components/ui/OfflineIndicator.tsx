'use client';

import { useSyncExternalStore } from 'react';
import { Box } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { isOffline, subscribeConnectivity } from '@/lib/offline/connectivity';

export default function OfflineIndicator() {
  const offline = useSyncExternalStore(subscribeConnectivity, isOffline, () => false);
  if (!offline) return null;
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
      <CloudOffIcon sx={{ fontSize: 16 }} />
      Offline
    </Box>
  );
}
