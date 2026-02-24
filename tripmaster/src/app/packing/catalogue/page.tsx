'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton, Button,
  Paper, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Card, CardContent, CardMedia, CardActions, Tooltip,
  ToggleButton, ToggleButtonGroup, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GridViewIcon from '@mui/icons-material/GridView';
import ListIcon from '@mui/icons-material/List';

const CATEGORIES = [
  'Documents', 'Electronics', 'Tech Accessories', 'Clothes', 'Sport / Outdoor', 'Footwear', 'Baby / Kids', 'Entertainment',
  'Hobby / Creative', 'Health & Recovery', 'Food / Supplements', 'Toiletries',
  'Medicines', 'Work Gear', 'Luggage', 'Accessories', 'Coffee', 'Other' 
];

const TRIP_TYPES = ['always', 'work', 'leisure', 'mixed'];

interface PackingItem {
  _id: string;
  name: string;
  category: string;
  essential: boolean;
  tripTypes: string[];
  quantityType: 'fixed' | 'per_night';
  quantity: number;
  quantityMin?: number;
  quantityMax?: number;
  preTravelAction: boolean;
  preTravelNote: string;
  advisoryNote: string;
  photoUrl?: string;
}

const emptyForm = {
  name: '',
  category: 'Electronics',
  essential: true,
  tripTypes: ['always'] as string[],
  quantityType: 'fixed' as 'fixed' | 'per_night',
  quantity: 1,
  quantityMin: 1,
  quantityMax: 10,
  preTravelAction: false,
  preTravelNote: '',
  advisoryNote: '',
};

export default function PackingCataloguePage() {
  const router = useRouter();
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PackingItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackingItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/packing/catalogue')
      .then(res => res.json())
      .then(data => { setItems(data.items || []); setLoading(false); });
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setPhotoPreview(null);
    setSelectedPhoto(null);
    setDialogOpen(true);
  };

  const openEdit = (item: PackingItem) => {
    setEditTarget(item);
    setForm({
      name: item.name,
      category: item.category,
      essential: item.essential,
      tripTypes: item.tripTypes,
      quantityType: item.quantityType,
      quantity: item.quantity,
      quantityMin: item.quantityMin ?? 1,
      quantityMax: item.quantityMax ?? 10,
      preTravelAction: item.preTravelAction,
      preTravelNote: item.preTravelNote || '',
      advisoryNote: item.advisoryNote || '',
    });
    setPhotoPreview(item.photoUrl || null);
    setSelectedPhoto(null);
    setDialogOpen(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    let photoUrl = editTarget?.photoUrl;

    if (selectedPhoto) {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedPhoto);
      const uploadRes = await fetch('/api/packing/catalogue/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      photoUrl = uploadData.url;
      setUploading(false);
    }

    const payload = { ...form, photoUrl };

    if (editTarget) {
      // Edit existing item
      const res = await fetch(`/api/packing/catalogue/${editTarget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setItems(prev => prev.map(i => i._id === editTarget._id ? data.item : i));
    } else {
      // Create new item
      const res = await fetch('/api/packing/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setItems(data.items);
    }

    setDialogOpen(false);
    setForm(emptyForm);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setEditTarget(null);
    setSaving(false);
  };

  const handleDelete = async (item: PackingItem) => {
    await fetch(`/api/packing/catalogue/${item._id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i._id !== item._id));
    setDeleteTarget(null);
  };

  const filtered = filterCategory === 'All'
    ? items
    : items.filter(i => i.category === filterCategory);

  const categories = ['All', ...CATEGORIES];

  const qtyLabel = (item: PackingItem) =>
    item.quantityType === 'fixed'
      ? `Qty: ${item.quantity}`
      : `${item.quantity}/night (${item.quantityMin}–${item.quantityMax})`;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            Packing Catalogue
          </Typography>
          <IconButton color="inherit" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} sx={{ mr: 1 }}>
            {viewMode === 'grid' ? <ListIcon /> : <GridViewIcon />}
          </IconButton>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openAdd}>
            Add Item
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
          <Paper sx={{ p: 2, backgroundColor: 'background.paper', textAlign: 'center', minWidth: 120 }}>
            <Typography variant="h4" fontWeight={700} color="primary.main">{items.length}</Typography>
            <Typography variant="body2" color="text.secondary">Total items</Typography>
          </Paper>
          <Paper sx={{ p: 2, backgroundColor: 'background.paper', textAlign: 'center', minWidth: 120 }}>
            <Typography variant="h4" fontWeight={700} color="secondary.main">
              {items.filter(i => i.essential).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Essentials</Typography>
          </Paper>
          <Paper sx={{ p: 2, backgroundColor: 'background.paper', textAlign: 'center', minWidth: 120 }}>
            <Typography variant="h4" fontWeight={700} color="warning.main">
              {items.filter(i => i.preTravelAction).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Pre-travel actions</Typography>
          </Paper>
        </Box>

        {/* Category filter */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {categories.map(cat => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setFilterCategory(cat)}
              color={filterCategory === cat ? 'primary' : 'default'}
              variant={filterCategory === cat ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography variant="h6" color="text.secondary">No items yet</Typography>
            <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={openAdd}>
              Add your first item
            </Button>
          </Box>
        ) : viewMode === 'grid' ? (

          /* ── GRID VIEW ── */
          <Grid container spacing={2}>
            {filtered.map(item => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item._id}>
                <Card sx={{ height: '100%', backgroundColor: 'background.paper' }}>
                  {item.photoUrl ? (
                    <CardMedia component="img" height="140" image={item.photoUrl} alt={item.name} sx={{ objectFit: 'cover' }} />
                  ) : (
                    <Box sx={{ height: 140, backgroundColor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PhotoCameraIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                    </Box>
                  )}
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography fontWeight={600} variant="body1">{item.name}</Typography>
                      {item.preTravelAction && (
                        <Tooltip title={item.preTravelNote || 'Pre-travel action required'}>
                          <WarningAmberIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">{item.category}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                      {item.essential && <Chip label="Essential" size="small" color="primary" />}
                      {item.tripTypes.map(t => (
                        <Chip key={t} label={t} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {qtyLabel(item)}
                    </Typography>
                    {item.advisoryNote && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        💡 {item.advisoryNote}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

        ) : (

          /* ── LIST VIEW ── */
          <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Trip types</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Flags</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.photoUrl && (
                          <Box
                            component="img"
                            src={item.photoUrl}
                            sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }}
                          />
                        )}
                        <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.category}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {item.tripTypes.map(t => (
                          <Chip key={t} label={t} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{qtyLabel(item)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {item.essential && <Chip label="Essential" size="small" color="primary" />}
                        {item.preTravelAction && (
                          <Tooltip title={item.preTravelNote || 'Pre-travel action required'}>
                            <Chip label="⚠ Pre-travel" size="small" color="warning" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {item.advisoryNote && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          💡 {item.advisoryNote}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(item)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? `Edit — ${editTarget.name}` : 'Add Packing Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

            {/* Photo upload */}
            <Box
              sx={{
                height: 160, border: '2px dashed', borderColor: 'divider', borderRadius: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                '&:hover': { borderColor: 'primary.main' }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <Box component="img" src={photoPreview} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <PhotoCameraIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Click to add photo</Typography>
                  <Typography variant="caption" color="text.disabled">Optional — useful for insurance</Typography>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoSelect} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Item name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                fullWidth
                required
              />
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Trip type</Typography>
              <ToggleButtonGroup
                value={form.tripTypes}
                onChange={(_, val) => val.length && setForm(p => ({ ...p, tripTypes: val }))}
                fullWidth
              >
                {TRIP_TYPES.map(t => (
                  <ToggleButton key={t} value={t} size="small">{t}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Quantity</Typography>
              <ToggleButtonGroup
                value={form.quantityType}
                exclusive
                onChange={(_, val) => val && setForm(p => ({ ...p, quantityType: val }))}
                sx={{ mb: 2 }}
              >
                <ToggleButton value="fixed" size="small">Fixed</ToggleButton>
                <ToggleButton value="per_night" size="small">Per night</ToggleButton>
              </ToggleButtonGroup>

              {form.quantityType === 'fixed' ? (
                <TextField
                  label="Quantity"
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                  fullWidth
                  inputProps={{ min: 1 }}
                />
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Per night" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} fullWidth inputProps={{ min: 1 }} />
                  <TextField label="Min" type="number" value={form.quantityMin} onChange={e => setForm(p => ({ ...p, quantityMin: Number(e.target.value) }))} fullWidth inputProps={{ min: 1 }} />
                  <TextField label="Max" type="number" value={form.quantityMax} onChange={e => setForm(p => ({ ...p, quantityMax: Number(e.target.value) }))} fullWidth inputProps={{ min: 1 }} />
                </Box>
              )}
            </Box>

            <FormControlLabel
              control={<Switch checked={form.essential} onChange={e => setForm(p => ({ ...p, essential: e.target.checked }))} color="primary" />}
              label="Essential — include on every trip"
            />

            <FormControlLabel
              control={<Switch checked={form.preTravelAction} onChange={e => setForm(p => ({ ...p, preTravelAction: e.target.checked }))} color="warning" />}
              label="Requires pre-travel action"
            />

            {form.preTravelAction && (
              <TextField
                label="Pre-travel action note"
                placeholder="e.g. Charge fully before packing"
                value={form.preTravelNote}
                onChange={e => setForm(p => ({ ...p, preTravelNote: e.target.value }))}
                fullWidth
              />
            )}

            <TextField
              label="Advisory note (optional)"
              placeholder="e.g. Don't forget the charging cable"
              value={form.advisoryNote}
              onChange={e => setForm(p => ({ ...p, advisoryNote: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => { setDialogOpen(false); setForm(emptyForm); setPhotoPreview(null); setSelectedPhoto(null); setEditTarget(null); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || saving}>
            {uploading ? 'Uploading photo...' : saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Save Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently remove it from your catalogue.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}