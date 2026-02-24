'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton,
  Tabs, Tab, Chip, Button, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import FlightIcon from '@mui/icons-material/Flight';
import MapIcon from '@mui/icons-material/Map';
import BackpackIcon from '@mui/icons-material/Backpack';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import GridViewIcon from '@mui/icons-material/GridView';
import LogisticsTab from '@/components/logistics/LogisticsTab';
import ItineraryTab from '@/components/itinerary/ItineraryTab';
import PackingTab from '@/components/packing/PackingTab';
import IntelligenceTab from '@/components/intelligence/IntelligenceTab';
import WeatherTab from '@/components/weather/WeatherTab';
import TripOverview from '@/components/overview/TripOverview';
import dynamic from 'next/dynamic';

const MapTab = dynamic(() => import('@/components/map/MapTab'), { ssr: false });


interface Trip {
  _id: string;
  name: string;
  tripType: string;
  status: string;
  purpose: string;
  origin: { city: string; country: string };
  destination: { city: string; country: string };
  startDate: string;
  endDate: string;
  nights: number;
  coverPhotoUrl?: string;
  coverPhotoThumb?: string;
  coverPhotoCredit?: string;
}

const STATUS_COLOURS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default', planning: 'warning', confirmed: 'primary',
  active: 'success', completed: 'default', cancelled: 'error',
};

const TAB_CONFIG = [
  { label: 'Overview',     Icon: GridViewIcon },
  { label: 'Logistics',    Icon: FlightIcon },
  { label: 'Itinerary',    Icon: MapIcon },
  { label: 'Packing',      Icon: BackpackIcon },
  { label: 'Context', Icon: LightbulbIcon },
  { label: 'Weather',      Icon: WbSunnyIcon },
  { label: 'Map',          Icon: MapIcon },
];

const QUICK_ACTIONS = [
  { label: 'Flights & Hotels', tab: 1, Icon: FlightIcon },
  { label: 'Itinerary',        tab: 2, Icon: MapIcon },
  { label: 'Packing List',     tab: 3, Icon: BackpackIcon },
  { label: 'Context',     tab: 4, Icon: LightbulbIcon },
  { label: 'Weather',          tab: 5, Icon: WbSunnyIcon },
  { label: 'Map',              tab: 6, Icon: MapIcon },
];

export default function TripPage() {
  const { id } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', tripType: '', purpose: '', startDate: '', endDate: '', status: '',
  });

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(r => r.json())
      .then(data => {
        setTrip(data.trip);
        if (!data.trip?.coverPhotoUrl && data.trip?.destination?.city) {
          fetch(`/api/trips/${data.trip._id}/cover-photo`, { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (d.trip) setTrip(d.trip); });
        }
      });
  }, [id]);

  const openEdit = () => {
    if (!trip) return;
    setEditForm({
      name: trip.name, tripType: trip.tripType, purpose: trip.purpose || '',
      startDate: trip.startDate?.split('T')[0] ?? '',
      endDate: trip.endDate?.split('T')[0] ?? '',
      status: trip.status,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!trip) return;
    const nights = editForm.startDate && editForm.endDate
      ? Math.round((new Date(editForm.endDate).getTime() - new Date(editForm.startDate).getTime()) / 86400000)
      : trip.nights;
    const res = await fetch(`/api/trips/${trip._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, nights }),
    });
    const data = await res.json();
    setTrip(data.trip);
    setEditOpen(false);
  };

  const refreshPhoto = async () => {
    if (!trip) return;
    const res = await fetch(`/api/trips/${trip._id}/cover-photo`, { method: 'POST' });
    const data = await res.json();
    if (data.trip) setTrip(data.trip);
  };

  if (!trip) return null;

  const daysUntil = trip.startDate
    ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: { xs: 6, sm: 0 } }}>

      {/* ── AppBar ── */}
  <AppBar position="static" sx={{ backgroundColor: 'text.primary' }} elevation={0}>
  <Toolbar sx={{ minHeight: { xs: 60, sm: 64 }, gap: 1 }}>

    <IconButton color="inherit" onClick={() => router.push('/dashboard')}>
      <ArrowBackIcon />
    </IconButton>

    <Box
      component="img"
      src="/logo.jpeg"
      alt="Logo"
      sx={{
        flexShrink: 0,
        width: { xs: 48, sm: 112 },
        height: { xs: 48, sm: 112 },
        objectFit: 'contain'
      }}
    />

    <Typography
      variant="h4"
      fontWeight={700}
      sx={{
        flexGrow: 1,
        fontSize: { xs: '1.2rem', sm: '2rem' },
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {trip.name}
    </Typography>

          <Chip
            label={trip.status}
            color={STATUS_COLOURS[trip.status]}
            size="small"
            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
          />
          <IconButton color="inherit" onClick={openEdit}>
            <EditIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ── Tabs ── icon on top + label, full width, tall on mobile ── */}
      <Box sx={{ backgroundColor: 'text.primary', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Container maxWidth="lg" disableGutters>
<Tabs
  value={activeTab}
  onChange={(_, val) => setActiveTab(val)}
  textColor="inherit"
  variant={isMobile ? "scrollable" : "fullWidth"}
  scrollButtons={false}
  TabIndicatorProps={{ style: { backgroundColor: '#C9521B', height: 3 } }}
  sx={{
    '& .MuiTab-root': {
      minHeight: 64,                  // keeps touch target safe
      minWidth: { xs: 80, sm: 120 },  // prevents crushing
      flexDirection: 'column',
      gap: 0.5,
      fontSize: { xs: '0.7rem', sm: '0.75rem' },
      fontWeight: 600,
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.6)',
      '&.Mui-selected': { color: 'white' },
      '& svg': {
        fontSize: { xs: '1.1rem', sm: '1.2rem' },
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
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.62))',
          }} />
          <Box sx={{ position: 'absolute', bottom: 14, left: 16, right: 56 }}>
            <Typography sx={{
              color: 'white', fontWeight: 900, lineHeight: 1.2,
              fontSize: { xs: '1.2rem', sm: '1.4rem' },
            }}>
              {trip.destination?.city}, {trip.destination?.country}
            </Typography>
            {daysUntil !== null && daysUntil > 0 && (
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: { xs: '0.9rem', sm: '0.95rem' }, mt: 0.3 }}>
                {daysUntil} days away · {trip.nights} nights
              </Typography>
            )}
            {daysUntil === 0 && (
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', mt: 0.3 }}>
                Today
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={refreshPhoto}
            sx={{
              position: 'absolute', bottom: 10, right: 12,
              color: 'white', backgroundColor: 'rgba(0,0,0,0.35)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.55)' }, p: 1,
            }}
            size="small"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* ── Content ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}>

        {activeTab === 0 && (
          <TripOverview trip={trip} onNavigate={setActiveTab} />
        )}

        {activeTab === 1 && <LogisticsTab tripId={trip._id} />}
        {activeTab === 2 && <ItineraryTab tripId={trip._id} startDate={trip.startDate} endDate={trip.endDate} />}
        {activeTab === 3 && <PackingTab tripId={trip._id} tripType={trip.tripType} nights={trip.nights} />}
        {activeTab === 4 && <IntelligenceTab tripId={trip._id} />}
        {activeTab === 5 && <WeatherTab tripId={trip._id} destinationCity={trip.destination?.city} />}
        {activeTab === 6 && <MapTab tripId={trip._id} trip={trip} />}

      </Container>

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle fontWeight={700} sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }}>
          Edit Trip
        </DialogTitle>
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
              <TextField label="Return date" type="date" value={editForm.endDate} onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField label="Purpose / notes" value={editForm.purpose} onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value }))} fullWidth multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setEditOpen(false)} fullWidth={isMobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.name} fullWidth={isMobile} size="large">Save Changes</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}