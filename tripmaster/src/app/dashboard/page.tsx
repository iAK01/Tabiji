'use client';

import { useSession, signOut } from 'next-auth/react';
import {
  Box, Typography, Button, Card, CardContent, Chip,
  Container, AppBar, Toolbar, IconButton, Avatar, Skeleton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import BackpackIcon from '@mui/icons-material/Backpack';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Trip {
  _id: string;
  name: string;
  destination: { city: string; country: string };
  startDate: string;
  endDate: string;
  nights: number;
  tripType: string;
  status: string;
  coverPhotoThumb?: string;
}

const STATUS_COLOURS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default',
  planning: 'warning',
  confirmed: 'primary',
  active: 'success',
  completed: 'default',
  cancelled: 'error',
};

const TRIP_TYPE_EMOJI: Record<string, string> = {
  leisure: '🏖️', work: '💼', mixed: '✈️',
};

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(d => { setTrips(d.trips ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 10 }}>

      {/* ── AppBar ── */}
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }} elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <FlightTakeoffIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 24 } }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Tabiji
          </Typography>
          {/* Avatar shows name on desktop, icon on mobile */}
          <Typography variant="body2" sx={{ mr: 1.5, opacity: 0.8, display: { xs: 'none', sm: 'block' } }}>
            {session?.user?.name}
          </Typography>
          <IconButton
            color="inherit"
            size="small"
            onClick={() => router.push('/profile')}
            sx={{ mr: 0.5 }}
          >
            <Avatar
              src={session?.user?.image ?? undefined}
              sx={{ width: 30, height: 30, fontSize: '0.8rem', backgroundColor: 'primary.main' }}
            >
              {firstName[0]}
            </Avatar>
          </IconButton>
          <IconButton color="inherit" size="small" onClick={() => signOut({ callbackUrl: '/signin' })}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>

        {/* ── Hero header ── */}
        <Box sx={{ pt: { xs: 3, sm: 4 }, pb: { xs: 2, sm: 3 } }}>
          <Typography
            variant="h4"
            fontWeight={800}
            color="text.primary"
            sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
          >
            My Trips
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {loading ? '...' : `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} planned`}
          </Typography>
        </Box>

        {/* ── Action buttons ── */}
        <Box sx={{
          display: 'flex', gap: 1.5, mb: 3,
          flexDirection: { xs: 'column', sm: 'row' },
        }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="large"
            onClick={() => router.push('/trips/new')}
            fullWidth
            sx={{ fontWeight: 700, py: { xs: 1.5, sm: 1 } }}
          >
            Plan a Trip
          </Button>
          <Button
            variant="outlined"
            startIcon={<BackpackIcon />}
            onClick={() => router.push('/packing/catalogue')}
            fullWidth
            sx={{ py: { xs: 1.25, sm: 1 } }}
          >
            Packing Catalogue
          </Button>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={() => router.push('/profile')}
            fullWidth
            sx={{ py: { xs: 1.25, sm: 1 } }}
          >
            Profile
          </Button>
        </Box>

        {/* ── Skeleton loading ── */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2].map(i => (
              <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        )}

        {/* ── Empty state ── */}
        {!loading && trips.length === 0 && (
          <Box sx={{
            textAlign: 'center', py: { xs: 8, sm: 12 },
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5,
          }}>
            <FlightTakeoffIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
            <Typography variant="h5" fontWeight={700}>No trips yet</Typography>
            <Typography variant="body2" color="text.secondary" maxWidth={320}>
              Plan your next adventure — flights, hotels, day-by-day itinerary, and a smart packing list.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} size="large" onClick={() => router.push('/trips/new')}>
              Plan your first trip
            </Button>
          </Box>
        )}

        {/* ── Trip cards ── */}
        <Box sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
        }}>
          {trips.map(trip => {
            const daysUntil = trip.startDate
              ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <Card
                key={trip._id}
                onClick={() => router.push(`/trips/${trip._id}`)}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  '&:active': { transform: 'scale(0.99)' },
                }}
              >
                {/* Cover photo */}
                <Box sx={{
                  height: { xs: 160, sm: 140 },
                  backgroundImage: trip.coverPhotoThumb ? `url(${trip.coverPhotoThumb})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: trip.coverPhotoThumb ? undefined : 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  {!trip.coverPhotoThumb && (
                    <FlightTakeoffIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                  )}
                  {/* Status chip overlay */}
                  <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                    <Chip
                      label={trip.status}
                      color={STATUS_COLOURS[trip.status]}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </Box>
                  {/* Days until */}
                  {daysUntil !== null && daysUntil > 0 && (
                    <Box sx={{
                      position: 'absolute', bottom: 10, left: 10,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      borderRadius: 2, px: 1.25, py: 0.4,
                    }}>
                      <Typography sx={{ color: 'white', fontSize: '0.72rem', fontWeight: 700 }}>
                        {daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days away`}
                      </Typography>
                    </Box>
                  )}
                  {daysUntil !== null && daysUntil === 0 && (
                    <Box sx={{
                      position: 'absolute', bottom: 10, left: 10,
                      backgroundColor: 'success.main',
                      borderRadius: 2, px: 1.25, py: 0.4,
                    }}>
                      <Typography sx={{ color: 'white', fontSize: '0.72rem', fontWeight: 700 }}>
                        Today! ✈️
                      </Typography>
                    </Box>
                  )}
                </Box>

                <CardContent sx={{ p: { xs: 2, sm: 2 }, '&:last-child': { pb: 2 } }}>
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, mb: 0.5 }}>
                    {trip.name}
                  </Typography>
                  <Typography variant="body2" color="secondary.main" fontWeight={600}>
                    {trip.destination?.city}, {trip.destination?.country}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {trip.startDate
                          ? new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {trip.nights} nights · {TRIP_TYPE_EMOJI[trip.tripType] ?? ''} {trip.tripType}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      View →
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

      </Container>
    </Box>
  );
}