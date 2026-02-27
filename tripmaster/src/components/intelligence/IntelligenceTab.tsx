'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, Grid, Button, Collapse, IconButton, Tooltip,
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
import ExpandMoreIcon       from '@mui/icons-material/ExpandMore';
import ExpandLessIcon       from '@mui/icons-material/ExpandLess';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import RecordVoiceOverIcon  from '@mui/icons-material/RecordVoiceOver';

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
    available:      boolean;
    required?:      boolean;
    type?:          string;
    typeLabel?:     string;
    name?:          string | null;
    cost?:          string | null;
    processingTime?: string | null;
    applyUrl?:      string | null;
    maxStay?:       string;
    notes?:         string;
    message:        string;
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

interface Props { tripId: string; }

// ─── Status pill for the top strip ───────────────────────────────────────────

function StatusPill({
  icon, label, status, value, onClick,
}: {
  icon:    React.ReactNode;
  label:   string;
  status:  'ok' | 'warn' | 'error' | 'info' | 'neutral';
  value?:  string;
  onClick?: () => void;
}) {
  const colors = {
    ok:      { bg: 'rgba(46,125,50,0.08)',   border: 'rgba(46,125,50,0.25)',   icon: 'success.main',  text: 'success.dark'  },
    warn:    { bg: 'rgba(237,108,2,0.08)',   border: 'rgba(237,108,2,0.3)',    icon: 'warning.main',  text: 'warning.dark'  },
    error:   { bg: 'rgba(211,47,47,0.08)',   border: 'rgba(211,47,47,0.3)',    icon: 'error.main',    text: 'error.dark'    },
    info:    { bg: 'rgba(85,112,44,0.08)',   border: 'rgba(85,112,44,0.25)',   icon: '#55702C',       text: '#3d5218'       },
    neutral: { bg: 'rgba(0,0,0,0.03)',       border: 'rgba(0,0,0,0.1)',        icon: 'text.secondary', text: 'text.secondary' },
  };
  const c = colors[status];

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        px: 1.5, py: 1.25,
        border: '1px solid', borderColor: c.border,
        backgroundColor: c.bg,
        display: 'flex', flexDirection: 'column', gap: 0.4,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { backgroundColor: `${c.bg}`, filter: 'brightness(0.97)' } : {},
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box sx={{ color: c.icon, display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography variant="caption" fontWeight={700}
          sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', lineHeight: 1 }}>
          {label}
        </Typography>
      </Box>
      {value && (
        <Typography variant="body2" fontWeight={800}
          sx={{ fontSize: '0.82rem', color: c.text, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ color: '#55702C', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={800}
        sx={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── Detail card ─────────────────────────────────────────────────────────────

function DetailCard({
  icon, title, status, children,
}: {
  icon:     React.ReactNode;
  title:    string;
  status:   'ok' | 'warn' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const borderColor = {
    ok:    'success.main',
    warn:  'warning.main',
    error: 'error.main',
    info:  '#55702C',
  }[status];

  return (
    <Paper elevation={0} sx={{
      p: 2, borderLeft: '3px solid', borderLeftColor: borderColor,
      border: '1px solid', borderColor: 'divider',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ color: borderColor, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.82rem' }}>{title}</Typography>
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
    <Paper elevation={0} sx={{
      p: 1.75, border: '1px solid', borderColor: 'divider',
      display: 'flex', flexDirection: 'column', gap: 0.5,
    }}>
      {/* English — small label */}
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
        {phrase.english}
      </Typography>

      {/* Local — dominant */}
      <Typography fontWeight={800} sx={{ fontSize: '1.1rem', lineHeight: 1.2 }}>
        {phrase.local}
      </Typography>

      {/* Phonetic — tap to copy */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RecordVoiceOverIcon sx={{ fontSize: '0.85rem', color: 'primary.main' }} />
          <Typography variant="body2" color="primary.main" fontStyle="italic" sx={{ fontSize: '0.82rem' }}>
            {phrase.phonetic}
          </Typography>
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy phrase'}>
          <IconButton size="small" onClick={copy} sx={{ p: 0.4 }}>
            <ContentCopyIcon sx={{ fontSize: '0.85rem', color: copied ? 'success.main' : 'text.disabled' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Context */}
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.3 }}>
        {phrase.context}
      </Typography>
    </Paper>
  );
}

// ─── Phrase filter chip ───────────────────────────────────────────────────────

const PHRASE_CATEGORIES = [
  { label: 'Essential',   ids: ['hello', 'thank_you', 'excuse_me', 'speak_english', 'help'] },
  { label: 'Eating out',  ids: ['check_please', 'how_much', 'thank_you', 'water'] },
  { label: 'Navigation',  ids: ['where_is', 'excuse_me', 'help'] },
  { label: 'Shopping',    ids: ['how_much', 'thank_you', 'excuse_me', 'too_expensive'] },
  { label: 'All',         ids: null },
];

// ─── Live timezone card ───────────────────────────────────────────────────────

function formatTime(timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function formatDay(timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());
}

function TimezoneCard({ timezone }: {
  timezone: Intelligence['timezone'];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Use the browser's local timezone as "home" — most accurate for the device in hand
  const browserTz   = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const destTz      = timezone.destinationTimezone;
  const isSame      = browserTz === destTz || timezone.absDifference === 0;

  const homeTime    = formatTime(browserTz);
  const destTime    = formatTime(destTz);
  const homeDay     = formatDay(browserTz);
  const destDay     = formatDay(destTz);
  const dayDiffers  = homeDay !== destDay;

  return (
    <Box>
      <SectionHeading icon={<AccessTimeIcon sx={{ fontSize: '1rem' }} />}>
        Timezone
      </SectionHeading>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>

        {isSame ? (
          /* Same timezone — single clock */
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
            <Typography fontWeight={900} sx={{ fontSize: '2rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {homeTime}
            </Typography>
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>Same timezone</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>{browserTz}</Typography>
            </Box>
          </Box>
        ) : (
          /* Different timezones — two clocks side by side */
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1.5, alignItems: 'center' }}>

            {/* Home */}
            <Box>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.4 }}>
                Home
              </Typography>
              <Typography fontWeight={900}
                sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {homeTime}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
                {homeDay}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                {browserTz}
              </Typography>
            </Box>

            {/* Delta */}
            <Box sx={{ textAlign: 'center', px: 0.5 }}>
              <Typography variant="body2" fontWeight={800}
                sx={{ fontSize: '0.85rem', color: 'text.disabled', lineHeight: 1 }}>
                {timezone.hoursDifference > 0 ? '+' : ''}{timezone.hoursDifference}h
              </Typography>
            </Box>

            {/* Destination */}
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.4 }}>
                There
              </Typography>
              <Typography fontWeight={900}
                sx={{ fontSize: { xs: '1.6rem', sm: '1.9rem' }, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  color: timezone.jetlagRisk === 'significant' ? 'error.main' : timezone.jetlagRisk === 'moderate' ? 'warning.dark' : 'text.primary' }}>
                {destTime}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
                {destDay}{dayDiffers && (
                  <Chip label="next day" size="small"
                    sx={{ ml: 0.5, height: 14, fontSize: '0.55rem', fontWeight: 700, backgroundColor: 'rgba(237,108,2,0.1)', color: 'warning.dark' }} />
                )}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                {destTz}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Jet lag chip */}
        {timezone.jetlagRisk !== 'none' && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Chip
              size="small"
              icon={timezone.jetlagRisk === 'significant'
                ? <ErrorIcon sx={{ fontSize: '0.85rem !important' }} />
                : <WarningAmberIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={`Jet lag risk: ${timezone.jetlagRisk}`}
              color={timezone.jetlagRisk === 'significant' ? 'error' : timezone.jetlagRisk === 'moderate' ? 'warning' : 'info'}
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IntelligenceTab({ tripId }: Props) {
  const [intel,       setIntel]       = useState<Intelligence | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(0);
  const [showChecks,  setShowChecks]  = useState(false);

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
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
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

  // ── Derive status for top strip ──────────────────────────────────────────
  const passportStatus: 'ok' | 'warn' | 'error' =
    !passport ? 'neutral' as any :
    passport.isExpired ? 'error' :
    passport.isWarning ? 'warn' : 'ok';

  const visaStatus: 'ok' | 'warn' | 'error' | 'info' =
    !visa?.available ? 'info' :
    !visa.required ? 'ok' :
    visa.type === 'visa' ? 'warn' : 'info';

  const waterStatus: 'ok' | 'warn' =
    water?.drinkable ? 'ok' : 'warn';

  const tzStatus: 'ok' | 'warn' | 'error' =
    timezone.jetlagRisk === 'none' ? 'ok' :
    timezone.jetlagRisk === 'significant' ? 'error' : 'warn';

  // ── Has any critical warning ──────────────────────────────────────────────
  const hasCritical = (passport?.isExpired || passport?.isWarning || !water?.drinkable ||
    (visa?.required && visa?.type === 'visa'));

  // ── Phrase filtering ──────────────────────────────────────────────────────
  const cat = PHRASE_CATEGORIES[activeCategory];
  const displayedPhrases = cat.ids === null
    ? language.allPhrases
    : language.allPhrases.filter(p => cat.ids!.includes(p.id));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Header ── */}
      <Box>
        <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
          Travel Context
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          {intel.destination.city ? `${intel.destination.city}, ` : ''}{intel.destination.country}
        </Typography>
      </Box>

      {/* ── Critical alerts — always visible ── */}
      {passport?.isExpired && (
        <Alert severity="error" icon={<BadgeIcon fontSize="small" />}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>Passport expired at time of travel</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {passport?.isWarning && !passport.isExpired && (
        <Alert severity="warning" icon={<BadgeIcon fontSize="small" />}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>Passport validity warning</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {water && !water.drinkable && (
        <Alert severity="warning" icon={<WaterDropIcon fontSize="small" />}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>Do not drink tap water</Typography>
          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{water.notes}</Typography>
        </Alert>
      )}

      {/* ── Status strip — glanceable grid of all checks ── */}
      <Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 1,
          }}
        >
          {/* Visa */}
          {visa && (
            <StatusPill
              icon={<ArticleIcon sx={{ fontSize: '1rem' }} />}
              label="Visa"
              status={visaStatus}
              value={visa.required === false ? `Free · ${visa.maxStay}` : visa.typeLabel}
            />
          )}

          {/* Passport */}
          {passport && (
            <StatusPill
              icon={<BadgeIcon sx={{ fontSize: '1rem' }} />}
              label="Passport"
              status={passportStatus}
              value={passport.isExpired ? 'EXPIRED' : passport.isWarning ? `${passport.daysAtTravel}d left` : 'Valid'}
            />
          )}

          {/* Water */}
          {water && (
            <StatusPill
              icon={<WaterDropIcon sx={{ fontSize: '1rem' }} />}
              label="Water"
              status={waterStatus}
              value={water.drinkable ? 'Tap safe' : 'Bottled only'}
            />
          )}

          {/* Currency */}
          {currency && (
            <StatusPill
              icon={<CurrencyExchangeIcon sx={{ fontSize: '1rem' }} />}
              label="Currency"
              status={currency.needsExchange ? 'warn' : 'ok'}
              value={currency.needsExchange ? `${currency.originCurrency} → ${currency.destinationCurrency}` : `${currency.destinationCurrency} ✓`}
            />
          )}

          {/* Electrical */}
          {electrical && (
            <StatusPill
              icon={<PowerIcon sx={{ fontSize: '1rem' }} />}
              label="Adapter"
              status={electrical.needsAdapter ? 'warn' : 'ok'}
              value={electrical.needsAdapter ? `${electrical.originPlug} → ${electrical.destinationPlug}` : 'No adapter'}
            />
          )}

          {/* Timezone */}
          <StatusPill
            icon={<AccessTimeIcon sx={{ fontSize: '1rem' }} />}
            label="Timezone"
            status={tzStatus}
            value={timezone.absDifference === 0 ? 'Same' : `${timezone.absDifference > 0 ? '+' : ''}${timezone.hoursDifference}h`}
          />

          {/* Driving */}
          {driving && (
            <StatusPill
              icon={<DirectionsCarIcon sx={{ fontSize: '1rem' }} />}
              label="Driving"
              status={driving.sameAshome ? 'ok' : 'warn'}
              value={driving.sameAshome ? `${driving.destinationSide} ✓` : `${driving.destinationSide} side`}
            />
          )}

          {/* Tipping */}
          {tipping && (
            <StatusPill
              icon={<RestaurantIcon sx={{ fontSize: '1rem' }} />}
              label="Tipping"
              status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' :
                      tipping.culture === 'offensive' || tipping.culture === 'not expected' ? 'ok' : 'neutral'}
              value={tipping.culture.charAt(0).toUpperCase() + tipping.culture.slice(1)}
            />
          )}

          {/* Emergency */}
          <StatusPill
            icon={<LocalHospitalIcon sx={{ fontSize: '1rem' }} />}
            label="Emergency"
            status="info"
            value={emergency.number}
          />
        </Box>
      </Box>

      <Divider />

      {/* ── VISA section ── */}
      {visa && (
        <Box>
          <SectionHeading icon={<ArticleIcon sx={{ fontSize: '1rem' }} />}>
            Visa Requirements
          </SectionHeading>

          {!visa.available ? (
            <Alert severity="info" sx={{ py: 0.75 }}>
              <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{visa.message}</Typography>
            </Alert>
          ) : !visa.required ? (
            <Paper elevation={0} sx={{
              p: 2, border: '1px solid', borderColor: 'rgba(46,125,50,0.3)',
              backgroundColor: 'rgba(46,125,50,0.05)',
              display: 'flex', alignItems: 'flex-start', gap: 1.5,
            }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1.2rem', mt: 0.1, flexShrink: 0 }} />
              <Box>
                <Typography fontWeight={800} sx={{ fontSize: '0.95rem', mb: 0.3 }}>No visa required</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  Stay up to {visa.maxStay}
                </Typography>
                {visa.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mt: 0.75, lineHeight: 1.4 }}>
                    {visa.notes}
                  </Typography>
                )}
              </Box>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{
              p: 2, border: '1px solid', borderColor: 'rgba(237,108,2,0.3)',
              backgroundColor: 'rgba(237,108,2,0.04)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <WarningAmberIcon sx={{ color: 'warning.main', fontSize: '1.1rem', flexShrink: 0 }} />
                <Typography fontWeight={800} sx={{ fontSize: '0.95rem' }}>{visa.typeLabel}</Typography>
                {visa.name && (
                  <Chip label={visa.name} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {visa.cost && (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', minWidth: 90, fontWeight: 700, textTransform: 'uppercase' }}>Cost</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{visa.cost}</Typography>
                  </Box>
                )}
                {visa.processingTime && (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', minWidth: 90, fontWeight: 700, textTransform: 'uppercase' }}>Processing</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{visa.processingTime}</Typography>
                  </Box>
                )}
                {visa.maxStay && (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', minWidth: 90, fontWeight: 700, textTransform: 'uppercase' }}>Max stay</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{visa.maxStay}</Typography>
                  </Box>
                )}
              </Box>

              {visa.notes && (
                <Typography variant="body2" color="text.secondary"
                  sx={{ fontSize: '0.82rem', mt: 1.25, pt: 1.25, borderTop: '1px solid', borderColor: 'divider', lineHeight: 1.4 }}>
                  {visa.notes}
                </Typography>
              )}

              {visa.applyUrl && (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon sx={{ fontSize: '0.85rem !important' }} />}
                  href={visa.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 1.5, fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Apply online
                </Button>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* ── On the ground — tipping, water, payment, cultural ── */}
      <Box>
        <SectionHeading icon={<InfoOutlinedIcon sx={{ fontSize: '1rem' }} />}>
          On the Ground
        </SectionHeading>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>

          {/* Tipping */}
          {tipping && (
            <DetailCard
              icon={<RestaurantIcon sx={{ fontSize: '1rem' }} />}
              title="Tipping"
              status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' :
                      tipping.culture === 'offensive' ? 'error' :
                      tipping.culture === 'not expected' ? 'ok' : 'info'}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {[
                  { label: 'Restaurants', value: tipping.restaurants },
                  { label: 'Taxis',       value: tipping.taxis },
                  { label: 'Hotels',      value: tipping.hotels },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', minWidth: 80, flexShrink: 0 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{value}</Typography>
                  </Box>
                ))}
                {tipping.notes && (
                  <Typography variant="body2" color="text.secondary"
                    sx={{ fontSize: '0.82rem', mt: 0.5, pt: 0.75, borderTop: '1px solid', borderColor: 'divider', lineHeight: 1.4 }}>
                    {tipping.notes}
                  </Typography>
                )}
              </Box>
            </DetailCard>
          )}

          {/* Water */}
          {water && (
            <DetailCard
              icon={<WaterDropIcon sx={{ fontSize: '1rem' }} />}
              title="Drinking Water"
              status={water.drinkable ? 'ok' : 'warn'}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                {water.notes}
              </Typography>
            </DetailCard>
          )}

          {/* Payment */}
          {payment && (
            <DetailCard
              icon={<PaymentsIcon sx={{ fontSize: '1rem' }} />}
              title="Payments"
              status="info"
            >
              <Box sx={{ display: 'flex', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                <Chip
                  label={payment.cashCulture.charAt(0).toUpperCase() + payment.cashCulture.slice(1).replace('-', ' ')}
                  size="small"
                  sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                />
                {payment.contactless && (
                  <Chip
                    label="Contactless accepted"
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                {payment.notes}
              </Typography>
            </DetailCard>
          )}

          {/* Cultural */}
          {cultural && (
            <DetailCard
              icon={<CheckroomIcon sx={{ fontSize: '1rem' }} />}
              title="Cultural Notes"
              status="info"
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', minWidth: 80, flexShrink: 0 }}>
                  Dress code
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                  {cultural.dressCode}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                {cultural.notes}
              </Typography>
            </DetailCard>
          )}

        </Box>
      </Box>

      {/* ── Timezone detail with live clocks ── */}
      <TimezoneCard timezone={timezone} />

      {/* ── Electrical detail ── */}
      {electrical?.needsAdapter && (
        <Box>
          <SectionHeading icon={<PowerIcon sx={{ fontSize: '1rem' }} />}>
            Electrical Adapter
          </SectionHeading>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'rgba(237,108,2,0.3)', backgroundColor: 'rgba(237,108,2,0.04)' }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', mb: 0.5 }}>{electrical.message}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.25 }}>
              {electrical.originPlug.split('/').map(type => (
                <Box key={type} sx={{ textAlign: 'center' }}>
                  <img src={`/plugs/${type}.svg`} alt={`Plug type ${type}`} width={56} height={56} style={{ display: 'block' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>Home · {type}</Typography>
                </Box>
              ))}
              <Typography variant="body2" color="text.disabled">→</Typography>
              {electrical.destinationPlug.split('/').map(type => (
                <Box key={type} sx={{ textAlign: 'center' }}>
                  <img src={`/plugs/${type}.svg`} alt={`Plug type ${type}`} width={56} height={56} style={{ display: 'block' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>There · {type}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* ── Emergency ── */}
      <Box>
        <SectionHeading icon={<LocalHospitalIcon sx={{ fontSize: '1rem' }} />}>
          Emergency Number
        </SectionHeading>
        <Paper elevation={0} sx={{
          p: 2, border: '1px solid', borderColor: 'divider',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Typography fontWeight={900} sx={{ fontSize: '2rem', color: 'error.main', lineHeight: 1 }}>
            {emergency.number}
          </Typography>
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
              {emergency.country}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              color="error"
              href={`tel:${emergency.number}`}
              sx={{ mt: 0.5, fontSize: '0.75rem', fontWeight: 700, py: 0.25 }}
            >
              Call {emergency.number}
            </Button>
          </Box>
        </Paper>
      </Box>

      <Divider />

      {/* ── LANGUAGE — main working section ── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TranslateIcon sx={{ fontSize: '1rem', color: '#55702C' }} />
            <Typography variant="subtitle2" fontWeight={800}
              sx={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              Language
            </Typography>
            {language.destinationLanguageLocal && (
              <Chip size="small" label={language.destinationLanguageLocal}
                variant="outlined" sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }} />
            )}
          </Box>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
            {language.destinationLanguage}
          </Typography>
        </Box>

        {language.sameLanguage ? (
          <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ py: 0.75 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{language.message}</Typography>
          </Alert>
        ) : language.phrasesAvailable ? (
          <Box>
            {/* Category filter chips */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              {PHRASE_CATEGORIES.map((cat, i) => (
                <Chip
                  key={cat.label}
                  label={cat.label}
                  size="small"
                  onClick={() => setActiveCategory(i)}
                  sx={{
                    height: 28,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeCategory === i ? '#55702C' : 'transparent',
                    color: activeCategory === i ? '#fff' : 'text.secondary',
                    border: '1px solid',
                    borderColor: activeCategory === i ? '#55702C' : 'divider',
                    '&:hover': { backgroundColor: activeCategory === i ? '#3d5218' : 'action.hover' },
                  }}
                />
              ))}
            </Box>

            {/* Phrase grid */}
            <Grid container spacing={1.25}>
              {displayedPhrases.length === 0 ? (
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    No phrases in this category.
                  </Typography>
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
          <Alert severity="info" sx={{ py: 0.75 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              {language.destinationLanguage} spoken. No phrase guide available for this destination yet.
            </Typography>
          </Alert>
        )}
      </Box>

    </Box>
  );
}