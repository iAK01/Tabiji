'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box, ButtonBase, Dialog, Drawer, Fab, IconButton, Link, Menu, MenuItem, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography, Zoom, alpha, useMediaQuery, useTheme,
} from '@mui/material';
import CurrencyExchangeIcon  from '@mui/icons-material/CurrencyExchange';
import SwapVertIcon          from '@mui/icons-material/SwapVert';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import ArrowDropDownIcon     from '@mui/icons-material/ArrowDropDown';
import CloseIcon             from '@mui/icons-material/Close';
import { localYmd } from '@/lib/trips/onTrip';
import { RATES_CREDIT } from '@/lib/currency/rates';
import {
  evaluate, hasSum, lookupAmounts, money, MULTI_BUYS, PERCENTS_OFF, press, rateLine, showExpr, type Key,
} from '@/lib/currency/calc';

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(44,62,80,0.5)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

const STALE_MS = 2 * 86_400_000;

interface FxData {
  home:       string | null;
  currencies: { code: string; country: string; spans: { from: string; to: string }[] }[];
  rates:      Record<string, number> | null;   // units of each currency to 1 home
  asOf:       number | null;
}

// Last good answer per trip, for browsers without the service worker's saved copy
const savedKey = (tripId: string) => `tabiji:fx:${tripId}`;
function readSaved(tripId: string): FxData | null {
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey(tripId)) ?? 'null');
    return saved && Array.isArray(saved.currencies) ? saved : null;
  } catch { return null; }
}
function writeSaved(tripId: string, data: FxData) {
  try { localStorage.setItem(savedKey(tripId), JSON.stringify(data)); } catch { /* private mode */ }
}

// Where you are today: the destination whose dates hold today, the most specific one
// if several do (the main destination's dates span the whole trip)
function todaysCurrency(currencies: FxData['currencies']): string | null {
  const today = localYmd();
  let best: { code: string; len: number } | null = null;
  for (const c of currencies) {
    for (const s of c.spans) {
      if (s.from > today || today > s.to) continue;
      const len = Date.parse(s.to) - Date.parse(s.from);
      if (!best || len < best.len) best = { code: c.code, len };
    }
  }
  return best?.code ?? currencies[0]?.code ?? null;
}

const KEYBOARD: Record<string, Key> = {
  '+': '+', '-': '−', '*': '×', 'x': '×', 'X': '×', '/': '÷', '.': '.', ',': '.',
  'Backspace': 'back', 'Delete': 'clear', 'c': 'clear', 'C': 'clear', 'Enter': '=', '=': '=',
};

type Mode = 'convert' | 'off' | 'multi';

/**
 * The currency converter: a FAB that opens a calculator sheet converting between
 * home and the trip's currency, with % off (haggling, sales) and multi-buy deals.
 * Shows only when the trip has a currency other than home. `raised` stacks it above
 * the trip page's quick-add FAB; `hidden` tucks it away while that FAB's menu is open.
 */
export default function CurrencyConverter({ tripId, raised = false, hidden = false }: {
  tripId:  string;
  raised?: boolean;
  hidden?: boolean;
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [data,       setData]       = useState<FxData | null>(null);
  const [open,       setOpen]       = useState(false);
  const [picked,     setPicked]     = useState<string | null>(null);   // null: today's currency
  const [typingHome, setTypingHome] = useState(false);
  const [expr,       setExpr]       = useState('');
  const [mode,       setMode]       = useState<Mode>('convert');
  const [customPct,  setCustomPct]  = useState('');
  const [pickerAt,   setPickerAt]   = useState<HTMLElement | null>(null);

  useEffect(() => {
    let gone = false;
    const saved = readSaved(tripId);
    setData(saved);
    fetch(`/api/trips/${tripId}/currency`)
      .then(async res => {
        const body: FxData | null = await res.json().catch(() => null);
        if (gone || !body || !Array.isArray(body.currencies)) return;
        if (res.ok) { setData(body); writeSaved(tripId, body); return; }
        // Rates unavailable and nothing saved by the worker: keep the rates we have
        setData(prev => prev?.rates && prev.home === body.home ? { ...prev, currencies: body.currencies } : body);
      })
      .catch(() => { /* offline with nothing saved: the saved copy (if any) stands */ });
    return () => { gone = true; };
  }, [tripId]);

  // Typing on a keyboard (desktop), except into the % field
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      const key: Key | undefined = /^\d$/.test(e.key) ? e.key as Key : KEYBOARD[e.key];
      if (!key) return;
      e.preventDefault();
      setExpr(x => press(x, key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const currencies = data?.currencies ?? [];
  const home       = data?.home ?? null;
  const local      = (picked && currencies.some(c => c.code === picked) ? picked : null) ?? todaysCurrency(currencies);
  const rate       = local ? data?.rates?.[local] ?? null : null;

  const from   = typingHome ? home! : local!;
  const to     = typingHome ? local! : home!;
  const amount = evaluate(expr);
  const convert = (n: number): number | null => rate ? (typingHome ? n * rate : n / rate) : null;
  const converted = amount !== null ? convert(amount) : null;

  const custom = customPct ? Number(customPct.replace(',', '.')) : NaN;
  const pcts = useMemo(() => {
    const list = [...PERCENTS_OFF];
    if (custom > 0 && custom < 100 && !list.includes(custom)) list.push(custom);
    return list.sort((a, b) => a - b);
  }, [custom]);

  if (!home || !local) return null;

  const multiple = currencies.length > 1;
  const stale    = data?.asOf ? Date.now() - data.asOf > STALE_MS : false;
  const asOfDate = data?.asOf ? new Date(data.asOf).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '';
  const key      = (k: Key) => setExpr(x => press(x, k));

  // ── Pieces ──────────────────────────────────────────────────────────────────

  const codeLabel = (code: string) => {
    const pickable = multiple && code === local;
    const label = (
      <Typography component="span" sx={{ fontFamily: D.body, fontWeight: 800, fontSize: '0.95rem', color: D.navy, letterSpacing: '0.02em' }}>
        {code}
      </Typography>
    );
    if (!pickable) return <Box sx={{ minWidth: 56, display: 'flex', alignItems: 'center', minHeight: 44 }}>{label}</Box>;
    return (
      <ButtonBase
        onClick={e => setPickerAt(e.currentTarget)}
        aria-label={`Currency: ${code}. Change`}
        sx={{ minWidth: 56, minHeight: 44, pl: 1, pr: 0.25, ml: -1, borderRadius: 2, display: 'flex', alignItems: 'center',
              '&:hover': { backgroundColor: alpha(D.navy, 0.05) } }}
      >
        {label}
        <ArrowDropDownIcon sx={{ color: D.muted }} />
      </ButtonBase>
    );
  };

  const bigSize = (text: string) => text.length > 22 ? '1.1rem' : text.length > 14 ? '1.45rem' : '1.9rem';
  const typed   = expr ? showExpr(expr).trim() : '0';
  const result  = converted !== null ? money(converted, to) : rate ? money(0, to) : '—';

  const sectionLabel = (text: string) => (
    <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: D.muted, mt: 1.5, mb: 0.5 }}>
      {text}
    </Typography>
  );

  const row = (k: string | number, left: React.ReactNode, mid: React.ReactNode, right: React.ReactNode, highlight = false) => (
    <Box key={k} sx={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', columnGap: 1.5,
      minHeight: 44, px: 1.25, py: 0.5, borderRadius: 2,
      backgroundColor: highlight ? alpha(D.green, 0.1) : 'transparent',
      borderBottom: highlight ? 'none' : `1px solid ${alpha(D.navy, 0.06)}`,
    }}>
      {left}{mid}{right}
    </Box>
  );

  const note = (what: string) => (
    <Typography sx={{ fontFamily: D.body, fontSize: '0.9rem', color: D.muted, py: 3, textAlign: 'center' }}>
      {what}
    </Typography>
  );

  let panel: React.ReactNode;
  if (!rate) {
    panel = note(`No ${local} rate saved yet. It loads the next time you're online.`);
  } else if (mode === 'convert') {
    panel = (
      <>
        {sectionLabel('Quick look')}
        {lookupAmounts(typingHome ? 1 : rate).map(n => row(n,
          <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.92rem', color: D.navy, minWidth: 90 }}>{money(n, from)}</Typography>,
          <span />,
          <Typography sx={{ fontFamily: D.body, fontWeight: 600, fontSize: '0.92rem', color: D.green }}>{money(convert(n)!, to)}</Typography>,
        ))}
      </>
    );
  } else if (mode === 'off') {
    panel = amount === null || amount <= 0 ? note('Type the price to see it with money off.') : (
      <>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1 }}>
          {sectionLabel(`${money(amount, from)} with`)}
          <TextField
            size="small" placeholder="Other" value={customPct}
            onChange={e => setCustomPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Other percent off' }}
            InputProps={{ endAdornment: <Typography sx={{ fontSize: '0.85rem', color: D.muted }}>% off</Typography> }}
            sx={{ width: 118, mt: 1, '& .MuiInputBase-root': { fontFamily: D.body, fontSize: '0.9rem', backgroundColor: '#fff' } }}
          />
        </Box>
        {pcts.map(p => {
          const after = amount * (1 - p / 100);
          return row(p,
            <Typography sx={{ fontFamily: D.body, fontWeight: 800, fontSize: '0.88rem', color: D.terra, minWidth: 48 }}>
              {p.toLocaleString('en-IE', { maximumFractionDigits: 1 })}% off
            </Typography>,
            <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.92rem', color: D.navy }}>{money(after, from)}</Typography>,
            <Typography sx={{ fontFamily: D.body, fontWeight: 600, fontSize: '0.92rem', color: D.green }}>{money(convert(after)!, to)}</Typography>,
            p === custom,
          );
        })}
      </>
    );
  } else {
    panel = amount === null || amount <= 0 ? note('Type the price of one to compare the offers.') : (
      <>
        {sectionLabel(`${money(amount, from)} each, on`)}
        {MULTI_BUYS.map(m => {
          const total = amount * m.payFor;
          const each  = total / m.items;
          const off   = (1 - m.payFor / m.items) * 100;
          return (
            <Box key={m.label} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
              minHeight: 52, px: 1.25, py: 0.75, borderBottom: `1px solid ${alpha(D.navy, 0.06)}`,
            }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.9rem', color: D.navy }}>{m.label}</Typography>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                  {money(total, from)} for {m.items} · {off.toLocaleString('en-IE', { maximumFractionDigits: 1 })}% off each
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.92rem', color: D.green }}>
                  {money(convert(each)!, to)} each
                </Typography>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                  {money(convert(total)!, to)} for {m.items}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </>
    );
  }

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: isMobile ? 0.25 : 1.5, pb: 0.5, flexShrink: 0 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, flexGrow: 1 }}>Currency</Typography>
        <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ width: 44, height: 44, mr: -1 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── What you typed, and what it comes to ── */}
      <Box sx={{ mx: 2, px: 1.75, py: 0.75, borderRadius: 3, backgroundColor: D.paper,
                 border: `1px solid ${alpha(D.navy, 0.08)}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {codeLabel(from)}
          <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: bigSize(typed), lineHeight: 1.2,
                              color: expr ? D.navy : alpha(D.navy, 0.3), overflowWrap: 'anywhere' }}>
              {typed}
            </Typography>
            {hasSum(expr) && amount !== null && (
              <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted }}>= {money(amount, from)}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: alpha(D.navy, 0.08) }} />
          <Tooltip title={`Type in ${to} instead`}>
            <IconButton onClick={() => setTypingHome(h => !h)} aria-label={`Type in ${to} instead`}
              sx={{ width: 44, height: 44, color: D.green, border: `1px solid ${alpha(D.green, 0.3)}`, backgroundColor: '#fff',
                    '&:hover': { backgroundColor: alpha(D.green, 0.08) } }}>
              <SwapVertIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: alpha(D.navy, 0.08) }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {codeLabel(to)}
          <Typography aria-live="polite" sx={{ flex: 1, minWidth: 0, textAlign: 'right', fontFamily: D.display,
                              fontSize: bigSize(result), lineHeight: 1.2, color: D.green, overflowWrap: 'anywhere' }}>
            {result}
          </Typography>
        </Box>
      </Box>

      {rate && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: stale ? D.terra : D.muted, px: 2.25, pt: 0.75, flexShrink: 0 }}>
          {rateLine(rate, home, local)} · mid-market · {stale ? `rate from ${asOfDate}` : asOfDate}
        </Typography>
      )}

      <ToggleButtonGroup
        exclusive fullWidth value={mode} onChange={(_, v) => v && setMode(v)}
        sx={{ px: 2, pt: 1, flexShrink: 0,
              '& .MuiToggleButton-root': { fontFamily: D.body, fontWeight: 700, textTransform: 'none', fontSize: '0.85rem',
                                           minHeight: 44, color: D.navy, borderColor: alpha(D.navy, 0.15) },
              '& .Mui-selected': { backgroundColor: `${alpha(D.green, 0.14)} !important`, color: `${D.green} !important` } }}
      >
        <ToggleButton value="convert">Convert</ToggleButton>
        <ToggleButton value="off">% off</ToggleButton>
        <ToggleButton value="multi">Multi-buy</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pb: 1 }}>
        {panel}
        {rate && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', color: D.muted, textAlign: 'center', mt: 1.5 }}>
            <Link href={RATES_CREDIT.href} target="_blank" rel="noopener" color="inherit">{RATES_CREDIT.label}</Link>
          </Typography>
        )}
      </Box>

      <Keypad onKey={key} />
    </Box>
  );

  return (
    <>
      <Zoom in={!hidden}>
        <Tooltip title="Currency converter" placement="left">
          <Fab
            size={raised ? 'medium' : 'large'}
            onClick={() => setOpen(true)}
            aria-label="Currency converter"
            sx={{
              position: 'fixed', zIndex: 1050,
              right:  raised ? { xs: 20, sm: 36 }  : { xs: 16, sm: 32 },
              bottom: raised ? { xs: 96, sm: 104 } : { xs: 24, sm: 32 },
              backgroundColor: D.navy, color: 'white',
              boxShadow: `0 4px 20px ${alpha(D.navy, 0.3)}`,
              '&:hover': { backgroundColor: '#1F2D3A' },
            }}
          >
            <CurrencyExchangeIcon />
          </Fab>
        </Tooltip>
      </Zoom>

      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={() => setOpen(false)}
          PaperProps={{ sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '92vh',
                              display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: D.bg } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.25, flexShrink: 0 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.12) }} />
          </Box>
          {body}
        </Drawer>
      ) : (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '14px', height: 'min(780px, 90vh)', display: 'flex', flexDirection: 'column',
                              overflow: 'hidden', backgroundColor: D.bg } }}>
          {body}
        </Dialog>
      )}

      <Menu anchorEl={pickerAt} open={!!pickerAt} onClose={() => setPickerAt(null)}>
        {currencies.map(c => (
          <MenuItem key={c.code} selected={c.code === local} sx={{ fontFamily: D.body, minHeight: 44 }}
            onClick={() => { setPicked(c.code); setPickerAt(null); }}>
            <Box component="span" sx={{ fontWeight: 800, mr: 1 }}>{c.code}</Box>
            <Box component="span" sx={{ color: D.muted }}>{c.country}</Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// ─── Keypad ───────────────────────────────────────────────────────────────────

const PAD: { k: Key; area: string; kind: 'num' | 'op' | 'clear' | 'eq'; label?: React.ReactNode; aria?: string }[] = [
  { k: 'clear', area: 'c',   kind: 'clear', label: 'C', aria: 'Clear' },
  { k: 'back',  area: 'b',   kind: 'clear', label: <BackspaceOutlinedIcon />, aria: 'Delete' },
  { k: '÷',     area: 'div', kind: 'op', aria: 'Divide' },
  { k: '×',     area: 'mul', kind: 'op', aria: 'Times' },
  { k: '7', area: 'n7', kind: 'num' }, { k: '8', area: 'n8', kind: 'num' }, { k: '9', area: 'n9', kind: 'num' },
  { k: '−',     area: 'sub', kind: 'op', aria: 'Minus' },
  { k: '4', area: 'n4', kind: 'num' }, { k: '5', area: 'n5', kind: 'num' }, { k: '6', area: 'n6', kind: 'num' },
  { k: '+',     area: 'add', kind: 'op', aria: 'Plus' },
  { k: '1', area: 'n1', kind: 'num' }, { k: '2', area: 'n2', kind: 'num' }, { k: '3', area: 'n3', kind: 'num' },
  { k: '=',     area: 'eq',  kind: 'eq', aria: 'Equals' },
  { k: '0', area: 'n0', kind: 'num' },
  { k: '.',     area: 'dot', kind: 'num', aria: 'Point' },
];

function Keypad({ onKey }: { onKey: (k: Key) => void }) {
  return (
    <Box sx={{
      display: 'grid', gap: 0.75, px: 2, pt: 1, pb: 'calc(env(safe-area-inset-bottom) + 12px)', flexShrink: 0,
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridAutoRows: 'clamp(44px, 6.4vh, 58px)',
      gridTemplateAreas: `"c b div mul" "n7 n8 n9 sub" "n4 n5 n6 add" "n1 n2 n3 eq" "n0 n0 dot eq"`,
      borderTop: `1px solid ${alpha(D.navy, 0.08)}`, backgroundColor: alpha(D.navy, 0.03),
    }}>
      {PAD.map(({ k, area, kind, label, aria }) => (
        <ButtonBase
          key={k}
          onClick={() => onKey(k)}
          aria-label={aria ?? k}
          sx={{
            gridArea: area, borderRadius: 2.5, touchAction: 'manipulation', userSelect: 'none',
            fontFamily: D.body, fontSize: kind === 'num' ? '1.4rem' : '1.35rem', fontWeight: kind === 'num' ? 600 : 700,
            color:           kind === 'eq' ? '#fff' : kind === 'op' ? D.green : kind === 'clear' ? D.terra : D.navy,
            backgroundColor: kind === 'eq' ? D.green : kind === 'op' ? alpha(D.green, 0.12) : kind === 'clear' ? alpha(D.terra, 0.1) : '#fff',
            boxShadow: kind === 'num' ? `0 1px 2px ${alpha(D.navy, 0.12)}` : 'none',
            '&:active': { filter: 'brightness(0.92)' },
          }}
        >
          {label ?? k}
        </ButtonBase>
      ))}
    </Box>
  );
}
