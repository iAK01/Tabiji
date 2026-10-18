'use client';

import { Box, Typography, IconButton } from '@mui/material';
import { alpha }       from '@mui/material/styles';
import CloseIcon       from '@mui/icons-material/Close';
import UndoIcon        from '@mui/icons-material/Undo';
import LockIcon        from '@mui/icons-material/Lock';
import { STOP_CONFIG, D } from './Itinerary.config';
import type { Stop }   from './Itinerary.config';
import {
  stopStartMinutes, stopDuration, formatTime, fmtDuration, overlapClusters, canSkip,
} from './Itinerary.helpers';
import { TONE } from '@/components/flights/FlightLive';
import type { Tone } from '@/lib/flights/status';

interface Props {
  stops:  Stop[];                                   // timed stops to show
  onOpen: (stop: Stop) => void;
  onSkip: (stop: Stop, skipped: boolean) => void;
  /** Live flight status for a stop mirroring a flight: "Gate 102", "Delayed · now 06:50". */
  live?:  (stop: Stop) => { text: string; tone: Tone } | null;
}

// The phone-first reading of a day: one full-width row per stop, full names,
// clashes grouped under a bracket, a big ✕ to drop what you won't go to.
export function ItineraryList({ stops, onOpen, onSkip, live }: Props) {
  const clusters = overlapClusters(stops);

  if (!clusters.length) {
    return (
      <Typography sx={{ py: 5, textAlign: 'center', color: D.muted, fontFamily: D.body, fontSize: '0.9rem' }}>
        Nothing timed on this day.
      </Typography>
    );
  }

  return (
    <Box sx={{ py: 0.5 }}>
      {clusters.map((group, gi) => {
        const clash = group.filter(s => !s.skipped).length > 1;
        const start = Math.min(...group.map(s => stopStartMinutes(s) ?? 0));
        const end   = Math.max(...group.map(s => (stopStartMinutes(s) ?? 0) + stopDuration(s)));
        return (
          <Box key={gi} sx={{ borderTop: gi ? `1px solid ${D.rule}` : 'none', py: 0.5 }}>
            {clash && (
              <Typography sx={{
                px: 2, pt: 1, pb: 0.25,
                fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: D.terra,
              }}>
                {group.filter(s => !s.skipped).length} at once · {formatTime(start)}–{formatTime(end)}
              </Typography>
            )}
            <Box sx={{
              ...(clash && { ml: 1.25, borderLeft: `2px solid ${alpha(D.terra, 0.35)}` }),
            }}>
              {group.map((stop, i) => {
                const cfg   = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
                const s     = stopStartMinutes(stop) ?? 0;
                const dur   = stopDuration(stop);
                const isFact = stop.source === 'logistics' && stop.locked;
                const sub   = [stop.locationName || stop.address, dur > 0 ? fmtDuration(dur) : null]
                  .filter(Boolean).join(' · ');
                const note  = live?.(stop) ?? null;
                return (
                  <Box key={stop._id ?? i} sx={{
                    display: 'flex', alignItems: 'stretch',
                    opacity: stop.skipped ? 0.45 : 1,
                  }}>
                    <Box
                      onClick={() => onOpen(stop)}
                      sx={{
                        flex: 1, minWidth: 0, display: 'flex', gap: 1.25,
                        px: clash ? 1.25 : 2, py: 1.1, cursor: 'pointer',
                        '&:active': { backgroundColor: alpha(D.navy, 0.04) },
                        '@media (hover: hover)': { '&:hover': { backgroundColor: alpha(D.navy, 0.03) } },
                      }}
                    >
                      {/* Time column */}
                      <Box sx={{ width: 46, flexShrink: 0, pt: 0.1 }}>
                        <Typography sx={{ fontFamily: D.display, fontSize: '0.88rem', lineHeight: 1.1, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                          {formatTime(s)}
                        </Typography>
                        {dur > 0 && (
                          <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', color: D.muted, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                            {formatTime(s + dur)}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ width: 4, borderRadius: 2, backgroundColor: cfg.color, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontFamily: D.body, fontSize: '0.95rem', fontWeight: 800, lineHeight: 1.25, color: D.navy,
                          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
                          textDecoration: stop.skipped ? 'line-through' : 'none',
                        }}>
                          {stop.name?.trim() || 'Unnamed stop'}
                          {isFact && <LockIcon sx={{ fontSize: 11, color: alpha(D.navy, 0.35), ml: 0.5, verticalAlign: 'middle' }} />}
                        </Typography>
                        {sub && (
                          <Typography sx={{
                            fontFamily: D.body, fontSize: '0.78rem', color: D.muted, mt: 0.25,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {sub}
                          </Typography>
                        )}
                        {note && (
                          <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', fontWeight: 800, color: TONE[note.tone], mt: 0.25 }}>
                            {note.text}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {canSkip(stop) && (
                      <IconButton
                        onClick={() => onSkip(stop, !stop.skipped)}
                        aria-label={stop.skipped ? 'Going after all' : 'Not going'}
                        title={stop.skipped ? 'Going after all' : 'Not going'}
                        sx={{ alignSelf: 'center', width: 44, height: 44, mr: 0.5, color: alpha(D.navy, 0.35), flexShrink: 0 }}
                      >
                        {stop.skipped ? <UndoIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
