'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton, Button,
  Paper, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Card, CardContent, CardActions, Tooltip,
  ToggleButton, ToggleButtonGroup, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider,
} from '@mui/material';
import ArrowBackIcon         from '@mui/icons-material/ArrowBack';
import AddIcon               from '@mui/icons-material/Add';
import DeleteIcon            from '@mui/icons-material/Delete';
import EditIcon              from '@mui/icons-material/Edit';
import PhotoCameraIcon       from '@mui/icons-material/PhotoCamera';
import WarningAmberIcon      from '@mui/icons-material/WarningAmber';
import GridViewIcon          from '@mui/icons-material/GridView';
import ListIcon              from '@mui/icons-material/List';
import FlightIcon            from '@mui/icons-material/Flight';
import TrainIcon             from '@mui/icons-material/Train';
import DirectionsCarIcon     from '@mui/icons-material/DirectionsCar';
import DirectionsBoatIcon    from '@mui/icons-material/DirectionsBoat';
import DirectionsBusIcon     from '@mui/icons-material/DirectionsBus';
import HotelIcon             from '@mui/icons-material/Hotel';
import HomeIcon              from '@mui/icons-material/Home';
import GroupIcon             from '@mui/icons-material/Group';
import NaturePeopleIcon      from '@mui/icons-material/NaturePeople';
import OtherHousesIcon       from '@mui/icons-material/OtherHouses';
// Category icons
import ArticleIcon           from '@mui/icons-material/Article';
import DevicesIcon           from '@mui/icons-material/Devices';
import CableIcon             from '@mui/icons-material/Cable';
import CheckroomIcon         from '@mui/icons-material/Checkroom';
import HikingIcon            from '@mui/icons-material/Hiking';
import ShoesIcon             from '@mui/icons-material/DriveEta'; // fallback
import ChildCareIcon         from '@mui/icons-material/ChildCare';
import SportsEsportsIcon     from '@mui/icons-material/SportsEsports';
import PaletteIcon           from '@mui/icons-material/Palette';
import FavoriteIcon          from '@mui/icons-material/Favorite';
import BlenderIcon           from '@mui/icons-material/Blender';
import SpaIcon               from '@mui/icons-material/Spa';
import MedicationIcon        from '@mui/icons-material/Medication';
import BusinessCenterIcon    from '@mui/icons-material/BusinessCenter';
import LuggageIcon           from '@mui/icons-material/Luggage';
import WatchIcon             from '@mui/icons-material/Watch';
import CoffeeIcon            from '@mui/icons-material/Coffee';
import CategoryIcon          from '@mui/icons-material/Category';
import DirectionsWalkIcon    from '@mui/icons-material/DirectionsWalk';

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  navy:    '#1D2642',
  green:   '#6B7C5C',
  terra:   '#C4714A',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Category → MUI icon map ──────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Documents':        ArticleIcon,
  'Electronics':      DevicesIcon,
  'Tech Accessories': CableIcon,
  'Clothes':          CheckroomIcon,
  'Sport / Outdoor':  HikingIcon,
  'Footwear':         DirectionsWalkIcon,
  'Baby / Kids':      ChildCareIcon,
  'Entertainment':    SportsEsportsIcon,
  'Hobby / Creative': PaletteIcon,
  'Health & Recovery':FavoriteIcon,
  'Food / Supplements': BlenderIcon,
  'Toiletries':       SpaIcon,
  'Medicines':        MedicationIcon,
  'Work Gear':        BusinessCenterIcon,
  'Luggage':          LuggageIcon,
  'Accessories':      WatchIcon,
  'Coffee':           CoffeeIcon,
  'Other':            CategoryIcon,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Documents', 'Electronics', 'Tech Accessories', 'Clothes', 'Sport / Outdoor',
  'Footwear', 'Baby / Kids', 'Entertainment', 'Hobby / Creative', 'Health & Recovery',
  'Food / Supplements', 'Toiletries', 'Medicines', 'Work Gear', 'Luggage',
  'Accessories', 'Coffee', 'Other',
];

const TRIP_TYPES = ['always', 'work', 'leisure', 'mixed'] as const;

const TRANSPORT_TYPES = [
  { value: 'plane', label: 'Plane',  Icon: FlightIcon },
  { value: 'train', label: 'Train',  Icon: TrainIcon },
  { value: 'car',   label: 'Car',    Icon: DirectionsCarIcon },
  { value: 'ferry', label: 'Ferry',  Icon: DirectionsBoatIcon },
  { value: 'bus',   label: 'Bus',    Icon: DirectionsBusIcon },
] as const;

const ACCOM_TYPES = [
  { value: 'hotel',   label: 'Hotel',   Icon: HotelIcon },
  { value: 'airbnb',  label: 'Airbnb',  Icon: HomeIcon },
  { value: 'hostel',  label: 'Hostel',  Icon: OtherHousesIcon },
  { value: 'camping', label: 'Camping', Icon: NaturePeopleIcon },
  { value: 'family',  label: 'Family',  Icon: GroupIcon },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackingItem {
  _id:                string;
  name:               string;
  category:           string;
  essential:          boolean;
  tripTypes:          string[];
  transportTypes:     string[];
  accommodationTypes: string[];
  quantityType:       'fixed' | 'per_night';
  quantity:           number;
  quantityMin?:       number;
  quantityMax?:       number;
  preTravelAction:    boolean;
  preTravelNote:      string;
  advisoryNote:       string;
  photoUrl?:          string;
}

const emptyForm = {
  name:               '',
  category:           'Electronics',
  essential:          true,
  tripTypes:          ['always'] as string[],
  transportTypes:     [] as string[],
  accommodationTypes: [] as string[],
  quantityType:       'fixed' as 'fixed' | 'per_night',
  quantity:           1,
  quantityMin:        1,
  quantityMax:        10,
  preTravelAction:    false,
  preTravelNote:      '',
  advisoryNote:       '',
};

// ─── Toggle group helper ──────────────────────────────────────────────────────

function FilterToggleGroup({
  label, hint, options, value, onChange,
}: {
  label:    string;
  hint:     string;
  options:  readonly { value: string; label: string; Icon: React.ElementType }[];
  value:    string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: D.body, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: D.muted, display: 'block', mb: 1 }}>{hint}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {options.map(({ value: v, label: l, Icon }) => {
          const selected = value.includes(v);
          return (
            <Chip
              key={v}
              icon={<Icon sx={{ fontSize: '0.95rem !important' }} />}
              label={l}
              onClick={() => onChange(selected ? value.filter(x => x !== v) : [...value, v])}
              variant={selected ? 'filled' : 'outlined'}
              color={selected ? 'primary' : 'default'}
              sx={{ fontWeight: selected ? 700 : 400, cursor: 'pointer' }}
            />
          );
        })}
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: D.muted, mt: 0.75, display: 'block' }}>
        {value.length === 0 ? 'No filter — included on all trips' : `Only included when trip has: ${value.join(', ')}`}
      </Typography>
    </Box>
  );
}

// ─── Ghost icon behind card ───────────────────────────────────────────────────

function CategoryGhost({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] ?? CategoryIcon;
  return (
    <Box sx={{
      position: 'absolute',
      bottom: -12, right: -8,
      pointerEvents: 'none',
      zIndex: 0,
      color: D.navy,
      opacity: 0.055,
    }}>
      <Icon sx={{ fontSize: 120 }} />
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PackingCataloguePage() {
  const router = useRouter();
  const [items,           setItems]           = useState<PackingItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [dialogOpen,      setDialogOpen]      = useState(false);
  const [editTarget,      setEditTarget]      = useState<PackingItem | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<PackingItem | null>(null);
  const [form,            setForm]            = useState({ ...emptyForm });
  const [saving,          setSaving]          = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [selectedPhoto,   setSelectedPhoto]   = useState<File | null>(null);
  const [photoPreview,    setPhotoPreview]    = useState<string | null>(null);
  const [filterCategory,  setFilterCategory]  = useState('All');
  const [viewMode,        setViewMode]        = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!document.querySelector('#archivo-font')) {
      const link = document.createElement('link');
      link.id   = 'archivo-font';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    fetch('/api/packing/catalogue')
      .then(res => res.json())
      .then(data => { setItems(data.items || []); setLoading(false); });
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, transportTypes: [], accommodationTypes: [] });
    setPhotoPreview(null);
    setSelectedPhoto(null);
    setDialogOpen(true);
  };

  const openEdit = (item: PackingItem) => {
    setEditTarget(item);
    setForm({
      name:               item.name,
      category:           item.category,
      essential:          item.essential,
      tripTypes:          item.tripTypes ?? ['always'],
      transportTypes:     item.transportTypes     ?? [],
      accommodationTypes: item.accommodationTypes ?? [],
      quantityType:       item.quantityType,
      quantity:           item.quantity,
      quantityMin:        item.quantityMin ?? 1,
      quantityMax:        item.quantityMax ?? 10,
      preTravelAction:    item.preTravelAction,
      preTravelNote:      item.preTravelNote || '',
      advisoryNote:       item.advisoryNote  || '',
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
      const uploadData = await fetch('/api/packing/catalogue/upload', { method: 'POST', body: formData }).then(r => r.json());
      photoUrl = uploadData.url;
      setUploading(false);
    }
    const payload = { ...form, photoUrl };
    if (editTarget) {
      const data = await fetch(`/api/packing/catalogue/${editTarget._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json());
      setItems(prev => prev.map(i => i._id === editTarget._id ? data.item : i));
    } else {
      const data = await fetch('/api/packing/catalogue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json());
      setItems(data.items);
    }
    setDialogOpen(false);
    setForm({ ...emptyForm, transportTypes: [], accommodationTypes: [] });
    setSelectedPhoto(null); setPhotoPreview(null); setEditTarget(null);
    setSaving(false);
  };

  const handleDelete = async (item: PackingItem) => {
    await fetch(`/api/packing/catalogue/${item._id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i._id !== item._id));
    setDeleteTarget(null);
  };

  const filtered   = filterCategory === 'All' ? items : items.filter(i => i.category === filterCategory);
  const categories = ['All', ...CATEGORIES];

  const qtyLabel = (item: PackingItem) =>
    item.quantityType === 'fixed'
      ? `Qty: ${item.quantity}`
      : `${item.quantity}/night (${item.quantityMin}–${item.quantityMax})`;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: D.bg }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: D.navy }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Box
            component="img" src="/logomark.png" alt="Tabiji"
            onClick={() => router.push('/dashboard')}
            sx={{ height: 48, width: 48, objectFit: 'contain', cursor: 'pointer', mr: 1.5 }}
          />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: 'white', flexGrow: 1, letterSpacing: '-0.01em' }}>
            Packing Catalogue
          </Typography>
          <IconButton color="inherit" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} sx={{ mr: 1 }}>
            {viewMode === 'grid' ? <ListIcon /> : <GridViewIcon />}
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={{ backgroundColor: D.terra, '&:hover': { backgroundColor: '#b5633e' }, fontWeight: 800, fontFamily: D.body }}
          >
            Add Item
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* ── Stats strip ── */}
        <Box sx={{
          display: 'flex', gap: 4, mb: 4,
          pb: 3, borderBottom: `2px solid ${D.navy}`,
          alignItems: 'baseline',
        }}>
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '3rem', color: D.navy, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {items.length}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted, mt: 0.25 }}>
              Items
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '3rem', color: D.green, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {items.filter(i => i.essential).length}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted, mt: 0.25 }}>
              Essentials
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '3rem', color: D.terra, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {items.filter(i => i.preTravelAction).length}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted, mt: 0.25 }}>
              Pre-travel
            </Typography>
          </Box>
        </Box>

        {/* ── Category filter ── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat];
            const active = filterCategory === cat;
            return (
              <Chip
                key={cat}
                icon={Icon ? <Icon sx={{ fontSize: '0.9rem !important', opacity: active ? 1 : 0.6 }} /> : undefined}
                label={cat}
                onClick={() => setFilterCategory(cat)}
                sx={{
                  cursor: 'pointer',
                  fontFamily: D.body,
                  fontWeight: active ? 800 : 500,
                  backgroundColor: active ? D.navy : 'transparent',
                  color: active ? 'white' : D.navy,
                  border: `1px solid ${active ? D.navy : D.rule}`,
                  '&:hover': { backgroundColor: active ? D.navy : 'rgba(29,38,66,0.06)' },
                  '& .MuiChip-icon': { color: active ? 'white' : D.muted },
                }}
              />
            );
          })}
        </Box>

        {/* ── Content ── */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: D.green }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.5rem', color: D.muted }}>No items yet</Typography>
            <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2, backgroundColor: D.terra }} onClick={openAdd}>
              Add your first item
            </Button>
          </Box>
        ) : viewMode === 'grid' ? (

          <Grid container spacing={2}>
            {filtered.map(item => {
              const essential = item.essential;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item._id}>
                  <Card sx={{
                    height: '100%',
                    backgroundColor: D.paper,
                    border: `1px solid ${D.rule}`,
                    borderLeft: essential ? `3px solid ${D.green}` : `1px solid ${D.rule}`,
                    borderRadius: 1.5,
                    boxShadow: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>

                    {/* Ghost category icon */}
                    <CategoryGhost category={item.category} />

                    {/* Photo thumbnail — only if photo exists, small */}
                    {item.photoUrl && (
                      <Box
                        component="img"
                        src={item.photoUrl}
                        alt={item.name}
                        sx={{
                          position: 'absolute', top: 10, right: 10,
                          width: 44, height: 44,
                          borderRadius: 1, objectFit: 'cover',
                          border: `1px solid ${D.rule}`,
                          zIndex: 1,
                        }}
                      />
                    )}

                    <CardContent sx={{ pb: 1, flexGrow: 1, position: 'relative', zIndex: 1 }}>

                      {/* Category micro-label */}
                      <Typography sx={{
                        fontSize: '0.68rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: D.muted, mb: 0.5,
                        display: 'flex', alignItems: 'center', gap: 0.5,
                      }}>
                        {(() => { const Icon = CATEGORY_ICONS[item.category]; return Icon ? <Icon sx={{ fontSize: 11 }} /> : null; })()}
                        {item.category}
                      </Typography>

                      {/* Item name — display anchor */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{
                          fontFamily: D.display,
                          fontSize: '1.1rem',
                          color: D.navy,
                          lineHeight: 1.25,
                          letterSpacing: '-0.01em',
                          pr: item.photoUrl ? 6 : 0,
                        }}>
                          {item.name}
                        </Typography>
                        {item.preTravelAction && (
                          <Tooltip title={item.preTravelNote || 'Pre-travel action required'}>
                            <WarningAmberIcon sx={{ fontSize: 16, color: D.terra, flexShrink: 0, mt: 0.25 }} />
                          </Tooltip>
                        )}
                      </Box>

                      {/* Trip type chips — only non-"always" */}
                      {(item.tripTypes ?? []).filter(t => t !== 'always').length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
                          {(item.tripTypes ?? []).filter(t => t !== 'always').map(t => (
                            <Chip key={t} label={t} size="small" variant="outlined"
                              sx={{ fontSize: '0.68rem', height: 20, color: D.muted, borderColor: D.rule }} />
                          ))}
                        </Box>
                      )}

                      {/* Qty */}
                      <Typography sx={{ fontSize: '0.8rem', color: D.muted, mt: 0.5 }}>
                        {qtyLabel(item)}
                      </Typography>

                      {/* Filter constraints */}
                      {((item.transportTypes ?? []).length > 0 || (item.accommodationTypes ?? []).length > 0) && (
                        <Typography sx={{ fontSize: '0.68rem', color: D.muted, mt: 0.5, fontStyle: 'italic' }}>
                          Only on: {[...(item.transportTypes ?? []), ...(item.accommodationTypes ?? [])].join(', ')}
                        </Typography>
                      )}

                      {/* Advisory note */}
                      {item.advisoryNote && (
                        <Typography sx={{ fontSize: '0.78rem', color: D.muted, mt: 0.75, fontStyle: 'italic', lineHeight: 1.4 }}>
                          {item.advisoryNote}
                        </Typography>
                      )}
                    </CardContent>

                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 1, px: 1.5, position: 'relative', zIndex: 1 }}>
                      <IconButton size="small" onClick={() => openEdit(item)}
                        sx={{ color: D.muted, '&:hover': { color: D.navy } }}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(item)}
                        sx={{ color: D.muted, '&:hover': { color: '#d32f2f' } }}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

        ) : (

          // ── List view ──
          <TableContainer component={Paper} sx={{ backgroundColor: D.paper, border: `1px solid ${D.rule}`, boxShadow: 'none', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: `2px solid ${D.navy}` }}>
                  {['Name', 'Category', 'Trip types', 'Transport / Accom', 'Quantity', 'Flags', 'Notes', ''].map(h => (
                    <TableCell key={h} sx={{
                      fontFamily: D.body, fontWeight: 700, fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: D.muted, borderBottom: 'none',
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item._id} hover sx={{
                    borderLeft: item.essential ? `3px solid ${D.green}` : '3px solid transparent',
                    '&:hover': { backgroundColor: 'rgba(29,38,66,0.02)' },
                  }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.photoUrl && (
                          <Box component="img" src={item.photoUrl}
                            sx={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }} />
                        )}
                        <Typography sx={{ fontFamily: D.display, fontSize: '0.9rem', color: D.navy }}>
                          {item.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {(() => { const Icon = CATEGORY_ICONS[item.category]; return Icon ? <Icon sx={{ fontSize: 13, color: D.muted }} /> : null; })()}
                        <Typography sx={{ fontSize: '0.82rem', color: D.muted }}>{item.category}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(item.tripTypes ?? []).map(t => (
                          <Chip key={t} label={t} size="small" variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20, color: D.muted, borderColor: D.rule }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(item.transportTypes ?? []).map(t => (
                          <Chip key={t} label={t} size="small" color="info" variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20 }} />
                        ))}
                        {(item.accommodationTypes ?? []).map(t => (
                          <Chip key={t} label={t} size="small" color="secondary" variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20 }} />
                        ))}
                        {!(item.transportTypes?.length) && !(item.accommodationTypes?.length) && (
                          <Typography sx={{ fontSize: '0.78rem', color: D.muted }}>All</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.82rem', color: D.muted }}>{qtyLabel(item)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {item.essential && (
                          <Chip label="Essential" size="small"
                            sx={{ fontSize: '0.68rem', height: 20, backgroundColor: 'rgba(107,124,92,0.12)', color: D.green, fontWeight: 700 }} />
                        )}
                        {item.preTravelAction && (
                          <Tooltip title={item.preTravelNote || 'Pre-travel action required'}>
                            <Chip label="Pre-travel" size="small"
                              sx={{ fontSize: '0.68rem', height: 20, backgroundColor: 'rgba(196,113,74,0.12)', color: D.terra, fontWeight: 700 }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      {item.advisoryNote && (
                        <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontStyle: 'italic' }}>
                          {item.advisoryNote}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(item)}
                        sx={{ color: D.muted, '&:hover': { color: D.navy } }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(item)}
                        sx={{ color: D.muted, '&:hover': { color: '#d32f2f' } }}>
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.navy }}>
          {editTarget ? `Edit — ${editTarget.name}` : 'Add Packing Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

            {/* Photo upload */}
            <Box
              sx={{
                height: 160, border: '2px dashed', borderColor: D.rule, borderRadius: 1.5,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                '&:hover': { borderColor: D.green },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <Box component="img" src={photoPreview} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <PhotoCameraIcon sx={{ fontSize: 36, color: D.muted, mb: 1 }} />
                  <Typography sx={{ fontSize: '0.88rem', color: D.muted }}>Click to add photo</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: D.muted, opacity: 0.7 }}>Optional — useful for insurance</Typography>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoSelect} />
            </Box>

            {/* Name + Category */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Item name" value={form.name} required fullWidth
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category"
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => (
                    <MenuItem key={c} value={c}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {(() => { const Icon = CATEGORY_ICONS[c]; return Icon ? <Icon sx={{ fontSize: 16, color: D.muted }} /> : null; })()}
                        {c}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Divider />

            {/* Trip type */}
            <Box>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: D.body, mb: 0.5 }}>Trip type</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: D.muted, display: 'block', mb: 1 }}>
                Leave all unselected to include on all trip types
              </Typography>
              <ToggleButtonGroup value={form.tripTypes}
                onChange={(_, val) => val.length && setForm(p => ({ ...p, tripTypes: val }))}
                fullWidth>
                {TRIP_TYPES.map(t => (
                  <ToggleButton key={t} value={t} size="small"
                    sx={{ textTransform: 'none', fontWeight: 600, fontFamily: D.body }}>
                    {t}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <FilterToggleGroup
              label="Only include when transport includes"
              hint="Leave all unselected to include regardless of transport"
              options={TRANSPORT_TYPES}
              value={form.transportTypes}
              onChange={val => setForm(p => ({ ...p, transportTypes: val }))}
            />

            <FilterToggleGroup
              label="Only include when accommodation includes"
              hint="Leave all unselected to include regardless of accommodation"
              options={ACCOM_TYPES}
              value={form.accommodationTypes}
              onChange={val => setForm(p => ({ ...p, accommodationTypes: val }))}
            />

            <Divider />

            {/* Quantity */}
            <Box>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: D.body, mb: 1 }}>Quantity</Typography>
              <ToggleButtonGroup value={form.quantityType} exclusive
                onChange={(_, val) => val && setForm(p => ({ ...p, quantityType: val }))}
                sx={{ mb: 2 }}>
                <ToggleButton value="fixed" size="small" sx={{ textTransform: 'none', fontFamily: D.body }}>Fixed</ToggleButton>
                <ToggleButton value="per_night" size="small" sx={{ textTransform: 'none', fontFamily: D.body }}>Per night</ToggleButton>
              </ToggleButtonGroup>
              {form.quantityType === 'fixed' ? (
                <TextField label="Quantity" type="number" value={form.quantity} fullWidth inputProps={{ min: 1 }}
                  onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Per night" type="number" value={form.quantity} fullWidth inputProps={{ min: 1 }}
                    onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
                  <TextField label="Min" type="number" value={form.quantityMin} fullWidth inputProps={{ min: 1 }}
                    onChange={e => setForm(p => ({ ...p, quantityMin: Number(e.target.value) }))} />
                  <TextField label="Max" type="number" value={form.quantityMax} fullWidth inputProps={{ min: 1 }}
                    onChange={e => setForm(p => ({ ...p, quantityMax: Number(e.target.value) }))} />
                </Box>
              )}
            </Box>

            <Divider />

            <FormControlLabel
              control={<Switch checked={form.essential} onChange={e => setForm(p => ({ ...p, essential: e.target.checked }))}
                sx={{ '& .MuiSwitch-thumb': { backgroundColor: form.essential ? D.green : undefined } }} />}
              label={<Typography sx={{ fontSize: '0.9rem', fontFamily: D.body }}>Essential — always highlighted regardless of trip type</Typography>}
            />

            <FormControlLabel
              control={<Switch checked={form.preTravelAction} onChange={e => setForm(p => ({ ...p, preTravelAction: e.target.checked }))}
                color="warning" />}
              label={<Typography sx={{ fontSize: '0.9rem', fontFamily: D.body }}>Requires pre-travel action</Typography>}
            />

            {form.preTravelAction && (
              <TextField label="Pre-travel action note" placeholder="e.g. Charge fully before packing"
                value={form.preTravelNote} fullWidth
                onChange={e => setForm(p => ({ ...p, preTravelNote: e.target.value }))} />
            )}

            <TextField label="Advisory note (optional)" placeholder="e.g. 100ml or less for carry-on"
              value={form.advisoryNote} fullWidth
              onChange={e => setForm(p => ({ ...p, advisoryNote: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => {
            setDialogOpen(false);
            setForm({ ...emptyForm, transportTypes: [], accommodationTypes: [] });
            setPhotoPreview(null); setSelectedPhoto(null); setEditTarget(null);
          }} sx={{ color: D.muted }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || saving}
            sx={{ backgroundColor: D.terra, '&:hover': { backgroundColor: '#b5633e' }, fontWeight: 800 }}>
            {uploading ? 'Uploading photo…' : saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Save Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy }}>
          Delete {deleteTarget?.name}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: D.muted }}>
            This will permanently remove it from your catalogue.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: D.muted }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}