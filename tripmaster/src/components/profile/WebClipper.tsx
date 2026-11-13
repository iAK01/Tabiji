'use client';

import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import ContentCutIcon  from '@mui/icons-material/ContentCut';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { DateTime }    from 'luxon';
import { readSaved, reportSaveFailure } from '@/lib/offline/saveErrors';

const GREEN = '#55702C';
const TERRA = '#C4714A';
const MUTED = 'rgba(29,38,66,0.45)';

interface Clip { id: string; title: string; status: string; summary: string; error: string | null; count: number; createdAt: string }
interface State { key: { last4: string; createdAt: string } | null; clips: Clip[] }

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, mt: 2, mb: 0.75 }}>
      {children}
    </Typography>
  );
}

function clipStatus(c: Clip): { label: string; color: string } {
  if (c.status === 'processing') return { label: 'Saving', color: MUTED };
  if (c.status === 'failed')     return { label: 'Failed', color: TERRA };
  if (!c.count)                  return { label: 'Nothing saved', color: MUTED };
  return { label: `${c.count} saved`, color: GREEN };
}

// The Safari clipper's connection: a key made here, pasted into the clipper once.
export default function WebClipper() {
  const [state,   setState]   = useState<State | null>(null);
  const [failed,  setFailed]  = useState(false);
  const [code,    setCode]    = useState<string | null>(null);   // shown once, right after making it
  const [busy,    setBusy]    = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [confirm, setConfirm] = useState<'new' | 'off' | null>(null);

  useEffect(() => {
    fetch('/api/user/clip-key').then(r => readSaved<State>(r)).then(setState).catch(() => setFailed(true));
  }, []);

  async function makeKey() {
    setBusy(true);
    setConfirm(null);
    try {
      const data = await readSaved<{ key: string; last4: string }>(await fetch('/api/user/clip-key', { method: 'POST' }));
      setCode(`${window.location.origin}#${data.key}`);
      setState(s => ({ clips: s?.clips ?? [], key: { last4: data.last4, createdAt: new Date().toISOString() } }));
    } catch (err) {
      reportSaveFailure('a new clipper key', err);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setConfirm(null);
    try {
      await readSaved(await fetch('/api/user/clip-key', { method: 'DELETE' }));
      setCode(null);
      setState(s => ({ clips: s?.clips ?? [], key: null }));
    } catch (err) {
      reportSaveFailure('turning the clipper off', err);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* it's on screen to copy by hand */ }
  }

  return (
    <Paper id="web-clipper" elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, scrollMarginTop: 80 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <ContentCutIcon sx={{ fontSize: 18, color: GREEN }} />
        <Typography variant="body1" fontWeight={800}>Clip from the web</Typography>
      </Box>

      {failed && <Typography sx={{ fontSize: '0.85rem', color: TERRA, mt: 1.5 }}>Couldn’t load this — reopen the page to try again.</Typography>}

      {state && (
        <>
          <Label>Safari clipper</Label>
          {code ? (
            <Box>
              <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>Paste this into the clipper. It’s shown once.</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 1.5, backgroundColor: 'rgba(29,38,66,0.05)' }}>
                <Typography sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem', wordBreak: 'break-all', flex: 1 }}>{code}</Typography>
                <Tooltip title={copied ? 'Copied' : 'Copy'}>
                  <IconButton onClick={copy} aria-label="Copy" sx={{ width: 44, height: 44 }}><ContentCopyIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Box>
          ) : state.key ? (
            <Typography sx={{ fontSize: '0.88rem' }}>
              Connected · key ending {state.key.last4} · made {DateTime.fromISO(state.key.createdAt).toFormat('d LLL yyyy')}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.88rem', color: MUTED }}>Not connected.</Typography>
          )}

          {confirm ? (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, border: `1px solid ${TERRA}` }}>
              <Typography sx={{ fontSize: '0.85rem', mb: 1 }}>
                {confirm === 'new'
                  ? 'The clipper stops working until you paste the new key into it.'
                  : 'The clipper stops working. What you’ve saved stays.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={() => setConfirm(null)} sx={{ minHeight: 44 }}>Cancel</Button>
                <Button onClick={confirm === 'new' ? makeKey : turnOff} disabled={busy} sx={{ minHeight: 44, color: TERRA, fontWeight: 700 }}>
                  {confirm === 'new' ? 'Make a new key' : 'Turn off'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" disabled={busy} onClick={() => (state.key ? setConfirm('new') : makeKey())} sx={{ minHeight: 44 }}>
                {state.key ? 'New key' : 'Connect the clipper'}
              </Button>
              {state.key && (
                <Button disabled={busy} onClick={() => setConfirm('off')} sx={{ minHeight: 44, color: MUTED }}>Turn off</Button>
              )}
            </Box>
          )}

          {state.clips.length > 0 && (
            <>
              <Label>Recent clips</Label>
              {state.clips.map(c => {
                const s = clipStatus(c);
                return (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600 }}>{c.title}</Typography>
                      <Typography noWrap sx={{ fontSize: '0.75rem', color: MUTED }}>
                        {[DateTime.fromISO(c.createdAt).toFormat('d LLL, HH:mm'), c.status === 'failed' ? c.error : c.summary].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.label}</Typography>
                  </Box>
                );
              })}
            </>
          )}
        </>
      )}
    </Paper>
  );
}
