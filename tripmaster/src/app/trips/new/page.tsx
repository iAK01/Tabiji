'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, TextField, Button, Paper,
  ToggleButton, ToggleButtonGroup, Stepper, Step, StepLabel,
  AppBar, Toolbar, IconButton, FormControl, InputLabel, Select,
  MenuItem, Chip, Tooltip, StepConnector, stepConnectorClasses,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import FlightTakeoffIcon   from '@mui/icons-material/FlightTakeoff';
import FlightLandIcon      from '@mui/icons-material/FlightLand';
import HomeIcon            from '@mui/icons-material/Home';
import EditIcon            from '@mui/icons-material/Edit';
import ChevronLeftIcon     from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon    from '@mui/icons-material/ChevronRight';
import BeachAccessIcon     from '@mui/icons-material/BeachAccess';
import BusinessCenterIcon  from '@mui/icons-material/BusinessCenter';
import SyncAltIcon         from '@mui/icons-material/SyncAlt';
import CheckIcon           from '@mui/icons-material/Check';
import { COUNTRY_LIST }    from '@/lib/data/countries';
import { queueAction }     from '@/lib/offline/db';
import AirportSearch       from '@/components/ui/AirportSearch';

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

const REGIONS = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));
const steps   = ['Basic Details', 'Origin & Destination', 'Dates'];

// ─── Custom step connector ────────────────────────────────────────────────────

const ThinConnector = styled(StepConnector)(() => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: { top: 14 },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2, border: 0,
    backgroundColor: D.rule,
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]:    { backgroundColor: D.green },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: { backgroundColor: D.green },
}));

// ─── Country Select ───────────────────────────────────────────────────────────

function CountrySelect({ label, value, onChange }: {
  label:    string;
  value:    string;
  onChange: (code: string, name: string) => void;
}) {
  return (
    <FormControl fullWidth required>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label}
        onChange={e => {
          const code = e.target.value;
          const name = COUNTRY_LIST.find(c => c.code === code)?.name ?? '';
          onChange(code, name);
        }}>
        {REGIONS.map(region => [
          <MenuItem key={`hdr-${region}-${label}`} disabled
            sx={{ fontWeight: 700, opacity: 1, color: D.muted, fontSize: '0.72rem',
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {region}
          </MenuItem>,
          ...COUNTRY_LIST.filter(c => c.region === region).map(c => (
            <MenuItem key={c.code} value={c.code} sx={{ fontFamily: D.body }}>{c.name}</MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
}

// ─── Date utilities ───────────────────────────────────────────────────────────

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
function toISO(d: Date)    { return d.toISOString().split('T')[0]; }
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
  startDate:     string;
  endDate:       string;
  onRangeChange: (start: string, end: string) => void;
  minDate:       string;
}

function RangeCalendar({ startDate, endDate, onRangeChange, minDate }: RangeCalendarProps) {
  const seed  = startDate ? new Date(startDate + 'T12:00:00') : new Date();
  const [year,    setYear]    = useState(seed.getFullYear());
  const [month,   setMonth]   = useState(seed.getMonth());
  const [hovered, setHovered] = useState<string | null>(null);

  const today      = toISO(new Date());
  const weeks      = buildGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const handleDayClick = (iso: string) => {
    if (iso < minDate) return;
    if (!startDate || (startDate && endDate)) { onRangeChange(iso, ''); }
    else { if (iso < startDate) onRangeChange(iso, ''); else onRangeChange(startDate, iso); }
  };

  const rangeEnd  = endDate || (hovered && startDate && hovered > startDate ? hovered : null);
  const selecting = !!(startDate && !endDate);

  return (
    <Box>
      {/* Status chip */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'center' }}>
        {!startDate && (
          <Chip
            icon={<FlightTakeoffIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Select your departure date"
            sx={{ backgroundColor: `${D.green}18`, color: D.green, fontWeight: 700,
                  fontSize: '0.8rem', border: `1px solid ${D.green}44`, fontFamily: D.body }}
          />
        )}
        {startDate && !endDate && (
          <Chip
            icon={<FlightLandIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Now select your return date"
            sx={{ backgroundColor: `${D.terra}18`, color: D.terra, fontWeight: 700,
                  fontSize: '0.8rem', border: `1px solid ${D.terra}44`, fontFamily: D.body }}
          />
        )}
        {startDate && endDate && (
          <Chip
            icon={<CheckIcon sx={{ fontSize: '0.9rem !important' }} />}
            label={`${parseISO(startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} → ${parseISO(endDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`}
            onDelete={() => onRangeChange('', '')}
            sx={{ backgroundColor: `${D.green}18`, color: D.green, fontWeight: 700,
                  fontSize: '0.82rem', border: `1px solid ${D.green}44`, fontFamily: D.body }}
          />
        )}
      </Box>

      {/* Month nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
        <IconButton onClick={prev} sx={{ width: 44, height: 44, border: `1px solid ${D.rule}` }}>
          <ChevronLeftIcon sx={{ color: D.navy }} />
        </IconButton>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, letterSpacing: '-0.01em' }}>
          {monthLabel}
        </Typography>
        <IconButton onClick={next} sx={{ width: 44, height: 44, border: `1px solid ${D.rule}` }}>
          <ChevronRightIcon sx={{ color: D.navy }} />
        </IconButton>
      </Box>

      {/* Day labels */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_LABELS.map(d => (
          <Typography key={d} sx={{
            textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, fontFamily: D.body,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted, py: 0.5,
          }}>
            {d}
          </Typography>
        ))}
      </Box>

      {/* Weeks */}
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
            if (inRange) rangeBg = `${D.green}18`;
            else if (isStart && !isEnd && rangeEnd) rangeBg = `linear-gradient(to right, transparent 50%, ${D.green}18 50%)`;
            else if (isRangeEnd && !isStart)        rangeBg = `linear-gradient(to left,  transparent 50%, ${D.green}18 50%)`;

            return (
              <Box key={iso}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => selecting && setHovered(iso)}
                onMouseLeave={() => setHovered(null)}
                sx={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: rangeBg, cursor: isDisabled ? 'default' : 'pointer' }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? D.green : 'transparent',
                  border: isToday && !isSelected ? `2px solid ${D.green}` : 'none',
                  transition: 'background-color 0.12s',
                  '&:hover': !isDisabled && !isSelected ? { backgroundColor: `${D.green}28` } : {},
                }}>
                  <Typography sx={{
                    fontFamily: D.body,
                    fontSize: '0.95rem',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    color: isSelected ? '#fff' : isDisabled ? D.muted : D.navy,
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
  const [activeStep,        setActiveStep]        = useState(0);
  const [saving,            setSaving]            = useState(false);
  const [originFromProfile, setOriginFromProfile] = useState(false);

  const [form, setForm] = useState({
    name:                   '',
    tripType:               'leisure',
    purpose:                '',
    originCity:             '',
    originCountry:          '',
    originCountryCode:      '',
    originIata:             '',
    destinationCity:        '',
    destinationCountry:     '',
    destinationCountryCode: '',
    destinationIata:        '',
    startDate:              '',
    endDate:                '',
  });

  // Font injection
  useEffect(() => {
    if (!document.querySelector('#archivo-font')) {
      const link  = document.createElement('link');
      link.id     = 'archivo-font';
      link.rel    = 'stylesheet';
      link.href   = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(data => {
      const user = data.user;
      if (!user) return;
      const updates: Partial<typeof form> = {};
      if (user.preferences?.defaultTripType) updates.tripType = user.preferences.defaultTripType;
      if (user.homeLocation?.city && user.homeLocation?.countryCode) {
        updates.originCity        = user.homeLocation.city;
        updates.originCountry     = user.homeLocation.country;
        updates.originCountryCode = user.homeLocation.countryCode;
        if (user.homeLocation?.iataCode) updates.originIata = user.homeLocation.iataCode;
        setOriginFromProfile(true);
      }
      setForm(prev => ({ ...prev, ...updates }));
    }).catch(() => {});
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
      name: form.name, tripType: form.tripType, purpose: form.purpose,
      origin: {
        city: form.originCity, country: form.originCountry,
        countryCode: form.originCountryCode, iataCode: form.originIata || undefined,
      },
      destination: {
        city: form.destinationCity, country: form.destinationCountry,
        countryCode: form.destinationCountryCode, iataCode: form.destinationIata || undefined,
      },
      startDate: form.startDate, endDate: form.endDate, nights, status: 'planning',
    };
    if (!navigator.onLine) {
      await queueAction({ type: 'CREATE_TRIP', body: payload, timestamp: Date.now() });
      setSaving(false); router.push('/dashboard'); return;
    }
    const data = await fetch('/api/trips', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(r => r.json());
    if (data.trip?._id) router.push(`/trips/${data.trip._id}`);
    setSaving(false);
  };

  const canProceed = [
    !!(form.name && form.tripType),
    !!(form.originCity && form.originCountryCode && form.destinationCity && form.destinationCountryCode),
    !!(form.startDate && form.endDate && nights >= 0),
  ];

  const today = toISO(new Date());

  const TRIP_TYPES = [
    { value: 'leisure', label: 'Leisure', Icon: BeachAccessIcon },
    { value: 'work',    label: 'Work',    Icon: BusinessCenterIcon },
    { value: 'mixed',   label: 'Mixed',   Icon: SyncAltIcon },
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: D.bg }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: D.navy, boxShadow: 'none' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <FlightTakeoffIcon sx={{ mr: 1.5, fontSize: 20 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', letterSpacing: '-0.01em', color: 'white', flexGrow: 1 }}>
            Plan a Trip
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4, px: { xs: 2, sm: 3 } }}>

        {/* ── Stepper ── */}
        <Stepper activeStep={activeStep} connector={<ThinConnector />} sx={{ mb: 4 }}>
          {steps.map((label, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <Step key={label}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: done ? D.green : active ? D.navy : 'transparent',
                      border: `2px solid ${done || active ? 'transparent' : D.rule}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {done
                        ? <CheckIcon sx={{ fontSize: 14, color: 'white' }} />
                        : <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: active ? 'white' : D.muted }}>
                            {i + 1}
                          </Typography>
                      }
                    </Box>
                  )}
                >
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                    color: active ? D.navy : D.muted, letterSpacing: '0.01em',
                  }}>
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>

        {/* ── Card ── */}
        <Paper sx={{
          p: { xs: 2.5, sm: 4 },
          backgroundColor: D.paper,
          border: `1px solid ${D.rule}`,
          borderRadius: 2,
          boxShadow: 'none',
        }}>

          {/* ── Step 1 ── */}
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.35rem', color: D.navy, letterSpacing: '-0.02em' }}>
                What's this trip?
              </Typography>

              <TextField
                label="Trip name"
                placeholder="e.g. Tokyo Adventure, Barcelona Conference"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                fullWidth
                sx={{ '& input': { fontFamily: D.body, fontSize: '1rem' } }}
              />

              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                                  letterSpacing: '0.06em', color: D.muted, mb: 1.5 }}>
                  Trip type
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {TRIP_TYPES.map(({ value, label, Icon }) => {
                    const active = form.tripType === value;
                    return (
                      <Box
                        key={value}
                        onClick={() => update('tripType', value)}
                        sx={{
                          flex: 1, py: 2, px: 1,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
                          border: `2px solid ${active ? D.navy : D.rule}`,
                          borderRadius: 1.5,
                          backgroundColor: active ? D.navy : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': { borderColor: D.navy, backgroundColor: active ? D.navy : `${D.navy}06` },
                        }}
                      >
                        <Icon sx={{ fontSize: 22, color: active ? 'white' : D.muted }} />
                        <Typography sx={{
                          fontFamily: D.body, fontSize: '0.82rem', fontWeight: 700,
                          color: active ? 'white' : D.muted,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <TextField
                label="Purpose / notes (optional)"
                placeholder="e.g. Annual team offsite, holiday with family"
                value={form.purpose}
                onChange={e => update('purpose', e.target.value)}
                fullWidth multiline rows={2}
                sx={{ '& textarea': { fontFamily: D.body, fontSize: '1rem' } }}
              />
            </Box>
          )}

          {/* ── Step 2 ── */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.35rem', color: D.navy, letterSpacing: '-0.02em' }}>
                Where are you travelling?
              </Typography>

              {/* Origin */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.06em', color: D.muted }}>
                    Origin
                  </Typography>
                  {originFromProfile && (
                    <Chip
                      icon={<HomeIcon sx={{ fontSize: '0.8rem !important' }} />}
                      label="From home"
                      size="small"
                      onDelete={clearOrigin}
                      deleteIcon={<EditIcon sx={{ fontSize: '0.8rem !important' }} />}
                      sx={{
                        fontSize: '0.72rem', height: 26, fontFamily: D.body,
                        backgroundColor: `${D.green}18`, color: D.green,
                        border: `1px solid ${D.green}44`,
                        '& .MuiChip-icon':       { color: D.green },
                        '& .MuiChip-deleteIcon': { color: D.green },
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
                    sx={{ '& input': { fontFamily: D.body } }}
                  />
                  <CountrySelect label="Country" value={form.originCountryCode}
                    onChange={(code, name) => { update('originCountryCode', code); update('originCountry', name); setOriginFromProfile(false); }} />
                  <AirportSearch
                    label="Nearest airport (optional)"
                    value={form.originIata ? `${form.originIata} — ${form.originCity}` : ''}
                    onChange={airport => update('originIata', airport.iata)}
                    placeholder="Search by city or IATA code"
                  />
                </Box>
              </Box>

              {/* Visual divider between origin / destination */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: D.rule }} />
                <Box sx={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `1px solid ${D.rule}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: D.paper,
                }}>
                  <FlightLandIcon sx={{ fontSize: 16, color: D.muted }} />
                </Box>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: D.rule }} />
              </Box>

              {/* Destination */}
              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                                  letterSpacing: '0.06em', color: D.muted, mb: 1.5 }}>
                  Destination
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="City"
                    value={form.destinationCity}
                    onChange={e => update('destinationCity', e.target.value)}
                    fullWidth placeholder="e.g. Bucharest"
                    sx={{ '& input': { fontFamily: D.body } }}
                  />
                  <CountrySelect label="Country" value={form.destinationCountryCode}
                    onChange={(code, name) => { update('destinationCountryCode', code); update('destinationCountry', name); }} />
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
              <Typography sx={{ fontFamily: D.display, fontSize: '1.35rem', color: D.navy, letterSpacing: '-0.02em' }}>
                When are you going?
              </Typography>
              <RangeCalendar
                startDate={form.startDate}
                endDate={form.endDate}
                minDate={today}
                onRangeChange={(start, end) => { update('startDate', start); update('endDate', end); }}
              />
              {nights > 0 && (
                <Box sx={{
                  p: 2.5, borderRadius: 1.5,
                  backgroundColor: `${D.green}10`,
                  border: `1px solid ${D.green}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2.5,
                }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontFamily: D.display, fontSize: '2.75rem', color: D.green, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {nights}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                                      letterSpacing: '0.06em', color: D.green, mt: 0.25 }}>
                      {nights === 1 ? 'night' : 'nights'}
                    </Typography>
                  </Box>
                  <Box sx={{ borderLeft: `1px solid ${D.green}44`, pl: 2.5 }}>
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 700, color: D.navy }}>
                      {parseISO(form.startDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: D.muted, my: 0.25 }}>↓</Typography>
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 700, color: D.navy }}>
                      {parseISO(form.endDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* ── Navigation ── */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 2 }}>
            <Button
              onClick={() => setActiveStep(prev => prev - 1)}
              disabled={activeStep === 0}
              sx={{
                minWidth: 88, py: 1.5, fontFamily: D.body, fontWeight: 700,
                color: D.muted, border: `1px solid ${D.rule}`,
                '&:hover': { backgroundColor: `${D.navy}06`, borderColor: D.navy, color: D.navy },
                '&:disabled': { opacity: 0.35 },
              }}
            >
              Back
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={() => setActiveStep(prev => prev + 1)}
                disabled={!canProceed[activeStep]}
                sx={{
                  flex: 1, py: 1.5, fontFamily: D.body, fontWeight: 800, fontSize: '0.95rem',
                  backgroundColor: D.navy, '&:hover': { backgroundColor: '#141c35' },
                  '&:disabled': { backgroundColor: D.rule, color: D.muted },
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!canProceed[activeStep] || saving}
                sx={{
                  flex: 1, py: 1.5, fontFamily: D.body, fontWeight: 800, fontSize: '0.95rem',
                  backgroundColor: D.terra, '&:hover': { backgroundColor: '#b5633e' },
                  '&:disabled': { backgroundColor: D.rule, color: D.muted },
                }}
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