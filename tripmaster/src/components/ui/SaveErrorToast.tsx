'use client';

import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { SAVE_FAILED_EVENT } from '@/lib/offline/saveErrors';

// The one place a failed save is shown, app-wide — callers report through
// reportSaveFailure() rather than each component growing its own error state.
// Messages queue so two failures in a row aren't collapsed into one.
export default function SaveErrorToast() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const onFail = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      setMessages(m => (m.includes(msg) ? m : [...m, msg]));
    };
    window.addEventListener(SAVE_FAILED_EVENT, onFail);
    return () => window.removeEventListener(SAVE_FAILED_EVENT, onFail);
  }, []);

  const current = messages[0];
  const dismiss = () => setMessages(m => m.slice(1));

  return (
    <Snackbar
      key={current}
      open={!!current}
      autoHideDuration={10000}
      onClose={(_, why) => { if (why !== 'clickaway') dismiss(); }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: 'max(12px, env(safe-area-inset-top)) !important' }}
    >
      <Alert severity="error" variant="filled" onClose={dismiss}
        sx={{ fontFamily: '"Archivo", "Inter", sans-serif', fontWeight: 500, maxWidth: 520 }}>
        {current}
      </Alert>
    </Snackbar>
  );
}
