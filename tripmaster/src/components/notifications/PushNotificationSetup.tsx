'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, alpha,
} from '@mui/material';
import NotificationsIcon        from '@mui/icons-material/Notifications';
import NotificationsOffIcon     from '@mui/icons-material/NotificationsOff';
import NotificationsActiveIcon  from '@mui/icons-material/NotificationsActive';
import SendIcon                 from '@mui/icons-material/Send';
import RefreshIcon              from '@mui/icons-material/Refresh';
import {
  pushSupported, pushRegistration, syncSubscription, unsubscribeDevice,
} from '@/lib/push/client';

type Status = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';
type Busy   = null | 'enable' | 'test' | 'resubscribe' | 'disable';

export default function PushNotificationSetup() {
  const [status,  setStatus]  = useState<Status>('checking');
  const [devices, setDevices] = useState<number | null>(null);
  const [busy,    setBusy]    = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Check current state on mount ─────────────────────────────────────────
  // Asks the browser, then re-sends any subscription to the server — so "Active"
  // means the server has this device too, and one it had lost is restored.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) { setStatus('unsupported'); return; }
      if (Notification.permission === 'denied') { setStatus('blocked'); return; }

      const reg = await pushRegistration();
      if (cancelled) return;
      regRef.current = reg;
      if (!reg || Notification.permission !== 'granted' || !(await reg.pushManager.getSubscription())) {
        if (!cancelled) setStatus('off');
        return;
      }

      try {
        const n = await syncSubscription(reg);
        if (cancelled) return;
        setDevices(n);
        setStatus(n === null ? 'off' : 'on');
      } catch (err: any) {
        if (cancelled) return;
        setStatus('on');
        setError(err?.message ?? 'Couldn\'t confirm with the server');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const start = (what: Busy) => { setBusy(what); setMessage(null); setError(null); };

  const registration = async () => {
    const reg = regRef.current ?? await pushRegistration();
    if (!reg) throw new Error('The app hasn\'t finished installing — reload and try again');
    regRef.current = reg;
    return reg;
  };

  // ── Enable notifications ──────────────────────────────────────────────────
  const handleEnable = async () => {
    start('enable');
    try {
      const result = await Notification.requestPermission();
      if (result === 'denied') { setStatus('blocked'); return; }
      if (result !== 'granted') { setError('Permission wasn\'t granted.'); return; }

      setDevices(await syncSubscription(await registration(), { create: true }));
      setStatus('on');
      setMessage('This device is subscribed.');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  // ── Disable notifications ─────────────────────────────────────────────────
  const handleDisable = async () => {
    start('disable');
    try {
      await unsubscribeDevice(await registration());
      setStatus('off');
      setDevices(null);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  // ── Send test notification ────────────────────────────────────────────────
  const handleTest = async () => {
    start('test');
    try {
      const res  = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to send');
      } else {
        setMessage(`Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''}${data.failed ? ` · ${data.failed} failed` : ''}`);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  // ── Re-subscribe this device ─────────────────────────────────────────────
  // Swaps this device's subscription for a brand-new one — for when the test
  // doesn't arrive even though the device shows as subscribed.
  const handleResubscribe = async () => {
    start('resubscribe');
    try {
      setDevices(await syncSubscription(await registration(), { fresh: true }));
      setStatus('on');
      setMessage('Re-subscribed — this device is subscribed.');
    } catch (err: any) {
      // The old subscription may already be gone — show what's actually true.
      const still = await regRef.current?.pushManager.getSubscription().catch(() => null);
      setStatus(still ? 'on' : 'off');
      setError(`${err?.message ?? 'Couldn\'t re-subscribe'}${still ? '' : ' — tap Enable notifications'}`);
    } finally {
      setBusy(null);
    }
  };

  // ── Unsupported ───────────────────────────────────────────────────────────
  if (status === 'unsupported') {
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

  const on = status === 'on';

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: on ? '#55702C' : 'divider', borderRadius: 2, backgroundColor: on ? alpha('#55702C', 0.03) : 'background.paper' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, backgroundColor: alpha(on ? '#55702C' : '#6b7280', 0.1),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {on
            ? <NotificationsActiveIcon sx={{ color: '#55702C' }} />
            : <NotificationsIcon sx={{ color: 'text.disabled' }} />}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" fontWeight={800}>Push Notifications</Typography>
            {on && (
              <Chip label="Active" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha('#55702C', 0.12), color: '#55702C' }} />
            )}
            {status === 'blocked' && (
              <Chip label="Blocked" size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha('#dc2626', 0.1), color: '#dc2626' }} />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', display: 'block' }}>
            {status === 'checking'
              ? 'Checking this device…'
              : on
                ? `This device is subscribed${devices ? ` · ${devices} device${devices !== 1 ? 's' : ''} registered` : ''}`
                : 'Get notified before flights, check-ins, and key itinerary events.'}
          </Typography>
        </Box>
      </Box>

      {/* ── Actions ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {status === 'checking' && <CircularProgress size={20} sx={{ color: '#55702C' }} />}

        {status === 'off' && (
          <Button
            variant="contained"
            onClick={handleEnable}
            disabled={busy !== null}
            startIcon={busy === 'enable' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <NotificationsActiveIcon />}
            sx={{ fontWeight: 700, backgroundColor: '#55702C', '&:hover': { backgroundColor: '#455f24' } }}
          >
            {busy === 'enable' ? 'Enabling…' : 'Enable notifications'}
          </Button>
        )}

        {on && (
          <>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={busy !== null}
              startIcon={busy === 'test' ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{ fontWeight: 700, borderColor: '#55702C', color: '#55702C',
                '&:hover': { borderColor: '#455f24', backgroundColor: alpha('#55702C', 0.05) } }}
            >
              {busy === 'test' ? 'Sending…' : 'Send test notification'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleResubscribe}
              disabled={busy !== null}
              startIcon={busy === 'resubscribe' ? <CircularProgress size={16} /> : <RefreshIcon />}
              sx={{ fontWeight: 700, borderColor: 'divider', color: 'text.secondary',
                '&:hover': { backgroundColor: alpha('#000', 0.04) } }}
            >
              {busy === 'resubscribe' ? 'Re-subscribing…' : 'Re-subscribe this device'}
            </Button>
            <Button
              variant="text"
              onClick={handleDisable}
              disabled={busy !== null}
              startIcon={<NotificationsOffIcon />}
              color="error"
              sx={{ fontWeight: 700 }}
            >
              Disable
            </Button>
          </>
        )}

        {status === 'blocked' && (
          <Typography variant="body2" color="error.main" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
            Notifications are blocked. Go to your browser settings → Site settings → Notifications and allow this site.
          </Typography>
        )}
      </Box>

      {/* ── Feedback ── */}
      {message && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#55702C', fontWeight: 700 }}>
          ✓ {message}
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
