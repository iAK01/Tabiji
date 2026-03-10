'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  LinearProgress, Chip, Checkbox,
  Collapse, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Divider, useTheme, useMediaQuery, Alert,
  Switch, FormControlLabel, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddIcon           from '@mui/icons-material/Add';
import RefreshIcon       from '@mui/icons-material/Refresh';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import ExpandLessIcon    from '@mui/icons-material/ExpandLess';
import FilterListIcon    from '@mui/icons-material/FilterList';
import WbSunnyIcon       from '@mui/icons-material/WbSunny';
import InfoOutlinedIcon  from '@mui/icons-material/InfoOutlined';
import TuneIcon          from '@mui/icons-material/Tune';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Documents', 'Electronics', 'Clothes', 'Toiletries',
  'Medicines', 'Work Gear', 'Luggage', 'Accessories', 'Other',
];

const TRIP_TYPES      = ['always', 'work', 'leisure', 'mixed'];
const TRANSPORT_TYPES = ['plane', 'train', 'car', 'ferry', 'bus'];
const ACCOM_TYPES     = ['hotel', 'airbnb', 'hostel', 'camping', 'family'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackingItem {
  name:             string;
  category:         string;
  quantity:         number;
  quantityType:     string;
  essential:        boolean;
  packed:           boolean;
  packedAt:         string | null;
  preTravelAction:  boolean;
  preTravelNote:    string;
  advisoryNote:     string;
  conditionReason?: string;
  photoUrl?:        string;
  source:           'auto' | 'manual';
  masterItemId?:    string;
}

type IndexedItem = PackingItem & { _idx: number };

interface PackingList {
  _id:              string;
  tripId:           string;
  items:            PackingItem[];
  totalItems:       number;
  packedItems:      number;
  packingProgress:  number;
  generatedAt:      string;
  generationParams: {
    nights:             number;
    tripType:           string;
    transportTypes:     string[];
    accommodationTypes: string[];
    weatherSnapshot?: {
      avgHigh:   number;
      avgLow:    number;
      minLow:    number;
      maxHigh:   number;
      hasRain:   boolean;
      heavyRain: boolean;
      rainDays:  number;
    } | null;
    sameCurrencyZone?: boolean;
  };
}

interface PackingTabProps {
  tripId:    string;
  tripType:  string;
  nights:    number;
  startDate: string;
  fabTrigger?: { action: string; seq: number } | null;
}

interface CatalogueEditState {
  masterItemId:       string;
  name:               string;
  essential:          boolean;
  tripTypes:          string[];
  transportTypes:     string[];
  accommodationTypes: string[];
  quantity:           number;
  quantityType:       'fixed' | 'per_night';
  quantityMin:        number;
  quantityMax:        number;
  preTravelAction:    boolean;
  preTravelNote:      string;
  advisoryNote:       string;
}

// ─── Quantity label ───────────────────────────────────────────────────────────

function qtyLabel(item: PackingItem): string {
  const q    = item.quantity;
  const name = item.name.toLowerCase();
  if (name.includes('underwear') || name.includes('sock'))    return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('shirt') || name.includes('t-shirt'))     return `${q} shirt${q !== 1 ? 's' : ''}`;
  if (name.includes('trouser') || name.includes('jean') ||
      name.includes('pant')   || name.includes('short'))      return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('shoe')   || name.includes('boot'))       return `${q} pair${q !== 1 ? 's' : ''}`;
  if (name.includes('cable')  || name.includes('charger'))    return `${q} cable${q !== 1 ? 's' : ''}`;
  if (name.includes('battery') || name.includes('batteries')) return `${q} spare${q !== 1 ? 's' : ''}`;
  if (q === 1) return '× 1';
  return `× ${q}`;
}

// ─── Toggle group helper ──────────────────────────────────────────────────────

function TypeToggleGroup({
  label, options, value, onChange, hint,
}: {
  label:    string;
  options:  string[];
  value:    string[];
  onChange: (val: string[]) => void;
  hint?:    string;
}) {
  return (
    <Box>
      <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>
        {label}
      </Typography>
      {hint && (
        <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem', display: 'block', mb: 1, color: 'text.secondary' }}>
          {hint}
        </Typography>
      )}
      <ToggleButtonGroup value={value} onChange={(_, val) => onChange(val)} fullWidth size="small">
        {options.map(t => (
          <ToggleButton key={t} value={t}
            sx={{ fontFamily: D.body, fontSize: '0.72rem', textTransform: 'none', fontWeight: 600, py: 0.75 }}>
            {t}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.disabled', mt: 0.5, display: 'block' }}>
        {value.length === 0 ? 'No filter — included on all trips' : `Only included when trip has: ${value.join(', ')}`}
      </Typography>
    </Box>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PackingTab({ tripId, tripType, nights, startDate, fabTrigger }: PackingTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [packing,          setPacking]          = useState<PackingList | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [generating,       setGenerating]       = useState(false);
  const [toggling,         setToggling]         = useState<number | null>(null);
  const [addOpen,          setAddOpen]          = useState(false);
  const [preTravel,        setPreTravel]        = useState(false);
  const [filterOpen,       setFilterOpen]       = useState(false);
  const [filter,           setFilter]           = useState<'all' | 'unpacked' | 'packed'>('all');
  const [expanded,         setExpanded]         = useState<Record<string, boolean>>({});
  const [newItem,          setNewItem]          = useState({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });
  const [catalogueEdit,    setCatalogueEdit]    = useState<CatalogueEditState | null>(null);
  const [catalogueSaving,  setCatalogueSaving]  = useState(false);
  const [creatingAdvisory, setCreatingAdvisory] = useState(false);
  const [advisoryCreated,  setAdvisoryCreated]  = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/packing`)
      .then(r => r.json())
      .then(d => { setPacking(d.packing ?? null); setLoading(false); });
  }, [tripId]);

  const tripStartsInDays = startDate
    ? Math.floor((new Date(startDate).getTime() - Date.now()) / 86400000)
    : 999;
  const weatherAgeHours = packing?.generatedAt
    ? Math.floor((Date.now() - new Date(packing.generatedAt).getTime()) / 3600000)
    : 0;
  const showLiveRefresh = tripStartsInDays <= 14 && tripStartsInDays >= 0 && weatherAgeHours >= 24;

  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.action === 'item') setAddOpen(true);
  }, [fabTrigger]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const generate = async () => {
    setGenerating(true);
    const res  = await fetch(`/api/trips/${tripId}/packing/generate`, { method: 'POST' });
    const data = await res.json();
    setPacking(data.packing);
    setGenerating(false);
  };

  const toggleItem = async (originalIndex: number) => {
    if (!packing || toggling !== null) return;
    const newPackedValue = !packing.items[originalIndex].packed;
    setToggling(originalIndex);
    const updated     = packing.items.map((item, i) =>
      i === originalIndex ? { ...item, packed: newPackedValue } : item
    );
    const packedCount = updated.filter(i => i.packed).length;
    setPacking(p => p ? { ...p, items: updated, packedItems: packedCount,
      packingProgress: Math.round((packedCount / updated.length) * 100) } : p);
    try {
      const res  = await fetch(`/api/trips/${tripId}/packing`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIndex: originalIndex, packed: newPackedValue }),
      });
      const data = await res.json();
      if (data.packing) setPacking(data.packing);
    } catch {
      setPacking(p => p ? { ...p, items: packing.items } : p);
    } finally {
      setToggling(null);
    }
  };

  const openCatalogueEdit = (item: IndexedItem) => {
    if (!item.masterItemId) return;
    setCatalogueEdit({
      masterItemId:       item.masterItemId,
      name:               item.name,
      essential:          item.essential,
      tripTypes:          ['always'],
      transportTypes:     [],
      accommodationTypes: [],
      quantity:           item.quantity,
      quantityType:       item.quantityType as 'fixed' | 'per_night',
      quantityMin:        1,
      quantityMax:        10,
      preTravelAction:    item.preTravelAction,
      preTravelNote:      item.preTravelNote,
      advisoryNote:       item.advisoryNote,
    });
    fetch(`/api/packing/catalogue/${item.masterItemId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.item) return;
        setCatalogueEdit(prev => prev ? {
          ...prev,
          essential:          data.item.essential,
          tripTypes:          data.item.tripTypes          ?? ['always'],
          transportTypes:     data.item.transportTypes     ?? [],
          accommodationTypes: data.item.accommodationTypes ?? [],
          quantity:           data.item.quantity,
          quantityType:       data.item.quantityType,
          quantityMin:        data.item.quantityMin ?? 1,
          quantityMax:        data.item.quantityMax ?? 10,
          preTravelAction:    data.item.preTravelAction,
          preTravelNote:      data.item.preTravelNote ?? '',
          advisoryNote:       data.item.advisoryNote  ?? '',
        } : null);
      })
      .catch(() => {});
  };

  const saveCatalogueEdit = async () => {
    if (!catalogueEdit) return;
    setCatalogueSaving(true);
    const res  = await fetch(`/api/packing/catalogue/${catalogueEdit.masterItemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        essential:          catalogueEdit.essential,
        tripTypes:          catalogueEdit.tripTypes,
        transportTypes:     catalogueEdit.transportTypes,
        accommodationTypes: catalogueEdit.accommodationTypes,
        quantity:           catalogueEdit.quantity,
        quantityType:       catalogueEdit.quantityType,
        quantityMin:        catalogueEdit.quantityMin,
        quantityMax:        catalogueEdit.quantityMax,
        preTravelAction:    catalogueEdit.preTravelAction,
        preTravelNote:      catalogueEdit.preTravelNote,
        advisoryNote:       catalogueEdit.advisoryNote,
      }),
    });
    const data = await res.json();
    if (data.item && packing) {
      const updatedItems = packing.items.map(i =>
        i.masterItemId === catalogueEdit.masterItemId
          ? { ...i, essential: data.item.essential, preTravelAction: data.item.preTravelAction,
              preTravelNote: data.item.preTravelNote ?? '', advisoryNote: data.item.advisoryNote ?? '' }
          : i
      );
      setPacking(p => p ? { ...p, items: updatedItems } : p);
    }
    setCatalogueEdit(null);
    setCatalogueSaving(false);
  };

  const addItem = async () => {
    const res  = await fetch(`/api/trips/${tripId}/packing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const data = await res.json();
    setPacking(data.packing);
    setAddOpen(false);
    setNewItem({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });
  };

  const createPackingAdvisory = async (items: IndexedItem[]) => {
    if (!items.length || creatingAdvisory || advisoryCreated) return;
    setCreatingAdvisory(true);
    const bodyLines      = items.map(item =>
      item.preTravelNote ? `• ${item.name}: ${item.preTravelNote}` : `• ${item.name}`
    );
    const packingItemRef = items.map(i => i.name).join(', ');
    const fd = new FormData();
    fd.append('resourceType',    'todo');
    fd.append('name',            'Pre-travel checklist');
    fd.append('body',            bodyLines.join('\n'));
    fd.append('source',          'packing_advisory');
    fd.append('packingItemRef',  packingItemRef);
    fd.append('notification.enabled', 'false');
    try {
      const res = await fetch(`/api/trips/${tripId}/files`, { method: 'POST', body: fd });
      if (res.ok) setAdvisoryCreated(true);
    } catch {
      // Silently fail
    } finally {
      setCreatingAdvisory(false);
    }
  };

  // ── Loading / empty ───────────────────────────────────────────────────────

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress sx={{ color: D.green }} />
    </Box>
  );

  if (!packing) return (
    <Paper elevation={0} sx={{
      p: { xs: 4, sm: 6 }, textAlign: 'center',
      backgroundColor: D.paper,
      border: `1.5px solid rgba(44,62,80,0.08)`,
      borderRadius: 2.5,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ghost watermark */}
      <Typography sx={{
        fontFamily: D.display,
        fontSize: { xs: '4rem', sm: '7rem' },
        letterSpacing: '-0.04em', lineHeight: 0.85,
        color: 'rgba(44,62,80,0.05)',
        userSelect: 'none', pointerEvents: 'none',
        position: 'absolute', bottom: -8, right: -8,
      }}>
        PACK
      </Typography>

      <AutoAwesomeIcon sx={{ fontSize: 48, color: D.green, opacity: 0.5, mb: 2 }} />
      <Typography sx={{
        fontFamily: D.display, fontSize: { xs: '1.6rem', sm: '2rem' },
        letterSpacing: '-0.03em', color: D.navy, mb: 0.75,
      }}>
        Generate your packing list
      </Typography>
      <Typography sx={{ fontFamily: D.body, fontWeight: 600, color: D.terra, fontSize: '0.8rem',
        letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
        {nights} nights · {tripType}
      </Typography>
      <Typography sx={{ fontFamily: D.body, color: 'text.secondary', fontSize: '0.88rem',
        mb: 4, maxWidth: 360, mx: 'auto', lineHeight: 1.6 }}>
        We'll build a smart list based on your trip type, duration, transport, accommodation, and weather forecast.
      </Typography>
      <Button variant="contained" size="large" fullWidth={mobile}
        startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
        onClick={generate} disabled={generating}
        sx={{
          fontFamily: D.display, letterSpacing: '-0.01em',
          backgroundColor: D.navy, boxShadow: 'none',
          py: mobile ? 1.75 : 1.5, px: 3,
          '&:hover': { backgroundColor: 'rgba(44,62,80,0.88)', boxShadow: 'none' },
        }}>
        {generating ? 'Generating…' : 'Generate Packing List'}
      </Button>
    </Paper>
  );

  // ── Derived state ─────────────────────────────────────────────────────────

  const indexedItems: IndexedItem[] = packing.items.map((item, i) => ({ ...item, _idx: i }));
  const preTravelItems = indexedItems.filter(i => i.preTravelAction && !i.packed);
  const allDone        = packing.packingProgress === 100;
  const ws             = packing.generationParams?.weatherSnapshot;

  const filtered = indexedItems.filter(i => {
    if (filter === 'unpacked') return !i.packed;
    if (filter === 'packed')   return  i.packed;
    return true;
  });

  const sortGroup = (arr: IndexedItem[]) =>
    [...arr].sort((a, b) => {
      if (a.packed !== b.packed) return Number(a.packed) - Number(b.packed);
      return Number(b.essential) - Number(a.essential);
    });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length) acc[cat] = sortGroup(catItems);
    return acc;
  }, {} as Record<string, IndexedItem[]>);

  const extra = filtered.filter(i => !CATEGORIES.includes(i.category));
  if (extra.length) grouped['Other'] = sortGroup([...(grouped['Other'] ?? []), ...extra]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>

      {/* ── Weather alert ── */}
      {ws && (ws.hasRain || ws.minLow <= 8 || ws.maxHigh >= 22) && (
        <Alert severity="info" icon={<WbSunnyIcon fontSize="small" />}
          sx={{ mb: 2, fontFamily: D.body, '& .MuiAlert-message': { fontFamily: D.body, fontSize: '0.82rem' } }}>
          This list was tailored to the forecast: {[
            ws.minLow  <= 8  && `lows of ${ws.minLow}°C`,
            ws.maxHigh >= 22 && `highs of ${ws.maxHigh}°C`,
            ws.hasRain       && `rain on ${ws.rainDays} day${ws.rainDays !== 1 ? 's' : ''}`,
          ].filter(Boolean).join(', ')}.
          {showLiveRefresh && ' Live forecast now available — refresh to update.'}
        </Alert>
      )}

      {showLiveRefresh && !ws && (
        <Alert severity="info" icon={<WbSunnyIcon fontSize="small" />}
          action={
            <Button size="small" color="inherit" onClick={generate} disabled={generating}
              startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon fontSize="small" />}
              sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.75rem' }}>
              {generating ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
          sx={{ mb: 2, '& .MuiAlert-message': { fontFamily: D.body, fontSize: '0.82rem' } }}>
          Your trip is in {tripStartsInDays} day{tripStartsInDays !== 1 ? 's' : ''} — live weather now available.
        </Alert>
      )}

      {/* ── Progress card ── */}
      <Paper elevation={0} sx={{
        p: { xs: 2.5, sm: 3 }, mb: 2.5,
        backgroundColor: D.paper,
        border: `1.5px solid rgba(44,62,80,0.08)`,
        borderRadius: 2.5,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{
            fontFamily: D.display,
            fontSize: { xs: '1.1rem', sm: '1.3rem' },
            letterSpacing: '-0.02em',
            color: D.navy,
          }}>
            {nights} nights · {tripType}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" variant="outlined" startIcon={<FilterListIcon />}
              onClick={() => setFilterOpen(p => !p)}
              color={filter !== 'all' ? 'primary' : 'inherit'}
              sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.72rem' }}>
              {filter === 'all' ? 'Filter' : filter}
            </Button>
            <IconButton size="small" onClick={generate} disabled={generating} aria-label="Regenerate list">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Filter chips */}
        <Collapse in={filterOpen}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {(['all', 'unpacked', 'packed'] as const).map(f => (
              <Chip key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                onClick={() => { setFilter(f); setFilterOpen(false); }}
                color={filter === f ? 'primary' : 'default'}
                variant={filter === f ? 'filled' : 'outlined'}
                sx={{ fontFamily: D.body, cursor: 'pointer', fontWeight: 700 }} />
            ))}
          </Box>
        </Collapse>

        {/* Progress bar + typographic counter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <LinearProgress variant="determinate" value={packing.packingProgress}
            color={allDone ? 'success' : 'primary'}
            sx={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': { borderRadius: 4 } }} />
          {/* Typographic counter — Archivo Black, terracotta */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, flexShrink: 0 }}>
            <Typography sx={{
              fontFamily: D.display,
              fontSize: '1.25rem',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: allDone ? D.green : D.terra,
            }}>
              {packing.packedItems}
            </Typography>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: 'text.disabled', fontWeight: 600 }}>
              /{packing.totalItems}
            </Typography>
          </Box>
        </Box>

        {allDone && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2,
            backgroundColor: 'success.light', borderRadius: 2, px: 2, py: 1.5 }}>
            <CheckCircleIcon color="success" />
            <Typography sx={{ fontFamily: D.body, fontWeight: 700, color: 'success.dark' }}>
              All packed — you're ready to go!
            </Typography>
          </Box>
        )}

        {/* Summary chips */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`${indexedItems.filter(i => i.essential).length} essentials`}
            size="small" color="primary"
            sx={{ fontFamily: D.body, fontWeight: 700 }} />
          {preTravelItems.length > 0 && (
            <Chip icon={<WarningAmberIcon />}
              label={`${preTravelItems.length} pre-travel action${preTravelItems.length !== 1 ? 's' : ''}`}
              size="small" color="warning" onClick={() => setPreTravel(true)}
              sx={{ fontFamily: D.body, cursor: 'pointer', fontWeight: 700 }} />
          )}
          {indexedItems.filter(i => i.source === 'manual').length > 0 && (
            <Chip label={`${indexedItems.filter(i => i.source === 'manual').length} manual`}
              size="small" variant="outlined"
              sx={{ fontFamily: D.body, fontWeight: 600 }} />
          )}
        </Box>
      </Paper>

      {/* ── Add item button ── */}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
        fullWidth={mobile} size={mobile ? 'large' : 'medium'}
        sx={{
          fontFamily: D.body, fontWeight: 700,
          mb: 2.5, py: mobile ? 1.5 : 1,
          borderColor: 'rgba(44,62,80,0.18)', color: D.navy,
          '&:hover': { borderColor: 'rgba(44,62,80,0.45)', backgroundColor: 'rgba(44,62,80,0.04)' },
        }}>
        Add item
      </Button>

      {/* ── Category sections ── */}
      {Object.entries(grouped).map(([category, catItems]) => {
        const packedCount  = catItems.filter(i => i.packed).length;
        const allCatPacked = packedCount === catItems.length;
        const isOpen       = expanded[category] !== undefined ? expanded[category] : !allCatPacked;

        return (
          <Paper key={category} elevation={0} sx={{
            mb: 1.5,
            backgroundColor: D.paper,
            overflow: 'hidden',
            border: `1.5px solid rgba(44,62,80,0.08)`,
            borderRadius: 2,
          }}>
            {/* Category header */}
            <Box onClick={() => setExpanded(p => ({ ...p, [category]: !isOpen }))} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 1.5 },
              cursor: 'pointer', userSelect: 'none',
              '&:hover': { backgroundColor: 'rgba(44,62,80,0.03)' },
            }}>
              {allCatPacked
                ? <CheckCircleIcon sx={{ fontSize: 18, flexShrink: 0, color: D.green }} />
                : <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid',
                    borderColor: 'divider', flexShrink: 0 }} />
              }
              {/* Category name — Archivo Black */}
              <Typography sx={{
                fontFamily: D.display,
                fontSize: { xs: '0.95rem', sm: '1rem' },
                letterSpacing: '-0.01em',
                color: allCatPacked ? 'text.disabled' : D.navy,
                flexGrow: 1,
              }}>
                {category}
              </Typography>
              {/* Packed count — terracotta when incomplete, muted when done */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3, mr: 0.5 }}>
                <Typography sx={{
                  fontFamily: D.display,
                  fontSize: '0.95rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  color: allCatPacked ? 'text.disabled' : D.terra,
                }}>
                  {packedCount}
                </Typography>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', color: 'text.disabled', fontWeight: 600 }}>
                  /{catItems.length}
                </Typography>
              </Box>
              {isOpen ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.disabled' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
            </Box>

            <Collapse in={isOpen}>
              <Divider />
              {catItems.map(item => (
                <Box key={item._idx}>
                  <Box sx={{
                    display: 'flex', alignItems: 'flex-start',
                    px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 1.25 }, gap: 1.5,
                    opacity: item.packed ? 0.4 : 1, transition: 'opacity 0.2s',
                    '&:hover': { backgroundColor: 'rgba(44,62,80,0.025)' },
                    '&:hover .catalogue-tune': { opacity: 1 },
                    pointerEvents: toggling === item._idx ? 'none' : 'auto',
                  }}>
                    <Checkbox checked={item.packed} onChange={() => toggleItem(item._idx)}
                      sx={{ p: 0, flexShrink: 0, mt: 0.25, color: D.green,
                        '&.Mui-checked': { color: D.green } }} />

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                        {/* Item name */}
                        <Typography sx={{
                          fontFamily: D.body,
                          fontWeight: item.essential ? 700 : 400,
                          fontSize: { xs: '0.95rem', sm: '0.9rem' },
                          textDecoration: item.packed ? 'line-through' : 'none',
                          color: D.navy,
                        }}>
                          {item.name}
                        </Typography>

                        {/* Quantity — Archivo Black, terracotta, jumps out */}
                        {item.quantity > 1 && (
                          <Typography sx={{
                            fontFamily: D.display,
                            fontSize: '0.82rem',
                            letterSpacing: '-0.01em',
                            color: item.packed ? 'text.disabled' : D.terra,
                            flexShrink: 0,
                          }}>
                            {qtyLabel(item)}
                          </Typography>
                        )}
                      </Box>

                      {item.advisoryNote && !item.packed && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                          <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', mt: 0.25, flexShrink: 0 }} />
                          <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem',
                            color: 'text.disabled', lineHeight: 1.4 }}>
                            {item.advisoryNote}
                          </Typography>
                        </Box>
                      )}

                      {item.preTravelAction && !item.packed && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                          <WarningAmberIcon sx={{ fontSize: 13, color: 'warning.main', mt: 0.25, flexShrink: 0 }} />
                          <Typography sx={{ fontFamily: D.body, fontSize: '0.74rem',
                            color: 'warning.dark', lineHeight: 1.4 }}>
                            {item.preTravelNote || 'Pre-travel action required'}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {item.source === 'auto' && item.masterItemId && !item.packed && (
                      <IconButton className="catalogue-tune" size="small"
                        onClick={e => { e.stopPropagation(); openCatalogueEdit(item); }}
                        aria-label={`Edit catalogue defaults for ${item.name}`}
                        sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0,
                          alignSelf: 'center', color: 'text.disabled',
                          '&:hover': { color: D.green } }}>
                        <TuneIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    )}
                  </Box>
                  <Divider />
                </Box>
              ))}
            </Collapse>
          </Paper>
        );
      })}

      {/* ════════════════════════════════════════════════════════════════════
          Dialogs
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── Pre-travel dialog ── */}
      <Dialog open={preTravel} onClose={() => setPreTravel(false)} maxWidth="sm" fullWidth fullScreen={mobile}
        PaperProps={{ sx: { borderRadius: { sm: 2.5 }, backgroundColor: D.paper } }}>
        <DialogTitle sx={{
          fontFamily: D.display, fontSize: { xs: '1.4rem', sm: '1.6rem' },
          letterSpacing: '-0.02em', color: D.navy,
        }}>
          Pre-travel actions
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', color: 'text.secondary', mb: 2 }}>
            These items need attention before you can pack them:
          </Typography>
          {preTravelItems.map(item => (
            <Paper key={item._idx} elevation={0} sx={{
              p: 2, mb: 1.5,
              border: `1.5px solid`,
              borderColor: 'warning.main',
              borderRadius: 2,
              backgroundColor: 'rgba(255,167,38,0.04)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <WarningAmberIcon color="warning" fontSize="small" />
                <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem',
                  letterSpacing: '-0.01em', color: D.navy }}>
                  {item.name}
                </Typography>
              </Box>
              {item.preTravelNote && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: 'text.secondary' }}>
                  {item.preTravelNote}
                </Typography>
              )}
            </Paper>
          ))}

          {advisoryCreated && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, p: 1.5,
              borderRadius: 1.5, backgroundColor: 'success.light' }}>
              <AssignmentTurnedInIcon color="success" fontSize="small" />
              <Typography sx={{ fontFamily: D.body, fontWeight: 700, color: 'success.dark', fontSize: '0.88rem' }}>
                Pre-travel checklist added to Resources → To-dos
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setPreTravel(false)} fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body, fontWeight: 600 }}>
            Got it
          </Button>
          <Button variant="outlined" color="warning"
            onClick={() => createPackingAdvisory(preTravelItems)}
            disabled={creatingAdvisory || advisoryCreated}
            startIcon={creatingAdvisory
              ? <CircularProgress size={16} color="inherit" />
              : <AssignmentTurnedInIcon />}
            fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body, fontWeight: 700 }}>
            {advisoryCreated ? 'Reminder created' : 'Create reminder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add item dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth fullScreen={mobile}
        PaperProps={{ sx: { borderRadius: { sm: 2.5 }, backgroundColor: D.paper } }}>
        <DialogTitle sx={{
          fontFamily: D.display, fontSize: { xs: '1.4rem', sm: '1.6rem' },
          letterSpacing: '-0.02em', color: D.navy,
        }}>
          Add item
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField label="Item name" value={newItem.name} autoFocus fullWidth
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              InputProps={{ sx: { fontFamily: D.body } }}
              InputLabelProps={{ sx: { fontFamily: D.body } }} />
            <FormControl fullWidth>
              <InputLabel sx={{ fontFamily: D.body }}>Category</InputLabel>
              <Select value={newItem.category} label="Category"
                onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                sx={{ fontFamily: D.body }}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ fontFamily: D.body }}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Quantity" type="number" value={newItem.quantity} fullWidth
              onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))}
              inputProps={{ min: 1 }}
              InputProps={{ sx: { fontFamily: D.body } }}
              InputLabelProps={{ sx: { fontFamily: D.body } }} />
            <TextField label="Note (optional)" value={newItem.advisoryNote} fullWidth
              onChange={e => setNewItem(p => ({ ...p, advisoryNote: e.target.value }))}
              InputProps={{ sx: { fontFamily: D.body } }}
              InputLabelProps={{ sx: { fontFamily: D.body } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setAddOpen(false)} fullWidth={mobile} size="large"
            sx={{ fontFamily: D.body, fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" onClick={addItem} disabled={!newItem.name}
            fullWidth={mobile} size="large"
            sx={{
              fontFamily: D.display, letterSpacing: '-0.01em',
              backgroundColor: D.navy, boxShadow: 'none',
              '&:hover': { backgroundColor: 'rgba(44,62,80,0.88)', boxShadow: 'none' },
            }}>
            Add item
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Catalogue edit dialog ── */}
      <Dialog open={!!catalogueEdit} onClose={() => setCatalogueEdit(null)}
        maxWidth="xs" fullWidth fullScreen={mobile}
        PaperProps={{ sx: { borderRadius: { sm: 2.5 }, backgroundColor: D.paper } }}>
        <DialogTitle sx={{
          fontFamily: D.display, fontSize: { xs: '1.3rem', sm: '1.5rem' },
          letterSpacing: '-0.02em', color: D.navy, pb: 0.5,
        }}>
          Edit catalogue defaults
        </DialogTitle>
        {catalogueEdit && (
          <>
            <DialogContent>
              <Typography sx={{ fontFamily: D.body, color: 'text.secondary', mb: 2.5, fontSize: '0.82rem' }}>
                Changes to <strong>{catalogueEdit.name}</strong> update the master catalogue and apply
                to all future generated lists. Regenerate this trip to apply them here too.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <FormControlLabel
                  control={
                    <Switch checked={catalogueEdit.essential} color="primary"
                      onChange={e => setCatalogueEdit(p => p ? { ...p, essential: e.target.checked } : p)} />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.88rem' }}>Essential</Typography>
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: 'text.secondary' }}>
                        Always highlighted regardless of trip type
                      </Typography>
                    </Box>
                  }
                />

                <TypeToggleGroup label="Include on trip types" options={TRIP_TYPES}
                  value={catalogueEdit.tripTypes}
                  onChange={val => setCatalogueEdit(p => p ? { ...p, tripTypes: val } : p)}
                  hint="Leave all unselected to include on all trip types" />

                <TypeToggleGroup label="Only include when transport includes" options={TRANSPORT_TYPES}
                  value={catalogueEdit.transportTypes}
                  onChange={val => setCatalogueEdit(p => p ? { ...p, transportTypes: val } : p)}
                  hint="Leave all unselected to include regardless of transport" />

                <TypeToggleGroup label="Only include when accommodation includes" options={ACCOM_TYPES}
                  value={catalogueEdit.accommodationTypes}
                  onChange={val => setCatalogueEdit(p => p ? { ...p, accommodationTypes: val } : p)}
                  hint="Leave all unselected to include regardless of accommodation" />

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField label="Qty" type="number" size="small" sx={{ width: 80 }}
                    value={catalogueEdit.quantity}
                    onChange={e => setCatalogueEdit(p => p ? { ...p, quantity: Number(e.target.value) } : p)}
                    inputProps={{ min: 1 }}
                    InputProps={{ sx: { fontFamily: D.body } }}
                    InputLabelProps={{ sx: { fontFamily: D.body } }} />
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontFamily: D.body }}>Type</InputLabel>
                    <Select value={catalogueEdit.quantityType} label="Type"
                      sx={{ fontFamily: D.body }}
                      onChange={e => setCatalogueEdit(p => p ? {
                        ...p, quantityType: e.target.value as 'fixed' | 'per_night'
                      } : p)}>
                      <MenuItem value="fixed"     sx={{ fontFamily: D.body }}>Fixed</MenuItem>
                      <MenuItem value="per_night" sx={{ fontFamily: D.body }}>Per night</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <FormControlLabel
                  control={
                    <Switch checked={catalogueEdit.preTravelAction} color="warning"
                      onChange={e => setCatalogueEdit(p => p ? { ...p, preTravelAction: e.target.checked } : p)} />
                  }
                  label={
                    <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.88rem' }}>
                      Pre-travel action required
                    </Typography>
                  }
                />
                {catalogueEdit.preTravelAction && (
                  <TextField label="Pre-travel note" size="small" fullWidth
                    value={catalogueEdit.preTravelNote}
                    onChange={e => setCatalogueEdit(p => p ? { ...p, preTravelNote: e.target.value } : p)}
                    placeholder="e.g. Charge fully before packing"
                    InputProps={{ sx: { fontFamily: D.body } }}
                    InputLabelProps={{ sx: { fontFamily: D.body } }} />
                )}

                <TextField label="Advisory note" size="small" fullWidth
                  value={catalogueEdit.advisoryNote}
                  onChange={e => setCatalogueEdit(p => p ? { ...p, advisoryNote: e.target.value } : p)}
                  placeholder="Shown on every trip this item appears on"
                  InputProps={{ sx: { fontFamily: D.body } }}
                  InputLabelProps={{ sx: { fontFamily: D.body } }} />
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
              <Button onClick={() => setCatalogueEdit(null)} fullWidth={mobile} size="large"
                sx={{ fontFamily: D.body, fontWeight: 600 }}>Cancel</Button>
              <Button variant="contained" onClick={saveCatalogueEdit}
                disabled={catalogueSaving} fullWidth={mobile} size="large"
                sx={{
                  fontFamily: D.display, letterSpacing: '-0.01em',
                  backgroundColor: D.navy, boxShadow: 'none',
                  '&:hover': { backgroundColor: 'rgba(44,62,80,0.88)', boxShadow: 'none' },
                }}>
                {catalogueSaving ? 'Saving…' : 'Save to catalogue'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

    </Box>
  );
}