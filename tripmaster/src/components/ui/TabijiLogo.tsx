'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const BG    = '#F5F0E8';
const FONT  = '"Archivo Black", sans-serif';
const PIN_PATH = 'M5,14 C2.5,10.5 0,8.5 0,5 A5,5,0,1,1,10,5 C10,8.5 7.5,10.5 5,14Z';

const WORD = 'Tab\u0131j\u0131';

interface CharPos { x: number; y: number; w: number; h: number; }
interface Layout {
  svgW: number; svgH: number; em: number;
  i1: CharPos; j: CharPos; i2: CharPos;
}

function Pin({
  cx, tipY, pinW, pinH, color, visible, delay, duration,
}: {
  cx: number; tipY: number; pinW: number; pinH: number;
  color: string; visible: boolean; delay: number; duration: number;
}) {
  const sx  = pinW / 10;
  const sy  = pinH / 14;
  const x0  = cx - pinW / 2;
  const y0  = tipY - pinH;
  const y0h = y0 - pinH * 1.2;

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
  bgColor?: string;
}

export default function TabijiLogo({ sx, bgColor = BG }: TabijiLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef      = useRef<HTMLSpanElement>(null);
  const [layout,  setLayout]  = useState<Layout | null>(null);
  const [visible, setVisible] = useState(false);

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

    const i1 = charPos(3, 4);
    const j  = charPos(4, 5);
    const i2 = charPos(5, 6);

    const em = parseFloat(window.getComputedStyle(textEl).fontSize);

    setLayout({ svgW: cRect.width, svgH: cRect.height, em, i1, j, i2 });
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => {
      measure();
      requestAnimationFrame(measure);
    });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const renderOverlay = () => {
    if (!layout) return null;
    const { svgW, svgH, em, i1, j, i2 } = layout;

    const iPinW = em * 0.16;
    const iPinH = iPinW * 1.4;

    const jPinW = em * 0.28;
    const jPinH = jPinW * 1.4;

    const tipY = i1.y;

    const eraseY = Math.min(j.y, -4);
    const eraseH = tipY - eraseY + 2;

    const eraseX = j.x - 2;
    const eraseW = j.w + 4;

    return (
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: svgW, height: svgH,
          overflow: 'visible', pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x={eraseX} y={eraseY}
          width={eraseW} height={eraseH}
          fill={bgColor}
        />

        <Pin
          cx={i1.x + i1.w / 2} tipY={tipY}
          pinW={iPinW} pinH={iPinH}
          color={NAVY} visible={visible} delay={0} duration={460}
        />

        <Pin
          cx={i2.x + i2.w / 2} tipY={tipY}
          pinW={iPinW} pinH={iPinH}
          color={NAVY} visible={visible} delay={220} duration={580}
        />

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