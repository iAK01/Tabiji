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
import { autoCacheTripFiles } from '@/lib/offline/fileCache';

const MapTab = dynamic(() => import('@/components/map/MapTab'), { ssr: false });

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

const STATUS_DOT: Record<string, string> = {
  confirmed: D.green,
  active:    D.green,
  planning:  D.terra,
  idea:      '#9ca3af',
  completed: '#9ca3af',
  cancelled: '#ef4444',
};

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
  stop: 2, item: 3,
  note: 7, todo: 7, link: 7, contact: 7, file: 7,
};

const TAB_FAB_ACTIONS: Record<number, FabActionConfig[]> = {
  0: [
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
  1: [
    { label: 'Transport',     icon: <FlightIcon />,         action: 'transport' },
    { label: 'Accommodation', icon: <HotelIcon />,          action: 'accom'     },
    { label: 'Venue',         icon: <PlaceIcon />,          action: 'venue'     },
  ],
  2: [{ label: 'Add stop',   icon: <AddLocationAltIcon />, action: 'stop'      }],
  3: [{ label: 'Add item',   icon: <PlaylistAddIcon />,    action: 'item'      }],
  7: [
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

  const [fabTrigger, setFabTrigger] = useState<FabTrigger | null>(null);
  const [fabOpen,    setFabOpen]    = useState(false);

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

  // ── Pre-cache all uploaded files for offline access ───────────────────────
  useEffect(() => {
    if (!id) return;
    fetch(`/api/trips/${id}/files`)
      .then(r => r.json())
      .then(data => autoCacheTripFiles(String(id), data.files ?? []))
      .catch(() => {});
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
      0: [...TAB_FAB_ACTIONS[0], ...(isWork ? [expenseAction] : [])],
      1: [...TAB_FAB_ACTIONS[1], ...(isWork ? [expenseAction] : [])],
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

  if (!trip) return null;

  const daysUntil = trip.startDate
    ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
    : null;

  const isActive = trip.status === 'active';
  const isPast   = trip.status === 'completed' ||
    (!!trip.endDate && new Date(trip.endDate) < new Date(new Date().setHours(0, 0, 0, 0)));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@300;400;500;600;700&display=swap');
      `}</style>

      <Box sx={{ minHeight: '100vh', backgroundColor: D.bg, pb: { xs: 10, sm: 4 } }}>

        {/* ── AppBar ── */}
        <AppBar position="static" elevation={0} sx={{
          backgroundColor: D.navy,
          borderBottom: `3px solid ${D.terra}`,
        }}>

          {/* Utility row */}
          <Toolbar sx={{ minHeight: 52, gap: 1, px: { xs: 1.5, sm: 2.5 } }}>
            <IconButton
              color="inherit"
              onClick={() => router.push('/dashboard')}
              size="small"
              sx={{ mr: 0.5 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>

            <Box
              component="img"
              src="/Logo.jpeg"
              alt="Logo"
              onClick={() => router.push('/dashboard')}
              sx={{ width: 36, height: 36, objectFit: 'contain', cursor: 'pointer', opacity: 0.85 }}
            />

            <Box sx={{ flexGrow: 1 }} />

            {/* Status pill — matches dashboard style */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              backgroundColor: alpha('#fff', 0.1),
              borderRadius: 10, px: 1.25, py: 0.45,
            }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: STATUS_DOT[trip.status] ?? alpha('#fff', 0.4),
                flexShrink: 0,
              }} />
              <Typography sx={{
                fontFamily: D.body, color: 'white', fontSize: '0.63rem',
                fontWeight: 800, textTransform: 'capitalize', letterSpacing: '0.05em',
              }}>
                {trip.status}
              </Typography>
            </Box>

            <IconButton color="inherit" onClick={openEdit} size="small" sx={{ ml: 0.5 }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Toolbar>

          {/* Hero name block */}
          <Box sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 0.5, pb: { xs: 2.5, sm: 3.5 } }}>

            {/* Destination — subdued overline */}
            <Typography sx={{
              fontFamily: D.body,
              color: alpha('#fff', 0.45),
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              mb: 1,
            }}>
              {trip.destination?.city}{trip.destination?.country ? `, ${trip.destination.country}` : ''}
            </Typography>

            {/* Trip name — Archivo Black, massive, tight */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Terracotta rule — same accent as dashboard hero */}
              <Box sx={{
                width: 4, alignSelf: 'stretch',
                backgroundColor: D.terra,
                borderRadius: 1,
                mr: { xs: 2, sm: 2.5 },
                flexShrink: 0,
              }} />
              <Typography sx={{
                fontFamily: D.display,
                color: 'white',
                fontSize: { xs: '2.6rem', sm: '3.8rem', md: '4.8rem' },
                lineHeight: 1.0,
                letterSpacing: '-0.03em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: { xs: 'normal', sm: 'nowrap' },
              }}>
                {trip.name}
              </Typography>
            </Box>

            {/* Meta row — nights · type · days away */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.75, ml: { xs: '28px', sm: '36px' } }}>
              <Typography sx={{
                fontFamily: D.body,
                color: alpha('#fff', 0.45),
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}>
                {trip.nights} nights
              </Typography>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: alpha('#fff', 0.2) }} />
              <Typography sx={{
                fontFamily: D.body,
                color: alpha('#fff', 0.45),
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                letterSpacing: '0.04em',
              }}>
                {trip.tripType}
              </Typography>
              {daysUntil !== null && daysUntil > 0 && !isActive && (
                <>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: alpha('#fff', 0.2) }} />
                  <Typography sx={{
                    fontFamily: D.display,
                    color: D.terra,
                    fontSize: '0.82rem',
                    letterSpacing: '-0.01em',
                  }}>
                    {daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days away`}
                  </Typography>
                </>
              )}
              {isActive && (
                <>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: alpha('#fff', 0.2) }} />
                  <Box sx={{
                    backgroundColor: D.green, borderRadius: 10,
                    px: 1, py: 0.2,
                  }}>
                    <Typography sx={{ fontFamily: D.body, color: 'white', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      On trip
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </AppBar>

        {/* ── Tabs ── */}
        <Box sx={{
          backgroundColor: D.navy,
          borderBottom: `1px solid ${alpha('#fff', 0.08)}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: `0 4px 20px ${alpha(D.navy, 0.35)}`,
        }}>
          <Container maxWidth="lg" disableGutters>
            <Tabs
              value={activeTab}
              onChange={(_, val) => {
            setActiveTab(val);
            if (trip.status === 'active') {
              setTimeout(() => {
                const el = document.getElementById('tab-content-anchor');
                if (el) {
                  const rect = el.getBoundingClientRect();
                  window.scrollBy({ top: rect.top - 62, behavior: 'smooth' });
                }
              }, 0);
            }
          }}
              textColor="inherit"
              variant={isMobile ? 'scrollable' : 'fullWidth'}
              scrollButtons={false}
              TabIndicatorProps={{
                style: {
                  backgroundColor: D.terra,
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                },
              }}
              sx={{
                '& .MuiTab-root': {
                  fontFamily: D.body,
                  minHeight: 58,
                  minWidth: { xs: 72, sm: 100 },
                  flexDirection: 'column',
                  gap: 0.6,
                  fontSize: { xs: '0.7rem', sm: '0.8rem' },
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: alpha('#fff', 0.35),
                  transition: 'color 0.15s',
                  '&:hover': { color: alpha('#fff', 0.8) },
                  '&.Mui-selected': {
                    color: 'white',
                    fontWeight: 800,
                  },
                  '& svg': {
                    fontSize: { xs: '1.3rem', sm: '1.5rem' },
                    transition: 'color 0.15s',
                  },
                  '&.Mui-selected svg': { color: D.terra },
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
            height: { xs: 200, sm: 260 },
            backgroundImage: `url(${trip.coverPhotoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
          }}>
            <Box sx={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to bottom, ${alpha(D.navy, 0.08)}, ${alpha(D.navy, 0.55)})`,
            }} />

            {/* Credit */}
            {trip.coverPhotoCredit && (
              <Typography sx={{
                position: 'absolute', bottom: 12, left: 16,
                fontFamily: D.body, color: alpha('#fff', 0.5),
                fontSize: '0.6rem', letterSpacing: '0.06em',
              }}>
                {trip.coverPhotoCredit}
              </Typography>
            )}

            <IconButton
              onClick={refreshPhoto}
              size="small"
              sx={{
                position: 'absolute', bottom: 10, right: 14,
                color: 'white',
                backgroundColor: alpha(D.navy, 0.45),
                backdropFilter: 'blur(4px)',
                '&:hover': { backgroundColor: alpha(D.navy, 0.65) },
                p: 0.9,
              }}
            >
              <RefreshIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
        )}

        {/* ── Tab content ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}>
          {trip.status === 'active' && <OnTripScreen tripId={trip._id} trip={trip} />}
          {trip.status === 'active' && <Box id="tab-content-anchor" />}
          {activeTab === 0 && <TripOverview trip={trip} onNavigate={setActiveTab} />}
          {activeTab === 1 && <LogisticsTab tripId={trip._id} trip={trip} fabTrigger={fabTrigger} />}
          {activeTab === 2 && <ItineraryTab tripId={trip._id} startDate={trip.startDate} endDate={trip.endDate} fabTrigger={fabTrigger} />}
          {activeTab === 3 && <PackingTab tripId={trip._id} tripType={trip.tripType} nights={trip.nights} startDate={trip.startDate} fabTrigger={fabTrigger} />}
          {activeTab === 4 && <IntelligenceTab tripId={trip._id} />}
          {activeTab === 5 && (
  <WeatherTab
    tripId={trip._id}
    destinationCity={trip.destination?.city}
    startDate={trip.startDate}
    endDate={trip.endDate}
  />
)}
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
                    backgroundColor: D.green, color: 'white',
                    boxShadow: `0 4px 20px ${alpha(D.navy, 0.3)}`,
                    '&:hover': { backgroundColor: '#556647' },
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
                  backgroundColor: D.green, color: 'white',
                  boxShadow: `0 4px 20px ${alpha(D.navy, 0.3)}`,
                  '&:hover': { backgroundColor: '#556647' },
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
                  sx={{ '& .MuiSpeedDialAction-fab': { color: D.green, '&:hover': { backgroundColor: alpha(D.green, 0.1) } } }}
                />
              ))}
            </SpeedDial>
          );
        })()}

        {/* ── Edit dialog ── */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: { sm: 2.5 }, backgroundColor: D.paper } }}>
          <DialogTitle sx={{
            fontFamily: D.display, fontSize: { xs: '1.5rem', sm: '1.8rem' },
            letterSpacing: '-0.02em', color: D.navy, pb: 1,
          }}>
            Edit Trip
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              <TextField label="Trip name" value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                fullWidth
                InputProps={{ sx: { fontFamily: D.body } }}
                InputLabelProps={{ sx: { fontFamily: D.body } }}
              />
              <FormControl fullWidth>
                <InputLabel sx={{ fontFamily: D.body }}>Status</InputLabel>
                <Select value={editForm.status} label="Status"
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  sx={{ fontFamily: D.body }}>
                  {['idea', 'planning', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontFamily: D.body, textTransform: 'capitalize' }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel sx={{ fontFamily: D.body }}>Trip type</InputLabel>
                <Select value={editForm.tripType} label="Trip type"
                  onChange={e => setEditForm(p => ({ ...p, tripType: e.target.value }))}
                  sx={{ fontFamily: D.body }}>
                  <MenuItem value="leisure" sx={{ fontFamily: D.body }}>Leisure</MenuItem>
                  <MenuItem value="work"    sx={{ fontFamily: D.body }}>Work</MenuItem>
                  <MenuItem value="mixed"   sx={{ fontFamily: D.body }}>Mixed</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField label="Departure date" type="date" value={editForm.startDate}
                  onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))}
                  fullWidth InputLabelProps={{ shrink: true, sx: { fontFamily: D.body } }}
                  InputProps={{ sx: { fontFamily: D.body } }}
                />
                <TextField label="Return date" type="date" value={editForm.endDate}
                  onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
                  fullWidth InputLabelProps={{ shrink: true, sx: { fontFamily: D.body } }}
                  InputProps={{ sx: { fontFamily: D.body } }}
                />
              </Box>
              <TextField label="Purpose / notes" value={editForm.purpose}
                onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value }))}
                fullWidth multiline rows={2}
                InputProps={{ sx: { fontFamily: D.body } }}
                InputLabelProps={{ sx: { fontFamily: D.body } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
            <Button
              startIcon={<DeleteForeverIcon />}
              onClick={() => { setEditOpen(false); openDeletePreview(); }}
              fullWidth={isMobile} size="large"
              sx={{ mr: { sm: 'auto' }, fontFamily: D.body, fontWeight: 700,
                color: '#dc2626', '&:hover': { backgroundColor: alpha('#dc2626', 0.06) } }}
            >
              Delete trip
            </Button>
            <Button onClick={() => setEditOpen(false)} fullWidth={isMobile} size="large"
              sx={{ fontFamily: D.body, fontWeight: 600 }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={saveEdit} disabled={!editForm.name}
              fullWidth={isMobile} size="large"
              sx={{
                fontFamily: D.display, letterSpacing: '-0.01em',
                backgroundColor: D.navy, boxShadow: 'none',
                '&:hover': { backgroundColor: alpha(D.navy, 0.88), boxShadow: 'none' },
              }}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete preview dialog ── */}
        <Dialog
          open={deletePreviewOpen}
          onClose={() => !deleting && setDeletePreviewOpen(false)}
          maxWidth="sm" fullWidth fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: { sm: 2.5 }, backgroundColor: D.paper } }}
        >
          <DialogTitle sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            fontFamily: D.display, fontSize: { xs: '1.3rem', sm: '1.5rem' },
            letterSpacing: '-0.02em', color: '#dc2626',
          }}>
            <WarningAmberIcon />
            Delete "{trip?.name}"?
          </DialogTitle>
          <DialogContent>
            {!deletePreview && !deleteError && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} sx={{ color: D.terra }} />
              </Box>
            )}
            {deleteError && (
              <Typography sx={{ fontFamily: D.body, color: '#dc2626' }} variant="body2">{deleteError}</Typography>
            )}
            {deletePreview && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography sx={{ fontFamily: D.body }} variant="body2" color="text.secondary">
                  This will permanently delete the following. This cannot be undone.
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: alpha(D.navy, 0.12) }}>
                  <List dense disablePadding>
                    {deletePreview.audit.itinerary.days > 0 && (
                      <>
                        <ListItem>
                          <ListItemText
                            primary={`Itinerary — ${deletePreview.audit.itinerary.days} day${deletePreview.audit.itinerary.days !== 1 ? 's' : ''}, ${deletePreview.audit.itinerary.stops} stop${deletePreview.audit.itinerary.stops !== 1 ? 's' : ''}`}
                            primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }}
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
                            primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }}
                            secondaryTypographyProps={{ sx: { fontFamily: D.body } }}
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
                            primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }}
                            secondaryTypographyProps={{ sx: { fontFamily: D.body } }}
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
                            primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 700, color: '#dc2626' } }}
                            secondaryTypographyProps={{ sx: { fontFamily: D.body } }}
                          />
                        </ListItem>
                        <Divider />
                      </>
                    )}
                    {deletePreview.audit.pushLogs.total > 0 && (
                      <ListItem>
                        <ListItemText
                          primary={`${deletePreview.audit.pushLogs.total} push notification log${deletePreview.audit.pushLogs.total !== 1 ? 's' : ''}`}
                          primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }}
                        />
                      </ListItem>
                    )}
                    {deletePreview.audit.packing.exists && (
                      <>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Packing list" primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }} />
                        </ListItem>
                      </>
                    )}
                    {deletePreview.audit.intelligence.exists && (
                      <>
                        <Divider />
                        <ListItem>
                          <ListItemText primary="Cultural intelligence data" primaryTypographyProps={{ sx: { fontFamily: D.body, fontWeight: 600 } }} />
                        </ListItem>
                      </>
                    )}
                  </List>
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
            <Button onClick={() => setDeletePreviewOpen(false)} fullWidth={isMobile} size="large"
              sx={{ fontFamily: D.body, fontWeight: 600 }}>
              Cancel
            </Button>
            {deletePreview && (
              <Button
                variant="contained"
                onClick={() => { setDeletePreviewOpen(false); setDeleteConfirmOpen(true); }}
                fullWidth={isMobile} size="large"
                startIcon={<DeleteForeverIcon />}
                sx={{
                  fontFamily: D.display, letterSpacing: '-0.01em',
                  backgroundColor: '#dc2626', boxShadow: 'none',
                  '&:hover': { backgroundColor: '#b91c1c', boxShadow: 'none' },
                }}
              >
                Continue to delete
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* ── Delete confirm dialog ── */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => !deleting && setDeleteConfirmOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 2.5, backgroundColor: D.paper } }}
        >
          <DialogTitle sx={{
            fontFamily: D.display, fontSize: '1.4rem',
            letterSpacing: '-0.02em', color: '#dc2626',
          }}>
            Are you absolutely sure?
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontFamily: D.body }} variant="body2" color="text.secondary">
              <strong>"{trip?.name}"</strong> and all its data will be permanently deleted. There is no undo.
            </Typography>
            {deleteError && (
              <Typography sx={{ fontFamily: D.body, mt: 1 }} color="error" variant="body2">{deleteError}</Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} size="large"
              sx={{ fontFamily: D.body, fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              variant="contained" onClick={handleDeleteTrip} disabled={deleting} size="large"
              startIcon={deleting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <DeleteForeverIcon />}
              sx={{
                fontFamily: D.display, letterSpacing: '-0.01em',
                backgroundColor: '#dc2626', boxShadow: 'none',
                '&:hover': { backgroundColor: '#b91c1c', boxShadow: 'none' },
              }}
            >
              {deleting ? 'Deleting…' : 'Permanently delete'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </>
  );
}