'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import theme from '@/theme';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <html lang="en">
<head>
  <title>Tabiji</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#6B7C5C" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
</head>
      <body>
        <SessionProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}