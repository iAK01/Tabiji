'use client';

import { signIn } from 'next-auth/react';
import { Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import GoogleIcon from '@mui/icons-material/Google';

const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

export default function SignInPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: D.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        textAlign: 'center',
        gap: 0,
      }}
    >
      <Image
        src="/logomark.png"
        alt="Tabiji"
        width={44}
        height={44}
        style={{ objectFit: 'contain', marginBottom: 20 }}
      />

      <Typography
        sx={{
          fontFamily: D.display,
          fontSize: { xs: '2.4rem', sm: '3rem' },
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
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
          letterSpacing: '0.28em',
          color: D.muted,
          textTransform: 'uppercase',
          mb: 4,
        }}
      >
        旅路
      </Typography>

      <Box
        sx={{
          width: 36,
          height: 3,
          backgroundColor: D.terra,
          borderRadius: 2,
          mb: 5,
        }}
      />

      <Typography
        sx={{
          fontFamily: D.display,
          fontSize: { xs: '1.1rem', sm: '1.25rem' },
          letterSpacing: '-0.02em',
          color: D.navy,
          mb: 1.5,
        }}
      >
        Start planning.
      </Typography>

      <Typography
        sx={{
          fontFamily: D.body,
          fontSize: '0.85rem',
          color: D.muted,
          mb: 4,
          maxWidth: 280,
          lineHeight: 1.6,
        }}
      >
        Tabiji is free to use during early access.
      </Typography>

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
        Continue with Google
      </Button>

      <Typography
        sx={{
          fontFamily: D.body,
          fontSize: '0.72rem',
          color: D.muted,
          mt: 2.5,
          letterSpacing: '0.01em',
        }}
      >
        Your trips stay private. No feeds, no followers.
      </Typography>
    </Box>
  );
}
