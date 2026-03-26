'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import GoogleIcon from '@mui/icons-material/Google';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import LuggageOutlinedIcon from '@mui/icons-material/LuggageOutlined';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import WifiOffIcon from '@mui/icons-material/WifiOff';

const D = {
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

const FEATURES = [
  { icon: RouteOutlinedIcon,          title: 'Plan from idea to arrival',          body: 'Build trips with multiple destinations, each with their own timing and purpose. Move through stages as plans develop. Nothing gets lost along the way.' },
  { icon: CalendarTodayOutlinedIcon,  title: 'Your itinerary, your way',           body: 'Construct each day as it actually unfolds. Build manually or let AI draft a starting point. Add movement, pauses, and commitments. Adjust without breaking the structure.' },
  { icon: LuggageOutlinedIcon,        title: 'Packing lists that think ahead',     body: 'Generated from your trip length, transport, accommodation, and type. Items scale with time — three shirts, not just shirts. Flag what to do before you leave. Regenerate as plans change.' },
  { icon: FlightOutlinedIcon,         title: 'Logistics in one place',             body: 'Flights, trains, ferries, cars, accommodation, venues. Each piece sits in context, connected to the rest of the trip. Pre-departure steps and arrival details accounted for.' },
  { icon: FolderOutlinedIcon,         title: 'Everything attached, nothing loose', body: 'Documents, links, booking references, contacts, notes, and tasks — connected directly to the part of the trip they belong to. Not sitting in a folder somewhere.' },
  { icon: PublicOutlinedIcon,         title: 'Know before you go',                 body: 'Visa requirements, currency, time zones, electrical systems, language essentials, emergency numbers, local context. Surfaced without searching.' },
  { icon: WbSunnyOutlinedIcon,        title: 'Weather, in perspective',            body: 'Forecasts when they matter, climate normals when you are planning further ahead. Always in relation to where you are starting from.' },
  { icon: TuneOutlinedIcon,           title: 'Built around how you travel',        body: 'Your home city, passport, unit preferences, and navigation app per transport mode inform every trip. Every "navigate" link opens exactly where you want it.' },
  { icon: GroupOutlinedIcon,          title: 'Travel with others',                 body: 'Trips can be shared. Roles are clear. Edits are controlled. Everyone works from the same version.' },
  { icon: NotificationsOutlinedIcon,  title: "Notifications that aren't noise",    body: 'Alerts for flights, check-ins, itinerary stops, and todos — with adjustable lead times per item. Duplication removed.' },
  { icon: WifiOffIcon,                title: 'Works offline',                      body: 'Trip data cached to your device. Accessible anywhere, regardless of signal.' },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function FeatureRow({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const { ref, inView } = useInView(0.1);
  const Icon = feature.icon;
  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        gap: 3,
        alignItems: 'flex-start',
        py: 3.5,
        borderBottom: `1px solid ${D.rule}`,
        '&:last-child': { borderBottom: 'none' },
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.55s ease ${index * 55}ms, transform 0.55s ease ${index * 55}ms`,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          backgroundColor: alpha(D.green, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <Icon sx={{ fontSize: 18, color: D.green }} />
      </Box>
      <Box>
        <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', letterSpacing: '-0.01em', color: D.navy, mb: 0.75, lineHeight: 1.2 }}>
          {feature.title}
        </Typography>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', lineHeight: 1.7, color: D.muted }}>
          {feature.body}
        </Typography>
      </Box>
    </Box>
  );
}

function GoogleButton({ label }: { label: string }) {
  return (
    <Button
      variant="contained"
      size="large"
      startIcon={<GoogleIcon />}
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      sx={{
        backgroundColor: D.navy,
        color: '#fff',
        fontFamily: D.body,
        fontWeight: 700,
        fontSize: '0.9rem',
        px: 4,
        py: 1.5,
        borderRadius: 2,
        textTransform: 'none',
        '&:hover': { backgroundColor: alpha(D.navy, 0.85) },
      }}
    >
      {label}
    </Button>
  );
}

export default function Home() {
  const [active, setActive] = useState(0);
  const heroRef    = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const ctaRef     = useRef<HTMLDivElement>(null);
  const sections   = [heroRef, featuresRef, ctaRef];

  useEffect(() => {
    const observers = sections.map((ref, i) => {
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActive(i); },
        { threshold: 0.35 }
      );
      if (ref.current) obs.observe(ref.current);
      return obs;
    });
    return () => observers.forEach(o => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Box sx={{ backgroundColor: D.bg }}>

      {/* ── Nav dots ─────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          right: { xs: 16, sm: 28 },
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          zIndex: 100,
        }}
      >
        {sections.map((ref, i) => (
          <Box
            key={i}
            onClick={() => scrollTo(ref)}
            sx={{
              width: active === i ? 8 : 6,
              height: active === i ? 8 : 6,
              borderRadius: '50%',
              backgroundColor: active === i ? D.terra : alpha(D.navy, 0.22),
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': { backgroundColor: active === i ? D.terra : alpha(D.navy, 0.45) },
            }}
          />
        ))}
      </Box>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Box
        ref={heroRef}
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 4 },
          pt: { xs: 6, sm: 8 },
          pb: 0,
          textAlign: 'center',
          background: `linear-gradient(to bottom, ${D.bg} 70%, ${D.paper} 100%)`,
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <Image src="/logomark.png" alt="Tabiji" width={48} height={48} style={{ objectFit: 'contain' }} />
        </Box>

        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '3.2rem', sm: '5rem', md: '6.5rem' },
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            color: D.navy,
            mb: 1.5,
          }}
        >
          Tabiji
        </Typography>

        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.72rem',
            letterSpacing: '0.3em',
            color: D.muted,
            textTransform: 'uppercase',
            mb: 3,
          }}
        >
          旅路
        </Typography>

        <Box sx={{ width: 44, height: 3, backgroundColor: D.terra, borderRadius: 2, mb: 4 }} />

        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.6rem' },
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: D.navy,
            maxWidth: 600,
            mb: 2.5,
          }}
        >
          A system for journeys,<br />not just plans.
        </Typography>

        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: { xs: '0.9rem', sm: '1rem' },
            lineHeight: 1.75,
            color: D.muted,
            maxWidth: 480,
            mb: 2.5,
          }}
        >
          Tabiji holds the entire shape of a trip — where you are going, how you
          are moving, what you need, and everything that sits around it. Built
          from the perspective of someone who travels with intent.
        </Typography>

        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '1rem', sm: '1.1rem' },
            letterSpacing: '-0.01em',
            color: D.terra,
            mb: 4,
          }}
        >
          One trip, fully understood.
        </Typography>

        <GoogleButton label="Sign in with Google" />

        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, mt: 2 }}>
          Your trips stay private. No feeds, no followers.
        </Typography>

        {/* Visual bridge — draws the eye downward */}
        <Box
          onClick={() => scrollTo(featuresRef)}
          sx={{
            mt: 'auto',
            pt: 6,
            pb: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            opacity: 0.6,
            '&:hover': { opacity: 1 },
            transition: 'opacity 0.2s ease',
          }}
        >
          <Typography
            sx={{
              fontFamily: D.body,
              fontSize: '0.65rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: D.navy,
              fontWeight: 700,
            }}
          >
            What Tabiji does
          </Typography>
          {/* Animated tick-down line */}
          <Box
            sx={{
              width: 1,
              height: 32,
              borderLeft: `1.5px solid ${alpha(D.navy, 0.35)}`,
              '@keyframes grow': {
                '0%':   { height: 0, opacity: 0 },
                '50%':  { opacity: 1 },
                '100%': { height: 32, opacity: 0.6 },
              },
              animation: 'grow 1.8s ease-in-out infinite',
            }}
          />
        </Box>
      </Box>

      {/* ── Features — scrollytelling ─────────────────────────────── */}
      <Box
        ref={featuresRef}
        sx={{
          backgroundColor: D.paper,
          borderTop: `1.5px solid ${D.rule}`,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'flex-start',
            }}
          >
            {/* Sticky left panel */}
            <Box
              sx={{
                width: { xs: '100%', md: '36%' },
                position: { md: 'sticky' },
                top: 0,
                height: { md: '100vh' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: { md: 'center' },
                py: { xs: 8, md: 0 },
                pr: { md: 8 },
                borderBottom: { xs: `1.5px solid ${D.rule}`, md: 'none' },
                borderRight: { md: `1.5px solid ${D.rule}` },
              }}
            >
              <Typography
                sx={{
                  fontFamily: D.body,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: D.muted,
                  mb: 2.5,
                }}
              >
                What Tabiji does
              </Typography>
              <Typography
                sx={{
                  fontFamily: D.display,
                  fontSize: { xs: '1.8rem', md: '2rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: D.navy,
                  mb: 3,
                }}
              >
                Trips are not just destinations.
              </Typography>
              <Typography
                sx={{
                  fontFamily: D.body,
                  fontSize: '0.88rem',
                  lineHeight: 1.75,
                  color: D.muted,
                  mb: 4,
                }}
              >
                They are timelines, dependencies, and decisions. Tabiji connects
                planning, logistics, documents, and context into a single
                continuous view — from first idea to return home. Nothing is
                overwritten. Nothing disappears.
              </Typography>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <GoogleButton label="Get started" />
              </Box>
            </Box>

            {/* Scrolling feature list */}
            <Box sx={{ flex: 1, pl: { md: 6 }, py: { xs: 4, md: 6 } }}>
              {FEATURES.map((f, i) => (
                <FeatureRow key={f.title} feature={f} index={i} />
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <Box
        ref={ctaRef}
        sx={{
          minHeight: '100vh',
          backgroundColor: D.bg,
          borderTop: `1.5px solid ${D.rule}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 4 },
          textAlign: 'center',
          gap: 3,
        }}
      >
        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: D.muted,
          }}
        >
          Early access
        </Typography>
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '2.4rem', sm: '3.2rem', md: '4rem' },
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: D.navy,
          }}
        >
          Start planning.
        </Typography>
        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.9rem',
            color: D.muted,
            maxWidth: 300,
            lineHeight: 1.65,
          }}
        >
          Tabiji is free to use during early access.
        </Typography>
        <GoogleButton label="Continue with Google" />
        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted }}>
          Your trips stay private. No feeds, no followers.
        </Typography>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Box
        sx={{
          borderTop: `1.5px solid ${D.rule}`,
          py: 5,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Image
          src="/logomark.png"
          alt="Tabiji"
          width={26}
          height={26}
          style={{ objectFit: 'contain', opacity: 0.45 }}
        />
        <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', letterSpacing: '-0.01em', color: D.navy }}>
          Travel, held together.
        </Typography>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.7rem', letterSpacing: '0.12em', color: D.muted, textTransform: 'uppercase' }}>
          Tabiji (旅路) — journey, travel path.
        </Typography>
      </Box>

    </Box>
  );
}
