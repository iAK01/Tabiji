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
  duration,
  visible,
  width,
  height,
}: {
  color: string;
  delay: number;
  duration: number;
  visible: boolean;
  width: string;
  height: string;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        // top: '-0.07em' places the pin so its body sits right at the tittle zone.
        // Larger j pin (greater height) extends further down, covering the j dot.
        top: '-0.07em',
        left: '50%',
        width,
        height,
        display: 'inline-block',
        lineHeight: 1,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-0.25em)',
        opacity: visible ? 1 : 0,
        transition: `
          opacity  180ms ease                                     ${delay}ms,
          transform ${duration}ms cubic-bezier(0.34, 1.18, 0.64, 1) ${delay}ms
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
        {/* subtle inner highlight */}
        <circle cx="5" cy="4.5" r="2" fill="rgba(255,255,255,0.30)" />
      </svg>
    </Box>
  );
}

function PinnedChar({
  char,
  pinColor,
  delay,
  duration,
  visible,
  pinWidth,
  pinHeight,
}: {
  char: string;
  pinColor: string;
  delay: number;
  duration: number;
  visible: boolean;
  pinWidth: string;
  pinHeight: string;
}) {
  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
      {char}
      <Pin
        color={pinColor}
        delay={delay}
        duration={duration}
        visible={visible}
        width={pinWidth}
        height={pinHeight}
      />
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
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {/* "Tab" — plain, no pins */}
      Tab

      {/* first i → dotless ı, navy, drops fastest */}
      <PinnedChar
        char="ı"
        pinColor={NAVY}
        delay={0}
        duration={460}
        visible={visible}
        pinWidth="0.17em"
        pinHeight="0.24em"
      />

      {/* j → featured pin, terracotta, slightly larger, drops second */}
      <PinnedChar
        char="j"
        pinColor={TERRA}
        delay={200}
        duration={580}
        visible={visible}
        pinWidth="0.20em"
        pinHeight="0.29em"
      />

      {/* final i → dotless ı, navy, drops slowest */}
      <PinnedChar
        char="ı"
        pinColor={NAVY}
        delay={420}
        duration={720}
        visible={visible}
        pinWidth="0.17em"
        pinHeight="0.24em"
      />
    </Box>
  );
}
