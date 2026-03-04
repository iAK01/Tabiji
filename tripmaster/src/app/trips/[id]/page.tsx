'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton,
  Tabs, Tab, Chip, Button, Paper, CircularProgress, Tooltip, alpha,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, Divider,
  useMediaQuery, useTheme,
  SpeedDial, SpeedDialIcon, SpeedDialAction, Fab,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import EditIcon            from '@mui/icons-material/Edit';
import DeleteForeverIcon   from '@mui/icons-material/DeleteForever';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import RefreshIcon         from '@mui/icons-material/Refresh';
import FlightIcon          from '@mui/icons-material/Flight';
import MapIcon             from '@mui/icons-material/Map';
import BackpackIcon        from '@mui/icons-material/Backpack';
import LightbulbIcon       from '@mui/icons-material/Lightbulb';
import WbSunnyIcon         from '@mui/icons-material/WbSunny';
import GridViewIcon        from '@mui/icons-material/GridView';
import FolderOpenIcon      from '@mui/icons-material/FolderOpen';
import HotelIcon           from '@mui/icons-material/Hotel';
import PlaceIcon           from '@mui/icons-material/Place';
import AddLocationAltIcon  from '@mui/icons-material/AddLocationAlt';
import PlaylistAddIcon     from '@mui/icons-material/PlaylistAdd';
import NoteAddIcon         from '@mui/icons-material/NoteAdd';
import AssignmentIcon      from '@mui/icons-material/Assignment';
import LinkIcon            from '@mui/icons-material/Link';
import PersonAddIcon       from '@mui/icons-material/PersonAdd';
import UploadFileIcon      from '@mui/icons-material/UploadFile';
import LogisticsTab        from '@/components/logistics/LogisticsTab';
import ItineraryTab        from '@/components/itinerary/ItineraryTab';
import PackingTab          from '@/components/packing/PackingTab';
import IntelligenceTab     from '@/components/intelligence/IntelligenceTab';
import WeatherTab          from '@/components/weather/WeatherTab';
import TripOverview        from '@/components/overview/TripOverview';
import FilesTab            from '@/components/files/FilesTab';
import OnTripScreen        from '@/components/trips/OnTripScreen';
import ReceiptIcon         from '@mui/icons-material/Receipt';

import dynamic             from 'next/dynamic';
import { saveTripCache, getTripCache, queueAction } from '@/lib/offline/db';

const MapTab = dynamic(() => import('@/components/map/MapTab'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeatherDay {
  date:          string;
  label:         string;
  condition:     string;
  icon:          string;
  tempAvg:       number;
  tempMax:       number;
  tempMin:       number;
  chanceOfRain:  number;
  precipMm:      number;
  windKph:       number;
  humidity:      number | null;
  uvIndex:       number | null;
  source:        string;
}

interface Trip {
  _id:            string;
  name:           string;
  tripType:       string;
  status:         string;
  purpose:        string;
  origin:         { city: string; country: string };
  destination:    { city: string; country: string };
  startDate:      string;
  endDate:        string;
  nights:         number;
  coverPhotoUrl?:    string;
  coverPhotoThumb?:  string;
  coverPhotoCredit?: string;
  dismissedChecks?:  string[];
  weather?: {
    summary?:       string;
    packingNotes?:  string[];
    days?:          WeatherDay[];
    currentWeather?: WeatherDay[];
    homeComparison?: {
      tempDeltaLabel?: string;
      insights?: { icon: string; text: string }[];
    };
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default', planning: 'warning', confirmed: 'primary',
  active: 'success', completed: 'default', cancelled: 'error',
};

const TAB_CONFIG = [
  { label: 'Overview',  Icon: GridViewIcon },
  { label: 'Logistics', Icon: FlightIcon },
  { label: 'Itinerary', Icon: MapIcon },
  { label: 'Packing',   Icon: BackpackIcon },
  { label: 'Discover',  Icon: LightbulbIcon },
  { label: 'Weather',   Icon: WbSunnyIcon },
  { label: 'Map',       Icon: MapIcon },
  { label: 'Resources', Icon: FolderOpenIcon },
];

export type FabTrigger = { action: string; seq: number };

type FabActionConfig = { label: string; icon: React.ReactNode; action: string };

const ACTION_TAB_MAP: Record<string, number> = {
  transport: 1, accom: 1, venue: 1,
  stop: 2,
  item: 3,
  note: 7, todo: 7, link: 7, contact: 7, file: 7,
};

const TAB_FAB_ACTIONS: Record<number, FabActionConfig[]> = {
  0: [ // Overview — navigates to the right tab then fires
    { label: 'Transport',     icon: <FlightIcon />,         action: 'transport' },
    { label: 'Accommodation', icon: <HotelIcon />,          action: 'accom'     },
    { label: 'Venue',         icon: <PlaceIcon />,          action: 'venue'     },
    { label: 'Stop',          icon: <AddLocationAltIcon />, action: 'stop'      },
    { label: 'Packing item',  icon: <PlaylistAddIcon />,    action: 'item'      },
    { label: 'Note',          icon: <NoteAddIcon />,        action: 'note'      },
    { label: 'To-do',         icon: <AssignmentIcon />,     action: 'todo'      },
    { label: 'Link',          icon: <LinkIcon />,           action: 'link'      },
    { label: 'Contact',       icon: <PersonAddIcon />,      action: 'contact'   },
    { label: 'File',          icon: <UploadFileIcon />,     action: 'file'      },
  ],
  1: [ // Logistics
    { label: 'Transport',     icon: <FlightIcon />,         action: 'transport' },
    { label: 'Accommodation', icon: <HotelIcon />,          action: 'accom'     },
    { label: 'Venue',         icon: <PlaceIcon />,          action: 'venue'     },
  ],
  2: [ // Itinerary
    { label: 'Add stop',      icon: <AddLocationAltIcon />, action: 'stop'      },
  ],
  3: [ // Packing
    { label: 'Add item',      icon: <PlaylistAddIcon />,    action: 'item'      },
  ],
  7: [ // Resources
    { label: 'Note',          icon: <NoteAddIcon />,        action: 'note'      },
    { label: 'To-do',         icon: <AssignmentIcon />,     action: 'todo'      },
    { label: 'Link',          icon: <LinkIcon />,           action: 'link'      },
    { label: 'Contact',       icon: <PersonAddIcon />,      action: 'contact'   },
    { label: 'File',          icon: <UploadFileIcon />,     action: 'file'      },
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [trip,      setTrip]      = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editOpen,  setEditOpen]  = useState(false);
  const [editForm,  setEditForm]  = useState({
    name: '', tripType: '', purpose: '', startDate: '', endDate: '', status: '',
  });

  // ── FAB state ──
  const [fabTrigger, setFabTrigger] = useState<FabTrigger | null>(null);
  const [fabOpen,    setFabOpen]    = useState(false);

  // ── Delete state ──
  const [deletePreviewOpen,  setDeletePreviewOpen]  = useState(false);
  const [deleteConfirmOpen,  setDeleteConfirmOpen]  = useState(false);
  const [deletePreview,      setDeletePreview]      = useState<any>(null);
  const [deleting,           setDeleting]           = useState(false);
  const [deleteError,        setDeleteError]        = useState('');

  useEffect(() => {
    async function loadTrip() {
      try {
        const res  = await fetch(`/api/trips/${id}`);
        const data = await res.json();
        setTrip(data.trip);
        await saveTripCache(String(id), data.trip);

        if (!data.trip?.coverPhotoUrl && data.trip?.destination?.city) {
          const photoRes  = await fetch(`/api/trips/${data.trip._id}/cover-photo`, { method: 'POST' });
          const photoData = await photoRes.json();
          if (photoData.trip) {
            setTrip(photoData.trip);
            await saveTripCache(String(id), photoData.trip);
          }
        }
      } catch {
        const cached = await getTripCache(String(id));
        if (cached) setTrip(cached);
      }
    }
    loadTrip();
  }, [id]);

  const openEdit = () => {
    if (!trip) return;
    setEditForm({
      name:      trip.name,
      tripType:  trip.tripType,
      purpose:   trip.purpose || '',
      startDate: trip.startDate?.split('T')[0] ?? '',
      endDate:   trip.endDate?.split('T')[0] ?? '',
      status:    trip.status,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!trip) return;
    const nights =
      editForm.startDate && editForm.endDate
        ? Math.round((new Date(editForm.endDate).getTime() - new Date(editForm.startDate).getTime()) / 86400000)
        : trip.nights;
    const payload = { ...editForm, nights };

    if (!navigator.onLine) {
      await queueAction({ type: 'UPDATE_TRIP', tripId: trip._id, payload });
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('tabiji-sync');
      }
      setTrip({ ...trip, ...payload });
      setEditOpen(false);
      return;
    }

    const res  = await fetch(`/api/trips/${trip._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setTrip(data.trip);
    setEditOpen(false);
  };

  const getTripFabActions = (tripType: string): Record<number, FabActionConfig[]> => {
  const expenseAction: FabActionConfig = {
    label: 'Log expense', icon: <ReceiptIcon />, action: 'expense',
  };
  const isWork = tripType === 'work' || tripType === 'mixed';

  return {
    0: [
      ...(TAB_FAB_ACTIONS[0]),
      ...(isWork ? [expenseAction] : []),
    ],
    1: [
      ...(TAB_FAB_ACTIONS[1]),
      ...(isWork ? [expenseAction] : []),
    ],
    2: TAB_FAB_ACTIONS[2],
    3: TAB_FAB_ACTIONS[3],
    7: TAB_FAB_ACTIONS[7],
  };
};

  const refreshPhoto = async () => {
    if (!trip) return;
    const res  = await fetch(`/api/trips/${trip._id}/cover-photo`, { method: 'POST' });
    const data = await res.json();
    if (data.trip) setTrip(data.trip);
  };

  // ── Delete handlers ───────────────────────────────────────────────────────

  const openDeletePreview = async () => {
    setDeletePreview(null);
    setDeleteError('');
    setDeletePreviewOpen(true);
    try {
      const res  = await fetch(`/api/trips/${trip?._id}/delete-preview`);
      const data = await res.json();
      setDeletePreview(data);
    } catch {
      setDeleteError('Failed to load deletion summary. Please try again.');
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/trips/${trip._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.push('/dashboard');
    } catch {
      setDeleteError('Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  if (!trip) return null;

  const daysUntil = trip.startDate
    ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
    : null;

  // ── FAB fire helper ───────────────────────────────────────────────────────
  const fireFab = (action: string) => {
      if (action === 'expense') {
    window.open('https://imc.show/admin/expenses/new', '_blank');
    setFabOpen(false);
    return;
  }
    if (activeTab === 0) {
      const targetTab = ACTION_TAB_MAP[action];
      if (targetTab !== undefined) setActiveTab(targetTab);
    }
    setFabTrigger({ action, seq: (fabTrigger?.seq ?? 0) + 1 });
    setFabOpen(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: { xs: 6, sm: 0 } }}>

 {/* ── AppBar ── */}
<AppBar position="static" elevation={0} sx={{ backgroundColor: 'text.primary' }}>
  {/* ── Utility row: nav + status ── */}
  <Toolbar sx={{ minHeight: 48, gap: 1, px: { xs: 1.5, sm: 2 } }}>
    <IconButton color="inherit" onClick={() => router.push('/dashboard')} size="small">
      <ArrowBackIcon fontSize="small" />
    </IconButton>
    <Box
      component="img"
      src="/Logo.jpeg"
      alt="Logo"
      onClick={() => router.push('/dashboard')}
      sx={{ flexShrink: 0, width: 36, height: 36, objectFit: 'contain', cursor: 'pointer', opacity: 0.9 }}
    />
    <Box sx={{ flexGrow: 1 }} />
    <Chip
      label={trip.status}
      color={STATUS_COLOURS[trip.status]}
      size="small"
      sx={{ fontWeight: 700, textTransform: 'capitalize' }}
    />
    <IconButton color="inherit" onClick={openEdit} size="small">
      <EditIcon fontSize="small" />
    </IconButton>
  </Toolbar>

{/* ── Hero name block ── */}
<Box sx={{
  px: { xs: 2.5, sm: 3.5 },
  pt: 0.5,
  pb: 3,
  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 100%)',
}}>
  <Typography sx={{
    color: 'rgba(255,255,255,0.35)',
    fontSize: { xs: '0.68rem', sm: '0.72rem' },
    fontWeight: 800,
    letterSpacing: 3,
    textTransform: 'uppercase',
    mb: 0.75,
  }}>
    {trip.destination?.city}{trip.destination?.country ? `, ${trip.destination.country}` : ''}
  </Typography>

  <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
    <Box sx={{
      width: 5,
      alignSelf: 'stretch',
      background: 'linear-gradient(180deg, #E8622A 0%, #A03D10 100%)',
      borderRadius: '2px',
      mr: 2.5,
      flexShrink: 0,
    }} />

    <Typography sx={{
      color: 'rgba(255,255,255,0.92)',
      fontWeight: 900,
      fontSize: { xs: '2.4rem', sm: '3.2rem', md: '3.8rem' },
      lineHeight: 1.05,
      letterSpacing: { xs: '-1px', sm: '-2px' },
      textShadow: [
        '0 1px 0 rgba(255,255,255,0.07)',
        '0 -1px 0 rgba(0,0,0,0.5)',
        '0 4px 20px rgba(0,0,0,0.55)',
        '0 1px 2px rgba(0,0,0,0.8)',
      ].join(', '),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {trip.name}
    </Typography>
  </Box>
</Box>
</AppBar>

      {/* ── Tabs ── */}
      <Box sx={{ backgroundColor: 'text.primary', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Container maxWidth="lg" disableGutters>
<Tabs
  value={activeTab}
  onChange={(_, val) => setActiveTab(val)}
  textColor="inherit"
  variant={isMobile ? 'scrollable' : 'fullWidth'}
  scrollButtons={false}
  TabIndicatorProps={{ style: { backgroundColor: '#C9521B', height: 3, borderRadius: '3px 3px 0 0' } }}
  sx={{
    '& .MuiTab-root': {
      minHeight: 64,
      minWidth: { xs: 80, sm: 120 },
      flexDirection: 'column',
      gap: 0.5,
      fontSize: { xs: '0.7rem', sm: '0.75rem' },
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: 'rgba(255,255,255,0.4)',
      transition: 'all 0.18s ease',
      position: 'relative',
      overflow: 'hidden',
      '&:hover': {
        color: 'rgba(255,255,255,0.9)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        '& svg': {
          color: '#C9521B',
          transform: 'translateY(-2px)',
          filter: 'drop-shadow(0 0 6px rgba(201,82,27,0.7))',
        },
      },
      '&.Mui-selected': {
        color: 'white',
        fontWeight: 800,
        '& svg': {
          color: '#C9521B',
          filter: 'drop-shadow(0 0 8px rgba(201,82,27,0.8))',
        },
      },
      '& svg': {
        fontSize: { xs: '1.15rem', sm: '1.25rem' },
        transition: 'all 0.18s ease',
        color: 'inherit',
      },
    },
  }}
>
  {TAB_CONFIG.map(({ label, Icon }) => (
    <Tab key={label} label={label} icon={<Icon />} iconPosition="top" />
  ))}
</Tabs>
        </Container>
      </Box>

      {/* ── Cover photo ── */}
      {trip.coverPhotoUrl && (
        <Box sx={{
          height: { xs: 190, sm: 240 },
          backgroundImage: `url(${trip.coverPhotoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.62))' }} />
          <Box sx={{ position: 'absolute', bottom: 14, left: 16, right: 56 }}>
            <Typography sx={{ color: 'white', fontWeight: 900, lineHeight: 1.2, fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
              {trip.destination?.city}, {trip.destination?.country}
            </Typography>
            {daysUntil !== null && daysUntil > 0 && (
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: { xs: '0.9rem', sm: '0.95rem' }, mt: 0.3 }}>
                {daysUntil} days away · {trip.nights} nights
              </Typography>
            )}
            {daysUntil === 0 && (
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', mt: 0.3 }}>Today</Typography>
            )}
          </Box>
          <IconButton
            onClick={refreshPhoto}
            sx={{ position: 'absolute', bottom: 10, right: 12, color: 'white', backgroundColor: 'rgba(0,0,0,0.35)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.55)' }, p: 1 }}
            size="small"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* ── Tab content ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}>

        {trip.status === 'active' && <OnTripScreen tripId={trip._id} trip={trip} />}

        {activeTab === 0 && <TripOverview trip={trip} onNavigate={setActiveTab} />}
        {activeTab === 1 && <LogisticsTab tripId={trip._id} trip={trip} fabTrigger={fabTrigger} />}
        {activeTab === 2 && <ItineraryTab tripId={trip._id} startDate={trip.startDate} endDate={trip.endDate} fabTrigger={fabTrigger} />}
        {activeTab === 3 && <PackingTab tripId={trip._id} tripType={trip.tripType} nights={trip.nights} startDate={trip.startDate} fabTrigger={fabTrigger} />}
        {activeTab === 4 && <IntelligenceTab tripId={trip._id} />}
        {activeTab === 5 && <WeatherTab tripId={trip._id} destinationCity={trip.destination?.city} />}
        {activeTab === 6 && <MapTab tripId={trip._id} trip={trip} />}
        {activeTab === 7 && <FilesTab tripId={trip._id} fabTrigger={fabTrigger} />}
      </Container>

      {/* ── Context-aware FAB ── */}
      {getTripFabActions(trip.tripType)[activeTab] && (() => {
        const actions = getTripFabActions(trip.tripType)[activeTab];
        if (actions.length === 1) {
          return (
            <Tooltip title={actions[0].label} placement="left">
              <Fab
                onClick={() => fireFab(actions[0].action)}
                sx={{
                  position: 'fixed', bottom: { xs: 24, sm: 32 }, right: { xs: 16, sm: 32 }, zIndex: 1050,
                  backgroundColor: '#55702C', color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                  '&:hover': { backgroundColor: '#455f24' },
                }}
              >
                {actions[0].icon}
              </Fab>
            </Tooltip>
          );
        }
        return (
          <SpeedDial
            ariaLabel="Quick add"
            open={fabOpen}
            onOpen={() => setFabOpen(true)}
            onClose={() => setFabOpen(false)}
            icon={<SpeedDialIcon />}
            sx={{
              position: 'fixed', bottom: { xs: 24, sm: 32 }, right: { xs: 16, sm: 32 }, zIndex: 1050,
              '& .MuiSpeedDial-fab': {
                backgroundColor: '#55702C', color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                '&:hover': { backgroundColor: '#455f24' },
              },
            }}
          >
            {actions.map(({ label, icon, action }) => (
              <SpeedDialAction
                key={action}
                icon={icon}
                tooltipTitle={label}
                tooltipOpen={isMobile}
                onClick={() => fireFab(action)}
                sx={{ '& .MuiSpeedDialAction-fab': { color: '#55702C', '&:hover': { backgroundColor: alpha('#55702C', 0.1) } } }}
              />
            ))}
          </SpeedDial>
        );
      })()}

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle fontWeight={700} sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }}>Edit Trip</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField label="Trip name" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={editForm.status} label="Status" onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {['idea', 'planning', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Trip type</InputLabel>
              <Select value={editForm.tripType} label="Trip type" onChange={e => setEditForm(p => ({ ...p, tripType: e.target.value }))}>
                <MenuItem value="leisure">Leisure</MenuItem>
                <MenuItem value="work">Work</MenuItem>
                <MenuItem value="mixed">Mixed</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField label="Departure date" type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label="Return date"    type="date" value={editForm.endDate}   onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}   fullWidth InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField label="Purpose / notes" value={editForm.purpose} onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value }))} fullWidth multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            startIcon={<DeleteForeverIcon />}
            onClick={() => { setEditOpen(false); openDeletePreview(); }}
            sx={{ mr: 'auto', color: '#dc2626', '&:hover': { backgroundColor: alpha('#dc2626', 0.06) } }}
            fullWidth={isMobile}
            size="large"
          >
            Delete trip
          </Button>
          <Button onClick={() => setEditOpen(false)} fullWidth={isMobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.name} fullWidth={isMobile} size="large">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete preview dialog (Step 1: audit) ── */}
      <Dialog
        open={deletePreviewOpen}
        onClose={() => !deleting && setDeletePreviewOpen(false)}
        maxWidth="sm" fullWidth fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700, color: '#dc2626' }}>
          <WarningAmberIcon />
          Delete "{trip?.name}"?
        </DialogTitle>
        <DialogContent>
          {!deletePreview && !deleteError && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}
          {deleteError && (
            <Typography color="error" variant="body2">{deleteError}</Typography>
          )}
          {deletePreview && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                This will permanently delete the following. This cannot be undone.
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <List dense disablePadding>
                  {deletePreview.audit.itinerary.days > 0 && (
                    <>
                      <ListItem>
                        <ListItemText
                          primary={`Itinerary — ${deletePreview.audit.itinerary.days} day${deletePreview.audit.itinerary.days !== 1 ? 's' : ''}, ${deletePreview.audit.itinerary.stops} stop${deletePreview.audit.itinerary.stops !== 1 ? 's' : ''}`}
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  {(deletePreview.audit.logistics.transport > 0 || deletePreview.audit.logistics.accommodation > 0 || deletePreview.audit.logistics.venues > 0) && (
                    <>
                      <ListItem>
                        <ListItemText
                          primary={[
                            deletePreview.audit.logistics.transport > 0 && `${deletePreview.audit.logistics.transport} transport booking${deletePreview.audit.logistics.transport !== 1 ? 's' : ''}`,
                            deletePreview.audit.logistics.accommodation > 0 && `${deletePreview.audit.logistics.accommodation} accommodation`,
                            deletePreview.audit.logistics.venues > 0 && `${deletePreview.audit.logistics.venues} venue${deletePreview.audit.logistics.venues !== 1 ? 's' : ''}`,
                          ].filter(Boolean).join(', ')}
                          secondary="Logistics"
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  {deletePreview.audit.files.total > 0 && (
                    <>
                      <ListItem>
                        <ListItemText
                          primary={`${deletePreview.audit.files.total} resource${deletePreview.audit.files.total !== 1 ? 's' : ''} — ${Object.entries(deletePreview.audit.files.byType).map(([k, v]) => `${v} ${k}${(v as number) !== 1 ? 's' : ''}`).join(', ')}`}
                          secondary="Files, links, contacts, notes, todos"
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  {deletePreview.audit.gcsAttachments.length > 0 && (
                    <>
                      <ListItem sx={{ backgroundColor: alpha('#dc2626', 0.04) }}>
                        <ListItemText
                          primary={`${deletePreview.audit.gcsAttachments.length} uploaded file${deletePreview.audit.gcsAttachments.length !== 1 ? 's' : ''} will be permanently removed from storage`}
                          secondary={deletePreview.audit.gcsAttachments.map((f: any) => f.name).join(', ')}
                          primaryTypographyProps={{ color: '#dc2626', fontWeight: 700 }}
                        />
                      </ListItem>
                      <Divider />
                    </>
                  )}
                  {deletePreview.audit.pushLogs.total > 0 && (
                    <ListItem>
                      <ListItemText
                        primary={`${deletePreview.audit.pushLogs.total} push notification log${deletePreview.audit.pushLogs.total !== 1 ? 's' : ''}`}
                      />
                    </ListItem>
                  )}
                  {deletePreview.audit.packing.exists && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText primary="Packing list" />
                      </ListItem>
                    </>
                  )}
                  {deletePreview.audit.intelligence.exists && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemText primary="Cultural intelligence data" />
                      </ListItem>
                    </>
                  )}
                </List>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setDeletePreviewOpen(false)} fullWidth={isMobile} size="large">Cancel</Button>
          {deletePreview && (
            <Button
              variant="contained"
              onClick={() => { setDeletePreviewOpen(false); setDeleteConfirmOpen(true); }}
              fullWidth={isMobile} size="large"
              sx={{ backgroundColor: '#dc2626', '&:hover': { backgroundColor: '#b91c1c' } }}
              startIcon={<DeleteForeverIcon />}
            >
              Continue to delete
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog (Step 2: point of no return) ── */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        maxWidth="xs" fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626' }}>Are you absolutely sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            <strong>"{trip?.name}"</strong> and all its data will be permanently deleted. There is no undo.
          </Typography>
          {deleteError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>{deleteError}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} size="large">Cancel</Button>
          <Button
            variant="contained" onClick={handleDeleteTrip} disabled={deleting} size="large"
            sx={{ backgroundColor: '#dc2626', '&:hover': { backgroundColor: '#b91c1c' } }}
            startIcon={deleting ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <DeleteForeverIcon />}
          >
            {deleting ? 'Deleting…' : 'Permanently delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}