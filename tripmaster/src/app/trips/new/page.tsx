'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, TextField, Button, Paper,
  ToggleButton, ToggleButtonGroup, Stepper, Step, StepLabel,
  AppBar, Toolbar, IconButton, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import { COUNTRY_LIST } from '@/lib/data/countries';

const steps = ['Basic Details', 'Origin & Destination', 'Dates'];
const REGIONS = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));

function CountrySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string, name: string) => void;
}) {
  return (
    <FormControl fullWidth required>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={e => {
          const code = e.target.value;
          const name = COUNTRY_LIST.find(c => c.code === code)?.name ?? '';
          onChange(code, name);
        }}
      >
        {REGIONS.map(region => [
          <MenuItem
            key={`hdr-${region}-${label}`}
            disabled
            sx={{ fontWeight: 700, opacity: 1, color: 'text.secondary', fontSize: '0.75rem' }}
          >
            {region}
          </MenuItem>,
          ...COUNTRY_LIST.filter(c => c.region === region).map(c => (
            <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
}

export default function NewTripPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    tripType: 'leisure',
    purpose: '',
    originCity: '',
    originCountry: '',
    originCountryCode: '',
    destinationCity: '',
    destinationCountry: '',
    destinationCountryCode: '',
    startDate: '',
    endDate: '',
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const nights =
    form.startDate && form.endDate
      ? Math.round(
          (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const handleSubmit = async () => {
    setSaving(true);
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        tripType: form.tripType,
        purpose: form.purpose,
        origin: {
          city: form.originCity,
          country: form.originCountry,
          countryCode: form.originCountryCode,
        },
        destination: {
          city: form.destinationCity,
          country: form.destinationCountry,
          countryCode: form.destinationCountryCode,
        },
        startDate: form.startDate,
        endDate: form.endDate,
        nights,
        status: 'planning',
      }),
    });
    const data = await res.json();
    if (data.trip?._id) router.push(`/trips/${data.trip._id}`);
    setSaving(false);
  };

  const canProceed = [
    !!(form.name && form.tripType),
    !!(
      form.originCity &&
      form.originCountryCode &&
      form.destinationCity &&
      form.destinationCountryCode
    ),
    !!(form.startDate && form.endDate && nights > 0),
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <FlightTakeoffIcon sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700}>
            Plan a Trip
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Paper sx={{ p: 4, backgroundColor: 'background.paper' }}>

          {/* Step 1 — Basic Details */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>What's this trip?</Typography>
              <TextField
                label="Trip name"
                placeholder="e.g. Tokyo Adventure, Barcelona Conference"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                fullWidth
              />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Trip type
                </Typography>
                <ToggleButtonGroup
                  value={form.tripType}
                  exclusive
                  onChange={(_, val) => val && update('tripType', val)}
                  fullWidth
                >
                  <ToggleButton value="leisure">🏖️ Leisure</ToggleButton>
                  <ToggleButton value="work">💼 Work</ToggleButton>
                  <ToggleButton value="mixed">✈️ Mixed</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                label="Purpose / notes (optional)"
                placeholder="e.g. Annual team offsite, holiday with family"
                value={form.purpose}
                onChange={e => update('purpose', e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          )}

          {/* Step 2 — Origin & Destination */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>Where are you travelling?</Typography>

              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Origin
              </Typography>
              <TextField
                label="City"
                value={form.originCity}
                onChange={e => update('originCity', e.target.value)}
                fullWidth
                placeholder="e.g. Dublin"
              />
              <CountrySelect
                label="Country"
                value={form.originCountryCode}
                onChange={(code, name) => {
                  update('originCountryCode', code);
                  update('originCountry', name);
                }}
              />

              <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>
                Destination
              </Typography>
              <TextField
                label="City"
                value={form.destinationCity}
                onChange={e => update('destinationCity', e.target.value)}
                fullWidth
                placeholder="e.g. Bucharest"
              />
              <CountrySelect
                label="Country"
                value={form.destinationCountryCode}
                onChange={(code, name) => {
                  update('destinationCountryCode', code);
                  update('destinationCountry', name);
                }}
              />
            </Box>
          )}

          {/* Step 3 — Dates */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>When are you going?</Typography>
              <TextField
                label="Departure date"
                type="date"
                value={form.startDate}
                onChange={e => update('startDate', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Return date"
                type="date"
                value={form.endDate}
                onChange={e => update('endDate', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              {nights > 0 && (
                <Typography variant="body1" color="primary.main" fontWeight={600}>
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </Typography>
              )}
            </Box>
          )}

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              onClick={() => setActiveStep(prev => prev - 1)}
              disabled={activeStep === 0}
            >
              Back
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={() => setActiveStep(prev => prev + 1)}
                disabled={!canProceed[activeStep]}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!canProceed[activeStep] || saving}
              >
                {saving ? 'Creating...' : 'Create Trip'}
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}