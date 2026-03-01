'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, Grid, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItemButton, ListItemText,
} from '@mui/material';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import ErrorIcon            from '@mui/icons-material/Error';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import PowerIcon            from '@mui/icons-material/Power';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import TranslateIcon        from '@mui/icons-material/Translate';
import AccessTimeIcon       from '@mui/icons-material/AccessTime';
import LocalHospitalIcon    from '@mui/icons-material/LocalHospital';
import DirectionsCarIcon    from '@mui/icons-material/DirectionsCar';
import BadgeIcon            from '@mui/icons-material/Badge';
import ArticleIcon          from '@mui/icons-material/Article';
import WaterDropIcon        from '@mui/icons-material/WaterDrop';
import PaymentsIcon         from '@mui/icons-material/Payments';
import RestaurantIcon       from '@mui/icons-material/Restaurant';
import CheckroomIcon        from '@mui/icons-material/Checkroom';
import OpenInNewIcon        from '@mui/icons-material/OpenInNew';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import RecordVoiceOverIcon  from '@mui/icons-material/RecordVoiceOver';
import ExploreIcon          from '@mui/icons-material/Explore';
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome';
import EventIcon            from '@mui/icons-material/Event';
import LocationCityIcon     from '@mui/icons-material/LocationCity';
import RefreshIcon          from '@mui/icons-material/Refresh';
import LocalCafeIcon        from '@mui/icons-material/LocalCafe';
import ParkIcon             from '@mui/icons-material/Park';
import MapIcon              from '@mui/icons-material/Map';
import AddIcon              from '@mui/icons-material/Add';
import CalendarTodayIcon    from '@mui/icons-material/CalendarToday';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Phrase {
  id:       string;
  english:  string;
  local:    string;
  phonetic: string;
  usage:    string;
  context:  string;
}

interface Intelligence {
  destination: { country: string; countryCode: string; city?: string };
  electrical: {
    needsAdapter:    boolean;
    originPlug:      string;
    destinationPlug: string;
    adapterType:     string | null;
    message:         string;
  } | null;
  currency: {
    needsExchange:       boolean;
    originCurrency:      string;
    destinationCurrency: string;
    destinationSymbol:   string;
    message:             string;
  } | null;
  language: {
    sameLanguage:             boolean;
    destinationLanguage:      string;
    destinationLanguageLocal: string | null;
    phrasesAvailable:         boolean;
    essentialPhrases:         Phrase[];
    allPhrases:               Phrase[];
    message:                  string;
  };
  timezone: {
    destinationTimezone: string;
    hoursDifference:     number;
    absDifference:       number;
    jetlagRisk:          'none' | 'mild' | 'moderate' | 'significant';
    direction:           string;
    message:             string;
  };
  emergency: { number: string; country: string; message: string };
  driving: {
    destinationSide: string;
    originSide:      string;
    sameAshome:      boolean;
    message:         string;
  } | null;
  passport: {
    expiry:        string;
    daysAtTravel:  number;
    isWarning:     boolean;
    isExpired:     boolean;
    message:       string;
  } | null;
  visa: {
    available:       boolean;
    required?:       boolean;
    type?:           string;
    typeLabel?:      string;
    name?:           string | null;
    cost?:           string | null;
    processingTime?: string | null;
    applyUrl?:       string | null;
    maxStay?:        string;
    notes?:          string;
    message:         string;
  } | null;
  tipping: {
    culture:     string;
    restaurants: string;
    taxis:       string;
    hotels:      string;
    notes:       string;
    message:     string;
  } | null;
  water: {
    drinkable: boolean;
    notes:     string;
    message:   string;
  } | null;
  payment: {
    cashCulture: string;
    contactless: boolean;
    notes:       string;
    message:     string;
  } | null;
  cultural: {
    dressCode: string;
    notes:     string;
    message:   string;
  } | null;
}

// ─── Culture / Discover types ─────────────────────────────────────────────────

interface CultureHighlight {
  name:         string;
  description:  string;
  type:         string;
  category:     'cultural' | 'coffee' | 'park';
  tip?:         string;
  free?:        boolean;
  address?:     string;
  coordinates?: { lat: number; lng: number };
  nearVenue?:   string;
}

interface CultureBriefing {
  destination:   string;
  highlights:    CultureHighlight[];
  neighbourhood: {
    name:         string;
    description:  string;
    address?:     string;
    coordinates?: { lat: number; lng: number };
  } | null;
  practicalNote: string;
  generatedAt:   string;
}

interface FreeDay {
  date:         Date | string;
  label:        string;
  includes:     string[];
  excludes:     string[];
  dateUnknown?: boolean;
}

interface StandingAccess {
  title:             string;
  description:       string;
  when?:             string;
  touristsEligible?: boolean;
  caveat?:           string;
}

interface FreeAccess {
  freeDays: FreeDay[];
  standing: StandingAccess[];
  summary?: string | null;
  tip?:     string | null;
}

interface CultureData {
  briefing:    CultureBriefing | null;
  freeAccess:  FreeAccess | null;
  generatedAt: string | null;
}

interface ItineraryDay {
  date:      string;
  dayNumber: number;
  stops:     any[];
}

interface Props { tripId: string; }

// ─── Highlight type maps ──────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
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

const TYPE_LABELS: Record<string, string> = {
  museum: '🏛', gallery: '🖼', landmark: '📍',
  neighbourhood: '🚶', experience: '✨', food: '🍽',
  coffee: '☕', park: '🌳', music: '🎵', other: '★',
};

// ─── Map link builder ─────────────────────────────────────────────────────────
// Uses coordinates when geocoded (accurate), falls back to address search

function buildMapUrl(h: { name: string; coordinates?: { lat: number; lng: number } | null; address?: string | null }): string {
  if (h.coordinates?.lat && h.coordinates?.lng) {
    return `https://maps.apple.com/?ll=${h.coordinates.lat},${h.coordinates.lng}&q=${encodeURIComponent(h.name)}`;
  }
  if (h.address) {
    return `https://maps.apple.com/?address=${encodeURIComponent(h.address)}`;
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(h.name)}`;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({
  icon, label, status, value, onClick,
}: {
  icon:     React.ReactNode;
  label:    string;
  status:   'ok' | 'warn' | 'error' | 'info' | 'neutral';
  value?:   string;
  onClick?: () => void;
}) {
  const colors = {
    ok:      { bg: 'rgba(46,125,50,0.08)',   border: 'rgba(46,125,50,0.25)',   icon: 'success.main',   text: 'success.dark'   },
    warn:    { bg: 'rgba(237,108,2,0.08)',   border: 'rgba(237,108,2,0.3)',    icon: 'warning.main',   text: 'warning.dark'   },
    error:   { bg: 'rgba(211,47,47,0.08)',   border: 'rgba(211,47,47,0.3)',    icon: 'error.main',     text: 'error.dark'     },
    info:    { bg: 'rgba(85,112,44,0.08)',   border: 'rgba(85,112,44,0.25)',   icon: '#55702C',        text: '#3d5218'        },
    neutral: { bg: 'rgba(0,0,0,0.03)',       border: 'rgba(0,0,0,0.1)',        icon: 'text.secondary', text: 'text.secondary' },
  };
  const c = colors[status];

  return (
    <Paper elevation={0} onClick={onClick} sx={{
      px: 1.5, py: 1.25, border: '1px solid', borderColor: c.border,
      backgroundColor: c.bg, display: 'flex', flexDirection: 'column', gap: 0.4,
      cursor: onClick ? 'pointer' : 'default',
      minWidth: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box sx={{ color: c.icon, display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography variant="caption" fontWeight={700}
          sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', lineHeight: 1 }}>
          {label}
        </Typography>
      </Box>
      {value && (
        <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.9rem', color: c.text, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, children, action }: {
  icon:     React.ReactNode;
  children: React.ReactNode;
  action?:  React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: '#55702C', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={800}
        sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', flexGrow: 1 }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}

// ─── Detail card ─────────────────────────────────────────────────────────────

function DetailCard({ icon, title, status, children }: {
  icon:     React.ReactNode;
  title:    string;
  status:   'ok' | 'warn' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const borderColor = { ok: 'success.main', warn: 'warning.main', error: 'error.main', info: '#55702C' }[status];
  return (
    <Paper elevation={0} sx={{
      p: 2.5, borderLeft: '3px solid', borderLeftColor: borderColor,
      border: '1px solid', borderColor: 'divider',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <Box sx={{ color: borderColor, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '1rem' }}>{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

// ─── Phrase card ─────────────────────────────────────────────────────────────

function PhraseCard({ phrase }: { phrase: Phrase }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(phrase.local);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
        {phrase.english}
      </Typography>
      <Typography fontWeight={800} sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
        {phrase.local}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RecordVoiceOverIcon sx={{ fontSize: '0.95rem', color: 'primary.main' }} />
          <Typography variant="body2" color="primary.main" fontStyle="italic" sx={{ fontSize: '0.95rem' }}>
            {phrase.phonetic}
          </Typography>
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy phrase'}>
          <IconButton size="small" onClick={copy} sx={{ p: 0.5 }}>
            <ContentCopyIcon sx={{ fontSize: '1rem', color: copied ? 'success.main' : 'text.disabled' }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
        {phrase.context}
      </Typography>
    </Paper>
  );
}

// ─── Phrase categories ────────────────────────────────────────────────────────

const PHRASE_CATEGORIES = [
  { label: 'Essential',   ids: ['hello', 'thank_you', 'excuse_me', 'speak_english', 'help'] },
  { label: 'Eating out',  ids: ['check_please', 'how_much', 'thank_you', 'water'] },
  { label: 'Navigation',  ids: ['where_is', 'excuse_me', 'help'] },
  { label: 'Shopping',    ids: ['how_much', 'thank_you', 'excuse_me', 'too_expensive'] },
  { label: 'All',         ids: null },
];

// ─── Live timezone ────────────────────────────────────────────────────────────

function formatTime(tz: string) {
  return new Intl.DateTimeFormat('en-IE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
function formatDay(tz: string) {
  return new Intl.DateTimeFormat('en-IE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
}

function TimezoneCard({ timezone }: { timezone: Intelligence['timezone'] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const browserTz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const destTz     = timezone.destinationTimezone;
  const isSame     = browserTz === destTz || timezone.absDifference === 0;
  const homeTime   = formatTime(browserTz);
  const destTime   = formatTime(destTz);
  const homeDay    = formatDay(browserTz);
  const destDay    = formatDay(destTz);
  const dayDiffers = homeDay !== destDay;

  return (
    <Box>
      <SectionHeading icon={<AccessTimeIcon sx={{ fontSize: '1.1rem' }} />}>Timezone</SectionHeading>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        {isSame ? (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
            <Typography fontWeight={900} sx={{ fontSize: '2.2rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{homeTime}</Typography>
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Same timezone</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>{browserTz}</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 2, alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                Home
              </Typography>
              <Typography fontWeight={900} sx={{ fontSize: { xs: '1.8rem', sm: '2.1rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {homeTime}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', display: 'block', mt: 0.4 }}>{homeDay}</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.78rem' }}>{browserTz}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', px: 0.5 }}>
              <Typography fontWeight={800} sx={{ fontSize: '1rem', color: 'text.disabled' }}>
                {timezone.hoursDifference > 0 ? '+' : ''}{timezone.hoursDifference}h
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                There
              </Typography>
              <Typography fontWeight={900} sx={{
                fontSize: { xs: '1.8rem', sm: '2.1rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                color: timezone.jetlagRisk === 'significant' ? 'error.main' : timezone.jetlagRisk === 'moderate' ? 'warning.dark' : 'text.primary',
              }}>
                {destTime}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', display: 'block', mt: 0.4 }}>
                {destDay}
                {dayDiffers && <Chip label="next day" size="small"
                  sx={{ ml: 0.5, height: 16, fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(237,108,2,0.1)', color: 'warning.dark' }} />}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.78rem' }}>{destTz}</Typography>
            </Box>
          </Box>
        )}
        {timezone.jetlagRisk !== 'none' && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Chip size="small"
              icon={timezone.jetlagRisk === 'significant' ? <ErrorIcon sx={{ fontSize: '1rem !important' }} /> : <WarningAmberIcon sx={{ fontSize: '1rem !important' }} />}
              label={`Jet lag risk: ${timezone.jetlagRisk}`}
              color={timezone.jetlagRisk === 'significant' ? 'error' : timezone.jetlagRisk === 'moderate' ? 'warning' : 'info'}
              sx={{ fontWeight: 700, fontSize: '0.88rem', height: 28 }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

// ─── Add to Itinerary Dialog ──────────────────────────────────────────────────

function AddToItineraryDialog({
  open, onClose, highlight, tripId,
}: {
  open:      boolean;
  onClose:   () => void;
  highlight: CultureHighlight | null;
  tripId:    string;
}) {
  const [days,   setDays]   = useState<ItineraryDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setDone(null); return; }
    fetch(`/api/trips/${tripId}/itinerary`)
      .then(r => r.json())
      .then(d => setDays(d.days ?? []))
      .catch(() => {});
  }, [open, tripId]);

  const addToDay = async (day: ItineraryDay) => {
    if (!highlight) return;
    setSaving(true);
    try {
      const stopType = highlight.type === 'coffee' ? 'meal'
                     : highlight.type === 'park'   ? 'activity'
                     : highlight.type === 'museum' || highlight.type === 'gallery' || highlight.type === 'landmark' ? 'sightseeing'
                     : 'activity';

      const stop = {
        name:        highlight.name,
        type:        stopType,
        address:     highlight.address    ?? undefined,
        coordinates: highlight.coordinates ?? undefined,
        duration:    highlight.type === 'coffee' ? 45 : highlight.type === 'park' ? 60 : 90,
        notes:       highlight.tip ?? undefined,
      };

      await fetch(`/api/trips/${tripId}/itinerary/day/${day.date}/stop`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stop }),
      });

      setDone(day.date);
    } catch {
      // fail silently — user can retry
    } finally {
      setSaving(false);
    }
  };

  const formatDayLabel = (d: ItineraryDay) =>
    new Date(d.date).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>
        Add to Itinerary
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {highlight && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.95rem', mb: 2 }}>
            Adding <strong>{highlight.name}</strong> — pick a day:
          </Typography>
        )}
        {done ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
            <CheckCircleIcon color="success" />
            <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>
              Added to {formatDayLabel(days.find(d => d.date === done)!)}
            </Typography>
          </Box>
        ) : days.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontSize: '0.95rem', py: 2 }}>
            No itinerary days found. Add dates to your trip first.
          </Typography>
        ) : (
          <List disablePadding>
            {days.map(day => (
              <ListItemButton
                key={day.date}
                disabled={saving}
                onClick={() => addToDay(day)}
                sx={{ borderRadius: 1, mb: 0.5, border: '1px solid', borderColor: 'divider' }}
              >
                <CalendarTodayIcon sx={{ fontSize: '1rem', mr: 1.5, color: '#55702C' }} />
                <ListItemText
                  primary={`Day ${day.dayNumber} — ${formatDayLabel(day)}`}
                  secondary={`${day.stops.length} stops`}
                  primaryTypographyProps={{ fontWeight: 700, fontSize: '0.95rem' }}
                  secondaryTypographyProps={{ fontSize: '0.85rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {done ? 'Done' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Highlight card ───────────────────────────────────────────────────────────

function HighlightCard({ h, onAddToItinerary }: { h: CultureHighlight; onAddToItinerary: () => void }) {
  const mapUrl = buildMapUrl(h);

  return (
    <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, display: 'flex' }}>
      <Box sx={{ width: 5, flexShrink: 0, backgroundColor: TYPE_COLOURS[h.type] ?? '#333' }} />
      <Box sx={{ p: 2, flexGrow: 1, minWidth: 0 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography sx={{ fontSize: '1.1rem', flexShrink: 0, mt: 0.1 }}>{TYPE_LABELS[h.type] ?? '★'}</Typography>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography fontWeight={800} sx={{ fontSize: '1.05rem', lineHeight: 1.2 }}>{h.name}</Typography>
              {h.free && (
                <Chip label="Free entry" size="small" color="success" variant="outlined"
                  sx={{ height: 22, fontSize: '0.78rem', fontWeight: 700 }} />
              )}
              {h.nearVenue && (
                <Chip label={`Near ${h.nearVenue}`} size="small"
                  sx={{ height: 22, fontSize: '0.78rem', fontWeight: 600, backgroundColor: 'rgba(85,112,44,0.08)', color: '#3d5218' }} />
              )}
            </Box>

            {/* Description */}
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.55 }}>
              {h.description}
            </Typography>

            {/* Tip */}
            {h.tip && (
              <Typography sx={{ fontSize: '0.9rem', color: '#55702C', display: 'block', mt: 0.75, fontStyle: 'italic', lineHeight: 1.4 }}>
                💡 {h.tip}
              </Typography>
            )}

            {/* Address + actions row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.25, flexWrap: 'wrap', gap: 0.75 }}>
              {/* Map link — uses coordinates if geocoded, else address search */}
              <Box
                component="a"
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  fontSize: '0.88rem', color: 'text.secondary', textDecoration: 'none', fontWeight: 500,
                  border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  px: 1, py: 0.4,
                  '&:hover': { borderColor: '#55702C', color: '#55702C' },
                }}
              >
                <MapIcon sx={{ fontSize: '0.95rem' }} />
                {h.address ? h.address.split(',').slice(0, 2).join(',') : 'Open in Maps'}
              </Box>

              {/* Add to itinerary */}
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: '0.95rem !important' }} />}
                onClick={onAddToItinerary}
                sx={{
                  fontSize: '0.85rem', fontWeight: 700, py: 0.4, px: 1.25,
                  border: '1px solid', borderColor: 'rgba(29,38,66,0.3)',
                  color: '#1D2642', backgroundColor: 'rgba(29,38,66,0.03)',
                  '&:hover': { backgroundColor: 'rgba(29,38,66,0.08)' },
                }}
              >
                Add to day
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Discover section ─────────────────────────────────────────────────────────

function DiscoverSection({ tripId }: { tripId: string }) {
  const [culture,        setCulture]        = useState<CultureData | null>(null);
  const [generating,     setGenerating]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [addTarget,      setAddTarget]      = useState<CultureHighlight | null>(null);
  const [dialogOpen,     setDialogOpen]     = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/culture`)
      .then(r => r.json())
      .then(d => setCulture(d.culture ?? null))
      .catch(() => {});
  }, [tripId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch(`/api/trips/${tripId}/culture`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setCulture(data.culture);
    } catch {
      setError('Failed to generate — check your connection');
    } finally {
      setGenerating(false);
    }
  };

  const openAddDialog = (h: CultureHighlight) => { setAddTarget(h); setDialogOpen(true); };

  const hasBriefing    = !!culture?.briefing;
  const freeDays       = culture?.freeAccess?.freeDays?.filter((e: any) => !e.dateUnknown) ?? [];
  const standingAccess = culture?.freeAccess?.standing ?? [];
  const freeAccessTip  = culture?.freeAccess?.tip ?? null;

  // Split highlights by category
  const cultural  = culture?.briefing?.highlights.filter(h => h.category === 'cultural') ?? [];
  const coffees   = culture?.briefing?.highlights.filter(h => h.category === 'coffee')   ?? [];
  const parks     = culture?.briefing?.highlights.filter(h => h.category === 'park')     ?? [];

  return (
    <Box>
      {/* ── Date-matched free days ── */}
      {freeDays.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {freeDays.map((day: any, i: number) => (
            <Paper key={i} elevation={0} sx={{
              p: 2.5, mb: 1.25,
              border: '2px solid rgba(201,82,27,0.4)',
              backgroundColor: 'rgba(201,82,27,0.04)',
              borderRadius: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <EventIcon sx={{ fontSize: '1.1rem', color: '#C9521B', flexShrink: 0, mt: 0.1 }} />
                <Typography fontWeight={800} sx={{ fontSize: '1rem', color: '#C9521B', lineHeight: 1.3 }}>
                  {day.label}
                </Typography>
              </Box>
              {day.includes?.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {day.includes.slice(0, 4).map((inc: string) => (
                    <Chip key={inc} label={inc} size="small" sx={{ height: 24, fontSize: '0.8rem', fontWeight: 600 }} />
                  ))}
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* ── Standing free access ── */}
      {(standingAccess.length > 0 || freeAccessTip) && (
        <Paper elevation={0} sx={{
          p: 2.5, mb: 3,
          border: '1px solid rgba(85,112,44,0.35)',
          backgroundColor: 'rgba(85,112,44,0.04)',
          borderRadius: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
            <Typography sx={{ fontSize: '1.1rem' }}>🎟</Typography>
            <Typography fontWeight={800} sx={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 0.5, color: '#55702C' }}>
              Free cultural access
            </Typography>
          </Box>
          {standingAccess.map((item: any, i: number) => (
            <Box key={i} sx={{ mb: i < standingAccess.length - 1 ? 1.75 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                {item.touristsEligible === false && (
                  <Chip label="Residents only" size="small" color="warning" variant="outlined"
                    sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }} />
                )}
                <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{item.title}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
                {item.description}
              </Typography>
              {item.when && (
                <Typography sx={{ fontSize: '0.88rem', color: '#55702C', display: 'block', mt: 0.4 }}>
                  🕐 {item.when}
                </Typography>
              )}
              {item.caveat && (
                <Typography sx={{ fontSize: '0.88rem', color: 'warning.dark', display: 'block', mt: 0.4, fontStyle: 'italic' }}>
                  ⚠️ {item.caveat}
                </Typography>
              )}
            </Box>
          ))}
          {freeAccessTip && (
            <Typography sx={{ fontSize: '0.9rem', color: '#55702C', display: 'block', mt: 1, fontStyle: 'italic' }}>
              💡 {freeAccessTip}
            </Typography>
          )}
        </Paper>
      )}

      {/* ── Discover heading ── */}
      <SectionHeading
        icon={<ExploreIcon sx={{ fontSize: '1.1rem' }} />}
        action={hasBriefing ? (
          <Tooltip title="Regenerate briefing">
            <IconButton size="small" onClick={generate} disabled={generating} sx={{ p: 0.5 }}>
              <RefreshIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        ) : null}
      >
        Discover
      </SectionHeading>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.95rem' }}>{error}</Typography>
        </Alert>
      )}

      {/* Empty state */}
      {!hasBriefing && !generating && (
        <Paper elevation={0} sx={{
          p: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center',
        }}>
          <AutoAwesomeIcon sx={{ fontSize: '2.5rem', color: 'text.disabled' }} />
          <Box>
            <Typography fontWeight={700} sx={{ fontSize: '1.1rem', mb: 0.5 }}>Cultural briefing</Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.97rem', maxWidth: 300 }}>
              Curated cultural highlights, the best local coffee, green spaces nearby, and a neighbourhood to explore — generated for this specific trip.
            </Typography>
          </Box>
          <Button
            variant="contained" size="medium"
            startIcon={<AutoAwesomeIcon />}
            onClick={generate}
            sx={{ fontWeight: 700, fontSize: '0.97rem', backgroundColor: '#1D2642', '&:hover': { backgroundColor: '#2a3660' } }}
          >
            Generate briefing
          </Button>
        </Paper>
      )}

      {/* Generating */}
      {generating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary" sx={{ fontSize: '0.97rem' }}>
            Thinking about {culture?.briefing?.destination ?? 'your destination'}…
          </Typography>
        </Box>
      )}

      {/* ── Briefing content, split by category ── */}
      {hasBriefing && !generating && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Cultural highlights */}
          {cultural.length > 0 && (
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', mb: 1.5 }}>
                🏛 Cultural
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {cultural.map((h, i) => (
                  <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />
                ))}
              </Box>
            </Box>
          )}

          {/* Coffee */}
          {coffees.length > 0 && (
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', mb: 1.5 }}>
                ☕ Coffee
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {coffees.map((h, i) => (
                  <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />
                ))}
              </Box>
            </Box>
          )}

          {/* Parks */}
          {parks.length > 0 && (
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', mb: 1.5 }}>
                🌳 Green spaces
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {parks.map((h, i) => (
                  <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />
                ))}
              </Box>
            </Box>
          )}

          {/* Neighbourhood */}
          {culture!.briefing!.neighbourhood && (
            <Paper elevation={0} sx={{
              p: 2.5, border: '1px solid', borderColor: 'rgba(29,38,66,0.3)',
              backgroundColor: 'rgba(29,38,66,0.04)', borderRadius: 1.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LocationCityIcon sx={{ fontSize: '1.1rem', color: '#1D2642' }} />
                <Typography fontWeight={800} sx={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 0.5, color: '#1D2642' }}>
                  Walk this neighbourhood
                </Typography>
              </Box>
              <Typography fontWeight={800} sx={{ fontSize: '1.1rem', mb: 0.5 }}>
                {culture!.briefing!.neighbourhood.name}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.55 }}>
                {culture!.briefing!.neighbourhood.description}
              </Typography>
              {culture!.briefing!.neighbourhood && (culture!.briefing!.neighbourhood.address || culture!.briefing!.neighbourhood.coordinates) && (
                <Box
                  component="a"
                  href={buildMapUrl({
                    name:        culture!.briefing!.neighbourhood.name,
                    coordinates: culture!.briefing!.neighbourhood.coordinates,
                    address:     culture!.briefing!.neighbourhood.address,
                  })}
                  target="_blank" rel="noopener noreferrer"
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.25,
                    fontSize: '0.9rem', color: 'text.secondary', textDecoration: 'none', fontWeight: 500,
                    border: '1px solid', borderColor: 'divider', borderRadius: 1,
                    px: 1, py: 0.4,
                    '&:hover': { borderColor: '#1D2642', color: '#1D2642' },
                  }}
                >
                  <MapIcon sx={{ fontSize: '0.95rem' }} />
                  Open in Maps
                </Box>
              )}
            </Paper>
          )}

          {/* Practical note */}
          {culture!.briefing!.practicalNote && (
            <Paper elevation={0} sx={{
              px: 2.5, py: 2, border: '1px solid', borderColor: 'divider',
              backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1.5,
              display: 'flex', gap: 1.25, alignItems: 'flex-start',
            }}>
              <Typography sx={{ fontSize: '1.2rem', flexShrink: 0 }}>💡</Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.55 }}>
                {culture!.briefing!.practicalNote}
              </Typography>
            </Paper>
          )}

          <Typography color="text.disabled" sx={{ fontSize: '0.82rem', textAlign: 'right' }}>
            Generated {new Date(culture!.briefing!.generatedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Typography>
        </Box>
      )}

      {/* Add to itinerary dialog */}
      <AddToItineraryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        highlight={addTarget}
        tripId={tripId}
      />
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IntelligenceTab({ tripId }: Props) {
  const [intel,          setIntel]          = useState<Intelligence | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(0);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/intelligence`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setIntel(data.intelligence);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load travel context'); setLoading(false); });
  }, [tripId]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  );

  if (error) return (
    <Alert severity="warning" sx={{ mt: 2 }}>
      {error === 'No destination country on trip'
        ? 'Add a destination country to your trip to see travel context.'
        : error.includes('homeLocation') || !intel
        ? 'Set your home country in your profile to see personalised comparisons.'
        : error}
    </Alert>
  );

  if (!intel) return null;

  const { electrical, currency, language, timezone, emergency, driving, passport, visa, tipping, water, payment, cultural } = intel;

  const passportStatus: 'ok' | 'warn' | 'error' =
    !passport ? 'neutral' as any : passport.isExpired ? 'error' : passport.isWarning ? 'warn' : 'ok';

  const visaStatus: 'ok' | 'warn' | 'error' | 'info' =
    !visa?.available ? 'info' : !visa.required ? 'ok' : visa.type === 'visa' ? 'warn' : 'info';

  const cat = PHRASE_CATEGORIES[activeCategory];
  const displayedPhrases = cat.ids === null
    ? language.allPhrases
    : language.allPhrases.filter(p => cat.ids!.includes(p.id));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Header ── */}
      <Box>
        <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.15rem', sm: '1.3rem' } }}>
          Travel Context
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: '1rem' }}>
          {intel.destination.city ? `${intel.destination.city}, ` : ''}{intel.destination.country}
        </Typography>
      </Box>

      {/* ── Critical alerts ── */}
      {passport?.isExpired && (
        <Alert severity="error" icon={<BadgeIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Passport expired at time of travel</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {passport?.isWarning && !passport.isExpired && (
        <Alert severity="warning" icon={<BadgeIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Passport validity warning</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {water && !water.drinkable && (
        <Alert severity="warning" icon={<WaterDropIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Do not drink tap water</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{water.notes}</Typography>
        </Alert>
      )}

      {/* ── Status strip ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
        {visa && (
          <StatusPill icon={<ArticleIcon sx={{ fontSize: '1.1rem' }} />} label="Visa" status={visaStatus}
            value={visa.required === false ? `Free · ${visa.maxStay}` : visa.typeLabel} />
        )}
        {passport && (
          <StatusPill icon={<BadgeIcon sx={{ fontSize: '1.1rem' }} />} label="Passport" status={passportStatus}
            value={passport.isExpired ? 'EXPIRED' : passport.isWarning ? `${passport.daysAtTravel}d left` : 'Valid'} />
        )}
        {water && (
          <StatusPill icon={<WaterDropIcon sx={{ fontSize: '1.1rem' }} />} label="Water" status={water.drinkable ? 'ok' : 'warn'}
            value={water.drinkable ? 'Tap safe' : 'Bottled only'} />
        )}
        {currency && (
          <StatusPill icon={<CurrencyExchangeIcon sx={{ fontSize: '1.1rem' }} />} label="Currency"
            status={currency.needsExchange ? 'warn' : 'ok'}
            value={currency.needsExchange ? `${currency.originCurrency} → ${currency.destinationCurrency}` : `${currency.destinationCurrency} ✓`} />
        )}
        {electrical && (
          <StatusPill icon={<PowerIcon sx={{ fontSize: '1.1rem' }} />} label="Adapter"
            status={electrical.needsAdapter ? 'warn' : 'ok'}
            value={electrical.needsAdapter ? `${electrical.originPlug} → ${electrical.destinationPlug}` : 'No adapter'} />
        )}
        <StatusPill icon={<AccessTimeIcon sx={{ fontSize: '1.1rem' }} />} label="Timezone"
          status={timezone.jetlagRisk === 'none' ? 'ok' : timezone.jetlagRisk === 'significant' ? 'error' : 'warn'}
          value={timezone.absDifference === 0 ? 'Same' : `${timezone.hoursDifference > 0 ? '+' : ''}${timezone.hoursDifference}h`} />
        {driving && (
          <StatusPill icon={<DirectionsCarIcon sx={{ fontSize: '1.1rem' }} />} label="Driving"
            status={driving.sameAshome ? 'ok' : 'warn'}
            value={driving.sameAshome ? `${driving.destinationSide} ✓` : `${driving.destinationSide} side`} />
        )}
        {tipping && (
          <StatusPill icon={<RestaurantIcon sx={{ fontSize: '1.1rem' }} />} label="Tipping"
            status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' :
                    tipping.culture === 'offensive' || tipping.culture === 'not expected' ? 'ok' : 'neutral'}
            value={tipping.culture.charAt(0).toUpperCase() + tipping.culture.slice(1)} />
        )}
        <StatusPill icon={<LocalHospitalIcon sx={{ fontSize: '1.1rem' }} />} label="Emergency" status="info" value={emergency.number} />
      </Box>

      <Divider />

      {/* ── DISCOVER ── */}
      <DiscoverSection tripId={tripId} />

      <Divider />

      {/* ── VISA ── */}
      {visa && (
        <Box>
          <SectionHeading icon={<ArticleIcon sx={{ fontSize: '1.1rem' }} />}>Visa Requirements</SectionHeading>
          {!visa.available ? (
            <Alert severity="info" sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.97rem' }}>{visa.message}</Typography>
            </Alert>
          ) : !visa.required ? (
            <Paper elevation={0} sx={{
              p: 2.5, border: '1px solid', borderColor: 'rgba(46,125,50,0.3)',
              backgroundColor: 'rgba(46,125,50,0.05)',
              display: 'flex', alignItems: 'flex-start', gap: 1.5,
            }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1.4rem', mt: 0.1, flexShrink: 0 }} />
              <Box>
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem', mb: 0.4 }}>No visa required</Typography>
                <Typography color="text.secondary" sx={{ fontSize: '0.97rem' }}>Stay up to {visa.maxStay}</Typography>
                {visa.notes && (
                  <Typography color="text.secondary" sx={{ fontSize: '0.95rem', mt: 1, lineHeight: 1.5 }}>{visa.notes}</Typography>
                )}
              </Box>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{
              p: 2.5, border: '1px solid', borderColor: 'rgba(237,108,2,0.3)',
              backgroundColor: 'rgba(237,108,2,0.04)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <WarningAmberIcon sx={{ color: 'warning.main', fontSize: '1.2rem', flexShrink: 0 }} />
                <Typography fontWeight={800} sx={{ fontSize: '1.05rem' }}>{visa.typeLabel}</Typography>
                {visa.name && <Chip label={visa.name} size="small" sx={{ height: 22, fontSize: '0.8rem', fontWeight: 700 }} />}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: 'Cost',       value: visa.cost },
                  { label: 'Processing', value: visa.processingTime },
                  { label: 'Max stay',   value: visa.maxStay },
                ].filter(r => r.value).map(({ label, value }) => (
                  <Box key={label} sx={{ display: 'flex', gap: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', minWidth: 100, flexShrink: 0 }}>
                      {label}
                    </Typography>
                    <Typography fontWeight={700} sx={{ fontSize: '0.97rem' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              {visa.notes && (
                <Typography color="text.secondary"
                  sx={{ fontSize: '0.95rem', mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', lineHeight: 1.5 }}>
                  {visa.notes}
                </Typography>
              )}
              {visa.applyUrl && (
                <Button variant="outlined" size="medium" endIcon={<OpenInNewIcon />}
                  href={visa.applyUrl} target="_blank" rel="noopener noreferrer"
                  sx={{ mt: 2, fontSize: '0.95rem', fontWeight: 700 }}>
                  Apply online
                </Button>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* ── On the Ground ── */}
      <Box>
        <SectionHeading icon={<InfoOutlinedIcon sx={{ fontSize: '1.1rem' }} />}>On the Ground</SectionHeading>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {tipping && (
            <DetailCard icon={<RestaurantIcon sx={{ fontSize: '1.1rem' }} />} title="Tipping"
              status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' :
                      tipping.culture === 'offensive' ? 'error' :
                      tipping.culture === 'not expected' ? 'ok' : 'info'}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {[{ label: 'Restaurants', value: tipping.restaurants }, { label: 'Taxis', value: tipping.taxis }, { label: 'Hotels', value: tipping.hotels }].map(({ label, value }) => (
                  <Box key={label} sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', minWidth: 90, flexShrink: 0 }}>
                      {label}
                    </Typography>
                    <Typography fontWeight={700} sx={{ fontSize: '0.97rem' }}>{value}</Typography>
                  </Box>
                ))}
                {tipping.notes && (
                  <Typography color="text.secondary" sx={{ fontSize: '0.95rem', mt: 0.75, pt: 1, borderTop: '1px solid', borderColor: 'divider', lineHeight: 1.5 }}>
                    {tipping.notes}
                  </Typography>
                )}
              </Box>
            </DetailCard>
          )}

          {water && (
            <DetailCard icon={<WaterDropIcon sx={{ fontSize: '1.1rem' }} />} title="Drinking Water" status={water.drinkable ? 'ok' : 'warn'}>
              <Typography color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.5 }}>{water.notes}</Typography>
            </DetailCard>
          )}

          {payment && (
            <DetailCard icon={<PaymentsIcon sx={{ fontSize: '1.1rem' }} />} title="Payments" status="info">
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Chip label={payment.cashCulture.charAt(0).toUpperCase() + payment.cashCulture.slice(1).replace('-', ' ')}
                  size="small" sx={{ height: 24, fontSize: '0.82rem', fontWeight: 700 }} />
                {payment.contactless && (
                  <Chip label="Contactless accepted" size="small" color="success" variant="outlined"
                    sx={{ height: 24, fontSize: '0.82rem', fontWeight: 700 }} />
                )}
              </Box>
              <Typography color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.5 }}>{payment.notes}</Typography>
            </DetailCard>
          )}

          {cultural && (
            <DetailCard icon={<CheckroomIcon sx={{ fontSize: '1.1rem' }} />} title="Cultural Notes" status="info">
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline', mb: 1 }}>
                <Typography color="text.secondary" sx={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', minWidth: 90, flexShrink: 0 }}>
                  Dress code
                </Typography>
                <Typography fontWeight={700} sx={{ fontSize: '0.97rem', textTransform: 'capitalize' }}>{cultural.dressCode}</Typography>
              </Box>
              <Typography color="text.secondary" sx={{ fontSize: '0.97rem', lineHeight: 1.5 }}>{cultural.notes}</Typography>
            </DetailCard>
          )}
        </Box>
      </Box>

      {/* ── Timezone ── */}
      <TimezoneCard timezone={timezone} />

      {/* ── Electrical ── */}
      {electrical?.needsAdapter && (
        <Box>
          <SectionHeading icon={<PowerIcon sx={{ fontSize: '1.1rem' }} />}>Electrical Adapter</SectionHeading>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'rgba(237,108,2,0.3)', backgroundColor: 'rgba(237,108,2,0.04)' }}>
            <Typography fontWeight={700} sx={{ fontSize: '1rem', mb: 0.5 }}>{electrical.message}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
              {electrical.originPlug.split('/').map(type => (
                <Box key={type} sx={{ textAlign: 'center' }}>
                  <img src={`/plugs/${type}.svg`} alt={`Plug type ${type}`} width={60} height={60} style={{ display: 'block' }} />
                  <Typography sx={{ fontSize: '0.82rem', mt: 0.5 }}>Home · {type}</Typography>
                </Box>
              ))}
              <Typography color="text.disabled" sx={{ fontSize: '1.2rem' }}>→</Typography>
              {electrical.destinationPlug.split('/').map(type => (
                <Box key={type} sx={{ textAlign: 'center' }}>
                  <img src={`/plugs/${type}.svg`} alt={`Plug type ${type}`} width={60} height={60} style={{ display: 'block' }} />
                  <Typography sx={{ fontSize: '0.82rem', mt: 0.5 }}>There · {type}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* ── Emergency ── */}
      <Box>
        <SectionHeading icon={<LocalHospitalIcon sx={{ fontSize: '1.1rem' }} />}>Emergency Number</SectionHeading>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Typography fontWeight={900} sx={{ fontSize: '2.5rem', color: 'error.main', lineHeight: 1 }}>
            {emergency.number}
          </Typography>
          <Box>
            <Typography fontWeight={700} sx={{ fontSize: '1rem', mb: 0.5 }}>{emergency.country}</Typography>
            <Button variant="outlined" size="medium" color="error" href={`tel:${emergency.number}`}
              sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Call {emergency.number}
            </Button>
          </Box>
        </Paper>
      </Box>

      <Divider />

      {/* ── Language ── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TranslateIcon sx={{ fontSize: '1.1rem', color: '#55702C' }} />
            <Typography variant="subtitle1" fontWeight={800}
              sx={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              Language
            </Typography>
            {language.destinationLanguageLocal && (
              <Chip size="small" label={language.destinationLanguageLocal} variant="outlined"
                sx={{ height: 24, fontSize: '0.82rem', fontWeight: 700 }} />
            )}
          </Box>
          <Typography fontWeight={700} sx={{ fontSize: '0.97rem' }}>{language.destinationLanguage}</Typography>
        </Box>

        {language.sameLanguage ? (
          <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ py: 1 }}>
            <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{language.message}</Typography>
          </Alert>
        ) : language.phrasesAvailable ? (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
              {PHRASE_CATEGORIES.map((cat, i) => (
                <Chip key={cat.label} label={cat.label} size="medium"
                  onClick={() => setActiveCategory(i)}
                  sx={{
                    height: 34, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: activeCategory === i ? '#55702C' : 'transparent',
                    color: activeCategory === i ? '#fff' : 'text.secondary',
                    border: '1px solid', borderColor: activeCategory === i ? '#55702C' : 'divider',
                    '&:hover': { backgroundColor: activeCategory === i ? '#3d5218' : 'action.hover' },
                  }}
                />
              ))}
            </Box>
            <Grid container spacing={1.5}>
              {displayedPhrases.length === 0 ? (
                <Grid size={12}>
                  <Typography color="text.secondary" sx={{ fontSize: '0.97rem' }}>No phrases in this category.</Typography>
                </Grid>
              ) : (
                displayedPhrases.map(phrase => (
                  <Grid size={{ xs: 12, sm: 6 }} key={phrase.id}>
                    <PhraseCard phrase={phrase} />
                  </Grid>
                ))
              )}
            </Grid>
          </Box>
        ) : (
          <Alert severity="info" sx={{ py: 1 }}>
            <Typography sx={{ fontSize: '0.97rem' }}>
              {language.destinationLanguage} spoken. No phrase guide available for this destination yet.
            </Typography>
          </Alert>
        )}
      </Box>

    </Box>
  );
}