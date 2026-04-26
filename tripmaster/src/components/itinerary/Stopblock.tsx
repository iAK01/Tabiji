'use client';

import { useState }       from 'react';
import { useDraggable }   from '@dnd-kit/core';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { alpha }          from '@mui/material/styles';
import DeleteIcon         from '@mui/icons-material/Delete';
import LockIcon           from '@mui/icons-material/Lock';
import AttachFileIcon     from '@mui/icons-material/AttachFile';
import NavigateButton     from '@/components/ui/NavigateButton';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import {
  DAY_START_HOUR, DAY_END_HOUR, SNAP_MINS, STOP_CONFIG, D,
} from './Itinerary.config';
import type { Stop } from './Itinerary.config';
import {
  stopStartMinutes, stopDuration, minutesToPx,
  formatTime, snappedPreviewMinutes,
} from './Itinerary.helpers';

interface LinkedFile {
  _id:      string;
  name:     string;
  mimeType?: string;
  gcsUrl?:  string;
}

interface Props {
  stop:         Stop;
  onDelete?:    () => void;
  onClick?:     () => void;
  onResize?:    (newStartMin: number, newDuration: number) => void;
  pxPerMin:     number;
  isMobile:     boolean;
  colIndex?:    number;
  totalCols?:   number;
  linkedFiles?: LinkedFile[];
}

export function StopBlock({ stop, onDelete, onClick, onResize, pxPerMin, isMobile, colIndex = 0, totalCols = 1, linkedFiles = [] }: Props) {
  const startMin = stopStartMinutes(stop);
  if (startMin === null) return null;

  const isLocked    = stop.source === 'logistics';
  const duration    = stopDuration(stop);
  const dragId      = stop._id ?? `${stop.name}-${stop.scheduledStart ?? stop.time ?? 'notime'}`;
  const cfg         = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const hasLocation = !!(stop.address || stop.coordinates);
  const displayName = stop.name?.trim() || 'Unnamed stop';
  const hasFiles    = linkedFiles.length > 0;

  const [viewerFile, setViewerFile] = useState<ViewableFile | null>(null);

  // ── Resize ────────────────────────────────────────────────────────────────────
  const [resize, setResize] = useState<{ edge: 'top' | 'bottom'; deltaY: number } | null>(null);

  const rawDeltaMin  = resize ? Math.round((resize.deltaY / pxPerMin) / SNAP_MINS) * SNAP_MINS : 0;
  const liveStartMin = resize?.edge === 'top'
    ? Math.max(DAY_START_HOUR * 60, Math.min(startMin + duration - SNAP_MINS, startMin + rawDeltaMin))
    : startMin;
  const liveDuration = resize?.edge === 'top'
    ? Math.max(SNAP_MINS, duration - (liveStartMin - startMin))
    : resize?.edge === 'bottom'
    ? Math.max(SNAP_MINS, duration + rawDeltaMin)
    : duration;

  const liveTop    = minutesToPx(liveStartMin, pxPerMin);
  const liveHeight = Math.max(liveDuration * pxPerMin, isMobile ? 40 : 32);
  const isResizing = resize !== null;

  // Content thresholds
  const isTall   = liveHeight >= (isMobile ? 60 : 52);   // show name + time
  const isShort  = liveHeight < (isMobile ? 44 : 38);    // time only, no name

  const handleResizePointerDown = (e: React.PointerEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    setResize({ edge, deltaY: 0 });
    const onMove = (me: PointerEvent) => setResize({ edge, deltaY: me.clientY - startY });
    const onUp   = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const finalDeltaMin = Math.round(((ue.clientY - startY) / pxPerMin) / SNAP_MINS) * SNAP_MINS;
      const finalStartMin = edge === 'top'
        ? Math.max(DAY_START_HOUR * 60, Math.min(startMin + duration - SNAP_MINS, startMin + finalDeltaMin))
        : startMin;
      const finalDuration = edge === 'top'
        ? Math.max(SNAP_MINS, duration - (finalStartMin - startMin))
        : Math.max(SNAP_MINS, duration + finalDeltaMin);
      setResize(null);
      if (finalStartMin !== startMin || finalDuration !== duration) {
        onResize?.(finalStartMin, finalDuration);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // ── DnD ───────────────────────────────────────────────────────────────────────
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId, disabled: isResizing,
  });

  const previewMin = transform
    ? snappedPreviewMinutes(startMin, duration, transform.y, pxPerMin)
    : startMin;
  const translateY = transform ? transform.y : 0;

  // ── Tooltip ───────────────────────────────────────────────────────────────────
  const tooltipLines = stop.notes ? stop.notes.split(' · ').filter(Boolean) : [];
  const tooltipTitle = tooltipLines.length > 0 ? (
    <Box sx={{ py: 0.25 }}>
      {tooltipLines.map((line, i) => (
        <Typography key={i} variant="caption" display="block" sx={{ lineHeight: 1.7 }}>{line}</Typography>
      ))}
    </Box>
  ) : '';

  const timeLabel = isDragging
    ? `→ ${formatTime(previewMin)}`
    : isResizing
    ? `${formatTime(liveStartMin)} · ${liveDuration}min`
    : formatTime(liveStartMin);

  return (
    <>
    <Tooltip
      title={tooltipTitle}
      placement="right"
      arrow
      disableHoverListener={!stop.notes || isDragging || isResizing}
      enterDelay={300}
    >
      <Box
        ref={setNodeRef}
        onClick={isDragging || isResizing ? undefined : (e) => { e.stopPropagation(); onClick?.(); }}
        {...listeners}
        {...attributes}
        style={{
          transform:   isDragging ? `translateY(${translateY}px)` : undefined,
          willChange:  isDragging ? 'transform' : undefined,
          touchAction: 'none',
        }}
        sx={{
          position:   'absolute',
          left:       totalCols === 1 ? 0 : `calc(${(colIndex / totalCols) * 100}% + ${colIndex > 0 ? 2 : 0}px)`,
          right:      totalCols === 1 ? (isMobile ? 4 : 6) : colIndex < totalCols - 1 ? `calc(${((totalCols - colIndex - 1) / totalCols) * 100}% + 2px)` : (isMobile ? 4 : 6),
          top:        liveTop,
          height:     liveHeight,
          zIndex:     isDragging || isResizing ? 100 : 2,

          // ── Structured-style card ──
          backgroundColor: '#ffffff',
          borderRadius:    '10px',
          borderLeft:      `6px solid ${cfg.color}`,
          boxShadow: isDragging || isResizing
            ? `0 12px 32px rgba(0,0,0,0.2), 0 0 0 2px ${cfg.color}`
            : '0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',

          display:    'flex',
          alignItems: 'stretch',
          overflow:   'hidden',
          cursor:     isDragging ? 'grabbing' : 'grab',
          transition: isDragging || isResizing ? 'none' : 'box-shadow 0.15s',
          userSelect: 'none',

          '&:hover': !isMobile && !isDragging && !isResizing
            ? { boxShadow: `0 4px 16px rgba(0,0,0,0.14), 0 0 0 1.5px ${alpha(cfg.color, 0.5)}` }
            : {},
        }}
      >
        {/* ── Top resize handle ── */}
        <Box
          onPointerDown={e => handleResizePointerDown(e, 'top')}
          sx={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 8,
            cursor: 'ns-resize', zIndex: 10,
            backgroundColor: isResizing && resize?.edge === 'top'
              ? alpha(cfg.color, 0.15) : 'transparent',
            '&:hover': { backgroundColor: alpha(cfg.color, 0.08) },
          }}
        />

        {/* ── Icon column — full height, scales with block ── */}
        <Box sx={{
          flexShrink:      0,
          width:           liveHeight > 60 ? (isMobile ? 44 : 38) : (isMobile ? 34 : 28),
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: alpha(cfg.color, 0.10),
          transition:      'width 0.1s',
          position:        'relative',
        }}>
          <cfg.Icon sx={{
            fontSize: liveHeight > 80
              ? (isMobile ? 22 : 20)
              : liveHeight > 48
              ? (isMobile ? 18 : 16)
              : (isMobile ? 14 : 12),
            color:      cfg.color,
            transition: 'font-size 0.1s',
          }} />
          {/* File attachment dot indicator */}
          {hasFiles && (
            <Box sx={{
              position: 'absolute', bottom: 5, right: 4,
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: '#4ade80',
              border: '1px solid white',
              zIndex: 3,
            }} />
          )}
        </Box>

        {/* ── Content ── */}
        <Box sx={{
          flex: 1, minWidth: 0,
          px: isMobile ? 1.25 : 1,
          py: isMobile ? 0.75 : 0.5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 0.25,
          overflow: 'hidden',
        }}>

          {/* Short block: name + time on one line, nothing hidden */}
          {isShort ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Typography sx={{
                fontFamily:   D.display,
                fontSize:     isMobile ? '0.8rem' : '0.72rem',
                lineHeight:   1,
                color:        D.navy,
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                flex:         1,
              }}>
                {displayName}
              </Typography>
              {stop.reference && (
                <Typography sx={{
                  fontFamily:  D.body,
                  fontSize:    isMobile ? '0.68rem' : '0.62rem',
                  fontWeight:  800,
                  color:       '#0369a1',
                  whiteSpace:  'nowrap',
                  flexShrink:  0,
                  lineHeight:  1,
                }}>
                  {stop.reference}
                </Typography>
              )}
              <Typography sx={{
                fontFamily:         D.display,
                fontSize:           isMobile ? '0.75rem' : '0.68rem',
                lineHeight:         1,
                color:              cfg.color,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace:         'nowrap',
                flexShrink:         0,
              }}>
                {timeLabel}
              </Typography>
              {isLocked && <LockIcon sx={{ fontSize: 9, color: alpha(D.navy, 0.35), flexShrink: 0 }} />}
            </Box>
          ) : (
            <>
              {/* Time — leads */}
              <Typography sx={{
                fontFamily:         D.display,
                fontSize:           isMobile ? '1rem' : '0.92rem',
                lineHeight:         1,
                color:              cfg.color,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace:         'nowrap',
              }}>
                {timeLabel}
              </Typography>

              {/* Name */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                <Typography sx={{
                  fontFamily:   D.display,
                  fontSize:     isMobile ? '0.88rem' : '0.82rem',
                  lineHeight:   1.15,
                  color:        D.navy,
                  whiteSpace:   'nowrap',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  flex:         1,
                }}>
                  {displayName}
                </Typography>
                {isLocked && (
                  <LockIcon sx={{ fontSize: 10, color: alpha(D.navy, 0.35), flexShrink: 0 }} />
                )}
              </Box>

              {/* Reference — platform, seat, booking code — shown on any non-short block */}
              {stop.reference && (
                <Box sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  px: isMobile ? 0.75 : 0.6,
                  py: 0.2,
                  borderRadius: '4px',
                  backgroundColor: 'rgba(3,105,161,0.10)',
                  border: '1px solid rgba(3,105,161,0.25)',
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}>
                  <Typography sx={{
                    fontFamily:   D.body,
                    fontSize:     isMobile ? '0.72rem' : '0.65rem',
                    fontWeight:   800,
                    color:        '#0369a1',
                    lineHeight:   1.3,
                    whiteSpace:   'nowrap',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '0.02em',
                  }}>
                    {stop.reference}
                  </Typography>
                </Box>
              )}

              {/* Duration — tall blocks only */}
              {isTall && !isDragging && !isResizing && (
                <Typography sx={{
                  fontFamily: D.body,
                  fontSize:   isMobile ? '0.7rem' : '0.64rem',
                  color:      D.muted,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {liveDuration >= 60
                    ? `${Math.floor(liveDuration / 60)}h${liveDuration % 60 > 0 ? ` ${liveDuration % 60}m` : ''}`
                    : `${liveDuration}m`
                  }
                  {stop.notes ? ` · ${stop.notes}` : ''}
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* ── Actions — only on tall non-dragging blocks ── */}
        {isTall && !isDragging && !isResizing && (
          <Box sx={{
            display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-start',
            flexShrink: 0, pt: 0.5, pr: 0.5,
          }}>
            {hasLocation && (
              <NavigateButton
                destination={{ name: displayName, address: stop.address, coordinates: stop.coordinates ?? null }}
                suggestedMode="walking"
                size="small"
                sx={{ p: isMobile ? 0.75 : 0.25, minWidth: isMobile ? 32 : 22, minHeight: isMobile ? 32 : 22 }}
              />
            )}
            {hasFiles && (
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); setViewerFile(linkedFiles[0]); }}
                sx={{
                  p: isMobile ? 0.75 : 0.25, flexShrink: 0,
                  color: '#4ade80',
                  '&:hover': { color: '#22c55e', backgroundColor: alpha('#4ade80', 0.08) },
                  ...(isMobile && { minWidth: 32, minHeight: 32 }),
                }}
              >
                <AttachFileIcon sx={{ fontSize: isMobile ? 14 : 12 }} />
              </IconButton>
            )}
            {!isLocked && onDelete && (
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); onDelete(); }}
                sx={{
                  p: isMobile ? 0.75 : 0.25, flexShrink: 0,
                  color: alpha(D.navy, 0.25),
                  '&:hover':  { color: alpha(D.navy, 0.6) },
                  '&:active': { color: 'error.main', backgroundColor: alpha('#ef4444', 0.08) },
                  ...(isMobile && { minWidth: 32, minHeight: 32 }),
                }}
              >
                <DeleteIcon sx={{ fontSize: isMobile ? 14 : 12 }} />
              </IconButton>
            )}
          </Box>
        )}

        {/* ── Bottom resize handle + nub ── */}
        <Box
          onPointerDown={e => handleResizePointerDown(e, 'bottom')}
          sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 10,
            cursor: 'ns-resize', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isResizing && resize?.edge === 'bottom'
              ? alpha(cfg.color, 0.15) : 'transparent',
            '&:hover': { backgroundColor: alpha(cfg.color, 0.08) },
          }}
        >
          <Box sx={{
            width: 28, height: 3, borderRadius: 2,
            backgroundColor: isResizing && resize?.edge === 'bottom'
              ? cfg.color : alpha(cfg.color, 0.4),
            pointerEvents: 'none',
            transition: 'background-color 0.15s, width 0.15s',
            '.MuiBox-root:hover &': { width: 36, backgroundColor: cfg.color },
          }} />
        </Box>
      </Box>
    </Tooltip>
    <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
}