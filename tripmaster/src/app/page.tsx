'use client';

import { signIn } from 'next-auth/react';
import { Box, Button, Container, Typography, Grid, Paper } from '@mui/material';
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
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOff';

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
  {
    icon: RouteOutlinedIcon,
    title: 'Plan from idea to arrival',
    body: 'Build trips with multiple destinations, each with their own timing and purpose. Move through stages as plans develop. Nothing gets lost along the way.',
  },
  {
    icon: CalendarTodayOutlinedIcon,
    title: 'Your itinerary, your way',
    body: 'Construct each day as it actually unfolds. Build manually or let AI draft a starting point. Add movement, pauses, and commitments. Adjust without breaking the structure.',
  },
  {
    icon: LuggageOutlinedIcon,
    title: 'Packing lists that think ahead',
    body: 'Generated from your trip length, transport, accommodation, and type. Items scale with time — three shirts, not just shirts. Flag what to do before you leave. Regenerate as plans change.',
  },
  {
    icon: FlightOutlinedIcon,
    title: 'Logistics in one place',
    body: 'Flights, trains, ferries, cars, accommodation, venues. Each piece sits in context, connected to the rest of the trip. Pre-departure steps and arrival details accounted for.',
  },
  {
    icon: FolderOutlinedIcon,
    title: 'Everything attached, nothing loose',
    body: 'Documents, links, booking references, contacts, notes, and tasks — connected directly to the part of the trip they belong to. Not sitting in a folder somewhere.',
  },
  {
    icon: PublicOutlinedIcon,
    title: 'Know before you go',
    body: 'Visa requirements, currency, time zones, electrical systems, language essentials, emergency numbers, local context. Surfaced without searching.',
  },
  {
    icon: WbSunnyOutlinedIcon,
    title: 'Weather, in perspective',
    body: 'Forecasts when they matter, climate normals when you are planning further ahead. Always in relation to where you are starting from.',
  },
  {
    icon: TuneOutlinedIcon,
    title: 'Built around how you actually travel',
    body: 'Your home city, passport, unit preferences, and navigation app per transport mode inform every trip. Every "navigate" link opens exactly where you want it.',
  },
  {
    icon: GroupOutlinedIcon,
    title: 'Travel with others',
    body: 'Trips can be shared. Roles are clear. Edits are controlled. Everyone works from the same version.',
  },
  {
    icon: NotificationsOutlinedIcon,
    title: 'Notifications that aren\'t noise',
    body: 'Alerts for flights, check-ins, itinerary stops, and todos — with adjustable lead times per item. Duplication removed.',
  },
  {
    icon: WifiOffOutlinedIcon,
    title: 'Works offline',
    body: 'Trip data cached to your device. Accessible anywhere, regardless of signal.',
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </Typography>
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
        letterSpacing: '0.01em',
        px: 4,
        py: 1.5,
        borderRadius: 2,
        textTransform: 'none',
        '&:hover': {
          backgroundColor: alpha(D.navy, 0.85),
        },
      }}
    >
      {label}
    </Button>
  );
}

export default function Home() {
  return (
    <Box sx={{ backgroundColor: D.bg, minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 4 },
          py: { xs: 10, sm: 14 },
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Logomark */}
        <Box sx={{ mb: 4 }}>
          <Image
            src="/logomark.png"
            alt="Tabiji"
            width={52}
            height={52}
            style={{ objectFit: 'contain' }}
          />
        </Box>

        {/* Wordmark */}
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '3.8rem', sm: '5.5rem', md: '7rem' },
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            color: D.navy,
            mb: 1.5,
          }}
        >
          Tabiji
        </Typography>

        {/* Japanese */}
        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.75rem',
            letterSpacing: '0.3em',
            color: D.muted,
            textTransform: 'uppercase',
            mb: 4,
          }}
        >
          旅路
        </Typography>

        {/* Terracotta rule */}
        <Box
          sx={{
            width: 48,
            height: 3,
            backgroundColor: D.terra,
            borderRadius: 2,
            mb: 5,
          }}
        />

        {/* Hero headline */}
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.7rem', sm: '2.2rem', md: '2.8rem' },
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: D.navy,
            maxWidth: 640,
            mb: 3,
          }}
        >
          A system for journeys,<br />not just plans.
        </Typography>

        {/* Hero body */}
        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: { xs: '0.95rem', sm: '1.05rem' },
            lineHeight: 1.75,
            color: D.muted,
            maxWidth: 520,
            mb: 3,
          }}
        >
          Tabiji holds the entire shape of a trip — where you are going, how you
          are moving, what you need, and everything that sits around it. Built
          from the perspective of someone who travels with intent.
        </Typography>

        {/* Sub-tagline */}
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '1rem', sm: '1.1rem' },
            letterSpacing: '-0.01em',
            color: D.terra,
            mb: 5,
          }}
        >
          One trip, fully understood.
        </Typography>

        <GoogleButton label="Sign in with Google" />

        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.75rem',
            color: D.muted,
            mt: 2,
            letterSpacing: '0.01em',
          }}
        >
          Your trips stay private. No feeds, no followers.
        </Typography>
      </Box>

      {/* ── What Tabiji does ──────────────────────────────────────── */}
      <Box
        sx={{
          backgroundColor: D.paper,
          borderTop: `1.5px solid ${D.rule}`,
          borderBottom: `1.5px solid ${D.rule}`,
          py: { xs: 10, sm: 14 },
          px: { xs: 3, sm: 4 },
        }}
      >
        <Container maxWidth="lg">

          {/* Section header */}
          <Box sx={{ mb: 8, textAlign: 'center' }}>
            <SectionLabel>What Tabiji does</SectionLabel>
            <Typography
              sx={{
                fontFamily: D.display,
                fontSize: { xs: '1.7rem', sm: '2rem', md: '2.4rem' },
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                color: D.navy,
                mt: 2,
                mb: 3,
                maxWidth: 560,
                mx: 'auto',
              }}
            >
              Trips are not just destinations.
            </Typography>
            <Typography
              sx={{
                fontFamily: D.body,
                fontSize: { xs: '0.9rem', sm: '1rem' },
                lineHeight: 1.75,
                color: D.muted,
                maxWidth: 560,
                mx: 'auto',
              }}
            >
              They are timelines, dependencies, and decisions. Tabiji connects
              planning, logistics, documents, and context into a single
              continuous view — from first idea to return home. Nothing is
              overwritten. Nothing disappears.
            </Typography>
          </Box>

          {/* Feature grid */}
          <Grid container spacing={2.5}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3.5,
                      height: '100%',
                      backgroundColor: D.bg,
                      border: `1.5px solid ${D.rule}`,
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Icon sx={{ fontSize: 22, color: D.green }} />
                    <Typography
                      sx={{
                        fontFamily: D.display,
                        fontSize: '1rem',
                        letterSpacing: '-0.01em',
                        color: D.navy,
                        lineHeight: 1.25,
                      }}
                    >
                      {f.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: D.body,
                        fontSize: '0.85rem',
                        lineHeight: 1.7,
                        color: D.muted,
                      }}
                    >
                      {f.body}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* ── Sign-in CTA ───────────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 12, sm: 16 },
          px: { xs: 3, sm: 4 },
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <SectionLabel>Early access</SectionLabel>
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem' },
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
            maxWidth: 320,
            lineHeight: 1.6,
          }}
        >
          Tabiji is free to use during early access.
        </Typography>
        <GoogleButton label="Continue with Google" />
      </Box>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <Box
        sx={{
          borderTop: `1.5px solid ${D.rule}`,
          py: 5,
          px: { xs: 3, sm: 4 },
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
          width={28}
          height={28}
          style={{ objectFit: 'contain', opacity: 0.5 }}
        />
        <Typography
          sx={{
            fontFamily: D.display,
            fontSize: '1rem',
            letterSpacing: '-0.01em',
            color: D.navy,
          }}
        >
          Travel, held together.
        </Typography>
        <Typography
          sx={{
            fontFamily: D.body,
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            color: D.muted,
            textTransform: 'uppercase',
          }}
        >
          Tabiji (旅路) — journey, travel path.
        </Typography>
      </Box>

    </Box>
  );
}
