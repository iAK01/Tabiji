'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const FONT  = '"Archivo Black", sans-serif';

const PIN_PATH = 'M5,14 C2.5,10.5 0,8.5 0,5 A5,5,0,1,1,10,5 C10,8.5 7.5,10.5 5,14Z';

// With lineHeight 0.88 on the parent, each PinnedChar span is 0.88em tall,
// with its bottom edge at the text baseline.
// The j/i dot centre sits ~0.12em below the span's top edge.

function Pin({
  color, delay, duration, visible, width, height, top,
}: {
  color: string; delay: number; duration: number;
  visible: boolean; width: string; height: string; top: string;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top,
        left: '52%',
        width,
        height,
        display: 'inline-block',
        lineHeight: 1,
        zIndex: 2,                          // above dot mask (z:1) and text (z:0)
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-0.30em)',
        opacity: visible ? 1 : 0,
        transition: `
          opacity   180ms ease                                       ${delay}ms,
          transform ${duration}ms cubic-bezier(0.34, 1.18, 0.64, 1) ${delay}ms
        `,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg"
           style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d={PIN_PATH} fill={color} />
        <circle cx="5" cy="4.5" r="2" fill="rgba(255,255,255,0.30)" />
      </svg>
    </Box>
  );
}

// For the regular "j": the glyph renders its own dot.
// We cover it with an opaque terracotta circle (the dot mask) that sits
// at the exact dot position, then the raised pin sits above it.
// isolation: isolate on the wrapper guarantees the absolute children
// stack above the glyph text within their own stacking context.
function DotMask({
  visible, delay,
}: {
  visible: boolean; delay: number;
}) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        // Centre of j dot is ~0.12em from span top; translate(-50%,-50%)
        // pulls the element's own centre to that coordinate.
        top: '0.12em',
        left: '52%',
        width: '0.14em',
        height: '0.14em',
        borderRadius: '50%',
        backgroundColor: TERRA,
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        opacity: visible ? 1 : 0,
        transition: `opacity 180ms ease ${delay}ms`,
        pointerEvents: 'none',
      }}
    />
  );
}

function PinnedChar({
  char, pinColor, delay, duration, visible,
  pinWidth, pinHeight, pinTop, hasDotMask = false,
}: {
  char: string; pinColor: string; delay: number; duration: number;
  visible: boolean; pinWidth: string; pinHeight: string; pinTop: string;
  hasDotMask?: boolean;
}) {
  return (
    // isolation: isolate creates a stacking context so the absolute children
    // (dot mask z:1, pin z:2) always paint above the glyph text.
    <Box component="span" sx={{ position: 'relative', display: 'inline-block', isolation: 'isolate' }}>
      {char}
      {hasDotMask && <DotMask visible={visible} delay={delay} />}
      <Pin
        color={pinColor} delay={delay} duration={duration} visible={visible}
        width={pinWidth} height={pinHeight} top={pinTop}
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
        { fontFamily: FONT, letterSpacing: '-0.04em', lineHeight: 0.88,
          color: NAVY, display: 'inline-block', userSelect: 'none' },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      Tab

      {/* First i — dotless ı, navy pin, drops first */}
      <PinnedChar
        char="ı" pinColor={NAVY}
        delay={0} duration={460} visible={visible}
        pinWidth="0.16em" pinHeight="0.22em" pinTop="-0.07em"
      />

      {/*
        j — regular glyph (correct kerning).
        hasDotMask covers the j's navy dot with a terracotta circle at 0.12em.
        Pin top at -0.22em, height 0.34em → tip lands at exactly 0.12em
        (meeting the dot mask), while the pin circle sits well above the letter
        to create the mountain-peak / chevron silhouette.
        Drops LAST — featured colour, largest pin, most impact.
      */}
      <PinnedChar
        char="j" pinColor={TERRA} hasDotMask
        delay={460} duration={720} visible={visible}
        pinWidth="0.20em" pinHeight="0.34em" pinTop="-0.22em"
      />

      {/* Final i — dotless ı, navy pin, drops second */}
      <PinnedChar
        char="ı" pinColor={NAVY}
        delay={220} duration={580} visible={visible}
        pinWidth="0.16em" pinHeight="0.22em" pinTop="-0.07em"
      />
    </Box>
  );
}
