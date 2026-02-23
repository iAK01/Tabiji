'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton,
  Tabs, Tab, Chip, Button, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, useMediaQuery, useTheme,
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

// Tab config — icon used on mobile, label on desktop
const TAB_CONFIG = [
  { label: 'Overview',     icon: <GridViewIcon fontSize="small" /> },
  { label: 'Logistics',    icon: <FlightIcon fontSize="small" /> },
  { label: 'Itinerary',    icon: <MapIcon fontSize="small" /> },
  { label: 'Packing',      icon: <BackpackIcon fontSize="small" /> },
  { label: 'Intelligence', icon: <LightbulbIcon fontSize="small" /> },
  { label: 'Weather',      icon: <WbSunnyIcon fontSize="small" /> },
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
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: { xs: 4, sm: 0 } }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }} elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 0.5 }}>
            <ArrowBackIcon />
          </IconButton>
          <FlightTakeoffIcon sx={{ mr: 1, flexShrink: 0, fontSize: { xs: 18, sm: 24 } }} />
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              flexGrow: 1,
              fontSize: { xs: '0.95rem', sm: '1.15rem' },
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
            sx={{ mr: 1, fontWeight: 700, fontSize: '0.7rem' }}
          />
          <IconButton color="inherit" onClick={openEdit} size="small">
            <EditIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ── Tabs — scrollable on mobile, full on desktop ── */}
      <Box sx={{ backgroundColor: 'text.primary' }}>
        <Container maxWidth="lg" disableGutters={isMobile}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            textColor="inherit"
            variant={isMobile ? 'scrollable' : 'fullWidth'}
            scrollButtons={false}
            TabIndicatorProps={{ style: { backgroundColor: '#C9521B', height: 3 } }}
            sx={{
              minHeight: { xs: 48, sm: 52 },
              '& .MuiTab-root': {
                minHeight: { xs: 48, sm: 52 },
                minWidth: { xs: 'auto', sm: 'auto' },
                px: { xs: 1.5, sm: 2 },
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                color: 'rgba(255,255,255,0.6)',
                '&.Mui-selected': { color: 'white' },
              },
            }}
          >
            {TAB_CONFIG.map(({ label, icon }) => (
              <Tab
                key={label}
                label={isMobile ? undefined : label}
                icon={isMobile ? icon : undefined}
                iconPosition="start"
                aria-label={label}
              />
            ))}
          </Tabs>
        </Container>
      </Box>

      {/* ── Cover photo ── */}
      {trip.coverPhotoUrl && (
        <Box sx={{
          height: { xs: 160, sm: 220 },
          backgroundImage: `url(${trip.coverPhotoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.55))',
          }} />
          {/* Trip headline overlay — only on mobile to save space */}
          {isMobile && (
            <Box sx={{ position: 'absolute', bottom: 10, left: 14, right: 50 }}>
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                {trip.destination?.city}, {trip.destination?.country}
              </Typography>
              {daysUntil !== null && daysUntil > 0 && (
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>
                  {daysUntil} days away · {trip.nights} nights
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: { xs: 'none', sm: 'block' } }}>
              📷 {trip.coverPhotoCredit}
            </Typography>
            <IconButton
              onClick={refreshPhoto}
              sx={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.3)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' }, p: 0.75 }}
              size="small"
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* ── Tab content ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 }, px: { xs: 2, sm: 3 } }}>

        {/* Overview */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Trip summary card */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, backgroundColor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Trip Details</Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                gap: { xs: 2, sm: 2 },
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>FROM</Typography>
                  <Typography variant="body2" fontWeight={600}>{trip.origin?.city}</Typography>
                  <Typography variant="caption" color="text.secondary">{trip.origin?.country}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>TO</Typography>
                  <Typography variant="body2" fontWeight={600} color="secondary.main">{trip.destination?.city}</Typography>
                  <Typography variant="caption" color="text.secondary">{trip.destination?.country}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>DEPARTS</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(trip.startDate).toLocaleDateString('en-IE', { year: 'numeric' })}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>DURATION</Typography>
                  <Typography variant="body2" fontWeight={600}>{trip.nights} nights</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{trip.tripType}</Typography>
                </Box>
              </Box>
              {trip.purpose && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>PURPOSE</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>{trip.purpose}</Typography>
                </Box>
              )}
            </Paper>

            {/* Quick actions — 2 column grid on mobile */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, backgroundColor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Quick Actions</Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr' },
                gap: 1.5,
              }}>
                {[
                  { label: 'Flights & Hotels', tab: 1, icon: '✈️' },
                  { label: 'Itinerary',         tab: 2, icon: '🗺️' },
                  { label: 'Packing List',      tab: 3, icon: '🎒' },
                  { label: 'Intelligence',      tab: 4, icon: '💡' },
                  { label: 'Weather',           tab: 5, icon: '🌤️' },
                ].map(({ label, tab, icon }) => (
                  <Button
                    key={tab}
                    variant="outlined"
                    fullWidth
                    onClick={() => setActiveTab(tab)}
                    sx={{
                      justifyContent: 'flex-start',
                      py: { xs: 1.25, sm: 1 },
                      fontWeight: 600,
                      fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    }}
                  >
                    {icon}&nbsp;&nbsp;{label}
                  </Button>
                ))}
              </Box>
            </Paper>
          </Box>
        )}

        {activeTab === 1 && <LogisticsTab tripId={trip._id} />}
        {activeTab === 2 && <ItineraryTab tripId={trip._id} startDate={trip.startDate} endDate={trip.endDate} />}
        {activeTab === 3 && <PackingTab tripId={trip._id} tripType={trip.tripType} nights={trip.nights} />}
        {activeTab === 4 && <IntelligenceTab tripId={trip._id} />}
        {activeTab === 5 && <WeatherTab tripId={trip._id} destinationCity={trip.destination?.city} />}

      </Container>

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle fontWeight={700}>Edit Trip</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField label="Trip name" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={editForm.status} label="Status" onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                {['idea', 'planning', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Trip type</InputLabel>
              <Select value={editForm.tripType} label="Trip type" onChange={e => setEditForm(p => ({ ...p, tripType: e.target.value }))}>
                <MenuItem value="leisure">🏖️ Leisure</MenuItem>
                <MenuItem value="work">💼 Work</MenuItem>
                <MenuItem value="mixed">✈️ Mixed</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField label="Departure date" type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label="Return date" type="date" value={editForm.endDate} onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField label="Purpose / notes" value={editForm.purpose} onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value }))} fullWidth multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} fullWidth={isMobile}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.name} fullWidth={isMobile}>Save Changes</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}