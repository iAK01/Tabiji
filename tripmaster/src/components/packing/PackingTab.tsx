'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  LinearProgress, Chip, Checkbox,
  Collapse, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Divider, useTheme, useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FilterListIcon from '@mui/icons-material/FilterList';

const CATEGORIES = [
  'Documents', 'Electronics', 'Clothes', 'Toiletries',
  'Medicines', 'Work Gear', 'Luggage', 'Accessories', 'Other',
];

interface PackingItem {
  name: string;
  category: string;
  quantity: number;
  quantityType: string;
  essential: boolean;
  packed: boolean;
  packedAt: string | null;
  preTravelAction: boolean;
  preTravelNote: string;
  advisoryNote: string;
  photoUrl?: string;
  source: 'auto' | 'manual';
}

interface PackingList {
  _id: string;
  tripId: string;
  items: PackingItem[];
  totalItems: number;
  packedItems: number;
  packingProgress: number;
  generatedAt: string;
  generationParams: {
    nights: number;
    tripType: string;
    transportTypes: string[];
    accommodationTypes: string[];
  };
}

interface PackingTabProps {
  tripId: string;
  tripType: string;
  nights: number;
}

export default function PackingTab({ tripId, tripType, nights }: PackingTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [packing,    setPacking]    = useState<PackingList | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addOpen,    setAddOpen]    = useState(false);
  const [preTravel,  setPreTravel]  = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'unpacked' | 'packed'>('all');
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [newItem,    setNewItem]    = useState({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });

  useEffect(() => {
    fetch(`/api/trips/${tripId}/packing`)
      .then(r => r.json())
      .then(d => { setPacking(d.packing ?? null); setLoading(false); });
  }, [tripId]);

  const generate = async () => {
    setGenerating(true);
    const res  = await fetch(`/api/trips/${tripId}/packing/generate`, { method: 'POST' });
    const data = await res.json();
    setPacking(data.packing);
    setGenerating(false);
  };

  const toggleItem = async (index: number) => {
    if (!packing) return;
    const res  = await fetch(`/api/trips/${tripId}/packing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex: index, packed: !packing.items[index].packed }),
    });
    const data = await res.json();
    setPacking(data.packing);
  };

  const addItem = async () => {
    const res  = await fetch(`/api/trips/${tripId}/packing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const data = await res.json();
    setPacking(data.packing);
    setAddOpen(false);
    setNewItem({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });
  };

  const toggleCategory = (cat: string) =>
    setExpanded(p => ({ ...p, [cat]: !p[cat] }));

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!packing) return (
    <Paper sx={{ p: { xs: 4, sm: 6 }, textAlign: 'center', backgroundColor: 'background.paper' }}>
      <AutoAwesomeIcon sx={{ fontSize: 56, color: 'primary.main', opacity: 0.45, mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>Generate your packing list</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {nights} nights · {tripType}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 360, mx: 'auto' }}>
        We'll build a smart list based on your trip type, duration, flights, and accommodation.
      </Typography>
      <Button
        variant="contained"
        size="large"
        fullWidth={mobile}
        startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
        onClick={generate}
        disabled={generating}
        sx={{ py: mobile ? 1.75 : 1.25 }}
      >
        {generating ? 'Generating…' : 'Generate Packing List'}
      </Button>
    </Paper>
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const items          = packing.items;
  const preTravelItems = items.filter(i => i.preTravelAction && !i.packed);
  const allDone        = packing.packingProgress === 100;

  const filtered = items.filter(i => {
    if (filter === 'unpacked') return !i.packed;
    if (filter === 'packed')   return  i.packed;
    return true;
  });

  const sortItems = (arr: PackingItem[]) =>
    [...arr].sort((a, b) => Number(a.packed) - Number(b.packed));

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length) acc[cat] = sortItems(catItems);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const extra = filtered.filter(i => !CATEGORIES.includes(i.category));
  if (extra.length) grouped['Other'] = sortItems([...(grouped['Other'] ?? []), ...extra]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>

      {/* ── Progress card ── */}
      <Paper sx={{ p: { xs: 2.5, sm: 3 }, mb: 2.5, backgroundColor: 'background.paper' }}>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
            {nights} nights · {tripType}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterOpen(p => !p)}
              color={filter !== 'all' ? 'primary' : 'inherit'}
            >
              {filter === 'all' ? 'Filter' : filter}
            </Button>
            <IconButton size="small" onClick={generate} disabled={generating} aria-label="Regenerate list">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Filter chips — collapsible */}
        <Collapse in={filterOpen}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {(['all', 'unpacked', 'packed'] as const).map(f => (
              <Chip
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                onClick={() => { setFilter(f); setFilterOpen(false); }}
                color={filter === f ? 'primary' : 'default'}
                variant={filter === f ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', fontWeight: 600 }}
              />
            ))}
          </Box>
        </Collapse>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={packing.packingProgress}
            color={allDone ? 'success' : 'primary'}
            sx={{
              flex: 1, height: 10, borderRadius: 5,
              backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': { borderRadius: 5 },
            }}
          />
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 52, textAlign: 'right' }}>
            {packing.packedItems}/{packing.totalItems}
          </Typography>
        </Box>

        {/* All packed */}
        {allDone && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, mt: 2,
            backgroundColor: 'success.light', borderRadius: 2, px: 2, py: 1.5,
          }}>
            <CheckCircleIcon color="success" />
            <Typography fontWeight={700} color="success.dark" sx={{ fontSize: { xs: '1rem', sm: '1rem' } }}>
              All packed — you're ready to go!
            </Typography>
          </Box>
        )}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`${items.filter(i => i.essential).length} essentials`} size="small" color="primary" />
          {preTravelItems.length > 0 && (
            <Chip
              icon={<WarningAmberIcon />}
              label={`${preTravelItems.length} pre-travel actions`}
              size="small" color="warning"
              onClick={() => setPreTravel(true)}
              sx={{ cursor: 'pointer', fontWeight: 700 }}
            />
          )}
          {items.filter(i => i.source === 'manual').length > 0 && (
            <Chip
              label={`${items.filter(i => i.source === 'manual').length} manual`}
              size="small" variant="outlined"
            />
          )}
        </Box>
      </Paper>

      {/* ── Add item button ── */}
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setAddOpen(true)}
        fullWidth={mobile}
        size={mobile ? 'large' : 'medium'}
        sx={{ mb: 2.5, py: mobile ? 1.5 : 1 }}
      >
        Add item
      </Button>

      {/* ── Category sections ── */}
      {Object.entries(grouped).map(([category, catItems]) => {
        const packedCount  = catItems.filter(i => i.packed).length;
        const allCatPacked = packedCount === catItems.length;
        const isOpen = expanded[category] !== undefined
          ? expanded[category]
          : !allCatPacked;

        return (
          <Paper key={category} sx={{ mb: 1.5, backgroundColor: 'background.paper', overflow: 'hidden' }}>

            {/* Category header — full row tappable */}
            <Box
              onClick={() => toggleCategory(category)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 1.5 },
                cursor: 'pointer', userSelect: 'none',
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              {allCatPacked
                ? <CheckCircleIcon color="success" sx={{ fontSize: 20, flexShrink: 0 }} />
                : <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid', borderColor: 'divider', flexShrink: 0 }} />
              }
              <Typography fontWeight={700} sx={{ flexGrow: 1, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                {category}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mr: 0.5 }}>
                {packedCount}/{catItems.length}
              </Typography>
              {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>

            <Collapse in={isOpen}>
              <Divider />
              {catItems.map((item, catIdx) => {
                const globalIndex = items.findIndex(
                  i => i.name === item.name && i.category === item.category
                );
                return (
                  <Box key={`${item.name}-${catIdx}`}>
                    <Box
                      onClick={() => toggleItem(globalIndex)}
                      sx={{
                        display: 'flex', alignItems: 'center',
                        px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 1.25 },
                        gap: 1.5, cursor: 'pointer',
                        opacity: item.packed ? 0.45 : 1,
                        transition: 'opacity 0.2s',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      <Checkbox
                        checked={item.packed}
                        onChange={() => {}}
                        onClick={e => e.stopPropagation()}
                        sx={{ p: 0, flexShrink: 0 }}
                      />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography
                            variant="body1"
                            fontWeight={item.essential ? 700 : 400}
                            sx={{
                              textDecoration: item.packed ? 'line-through' : 'none',
                              fontSize: { xs: '0.95rem', sm: '0.9rem' },
                            }}
                          >
                            {item.name}
                          </Typography>
                          {item.quantity > 1 && (
                            <Typography variant="caption" color="text.secondary">×{item.quantity}</Typography>
                          )}
                          {item.essential && (
                            <Chip label="Essential" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          {item.preTravelAction && (
                            <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />
                          )}
                        </Box>
                        {item.advisoryNote && !item.packed && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                            {item.advisoryNote}
                          </Typography>
                        )}
                        {item.preTravelAction && item.preTravelNote && !item.packed && (
                          <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 0.25 }}>
                            {item.preTravelNote}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Divider />
                  </Box>
                );
              })}
            </Collapse>
          </Paper>
        );
      })}

      {/* ── Pre-travel actions dialog ── */}
      <Dialog open={preTravel} onClose={() => setPreTravel(false)} maxWidth="sm" fullWidth fullScreen={mobile}>
        <DialogTitle fontWeight={700}>Pre-travel actions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These items need attention before you can pack them:
          </Typography>
          {preTravelItems.map((item, i) => (
            <Paper key={i} sx={{ p: 2, mb: 1.5, border: '1px solid', borderColor: 'warning.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <WarningAmberIcon color="warning" fontSize="small" />
                <Typography variant="body2" fontWeight={700}>{item.name}</Typography>
              </Box>
              {item.preTravelNote && (
                <Typography variant="caption" color="text.secondary">{item.preTravelNote}</Typography>
              )}
            </Paper>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPreTravel(false)} variant="contained" fullWidth={mobile} size="large">
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add item dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth fullScreen={mobile}>
        <DialogTitle fontWeight={700}>Add item</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Item name"
              value={newItem.name}
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              fullWidth autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newItem.category}
                label="Category"
                onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Quantity"
              type="number"
              value={newItem.quantity}
              onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Note (optional)"
              value={newItem.advisoryNote}
              onChange={e => setNewItem(p => ({ ...p, advisoryNote: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setAddOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={addItem} disabled={!newItem.name} fullWidth={mobile} size="large">
            Add item
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}