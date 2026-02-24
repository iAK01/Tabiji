'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Divider, Accordion, AccordionSummary, AccordionDetails,
  Tabs, Tab, Grid,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import PowerIcon from '@mui/icons-material/Power';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import TranslateIcon from '@mui/icons-material/Translate';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BadgeIcon from '@mui/icons-material/Badge';

interface Phrase {
  id: string;
  english: string;
  local: string;
  phonetic: string;
  usage: string;
  context: string;
}

interface Intelligence {
  destination: { country: string; countryCode: string; city?: string };
  electrical: {
    needsAdapter: boolean;
    originPlug: string;
    destinationPlug: string;
    adapterType: string | null;
    message: string;
  } | null;
  currency: {
    needsExchange: boolean;
    originCurrency: string;
    destinationCurrency: string;
    destinationSymbol: string;
    message: string;
  } | null;
  language: {
    sameLanguage: boolean;
    destinationLanguage: string;
    destinationLanguageLocal: string | null;
    phrasesAvailable: boolean;
    essentialPhrases: Phrase[];
    allPhrases: Phrase[];
    message: string;
  };
  timezone: {
    destinationTimezone: string;
    hoursDifference: number;
    absDifference: number;
    jetlagRisk: 'none' | 'mild' | 'moderate' | 'significant';
    direction: string;
    message: string;
  };
  emergency: { number: string; country: string; message: string };
  driving: {
    destinationSide: string;
    originSide: string;
    sameAshome: boolean;
    message: string;
  } | null;
  passport: {
    expiry: string;
    daysAtTravel: number;
    isWarning: boolean;
    isExpired: boolean;
    message: string;
  } | null;
}

interface Props { tripId: string; }

// ── Small reusable card ──────────────────────────────────────────────────────
function IntelCard({
  icon, title, message, status, children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  status: 'ok' | 'warn' | 'info' | 'error';
  children?: React.ReactNode;
}) {
  const colors = {
    ok: { border: 'success.main', bg: 'rgba(46,125,50,0.06)', icon: 'success.main' },
    warn: { border: 'warning.main', bg: 'rgba(237,108,2,0.06)', icon: 'warning.main' },
    info: { border: 'primary.main', bg: 'rgba(85,112,44,0.06)', icon: 'primary.main' },
    error: { border: 'error.main', bg: 'rgba(211,47,47,0.06)', icon: 'error.main' },
  };
  const c = colors[status];

  return (
    <Paper sx={{
      p: 2.5, backgroundColor: 'background.paper',
      borderLeft: `4px solid`, borderLeftColor: c.border,
      background: c.bg,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ color: c.icon, mt: 0.2, flexShrink: 0 }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.3 }}>{message}</Typography>
          {children}
        </Box>
      </Box>
    </Paper>
  );
}

// ── Phrase card ──────────────────────────────────────────────────────────────
function PhraseCard({ phrase }: { phrase: Phrase }) {
  return (
    <Paper sx={{ p: 2, backgroundColor: 'background.paper' }}>
      <Typography variant="caption" color="text.secondary" display="block">{phrase.english}</Typography>
      <Typography variant="body1" fontWeight={700} sx={{ my: 0.3 }}>{phrase.local}</Typography>
      <Typography variant="body2" color="primary.main" fontStyle="italic">{phrase.phonetic}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        💡 {phrase.context}
      </Typography>
    </Paper>
  );
}

export default function IntelligenceTab({ tripId }: Props) {
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phraseTab, setPhraseTab] = useState(0);

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

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

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

  const { electrical, currency, language, timezone, emergency, driving, passport } = intel;

  const jetlagColor: Record<string, 'ok' | 'warn' | 'info' | 'error'> = {
    none: 'ok', mild: 'info', moderate: 'warn', significant: 'error',
  };

  // Split phrases into categories for tabs
  const phraseSections = [
    { label: 'Essential', ids: ['hello', 'thank_you', 'excuse_me', 'speak_english', 'help'] },
    { label: 'Navigation', ids: ['where_is', 'excuse_me'] },
    { label: 'Eating out', ids: ['check_please', 'how_much', 'thank_you'] },
    { label: 'Shopping', ids: ['how_much', 'thank_you', 'excuse_me'] },
    { label: 'All', ids: null },
  ];

  const currentSection = phraseSections[phraseTab];
  const displayedPhrases = currentSection.ids === null
    ? language.allPhrases
    : language.allPhrases.filter(p => currentSection.ids!.includes(p.id));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Travel Context
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intel.destination.city ? `${intel.destination.city}, ` : ''}{intel.destination.country}
        </Typography>
      </Box>

      {/* Passport warning — always top if present */}
      {passport && (passport.isWarning || passport.isExpired) && (
        <IntelCard
          icon={<BadgeIcon />}
          title="Passport"
          message={passport.message}
          status={passport.isExpired ? 'error' : 'warn'}
        />
      )}

      {/* Electrical */}
      {electrical && (
        <IntelCard
          icon={<PowerIcon />}
          title="Electrical adapter"
          message={electrical.message}
          status={electrical.needsAdapter ? 'warn' : 'ok'}
        >
          {electrical.needsAdapter && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              <Chip size="small" label={`Home: ${electrical.originPlug}`} variant="outlined" />
              <Typography variant="caption">→</Typography>
              <Chip size="small" label={`Dest: ${electrical.destinationPlug}`} color="warning" variant="outlined" />
            </Box>
          )}
        </IntelCard>
      )}

      {/* Currency */}
      {currency && (
        <IntelCard
          icon={<CurrencyExchangeIcon />}
          title="Currency"
          message={currency.message}
          status={currency.needsExchange ? 'warn' : 'ok'}
        >
          {currency.needsExchange && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              <Chip size="small" label={currency.originCurrency} variant="outlined" />
              <Typography variant="caption">→</Typography>
              <Chip size="small" label={`${currency.destinationCurrency} ${currency.destinationSymbol}`} color="primary" variant="outlined" />
            </Box>
          )}
        </IntelCard>
      )}

      {/* Timezone */}
      <IntelCard
        icon={<AccessTimeIcon />}
        title="Timezone"
        message={timezone.message}
        status={jetlagColor[timezone.jetlagRisk]}
      >
        {timezone.absDifference > 0 && (
          <Box sx={{ mt: 1 }}>
            <Chip
              size="small"
              label={`Jet lag risk: ${timezone.jetlagRisk}`}
              color={timezone.jetlagRisk === 'none' ? 'success' : timezone.jetlagRisk === 'mild' ? 'info' : timezone.jetlagRisk === 'moderate' ? 'warning' : 'error'}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {timezone.destinationTimezone}
            </Typography>
          </Box>
        )}
      </IntelCard>

      {/* Emergency number */}
      <IntelCard
        icon={<LocalHospitalIcon />}
        title="Emergency number"
        message={emergency.message}
        status="info"
      >
        <Box sx={{ mt: 1 }}>
          <Typography variant="h5" fontWeight={800} color="error.main">{emergency.number}</Typography>
        </Box>
      </IntelCard>

      {/* Driving side */}
      {driving && (
        <IntelCard
          icon={<DirectionsCarIcon />}
          title="Driving"
          message={driving.message}
          status={driving.sameAshome ? 'ok' : 'warn'}
        />
      )}

      {/* Passport — ok state */}
      {passport && !passport.isWarning && (
        <IntelCard
          icon={<BadgeIcon />}
          title="Passport"
          message={passport.message}
          status="ok"
        />
      )}

      <Divider sx={{ my: 1 }} />

      {/* Language section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TranslateIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Language</Typography>
          {language.destinationLanguageLocal && (
            <Chip size="small" label={language.destinationLanguageLocal} variant="outlined" />
          )}
        </Box>

        {language.sameLanguage ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            {language.message}
          </Alert>
        ) : language.phrasesAvailable ? (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              {language.destinationLanguage} spoken — {language.allPhrases.length} essential phrases below
            </Alert>

            {/* Phrase category tabs */}
            <Tabs
              value={phraseTab}
              onChange={(_, v) => setPhraseTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2 }}
            >
              {phraseSections.map((s, i) => (
                <Tab key={s.label} label={s.label} value={i} />
              ))}
            </Tabs>

            <Grid container spacing={1.5}>
              {displayedPhrases.map(phrase => (
                <Grid size={{ xs: 12, sm: 6 }} key={phrase.id}>
                  <PhraseCard phrase={phrase} />
                </Grid>
              ))}
              {displayedPhrases.length === 0 && (
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary">No phrases in this category.</Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Alert severity="info">
            {language.destinationLanguage} spoken. No phrase guide available yet for this destination.
          </Alert>
        )}
      </Box>

    </Box>
  );
}