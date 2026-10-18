'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Tooltip, IconButton } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon        from '@mui/icons-material/Error';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import type { Intelligence, Phrase } from './Intelligence.types';

// ─── Design tokens ────────────────────────────────────────────────────────────

export const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Highlight type maps ──────────────────────────────────────────────────────

export const TYPE_COLOURS: Record<string, string> = {
  museum:        '#1D2642',
  gallery:       '#2d4a1e',
  landmark:      '#7a4a10',
  neighbourhood: '#3d3035',
  experience:    '#1a3d3d',
  food:          '#5a2020',
  coffee:        '#4a2c0a',
  park:          '#2d5a1e',
  music:         '#2a1a4a',
  other:         '#333',
};

export const TYPE_LABELS: Record<string, string> = {
  museum:        'Museum',
  gallery:       'Gallery',
  landmark:      'Landmark',
  neighbourhood: 'Neighbourhood',
  experience:    'Experience',
  food:          'Food & Drink',
  coffee:        'Coffee',
  park:          'Park',
  music:         'Music',
  other:         'Other',
};

// ─── Map link builder ─────────────────────────────────────────────────────────

export function buildMapUrl(h: {
  name:         string;
  coordinates?: { lat: number; lng: number } | null;
  address?:     string | null;
}): string {
  if (h.coordinates?.lat && h.coordinates?.lng) {
    return `https://maps.apple.com/?ll=${h.coordinates.lat},${h.coordinates.lng}&q=${encodeURIComponent(h.name)}`;
  }
  if (h.address) return `https://maps.apple.com/?address=${encodeURIComponent(h.address)}`;
  return `https://maps.apple.com/?q=${encodeURIComponent(h.name)}`;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

export function StatusPill({
  icon, label, status, value, onClick,
}: {
  icon:     React.ReactNode;
  label:    string;
  status:   'ok' | 'warn' | 'error' | 'info' | 'neutral';
  value?:   string;
  onClick?: () => void;
}) {
  const colors = {
    ok:      { bg: 'rgba(46,125,50,0.07)',  border: 'rgba(46,125,50,0.18)',  icon: '#4caf50',  text: '#2e7d32'  },
    warn:    { bg: 'rgba(196,113,74,0.08)', border: 'rgba(196,113,74,0.28)', icon: '#C4714A',  text: '#C4714A'  },
    error:   { bg: 'rgba(211,47,47,0.07)',  border: 'rgba(211,47,47,0.22)',  icon: '#d32f2f',  text: '#b71c1c'  },
    info:    { bg: 'rgba(107,124,92,0.07)', border: 'rgba(107,124,92,0.2)',  icon: '#6B7C5C',  text: '#6B7C5C'  },
    neutral: { bg: 'rgba(29,38,66,0.03)',   border: 'rgba(29,38,66,0.10)',   icon: '#1D2642',  text: '#1D2642'  },
  };
  const c = colors[status];
  return (
    <Paper elevation={0} onClick={onClick} sx={{
      px: 1.5, py: 1.25, border: '1px solid', borderColor: c.border,
      backgroundColor: c.bg, display: 'flex', flexDirection: 'column', gap: 0.4,
      cursor: onClick ? 'pointer' : 'default', minWidth: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box sx={{ color: c.icon, display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography sx={{
          fontSize: '0.72rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: D.muted, lineHeight: 1, fontFamily: D.body,
        }}>
          {label}
        </Typography>
      </Box>
      {value && (
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: c.text, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Section heading — magazine opener ───────────────────────────────────────

export function SectionHeading({ children, action, id }: {
  children: React.ReactNode;
  action?:  React.ReactNode;
  id?:      string;
}) {
  return (
    <Box id={id} sx={{ mb: 3 }}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between',
        pb: 1, borderBottom: `3px solid ${D.navy}`,
      }}>
        <Typography sx={{
          fontFamily: D.display,
          fontSize: { xs: '1.8rem', sm: '2rem' },
          color: D.navy, lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {children}
        </Typography>
        {action && <Box sx={{ pb: 0.25 }}>{action}</Box>}
      </Box>
    </Box>
  );
}

// ─── Sub-heading — small caps label inside a section ─────────────────────────

export function SubHeading({ children, action, id }: {
  children: React.ReactNode;
  action?:  React.ReactNode;
  id?:      string;
}) {
  return (
    <Box id={id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, scrollMarginTop: 60 }}>
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.09em', color: D.muted, fontFamily: D.body,
      }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}

// ─── Photo credit — Unsplash and Wikimedia Commons both require one ──────────

export function PhotoCredit({ name, link, licence, unsplash }: {
  name:      string;
  link:      string;
  licence?:  string;
  unsplash?: boolean;
}) {
  return (
    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(29,38,66,0.4)', lineHeight: 1.4 }}>
      Photo:{' '}
      <Box component="a" href={link} target="_blank" rel="noopener noreferrer" sx={{ color: 'inherit', textDecoration: 'underline' }}>
        {name}
      </Box>
      {licence ? ` · ${licence}` : ''}
      {unsplash ? ' / Unsplash' : ''}
    </Typography>
  );
}

// ─── Phrase card — big foreign word ──────────────────────────────────────────

export function PhraseCard({ phrase }: { phrase: Phrase }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(phrase.local);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Paper elevation={0} sx={{
      p: 2.5, border: `1px solid ${D.rule}`,
      borderRadius: 1.5, backgroundColor: D.paper,
      display: 'flex', flexDirection: 'column', gap: 0.5,
    }}>
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: D.muted, fontFamily: D.body,
      }}>
        {phrase.english}
      </Typography>
      <Typography sx={{
        fontFamily: D.display,
        fontSize: { xs: '1.75rem', sm: '2rem' },
        color: D.navy, lineHeight: 1.05, letterSpacing: '-0.02em',
      }}>
        {phrase.local}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.9rem', color: D.green, fontStyle: 'italic' }}>
          {phrase.phonetic}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton size="small" onClick={copy} sx={{ p: 0.5 }}>
            <ContentCopyIcon sx={{ fontSize: '0.95rem', color: copied ? D.green : D.muted }} />
          </IconButton>
        </Tooltip>
      </Box>
      {phrase.context && (
        <Typography sx={{ fontSize: '0.85rem', color: D.muted, lineHeight: 1.45 }}>
          {phrase.context}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Phrase categories ────────────────────────────────────────────────────────

export const PHRASE_CATEGORIES = [
  { label: 'Essential',  ids: ['hello', 'thank_you', 'excuse_me', 'speak_english', 'help'] },
  { label: 'Eating out', ids: ['check_please', 'how_much', 'thank_you', 'water'] },
  { label: 'Navigation', ids: ['where_is', 'excuse_me', 'help'] },
  { label: 'Shopping',   ids: ['how_much', 'thank_you', 'excuse_me', 'too_expensive'] },
  { label: 'All',        ids: null },
] as const;

// ─── Timezone card ────────────────────────────────────────────────────────────

function fmt(tz: string) {
  return new Intl.DateTimeFormat('en-IE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
function fmtDay(tz: string) {
  return new Intl.DateTimeFormat('en-IE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
}

// Seconds drop on phones so two clocks fit side by side at 320–430px
const CLOCK_SIZE = { xs: 'clamp(1.5rem, 8.5vw, 2.25rem)', sm: '2.5rem', md: '3rem' };

function Clock({ tz, color = D.navy }: { tz: string; color?: string }) {
  const t = fmt(tz);
  return (
    <Typography sx={{ fontFamily: D.display, fontSize: CLOCK_SIZE, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color, whiteSpace: 'nowrap' }}>
      {t.slice(0, 5)}
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t.slice(5)}</Box>
    </Typography>
  );
}

export function TimezoneCard({ timezone }: { timezone: Intelligence['timezone'] }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  // Profile home, not the device — on the trip the phone is already on destination time
  const homeTz     = timezone.originTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const destTz     = timezone.destinationTimezone;
  const isSame     = homeTz === destTz || timezone.absDifference === 0;
  const dayDiffers = fmtDay(homeTz) !== fmtDay(destTz);

  return (
    <Paper elevation={0} sx={{ border: `1px solid ${D.rule}`, borderRadius: 1.5, overflow: 'hidden', backgroundColor: D.paper }}>
      {isSame ? (
        <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
          <Clock tz={homeTz} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.97rem', fontWeight: 700, color: D.navy }}>Same timezone</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: D.muted }}>{homeTz}</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}>
          <Box sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, display: 'block', mb: 0.75 }}>
              Home
            </Typography>
            <Clock tz={homeTz} />
            <Typography sx={{ fontSize: '0.85rem', color: D.muted, display: 'block', mt: 0.5 }}>{fmtDay(homeTz)}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(29,38,66,0.3)', overflowWrap: 'anywhere' }}>{homeTz}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 1, sm: 1.5 }, borderLeft: `1px solid ${D.rule}`, borderRight: `1px solid ${D.rule}` }}>
            <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.muted, whiteSpace: 'nowrap' }}>
              {timezone.hoursDifference > 0 ? '+' : ''}{timezone.hoursDifference}h
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, textAlign: 'right' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, display: 'block', mb: 0.75 }}>
              There
            </Typography>
            <Clock tz={destTz} color={timezone.jetlagRisk === 'significant' ? '#d32f2f' : timezone.jetlagRisk === 'moderate' ? D.terra : D.navy} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
              <Typography sx={{ fontSize: '0.85rem', color: D.muted }}>{fmtDay(destTz)}</Typography>
              {dayDiffers && (
                <Box sx={{ px: 0.75, py: 0.2, backgroundColor: 'rgba(196,113,74,0.12)', borderRadius: 0.75 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: D.terra }}>
                    {timezone.hoursDifference > 0 ? '+1 day' : '−1 day'}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(29,38,66,0.3)', overflowWrap: 'anywhere' }}>{destTz}</Typography>
          </Box>
        </Box>
      )}

      {timezone.jetlagRisk !== 'none' && (
        <Box sx={{
          px: 2.5, py: 1.25,
          borderTop: `1px solid ${D.rule}`,
          backgroundColor: timezone.jetlagRisk === 'significant' ? 'rgba(211,47,47,0.04)' : 'rgba(196,113,74,0.04)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          {timezone.jetlagRisk === 'significant'
            ? <ErrorIcon sx={{ fontSize: '0.95rem', color: '#d32f2f' }} />
            : <WarningAmberIcon sx={{ fontSize: '0.95rem', color: D.terra }} />
          }
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: timezone.jetlagRisk === 'significant' ? '#d32f2f' : D.terra }}>
            Jet lag risk: {timezone.jetlagRisk}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}