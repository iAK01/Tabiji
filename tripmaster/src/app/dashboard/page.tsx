'use client';

import { useSession } from 'next-auth/react';
import { Box, Typography, Button, Grid, Card, CardContent, CardActions, Chip, Container, AppBar, Toolbar, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut } from 'next-auth/react';
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

const statusColours: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success'> = {
  idea: 'default',
  planning: 'warning',
  confirmed: 'primary',
  active: 'success',
  completed: 'default',
  cancelled: 'error',
};

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => { setTrips(data.trips || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Nav */}
      <AppBar position="static" sx={{ backgroundColor: 'text.primary' }}>
        <Toolbar>
          <FlightTakeoffIcon sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            Tabiji
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
            {session?.user?.name}
          </Typography>
          <IconButton color="inherit" onClick={() => signOut({ callbackUrl: '/signin' })}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} color="text.primary">
              My Trips
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'} planned
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
              variant="outlined"
              onClick={() => router.push('/profile')}
            >
              Profile
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push('/packing/catalogue')}
            >
              Packing Catalogue
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="large"
              onClick={() => router.push('/trips/new')}
            >
              Plan a Trip
            </Button>
          </Box>
        </Box>

        {/* Empty State */}
        {!loading && trips.length === 0 && (
          <Box sx={{
            textAlign: 'center', py: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <FlightTakeoffIcon sx={{ fontSize: 80, color: 'primary.main', opacity: 0.4 }} />
            <Typography variant="h5" color="text.primary" fontWeight={600}>
              No trips yet
            </Typography>
            <Typography variant="body1" color="text.secondary" maxWidth={400}>
              Start planning your next adventure — add flights, accommodation, a day-by-day itinerary, and a smart packing list.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="large"
              onClick={() => router.push('/trips/new')}
            >
              Plan your first trip
            </Button>
          </Box>
        )}

        {/* Trip Cards */}
        <Grid container spacing={3}>
          {trips.map(trip => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={trip._id}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  backgroundColor: 'background.paper',
                }}
                onClick={() => router.push(`/trips/${trip._id}`)}
              >
                {trip.coverPhotoThumb ? (
                  <Box sx={{
                    height: 140,
                    backgroundImage: `url(${trip.coverPhotoThumb})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }} />
                ) : (
                  <Box sx={{
                    height: 140,
                    backgroundColor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FlightTakeoffIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                  </Box>
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      {trip.name}
                    </Typography>
                    <Chip
                      label={trip.status}
                      color={statusColours[trip.status]}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body1" color="secondary.main" fontWeight={500}>
                    {trip.destination?.city}, {trip.destination?.country}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {trip.nights} nights · {trip.tripType}
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button size="small" color="primary">View trip</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}