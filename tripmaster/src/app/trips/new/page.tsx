'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, TextField, Button, Paper,
  ToggleButton, ToggleButtonGroup, Stepper, Step, StepLabel,
  AppBar, Toolbar, IconButton, FormControl, InputLabel, Select,
  MenuItem, Chip, Tooltip,
} from '@mui/material';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import FlightTakeoffIcon  from '@mui/icons-material/FlightTakeoff';
import HomeIcon           from '@mui/icons-material/Home';
import EditIcon           from '@mui/icons-material/Edit';
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon   from '@mui/icons-material/ChevronRight';
import FlightLandIcon     from '@mui/icons-material/FlightLand';
import FlightTakeoff2Icon from '@mui/icons-material/FlightTakeoff';
import { COUNTRY_LIST }   from '@/lib/data/countries';
import { queueAction }    from '@/lib/offline/db';
import AirportSearch      from '@/components/ui/AirportSearch';

// ─── Theme ────────────────────────────────────────────────────────────────────
const MOSS    = '#55702c';
const MOSS_LT = '#e8f0dc';
const TERRA   = '#c9521b';

const steps   = ['Basic Details', 'Origin & Destination', 'Dates'];
const REGIONS = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));

// ─── Country Select ───────────────────────────────────────────────────────────
function CountrySelect({ label, value, onChange }: {
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
          <MenuItem key={`hdr-${region}-${label}`} disabled
            sx={{ fontWeight: 700, opacity: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
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

// ─── Date utilities ───────────────────────────────────────────────────────────
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toISO(d: Date) { return d.toISOString().split('T')[0]; }
function parseISO(iso: string) { return new Date(iso + 'T12:00:00'); }

function buildGrid(year: number, month: number): (string | null)[][] {
  const first  = new Date(year, month, 1);
  const last   = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(toISO(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ─── Range Calendar ───────────────────────────────────────────────────────────
interface RangeCalendarProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  minDate: string;
}

function RangeCalendar({ startDate, endDate, onRangeChange, minDate }: RangeCalendarProps) {
  const seed = startDate ? new Date(startDate + 'T12:00:00') : new Date();
  const [year,    setYear]    = useState(seed.getFullYear());
  const [month,   setMonth]   = useState(seed.getMonth());
  const [hovered, setHovered] = useState<string | null>(null);

  const today     = toISO(new Date());
  const weeks     = buildGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const handleDayClick = (iso: string) => {
    if (iso < minDate) return;
    if (!startDate || (startDate && endDate)) { onRangeChange(iso, ''); }
    else { if (iso < startDate) onRangeChange(iso, '');
else onRangeChange(startDate, iso); }
  };

  const rangeEnd = endDate || (hovered && startDate && hovered > startDate ? hovered : null);
  const selecting = !!(startDate && !endDate);

  return (
    <Box>
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'center' }}>
        {!startDate && (
          <Chip icon={<FlightTakeoff2Icon sx={{ fontSize: '0.9rem !important' }} />}
            label="Tap a date to set departure"
            sx={{ backgroundColor: MOSS_LT, color: MOSS, fontWeight: 600, fontSize: '0.8rem' }} />
        )}
        {startDate && !endDate && (
          <Chip icon={<FlightLandIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Now tap your return date"
            sx={{ backgroundColor: `${TERRA}18`, color: TERRA, fontWeight: 600, fontSize: '0.8rem', border: `1px solid ${TERRA}44` }} />
        )}
        {startDate && endDate && (
          <Chip
            label={`${parseISO(startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} → ${parseISO(endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`}
            onDelete={() => onRangeChange('', '')}
            sx={{ backgroundColor: MOSS_LT, color: MOSS, fontWeight: 700, fontSize: '0.82rem' }} />
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
        <IconButton onClick={prev} sx={{ width: 48, height: 48, border: '1px solid', borderColor: 'divider' }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>{monthLabel}</Typography>
        <IconButton onClick={next} sx={{ width: 48, height: 48, border: '1px solid', borderColor: 'divider' }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_LABELS.map(d => (
          <Typography key={d} variant="caption" fontWeight={700}
            sx={{ textAlign: 'center', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', py: 0.5 }}>
            {d}
          </Typography>
        ))}
      </Box>

      {weeks.map((week, wi) => (
        <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {week.map((iso, di) => {
            if (!iso) return <Box key={di} sx={{ height: 52 }} />;
            const isStart    = iso === startDate;
            const isEnd      = iso === endDate;
            const isDisabled = iso < minDate;
            const isToday    = iso === today;
            const inRange    = !!(rangeEnd && startDate && iso > startDate && iso < rangeEnd);
            const isSelected = isStart || isEnd;
            const isRangeEnd = isEnd || (iso === rangeEnd && iso !== startDate);

            let rangeBg = 'transparent';
            if (inRange) rangeBg = MOSS_LT;
            else if (isStart && !isEnd && rangeEnd) rangeBg = `linear-gradient(to right, transparent 50%, ${MOSS_LT} 50%)`;
            else if (isRangeEnd && !isStart) rangeBg = `linear-gradient(to left, transparent 50%, ${MOSS_LT} 50%)`;

            return (
              <Box key={iso} onClick={() => handleDayClick(iso)}
                onMouseEnter={() => selecting && setHovered(iso)}
                onMouseLeave={() => setHovered(null)}
                sx={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: rangeBg, cursor: isDisabled ? 'default' : 'pointer' }}>
                <Box sx={{
                  width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? MOSS : 'transparent',
                  border: isToday && !isSelected ? `2px solid ${MOSS}` : 'none',
                  transition: 'background-color 0.12s',
                  '&:hover': !isDisabled && !isSelected ? { backgroundColor: `${MOSS}33` } : {},
                }}>
                  <Typography sx={{
                    fontSize: '1rem', fontWeight: isSelected || isToday ? 700 : 400,
                    color: isSelected ? '#fff' : isDisabled ? 'text.disabled' : 'text.primary',
                    lineHeight: 1, userSelect: 'none',
                  }}>
                    {parseISO(iso).getDate()}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewTripPage() {
  const router = useRouter();
  const [activeStep, setActiveStep]               = useState(0);
  const [saving, setSaving]                       = useState(false);
  const [originFromProfile, setOriginFromProfile] = useState(false);

  const [form, setForm] = useState({
    name:                   '',
    tripType:               'leisure',
    purpose:                '',
    originCity:             '',
    originCountry:          '',
    originCountryCode:      '',
    originIata:             '',   // ← new
    destinationCity:        '',
    destinationCountry:     '',
    destinationCountryCode: '',
    destinationIata:        '',   // ← new
    startDate:              '',
    endDate:                '',
  });

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        const user = data.user;
        if (!user) return;
        const updates: Partial<typeof form> = {};
        if (user.preferences?.defaultTripType) updates.tripType = user.preferences.defaultTripType;
        if (user.homeLocation?.city && user.homeLocation?.countryCode) {
          updates.originCity        = user.homeLocation.city;
          updates.originCountry     = user.homeLocation.country;
          updates.originCountryCode = user.homeLocation.countryCode;
          // Use stored IATA if the user profile has it
          if (user.homeLocation?.iataCode) updates.originIata = user.homeLocation.iataCode;
          setOriginFromProfile(true);
        }
        setForm(prev => ({ ...prev, ...updates }));
      })
      .catch(() => {});
  }, []);

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const clearOrigin = () => {
    setForm(prev => ({ ...prev, originCity: '', originCountry: '', originCountryCode: '', originIata: '' }));
    setOriginFromProfile(false);
  };

  const nights =
    form.startDate && form.endDate
      ? Math.round((parseISO(form.endDate).getTime() - parseISO(form.startDate).getTime()) / 86400000)
      : 0;

  const handleSubmit = async () => {
    setSaving(true);
    const payload = {
      name:     form.name,
      tripType: form.tripType,
      purpose:  form.purpose,
      origin: {
        city:        form.originCity,
        country:     form.originCountry,
        countryCode: form.originCountryCode,
        iataCode:    form.originIata || undefined,
      },
      destination: {
        city:        form.destinationCity,
        country:     form.destinationCountry,
        countryCode: form.destinationCountryCode,
        iataCode:    form.destinationIata || undefined,
      },
      startDate: form.startDate,
      endDate:   form.endDate,
      nights,
      status: 'planning',
    };

    if (!navigator.onLine) {
      await queueAction({ type: 'CREATE_TRIP', body: payload, timestamp: Date.now() });
      setSaving(false);
      router.push('/dashboard');
      return;
    }

    const res  = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.trip?._id) router.push(`/trips/${data.trip._id}`);
    setSaving(false);
  };

  const canProceed = [
    !!(form.name && form.tripType),
    !!(form.originCity && form.originCountryCode && form.destinationCity && form.destinationCountryCode),
   !!(form.startDate && form.endDate && nights >= 0),
  ];

  const today = toISO(new Date());

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <FlightTakeoffIcon sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700}>Plan a Trip</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map(label => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
        </Stepper>

        <Paper sx={{ p: { xs: 2.5, sm: 4 }, backgroundColor: 'background.paper' }}>

          {/* ── Step 1 ── */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>What's this trip?</Typography>
              <TextField
                label="Trip name"
                placeholder="e.g. Tokyo Adventure, Barcelona Conference"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                fullWidth
                inputProps={{ style: { fontSize: '1rem' } }}
              />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Trip type</Typography>
                <ToggleButtonGroup
                  value={form.tripType} exclusive fullWidth
                  onChange={(_, val) => val && update('tripType', val)}
                  sx={{ '& .MuiToggleButton-root': { py: 1.5, fontSize: '0.9rem' } }}
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
                fullWidth multiline rows={2}
                inputProps={{ style: { fontSize: '1rem' } }}
              />
            </Box>
          )}

          {/* ── Step 2 ── */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>Where are you travelling?</Typography>

              {/* Origin */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={700} color="text.secondary">Origin</Typography>
                  {originFromProfile && (
                    <Chip
                      icon={<HomeIcon sx={{ fontSize: '0.8rem !important' }} />}
                      label="From home"
                      size="small"
                      onDelete={clearOrigin}
                      deleteIcon={<EditIcon sx={{ fontSize: '0.8rem !important' }} />}
                      sx={{
                        fontSize: '0.7rem', height: 26,
                        backgroundColor: MOSS_LT, color: MOSS, border: `1px solid ${MOSS}55`,
                        '& .MuiChip-icon': { color: MOSS }, '& .MuiChip-deleteIcon': { color: MOSS },
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="City"
                    value={form.originCity}
                    onChange={e => { update('originCity', e.target.value); setOriginFromProfile(false); }}
                    fullWidth placeholder="e.g. Dublin"
                    inputProps={{ style: { fontSize: '1rem' } }}
                  />
                  <CountrySelect
                    label="Country"
                    value={form.originCountryCode}
                    onChange={(code, name) => { update('originCountryCode', code); update('originCountry', name); setOriginFromProfile(false); }}
                  />
                  <AirportSearch
                    label="Nearest airport (optional)"
                    value={form.originIata ? `${form.originIata} — ${form.originCity}` : ''}
                    onChange={airport => update('originIata', airport.iata)}
                    placeholder="Search by city or IATA code"
                  />
                </Box>
              </Box>

              {/* Destination */}
              <Box>
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
                  Destination
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="City"
                    value={form.destinationCity}
                    onChange={e => update('destinationCity', e.target.value)}
                    fullWidth placeholder="e.g. Bucharest"
                    inputProps={{ style: { fontSize: '1rem' } }}
                  />
                  <CountrySelect
                    label="Country"
                    value={form.destinationCountryCode}
                    onChange={(code, name) => { update('destinationCountryCode', code); update('destinationCountry', name); }}
                  />
                  <AirportSearch
                    label="Nearest airport (optional)"
                    value={form.destinationIata ? `${form.destinationIata} — ${form.destinationCity}` : ''}
                    onChange={airport => update('destinationIata', airport.iata)}
                    placeholder="Search by city or IATA code"
                  />
                </Box>
              </Box>
            </Box>
          )}

          {/* ── Step 3 ── */}
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" fontWeight={600}>When are you going?</Typography>
              <RangeCalendar
                startDate={form.startDate}
                endDate={form.endDate}
                minDate={today}
                onRangeChange={(start, end) => { update('startDate', start); update('endDate', end); }}
              />
              {nights > 0 && (
                <Box sx={{
                  p: 2.5, borderRadius: 2, backgroundColor: MOSS_LT, border: `1px solid ${MOSS}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" fontWeight={800} sx={{ color: MOSS, lineHeight: 1 }}>{nights}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: MOSS }}>{nights === 0 ? 'day trip' : nights === 1 ? 'night' : 'nights'}</Typography>
                  </Box>
                  <Box sx={{ borderLeft: `2px solid ${MOSS}44`, pl: 2 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {parseISO(form.startDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">↓</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {parseISO(form.endDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 2 }}>
            <Button onClick={() => setActiveStep(prev => prev - 1)} disabled={activeStep === 0} sx={{ minWidth: 80, py: 1.5 }}>
              Back
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button variant="contained" onClick={() => setActiveStep(prev => prev + 1)} disabled={!canProceed[activeStep]} sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}>
                Next
              </Button>
            ) : (
              <Button variant="contained" onClick={handleSubmit} disabled={!canProceed[activeStep] || saving} sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}>
                {saving ? 'Creating...' : 'Create Trip'}
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}