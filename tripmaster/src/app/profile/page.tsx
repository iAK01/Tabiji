'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton, Button,
  Paper, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import TuneIcon from '@mui/icons-material/Tune';
import FlightIcon from '@mui/icons-material/Flight';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { COUNTRY_LIST, getCountryMeta } from '@/lib/data/countries';
import AirportSearch from '@/components/ui/AirportSearch';
import { Airport } from '@/lib/data/airports';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Coordinates { lat: number; lng: number }

interface HomeLocation {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  countryCode: string;
  coordinates: Coordinates | null;
  timezone: string;
  currency: string;
  currencySymbol: string;
  electricalPlug: string;
  language: string;
  emergency: string;
}

interface UserProfile {
  name: string;
  email: string;
  homeLocation: HomeLocation;
  preferredAirport: { iata: string; name: string; city: string; country: string } | null;
  passport: { country: string; countryCode: string; expiry: string; number: string };
  travelInsurance: { provider: string; policyNumber: string; emergencyPhone: string; expiry: string };
  preferences: { units: 'metric' | 'imperial'; defaultTripType: 'work' | 'leisure' | 'mixed' };
}

const emptyProfile: UserProfile = {
  name: '',
  email: '',
  homeLocation: {
    addressLine1: '', addressLine2: '', city: '', postcode: '',
    country: '', countryCode: '', coordinates: null,
    timezone: '', currency: '', currencySymbol: '',
    electricalPlug: '', language: '', emergency: '',
  },
  preferredAirport: null,
  passport: { country: '', countryCode: '', expiry: '', number: '' },
  travelInsurance: { provider: '', policyNumber: '', emergencyPhone: '', expiry: '' },
  preferences: { units: 'metric', defaultTripType: 'leisure' },
};

const REGIONS = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// ─── Static map URL from coordinates ─────────────────────────────────────────
function staticMapUrl(coords: Coordinates) {
  const { lat, lng } = coords;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+e05c2b(${lng},${lat})/${lng},${lat},14/600x200@2x?access_token=${MAPBOX_TOKEN}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Geocoding state
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const isOnboarding = !profile?.homeLocation?.countryCode;

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          const merged: UserProfile = {
            ...emptyProfile,
            ...data.user,
            homeLocation: { ...emptyProfile.homeLocation, ...data.user.homeLocation },
            passport: { ...emptyProfile.passport, ...data.user.passport },
            travelInsurance: { ...emptyProfile.travelInsurance, ...data.user.travelInsurance },
            preferences: { ...emptyProfile.preferences, ...data.user.preferences },
          };
          setProfile(merged);
          setForm(merged);
          if (!data.user.homeLocation?.countryCode) setEditing(true);
        }
        setLoading(false);
      });
  }, []);

  // ── Geocode the address via Mapbox ────────────────────────────────────────
  const geocodeAddress = useCallback(async () => {
    const { addressLine1, city, country } = form.homeLocation;
    if (!addressLine1 || !city || !country) {
      setGeocodeError('Please fill in at least Address Line 1, City, and Country before locating.');
      return;
    }

    setGeocoding(true);
    setGeocodeError(null);

    const parts = [
      form.homeLocation.addressLine1,
      form.homeLocation.addressLine2,
      form.homeLocation.city,
      form.homeLocation.postcode,
      form.homeLocation.country,
    ].filter(Boolean).join(', ');

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(parts)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features?.[0];

      if (!feature) {
        setGeocodeError('Address not found — try adjusting the spelling or postcode.');
        setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, coordinates: null } }));
      } else {
        const [lng, lat] = feature.center;
        setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, coordinates: { lat, lng } } }));
      }
    } catch {
      setGeocodeError('Geocoding failed — check your connection and try again.');
    } finally {
      setGeocoding(false);
    }
  }, [form.homeLocation]);

  // Clear coordinates if address fields change after a successful geocode
  const updateAddressField = (field: keyof HomeLocation, value: string) => {
    setForm(p => ({
      ...p,
      homeLocation: { ...p.homeLocation, [field]: value, coordinates: null },
    }));
    setGeocodeError(null);
  };

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
        coordinates: null,
      },
    }));
    setGeocodeError(null);
  };

  const handlePreferredAirportChange = (airport: Airport) => {
    setForm(p => ({
      ...p,
      preferredAirport: { iata: airport.iata, name: airport.name, city: airport.city, country: airport.country },
    }));
  };

  const handlePassportCountryChange = (code: string) => {
    const country = COUNTRY_LIST.find(c => c.code === code);
    setForm(p => ({ ...p, passport: { ...p.passport, countryCode: code, country: country?.name || '' } }));
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

  // ── Warnings ───────────────────────────────────────────────────────────────
  const passportDaysLeft = profile?.passport?.expiry
    ? Math.floor((new Date(profile.passport.expiry).getTime() - Date.now()) / 86400000)
    : null;
  const passportWarning = passportDaysLeft !== null && passportDaysLeft < 180;

  const insDays = profile?.travelInsurance?.expiry
    ? Math.floor((new Date(profile.travelInsurance.expiry).getTime() - Date.now()) / 86400000)
    : null;
  const insWarning = insDays !== null && insDays < 30;

  const hasInsurance = profile?.travelInsurance?.provider || profile?.travelInsurance?.policyNumber;

  const homeAddressLines = profile?.homeLocation
    ? [
        profile.homeLocation.addressLine1,
        profile.homeLocation.addressLine2,
        profile.homeLocation.city,
        profile.homeLocation.postcode,
        profile.homeLocation.country,
      ].filter(Boolean)
    : [];

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
            <Button color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>

        {isOnboarding && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Welcome! Set your home location so TripMaster can route you to the airport and calculate adapters, currency, and timezone differences for every trip.
          </Alert>
        )}
        {saved && (
          <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>Profile saved successfully.</Alert>
        )}
        {!editing && passportWarning && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            Your passport expires in {passportDaysLeft} days.
            {passportDaysLeft! < 0 ? ' It has already expired.' : ' Most countries require 6 months validity.'}
          </Alert>
        )}
        {!editing && insWarning && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            Your travel insurance expires in {insDays} days.
          </Alert>
        )}

        {/* ════════════════ VIEW MODE ════════════════ */}
        {!editing && profile && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Personal</Typography>
              </Box>
              <Typography variant="body1">{profile.name}</Typography>
              <Typography variant="body2" color="text.secondary">{profile.email}</Typography>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HomeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Home</Typography>
              </Box>
              {profile.homeLocation?.countryCode ? (
                <Box>
                  {homeAddressLines.map((line, i) => (
                    <Typography key={i} variant={i === 0 ? 'body1' : 'body2'} color={i === 0 ? 'text.primary' : 'text.secondary'}>
                      {line}
                    </Typography>
                  ))}
                  {/* Map preview in view mode */}
                  {profile.homeLocation.coordinates ? (
                    <Box sx={{ mt: 2, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                      <img
                        src={staticMapUrl(profile.homeLocation.coordinates)}
                        alt="Home location map"
                        style={{ width: '100%', display: 'block' }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="warning" icon={<ErrorOutlineIcon />} sx={{ mt: 2 }} variant="outlined">
                      No coordinates — edit your profile and click "Locate address" to fix routing.
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                    {profile.homeLocation.electricalPlug && <Chip size="small" label={`🔌 ${profile.homeLocation.electricalPlug}`} variant="outlined" />}
                    {profile.homeLocation.currency && <Chip size="small" label={`💰 ${profile.homeLocation.currency} ${profile.homeLocation.currencySymbol}`} variant="outlined" />}
                    {profile.homeLocation.language && <Chip size="small" label={`🗣️ ${profile.homeLocation.language}`} variant="outlined" />}
                    {profile.homeLocation.timezone && <Chip size="small" label={`⏰ ${profile.homeLocation.timezone}`} variant="outlined" />}
                    {profile.homeLocation.emergency && <Chip size="small" label={`🚨 ${profile.homeLocation.emergency}`} variant="outlined" />}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FlightIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Preferred Airport</Typography>
              </Box>
              {profile.preferredAirport?.iata ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">{profile.preferredAirport.iata}</Typography>
                  <Box>
                    <Typography variant="body1">{profile.preferredAirport.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{profile.preferredAirport.city}, {profile.preferredAirport.country}</Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BadgeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Passport</Typography>
              </Box>
              {profile.passport?.countryCode ? (
                <Box>
                  <Typography variant="body1">{profile.passport.country}</Typography>
                  {profile.passport.expiry && (
                    <Typography variant="body2" color={passportWarning ? 'error' : 'text.secondary'} sx={{ mt: 0.5 }}>
                      Expires: {new Date(profile.passport.expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {passportWarning && ` ⚠️ (${passportDaysLeft} days)`}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HealthAndSafetyIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Travel Insurance</Typography>
              </Box>
              {hasInsurance ? (
                <Box>
                  {profile.travelInsurance.provider && <Typography variant="body1">{profile.travelInsurance.provider}</Typography>}
                  {profile.travelInsurance.policyNumber && <Typography variant="body2" color="text.secondary">Policy: {profile.travelInsurance.policyNumber}</Typography>}
                  {profile.travelInsurance.emergencyPhone && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>📞 {profile.travelInsurance.emergencyPhone}</Typography>}
                  {profile.travelInsurance.expiry && (
                    <Typography variant="body2" color={insWarning ? 'error' : 'text.secondary'} sx={{ mt: 0.5 }}>
                      Expires: {new Date(profile.travelInsurance.expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {insWarning && ` ⚠️ (${insDays} days)`}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3 }}>
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

        {/* ════════════════ EDIT FORM ════════════════ */}
        {editing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Personal */}
            <Paper sx={{ p: 3 }}>
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

            {/* Home Location */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <HomeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Home location</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2.5 }}>
                Used to route you from home to your departure airport
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Address line 1"
                  value={form.homeLocation.addressLine1}
                  onChange={e => updateAddressField('addressLine1', e.target.value)}
                  fullWidth
                  placeholder="e.g. 8 Main Street"
                />
                <TextField
                  label="Address line 2 (optional)"
                  value={form.homeLocation.addressLine2}
                  onChange={e => updateAddressField('addressLine2', e.target.value)}
                  fullWidth
                  placeholder="e.g. Apartment No. 1"
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="City"
                    value={form.homeLocation.city}
                    onChange={e => updateAddressField('city', e.target.value)}
                    fullWidth
                    placeholder="e.g. Howth"
                  />
                  <TextField
                    label="Postcode"
                    value={form.homeLocation.postcode}
                    onChange={e => updateAddressField('postcode', e.target.value)}
                    sx={{ width: 160 }}
                    placeholder="e.g. D13 T1F3"
                  />
                </Box>
                <FormControl fullWidth required>
                  <InputLabel>Country</InputLabel>
                  <Select
                    value={form.homeLocation.countryCode}
                    label="Country"
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

                {/* Locate button + map preview */}
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={geocoding ? <CircularProgress size={16} /> : <MyLocationIcon />}
                    onClick={geocodeAddress}
                    disabled={geocoding || !form.homeLocation.addressLine1 || !form.homeLocation.city}
                    fullWidth
                  >
                    {geocoding ? 'Locating...' : form.homeLocation.coordinates ? 'Re-locate address' : 'Locate address on map'}
                  </Button>

                  {geocodeError && (
                    <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mt: 1.5 }}>
                      {geocodeError}
                    </Alert>
                  )}

                  {form.homeLocation.coordinates && !geocodeError && (
                    <Box sx={{ mt: 1.5 }}>
                      <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1 }}>
                        Address located — confirm the pin looks correct below.
                      </Alert>
                      <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'success.main' }}>
                        <img
                          src={staticMapUrl(form.homeLocation.coordinates)}
                          alt="Address location preview"
                          style={{ width: '100%', display: 'block' }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {form.homeLocation.coordinates.lat.toFixed(5)}, {form.homeLocation.coordinates.lng.toFixed(5)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {form.homeLocation.countryCode && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {form.homeLocation.electricalPlug && <Chip size="small" label={`🔌 ${form.homeLocation.electricalPlug}`} color="primary" variant="outlined" />}
                    {form.homeLocation.currency && <Chip size="small" label={`💰 ${form.homeLocation.currency}`} color="primary" variant="outlined" />}
                    {form.homeLocation.language && <Chip size="small" label={`🗣️ ${form.homeLocation.language}`} color="primary" variant="outlined" />}
                    {form.homeLocation.timezone && <Chip size="small" label={`⏰ ${form.homeLocation.timezone}`} color="primary" variant="outlined" />}
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Preferred Airport */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <FlightIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Preferred Airport</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Your usual departure airport — used as the default when creating trips
              </Typography>
              <AirportSearch
                label="Preferred departure airport"
                value={form.preferredAirport ? `${form.preferredAirport.iata} — ${form.preferredAirport.city}` : ''}
                onChange={handlePreferredAirportChange}
              />
              {form.preferredAirport && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {form.preferredAirport.name}
                </Typography>
              )}
            </Paper>

            {/* Passport */}
            <Paper sx={{ p: 3 }}>
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

            {/* Travel Insurance */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <HealthAndSafetyIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Travel Insurance</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Quick access to your policy details while travelling
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Insurance provider"
                  value={form.travelInsurance.provider}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, provider: e.target.value } }))}
                  fullWidth
                  placeholder="e.g. Allianz, AXA, Aviva"
                />
                <TextField
                  label="Policy number"
                  value={form.travelInsurance.policyNumber}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, policyNumber: e.target.value } }))}
                  fullWidth
                />
                <TextField
                  label="Emergency phone number"
                  value={form.travelInsurance.emergencyPhone}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, emergencyPhone: e.target.value } }))}
                  fullWidth
                  placeholder="e.g. +353 1 234 5678"
                />
                <TextField
                  label="Policy expiry date"
                  type="date"
                  value={form.travelInsurance.expiry ? form.travelInsurance.expiry.split('T')[0] : ''}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, expiry: e.target.value } }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Paper>

            {/* Preferences */}
            <Paper sx={{ p: 3 }}>
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