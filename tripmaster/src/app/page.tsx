'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
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

type Feature = { icon: React.ElementType; title: string; body: string };

const FEATURE_GROUPS: { label: string; screen: string; features: Feature[] }[] = [
  {
    label: 'Planning',
    screen: '/screens/tabs/itinerarytab.png',
    features: [
      { icon: RouteOutlinedIcon,        title: 'Plan from idea to arrival',      body: 'Build trips with multiple destinations, each with their own timing and purpose. Move through stages as plans develop.' },
      { icon: CalendarTodayOutlinedIcon, title: 'Your itinerary, your way',      body: 'Construct each day as it actually unfolds. Build manually or let AI draft a starting point. Add movement, pauses, and commitments. Adjust without breaking the structure.' },
      { icon: LuggageOutlinedIcon,      title: 'Packing lists that think ahead', body: 'Generated from your trip length, transport, accommodation, and type. Items scale with time — three shirts, not just shirts. Flag what to do before you leave. Regenerate as plans change.' },
      { icon: GroupOutlinedIcon,        title: 'Travel with others',             body: 'Trips can be shared. Roles are clear. Everyone works from the same version.' },
    ],
  },
  {
    label: 'Logistics',
    screen: '/screens/tabs/logisticstab.png',
    features: [
      { icon: FlightOutlinedIcon,        title: 'Logistics in one place',             body: 'Flights, trains, ferries, cars, accommodation, venues. Each piece sits in context, connected to the rest of the trip.' },
      { icon: FolderOutlinedIcon,        title: 'Everything attached, nothing loose', body: 'Documents, links, booking references, contacts, notes, and tasks — connected directly to the part of the trip they belong to. Not sitting in a folder somewhere.' },
      { icon: NotificationsOutlinedIcon, title: "Notifications that aren't noise",    body: 'Alerts for flights, check-ins, itinerary stops, and todos. You set how far ahead you want each one.' },
      { icon: WifiOffIcon,               title: 'Works offline',                      body: 'Your trip lives on your device. No signal needed.' },
    ],
  },
  {
    label: 'Context',
    screen: '/screens/tabs/weathertab.png',
    features: [
      { icon: PublicOutlinedIcon,  title: 'Know before you go',          body: 'Visa requirements, currency, time zones, electrical systems, language essentials, emergency numbers, local context. Surfaced without searching.' },
      { icon: WbSunnyOutlinedIcon, title: 'Weather, in perspective',     body: 'Forecasts when they matter, climate normals when you are planning further ahead. Always in relation to where you are starting from.' },
      { icon: TuneOutlinedIcon,    title: 'Built around how you travel', body: 'Set your home city, passport, and navigation preferences once. Every trip builds from that.' },
    ],
  },
];

// ── Hooks ────────────────────────────────────────────────────────────────────

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

// ── Sub-components ───────────────────────────────────────────────────────────

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const { ref, inView } = useInView(0.1);
  const Icon = feature.icon;
  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        gap: 2.5,
        alignItems: 'flex-start',
        py: 3,
        borderBottom: `1px solid ${D.rule}`,
        '&:last-child': { borderBottom: 'none' },
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.55s ease ${index * 55}ms, transform 0.55s ease ${index * 55}ms`,
      }}
    >
      <Box sx={{ width: 34, height: 34, borderRadius: 1.5, backgroundColor: alpha(D.green, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2 }}>
        <Icon sx={{ fontSize: 17, color: D.green }} />
      </Box>
      <Box>
        <Typography sx={{ fontFamily: D.display, fontSize: '0.92rem', letterSpacing: '-0.01em', color: D.navy, mb: 0.6, lineHeight: 1.2 }}>
          {feature.title}
        </Typography>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.83rem', lineHeight: 1.7, color: D.muted }}>
          {feature.body}
        </Typography>
      </Box>
    </Box>
  );
}

function InterestForm() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Button
        variant="contained"
        component="a"
        href="mailto:kenneth.killeen@gmail.com?subject=Tabiji — I'm interested"
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
        Register your interest
      </Button>
      <Typography
        component="a"
        href="/signin"
        sx={{
          fontFamily: D.body,
          fontSize: '0.75rem',
          color: D.muted,
          textDecoration: 'none',
          borderBottom: `1px solid ${alpha(D.navy, 0.2)}`,
          '&:hover': { color: D.navy },
          transition: 'color 0.2s ease',
        }}
      >
        Already invited? Sign in →
      </Typography>
    </Box>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // Nav dot tracking
  const [active, setActive]           = useState(0);
  const heroRef                        = useRef<HTMLDivElement>(null);
  const featuresRef                    = useRef<HTMLDivElement>(null);
  const ctaRef                         = useRef<HTMLDivElement>(null);
  const navSections                    = [heroRef, featuresRef, ctaRef];

  // Feature group tracking (for sticky screenshot crossfade)
  const [activeGroup, setActiveGroup] = useState(0);
  const groupRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  useEffect(() => {
    const observers = navSections.map((ref, i) => {
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

  useEffect(() => {
    const observers = groupRefs.map((ref, i) => {
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveGroup(i); },
        { threshold: 0.3 }
      );
      if (ref.current) obs.observe(ref.current);
      return obs;
    });
    return () => observers.forEach(o => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [headlineReady, setHeadlineReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeadlineReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Box sx={{ backgroundColor: D.bg }}>

      {/* ── Nav dots ───────────────────────────────────────────────── */}
      <Box sx={{ position: 'fixed', right: { xs: 14, sm: 24 }, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, zIndex: 100 }}>
        {navSections.map((ref, i) => (
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

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <Box
        ref={heroRef}
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: { xs: 3, sm: 4 },
          pt: { xs: 8, sm: 10 },
          pb: 0,
          textAlign: 'center',
        }}
      >
        {/* Wordmark block */}
        <Box sx={{ mb: 2.5 }}>
          <Image src="/logomark.png" alt="Tabiji" width={46} height={46} style={{ objectFit: 'contain' }} />
        </Box>

        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '5rem', sm: '8rem', md: '11rem' }, letterSpacing: '-0.04em', lineHeight: 0.88, color: D.navy, mb: 1.5 }}>
          Tabiji
        </Typography>

        <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', letterSpacing: '0.3em', color: D.muted, textTransform: 'uppercase', mb: 3 }}>
          旅路
        </Typography>

        <Box sx={{ width: 44, height: 3, backgroundColor: D.terra, borderRadius: 2, mb: 3.5 }} />

        <Box sx={{ mb: 2, textAlign: 'center' }}>
          {/* Line 1 */}
          <Typography
            component="div"
            sx={{ fontFamily: D.display, fontSize: { xs: '2rem', sm: '2.8rem', md: '3.8rem' }, letterSpacing: '-0.03em', lineHeight: 1.15, color: D.navy }}
          >
            A system for{' '}
            <Box component="span" sx={{ position: 'relative', display: 'inline-block', color: headlineReady ? D.terra : D.navy, transition: 'color 0.6s ease' }}>
              journeys,
              <Box sx={{ position: 'absolute', bottom: { xs: 1, md: 3 }, left: 0, height: { xs: 2, md: 3 }, borderRadius: 2, backgroundColor: D.terra, width: headlineReady ? '100%' : '0%', transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.15s' }} />
            </Box>
          </Typography>
          {/* Line 2 */}
          <Typography
            component="div"
            sx={{ fontFamily: D.display, fontSize: { xs: '2rem', sm: '2.8rem', md: '3.8rem' }, letterSpacing: '-0.03em', lineHeight: 1.15, color: D.navy }}
          >
            not just plans.
          </Typography>
        </Box>

        <Typography sx={{ fontFamily: D.body, fontSize: { xs: '0.88rem', sm: '0.98rem' }, lineHeight: 1.75, color: D.muted, maxWidth: 460, mb: 2 }}>
          Tabiji holds the entire shape of a trip — where you are going, how you
          are moving, what you need, and everything that sits around it. Built
          from the perspective of someone who travels with intent.
        </Typography>

        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '1.15rem', sm: '1.35rem' }, letterSpacing: '-0.02em', color: D.terra, mb: 3.5 }}>
          One trip, fully understood.
        </Typography>

        <Box sx={{ mt: 1, mb: 1 }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: D.terra, mb: 2.5, textAlign: 'center' }}>
            Private beta — invitation only
          </Typography>
          <InterestForm />
        </Box>

        {/* Product screenshot peek — pulls eye downward */}
        <Box
          sx={{
            mt: 6,
            width: '100%',
            maxWidth: 780,
            position: 'relative',
            borderRadius: '12px 12px 0 0',
            overflow: 'hidden',
            border: `1.5px solid ${D.rule}`,
            borderBottom: 'none',
            boxShadow: `0 -4px 40px ${alpha(D.navy, 0.08)}`,
          }}
        >
          {/* Browser chrome */}
          <Box sx={{ height: 32, backgroundColor: D.navy, display: 'flex', alignItems: 'center', px: 2, gap: 0.75, flexShrink: 0 }}>
            {[D.terra, '#E5A855', D.green].map((c, i) => (
              <Box key={i} sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: c, opacity: 0.75 }} />
            ))}
          </Box>
          <Image
            src="/screens/triplist.png"
            alt="Tabiji trip list"
            width={780}
            height={440}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          {/* Gradient fade — draws eye downward */}
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: `linear-gradient(to bottom, transparent, ${D.bg})`, pointerEvents: 'none' }} />
          {/* Scroll cue inside fade zone */}
          <Box
            onClick={() => scrollTo(featuresRef)}
            sx={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              '@keyframes nudge': {
                '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
                '50%':      { transform: 'translateX(-50%) translateY(5px)' },
              },
              animation: 'nudge 2s ease-in-out infinite',
            }}
          >
            <Typography sx={{ fontFamily: D.body, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: D.navy }}>
              See what's inside
            </Typography>
            <Box sx={{ width: 1, height: 20, borderLeft: `1.5px solid ${alpha(D.navy, 0.3)}` }} />
          </Box>
        </Box>
      </Box>

      {/* ── Features — scrollytelling ──────────────────────────────── */}
      <Box ref={featuresRef} sx={{ backgroundColor: D.paper, borderTop: `1.5px solid ${D.rule}` }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start' }}>

            {/* Sticky left — text + crossfading screenshot */}
            <Box
              sx={{
                width: { xs: '100%', md: '40%' },
                position: { md: 'sticky' },
                top: 0,
                height: { md: '100vh' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: { md: 'center' },
                py: { xs: 8, md: 0 },
                pr: { md: 7 },
                borderBottom: { xs: `1.5px solid ${D.rule}`, md: 'none' },
                borderRight: { md: `1.5px solid ${D.rule}` },
              }}
            >
              <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: D.muted, mb: 2 }}>
                What Tabiji does
              </Typography>
              <Typography sx={{ fontFamily: D.display, fontSize: { xs: '2.2rem', md: '2.8rem' }, letterSpacing: '-0.03em', lineHeight: 1.1, color: D.navy, mb: 2.5 }}>
                Trips are not just destinations.
              </Typography>
              <Typography sx={{ fontFamily: D.body, fontSize: '0.87rem', lineHeight: 1.75, color: D.muted, mb: 3.5 }}>
                They are timelines, dependencies, and decisions. Tabiji holds all of it — from first idea to the journey home.
              </Typography>

              {/* Crossfading screenshots — desktop only */}
              <Box
                sx={{
                  display: { xs: 'none', md: 'block' },
                  position: 'relative',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1.5px solid ${D.rule}`,
                  boxShadow: `0 12px 32px ${alpha(D.navy, 0.1)}`,
                  mb: 3.5,
                  aspectRatio: '16/10',
                }}
              >
                {/* Default — overview */}
                <Box sx={{ position: 'absolute', inset: 0, opacity: 1, transition: 'opacity 0.5s ease' }}>
                  <Image src="/screens/tabs/overviewtab.png" alt="Trip overview" fill style={{ objectFit: 'cover', objectPosition: 'top' }} />
                </Box>
                {/* Group-synced screens */}
                {FEATURE_GROUPS.map((g, i) => (
                  <Box key={g.label} sx={{ position: 'absolute', inset: 0, opacity: activeGroup === i ? 1 : 0, transition: 'opacity 0.5s ease' }}>
                    <Image src={g.screen} alt={g.label} fill style={{ objectFit: 'cover', objectPosition: 'top' }} />
                  </Box>
                ))}
                {/* Active group label badge */}
                <Box sx={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: alpha(D.navy, 0.85), borderRadius: 1, px: 1.5, py: 0.5, backdropFilter: 'blur(4px)' }}>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fff' }}>
                    {FEATURE_GROUPS[activeGroup].label}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <InterestForm />
              </Box>
            </Box>

            {/* Scrolling feature list — grouped */}
            <Box sx={{ flex: 1, pl: { md: 6 }, py: { xs: 4, md: 6 } }}>
              {(() => {
                let globalIndex = 0;
                return FEATURE_GROUPS.map((group, gi) => (
                  <Box key={group.label} ref={groupRefs[gi]} sx={{ mb: 2 }}>
                    <Typography
                      sx={{
                        fontFamily: D.body,
                        fontSize: '0.63rem',
                        fontWeight: 700,
                        letterSpacing: '0.26em',
                        textTransform: 'uppercase',
                        color: D.terra,
                        py: 1.5,
                        borderBottom: `1px solid ${D.rule}`,
                      }}
                    >
                      {group.label}
                    </Typography>
                    {group.features.map((f) => {
                      const idx = globalIndex++;
                      return <FeatureRow key={f.title} feature={f} index={idx} />;
                    })}
                  </Box>
                ));
              })()}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <Box
        ref={ctaRef}
        sx={{
          py: { xs: 16, sm: 20 },
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
        <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: D.muted }}>
          Early access
        </Typography>
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '3.2rem', sm: '4.8rem', md: '6.5rem' }, letterSpacing: '-0.04em', lineHeight: 0.92, color: D.navy }}>
          Start planning.
        </Typography>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', color: D.muted, maxWidth: 300, lineHeight: 1.65 }}>
          Currently in private beta. Register below and we'll be in touch.
        </Typography>
        <InterestForm />
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Box sx={{ borderTop: `1.5px solid ${D.rule}`, py: 5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <Image src="/logomark.png" alt="Tabiji" width={26} height={26} style={{ objectFit: 'contain', opacity: 0.4 }} />
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
