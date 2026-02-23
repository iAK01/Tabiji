'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, CircularProgress,
  LinearProgress, Chip, Checkbox, FormControlLabel,
  Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Tooltip, IconButton, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const CATEGORIES = [
  'Documents', 'Electronics', 'Clothes', 'Toiletries',
  'Medicines', 'Work Gear', 'Luggage', 'Accessories', 'Other'
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
  const [packing, setPacking] = useState<PackingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [showPreTravel, setShowPreTravel] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });
  const [filterPacked, setFilterPacked] = useState<'all' | 'unpacked' | 'packed'>('all');

  useEffect(() => {
    fetch(`/api/trips/${tripId}/packing`)
      .then(res => res.json())
      .then(data => {
        setPacking(data.packing || null);
        setLoading(false);
      });
  }, [tripId]);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/trips/${tripId}/packing/generate`, { method: 'POST' });
    const data = await res.json();
    setPacking(data.packing);
    setGenerating(false);
  };

  const toggleItem = async (index: number) => {
    if (!packing) return;
    const newPacked = !packing.items[index].packed;
    const res = await fetch(`/api/trips/${tripId}/packing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex: index, packed: newPacked }),
    });
    const data = await res.json();
    setPacking(data.packing);
  };

  const addItem = async () => {
    const res = await fetch(`/api/trips/${tripId}/packing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const data = await res.json();
    setPacking(data.packing);
    setAddOpen(false);
    setNewItem({ name: '', category: 'Other', quantity: 1, advisoryNote: '' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!packing) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center', backgroundColor: 'background.paper' }}>
        <AutoAwesomeIcon sx={{ fontSize: 60, color: 'primary.main', opacity: 0.5, mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>Generate your packing list</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {nights} night {tripType} trip
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
          We'll build a smart packing list based on your trip type, duration, flights, and accommodation.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={generate}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Packing List'}
        </Button>
      </Paper>
    );
  }

  // Group items by category
  const items = packing.items;
  const filteredItems = items.filter(item => {
    if (filterPacked === 'unpacked') return !item.packed;
    if (filterPacked === 'packed') return item.packed;
    return true;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, PackingItem[]>);

  // Items not in standard categories
  const otherItems = filteredItems.filter(i => !CATEGORIES.includes(i.category));
  if (otherItems.length) grouped['Other'] = [...(grouped['Other'] || []), ...otherItems];

  const preTravelItems = items.filter(i => i.preTravelAction && !i.packed);

  return (
    <Box>
      {/* Progress header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Packing List — {nights} night {tripType} trip
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generated {new Date(packing.generatedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
              {packing.generationParams.transportTypes?.length > 0 && ` · ${packing.generationParams.transportTypes.join(', ')}`}
              {packing.generationParams.accommodationTypes?.length > 0 && ` · ${packing.generationParams.accommodationTypes.join(', ')}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Regenerate list">
              <IconButton onClick={generate} disabled={generating} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add item
            </Button>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={packing.packingProgress}
            sx={{ flex: 1, height: 8, borderRadius: 4 }}
            color={packing.packingProgress === 100 ? 'success' : 'primary'}
          />
          <Typography variant="body2" fontWeight={600} minWidth={60}>
            {packing.packedItems} / {packing.totalItems}
          </Typography>
        </Box>
        {packing.packingProgress === 100 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" fontWeight={600}>All packed!</Typography>
          </Box>
        )}

        {/* Stats chips */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`${items.filter(i => i.essential).length} essentials`} size="small" color="primary" />
          {preTravelItems.length > 0 && (
            <Chip
              icon={<WarningAmberIcon />}
              label={`${preTravelItems.length} pre-travel actions`}
              size="small"
              color="warning"
              onClick={() => setShowPreTravel(true)}
              sx={{ cursor: 'pointer' }}
            />
          )}
          <Chip label={`${items.filter(i => i.source === 'manual').length} manual`} size="small" variant="outlined" />
        </Box>

        {/* Filter */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          {(['all', 'unpacked', 'packed'] as const).map(f => (
            <Chip
              key={f}
              label={f.charAt(0).toUpperCase() + f.slice(1)}
              size="small"
              onClick={() => setFilterPacked(f)}
              color={filterPacked === f ? 'primary' : 'default'}
              variant={filterPacked === f ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Paper>

      {/* Category accordions */}
      {Object.entries(grouped).map(([category, catItems]) => {
        const packedInCat = catItems.filter(i => i.packed).length;
        const allPacked = packedInCat === catItems.length;

        return (
          <Accordion
            key={category}
            defaultExpanded={!allPacked}
            sx={{ mb: 1, backgroundColor: 'background.paper', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1 }}>
                <Typography fontWeight={600}>{category}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {packedInCat}/{catItems.length}
                </Typography>
                {allPacked && <CheckCircleIcon color="success" fontSize="small" sx={{ ml: 'auto', mr: 1 }} />}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {catItems.map((item, catIndex) => {
                const globalIndex = items.findIndex(
                  i => i.name === item.name && i.category === item.category
                );
                return (
                  <Box key={`${item.name}-${catIndex}`}>
                    <Box sx={{
                      display: 'flex', alignItems: 'flex-start', py: 1,
                      opacity: item.packed ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <Checkbox
                        checked={item.packed}
                        onChange={() => toggleItem(globalIndex)}
                        size="small"
                        sx={{ mt: -0.5, mr: 1 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography
                            variant="body2"
                            fontWeight={item.essential ? 600 : 400}
                            sx={{ textDecoration: item.packed ? 'line-through' : 'none' }}
                          >
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            × {item.quantity}
                          </Typography>
                          {item.essential && <Chip label="Essential" size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem' }} />}
                          {item.preTravelAction && (
                            <Tooltip title={item.preTravelNote || 'Pre-travel action required'}>
                              <WarningAmberIcon fontSize="small" color="warning" sx={{ fontSize: 14 }} />
                            </Tooltip>
                          )}
                          {item.source === 'manual' && <Chip label="manual" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />}
                        </Box>
                        {item.advisoryNote && !item.packed && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            💡 {item.advisoryNote}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Divider />
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Pre-travel actions dialog */}
      <Dialog open={showPreTravel} onClose={() => setShowPreTravel(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>⚠️ Pre-travel actions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These items need attention before you pack them:
          </Typography>
          {preTravelItems.map((item, i) => (
            <Paper key={i} sx={{ p: 2, mb: 1.5, backgroundColor: 'warning.light', opacity: 0.9 }}>
              <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
              <Typography variant="caption">{item.preTravelNote}</Typography>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreTravel(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add manual item dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Add item manually</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Item name"
              value={newItem.name}
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              fullWidth
              required
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={newItem.category} label="Category" onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Quantity"
                type="number"
                value={newItem.quantity}
                onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))}
                sx={{ width: 120 }}
                inputProps={{ min: 1 }}
              />
            </Box>
            <TextField
              label="Note (optional)"
              value={newItem.advisoryNote}
              onChange={e => setNewItem(p => ({ ...p, advisoryNote: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addItem} disabled={!newItem.name}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}