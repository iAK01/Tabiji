'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Container, Typography, AppBar, Toolbar, IconButton, Button,
  Paper, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ArrowBackIcon          from '@mui/icons-material/ArrowBack';
import EditIcon               from '@mui/icons-material/Edit';
import CheckCircleIcon        from '@mui/icons-material/CheckCircle';
import WarningAmberIcon       from '@mui/icons-material/WarningAmber';
import PersonIcon             from '@mui/icons-material/Person';
import HomeIcon               from '@mui/icons-material/Home';
import BadgeIcon              from '@mui/icons-material/Badge';
import TuneIcon               from '@mui/icons-material/Tune';
import FlightIcon             from '@mui/icons-material/Flight';
import HealthAndSafetyIcon    from '@mui/icons-material/HealthAndSafety';
import MyLocationIcon         from '@mui/icons-material/MyLocation';
import ErrorOutlineIcon       from '@mui/icons-material/ErrorOutline';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import AttachMoneyIcon        from '@mui/icons-material/AttachMoney';
import LanguageIcon           from '@mui/icons-material/Language';
import AccessTimeIcon         from '@mui/icons-material/AccessTime';
import LocalPhoneIcon         from '@mui/icons-material/LocalPhone';
import SosIcon                from '@mui/icons-material/Sos';
import { COUNTRY_LIST, getCountryMeta } from '@/lib/data/countries';
import AirportSearch          from '@/components/ui/AirportSearch';
import PushNotificationSetup  from '@/components/notifications/PushNotificationSetup';
import { Airport }            from '@/lib/data/airports';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coordinates { lat: number; lng: number }

interface HomeLocation {
  addressLine1: string; addressLine2: string; city: string; postcode: string;
  country: string; countryCode: string; coordinates: Coordinates | null;
  timezone: string; currency: string; currencySymbol: string;
  electricalPlug: string; language: string; emergency: string;
}

interface UserProfile {
  name: string; email: string;
  homeLocation: HomeLocation;
  preferredAirport: { iata: string; name: string; city: string; country: string } | null;
  fallbackAirport:  { iata: string; name: string; city: string; country: string } | null;
  passport: { country: string; countryCode: string; expiry: string; number: string };
  travelInsurance: { provider: string; policyNumber: string; emergencyPhone: string; expiry: string };
  preferences: { units: 'metric' | 'imperial'; defaultTripType: 'work' | 'leisure' | 'mixed' };
}

const emptyProfile: UserProfile = {
  name: '', email: '',
  homeLocation: {
    addressLine1: '', addressLine2: '', city: '', postcode: '',
    country: '', countryCode: '', coordinates: null,
    timezone: '', currency: '', currencySymbol: '', electricalPlug: '', language: '', emergency: '',
  },
  preferredAirport: null,
  fallbackAirport:  null,
  passport: { country: '', countryCode: '', expiry: '', number: '' },
  travelInsurance: { provider: '', policyNumber: '', emergencyPhone: '', expiry: '' },
  preferences: { units: 'metric', defaultTripType: 'leisure' },
};

const REGIONS      = Array.from(new Set(COUNTRY_LIST.map(c => c.region)));
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

function staticMapUrl(coords: Coordinates) {
  const { lat, lng } = coords;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+c4714a(${lng},${lat})/${lng},${lat},14/600x200@2x?access_token=${MAPBOX_TOKEN}`;
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, caption, ghost: GhostIcon, children }: {
  icon:    React.ElementType;
  title:   string;
  caption?: string;
  ghost:   React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Paper sx={{
      p: 3, position: 'relative', overflow: 'hidden',
      backgroundColor: D.paper, border: `1px solid ${D.rule}`,
      borderRadius: 2, boxShadow: 'none',
    }}>
      {/* Ghost icon */}
      <Box sx={{
        position: 'absolute', bottom: -16, right: -12, pointerEvents: 'none',
        color: D.navy, opacity: 0.045, zIndex: 0,
      }}>
        <GhostIcon sx={{ fontSize: 120 }} />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: caption ? 0.5 : 2 }}>
          <Icon sx={{ fontSize: 18, color: D.green }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', color: D.navy, letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
        </Box>
        {caption && (
          <Typography sx={{ fontSize: '0.78rem', color: D.muted, mb: 2, fontFamily: D.body }}>
            {caption}
          </Typography>
        )}
        {children}
      </Box>
    </Paper>
  );
}

// ─── Country Select ───────────────────────────────────────────────────────────

function CountrySelect({ label, value, onChange }: {
  label: string; value: string; onChange: (code: string) => void;
}) {
  return (
    <FormControl fullWidth required>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={e => onChange(e.target.value)}>
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

// ─── Small meta chip ─────────────────────────────────────────────────────────

function MetaChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <Chip
      size="small"
      icon={<Icon sx={{ fontSize: '0.85rem !important', color: `${D.muted} !important` }} />}
      label={label}
      variant="outlined"
      sx={{
        fontFamily: D.body, fontSize: '0.72rem', height: 24,
        color: D.navy, borderColor: D.rule,
      }}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [form,         setForm]         = useState<UserProfile>(emptyProfile);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [geocoding,    setGeocoding]    = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const isOnboarding = !profile?.homeLocation?.countryCode;

  // Font injection
  useEffect(() => {
    if (!document.querySelector('#archivo-font')) {
      const link = document.createElement('link');
      link.id   = 'archivo-font';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    fetch('/api/user/profile').then(res => res.json()).then(data => {
      if (data.user) {
        const merged: UserProfile = {
          ...emptyProfile, ...data.user,
          homeLocation:    { ...emptyProfile.homeLocation,    ...data.user.homeLocation },
          passport:        { ...emptyProfile.passport,        ...data.user.passport },
          travelInsurance: { ...emptyProfile.travelInsurance, ...data.user.travelInsurance },
          preferences:     { ...emptyProfile.preferences,     ...data.user.preferences },
        };
        setProfile(merged);
        setForm(merged);
        if (!data.user.homeLocation?.countryCode) setEditing(true);
      }
      setLoading(false);
    });
  }, []);

  const geocodeAddress = useCallback(async () => {
    const { addressLine1, city, country } = form.homeLocation;
    if (!addressLine1 || !city || !country) {
      setGeocodeError('Fill in at least Address Line 1, City, and Country first.');
      return;
    }
    setGeocoding(true); setGeocodeError(null);
    const parts = [form.homeLocation.addressLine1, form.homeLocation.addressLine2,
      form.homeLocation.city, form.homeLocation.postcode, form.homeLocation.country].filter(Boolean).join(', ');
    try {
      const data = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(parts)}.json?limit=1&access_token=${MAPBOX_TOKEN}`).then(r => r.json());
      const feature = data.features?.[0];
      if (!feature) {
        setGeocodeError('Address not found — try adjusting the spelling or postcode.');
        setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, coordinates: null } }));
      } else {
        const [lng, lat] = feature.center;
        setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, coordinates: { lat, lng } } }));
      }
    } catch { setGeocodeError('Geocoding failed — check your connection and try again.'); }
    finally  { setGeocoding(false); }
  }, [form.homeLocation]);

  const updateAddressField = (field: keyof HomeLocation, value: string) => {
    setForm(p => ({ ...p, homeLocation: { ...p.homeLocation, [field]: value, coordinates: null } }));
    setGeocodeError(null);
  };

  const handleHomeCountryChange = (code: string) => {
    const country = COUNTRY_LIST.find(c => c.code === code);
    const meta    = getCountryMeta(code);
    setForm(p => ({
      ...p,
      homeLocation: {
        ...p.homeLocation, countryCode: code, country: country?.name || '',
        timezone: meta.timezone, currency: meta.currency, currencySymbol: meta.currencySymbol,
        electricalPlug: meta.electricalPlug, language: meta.language, emergency: meta.emergency,
        coordinates: null,
      },
    }));
    setGeocodeError(null);
  };

  const handlePassportCountryChange = (code: string) => {
    const country = COUNTRY_LIST.find(c => c.code === code);
    setForm(p => ({ ...p, passport: { ...p.passport, countryCode: code, country: country?.name || '' } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setProfile(form); setEditing(false); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const passportDaysLeft = profile?.passport?.expiry
    ? Math.floor((new Date(profile.passport.expiry).getTime() - Date.now()) / 86400000) : null;
  const passportWarning  = passportDaysLeft !== null && passportDaysLeft < 180;
  const insDays          = profile?.travelInsurance?.expiry
    ? Math.floor((new Date(profile.travelInsurance.expiry).getTime() - Date.now()) / 86400000) : null;
  const insWarning       = insDays !== null && insDays < 30;
  const hasInsurance     = profile?.travelInsurance?.provider || profile?.travelInsurance?.policyNumber;

  const homeAddressLines = profile?.homeLocation
    ? [profile.homeLocation.addressLine1, profile.homeLocation.addressLine2,
       profile.homeLocation.city, profile.homeLocation.postcode, profile.homeLocation.country].filter(Boolean)
    : [];

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
      <CircularProgress sx={{ color: D.green }} />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: D.bg }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: D.navy, boxShadow: 'none' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => router.push('/dashboard')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <PersonIcon sx={{ mr: 1.5, fontSize: 20 }} />
          <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', letterSpacing: '-0.01em', color: 'white', flexGrow: 1 }}>
            {isOnboarding ? 'Set up your profile' : 'My Profile'}
          </Typography>
          {!isOnboarding && !editing && (
            <Button
              color="inherit"
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => setEditing(true)}
              sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem' }}
            >
              Edit
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4, px: { xs: 2, sm: 3 } }}>

        {/* Alerts */}
        {isOnboarding && (
          <Alert severity="info" sx={{ mb: 3, fontFamily: D.body, borderRadius: 1.5 }}>
            Set your home location so Tabiji can route you to the airport and calculate adapters, currency, and timezone for every trip.
          </Alert>
        )}
        {saved && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3, fontFamily: D.body, borderRadius: 1.5 }}>
            Profile saved successfully.
          </Alert>
        )}
        {!editing && passportWarning && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, fontFamily: D.body, borderRadius: 1.5 }}>
            Your passport expires in {passportDaysLeft} days.
            {passportDaysLeft! < 0 ? ' It has already expired.' : ' Most countries require 6 months validity.'}
          </Alert>
        )}
        {!editing && insWarning && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, fontFamily: D.body, borderRadius: 1.5 }}>
            Your travel insurance expires in {insDays} days.
          </Alert>
        )}

        {/* ═══════════════ VIEW MODE ═══════════════ */}
        {!editing && profile && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            <SectionCard icon={PersonIcon} title="Personal" ghost={PersonIcon}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.15rem', color: D.navy, letterSpacing: '-0.01em' }}>
                {profile.name}
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body, mt: 0.25 }}>
                {profile.email}
              </Typography>
            </SectionCard>

            <PushNotificationSetup />

            <SectionCard icon={HomeIcon} title="Home" ghost={HomeIcon}>
              {profile.homeLocation?.countryCode ? (
                <Box>
                  {homeAddressLines.map((line, i) => (
                    <Typography key={i} sx={{
                      fontFamily: D.body,
                      fontSize: i === 0 ? '0.95rem' : '0.85rem',
                      fontWeight: i === 0 ? 600 : 400,
                      color: i === 0 ? D.navy : D.muted,
                      lineHeight: 1.5,
                    }}>
                      {line}
                    </Typography>
                  ))}
                  {profile.homeLocation.coordinates ? (
                    <Box sx={{ mt: 2, borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${D.rule}` }}>
                      <img src={staticMapUrl(profile.homeLocation.coordinates)} alt="Home location" style={{ width: '100%', display: 'block' }} />
                    </Box>
                  ) : (
                    <Alert severity="warning" icon={<ErrorOutlineIcon />} sx={{ mt: 2 }} variant="outlined">
                      No coordinates — edit and click "Locate address" to fix routing.
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                    {profile.homeLocation.electricalPlug && <MetaChip icon={ElectricalServicesIcon} label={profile.homeLocation.electricalPlug} />}
                    {profile.homeLocation.currency      && <MetaChip icon={AttachMoneyIcon}         label={`${profile.homeLocation.currency} ${profile.homeLocation.currencySymbol}`} />}
                    {profile.homeLocation.language      && <MetaChip icon={LanguageIcon}            label={profile.homeLocation.language} />}
                    {profile.homeLocation.timezone      && <MetaChip icon={AccessTimeIcon}          label={profile.homeLocation.timezone} />}
                    {profile.homeLocation.emergency     && <MetaChip icon={SosIcon}                 label={profile.homeLocation.emergency} />}
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body }}>Not set</Typography>
              )}
            </SectionCard>

            <SectionCard icon={FlightIcon} title="Preferred Airport" ghost={FlightIcon}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                {/* Primary */}
                {profile.preferredAirport?.iata ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontFamily: D.display, fontSize: '2rem', color: D.green, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {profile.preferredAirport.iata}
                    </Typography>
                    <Box>
                      <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 600, color: D.navy }}>
                        {profile.preferredAirport.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: D.muted, fontFamily: D.body }}>
                        {profile.preferredAirport.city}, {profile.preferredAirport.country}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body }}>Not set</Typography>
                )}

                {/* Fallback */}
                {profile.fallbackAirport?.iata && (
                  <>
                    <Typography sx={{ color: D.muted, fontSize: '1.1rem', lineHeight: 1 }}>·</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ fontFamily: D.display, fontSize: '2rem', color: D.muted, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {profile.fallbackAirport.iata}
                      </Typography>
                      <Box>
                        <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 600, color: D.navy }}>
                          {profile.fallbackAirport.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.82rem', color: D.muted, fontFamily: D.body }}>
                          {profile.fallbackAirport.city}, {profile.fallbackAirport.country} — fallback
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            </SectionCard>

            <SectionCard icon={BadgeIcon} title="Passport" ghost={BadgeIcon}>
              {profile.passport?.countryCode ? (
                <Box>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.95rem', fontWeight: 600, color: D.navy }}>
                    {profile.passport.country}
                  </Typography>
                  {profile.passport.expiry && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      {passportWarning && <WarningAmberIcon sx={{ fontSize: 15, color: D.terra }} />}
                      <Typography sx={{ fontSize: '0.85rem', color: passportWarning ? D.terra : D.muted, fontFamily: D.body }}>
                        Expires {new Date(profile.passport.expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {passportWarning && ` — ${passportDaysLeft} days`}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body }}>Not set</Typography>
              )}
            </SectionCard>

            <SectionCard icon={HealthAndSafetyIcon} title="Travel Insurance" ghost={HealthAndSafetyIcon}>
              {hasInsurance ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {profile.travelInsurance.provider && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.95rem', fontWeight: 600, color: D.navy }}>
                      {profile.travelInsurance.provider}
                    </Typography>
                  )}
                  {profile.travelInsurance.policyNumber && (
                    <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>
                      Policy: {profile.travelInsurance.policyNumber}
                    </Typography>
                  )}
                  {profile.travelInsurance.emergencyPhone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                      <LocalPhoneIcon sx={{ fontSize: 13, color: D.muted }} />
                      <Typography sx={{ fontSize: '0.85rem', color: D.muted, fontFamily: D.body }}>
                        {profile.travelInsurance.emergencyPhone}
                      </Typography>
                    </Box>
                  )}
                  {profile.travelInsurance.expiry && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {insWarning && <WarningAmberIcon sx={{ fontSize: 15, color: D.terra }} />}
                      <Typography sx={{ fontSize: '0.85rem', color: insWarning ? D.terra : D.muted, fontFamily: D.body }}>
                        Expires {new Date(profile.travelInsurance.expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {insWarning && ` — ${insDays} days`}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body }}>Not set</Typography>
              )}
            </SectionCard>

            <SectionCard icon={TuneIcon} title="Preferences" ghost={TuneIcon}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <MetaChip icon={AccessTimeIcon} label={profile.preferences?.units === 'imperial' ? 'Imperial' : 'Metric'} />
                {profile.preferences?.defaultTripType && (
                  <MetaChip icon={FlightIcon} label={`Default: ${profile.preferences.defaultTripType}`} />
                )}
              </Box>
            </SectionCard>

          </Box>
        )}

        {/* ═══════════════ EDIT MODE ═══════════════ */}
        {editing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Personal */}
            <SectionCard icon={PersonIcon} title="Personal" ghost={PersonIcon}>
              <TextField
                label="Full name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                fullWidth
                sx={{ '& input': { fontFamily: D.body } }}
              />
            </SectionCard>

            {/* Home Location */}
            <SectionCard icon={HomeIcon} title="Home location" ghost={HomeIcon}
              caption="Used to route you from home to your departure airport">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Address line 1" value={form.homeLocation.addressLine1}
                  onChange={e => updateAddressField('addressLine1', e.target.value)}
                  fullWidth placeholder="e.g. 8 Main Street"
                  sx={{ '& input': { fontFamily: D.body } }} />
                <TextField label="Address line 2 (optional)" value={form.homeLocation.addressLine2}
                  onChange={e => updateAddressField('addressLine2', e.target.value)}
                  fullWidth placeholder="e.g. Apartment No. 1"
                  sx={{ '& input': { fontFamily: D.body } }} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="City" value={form.homeLocation.city}
                    onChange={e => updateAddressField('city', e.target.value)}
                    fullWidth placeholder="e.g. Howth"
                    sx={{ '& input': { fontFamily: D.body } }} />
                  <TextField label="Postcode" value={form.homeLocation.postcode}
                    onChange={e => updateAddressField('postcode', e.target.value)}
                    sx={{ width: 160, '& input': { fontFamily: D.body } }} />
                </Box>
                <CountrySelect label="Country" value={form.homeLocation.countryCode} onChange={handleHomeCountryChange} />

                {/* Locate button */}
                <Button
                  variant="outlined"
                  startIcon={geocoding ? <CircularProgress size={15} /> : <MyLocationIcon />}
                  onClick={geocodeAddress}
                  disabled={geocoding || !form.homeLocation.addressLine1 || !form.homeLocation.city}
                  fullWidth
                  sx={{
                    fontFamily: D.body, fontWeight: 700,
                    borderColor: D.rule, color: D.navy,
                    '&:hover': { borderColor: D.green, color: D.green },
                  }}
                >
                  {geocoding ? 'Locating...' : form.homeLocation.coordinates ? 'Re-locate address' : 'Locate address on map'}
                </Button>

                {geocodeError && (
                  <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ borderRadius: 1.5 }}>
                    {geocodeError}
                  </Alert>
                )}

                {form.homeLocation.coordinates && !geocodeError && (
                  <Box>
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1, borderRadius: 1.5 }}>
                      Address located — confirm the pin looks correct.
                    </Alert>
                    <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${D.green}66` }}>
                      <img src={staticMapUrl(form.homeLocation.coordinates)} alt="Address preview" style={{ width: '100%', display: 'block' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: D.muted, mt: 0.5, fontFamily: D.body }}>
                      {form.homeLocation.coordinates.lat.toFixed(5)}, {form.homeLocation.coordinates.lng.toFixed(5)}
                    </Typography>
                  </Box>
                )}

                {form.homeLocation.countryCode && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {form.homeLocation.electricalPlug && <MetaChip icon={ElectricalServicesIcon} label={form.homeLocation.electricalPlug} />}
                    {form.homeLocation.currency       && <MetaChip icon={AttachMoneyIcon}        label={form.homeLocation.currency} />}
                    {form.homeLocation.language       && <MetaChip icon={LanguageIcon}           label={form.homeLocation.language} />}
                    {form.homeLocation.timezone       && <MetaChip icon={AccessTimeIcon}         label={form.homeLocation.timezone} />}
                  </Box>
                )}
              </Box>
            </SectionCard>

            {/* Preferred Airport */}
            <SectionCard icon={FlightIcon} title="Preferred Airport" ghost={FlightIcon}
              caption="Your usual departure airport — used as the default when creating trips">
              <AirportSearch
                label="Preferred departure airport"
                value={form.preferredAirport ? `${form.preferredAirport.iata} — ${form.preferredAirport.city}` : ''}
                onChange={(airport: Airport) => setForm(p => ({
                  ...p, preferredAirport: { iata: airport.iata, name: airport.name, city: airport.city, country: airport.country },
                }))}
              />
              {form.preferredAirport && (
                <Typography sx={{ fontSize: '0.78rem', color: D.muted, mt: 0.75, fontFamily: D.body }}>
                  {form.preferredAirport.name}
                </Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <AirportSearch
                  label="Fallback departure airport"
                  value={form.fallbackAirport ? `${form.fallbackAirport.iata} — ${form.fallbackAirport.city}` : ''}
                  onChange={(airport: Airport) => setForm(p => ({
                    ...p, fallbackAirport: { iata: airport.iata, name: airport.name, city: airport.city, country: airport.country },
                  }))}
                />
                {form.fallbackAirport && (
                  <Typography sx={{ fontSize: '0.78rem', color: D.muted, mt: 0.75, fontFamily: D.body }}>
                    {form.fallbackAirport.name} — shown as a second flight-search row in quick links
                  </Typography>
                )}
              </Box>
            </SectionCard>

            {/* Passport */}
            <SectionCard icon={BadgeIcon} title="Passport" ghost={BadgeIcon}
              caption="Used to warn you when your passport is expiring before a trip">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CountrySelect label="Passport country" value={form.passport.countryCode} onChange={handlePassportCountryChange} />
                <TextField label="Passport expiry date" type="date"
                  value={form.passport.expiry ? form.passport.expiry.split('T')[0] : ''}
                  onChange={e => setForm(p => ({ ...p, passport: { ...p.passport, expiry: e.target.value } }))}
                  fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Passport number (optional)" value={form.passport.number}
                  onChange={e => setForm(p => ({ ...p, passport: { ...p.passport, number: e.target.value } }))}
                  fullWidth sx={{ '& input': { fontFamily: D.body } }} />
              </Box>
            </SectionCard>

            {/* Travel Insurance */}
            <SectionCard icon={HealthAndSafetyIcon} title="Travel Insurance" ghost={HealthAndSafetyIcon}
              caption="Quick access to your policy details while travelling">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Insurance provider" value={form.travelInsurance.provider}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, provider: e.target.value } }))}
                  fullWidth placeholder="e.g. Allianz, AXA, Aviva"
                  sx={{ '& input': { fontFamily: D.body } }} />
                <TextField label="Policy number" value={form.travelInsurance.policyNumber}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, policyNumber: e.target.value } }))}
                  fullWidth sx={{ '& input': { fontFamily: D.body } }} />
                <TextField label="Emergency phone number" value={form.travelInsurance.emergencyPhone}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, emergencyPhone: e.target.value } }))}
                  fullWidth placeholder="e.g. +353 1 234 5678"
                  sx={{ '& input': { fontFamily: D.body } }} />
                <TextField label="Policy expiry date" type="date"
                  value={form.travelInsurance.expiry ? form.travelInsurance.expiry.split('T')[0] : ''}
                  onChange={e => setForm(p => ({ ...p, travelInsurance: { ...p.travelInsurance, expiry: e.target.value } }))}
                  fullWidth InputLabelProps={{ shrink: true }} />
              </Box>
            </SectionCard>

            {/* Preferences */}
            <SectionCard icon={TuneIcon} title="Preferences" ghost={TuneIcon}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.06em', color: D.muted, mb: 1.25 }}>
                    Units
                  </Typography>
                  <ToggleButtonGroup value={form.preferences.units} exclusive
                    onChange={(_, val) => val && setForm(p => ({ ...p, preferences: { ...p.preferences, units: val } }))}>
                    <ToggleButton value="metric"   size="small" sx={{ fontFamily: D.body, textTransform: 'none', fontWeight: 600 }}>Metric (°C, km)</ToggleButton>
                    <ToggleButton value="imperial" size="small" sx={{ fontFamily: D.body, textTransform: 'none', fontWeight: 600 }}>Imperial (°F, miles)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.06em', color: D.muted, mb: 1.25 }}>
                    Default trip type
                  </Typography>
                  <ToggleButtonGroup value={form.preferences.defaultTripType} exclusive
                    onChange={(_, val) => val && setForm(p => ({ ...p, preferences: { ...p.preferences, defaultTripType: val } }))}>
                    <ToggleButton value="leisure" size="small" sx={{ fontFamily: D.body, textTransform: 'none', fontWeight: 600 }}>Leisure</ToggleButton>
                    <ToggleButton value="work"    size="small" sx={{ fontFamily: D.body, textTransform: 'none', fontWeight: 600 }}>Work</ToggleButton>
                    <ToggleButton value="mixed"   size="small" sx={{ fontFamily: D.body, textTransform: 'none', fontWeight: 600 }}>Mixed</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>
            </SectionCard>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pb: 4 }}>
              {!isOnboarding && (
                <Button
                  onClick={() => setEditing(false)}
                  sx={{
                    fontFamily: D.body, fontWeight: 700, color: D.muted,
                    border: `1px solid ${D.rule}`, px: 3,
                    '&:hover': { borderColor: D.navy, color: D.navy },
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !form.homeLocation.countryCode}
                sx={{
                  fontFamily: D.body, fontWeight: 800, px: 4,
                  backgroundColor: D.terra,
                  '&:hover':    { backgroundColor: '#b5633e' },
                  '&:disabled': { backgroundColor: D.rule, color: D.muted },
                }}
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