'use client';

import { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Paper, Chip, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon         from '@mui/icons-material/Add';
import CloseIcon       from '@mui/icons-material/Close';
import LinkIcon        from '@mui/icons-material/Link';
import LightbulbIcon   from '@mui/icons-material/LightbulbOutlined';
import { CATEGORY_COLOUR, CATEGORY_LABEL, HIGHLIGHT_TYPE, isCategory, type ClipCategory } from '@/lib/clip/categories';
import { D, SubHeading } from './Intelligence.shared';
import NavigateButton from '@/components/ui/NavigateButton';
import type { AddTarget } from './Addtoitinerarydialog';

// "Saved by you" — places and tips clipped from the web with the Safari clipper.

export interface SavedItem {
  id:          string;
  kind:        'place' | 'tip';
  category:    string;
  name:        string;
  summary:     string;
  tip:         string;
  address:     string;
  coordinates: { lat: number; lng: number } | null;
  website:     string;
  city:        string;
  forCity:     boolean;
  sources:     { url: string; title: string; site: string }[];
}

const cat = (c: string): ClipCategory => (isCategory(c) ? c : 'activity');

function SourceLinks({ item }: { item: SavedItem }) {
  const links = [
    ...(item.website ? [{ url: item.website, label: 'Website' }] : []),
    ...item.sources.filter(s => s.url).map(s => ({ url: s.url, label: s.site || 'Source' })),
  ].filter((l, i, all) => all.findIndex(x => x.url === l.url) === i).slice(0, 3);
  if (!links.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {links.map(l => (
        <Chip
          key={l.url} component="a" href={l.url} target="_blank" rel="noopener" clickable size="small"
          icon={<LinkIcon sx={{ fontSize: '0.95rem !important' }} />} label={l.label}
          sx={{ height: 30, fontSize: '0.8rem', maxWidth: 200 }}
        />
      ))}
    </Box>
  );
}

function PlaceCard({ item, onAdd, onRemove }: { item: SavedItem; onAdd: () => void; onRemove: () => void }) {
  const c = cat(item.category);
  const colour = CATEGORY_COLOUR[c];
  return (
    <Paper elevation={0} sx={{
      scrollSnapAlign: 'start', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: `1px solid ${D.rule}`, borderRadius: 2, backgroundColor: D.paper,
    }}>
      <Box sx={{ height: 6, backgroundColor: colour }} />
      <Box sx={{ p: 2, pt: 1.25, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colour }}>
              {CATEGORY_LABEL[c]}{item.forCity ? ` · saved for ${item.city}` : ''}
            </Typography>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', lineHeight: 1.15, color: D.navy, letterSpacing: '-0.01em', mt: 0.25 }}>
              {item.name}
            </Typography>
          </Box>
          <Tooltip title="Remove">
            <IconButton onClick={onRemove} aria-label={`Remove ${item.name}`} sx={{ width: 44, height: 44, mt: -0.75, mr: -1 }}>
              <CloseIcon sx={{ fontSize: '1.1rem', color: D.muted }} />
            </IconButton>
          </Tooltip>
        </Box>
        {item.summary && (
          <Typography sx={{ fontSize: '0.93rem', lineHeight: 1.55, color: 'rgba(29,38,66,0.72)' }}>{item.summary}</Typography>
        )}
        {item.tip && (
          <Box sx={{ borderLeft: `2px solid ${D.terra}`, pl: 1.25 }}>
            <Typography sx={{ fontSize: '0.86rem', color: D.terra, fontStyle: 'italic', lineHeight: 1.5 }}>{item.tip}</Typography>
          </Box>
        )}
        <SourceLinks item={item} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto', pt: 0.75 }}>
          {(item.coordinates || item.address) && (
            <NavigateButton
              destination={{ name: item.name, coordinates: item.coordinates ?? undefined, address: item.address || undefined }}
              intent="view" variant="button" size="medium"
              sx={{ minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: `1px solid ${D.rule}` }}
            />
          )}
          <Button
            onClick={onAdd}
            startIcon={<AddIcon sx={{ fontSize: '1rem !important' }} />}
            sx={{ minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: '1px solid rgba(29,38,66,0.25)', backgroundColor: 'rgba(29,38,66,0.03)' }}
          >
            Add to day
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export function SavedByYou({ items, onAdd, onRemove }: {
  items:    SavedItem[];
  onAdd:    (t: AddTarget) => void;
  onRemove: (item: SavedItem) => void;
}) {
  const [filter,  setFilter]  = useState<ClipCategory | 'all'>('all');
  const [confirm, setConfirm] = useState<SavedItem | null>(null);

  const places = items.filter(i => i.kind === 'place');
  const tips   = items.filter(i => i.kind === 'tip');
  const present = useMemo(
    () => [...new Set(places.map(p => cat(p.category)))].sort((a, b) => CATEGORY_LABEL[a].localeCompare(CATEGORY_LABEL[b])),
    [places],
  );
  const shown = filter === 'all' ? places : places.filter(p => cat(p.category) === filter);

  if (!items.length) return null;

  return (
    <Box>
      <SubHeading>Saved by you</SubHeading>

      {present.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {(['all', ...present] as const).map(c => (
            <Chip
              key={c} label={c === 'all' ? `All ${places.length}` : CATEGORY_LABEL[c]}
              onClick={() => setFilter(c)}
              variant={filter === c ? 'filled' : 'outlined'}
              sx={{ height: 36, fontWeight: 700, ...(filter === c ? { backgroundColor: D.navy, color: '#fff' } : {}) }}
            />
          ))}
        </Box>
      )}

      {shown.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridAutoFlow: { xs: 'column', md: 'row' },
          gridAutoColumns: { xs: '85%', sm: '55%' },
          gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
          overflowX: { xs: 'auto', md: 'visible' },
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          mx: { xs: -2, sm: -3, md: 0 },
          px: { xs: 2, sm: 3, md: 0 },
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {shown.map(p => (
            <PlaceCard
              key={p.id} item={p}
              onAdd={() => onAdd({
                name: p.name, type: HIGHLIGHT_TYPE[cat(p.category)],
                address: p.address || undefined, coordinates: p.coordinates ?? undefined, notes: p.tip || undefined,
              })}
              onRemove={() => setConfirm(p)}
            />
          ))}
        </Box>
      )}

      {tips.length > 0 && (
        <Box sx={{ mt: shown.length ? 2.5 : 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tips.map(t => (
            <Box key={t.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', borderLeft: `3px solid ${CATEGORY_COLOUR.tip}`, pl: 1.5, py: 0.5 }}>
              <LightbulbIcon sx={{ fontSize: '1.1rem', color: CATEGORY_COLOUR.tip, mt: '3px' }} />
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: D.navy }}>{t.name}</Typography>
                {t.summary && <Typography sx={{ fontSize: '0.9rem', color: 'rgba(29,38,66,0.72)', lineHeight: 1.5 }}>{t.summary}</Typography>}
                {t.tip && <Typography sx={{ fontSize: '0.86rem', color: D.terra, fontStyle: 'italic' }}>{t.tip}</Typography>}
                <SourceLinks item={t} />
              </Box>
              <IconButton onClick={() => setConfirm(t)} aria-label={`Remove ${t.name}`} sx={{ width: 44, height: 44, mt: -0.75 }}>
                <CloseIcon sx={{ fontSize: '1.1rem', color: D.muted }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Remove “{confirm?.name}”?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.92rem' }}>
            {confirm?.forCity
              ? `It's saved for ${confirm.city}, so it goes from every trip there. Anything already added to a day stays.`
              : 'Anything already added to a day stays.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ minHeight: 44 }}>Keep it</Button>
          <Button onClick={() => { const it = confirm; setConfirm(null); if (it) onRemove(it); }} sx={{ minHeight: 44, color: D.terra, fontWeight: 700 }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
