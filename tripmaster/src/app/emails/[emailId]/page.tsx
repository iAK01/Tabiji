'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Paper, TextField, Toolbar, Typography,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import MailOutlineIcon     from '@mui/icons-material/MailOutline';
import EventIcon           from '@mui/icons-material/Event';
import PlaceIcon           from '@mui/icons-material/Place';
import HotelIcon           from '@mui/icons-material/Hotel';
import FlightIcon          from '@mui/icons-material/Flight';
import DescriptionIcon     from '@mui/icons-material/Description';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import LinkIcon            from '@mui/icons-material/Link';
import QrCode2Icon         from '@mui/icons-material/QrCode2';
import { DateTime }        from 'luxon';
import { readSaved, reportSaveFailure } from '@/lib/offline/saveErrors';

const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.55)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

interface Change { field: string; label: string; from: any; to: any }
interface Item {
  n: number;
  action: string;
  kind: 'stop' | 'venue' | 'accommodation' | 'transport' | 'document';
  tripId: string | null;
  tripName: string | null;
  href: string | null;
  title: string;
  why: string;
  details: Record<string, any> | null;
  target: { kind: string; label: string } | null;
  created: boolean;
  state: 'applied' | 'pending' | 'dismissed' | 'undone';
  filled: Change[];
  changes: Change[];
  accepted: Change[];
  fileIds: string[];
  note?: string;
  links: { label: string; url: string }[];
  files: { name: string; url: string; mimeType: string; hasBarcode: boolean }[];
}
interface Email {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  status: 'processing' | 'done' | 'failed' | 'rejected';
  error: string | null;
  summary: string;
  items: Item[];
  trips: { id: string; name: string; startDate: string; endDate: string }[];
}

const KIND_ICON = { stop: EventIcon, venue: PlaceIcon, accommodation: HotelIcon, transport: FlightIcon, document: DescriptionIcon };

function when(item: Item): string {
  const d = item.details;
  if (!d) return '';
  const fmt = (iso: string, withTime = true) => {
    const t = DateTime.fromISO(iso);
    return t.isValid ? t.toFormat(withTime && iso.includes('T') ? 'ccc d LLL, HH:mm' : 'ccc d LLL') : '';
  };
  if (item.kind === 'accommodation') return [d.checkIn && fmt(d.checkIn, false), d.checkOut && fmt(d.checkOut, false)].filter(Boolean).join(' → ');
  if (item.kind === 'transport') return d.departureTime ? fmt(d.departureTime) : '';
  if (d.scheduledStart) return fmt(d.scheduledStart);
  if (d.date) return [fmt(d.date, false), d.time].filter(Boolean).join(', ');
  return '';
}

function shown(v: any): string {
  if (v == null || v === '') return 'empty';
  if (typeof v === 'object') return v.lat != null ? 'pinned' : JSON.stringify(v);
  const s = String(v);
  const t = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? DateTime.fromISO(s) : null;
  return t?.isValid ? t.toFormat('ccc d LLL, HH:mm') : s;
}

function stateChip(item: Item) {
  if (item.state === 'applied' && item.changes.length) return <Chip size="small" label="Check" sx={{ bgcolor: D.terra, color: 'white', fontWeight: 700 }} />;
  if (item.state === 'applied') return <Chip size="small" label={item.created ? 'Added' : 'Filed'} sx={{ bgcolor: D.green, color: 'white', fontWeight: 700 }} />;
  if (item.state === 'pending') return <Chip size="small" label="Needs you" sx={{ bgcolor: D.terra, color: 'white', fontWeight: 700 }} />;
  if (item.state === 'undone') return <Chip size="small" label="Undone" variant="outlined" />;
  return null;
}

/** What Undo takes away, said before it happens. */
function undoText(item: Item): string {
  const files = item.fileIds.length
    ? ` and the ${item.fileIds.length === 1 ? 'file or link' : `${item.fileIds.length} files and links`} this email added`
    : '';
  if (item.created) {
    return `Removes “${item.target?.label ?? item.title}” from ${item.tripName ?? 'the trip'}${files}. Anything you've added to it since — your notes, a new time, “Not going” — goes with it.`;
  }
  const fields = [...item.filled, ...item.accepted].map(c => c.label);
  const what = [fields.length ? `what this email filled in (${[...new Set(fields)].join(', ')})` : '', files ? files.replace(/^ and /, '') : '']
    .filter(Boolean).join(' and ');
  return `Takes back ${what || 'what this email did'}. Anything you've changed since stays as it is.`;
}

export default function EmailPage({ params }: { params: Promise<{ emailId: string }> }) {
  const { emailId } = use(params);
  const router = useRouter();
  const [email, setEmail]     = useState<Email | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy]       = useState<number | 'retry' | null>(null);
  const [pick, setPick]       = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/emails/${emailId}`);
      const data = await readSaved<{ email: Email }>(res);
      setEmail(data.email);
      setError(null);
    } catch (err: any) {
      setError(err?.status === 404 ? 'This email isn’t on your account.' : 'Couldn’t load this email.');
    }
  }, [emailId]);

  useEffect(() => { load(); }, [load]);

  // Still being read — look again shortly.
  useEffect(() => {
    if (email?.status !== 'processing') return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [email, load]);

  async function act(item: Item | null, action: string, extra: Record<string, unknown> = {}) {
    setBusy(item ? item.n : 'retry');
    setMessage(null);
    try {
      const res = await fetch(`/api/user/emails/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, item: item?.n, ...extra }),
      });
      const data = await readSaved<{ email: Email; message?: string | null }>(res);
      setEmail(data.email);
      if (data.message) setMessage(data.message);
    } catch (err) {
      reportSaveFailure(item ? `“${item.title}”` : 'that', err);
    } finally {
      setBusy(null);
    }
  }

  const items      = email?.items ?? [];
  const visible    = items.filter(i => i.state !== 'dismissed');
  const nothingFor = items.filter(i => i.state === 'dismissed' && i.action === 'ignore');

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: D.bg }}>
      <AppBar position="static" sx={{ backgroundColor: D.navy, boxShadow: 'none' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => (window.history.length > 1 ? router.back() : router.push('/dashboard'))} sx={{ mr: 1 }} aria-label="Back">
            <ArrowBackIcon />
          </IconButton>
          <MailOutlineIcon sx={{ mr: 1.5, fontSize: 20 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: 'white', flexGrow: 1 }}>Forwarded email</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3, px: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={load} sx={{ minHeight: 44 }}>Try again</Button>}>
            {error}
          </Alert>
        )}
        {!email && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}

        {email && (
          <>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, lineHeight: 1.3 }}>
              {email.subject || '(no subject)'}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body, mt: 0.5 }}>
              {[email.from, email.receivedAt && DateTime.fromISO(email.receivedAt).toFormat('d LLL, HH:mm')].filter(Boolean).join(' · ')}
            </Typography>
            {email.summary && (
              <Typography sx={{ fontSize: '0.9rem', color: D.navy, fontFamily: D.body, mt: 1.5 }}>{email.summary}</Typography>
            )}

            {email.status === 'processing' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3 }}>
                <CircularProgress size={20} />
                <Typography sx={{ fontFamily: D.body, color: D.muted }}>Reading it and filing it into your trips…</Typography>
              </Box>
            )}
            {email.status === 'rejected' && (
              <Alert severity="warning" sx={{ mt: 3 }}>Not accepted: {email.error}</Alert>
            )}
            {email.status === 'failed' && (
              <Alert
                severity="error" sx={{ mt: 3 }}
                action={<Button color="inherit" disabled={busy !== null} onClick={() => act(null, 'retry')} sx={{ minHeight: 44 }}>Try again</Button>}
              >
                Couldn’t read it{email.error ? `: ${email.error}` : ''}
              </Alert>
            )}
            {message && <Alert severity="info" sx={{ mt: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
              {visible.map(item => {
                const Icon = KIND_ICON[item.kind] ?? DescriptionIcon;
                const working = busy === item.n;
                const date = when(item);
                return (
                  <Paper key={item.n} elevation={0} sx={{ p: 2, border: `1px solid ${D.rule}`, borderRadius: 2, backgroundColor: D.paper }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                      <Icon sx={{ fontSize: 20, color: D.green, mt: 0.25 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontFamily: D.body, fontWeight: 800, color: D.navy, lineHeight: 1.3 }}>{item.title}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body }}>
                          {[item.tripName ?? (item.state === 'pending' && !item.tripId ? 'No trip yet' : null), date].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      {stateChip(item)}
                    </Box>

                    {item.why && <Typography sx={{ fontSize: '0.88rem', fontFamily: D.body, mt: 1.25 }}>{item.why}</Typography>}
                    {item.state === 'pending' && item.note && (
                      <Typography sx={{ fontSize: '0.85rem', fontFamily: D.body, color: D.terra, mt: 0.75, fontWeight: 600 }}>{item.note}</Typography>
                    )}
                    {item.state === 'applied' && !item.created && item.filled.length > 0 && (
                      <Typography sx={{ fontSize: '0.82rem', fontFamily: D.body, color: D.muted, mt: 0.75 }}>
                        Filled in on “{item.target?.label}”: {[...new Set(item.filled.map(c => c.label))].join(', ')}
                      </Typography>
                    )}

                    {item.state === 'applied' && item.changes.length > 0 && (
                      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, border: `1px solid ${D.terra}` }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: D.body, color: D.terra, mb: 1 }}>
                          Different from what’s saved
                        </Typography>
                        {item.changes.filter(c => c.field !== 'coordinates').map(c => (
                          <Box key={c.field} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: 1, minWidth: 180 }}>
                              <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body }}>{c.label}</Typography>
                              <Typography sx={{ fontSize: '0.85rem', fontFamily: D.body, whiteSpace: 'pre-line' }}>
                                Saved: {shown(c.from)}{'\n'}Email: {c.field === 'notes' ? shown(String(c.to).slice(String(c.from ?? '').length).trim()) : shown(c.to)}
                              </Typography>
                            </Box>
                            <Button
                              size="small" variant="outlined" disabled={working}
                              onClick={() => act(item, 'accept', { fields: [c.field] })}
                              sx={{ minHeight: 44, borderColor: D.navy, color: D.navy }}
                            >
                              {c.field === 'notes' ? 'Add it' : 'Use new'}
                            </Button>
                          </Box>
                        ))}
                        <Button size="small" disabled={working} onClick={() => act(item, 'dismiss')} sx={{ mt: 0.5, minHeight: 44, color: D.muted }}>
                          Keep what’s saved
                        </Button>
                      </Box>
                    )}

                    {(item.files.length > 0 || item.links.length > 0) && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                        {item.files.map(f => (
                          <Chip
                            key={f.url} component="a" href={f.url} target="_blank" rel="noopener" clickable
                            icon={f.hasBarcode ? <QrCode2Icon /> : <AttachFileIcon />}
                            label={f.hasBarcode ? `${f.name} · barcode` : f.name}
                            sx={{ maxWidth: '100%', height: 36 }}
                          />
                        ))}
                        {item.links.map(l => (
                          <Chip
                            key={l.url} component="a" href={l.url} target="_blank" rel="noopener" clickable
                            icon={<LinkIcon />} label={l.label} sx={{ maxWidth: '100%', height: 36 }}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Actions */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.75, alignItems: 'center' }}>
                      {item.state === 'applied' && item.href && (
                        <Button variant="contained" disableElevation onClick={() => router.push(item.href!)} sx={{ minHeight: 44, bgcolor: D.navy }}>
                          Open in trip
                        </Button>
                      )}
                      {item.state === 'applied' && (
                        <Button disabled={working} onClick={() => setConfirm(item)} sx={{ minHeight: 44, color: D.terra }}>Undo</Button>
                      )}

                      {item.state === 'pending' && item.action === 'cancel' && item.target && (
                        <Button variant="contained" disableElevation disabled={working} onClick={() => act(item, 'cancel')} sx={{ minHeight: 44, bgcolor: D.terra }}>
                          Mark cancelled
                        </Button>
                      )}

                      {(item.state === 'pending' || item.state === 'undone') && item.action !== 'cancel' && !item.tripId && (
                        <TextField
                          select size="small" label="Trip" value={pick[item.n] ?? ''}
                          onChange={e => setPick(p => ({ ...p, [item.n]: e.target.value }))}
                          sx={{ minWidth: 180, flex: 1 }}
                        >
                          {(email.trips ?? []).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                        </TextField>
                      )}
                      {(item.state === 'pending' || item.state === 'undone') && item.action !== 'cancel' && (
                        <Button
                          variant="contained" disableElevation
                          disabled={working || (!item.tripId && !pick[item.n])}
                          onClick={() => act(item, 'add', item.tripId ? {} : { tripId: pick[item.n] })}
                          sx={{ minHeight: 44, bgcolor: D.green }}
                        >
                          {item.state === 'undone' ? 'Add again' : item.tripId ? 'Add' : 'Add to trip'}
                        </Button>
                      )}
                      {item.state === 'pending' && (
                        <Button disabled={working} onClick={() => act(item, 'dismiss')} sx={{ minHeight: 44, color: D.muted }}>Dismiss</Button>
                      )}
                      {working && <CircularProgress size={18} />}
                    </Box>
                  </Paper>
                );
              })}
            </Box>

            {email.status === 'done' && nothingFor.length > 0 && (
              <Typography sx={{ fontSize: '0.82rem', color: D.muted, fontFamily: D.body, mt: 2.5 }}>
                Nothing for your trips: {nothingFor.map(i => i.title).join(', ')}
              </Typography>
            )}
          </>
        )}
      </Container>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle sx={{ fontFamily: D.body, fontWeight: 800 }}>Undo “{confirm?.title}”?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem' }}>{confirm && undoText(confirm)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ minHeight: 44 }}>Keep it</Button>
          <Button
            onClick={() => { const it = confirm; setConfirm(null); if (it) act(it, 'undo'); }}
            sx={{ minHeight: 44, color: D.terra, fontWeight: 700 }}
          >
            Undo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
