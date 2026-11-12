'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Chip, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import ContentCopyIcon    from '@mui/icons-material/ContentCopy';
import CloseIcon          from '@mui/icons-material/Close';
import { DateTime }       from 'luxon';
import { readSaved, reportSaveFailure } from '@/lib/offline/saveErrors';

const GREEN = '#55702C';
const TERRA = '#C4714A';
const MUTED = 'rgba(29,38,66,0.45)';

interface Recent { id: string; subject: string; status: string; summary: string; createdAt: string; toCheck: number }
interface Forwarding { address: string | null; signInEmail: string; forwardFrom: string[]; emails: Recent[] }

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, mt: 2, mb: 0.75 }}>
      {children}
    </Typography>
  );
}

function statusOf(e: Recent): { label: string; color: string } | null {
  if (e.status === 'processing') return { label: 'Reading', color: MUTED };
  if (e.status === 'failed')     return { label: 'Failed', color: TERRA };
  if (e.status === 'rejected')   return { label: 'Not accepted', color: MUTED };
  if (e.toCheck)                 return { label: `${e.toCheck} to check`, color: TERRA };
  return null;
}

export default function EmailForwarding() {
  const [data, setData]       = useState<Forwarding | null>(null);
  const [failed, setFailed]   = useState(false);
  const [draft, setDraft]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user/forwarding')
      .then(r => readSaved<Forwarding>(r))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  async function save(list: string[], typed = '') {
    if (!data) return;
    setSaving(true);
    setProblem(null);
    try {
      const res = await fetch('/api/user/forwarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forwardFrom: list }),
      });
      if (res.status === 400 || res.status === 409) {
        // Kept in the box to fix.
        setProblem((await res.json().catch(() => null))?.error ?? 'Couldn’t save that address');
        setDraft(typed);
        return;
      }
      const saved = await readSaved<{ forwardFrom: string[] }>(res);
      setData({ ...data, forwardFrom: saved.forwardFrom });
      setDraft('');
    } catch (err) {
      setDraft(typed);
      reportSaveFailure('your forwarding addresses', err);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!data?.address) return;
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* the address is on screen to copy by hand */ }
  }

  return (
    <Paper id="email-forwarding" elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, scrollMarginTop: 80 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <ForwardToInboxIcon sx={{ fontSize: 18, color: GREEN }} />
        <Typography variant="body1" fontWeight={800}>Forward emails to your trips</Typography>
      </Box>

      {failed && <Typography sx={{ fontSize: '0.85rem', color: TERRA, mt: 1.5 }}>Couldn’t load this — reopen the page to try again.</Typography>}

      {data && (
        <>
          <Label>Forward to</Label>
          {data.address ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, wordBreak: 'break-all', flex: 1 }}>{data.address}</Typography>
              <Tooltip title={copied ? 'Copied' : 'Copy'}>
                <IconButton onClick={copy} sx={{ width: 44, height: 44 }} aria-label="Copy address"><ContentCopyIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Typography sx={{ fontSize: '0.85rem', color: MUTED }}>Not set up on this server yet.</Typography>
          )}

          <Label>Accepted from</Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip label={data.signInEmail} sx={{ height: 36 }} />
            {data.forwardFrom.map(a => (
              <Chip
                key={a} label={a} sx={{ height: 36 }} disabled={saving}
                onDelete={() => save(data.forwardFrom.filter(x => x !== a))}
                deleteIcon={<CloseIcon aria-label={`Remove ${a}`} />}
              />
            ))}
          </Box>
          <Box
            component="form"
            onSubmit={e => { e.preventDefault(); const v = draft.trim(); if (v) save([...data.forwardFrom, v], v); }}
            sx={{ display: 'flex', gap: 1, mt: 1.25 }}
          >
            <TextField
              size="small" type="email" placeholder="Another address you forward from"
              value={draft} onChange={e => { setDraft(e.target.value); setProblem(null); }}
              error={!!problem} helperText={problem ?? undefined}
              sx={{ flex: 1 }} inputProps={{ autoCapitalize: 'none', autoCorrect: 'off' }}
            />
            <Button type="submit" variant="outlined" disabled={saving || !draft.trim()} sx={{ minHeight: 40, alignSelf: 'flex-start' }}>Add</Button>
          </Box>

          {data.emails.length > 0 && (
            <>
              <Label>Recent</Label>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {data.emails.map(e => {
                  const s = statusOf(e);
                  return (
                    <Box
                      key={e.id} component={Link} href={`/emails/${e.id}`}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, py: 0.75, borderTop: '1px solid', borderColor: 'divider', color: 'inherit', textDecoration: 'none' }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600 }}>{e.subject || '(no subject)'}</Typography>
                        <Typography noWrap sx={{ fontSize: '0.75rem', color: MUTED }}>
                          {[DateTime.fromISO(e.createdAt).toFormat('d LLL, HH:mm'), e.summary].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      {s && <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.label}</Typography>}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </>
      )}
    </Paper>
  );
}
