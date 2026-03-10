'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress, Divider } from '@mui/material';
import BadgeIcon            from '@mui/icons-material/Badge';
import WaterDropIcon        from '@mui/icons-material/WaterDrop';
import ArticleIcon          from '@mui/icons-material/Article';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import PowerIcon            from '@mui/icons-material/Power';
import AccessTimeIcon       from '@mui/icons-material/AccessTime';
import DirectionsCarIcon    from '@mui/icons-material/DirectionsCar';
import RestaurantIcon       from '@mui/icons-material/Restaurant';
import LocalHospitalIcon    from '@mui/icons-material/LocalHospital';
import type { Intelligence } from './Intelligence.types';
import { D } from './Intelligence.shared';
import Discoversection from './Discoversection';
import Needtoknow      from './Needtoknow';
import Languagesection from './Languagesection';

// ─── Anchored status pill ─────────────────────────────────────────────────────
// Each pill is a link that scrolls to its specific sub-section

function Pill({
  icon, label, value, status, href,
}: {
  icon:    React.ReactNode;
  label:   string;
  value?:  string;
  status:  'ok' | 'warn' | 'error' | 'info' | 'neutral';
  href:    string;
}) {
  const c = {
    ok:      { bg: 'rgba(46,125,50,0.07)',  border: 'rgba(46,125,50,0.2)',  icon: '#4caf50', text: '#2e7d32'  },
    warn:    { bg: 'rgba(196,113,74,0.08)', border: 'rgba(196,113,74,0.3)', icon: D.terra,   text: D.terra    },
    error:   { bg: 'rgba(211,47,47,0.07)',  border: 'rgba(211,47,47,0.25)', icon: '#d32f2f', text: '#b71c1c'  },
    info:    { bg: 'rgba(107,124,92,0.07)', border: 'rgba(107,124,92,0.2)', icon: D.green,   text: D.green    },
    neutral: { bg: 'rgba(29,38,66,0.03)',   border: D.rule,                 icon: D.muted,   text: D.navy     },
  }[status];

  return (
    <Box
      component="a"
      href={href}
      sx={{
        flexShrink: 0,
        px: 1.5, py: 1.25,
        border: '1px solid', borderColor: c.border,
        backgroundColor: c.bg,
        borderRadius: 1,
        display: 'flex', flexDirection: 'column', gap: 0.4,
        textDecoration: 'none',
        cursor: 'pointer',
        minWidth: 120,
        transition: 'filter 0.15s',
        '&:hover': { filter: 'brightness(0.96)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box sx={{ color: c.icon, display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: D.muted, lineHeight: 1,
        }}>
          {label}
        </Typography>
      </Box>
      {value && (
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: c.text, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}

// ─── Anchor nav ───────────────────────────────────────────────────────────────

function AnchorNav() {
  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 10,
      backgroundColor: D.bg,
      borderBottom: `1px solid ${D.rule}`,
      display: 'flex',
      mx: { xs: -2, sm: -3 },
      px: { xs: 2, sm: 3 },
      mb: 4,
    }}>
      {[
        { label: 'Discover',     href: '#discover'     },
        { label: 'Need to Know', href: '#need-to-know' },
        { label: 'Language',     href: '#language'     },
      ].map(({ label, href }) => (
        <Box
          key={href}
          component="a"
          href={href}
          sx={{
            px: 1.5, py: 1.25,
            fontSize: '0.78rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: D.muted, textDecoration: 'none',
            borderBottom: '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
            '&:hover': { color: D.navy, borderBottomColor: D.terra },
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props { tripId: string; }

export default function IntelligenceTab({ tripId }: Props) {
  const [intel,   setIntel]   = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/intelligence`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setIntel(d.intelligence); setLoading(false); })
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

  const { electrical, currency, language, timezone, emergency, driving, passport, visa, tipping, water, payment, cultural } = intel;

  const passportStatus: 'ok' | 'warn' | 'error' =
    !passport ? 'neutral' as any : passport.isExpired ? 'error' : passport.isWarning ? 'warn' : 'ok';

  const visaStatus: 'ok' | 'warn' | 'error' | 'info' =
    !visa?.available ? 'info' : !visa.required ? 'ok' : visa.type === 'visa' ? 'warn' : 'info';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── City ── */}
      <Box>
        <Typography sx={{
          fontFamily: D.display,
          fontSize: { xs: '2rem', sm: '2.5rem' },
          color: D.navy, lineHeight: 1, letterSpacing: '-0.03em', mb: 0.5,
        }}>
          {intel.destination.city ?? intel.destination.country}
        </Typography>
        {intel.destination.city && (
          <Typography sx={{ fontSize: '1rem', color: D.muted, fontWeight: 500 }}>
            {intel.destination.country}
          </Typography>
        )}
      </Box>

      {/* ── Critical alerts ── */}
      {passport?.isExpired && (
        <Alert severity="error" icon={<BadgeIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Your passport has expired</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {passport?.isWarning && !passport.isExpired && (
        <Alert severity="warning" icon={<BadgeIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Your passport expires soon</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{passport.message}</Typography>
        </Alert>
      )}
      {water && !water.drinkable && (
        <Alert severity="warning" icon={<WaterDropIcon fontSize="small" />}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>Do not drink tap water</Typography>
          <Typography sx={{ fontSize: '0.95rem' }}>{water.notes}</Typography>
        </Alert>
      )}

      {/* ── Status strip — single scrolling row, no orphans, each pill anchors to its section ── */}
      <Box sx={{
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        mx: { xs: -2, sm: -3 },
        px: { xs: 2, sm: 3 },
        pb: 0.5,
        // hide scrollbar visually but keep functional
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {visa && (
          <Pill icon={<ArticleIcon sx={{ fontSize: '1rem' }} />} label="Visa" status={visaStatus}
            value={visa.required === false ? `Free · ${visa.maxStay}` : visa.typeLabel}
            href={visa.required ? '#ntk-visa' : '#need-to-know'} />
        )}
        {passport && (
          <Pill icon={<BadgeIcon sx={{ fontSize: '1rem' }} />} label="Your passport" status={passportStatus}
            value={passport.isExpired ? 'EXPIRED' : passport.isWarning ? `${passport.daysAtTravel}d left` : 'Valid'}
            href="#need-to-know" />
        )}
        {water && (
          <Pill icon={<WaterDropIcon sx={{ fontSize: '1rem' }} />} label="Water"
            status={water.drinkable ? 'ok' : 'warn'}
            value={water.drinkable ? 'Tap safe' : 'Bottled only'}
            href="#need-to-know" />
        )}
        {currency && (
          <Pill icon={<CurrencyExchangeIcon sx={{ fontSize: '1rem' }} />} label="Currency"
            status={currency.needsExchange ? 'warn' : 'ok'}
            value={currency.needsExchange
              ? `${currency.originCurrency} → ${currency.destinationCurrency}`
              : `${currency.destinationCurrency} ✓`}
            href="#need-to-know" />
        )}
        {electrical && (
          <Pill icon={<PowerIcon sx={{ fontSize: '1rem' }} />} label="Adapter"
            status={electrical.needsAdapter ? 'warn' : 'ok'}
            value={electrical.needsAdapter ? `${electrical.originPlug} → ${electrical.destinationPlug}` : 'No adapter'}
            href={electrical.needsAdapter ? '#ntk-adapter' : '#need-to-know'} />
        )}
        <Pill icon={<AccessTimeIcon sx={{ fontSize: '1rem' }} />} label="Timezone"
          status={timezone.jetlagRisk === 'none' ? 'ok' : timezone.jetlagRisk === 'significant' ? 'error' : 'warn'}
          value={timezone.absDifference === 0 ? 'Same' : `${timezone.hoursDifference > 0 ? '+' : ''}${timezone.hoursDifference}h`}
          href="#ntk-timezone" />
        {driving && (
          <Pill icon={<DirectionsCarIcon sx={{ fontSize: '1rem' }} />} label="Driving"
            status={driving.sameAshome ? 'ok' : 'warn'}
            value={driving.sameAshome ? `${driving.destinationSide} ✓` : `${driving.destinationSide} side`}
            href="#need-to-know" />
        )}
        {tipping && (
          <Pill icon={<RestaurantIcon sx={{ fontSize: '1rem' }} />} label="Tipping"
            status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' :
                    tipping.culture === 'offensive' || tipping.culture === 'not expected' ? 'ok' : 'neutral'}
            value={tipping.culture.charAt(0).toUpperCase() + tipping.culture.slice(1)}
            href="#ntk-tipping" />
        )}
        <Pill icon={<LocalHospitalIcon sx={{ fontSize: '1rem' }} />} label="Emergency"
          status="info" value={emergency.number}
          href="#ntk-emergency" />
      </Box>

      {/* ── Anchor nav ── */}
      <AnchorNav />

      {/* ── Sections ── */}
      <Discoversection tripId={tripId} />

      <Divider sx={{ borderColor: D.rule }} />

      <Needtoknow
        visa={visa} tipping={tipping} water={water}
        payment={payment} cultural={cultural} timezone={timezone}
        electrical={electrical} emergency={emergency}
      />

      <Divider sx={{ borderColor: D.rule }} />

      <Languagesection language={language} />
    </Box>
  );
}