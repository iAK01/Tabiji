'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, CircularProgress, LinearProgress, Alert,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const D = {
  green:   '#6B7C5C',
  navy:    '#2C3E50',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

/**
 * The "the AI is working" / "it failed" half of Smart Extract. Shown the instant
 * the user triggers an extraction (from a file card, a note, or the paste box),
 * so there is always something on screen explaining what is happening.
 * When it succeeds, the caller swaps this for <SmartExtractModal>.
 */
export default function SmartExtractProgress({
  open, running, error, label, onRetry, onClose,
}: {
  open:     boolean;
  running:  boolean;
  error:    string | null;
  label?:   string;
  onRetry:  () => void;
  onClose:  () => void;
}) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const stage =
    secs < 6  ? `Reading ${label || 'your material'}…`
    : secs < 16 ? 'Finding hotels, venues, schedule and transport…'
    : 'Still working — longer documents take a little more time.';

  return (
    <Dialog
      open={open}
      onClose={() => { if (!running) onClose(); }}
      maxWidth="xs" fullWidth
      PaperProps={{ sx: { backgroundColor: D.paper, borderRadius: 2.5 } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <AutoFixHighIcon sx={{ color: D.green, fontSize: 22 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, letterSpacing: '-0.02em' }}>
            Smart Extract
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 1 }}>
        {running ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
            <CircularProgress size={34} sx={{ color: D.green }} />
            <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', color: D.navy, textAlign: 'center', minHeight: 40 }}>
              {stage}
            </Typography>
            <LinearProgress sx={{
              width: '100%', borderRadius: 1, height: 5,
              backgroundColor: 'rgba(107,124,92,0.15)',
              '& .MuiLinearProgress-bar': { backgroundColor: D.green },
            }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 1 }}>
            <ErrorOutlineIcon sx={{ color: '#C4714A', fontSize: 30 }} />
            <Alert severity="error" sx={{ fontFamily: D.body, fontSize: '0.85rem', width: '100%' }}>
              {error ?? 'Something went wrong.'}
            </Alert>
          </Box>
        )}
      </DialogContent>

      {!running && (
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} sx={{ fontFamily: D.body, fontWeight: 600 }}>Close</Button>
          <Button
            variant="contained"
            onClick={onRetry}
            sx={{ fontFamily: D.body, fontWeight: 700, backgroundColor: D.green, '&:hover': { backgroundColor: '#5a6b4e' } }}
          >
            Try again
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
