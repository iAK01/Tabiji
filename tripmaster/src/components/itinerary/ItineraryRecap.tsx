'use client';

import { useState } from 'react';
import { Box, Typography, Button, Paper, Collapse } from '@mui/material';
import { alpha }        from '@mui/material/styles';
import CloseIcon        from '@mui/icons-material/Close';
import UndoIcon         from '@mui/icons-material/Undo';
import EditNoteIcon     from '@mui/icons-material/EditNote';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import AutoStoriesIcon  from '@mui/icons-material/AutoStories';
import { STOP_CONFIG, D } from './Itinerary.config';
import type { Stop }    from './Itinerary.config';
import { timeRangeLabel, canSkip, canNote } from './Itinerary.helpers';
import { clashesIn, type RecordDay } from './record';
import { LinkedResources } from './LinkedResources';

interface Props {
  day:        RecordDay;
  upcoming:   number;                 // stops on this page that haven't started yet
  recapHref:  string;                 // the whole trip, to print or email
  onOpen:     (stop: Stop) => void;
  onEditNote: (stop: Stop) => void;
  onSkip:     (stop: Stop, skipped: boolean) => void;
}

const sectionLabelSx = {
  fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: D.muted,
} as const;

// The day as it happened: everything that's started counts as went, with your
// notes in full. Fix the exceptions — "Didn't go", or one of two that clashed.
export function ItineraryRecap({ day, upcoming, recapHref, onOpen, onEditNote, onSkip }: Props) {
  const [showDidntGo, setShowDidntGo] = useState(false);
  const clashes = clashesIn(day.went);

  return (
    <Box>
      {day.went.length === 0 && (upcoming > 0 || day.didntGo.length === 0) && (
        <Typography sx={{ py: 5, textAlign: 'center', color: D.muted, fontFamily: D.body, fontSize: '0.9rem' }}>
          {upcoming > 0 ? 'Nothing yet on this day.' : 'Nothing on this day.'}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {day.went.map(({ stop, linked }) => {
          const cfg   = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
          const place = stop.locationName || stop.address;
          const note  = stop.myNotes?.trim();
          const clash = clashes.get(stop);
          return (
            <Paper key={stop._id ?? `${stop.name}-${stop.scheduledStart}`} elevation={0} sx={{
              display: 'flex', overflow: 'hidden', borderRadius: '10px',
              border: `1px solid ${clash ? alpha(D.terra, 0.45) : D.rule}`, backgroundColor: '#ffffff',
            }}>
              <Box sx={{ width: 4, flexShrink: 0, backgroundColor: cfg.color }} />
              <Box sx={{ flex: 1, minWidth: 0, p: 1.75 }}>
                <Box onClick={() => onOpen(stop)} sx={{ cursor: 'pointer' }}>
                  <Typography sx={{ fontFamily: D.display, fontSize: '0.85rem', color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                    {timeRangeLabel(stop)}
                  </Typography>
                  <Typography sx={{ fontFamily: D.body, fontSize: '1rem', fontWeight: 800, lineHeight: 1.25, color: D.navy, mt: 0.25 }}>
                    {stop.name?.trim() || 'Unnamed stop'}
                  </Typography>
                  {place && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.muted, mt: 0.25 }}>
                      {place}
                    </Typography>
                  )}
                  {clash && (
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', fontWeight: 700, color: D.terra, mt: 0.5 }}>
                      Same time as {clash.map(o => o.name?.trim() || 'another stop').join(', ')}
                    </Typography>
                  )}
                </Box>

                {note ? (
                  <Typography
                    onClick={() => onEditNote(stop)}
                    sx={{
                      fontFamily: D.body, fontSize: '0.92rem', lineHeight: 1.55, color: D.navy, whiteSpace: 'pre-wrap',
                      mt: 1.25, pt: 1.25, borderTop: `1px solid ${D.rule}`, cursor: 'pointer',
                    }}
                  >
                    {note}
                  </Typography>
                ) : null}

                {linked.some(l => l.resourceType !== 'file') && (
                  <Box sx={{ mt: 1.25 }}>
                    <LinkedResources items={linked} full />
                  </Box>
                )}

                {(canSkip(stop) || (!note && canNote(stop))) && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, mx: -1, mb: -1 }}>
                    {!note && canNote(stop) && (
                      <Button
                        size="small" startIcon={<EditNoteIcon />} onClick={() => onEditNote(stop)}
                        sx={{ minHeight: 44, fontFamily: D.body, fontWeight: 700, color: D.muted, textTransform: 'none' }}
                      >
                        Add a note
                      </Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {canSkip(stop) && (
                      <Button
                        size="small" startIcon={<CloseIcon />} onClick={() => onSkip(stop, true)}
                        sx={{ minHeight: 44, fontFamily: D.body, fontWeight: 700, color: D.muted, textTransform: 'none' }}
                      >
                        Didn’t go
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {day.didntGo.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box
            component="button"
            onClick={() => setShowDidntGo(v => !v)}
            aria-expanded={showDidntGo}
            sx={{
              display: 'flex', alignItems: 'center', width: '100%', minHeight: 44,
              p: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <Typography sx={{ ...sectionLabelSx, flex: 1 }}>Didn’t go · {day.didntGo.length}</Typography>
            <ExpandMoreIcon sx={{
              fontSize: 20, color: D.muted,
              transform: showDidntGo ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
            }} />
          </Box>
          <Collapse in={showDidntGo}>
            {day.didntGo.map((stop, i) => (
              <Box key={stop._id ?? i} sx={{ display: 'flex', alignItems: 'center', gap: 1, borderTop: i ? `1px solid ${D.rule}` : 'none' }}>
                <Box onClick={() => onOpen(stop)} sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 1, py: 1.25, cursor: 'pointer' }}>
                  <Typography sx={{ fontFamily: D.display, fontSize: '0.78rem', color: D.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {timeRangeLabel(stop)}
                  </Typography>
                  <Typography sx={{
                    fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, color: D.muted, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {stop.name}
                  </Typography>
                </Box>
                <Button
                  size="small" startIcon={<UndoIcon />} onClick={() => onSkip(stop, false)}
                  sx={{ minHeight: 44, flexShrink: 0, fontFamily: D.body, fontWeight: 700, color: D.navy, textTransform: 'none' }}
                >
                  I went
                </Button>
              </Box>
            ))}
          </Collapse>
        </Box>
      )}

      {upcoming > 0 && day.went.length > 0 && (
        <Typography sx={{ mt: 2, fontFamily: D.body, fontSize: '0.8rem', color: D.muted }}>
          {upcoming} still to come
        </Typography>
      )}

      <Button
        href={recapHref}
        variant="outlined" fullWidth startIcon={<AutoStoriesIcon />}
        sx={{
          mt: 2.5, minHeight: 48, borderRadius: '10px', fontFamily: D.body, fontWeight: 700,
          color: D.navy, borderColor: alpha(D.navy, 0.25),
        }}
      >
        Whole trip · print or email
      </Button>
    </Box>
  );
}
