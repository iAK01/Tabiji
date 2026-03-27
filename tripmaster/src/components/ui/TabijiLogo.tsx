'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const BG    = '#F5F0E8';   // page background — used to erase the j dot in SVG
const FONT  = '"Archivo Black", sans-serif';
const PIN_PATH = 'M5,14 C2.5,10.5 0,8.5 0,5 A5,5,0,1,1,10,5 C10,8.5 7.5,10.5 5,14Z';

// dotless ı (U+0131) for i — keeps correct Archivo Black spacing.
// Regular j retained — its dot is erased in the SVG overlay layer.
const WORD = 'Tab\u0131j\u0131';

// Strategy: render "Tabıjı" as ordinary HTML text (preserves perfect typography
// and kerning). Lay an absolutely-positioned SVG sibling on top — as a
// positioned element it is definitively above the static text in CSS paint
// order, no z-index fighting. Inside the SVG: erase the j dot with a
// background-coloured circle, then draw the three pins. SVG paint order is
// deterministic — later elements always cover earlier ones, full stop.

interface CharPos { x: number; y: number; w: number; h: number; }
interface Layout {
  svgW: number; svgH: number; em: number;
  i1: CharPos; j: CharPos; i2: CharPos;
}

// Render a single pin as a scaled <g> with CSS transition.
// CSS transform on SVG <g> is supported in all modern browsers.
function Pin({
  cx, tipY, pinW, pinH, color, visible, delay, duration,
}: {
  cx: number; tipY: number; pinW: number; pinH: number;
  color: string; visible: boolean; delay: number; duration: number;
}) {
  const sx  = pinW / 10;
  const sy  = pinH / 14;
  const x0  = cx - pinW / 2;
  const y0  = tipY - pinH;        // resting y (tip at tipY)
  const y0h = y0 - pinH * 1.2;   // launch y (above resting, hidden)

  return (
    <g
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible
          ? `translate(${x0}px, ${y0}px) scale(${sx}, ${sy})`
          : `translate(${x0}px, ${y0h}px) scale(${sx}, ${sy})`,
        transition: [
          `opacity 180ms ease ${delay}ms`,
          `transform ${duration}ms cubic-bezier(0.34, 1.18, 0.64, 1) ${delay}ms`,
        ].join(', '),
      }}
    >
      <path d={PIN_PATH} fill={color} />
      <circle cx="5" cy="4.5" r="2" fill="rgba(255,255,255,0.30)" />
    </g>
  );
}

export interface TabijiLogoProps {
  sx?: SxProps<Theme>;
  bgColor?: string;  // background behind the logo — used for j dot eraser
}

export default function TabijiLogo({ sx, bgColor = BG }: TabijiLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef      = useRef<HTMLSpanElement>(null);
  const [layout,  setLayout]  = useState<Layout | null>(null);
  const [visible, setVisible] = useState(false);

  // ── Measure character positions via DOM Range API ──────────────────────
  // Range.getBoundingClientRect() gives us the exact painted rect of each
  // character in the rendered font — no guesswork, no em arithmetic.
  const measure = useCallback(() => {
    const container = containerRef.current;
    const textEl    = textRef.current;
    if (!container || !textEl) return;

    const textNode = textEl.childNodes[0];
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0) return;

    const charPos = (start: number, end: number): CharPos => {
      const r = document.createRange();
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
      const b = r.getBoundingClientRect();
      return {
        x: b.left - cRect.left,
        y: b.top  - cRect.top,
        w: b.width,
        h: b.height,
      };
    };

    // WORD = "Tabıjı"  →  T=0  a=1  b=2  ı=3  j=4  ı=5
    const i1 = charPos(3, 4);
    const j  = charPos(4, 5);
    const i2 = charPos(5, 6);

    // Read the actual computed font-size directly — far more reliable than
    // dividing the container height by the lineHeight assumption.
    const em = parseFloat(window.getComputedStyle(textEl).fontSize);

    setLayout({ svgW: cRect.width, svgH: cRect.height, em, i1, j, i2 });
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => {
      measure();
      requestAnimationFrame(measure); // second pass once glyphs are painted
    });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  // ── Pin geometry ────────────────────────────────────────────────────────
  const renderOverlay = () => {
    if (!layout) return null;
    const { svgW, svgH, em, i1, j, i2 } = layout;

    // Pin sizes
    const iPinW = em * 0.16;
    const iPinH = em * 0.22;
    const jPinW = em * 0.21;
    const jPinH = em * 0.40;   // taller → circle sits higher → mountain peak

    // ── Vertical anchor from the measured j glyph ───────────────────────
    // j.y  = top of j bounding rect   = top of the j dot (can be negative:
    //        the dot overhangs above the CSS line-box with lineHeight 0.88)
    // j.h  = full glyph height        = dot-top to descender-bottom
    //
    // The j dot occupies roughly the top 10–12 % of j.h.
    // We place the pin TIPS just at the bottom edge of that dot zone so the
    // pin body rises cleanly above it.  All three tips share the same tipY
    // so the mountain-peak shape comes entirely from the j pin being taller.
    const tipY = j.y + j.h * 0.12;

    // Eraser: a filled rect that blots out the j dot with the page background.
    // Anchored directly to j's measured bounds — no em arithmetic needed.
    // Always visible once the layout is measured (no opacity animation) so
    // there is never a frame where the dot shows through.
    const eraseX = j.x - 2;
    const eraseY = j.y;
    const eraseW = j.w + 4;
    const eraseH = j.h * 0.14;   // covers the full dot area with a little margin

    return (
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: svgW, height: svgH,
          overflow: 'visible', pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* j dot eraser — always on, positioned from measured glyph bounds */}
        <rect
          x={eraseX} y={eraseY}
          width={eraseW} height={eraseH}
          fill={bgColor}
        />

        {/* First ı — navy, drops first */}
        <Pin
          cx={i1.x + i1.w / 2} tipY={tipY}
          pinW={iPinW} pinH={iPinH}
          color={NAVY} visible={visible} delay={0} duration={460}
        />

        {/* Last ı — navy, drops second */}
        <Pin
          cx={i2.x + i2.w / 2} tipY={tipY}
          pinW={iPinW} pinH={iPinH}
          color={NAVY} visible={visible} delay={220} duration={580}
        />

        {/*
          j — terracotta, larger, drops last.
          Because jPinH > iPinH and tipY is the same for all three,
          the j pin's circle top sits higher → mountain / chevron silhouette.
        */}
        <Pin
          cx={j.x + j.w / 2} tipY={tipY}
          pinW={jPinW} pinH={jPinH}
          color={TERRA} visible={visible} delay={460} duration={720}
        />
      </svg>
    );
  };

  return (
    <Box
      ref={containerRef}
      component="span"
      sx={[
        {
          fontFamily:    FONT,
          letterSpacing: '-0.04em',
          lineHeight:    0.88,
          color:         NAVY,
          display:       'inline-block',
          position:      'relative',
          userSelect:    'none',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <span ref={textRef}>{WORD}</span>
      {renderOverlay()}
    </Box>
  );
}
