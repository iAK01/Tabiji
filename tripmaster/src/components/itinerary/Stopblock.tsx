'use client';

import { useState }       from 'react';
import { useDraggable }   from '@dnd-kit/core';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { alpha }          from '@mui/material/styles';
import DeleteIcon         from '@mui/icons-material/Delete';
import LockIcon           from '@mui/icons-material/Lock';
import NotificationsIcon  from '@mui/icons-material/Notifications';
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
import { TONE } from '@/components/flights/FlightLive';
import type { Tone } from '@/lib/flights/status';

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
  colSpan?:     number;
  linkedFiles?: LinkedFile[];
  startHour?:   number;
  /** When this stop's notification goes out (from /api/trips/[id]/reminders). */
  reminder?:    { local: string; sent: boolean } | null;
  /** Ringed briefly when a notification link lands on this stop. */
  highlighted?: boolean;
  /** Drag, resize and delete only in edit mode — a stray touch must not re-time a stop. */
  editMode?:    boolean;
  /** Live flight status for a stop mirroring a flight: "Gate 102", "Landed 10:21 · belt 7". */
  live?:        { text: string; tone: Tone } | null;
}

// Bell + the time the notification goes out, beside the stop's name.
function ReminderMark({ reminder, size }: { reminder: { local: string; sent: boolean }; size: number }) {
  return (
    <Box
      component="span"
      title={reminder.sent ? `Reminder sent at ${reminder.local}` : `Reminder at ${reminder.local}`}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.25, flexShrink: 0,
        fontFamily: D.body, fontSize: size, fontWeight: 700, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: reminder.sent ? alpha(D.navy, 0.3) : alpha(D.navy, 0.6),
      }}
    >
      <NotificationsIcon sx={{ fontSize: size + 1 }} />
      {reminder.local}
    </Box>
  );
}

export function StopBlock({ stop, onDelete, onClick, onResize, pxPerMin, isMobile, colIndex = 0, totalCols = 1, colSpan = 1, linkedFiles = [], startHour = DAY_START_HOUR, reminder = null, highlighted = false, editMode = false, live = null }: Props) {
  const startMin = stopStartMinutes(stop);
  if (startMin === null) return null;

  // Logistics-mirrored stops split two ways:
  //   fact    (locked:true)  → flight/checkout times etc. Never draggable here;
  //                            changed only on the Logistics record.
  //   derived (locked:false) → airport buffer / hotel check-in / breakfast.
  //                            Behaves like a normal stop (drag, resize, edit in
  //                            edit mode); the change is persisted as an override.
  const fromLogistics = stop.source === 'logistics';
  const isFact        = fromLogistics && stop.locked === true;
  const duration    = stopDuration(stop);
  const dragId      = stop._id ?? `${stop.name}-${stop.scheduledStart ?? stop.time ?? 'notime'}`;
  const cfg         = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
  const hasLocation = !!(stop.address || stop.coordinates);
  const displayName = stop.name?.trim() || 'Unnamed stop';
  const hasFiles    = linkedFiles.length > 0;
  const canMove     = editMode && !isFact;

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

  const liveTop    = minutesToPx(liveStartMin, pxPerMin, startHour);
  const liveHeight = Math.max(liveDuration * pxPerMin, isMobile ? 40 : 32);
  const isResizing = resize !== null;

  // Content thresholds
  const isTall   = liveHeight >= (isMobile ? 60 : 52);   // show name + time
  const isShort  = liveHeight < (isMobile ? 44 : 38);    // time only, no name
  const nameLines = liveHeight >= 96 ? 3 : liveHeight >= 70 ? 2 : 1;
  // Long blocks read top-down like a calendar entry; short ones stay centred
  const alignTop  = liveHeight > 80;

  // Narrow card (many overlapping stops) → drop the icon + action columns so the
  // time and name get the whole width. Container queries measure the card itself.
  const NARROW = '@container (max-width: 150px)';
  const colEnd = colIndex + colSpan;

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
    id: dragId, disabled: isResizing || !canMove,
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
        data-stop-id={stop._id}
        onClick={isDragging || isResizing ? undefined : (e) => { e.stopPropagation(); onClick?.(); }}
        {...listeners}
        {...attributes}
        style={{
          transform:   isDragging ? `translateY(${translateY}px)` : undefined,
          willChange:  isDragging ? 'transform' : undefined,
          // Outside edit mode the page must scroll and pinch straight through the card
          touchAction: canMove ? 'none' : 'pan-x pan-y',
        }}
        sx={{
          position:   'absolute',
          left:       colIndex === 0 ? 0 : `calc(${(colIndex / totalCols) * 100}% + 2px)`,
          right:      colEnd >= totalCols ? (isMobile ? 4 : 6) : `calc(${((totalCols - colEnd) / totalCols) * 100}% + 2px)`,
          containerType: 'inline-size',
          top:        liveTop,
          height:     liveHeight,
          zIndex:     isDragging || isResizing ? 100 : 2,

          // ── Structured-style card ──
          backgroundColor: '#ffffff',
          borderRadius:    '10px',
          borderLeft:      `6px solid ${cfg.color}`,
          boxShadow: isDragging || isResizing
            ? `0 12px 32px rgba(0,0,0,0.2), 0 0 0 2px ${cfg.color}`
            : highlighted
              ? `0 6px 20px rgba(0,0,0,0.22), 0 0 0 3px ${cfg.color}`
              : '0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',

          display:    'flex',
          alignItems: 'stretch',
          overflow:   'hidden',
          cursor:     isDragging ? 'grabbing' : canMove ? 'grab' : 'pointer',
          opacity:    stop.skipped ? 0.45 : 1,
          transition: isDragging || isResizing ? 'none' : 'box-shadow 0.15s',
          userSelect: 'none',

          '&:hover': !isMobile && !isDragging && !isResizing
            ? { boxShadow: `0 4px 16px rgba(0,0,0,0.14), 0 0 0 1.5px ${alpha(cfg.color, 0.5)}` }
            : {},
        }}
      >
        {/* ── Top resize handle ── */}
        {canMove && (
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
        )}

        {/* ── Icon column — full height, tappable when files attached ── */}
        <Box
          onClick={hasFiles ? (e) => { e.stopPropagation(); setViewerFile(linkedFiles[0]); } : undefined}
          sx={{
            flexShrink:      0,
            width:           liveHeight > 60 ? (isMobile ? 44 : 38) : (isMobile ? 34 : 28),
            display:         'flex',
            alignItems:      alignTop ? 'flex-start' : 'center',
            justifyContent:  'center',
            pt:              alignTop ? 1 : 0,
            backgroundColor: hasFiles ? alpha(cfg.color, 0.18) : alpha(cfg.color, 0.10),
            transition:      'width 0.1s, background-color 0.15s',
            position:        'relative',
            cursor:          hasFiles ? 'pointer' : 'inherit',
            '&:hover':       hasFiles ? { backgroundColor: alpha(cfg.color, 0.28) } : {},
            [NARROW]:        { display: 'none' },
          }}
        >
          <cfg.Icon sx={{
            fontSize: liveHeight > 80
              ? (isMobile ? 22 : 20)
              : liveHeight > 48
              ? (isMobile ? 18 : 16)
              : (isMobile ? 14 : 12),
            color:      cfg.color,
            transition: 'font-size 0.1s',
          }} />
          {/* File count badge */}
          {hasFiles && linkedFiles.length > 1 && (
            <Box sx={{
              position: 'absolute', bottom: 4, right: 3,
              minWidth: 14, height: 14, borderRadius: 7,
              backgroundColor: '#4ade80',
              border: '1.5px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                {linkedFiles.length}
              </Typography>
            </Box>
          )}
          {hasFiles && linkedFiles.length === 1 && (
            <Box sx={{
              position: 'absolute', bottom: 5, right: 4,
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: '#4ade80',
              border: '1.5px solid white',
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
          justifyContent: alignTop ? 'flex-start' : 'center',
          pt: alignTop ? 1 : undefined,
          gap: 0.25,
          overflow: 'hidden',
          [NARROW]: { px: 0.75 },
        }}>

          {/* Short block: name + time on one line, nothing hidden */}
          {isShort ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Typography sx={{
                fontFamily:   D.display,
                fontSize:     isMobile ? '0.8rem' : '0.72rem',
                lineHeight:   1,
                color:        D.navy,
                textDecoration: stop.skipped ? 'line-through' : 'none',
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
              {live && (
                <Typography sx={{ fontFamily: D.body, fontSize: isMobile ? '0.68rem' : '0.62rem', fontWeight: 800, lineHeight: 1, color: TONE[live.tone], whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {live.text}
                </Typography>
              )}
              {reminder && <ReminderMark reminder={reminder} size={isMobile ? 10 : 9} />}
              {isFact && <LockIcon sx={{ fontSize: 9, color: alpha(D.navy, 0.35), flexShrink: 0 }} />}
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
                  textDecoration: stop.skipped ? 'line-through' : 'none',
                  overflow:     'hidden',
                  flex:         1,
                  ...(nameLines > 1
                    ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: nameLines, overflowWrap: 'anywhere' }
                    : { whiteSpace: 'nowrap', textOverflow: 'ellipsis' }),
                }}>
                  {displayName}
                </Typography>
                {reminder && <ReminderMark reminder={reminder} size={isMobile ? 11 : 10} />}
                {isFact && (
                  <LockIcon sx={{ fontSize: 10, color: alpha(D.navy, 0.35), flexShrink: 0 }} />
                )}
              </Box>

              {live && (
                <Typography sx={{
                  fontFamily: D.body, fontSize: isMobile ? '0.75rem' : '0.7rem', fontWeight: 800, lineHeight: 1.2,
                  color: TONE[live.tone], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {live.text}
                </Typography>
              )}

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
                  color:        D.muted,
                  lineHeight:   1.2,
                  whiteSpace:   'nowrap',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
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
            [NARROW]: { display: 'none' },
          }}>
            {hasLocation && (
              <NavigateButton
                destination={{ name: displayName, address: stop.address, coordinates: stop.coordinates ?? null }}
                suggestedMode="walking"
                size="small"
                sx={{ p: isMobile ? 0.75 : 0.25, minWidth: isMobile ? 32 : 22, minHeight: isMobile ? 32 : 22 }}
              />
            )}
            {editMode && !fromLogistics && onDelete && (
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
        {canMove && (
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
        )}
      </Box>
    </Tooltip>
    <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
}