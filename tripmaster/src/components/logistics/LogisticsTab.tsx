'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Tabs, Tab, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, useMediaQuery, useTheme, Divider, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlightIcon from '@mui/icons-material/Flight';
import HotelIcon from '@mui/icons-material/Hotel';
import DescriptionIcon from '@mui/icons-material/Description';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import AirportSearch from '@/components/ui/AirportSearch';
import AirlineSearch from '@/components/ui/AirlineSearch';

interface LogisticsTabProps { tripId: string; }

const TRANSPORT_STATUSES = ['not_booked', 'pending', 'booked', 'confirmed', 'cancelled'];
const ACCOM_TYPES        = ['hotel', 'airbnb', 'hostel', 'friends_family', 'camping', 'other'];

const STATUS_COLOUR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'primary'> = {
  not_booked: 'default', pending: 'warning', booked: 'primary',
  confirmed: 'success', cancelled: 'error',
};

const BLANK_TRANSPORT = {
  type: 'flight', status: 'not_booked', airline: '', airlineIata: '', flightNumber: '',
  departureAirport: '', departureAirportDisplay: '', arrivalAirport: '', arrivalAirportDisplay: '',
  departureTime: '', arrivalTime: '', seat: '', confirmationNumber: '', cost: '', notes: '',
};

const BLANK_ACCOM = {
  type: 'hotel', status: 'not_booked', name: '', address: '',
  checkIn: '', checkOut: '', confirmationNumber: '', cost: '', notes: '',
};

export default function LogisticsTab({ tripId }: LogisticsTabProps) {
  const theme   = useTheme();
  const mobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const [section,        setSection]        = useState(0);
  const [logistics,      setLogistics]      = useState<any>(null);
  const [saving,         setSaving]         = useState(false);

  // Transport dialog
  const [transportOpen,  setTransportOpen]  = useState(false);
  const [transport,      setTransport]      = useState({ ...BLANK_TRANSPORT });

  // Accom dialog
  const [accomOpen,      setAccomOpen]      = useState(false);
  const [accom,          setAccom]          = useState({ ...BLANK_ACCOM });

  // Delete confirm
  const [deleteTarget,   setDeleteTarget]   = useState<{ kind: 'transport' | 'accom'; index: number } | null>(null);

  // Card context menus
  const [menuAnchor,     setMenuAnchor]     = useState<null | HTMLElement>(null);
  const [menuTarget,     setMenuTarget]     = useState<{ kind: 'transport' | 'accom'; index: number } | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/logistics`)
      .then(r => r.json())
      .then(d => setLogistics(d.logistics));
  }, [tripId]);

  // ── Saves ──────────────────────────────────────────────────────────────────
  const saveTransport = async () => {
    setSaving(true);
    const res  = await fetch(`/api/trips/${tripId}/logistics/transport`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transport),
    });
    const data = await res.json();
    setLogistics(data.logistics);
    setTransportOpen(false);
    setTransport({ ...BLANK_TRANSPORT });
    setSaving(false);
  };

  const saveAccom = async () => {
    setSaving(true);
    const res  = await fetch(`/api/trips/${tripId}/logistics/accommodation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accom),
    });
    const data = await res.json();
    setLogistics(data.logistics);
    setAccomOpen(false);
    setAccom({ ...BLANK_ACCOM });
    setSaving(false);
  };

  // ── Deletes ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, index } = deleteTarget;
    const url = kind === 'transport'
      ? `/api/trips/${tripId}/logistics/transport/${index}`
      : `/api/trips/${tripId}/logistics/accommodation/${index}`;
    const res  = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    setLogistics(data.logistics);
    setDeleteTarget(null);
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, kind: 'transport' | 'accom', index: number) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuTarget({ kind, index });
  };

  const closeMenu = () => { setMenuAnchor(null); setMenuTarget(null); };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtDateTime = (dt: string) =>
    dt ? new Date(dt).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IE', { dateStyle: 'medium' }) : '';

  // ── Transport card ─────────────────────────────────────────────────────────
  const TransportCard = ({ t, i }: { t: any; i: number }) => (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <FlightIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {/* Route headline */}
          <Typography fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1rem' } }}>
            {t.flightNumber} &nbsp;·&nbsp; {t.departureAirport} → {t.arrivalAirport}
          </Typography>
          {t.airline && (
            <Typography variant="body2" color="text.secondary">{t.airline}</Typography>
          )}
          {t.departureTime && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtDateTime(t.departureTime)}
              {t.arrivalTime ? ` → ${fmtDateTime(t.arrivalTime)}` : ''}
            </Typography>
          )}
          {/* Details row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
            {t.seat && (
              <Typography variant="caption" color="text.secondary">Seat {t.seat}</Typography>
            )}
            {t.confirmationNumber && (
              <Typography variant="caption" color="text.secondary">Ref: {t.confirmationNumber}</Typography>
            )}
            {t.cost && (
              <Typography variant="caption" color="text.secondary">€{t.cost}</Typography>
            )}
          </Box>
        </Box>
        {/* Status + menu */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={t.status.replace('_', ' ')}
            color={STATUS_COLOUR[t.status]}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }}
          />
          <IconButton size="small" onClick={e => openMenu(e, 'transport', i)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );

  // ── Accommodation card ────────────────────────────────────────────────────
  const AccomCard = ({ a, i }: { a: any; i: number }) => (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <HotelIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1rem' } }}>{a.name}</Typography>
          {a.address && (
            <Typography variant="body2" color="text.secondary">{a.address}</Typography>
          )}
          {(a.checkIn || a.checkOut) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtDate(a.checkIn)} → {fmtDate(a.checkOut)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
            {a.confirmationNumber && (
              <Typography variant="caption" color="text.secondary">Ref: {a.confirmationNumber}</Typography>
            )}
            {a.cost && (
              <Typography variant="caption" color="text.secondary">€{a.cost}</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={a.status.replace('_', ' ')}
            color={STATUS_COLOUR[a.status]}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'capitalize' }}
          />
          <IconButton size="small" onClick={e => openMenu(e, 'accom', i)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Section tabs ── */}
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            minHeight: { xs: 60, sm: 52 },
            flexDirection: 'column',
            gap: 0.5,
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            fontWeight: 600,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tab label="Transport"     icon={<FlightIcon />}      iconPosition="top" />
        <Tab label="Accommodation" icon={<HotelIcon />}       iconPosition="top" />
        <Tab label="Documents"     icon={<DescriptionIcon />} iconPosition="top" />
      </Tabs>

      {/* ── Transport ── */}
      {section === 0 && (
        <Box>
          {(logistics?.transportation ?? []).map((t: any, i: number) => (
            <TransportCard key={i} t={t} i={i} />
          ))}
          {(!logistics?.transportation || logistics.transportation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No flights added yet.</Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setTransportOpen(true)}
            fullWidth={mobile}
            size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1 }}
          >
            Add flight
          </Button>
        </Box>
      )}

      {/* ── Accommodation ── */}
      {section === 1 && (
        <Box>
          {(logistics?.accommodation ?? []).map((a: any, i: number) => (
            <AccomCard key={i} a={a} i={i} />
          ))}
          {(!logistics?.accommodation || logistics.accommodation.length === 0) && (
            <Alert severity="info" sx={{ mb: 2 }}>No accommodation added yet.</Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAccomOpen(true)}
            fullWidth={mobile}
            size={mobile ? 'large' : 'medium'}
            sx={{ py: mobile ? 1.5 : 1 }}
          >
            Add accommodation
          </Button>
        </Box>
      )}

      {/* ── Documents placeholder ── */}
      {section === 2 && (
        <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Documents</Typography>
          <Typography variant="body2" color="text.secondary">
            Passport, visa, and insurance tracking coming soon.
          </Typography>
        </Paper>
      )}

      {/* ── Context menu (three-dot) ── */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setDeleteTarget(menuTarget);
            closeMenu();
          }}
          sx={{ color: 'error.main', gap: 1 }}
        >
          <DeleteIcon fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle fontWeight={700}>Delete this item?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add flight dialog ── */}
      <Dialog
        open={transportOpen}
        onClose={() => setTransportOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={mobile}
      >
        <DialogTitle fontWeight={700}>Add Flight</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <AirlineSearch
              label="Airline"
              value={transport.airline}
              onChange={a => setTransport(p => ({ ...p, airline: a.name, airlineIata: a.iata }))}
            />
            <TextField
              label="Flight number"
              value={transport.flightNumber}
              onChange={e => setTransport(p => ({ ...p, flightNumber: e.target.value }))}
              fullWidth
              placeholder="FR 328"
            />
            <AirportSearch
              label="From (airport)"
              value={transport.departureAirportDisplay || transport.departureAirport}
              onChange={a => setTransport(p => ({
                ...p, departureAirport: a.iata,
                departureAirportDisplay: `${a.iata} — ${a.city}`,
              }))}
            />
            <AirportSearch
              label="To (airport)"
              value={transport.arrivalAirportDisplay || transport.arrivalAirport}
              onChange={a => setTransport(p => ({
                ...p, arrivalAirport: a.iata,
                arrivalAirportDisplay: `${a.iata} — ${a.city}`,
              }))}
            />
            <TextField
              label="Departure date & time"
              type="datetime-local"
              value={transport.departureTime}
              onChange={e => setTransport(p => ({ ...p, departureTime: e.target.value }))}
              fullWidth InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Arrival date & time"
              type="datetime-local"
              value={transport.arrivalTime}
              onChange={e => setTransport(p => ({ ...p, arrivalTime: e.target.value }))}
              fullWidth InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Seat"
              value={transport.seat}
              onChange={e => setTransport(p => ({ ...p, seat: e.target.value }))}
              fullWidth placeholder="14A"
            />
            <TextField
              label="Confirmation ref"
              value={transport.confirmationNumber}
              onChange={e => setTransport(p => ({ ...p, confirmationNumber: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Cost (€)"
              type="number"
              value={transport.cost}
              onChange={e => setTransport(p => ({ ...p, cost: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={transport.status} label="Status" onChange={e => setTransport(p => ({ ...p, status: e.target.value }))}>
                {TRANSPORT_STATUSES.map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={transport.notes}
              onChange={e => setTransport(p => ({ ...p, notes: e.target.value }))}
              fullWidth multiline rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setTransportOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveTransport} disabled={saving} fullWidth={mobile} size="large">
            Save flight
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add accommodation dialog ── */}
      <Dialog
        open={accomOpen}
        onClose={() => setAccomOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={mobile}
      >
        <DialogTitle fontWeight={700}>Add Accommodation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={accom.type} label="Type" onChange={e => setAccom(p => ({ ...p, type: e.target.value }))}>
                {ACCOM_TYPES.map(t => (
                  <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>
                    {t.replace('_', '/')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Name"
              value={accom.name}
              onChange={e => setAccom(p => ({ ...p, name: e.target.value }))}
              fullWidth placeholder="Hotel Intercontinental"
            />
            <TextField
              label="Address"
              value={accom.address}
              onChange={e => setAccom(p => ({ ...p, address: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Check in"
              type="date"
              value={accom.checkIn}
              onChange={e => setAccom(p => ({ ...p, checkIn: e.target.value }))}
              fullWidth InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Check out"
              type="date"
              value={accom.checkOut}
              onChange={e => setAccom(p => ({ ...p, checkOut: e.target.value }))}
              fullWidth InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Confirmation ref"
              value={accom.confirmationNumber}
              onChange={e => setAccom(p => ({ ...p, confirmationNumber: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Cost (€)"
              type="number"
              value={accom.cost}
              onChange={e => setAccom(p => ({ ...p, cost: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={accom.status} label="Status" onChange={e => setAccom(p => ({ ...p, status: e.target.value }))}>
                {TRANSPORT_STATUSES.map(s => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                    {s.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={accom.notes}
              onChange={e => setAccom(p => ({ ...p, notes: e.target.value }))}
              fullWidth multiline rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => setAccomOpen(false)} fullWidth={mobile} size="large">Cancel</Button>
          <Button variant="contained" onClick={saveAccom} disabled={saving} fullWidth={mobile} size="large">
            Save accommodation
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}