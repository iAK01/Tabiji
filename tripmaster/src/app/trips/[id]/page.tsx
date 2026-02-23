'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton,
  Tabs, Tab, Chip, Button, Paper, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
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

const statusColours: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default',
  planning: 'warning',
  confirmed: 'primary',
  active: 'success',
  completed: 'default',
  cancelled: 'error',
};

const tabs = ['Overview', 'Logistics', 'Itinerary', 'Packing', 'Intelligence', 'Weather'];

export default function TripPage() {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', tripType: '', purpose: '',
    startDate: '', endDate: '', status: ''
  });

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(res => res.json())
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
      name: trip.name,
      tripType: trip.tripType,
      purpose: trip.purpose || '',
      startDate: trip.startDate ? trip.startDate.split('T')[0] : '',
      endDate: trip.endDate ? trip.endDate.split('T')[0] : '',
      status: trip.status,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!trip) return;
    const nights = editForm.startDate && editForm.endDate
      ? Math.round((new Date(editForm.endDate).getTime() - new Date(editForm.startDate).getTime()) / (1000 * 60 * 60 * 24))
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

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>

      {/* Nav */}
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <FlightTakeoffIcon sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {trip.name}
          </Typography>
          <Chip
            label={trip.status}
            color={statusColours[trip.status]}
            size="small"
            sx={{ mr: 1 }}
          />
          <IconButton color="inherit" onClick={openEdit}>
            <EditIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Tabs */}
      <Box sx={{ backgroundColor: 'text.primary' }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: '#C4714A' } }}
          >
            {tabs.map(tab => (
              <Tab
                key={tab}
                label={tab}
                sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-selected': { color: 'white' } }}
              />
            ))}
          </Tabs>
        </Container>
      </Box>

      {/* Cover Photo */}
      {trip.coverPhotoUrl && (
        <Box sx={{
          height: 220,
          backgroundImage: `url(${trip.coverPhotoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.5))',
          }} />
          <Box sx={{ position: 'absolute', bottom: 8, right: 12 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              📷 {trip.coverPhotoCredit}
            </Typography>
          </Box>
          <IconButton
            onClick={refreshPhoto}
            sx={{
              position: 'absolute', bottom: 8, left: 12,
              color: 'white', backgroundColor: 'rgba(0,0,0,0.3)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' }
            }}
            size="small"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Trip Details</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">FROM</Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {trip.origin?.city}, {trip.origin?.country}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">TO</Typography>
                    <Typography variant="body1" fontWeight={500} color="secondary.main">
                      {trip.destination?.city}, {trip.destination?.country}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">DATES</Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })} →{' '}
                      {new Date(trip.endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{trip.nights} nights</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">TYPE</Typography>
                    <Typography variant="body1" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                      {trip.tripType}
                    </Typography>
                  </Box>
                  {trip.purpose && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">PURPOSE</Typography>
                      <Typography variant="body1">{trip.purpose}</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Quick Actions</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button variant="outlined" fullWidth onClick={() => setActiveTab(1)}>
                    Add flights & accommodation
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setActiveTab(2)}>
                    Build itinerary
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setActiveTab(3)}>
                    Generate packing list
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setActiveTab(4)}>
                    View travel intelligence
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setActiveTab(5)}>
  View weather forecast
</Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && <LogisticsTab tripId={trip._id} />}

        {activeTab === 2 && (
          <ItineraryTab
            tripId={trip._id}
            startDate={trip.startDate}
            endDate={trip.endDate}
          />
        )}

      {activeTab === 3 && (
  <PackingTab
    tripId={trip._id}
    tripType={trip.tripType}
    nights={trip.nights}
  />
)}

      {activeTab === 4 && <IntelligenceTab tripId={trip._id} />}
      {activeTab === 5 && (
  <WeatherTab tripId={trip._id} destinationCity={trip.destination?.city} />
)}
      </Container>

      {/* Edit Trip Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Edit Trip</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Trip name"
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.status}
                label="Status"
                onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
              >
                {['idea', 'planning', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Trip type</InputLabel>
              <Select
                value={editForm.tripType}
                label="Trip type"
                onChange={e => setEditForm(p => ({ ...p, tripType: e.target.value }))}
              >
                <MenuItem value="leisure">🏖️ Leisure</MenuItem>
                <MenuItem value="work">💼 Work</MenuItem>
                <MenuItem value="mixed">✈️ Mixed</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Departure date"
                type="date"
                value={editForm.startDate}
                onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Return date"
                type="date"
                value={editForm.endDate}
                onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Purpose / notes"
              value={editForm.purpose}
              onChange={e => setEditForm(p => ({ ...p, purpose: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.name}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}