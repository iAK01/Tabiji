import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6B7C5C',       // Moss Green
    },
    secondary: {
      main: '#C4714A',       // Terracotta
    },
    background: {
      default: '#F5F0E8',    // Warm Off-White
      paper: '#FDFAF5',      // Warm White
    },
    text: {
      primary: '#2C3E50',    // Deep Navy
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;