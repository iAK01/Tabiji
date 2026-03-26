'use client';

import { signIn } from 'next-auth/react';
import { Box, Button, Typography, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

export default function SignInPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          maxWidth: 400,
          width: '100%',
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="h4" color="text.primary" fontWeight={700}>
          Tabiji
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Your personal travel orchestration platform
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          fullWidth
          sx={{ mt: 2 }}
        >
          Sign in with Google
        </Button>
      </Paper>
    </Box>
  );
}