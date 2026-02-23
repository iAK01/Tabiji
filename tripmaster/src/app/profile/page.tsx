'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton, Button,
  Paper, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Alert, Divider, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import TuneIcon from '@mui/icons-material/Tune';
import { COUNTRY_LIST, COUNTRY_META, getCountryMeta } from '@/lib/data/countries';

interface UserProfile {
  name: string;
  email: string;
  homeLocation: {
    city: string;
    country: string;
    countryCode: string;
    timezone: string;
    currency: string;
    currencySymbol: string;
    electricalPlug: string;
    language: string;
    emergency: string;
  };
  passport: {
    country: string;
    countryCode: string;
    expiry: string;
    number: string;
  };
  preferences: {
    units: 'metric' | 'imperial';
    defaultTripType: 'work' | 'leisure' | 'mixed';
  };
}

const emptyProfile: UserProfile = {
  name: '',
  email: '',
  homeLocation: { city: '', country: '', countryCode: '', timezone: '', currency: '', currencySymbol: '', electricalPlug: '', language: '', emergency: '' },
  passport: { country: '', countryCode: '', expiry: '', number: '' },
  preferences: { units: 'metric', defaultTripType: 'leisure' },
};

// Group countries by region for the select
const REGIONS = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const isOnboarding = !profile?.homeLocation?.countryCode;

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setProfile(data.user);
          setForm({
            name: data.user.name || '',
            email: data.user.email || '',
            homeLocation: data.user.homeLocation || emptyProfile.homeLocation,
            passport: data.user.passport || emptyProfile.passport,
            preferences: data.user.preferences || emptyProfile.preferences,
          });
          // If no home location set, drop straight into edit mode
          if (!data.user.homeLocation?.countryCode) setEditing(true);
        }
        setLoading(false);
      });
  }, []);

  // When home country changes, auto-fill meta fields
  const handleHomeCountryChange = (code: string) => {
    const country = COUNTRY_LIST.find(c => c.code === code);
    const meta = getCountryMeta(code);
    setForm(p => ({
      ...p,
      homeLocation: {
        ...p.homeLocation,
        countryCode: code,
        country: country?.name || '',
        timezone: meta.timezone,
        currency: meta.currency,
        currencySymbol: meta.currencySymbol,
        electricalPlug: meta.electricalPlug,
        language: meta.language,
        emergency: meta.emergency,
      },
    }));
  };

  // When passport country changes, auto-fill name
  const handlePassportCountryChange = (code: string) => {
    const country = COUNTRY_LIST.find(c => c.code === code);
    setForm(p => ({
      ...p,
      passport: { ...p.passport, countryCode: code, country: country?.name || '' },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setProfile(form);
    setEditing(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Passport expiry warning
  const passportDaysLeft = profile?.passport?.expiry
    ? Math.floor((new Date(profile.passport.expiry).getTime() - Date.now()) / 86400000)
    : null;

  const passportWarning = passportDaysLeft !== null && passportDaysLeft < 180;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {isOnboarding ? 'Set up your profile' : 'My Profile'}
          </Typography>
          {!isOnboarding && !editing && (
            <Button color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>

        {/* Onboarding banner */}
        {isOnboarding && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Welcome! Set your home country so TripMaster can calculate electrical adapters, currency, timezone, and language differences for every trip.
          </Alert>
        )}

        {saved && (
          <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
            Profile saved successfully.
          </Alert>
        )}

        {/* Passport expiry warning — view mode only */}
        {!editing && passportWarning && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
            Your passport expires in {passportDaysLeft} days.
            {passportDaysLeft < 0 ? ' It has already expired.' : ' Most countries require 6 months validity.'}
          </Alert>
        )}

        {/* ── VIEW MODE ── */}
        {!editing && profile && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Personal */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Personal</Typography>
              </Box>
              <Typography variant="body1">{profile.name}</Typography>
              <Typography variant="body2" color="text.secondary">{profile.email}</Typography>
            </Paper>

            {/* Home location */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HomeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Home</Typography>
              </Box>
              {profile.homeLocation?.countryCode ? (
                <Box>
                  <Typography variant="body1">
                    {profile.homeLocation.city ? `${profile.homeLocation.city}, ` : ''}{profile.homeLocation.country}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                    <Chip size="small" label={`🔌 ${profile.homeLocation.electricalPlug}`} variant="outlined" />
                    <Chip size="small" label={`💰 ${profile.homeLocation.currency} ${profile.homeLocation.currencySymbol}`} variant="outlined" />
                    <Chip size="small" label={`🗣️ ${profile.homeLocation.language}`} variant="outlined" />
                    <Chip size="small" label={`⏰ ${profile.homeLocation.timezone}`} variant="outlined" />
                    <Chip size="small" label={`🚨 ${profile.homeLocation.emergency}`} variant="outlined" />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            {/* Passport */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BadgeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Passport</Typography>
              </Box>
              {profile.passport?.countryCode ? (
                <Box>
                  <Typography variant="body1">{profile.passport.country}</Typography>
                  {profile.passport.expiry && (
                    <Typography
                      variant="body2"
                      color={passportWarning ? 'error' : 'text.secondary'}
                      sx={{ mt: 0.5 }}
                    >
                      Expires: {new Date(profile.passport.expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {passportWarning && ` ⚠️ (${passportDaysLeft} days)`}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            {/* Preferences */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TuneIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Preferences</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip size="small" label={profile.preferences?.units === 'imperial' ? 'Imperial' : 'Metric'} variant="outlined" />
                {profile.preferences?.defaultTripType && (
                  <Chip size="small" label={`Default: ${profile.preferences.defaultTripType}`} variant="outlined" />
                )}
              </Box>
            </Paper>

          </Box>
        )}

        {/* ── EDIT / ONBOARDING FORM ── */}
        {editing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Personal */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <PersonIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Personal</Typography>
              </Box>
              <TextField
                label="Full name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                fullWidth
              />
            </Paper>

            {/* Home location */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <HomeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Home location</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth required>
                  <InputLabel>Home country</InputLabel>
                  <Select
                    value={form.homeLocation.countryCode}
                    label="Home country"
                    onChange={e => handleHomeCountryChange(e.target.value)}
                  >
                    {REGIONS.map(region => [
                      <MenuItem key={`header-${region}`} disabled sx={{ fontWeight: 700, opacity: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                        {region}
                      </MenuItem>,
                      ...COUNTRY_LIST.filter(c => c.region === region).map(c => (
                        <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>
                      )),
                    ])}
                  </Select>
                </FormControl>
                <TextField
                  label="Home city (optional)"
                  value={form.homeLocation.city}
                  onChange={e => setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, city: e.target.value } }))}
                  fullWidth
                  placeholder="e.g. Dublin"
                />
                {/* Auto-filled info chips */}
                {form.homeLocation.countryCode && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`🔌 ${form.homeLocation.electricalPlug}`} color="primary" variant="outlined" />
                    <Chip size="small" label={`💰 ${form.homeLocation.currency}`} color="primary" variant="outlined" />
                    <Chip size="small" label={`🗣️ ${form.homeLocation.language}`} color="primary" variant="outlined" />
                    <Chip size="small" label={`⏰ ${form.homeLocation.timezone}`} color="primary" variant="outlined" />
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Passport */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <BadgeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Passport</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Used to warn you when your passport is expiring before a trip
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Passport country</InputLabel>
                  <Select
                    value={form.passport.countryCode}
                    label="Passport country"
                    onChange={e => handlePassportCountryChange(e.target.value)}
                  >
                    {REGIONS.map(region => [
                      <MenuItem key={`ph-${region}`} disabled sx={{ fontWeight: 700, opacity: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                        {region}
                      </MenuItem>,
                      ...COUNTRY_LIST.filter(c => c.region === region).map(c => (
                        <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>
                      )),
                    ])}
                  </Select>
                </FormControl>
                <TextField
                  label="Passport expiry date"
                  type="date"
                  value={form.passport.expiry ? form.passport.expiry.split('T')[0] : ''}
                  onChange={e => setForm(p => ({ ...p, passport: { ...p.passport, expiry: e.target.value } }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Passport number (optional)"
                  value={form.passport.number}
                  onChange={e => setForm(p => ({ ...p, passport: { ...p.passport, number: e.target.value } }))}
                  fullWidth
                />
              </Box>
            </Paper>

            {/* Preferences */}
            <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <TuneIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Preferences</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Units</Typography>
                  <ToggleButtonGroup
                    value={form.preferences.units}
                    exclusive
                    onChange={(_, val) => val && setForm(p => ({ ...p, preferences: { ...p.preferences, units: val } }))}
                  >
                    <ToggleButton value="metric" size="small">Metric (°C, km)</ToggleButton>
                    <ToggleButton value="imperial" size="small">Imperial (°F, miles)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Default trip type</Typography>
                  <ToggleButtonGroup
                    value={form.preferences.defaultTripType}
                    exclusive
                    onChange={(_, val) => val && setForm(p => ({ ...p, preferences: { ...p.preferences, defaultTripType: val } }))}
                  >
                    <ToggleButton value="leisure" size="small">Leisure</ToggleButton>
                    <ToggleButton value="work" size="small">Work</ToggleButton>
                    <ToggleButton value="mixed" size="small">Mixed</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>
            </Paper>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pb: 4 }}>
              {!isOnboarding && (
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              )}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !form.homeLocation.countryCode}
              >
                {saving ? 'Saving...' : isOnboarding ? 'Save & continue' : 'Save changes'}
              </Button>
            </Box>

          </Box>
        )}
      </Container>
    </Box>
  );
}