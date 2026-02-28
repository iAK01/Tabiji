'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, alpha,
} from '@mui/material';
import NotificationsIcon        from '@mui/icons-material/Notifications';
import NotificationsOffIcon     from '@mui/icons-material/NotificationsOff';
import NotificationsActiveIcon  from '@mui/icons-material/NotificationsActive';
import SendIcon                 from '@mui/icons-material/Send';

type PermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const bytes   = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer as ArrayBuffer;
}

export default function PushNotificationSetup() {
  const [permission,   setPermission]   = useState<PermissionState>('prompt');
  const [subscribed,   setSubscribed]   = useState(false);
  const [enabling,     setEnabling]     = useState(false);
  const [sending,      setSending]      = useState(false);
  const [testResult,   setTestResult]   = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // ── Check current state on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PermissionState);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub);
      });
    });
  }, []);

  // ── Enable notifications ──────────────────────────────────────────────────
  const handleEnable = async () => {
    setEnabling(true);
    setError(null);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== 'granted') {
        setError('Permission denied — you\'ll need to enable notifications in your browser settings.');
        setEnabling(false);
        return;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      // Save subscription to server
      const res = await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) throw new Error('Failed to save subscription');

      setSubscribed(true);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setEnabling(false);
    }
  };

  // ── Disable notifications ─────────────────────────────────────────────────
  const handleDisable = async () => {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
      setPermission('prompt');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    }
  };

  // ── Send test notification ────────────────────────────────────────────────
  const handleTest = async () => {
    setSending(true);
    setTestResult(null);
    setError(null);

    try {
      const res  = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to send');
      } else {
        setTestResult(`Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''}${data.failed ? ` · ${data.failed} failed` : ''}`);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setSending(false);
    }
  };

  // ── Unsupported ───────────────────────────────────────────────────────────
  if (permission === 'unsupported') {
    return (
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <NotificationsOffIcon sx={{ color: 'text.disabled' }} />
          <Box>
            <Typography variant="body2" fontWeight={700}>Push notifications not supported</Typography>
            <Typography variant="caption" color="text.secondary">
              Use Chrome or Safari on a supported device. On iOS, add this app to your home screen first.
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: subscribed ? '#55702C' : 'divider', borderRadius: 2, backgroundColor: subscribed ? alpha('#55702C', 0.03) : 'background.paper' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, backgroundColor: alpha(subscribed ? '#55702C' : '#6b7280', 0.1),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {subscribed
            ? <NotificationsActiveIcon sx={{ color: '#55702C' }} />
            : <NotificationsIcon sx={{ color: 'text.disabled' }} />}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" fontWeight={800}>Push Notifications</Typography>
            {subscribed && (
              <Chip label="Active" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha('#55702C', 0.12), color: '#55702C' }} />
            )}
            {permission === 'denied' && (
              <Chip label="Blocked" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha('#dc2626', 0.1), color: '#dc2626' }} />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
            {subscribed
              ? 'You\'ll be notified before flights, check-ins, and key itinerary events.'
              : 'Get notified before flights, check-ins, and key itinerary events.'}
          </Typography>
        </Box>
      </Box>

      {/* ── Actions ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {!subscribed && permission !== 'denied' && (
          <Button
            variant="contained"
            onClick={handleEnable}
            disabled={enabling}
            startIcon={enabling ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <NotificationsActiveIcon />}
            sx={{ fontWeight: 700, backgroundColor: '#55702C', '&:hover': { backgroundColor: '#455f24' } }}
          >
            {enabling ? 'Enabling…' : 'Enable notifications'}
          </Button>
        )}

        {subscribed && (
          <>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={sending}
              startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{ fontWeight: 700, borderColor: '#55702C', color: '#55702C',
                '&:hover': { borderColor: '#455f24', backgroundColor: alpha('#55702C', 0.05) } }}
            >
              {sending ? 'Sending…' : 'Send test notification'}
            </Button>
            <Button
              variant="text"
              onClick={handleDisable}
              startIcon={<NotificationsOffIcon />}
              color="error"
              sx={{ fontWeight: 700 }}
            >
              Disable
            </Button>
          </>
        )}

        {permission === 'denied' && (
          <Typography variant="body2" color="error.main" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
            Notifications are blocked. Go to your browser settings → Site settings → Notifications and allow this site.
          </Typography>
        )}
      </Box>

      {/* ── Feedback ── */}
      {testResult && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#55702C', fontWeight: 700 }}>
          ✓ {testResult}
        </Typography>
      )}
      {error && (
        <Typography variant="caption" color="error.main" fontWeight={600} sx={{ display: 'block', mt: 1.5 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
}