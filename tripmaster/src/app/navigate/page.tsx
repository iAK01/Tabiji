'use client';

// Notification "Directions" buttons land here: a button on a notification can't ask
// which map app to use, so this shows the same picker as every Navigate button.
// Reads the place from the URL on the client, so the saved offline copy works for any place.

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Paper, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { canNavigate, navigatePageParams } from '@/lib/navigation/links';
import NavigateOptions, { NavigateNotice, type NavNotice } from '@/components/navigation/NavigateOptions';

function NavigatePicker() {
  const { destination, mode, tripId } = navigatePageParams(useSearchParams());
  const [notice, setNotice] = useState<NavNotice | null>(null);

  return (
    <Box sx={{
      minHeight: '100dvh', backgroundColor: 'background.default',
      px: 2, pt: 'max(env(safe-area-inset-top), 16px)', pb: 4,
    }}>
      <Box sx={{ maxWidth: 420, mx: 'auto' }}>
        <Button href={tripId ? `/trips/${tripId}` : '/dashboard'} startIcon={<ArrowBackIcon />}
          sx={{ minHeight: 44, mb: 1.5, ml: -1, fontWeight: 700, textTransform: 'none' }}>
          {tripId ? 'Back to trip' : 'Dashboard'}
        </Button>
        <Paper elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
          {canNavigate(destination) ? (
            <>
              <NavigateOptions destination={destination} initialMode={mode} onNotice={setNotice} />
              {destination.address && destination.address !== destination.name && (
                <Typography sx={{ px: 2, py: 1.5, fontSize: '0.8rem', color: 'text.secondary', borderTop: 1, borderColor: 'divider' }}>
                  {destination.address}
                </Typography>
              )}
            </>
          ) : (
            <Typography sx={{ p: 2.5, color: 'text.secondary' }}>No location for this one.</Typography>
          )}
        </Paper>
      </Box>
      <NavigateNotice notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}

export default function NavigatePage() {
  return (
    <Suspense>
      <NavigatePicker />
    </Suspense>
  );
}
