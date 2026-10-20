'use client';

import { Box, Typography, Button, IconButton, Paper, Tooltip } from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import CloseIcon      from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { pickKey } from '@/lib/guide/types';
import type { CultureHighlight } from './Intelligence.types';
import { D, TYPE_COLOURS, TYPE_LABELS, PhotoCredit } from './Intelligence.shared';
import NavigateButton from '@/components/ui/NavigateButton';

const BADGE = { px: 1, py: 0.35, backgroundColor: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(8px)', borderRadius: 0.75 } as const;
const BADGE_TEXT = { fontSize: '0.7rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' } as const;

function PickCard({ h, onAdd, onDismiss }: {
  h:         CultureHighlight;
  onAdd:     () => void;
  onDismiss: () => void;
}) {
  const colour = TYPE_COLOURS[h.type] ?? '#333';
  const credit = h.imageCredit;
  const meta   = [h.hours, h.price].filter(Boolean).join(' · ');

  return (
    <Paper elevation={0} sx={{
      scrollSnapAlign: 'start', minWidth: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: `1px solid ${D.rule}`, borderRadius: 2, backgroundColor: D.paper,
    }}>
      <Box sx={{ position: 'relative', height: { xs: 180, md: 200 }, backgroundColor: `${colour}20`, flexShrink: 0 }}>
        {h.imageUrl ? (
          <img src={h.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${colour}30 0%, ${colour}0a 100%)` }} />
        )}
        <Box sx={{ position: 'absolute', top: 10, left: 10, right: 56, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Box sx={BADGE}><Typography sx={BADGE_TEXT}>{TYPE_LABELS[h.type] ?? h.type}</Typography></Box>
          {h.free && (
            <Box sx={{ ...BADGE, backgroundColor: 'rgba(107,124,92,0.82)' }}><Typography sx={BADGE_TEXT}>Free</Typography></Box>
          )}
        </Box>
        <Tooltip title="Hide this pick">
          <IconButton
            onClick={onDismiss}
            aria-label={`Hide ${h.name}`}
            sx={{
              position: 'absolute', top: 4, right: 4, width: 44, height: 44,
              color: '#fff', backgroundColor: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(8px)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <CloseIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
      {credit && (
        <Box sx={{ px: 2, pt: 0.5 }}>
          <PhotoCredit
            name={credit.name} link={credit.link} licence={credit.licence}
            unsplash={credit.source === 'unsplash' || (!credit.source && !!credit.username && credit.username !== 'wikimedia')}
          />
        </Box>
      )}

      <Box sx={{ p: 2, pt: 1.25, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.2rem', lineHeight: 1.15, color: D.navy, letterSpacing: '-0.01em' }}>
          {h.name}
        </Typography>
        <Typography sx={{ fontSize: '0.93rem', lineHeight: 1.55, color: 'rgba(29,38,66,0.72)' }}>
          {h.description}
        </Typography>
        {h.tip && (
          <Box sx={{ borderLeft: `2px solid ${D.terra}`, pl: 1.25 }}>
            <Typography sx={{ fontSize: '0.86rem', color: D.terra, fontStyle: 'italic', lineHeight: 1.5 }}>{h.tip}</Typography>
          </Box>
        )}
        {meta && (
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
            <AccessTimeIcon sx={{ fontSize: '0.95rem', color: D.muted, mt: '2px' }} />
            <Typography sx={{ fontSize: '0.82rem', color: D.muted, lineHeight: 1.45 }}>{meta}</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto', pt: 0.75 }}>
          <NavigateButton
            destination={{ name: h.name, coordinates: h.coordinates, address: h.address ?? undefined }}
            intent="view" variant="button" size="medium"
            sx={{ minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: `1px solid ${D.rule}` }}
          />
          <Button
            onClick={onAdd}
            startIcon={<AddIcon sx={{ fontSize: '1rem !important' }} />}
            sx={{
              minHeight: 44, fontWeight: 700, fontSize: '0.85rem',
              color: D.navy, border: '1px solid rgba(29,38,66,0.25)', backgroundColor: 'rgba(29,38,66,0.03)',
            }}
          >
            Add to day
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

// Swipe row on phones, grid on desktop — each pick shown once.
export function PicksRow({ picks, onAdd, onDismiss }: {
  picks:     CultureHighlight[];
  onAdd:     (h: CultureHighlight) => void;
  onDismiss: (h: CultureHighlight) => void;
}) {
  return (
    <Box sx={{
      display: 'grid',
      gridAutoFlow: { xs: 'column', md: 'row' },
      gridAutoColumns: { xs: '85%', sm: '55%' },
      gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
      gap: 1.5,
      overflowX: { xs: 'auto', md: 'visible' },
      scrollSnapType: { xs: 'x mandatory', md: 'none' },
      scrollPaddingLeft: { xs: 16, sm: 24 },
      mx: { xs: -2, sm: -3, md: 0 },
      px: { xs: 2, sm: 3, md: 0 },
      pb: 0.5,
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {picks.map(h => (
        <PickCard key={pickKey(h)} h={h} onAdd={() => onAdd(h)} onDismiss={() => onDismiss(h)} />
      ))}
    </Box>
  );
}
