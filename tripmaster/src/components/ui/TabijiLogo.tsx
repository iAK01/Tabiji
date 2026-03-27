'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const FONT  = '"Archivo Black", sans-serif';

// Teardrop location pin: circle body at top, tapered point at bottom
const PIN_PATH = 'M5,14 C2.5,10.5 0,8.5 0,5 A5,5,0,1,1,10,5 C10,8.5 7.5,10.5 5,14Z';

function Pin({
  color,
  delay,
  duration,
  visible,
  width,
  height,
  top,
}: {
  color: string;
  delay: number;
  duration: number;
  visible: boolean;
  width: string;
  height: string;
  top: string;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top,
        // Slight rightward nudge — optical centre of Archivo Black
        // narrow glyphs sits just right of the geometric span centre
        left: '52%',
        width,
        height,
        display: 'inline-block',
        lineHeight: 1,
        // Explicit stacking above the glyph content
        zIndex: 2,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-0.30em)',
        opacity: visible ? 1 : 0,
        transition: `
          opacity   180ms ease                                      ${delay}ms,
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
  pinTop,
}: {
  char: string;
  pinColor: string;
  delay: number;
  duration: number;
  visible: boolean;
  pinWidth: string;
  pinHeight: string;
  pinTop: string;
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
        top={pinTop}
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
      {/* "Tab" — plain */}
      Tab

      {/* First i — dotless ı, drops first */}
      <PinnedChar
        char="ı"
        pinColor={NAVY}
        delay={0}
        duration={460}
        visible={visible}
        pinWidth="0.16em"
        pinHeight="0.22em"
        pinTop="-0.07em"
      />

      {/*
        j — dotless ȷ (U+0237) eliminates the glyph dot entirely,
        so the terracotta pin sits clean with no dot underneath.
        Raised higher (pinTop: -0.22em) so the three pins form
        a chevron / mountain peak outline.
        Drops LAST — larger, featured colour, most impact.
      */}
      <PinnedChar
        char="ȷ"
        pinColor={TERRA}
        delay={460}
        duration={720}
        visible={visible}
        pinWidth="0.21em"
        pinHeight="0.29em"
        pinTop="-0.22em"
      />

      {/* Final i — dotless ı, drops second */}
      <PinnedChar
        char="ı"
        pinColor={NAVY}
        delay={220}
        duration={580}
        visible={visible}
        pinWidth="0.16em"
        pinHeight="0.22em"
        pinTop="-0.07em"
      />
    </Box>
  );
}
