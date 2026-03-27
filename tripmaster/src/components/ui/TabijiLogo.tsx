'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const FONT  = '"Archivo Black", sans-serif';

// Teardrop location pin: circle body at top, tapered point at bottom
// viewBox 0 0 10 14 — 10 units wide, 14 units tall
const PIN_PATH = 'M5,14 C2.5,10.5 0,8.5 0,5 A5,5,0,1,1,10,5 C10,8.5 7.5,10.5 5,14Z';

function Pin({
  color,
  delay,
  visible,
}: {
  color: string;
  delay: number;
  visible: boolean;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        // Sits just above the letter cap, where the tittle lives.
        // pin height ~0.20em, positioned so its tip covers the dot zone.
        top: '-0.07em',
        left: '50%',
        width: '0.14em',
        height: '0.20em',
        display: 'inline-block',
        lineHeight: 1,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-0.22em)',
        opacity: visible ? 1 : 0,
        transition: `
          opacity  200ms ease                                   ${delay}ms,
          transform 520ms cubic-bezier(0.34, 1.22, 0.64, 1)   ${delay}ms
        `,
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 10 14"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <path d={PIN_PATH} fill={color} />
        {/* subtle inner highlight — gives the pin a little depth */}
        <circle cx="5" cy="4.5" r="2" fill="rgba(255,255,255,0.30)" />
      </svg>
    </Box>
  );
}

function PinnedChar({
  char,
  pinColor,
  delay,
  visible,
}: {
  char: string;
  pinColor: string;
  delay: number;
  visible: boolean;
}) {
  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
      {char}
      <Pin color={pinColor} delay={delay} visible={visible} />
    </Box>
  );
}

export interface TabijiLogoProps {
  sx?: SxProps<Theme>;
}

export default function TabijiLogo({ sx }: TabijiLogoProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      component="span"
      sx={[
        {
          fontFamily: FONT,
          letterSpacing: '-0.04em',
          lineHeight: 0.88,
          color: NAVY,
          display: 'inline-block',
          userSelect: 'none',
        },
        // Merge caller sx — supports both object and array forms
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {/* "Tab" — plain, no pins */}
      Tab

      {/* first  i → dotless ı, navy pin, drop first */}
      <PinnedChar char="ı" pinColor={NAVY}  delay={0}   visible={visible} />

      {/* j → pin covers the dot; terracotta accent, drops second */}
      <PinnedChar char="j" pinColor={TERRA} delay={180} visible={visible} />

      {/* final  i → dotless ı, navy pin, drops last */}
      <PinnedChar char="ı" pinColor={NAVY}  delay={360} visible={visible} />
    </Box>
  );
}
