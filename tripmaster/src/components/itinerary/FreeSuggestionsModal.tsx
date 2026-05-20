'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, IconButton, CircularProgress, Chip,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import ExploreIcon      from '@mui/icons-material/Explore';
import AddCircleIcon    from '@mui/icons-material/AddCircle';
import { alpha }        from '@mui/material/styles';
import { D }            from './Itinerary.config';
import { formatTime }   from './Itinerary.helpers';
import type { CultureHighlight } from '@/components/intelligence/Intelligence.types';
import type { Stop }    from './Itinerary.config';

interface Props {
  open:             boolean;
  onClose:          () => void;
  tripId:           string;
  slot:             { start: number; mins: number } | null;
  onAdd:            (stop: Partial<Stop>) => Promise<void>;
  onSwitchToDiscover?: () => void;
}

function stopType(h: CultureHighlight): string {
  if (h.type === 'coffee' || h.type === 'food') return 'meal';
  if (h.type === 'park')                         return 'activity';
  return 'sightseeing';
}

function defaultDuration(h: CultureHighlight): number {
  if (h.type === 'coffee') return 45;
  if (h.type === 'park')   return 60;
  return 90;
}

export function FreeSuggestionsModal({ open, onClose, tripId, slot, onAdd, onSwitchToDiscover }: Props) {
  const [highlights, setHighlights] = useState<CultureHighlight[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [adding,     setAdding]     = useState<string | null>(null);
  const [added,      setAdded]      = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) { setAdded(new Set()); return; }
    setLoading(true);
    fetch(`/api/trips/${tripId}/culture`)
      .then(r => r.json())
      .then(d => setHighlights(d.culture?.briefing?.highlights ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, tripId]);

  const handleAdd = async (h: CultureHighlight) => {
    if (!slot) return;
    setAdding(h.name);
    try {
      await onAdd({
        name:        h.name,
        type:        stopType(h),
        address:     h.address     ?? undefined,
        coordinates: h.coordinates ?? undefined,
        duration:    defaultDuration(h),
        notes:       h.tip         ?? undefined,
        scheduledStart: formatTime(slot.start),
      });
      setAdded(prev => new Set(prev).add(h.name));
    } finally {
      setAdding(null);
    }
  };

  const slotLabel = slot
    ? (() => {
        const h = Math.floor(slot.mins / 60);
        const m = slot.mins % 60;
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} free from ${formatTime(slot.start)}` : `${m}m free from ${formatTime(slot.start)}`;
      })()
    : '';

  const suggestions = highlights.slice(0, 3);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, backgroundColor: D.paper } }}
    >
      <DialogTitle sx={{ pb: 0.5, pr: 6 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.navy }}>
          Ideas for your free time
        </Typography>
        {slotLabel && (
          <Typography sx={{ fontSize: '0.82rem', color: D.muted, mt: 0.25 }}>
            {slotLabel}
          </Typography>
        )}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: D.muted }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} sx={{ color: D.navy }} />
          </Box>
        )}

        {!loading && suggestions.length === 0 && (
          <Typography sx={{ fontSize: '0.9rem', color: D.muted, py: 2, textAlign: 'center' }}>
            No suggestions yet — generate a Discover briefing first.
          </Typography>
        )}

        {!loading && suggestions.map(h => (
          <Box
            key={h.name}
            sx={{
              display:        'flex',
              alignItems:     'flex-start',
              gap:            1.5,
              py:             1.25,
              borderBottom:   `1px solid ${D.rule}`,
              '&:last-of-type': { borderBottom: 'none' },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.35 }}>
                <Typography sx={{ fontFamily: D.display, fontSize: '0.97rem', color: D.navy, lineHeight: 1.2 }}>
                  {h.name}
                </Typography>
                {h.free && (
                  <Chip label="Free entry" size="small" sx={{ fontSize: '0.7rem', height: 18, backgroundColor: alpha(D.green, 0.12), color: D.green, fontWeight: 700 }} />
                )}
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: D.muted, lineHeight: 1.45, mb: h.tip ? 0.5 : 0 }}
                noWrap={false}>
                {h.description.slice(0, 100)}{h.description.length > 100 ? '…' : ''}
              </Typography>
              {h.tip && (
                <Typography sx={{ fontSize: '0.78rem', color: D.terra, fontStyle: 'italic', lineHeight: 1.4 }}>
                  {h.tip.slice(0, 90)}{h.tip.length > 90 ? '…' : ''}
                </Typography>
              )}
            </Box>

            <Button
              size="small"
              variant={added.has(h.name) ? 'outlined' : 'contained'}
              disabled={!!adding || added.has(h.name)}
              onClick={() => handleAdd(h)}
              startIcon={added.has(h.name) ? undefined : <AddCircleIcon sx={{ fontSize: '0.95rem !important' }} />}
              sx={{
                flexShrink:      0,
                fontWeight:      700,
                fontSize:        '0.78rem',
                minWidth:        60,
                backgroundColor: added.has(h.name) ? 'transparent' : D.navy,
                borderColor:     added.has(h.name) ? D.green : 'transparent',
                color:           added.has(h.name) ? D.green : '#fff',
                '&:hover':       { backgroundColor: added.has(h.name) ? 'transparent' : '#2a3660' },
              }}
            >
              {adding === h.name ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : added.has(h.name) ? 'Added' : 'Add'}
            </Button>
          </Box>
        ))}

        {!loading && suggestions.length > 0 && onSwitchToDiscover && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
            <Button
              size="small"
              startIcon={<ExploreIcon sx={{ fontSize: '0.9rem !important' }} />}
              onClick={() => { onClose(); onSwitchToDiscover(); }}
              sx={{ color: D.muted, fontSize: '0.8rem', fontWeight: 700, textTransform: 'none' }}
            >
              Browse all in Discover
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
