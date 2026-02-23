'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Tabs, Tab, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, Divider, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlightIcon from '@mui/icons-material/Flight';
import HotelIcon from '@mui/icons-material/Hotel';
import DeleteIcon from '@mui/icons-material/Delete';
import AirportSearch from '@/components/ui/AirportSearch';
import AirlineSearch from '@/components/ui/AirlineSearch';



interface LogisticsTabProps {
  tripId: string;
}

const transportStatuses = ['not_booked', 'pending', 'booked', 'confirmed', 'cancelled'];
const accommodationTypes = ['hotel', 'airbnb', 'hostel', 'friends_family', 'camping', 'other'];

const statusColour: Record<string, 'default' | 'warning' | 'success' | 'error' | 'primary'> = {
  not_booked: 'default',
  pending: 'warning',
  booked: 'primary',
  confirmed: 'success',
  cancelled: 'error',
};

export default function LogisticsTab({ tripId }: LogisticsTabProps) {
  const [section, setSection] = useState(0);
  const [logistics, setLogistics] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Transport form state
  const [showTransportForm, setShowTransportForm] = useState(false);
const [transport, setTransport] = useState({
  type: 'flight', status: 'not_booked', airline: '', airlineIata: '', flightNumber: '',
  departureAirport: '', departureAirportDisplay: '', arrivalAirport: '', arrivalAirportDisplay: '',
  departureTime: '', arrivalTime: '', seat: '', confirmationNumber: '', cost: '', notes: '',
});

  // Accommodation form state
  const [showAccomForm, setShowAccomForm] = useState(false);
  const [accom, setAccom] = useState({
    type: 'hotel', status: 'not_booked', name: '', address: '',
    checkIn: '', checkOut: '', confirmationNumber: '', cost: '', notes: ''
  });

  useEffect(() => {
    fetch(`/api/trips/${tripId}/logistics`)
      .then(res => res.json())
      .then(data => setLogistics(data.logistics));
  }, [tripId]);

  const saveTransport = async () => {
    setSaving(true);
    const res = await fetch(`/api/trips/${tripId}/logistics/transport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transport),
    });
    const data = await res.json();
    setLogistics(data.logistics);
    setShowTransportForm(false);
setTransport({ type: 'flight', status: 'not_booked', airline: '', airlineIata: '', flightNumber: '', departureAirport: '', departureAirportDisplay: '', arrivalAirport: '', arrivalAirportDisplay: '', departureTime: '', arrivalTime: '', seat: '', confirmationNumber: '', cost: '', notes: '' });  };

  const saveAccom = async () => {
    setSaving(true);
    const res = await fetch(`/api/trips/${tripId}/logistics/accommodation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accom),
    });
    const data = await res.json();
    setLogistics(data.logistics);
    setShowAccomForm(false);
    setAccom({ type: 'hotel', status: 'not_booked', name: '', address: '', checkIn: '', checkOut: '', confirmationNumber: '', cost: '', notes: '' });
    setSaving(false);
  };

  const deleteTransport = async (index: number) => {
    const res = await fetch(`/api/trips/${tripId}/logistics/transport/${index}`, { method: 'DELETE' });
    const data = await res.json();
    setLogistics(data.logistics);
  };

  const deleteAccom = async (index: number) => {
    const res = await fetch(`/api/trips/${tripId}/logistics/accommodation/${index}`, { method: 'DELETE' });
    const data = await res.json();
    setLogistics(data.logistics);
  };

  return (
    <Box>
      <Tabs value={section} onChange={(_, v) => setSection(v)} sx={{ mb: 3 }}>
        <Tab label="✈️ Transport" />
        <Tab label="🏨 Accommodation" />
        <Tab label="📄 Documents" />
      </Tabs>

      {/* TRANSPORT */}
      {section === 0 && (
        <Box>
          {/* Existing transport items */}
          {logistics?.transportation?.map((t: any, i: number) => (
            <Paper key={i} sx={{ p: 2.5, mb: 2, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FlightIcon color="primary" />
                  <Box>
                    <Typography fontWeight={600}>
                      {t.airline} {t.flightNumber} — {t.departureAirport} → {t.arrivalAirport}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t.departureTime ? new Date(t.departureTime).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </Typography>
                    {t.seat && <Typography variant="body2" color="text.secondary">Seat: {t.seat}</Typography>}
                    {t.confirmationNumber && <Typography variant="body2" color="text.secondary">Ref: {t.confirmationNumber}</Typography>}
                    {t.cost && <Typography variant="body2" color="text.secondary">€{t.cost}</Typography>}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={t.status} color={statusColour[t.status]} size="small" />
                  <IconButton size="small" onClick={() => deleteTransport(i)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              </Box>
            </Paper>
          ))}

          {/* Add transport form */}
          {showTransportForm && (
            <Paper sx={{ p: 3, mb: 2, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Add Flight</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
             <Box sx={{ display: 'flex', gap: 2 }}>
  <Box sx={{ flex: 1 }}>
    <AirlineSearch
      label="Airline"
      value={transport.airline}
      onChange={a => setTransport(p => ({ ...p, airline: a.name, airlineIata: a.iata }))}
    />
  </Box>
  <Box sx={{ flex: 1 }}>
    <TextField label="Flight number" value={transport.flightNumber} onChange={e => setTransport(p => ({ ...p, flightNumber: e.target.value }))} fullWidth />
  </Box>
</Box>
<AirportSearch
  label="From (airport)"
  value={transport.departureAirportDisplay || transport.departureAirport}
  onChange={a => setTransport(p => ({ 
    ...p, 
    departureAirport: a.iata,
    departureAirportDisplay: `${a.iata} — ${a.city}`
  }))}
/>
<AirportSearch
  label="To (airport)"
  value={transport.arrivalAirportDisplay || transport.arrivalAirport}
  onChange={a => setTransport(p => ({ 
    ...p, 
    arrivalAirport: a.iata,
    arrivalAirportDisplay: `${a.iata} — ${a.city}`
  }))}
/>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Departure" type="datetime-local" value={transport.departureTime} onChange={e => setTransport(p => ({ ...p, departureTime: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
                  <TextField label="Arrival" type="datetime-local" value={transport.arrivalTime} onChange={e => setTransport(p => ({ ...p, arrivalTime: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Seat" value={transport.seat} onChange={e => setTransport(p => ({ ...p, seat: e.target.value }))} fullWidth />
                  <TextField label="Confirmation ref" value={transport.confirmationNumber} onChange={e => setTransport(p => ({ ...p, confirmationNumber: e.target.value }))} fullWidth />
                  <TextField label="Cost (€)" type="number" value={transport.cost} onChange={e => setTransport(p => ({ ...p, cost: e.target.value }))} fullWidth />
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={transport.status} label="Status" onChange={e => setTransport(p => ({ ...p, status: e.target.value }))}>
                    {transportStatuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Notes" value={transport.notes} onChange={e => setTransport(p => ({ ...p, notes: e.target.value }))} fullWidth multiline rows={2} />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => setShowTransportForm(false)}>Cancel</Button>
                  <Button variant="contained" onClick={saveTransport} disabled={saving}>Save</Button>
                </Box>
              </Box>
            </Paper>
          )}

          {!showTransportForm && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setShowTransportForm(true)}>
              Add flight
            </Button>
          )}
        </Box>
      )}

      {/* ACCOMMODATION */}
      {section === 1 && (
        <Box>
          {logistics?.accommodation?.map((a: any, i: number) => (
            <Paper key={i} sx={{ p: 2.5, mb: 2, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HotelIcon color="primary" />
                  <Box>
                    <Typography fontWeight={600}>{a.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{a.address}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {a.checkIn ? new Date(a.checkIn).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : ''} → {a.checkOut ? new Date(a.checkOut).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : ''}
                    </Typography>
                    {a.confirmationNumber && <Typography variant="body2" color="text.secondary">Ref: {a.confirmationNumber}</Typography>}
                    {a.cost && <Typography variant="body2" color="text.secondary">€{a.cost}</Typography>}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={a.status} color={statusColour[a.status]} size="small" />
                  <IconButton size="small" onClick={() => deleteAccom(i)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              </Box>
            </Paper>
          ))}

          {showAccomForm && (
            <Paper sx={{ p: 3, mb: 2, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Add Accommodation</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select value={accom.type} label="Type" onChange={e => setAccom(p => ({ ...p, type: e.target.value }))}>
                      {accommodationTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={accom.status} label="Status" onChange={e => setAccom(p => ({ ...p, status: e.target.value }))}>
                      {transportStatuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
                <TextField label="Name" value={accom.name} onChange={e => setAccom(p => ({ ...p, name: e.target.value }))} fullWidth />
                <TextField label="Address" value={accom.address} onChange={e => setAccom(p => ({ ...p, address: e.target.value }))} fullWidth />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Check in" type="date" value={accom.checkIn} onChange={e => setAccom(p => ({ ...p, checkIn: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
                  <TextField label="Check out" type="date" value={accom.checkOut} onChange={e => setAccom(p => ({ ...p, checkOut: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="Confirmation ref" value={accom.confirmationNumber} onChange={e => setAccom(p => ({ ...p, confirmationNumber: e.target.value }))} fullWidth />
                  <TextField label="Cost (€)" type="number" value={accom.cost} onChange={e => setAccom(p => ({ ...p, cost: e.target.value }))} fullWidth />
                </Box>
                <TextField label="Notes" value={accom.notes} onChange={e => setAccom(p => ({ ...p, notes: e.target.value }))} fullWidth multiline rows={2} />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => setShowAccomForm(false)}>Cancel</Button>
                  <Button variant="contained" onClick={saveAccom} disabled={saving}>Save</Button>
                </Box>
              </Box>
            </Paper>
          )}

          {!showAccomForm && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setShowAccomForm(true)}>
              Add accommodation
            </Button>
          )}
        </Box>
      )}

      {/* DOCUMENTS */}
      {section === 2 && (
        <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Documents</Typography>
          <Typography variant="body2" color="text.secondary">Passport, visa, insurance tracking coming next.</Typography>
        </Paper>
      )}
    </Box>
  );
}