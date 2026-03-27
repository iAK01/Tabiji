'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const NAVY  = '#1D2642';
const TERRA = '#C4714A';
const BG    = '#F5F0E8';
const FONT  = '"Archivo Black", sans-serif';
const WORD  = 'Tab\u0131j\u0131';

interface CharPos { x: number; y: number; w: number; h: number; }
interface Layout { svgW: number; svgH: number; em: number; i1: CharPos; j: CharPos; i2: CharPos; }

function springEase(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3) * (1 + 2.5 * (1 - t));
}

// Computes the pin path entirely in pixel space — no SVG scale transform needed.
function makePinPath(cx: number, tipY: number, pinW: number, pinH: number) {
  const sx = pinW / 10;
  const sy = pinH / 14;
  const ox = cx - pinW / 2;
  const oy = tipY - pinH;
  const px = (v: number) => (ox + v * sx).toFixed(2);
  const py = (v: number) => (oy + v * sy).toFixed(2);
  return {
    d: `M${px(5)},${py(14)} C${px(2.5)},${py(10.5)} ${px(0)},${py(8.5)} ${px(0)},${py(5)} A${(5*sx).toFixed(2)},${(5*sy).toFixed(2)},0,1,1,${px(10)},${py(5)} C${px(10)},${py(8.5)} ${px(7.5)},${py(10.5)} ${px(5)},${py(14)}Z`,
    circleCx: ox + 5 * sx,
    circleCy: oy + 4.5 * sy,
    circleR:  2 * Math.min(sx, sy),
  };
}

function Pin({ cx, tipY, pinW, pinH, color, delay, duration, visible }: {
  cx: number; tipY: number; pinW: number; pinH: number;
  color: string; delay: number; duration: number; visible: boolean;
}) {
  const gRef   = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  const { d, circleCx, circleCy, circleR } = makePinPath(cx, tipY, pinW, pinH);
  const dropY = pinH;

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    cancelAnimationFrame(rafRef.current);
    if (!visible) {
      g.setAttribute('opacity', '0');
      g.setAttribute('transform', `translate(0,${-dropY})`);
      return;
    }
    let t0: number | null = null;
    const step = (now: number) => {
      if (t0 === null) t0 = now + delay;
      if (now < t0) { rafRef.current = requestAnimationFrame(step); return; }
      const elapsed  = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = springEase(progress);
      g.setAttribute('transform', `translate(0,${(-dropY * (1 - eased)).toFixed(2)})`);
      g.setAttribute('opacity', String(Math.min(elapsed / 180, 1)));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, dropY, delay, duration]);

  return (
    <g ref={gRef} opacity="0" transform={`translate(0,${-dropY})`}>
      <path d={d} fill={color} />
      <circle cx={circleCx} cy={circleCy} r={circleR} fill="rgba(255,255,255,0.30)" />
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
      return { x: b.left - cRect.left, y: b.top - cRect.top, w: b.width, h: b.height };
    };
    const i1 = charPos(3, 4);
    const j  = charPos(4, 5);
    const i2 = charPos(5, 6);
    const em = parseFloat(window.getComputedStyle(textEl).fontSize);
    setLayout({ svgW: cRect.width, svgH: cRect.height, em, i1, j, i2 });
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => { measure(); requestAnimationFrame(measure); });
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

    const iPinW = em * 0.20;
    const iPinH = iPinW * 1.4;
    const jPinW = em * 0.25;
    const jPinH = jPinW * 1.4;

    // tipY: bottom edge of where the dot sits.
    // j.y is top of j bounding rect including the dot.
    // The dot occupies roughly the top 15% of j.h.
    const tipY = j.y + j.h * 0.26;

    return (
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: svgW, height: svgH,
          overflow: 'visible', pointerEvents: 'none',
        }}
      >
        {/* Eraser covers the j dot. overflow:visible means it paints above
            the SVG origin even when j.y is negative. */}
        <rect
          x={j.x - 2}
          y={j.y - 2}
          width={j.w + 4}
          height={tipY - j.y + 4}
          fill={bgColor}
        />

        <Pin cx={i1.x + i1.w / 2 + 2.5} tipY={tipY} pinW={iPinW} pinH={iPinH} color={NAVY}  delay={0}   duration={460} visible={visible} />
        <Pin cx={i2.x + i2.w / 2 + 2.5} tipY={tipY} pinW={iPinW} pinH={iPinH} color={NAVY}  delay={220} duration={580} visible={visible} />
        <Pin cx={j.x  + j.w  / 2 + 2.5} tipY={tipY} pinW={jPinW} pinH={jPinH} color={TERRA} delay={460} duration={720} visible={visible} />
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
          overflow:      'visible',
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