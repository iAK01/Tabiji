'use client';

import { useState } from 'react';
import { Box, Typography, Button, Dialog, InputBase } from '@mui/material';
import { D } from './Itinerary.config';

interface Props {
  open:     boolean;
  title:    string;
  initial:  string;
  started:  boolean;
  isMobile: boolean;
  /** Resolves false when the note couldn't be saved or queued — the editor stays open with it. */
  onSave:   (text: string) => Promise<boolean>;
  onClose:  () => void;
}

// One note per stop: what to bring up before, what happened after. Closing it
// any way saves it, like a notes app — there's no Cancel to lose it by.
export function StopNoteEditor({ open, title, initial, started, isMobile, onSave, onClose }: Props) {
  // Mounted per edit (see ItineraryTab), so it starts from the saved note and
  // nothing refreshing underneath can replace what's being typed
  const [text,   setText]   = useState(initial);
  const [saving, setSaving] = useState(false);

  const done = async () => {
    if (saving) return;
    if (text.trim() === initial.trim()) { onClose(); return; }
    setSaving(true);
    const ok = await onSave(text);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open} onClose={done} fullScreen={isMobile} maxWidth="sm" fullWidth
      PaperProps={{ sx: { display: 'flex', flexDirection: 'column', ...(!isMobile && { borderRadius: '14px', height: '70vh' }) } }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
        px: { xs: 2.5, sm: 3 }, pt: isMobile ? 'max(env(safe-area-inset-top), 12px)' : 2, pb: 1,
        borderBottom: `1px solid ${D.rule}`,
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: D.muted,
          }}>
            Notes
          </Typography>
          <Typography sx={{
            fontFamily: D.display, fontSize: '1rem', color: D.navy,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </Typography>
        </Box>
        <Button
          variant="contained" onClick={done} disabled={saving}
          sx={{ minHeight: 44, borderRadius: '10px', backgroundColor: D.navy, fontFamily: D.body, fontWeight: 700, boxShadow: 'none' }}
        >
          {saving ? 'Saving…' : 'Done'}
        </Button>
      </Box>
      <InputBase
        value={text}
        onChange={e => setText(e.target.value)}
        multiline autoFocus fullWidth
        placeholder={started ? 'What happened, who you met, follow-ups…' : 'What to bring up, what to look out for…'}
        inputProps={{ 'aria-label': `Notes for ${title}` }}
        sx={{
          flex: 1, alignItems: 'flex-start', overflowY: 'auto',
          px: { xs: 2.5, sm: 3 }, py: 2,
          fontFamily: D.body, fontSize: '1rem', lineHeight: 1.55, color: D.navy,
          pb: isMobile ? 'max(env(safe-area-inset-bottom), 16px)' : 2,
        }}
      />
    </Dialog>
  );
}
