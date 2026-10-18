'use client';

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Dialog, IconButton, LinearProgress, Slide, Typography } from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import CheckIcon            from '@mui/icons-material/Check';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import CloseIcon            from '@mui/icons-material/Close';
import DoNotDisturbAltIcon  from '@mui/icons-material/DoNotDisturbAlt';
import ChevronLeftIcon      from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome';
import ChecklistIcon        from '@mui/icons-material/Checklist';
import LightModeIcon        from '@mui/icons-material/LightMode';
import CategoryIcon         from '@mui/icons-material/Category';
import { CATEGORY_ICONS } from './categoryIcons';
import { qtyLabel, statusOf, type PackStatus } from './packing.helpers';

// One item at a time, full screen, for people who'd rather not work down a long list of
// small checkboxes: a big centred card to swipe between, and two thumb-sized buttons that
// never move. After each decision the deck moves on to the next thing still to pack.

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

const GAP_PX     = 12;
const ADVANCE_MS = 320;   // long enough to see the card's new status before moving on
// Card width: the screen less a peek of the neighbours, capped so it stays a card on desktop.
const CARD_W     = 'min(100% - 48px, 480px)';

export interface DeckItem {
  _idx:             number;
  name:             string;
  category:         string;
  quantity:         number;
  quantityType:     string;
  essential:        boolean;
  packed:           boolean;
  skipped?:         boolean;
  preTravelAction:  boolean;
  preTravelNote:    string;
  advisoryNote:     string;
  conditionReason?: string;
  photoUrl?:        string | null;
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  items:     DeckItem[];          // deck order — stable while the deck is open
  nights:    number;
  pending:   Set<number>;         // _idx of items with a save in flight
  onStatus:  (idx: number, status: PackStatus) => void;
  awake?:    { supported: boolean; on: boolean; toggle: () => void };
}

const SlideUp = forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function PackingCardDeck({ open, onClose, ...rest }: Props) {
  return (
    <Dialog
      fullScreen open={open} onClose={onClose}
      slots={{ transition: SlideUp }}
      slotProps={{ paper: { sx: { backgroundColor: D.bg, backgroundImage: 'none' } } }}
      aria-label="Packing cards"
    >
      <Deck {...rest} onClose={onClose} />
    </Dialog>
  );
}

function Deck({ items, nights, pending, onStatus, awake, onClose }: Omit<Props, 'open'>) {
  const trackRef   = useRef<HTMLDivElement>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Position is tracked by item, not slot, so an item added while the deck is open doesn't
  // shift the card someone is looking at. -1 = the summary card at the end.
  const [currentKey, setCurrentKey] = useState<number | null>(null);

  const total   = items.length;
  const pos     = currentKey === -1 ? total : Math.max(0, items.findIndex(i => i._idx === currentKey));
  const current = pos < total ? items[pos] : null;
  const packed  = items.filter(i => i.packed).length;
  const skipped = items.filter(i => !i.packed && i.skipped).length;
  const todo    = total - packed - skipped;

  const step = () => {
    const card = trackRef.current?.querySelector<HTMLElement>('[data-card]');
    return card ? card.offsetWidth + GAP_PX : 1;
  };

  const keyAt = useCallback((p: number) => (p >= items.length ? -1 : items[p]._idx), [items]);

  const goTo = useCallback((p: number, smooth = true) => {
    const clamped = Math.max(0, Math.min(p, items.length));
    trackRef.current?.scrollTo({ left: clamped * step(), behavior: smooth ? 'smooth' : 'auto' });
    setCurrentKey(keyAt(clamped));
  }, [items.length, keyAt]);

  const firstTodo = useCallback(() => {
    const i = items.findIndex(it => statusOf(it) === 'todo');
    return i === -1 ? items.length : i;
  }, [items]);

  const nextTodoAfter = useCallback((p: number) => {
    for (let k = 1; k < items.length; k++) {
      const j = (p + k) % items.length;
      if (statusOf(items[j]) === 'todo') return j;
    }
    return items.length;   // nothing left — the summary card
  }, [items]);

  // Open on the first thing still to pack, with focus on the deck so the arrow keys work
  // (the dialog would otherwise focus itself, outside the deck's key handler).
  useLayoutEffect(() => {
    goTo(firstTodo(), false);
    trackRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the same card centred when the deck changes size (rotation) or gains/loses an item.
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const recentre = () => {
      const want = posRef.current * step();
      if (Math.abs(el.scrollLeft - want) > 2) el.scrollTo({ left: want, behavior: 'auto' });
    };
    const ro = new ResizeObserver(recentre);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || currentKey === null) return;
    const want = pos * step();
    if (Math.abs(el.scrollLeft - want) > 2) el.scrollTo({ left: want, behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const p   = Math.max(0, Math.min(Math.round(el.scrollLeft / step()), items.length));
    const key = keyAt(p);
    if (key !== currentKey) {
      setCurrentKey(key);
      // They're swiping themselves — don't yank the deck somewhere else a moment later.
      if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
    }
  };

  const act = (status: Exclude<PackStatus, 'todo'>) => {
    if (!current || pending.has(current._idx)) return;
    const was = statusOf(current);
    onStatus(current._idx, was === status ? 'todo' : status);
    if (was === 'todo') {
      const from = pos;
      if (advanceRef.current) clearTimeout(advanceRef.current);
      advanceRef.current = setTimeout(() => { advanceRef.current = null; goTo(nextTodoAfter(from)); }, ADVANCE_MS);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(pos + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(pos - 1); }
  };

  const status = current ? statusOf(current) : null;
  const busy   = !!current && pending.has(current._idx);

  return (
    <Box onKeyDown={onKeyDown} sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)',
    }}>

      {/* ── Top bar ── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, width: '100%', maxWidth: 560, mx: 'auto', boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton aria-label="Close packing cards" onClick={onClose} sx={{ color: D.navy }}>
            <CloseIcon />
          </IconButton>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <IconButton aria-label="Previous item" onClick={() => goTo(pos - 1)} disabled={pos === 0} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Typography sx={{ fontFamily: D.display, fontSize: '1rem', letterSpacing: '-0.01em', color: D.navy,
              minWidth: 84, textAlign: 'center' }}>
              {current ? `${pos + 1} of ${total}` : 'Summary'}
            </Typography>
            <IconButton aria-label="Next item" onClick={() => goTo(pos + 1)} disabled={pos >= total} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>
          {awake?.supported ? (
            <IconButton aria-label="Keep screen on" aria-pressed={awake.on} onClick={awake.toggle}
              title={awake.on ? 'Screen staying on' : 'Keep screen on'}
              sx={{
                color: awake.on ? D.terra : 'rgba(44,62,80,0.5)',
                backgroundColor: awake.on ? 'rgba(196,113,74,0.12)' : 'transparent',
                '&:hover': { backgroundColor: awake.on ? 'rgba(196,113,74,0.18)' : 'rgba(44,62,80,0.05)' },
              }}>
              <LightModeIcon />
            </IconButton>
          ) : <Box sx={{ width: 40 }} />}
        </Box>
        <Box sx={{ px: 1, mt: 1 }}>
          <LinearProgress variant="determinate" value={total ? ((packed + skipped) / total) * 100 : 0}
            sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(44,62,80,0.08)',
              '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: D.green } }} />
          <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: 'text.secondary', mt: 0.75, textAlign: 'center' }}>
            <b>{packed}</b> packed · <b>{skipped}</b> not bringing · <b>{todo}</b> to go
          </Typography>
        </Box>
      </Box>

      {/* ── The deck — fills the middle of the screen ── */}
      <Box
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Packing items, one at a time"
        sx={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'stretch', gap: `${GAP_PX}px`,
          overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain',
          scrollSnapType: 'x mandatory',
          py: 1,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          '&:focus-visible': { outline: 'none' },
        }}
      >
        {/* Spacers either side let the first and last cards centre — trailing padding
            doesn't count in a flex scroller. */}
        <Box aria-hidden sx={spacerSx} />
        {total === 0 && (
          <Box data-card sx={{ ...cardSx, alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontFamily: D.body, color: 'text.secondary' }}>Nothing on this list yet.</Typography>
          </Box>
        )}
        {items.map((item, i) => (
          <ItemCard key={item._idx} item={item} nights={nights} position={i + 1} total={total} />
        ))}
        {total > 0 && (
          <SummaryCard packed={packed} skipped={skipped} todo={todo}
            onNext={() => goTo(firstTodo())} onClose={onClose} />
        )}
        <Box aria-hidden sx={spacerSx} />
      </Box>

      {/* ── Actions — always in the same place, under the thumb ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 2, width: '100%', maxWidth: 560, mx: 'auto', boxSizing: 'border-box',
        visibility: current ? 'visible' : 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
          <Button
            onClick={() => act('skipped')} disabled={busy}
            variant={status === 'skipped' ? 'contained' : 'outlined'}
            startIcon={<DoNotDisturbAltIcon />}
            aria-pressed={status === 'skipped'}
            sx={{
              minHeight: 64, borderRadius: 3, fontFamily: D.display, fontSize: '1rem',
              letterSpacing: '-0.01em', textTransform: 'none', boxShadow: 'none',
              borderWidth: 2, borderColor: 'rgba(44,62,80,0.25)',
              color: status === 'skipped' ? '#fff' : D.navy,
              backgroundColor: status === 'skipped' ? D.navy : D.paper,
              '&:hover': { borderWidth: 2, boxShadow: 'none', backgroundColor: status === 'skipped' ? D.navy : 'rgba(44,62,80,0.04)' },
            }}
          >
            Not bringing
          </Button>
          <Button
            onClick={() => act('packed')} disabled={busy}
            variant="contained"
            startIcon={status === 'packed' ? <CheckCircleIcon /> : <CheckIcon />}
            aria-pressed={status === 'packed'}
            sx={{
              minHeight: 64, borderRadius: 3, fontFamily: D.display, fontSize: '1rem',
              letterSpacing: '-0.01em', textTransform: 'none', boxShadow: 'none',
              backgroundColor: D.green,
              ...(status === 'packed' && { outline: `3px solid ${D.green}`, outlineOffset: 2 }),
              '&:hover': { backgroundColor: '#5c6b4f', boxShadow: 'none' },
            }}
          >
            {status === 'packed' ? 'Packed' : 'Pack it'}
          </Button>
        </Box>
        <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem', color: 'text.disabled', textAlign: 'center', mt: 1 }}>
          {status === 'todo' || status === null ? 'Swipe to move between items' : 'Tap the highlighted button again to undo'}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

const spacerSx = { flex: `0 0 calc((100% - ${CARD_W}) / 2 - ${GAP_PX}px)` } as const;

const cardSx = {
  flex: `0 0 ${CARD_W}`, scrollSnapAlign: 'center', scrollSnapStop: 'always',
  display: 'flex', flexDirection: 'column',
  overflowY: 'auto', overscrollBehaviorY: 'contain',
  p: { xs: 2.5, sm: 3 }, borderRadius: 4,
  backgroundColor: D.paper, border: '1.5px solid rgba(44,62,80,0.10)',
  boxShadow: '0 6px 24px rgba(44,62,80,0.08)',
  boxSizing: 'border-box',
} as const;

function ItemCard({ item, nights, position, total }: { item: DeckItem; nights: number; position: number; total: number }) {
  const Icon   = CATEGORY_ICONS[item.category] ?? CategoryIcon;
  const status = statusOf(item);

  return (
    <Box
      data-card
      role="group" aria-roledescription="slide" aria-label={`${position} of ${total}: ${item.name}`}
      sx={{
        ...cardSx,
        borderColor: status === 'packed' ? D.green : status === 'skipped' ? 'rgba(44,62,80,0.18)' : 'rgba(44,62,80,0.10)',
        borderWidth: status === 'packed' ? 2 : 1.5,
        backgroundColor: status === 'skipped' ? '#F3F1EC' : D.paper,
        transition: 'border-color 0.2s, background-color 0.2s',
      }}
    >
      {/* Category */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Icon sx={{ fontSize: 20, color: D.green }} />
        <Typography sx={{
          fontFamily: D.body, fontWeight: 700, fontSize: '0.76rem',
          letterSpacing: '0.12em', textTransform: 'uppercase', color: D.green, flex: 1, minWidth: 0,
        }}>
          {item.category}
        </Typography>
        {item.essential && (
          <Chip label="Essential" size="small"
            sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.68rem', height: 22,
              backgroundColor: 'rgba(196,113,74,0.12)', color: D.terra }} />
        )}
      </Box>

      {/* The item, front and centre */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 2 }}>
        {item.photoUrl && (
          <Box component="img" src={item.photoUrl} alt="" loading="lazy" draggable={false}
            sx={{ width: '100%', height: 'clamp(120px, 26vh, 240px)', objectFit: 'cover', borderRadius: 2.5, mb: 2.5,
              opacity: status === 'skipped' ? 0.5 : 1 }} />
        )}
        <Typography sx={{
          fontFamily: D.display, fontSize: 'clamp(1.9rem, 9vw, 2.6rem)', lineHeight: 1.05,
          letterSpacing: '-0.025em', color: status === 'skipped' ? 'text.disabled' : D.navy,
          overflowWrap: 'anywhere',
          textDecoration: status === 'skipped' ? 'line-through' : 'none',
        }}>
          {item.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1.25 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: '2rem', letterSpacing: '-0.02em', lineHeight: 1,
            color: status === 'skipped' ? 'text.disabled' : D.terra }}>
            {qtyLabel(item)}
          </Typography>
          {item.quantityType === 'per_night' && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', color: 'text.secondary' }}>
              for {nights} night{nights === 1 ? '' : 's'}
            </Typography>
          )}
        </Box>

        {/* Context */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 2.5 }}>
          {item.preTravelAction && status !== 'packed' && (
            <Note Icon={WarningAmberIcon} tone="warning" label="Before you go"
              text={item.preTravelNote || 'Needs doing before it goes in the bag'} />
          )}
          {item.advisoryNote && <Note Icon={InfoOutlinedIcon} text={item.advisoryNote} />}
          {item.conditionReason && item.conditionReason !== item.advisoryNote && (
            <Note Icon={AutoAwesomeIcon} label="Why it’s on the list" text={item.conditionReason} />
          )}
        </Box>
      </Box>

      {/* Status */}
      <Box sx={{ flexShrink: 0, minHeight: 28 }}>
        {status === 'packed' && <StatusStamp Icon={CheckCircleIcon} text="Packed" color={D.green} />}
        {status === 'skipped' && <StatusStamp Icon={DoNotDisturbAltIcon} text="Not bringing" color="rgba(44,62,80,0.55)" />}
      </Box>
    </Box>
  );
}

function Note({ Icon, text, label, tone }: {
  Icon: React.ElementType; text: string; label?: string; tone?: 'warning';
}) {
  const warn = tone === 'warning';
  return (
    <Box sx={{
      display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.25, borderRadius: 1.5,
      backgroundColor: warn ? 'rgba(237,108,2,0.07)' : 'rgba(44,62,80,0.04)',
    }}>
      <Icon sx={{ fontSize: 18, mt: '1px', flexShrink: 0, color: warn ? 'warning.main' : 'text.secondary' }} />
      <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', lineHeight: 1.45, color: warn ? 'warning.dark' : D.navy }}>
        {label && <Box component="span" sx={{ fontWeight: 700 }}>{label}: </Box>}
        {text}
      </Typography>
    </Box>
  );
}

function StatusStamp({ Icon, text, color }: { Icon: React.ElementType; text: string; color: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color }}>
      <Icon sx={{ fontSize: 22 }} />
      <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', letterSpacing: '-0.01em', color }}>
        {text}
      </Typography>
    </Box>
  );
}

function SummaryCard({ packed, skipped, todo, onNext, onClose }: {
  packed: number; skipped: number; todo: number; onNext: () => void; onClose: () => void;
}) {
  const done = todo === 0;
  return (
    <Box data-card role="group" aria-roledescription="slide" aria-label="Summary"
      sx={{ ...cardSx, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1.5 }}>
      {done
        ? <CheckCircleIcon sx={{ fontSize: 64, color: D.green }} />
        : <ChecklistIcon sx={{ fontSize: 56, color: D.terra }} />}
      <Typography sx={{ fontFamily: D.display, fontSize: '1.9rem', letterSpacing: '-0.02em', color: D.navy, lineHeight: 1.1 }}>
        {done ? 'Everything’s sorted' : `${todo} still to pack`}
      </Typography>
      <Typography sx={{ fontFamily: D.body, fontSize: '0.95rem', color: 'text.secondary' }}>
        {packed} packed · {skipped} not bringing
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!done && (
          <Button variant="contained" onClick={onNext}
            sx={{ fontFamily: D.display, textTransform: 'none', boxShadow: 'none', backgroundColor: D.green,
              minHeight: 52, px: 3, '&:hover': { backgroundColor: '#5c6b4f', boxShadow: 'none' } }}>
            Next to pack
          </Button>
        )}
        <Button variant="outlined" onClick={onClose}
          sx={{ fontFamily: D.body, fontWeight: 700, textTransform: 'none', minHeight: 52, px: 3,
            borderColor: 'rgba(44,62,80,0.25)', color: D.navy }}>
          Back to the list
        </Button>
      </Box>
    </Box>
  );
}
