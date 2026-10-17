'use client';

import { Component, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';

// Contains a lazily-loaded section whose code couldn't be fetched (offline and never
// downloaded) so it fails in place instead of taking the whole page down.
export default class OfflineBoundary extends Component<{ message: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'rgba(44,62,80,0.55)' }}>
        <CloudOffIcon />
        <Typography sx={{ fontFamily: '"Archivo", "Inter", sans-serif', fontSize: '0.9rem' }}>
          {this.props.message}
        </Typography>
      </Box>
    );
  }
}
