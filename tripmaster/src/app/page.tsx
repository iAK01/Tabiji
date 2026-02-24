import { Box, Typography, Button } from '@mui/material';
import { redirect } from 'next/navigation';


export default function Home() {
  redirect('/signin');
 return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <Typography variant="h3" color="text.primary" fontWeight={700}>
        Tabiji
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Your personal travel orchestration platform
      </Typography>
      <Button variant="contained" color="primary" size="large">
        Get Started
      </Button>
    </Box>
  );
}