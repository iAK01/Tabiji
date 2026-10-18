'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Drawer, Dialog, Chip,
} from '@mui/material';
import { alpha }            from '@mui/material/styles';
import CloseIcon            from '@mui/icons-material/Close';
import EditIcon             from '@mui/icons-material/Edit';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline';
import VisibilityOffIcon    from '@mui/icons-material/VisibilityOff';
import UndoIcon             from '@mui/icons-material/Undo';
import LockIcon             from '@mui/icons-material/Lock';
import NotificationsIcon    from '@mui/icons-material/Notifications';
import AttachFileIcon       from '@mui/icons-material/AttachFile';
import PlaceIcon            from '@mui/icons-material/Place';
import FilterListIcon       from '@mui/icons-material/FilterList';
import NavigateButton       from '@/components/ui/NavigateButton';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import { STOP_CONFIG, D }   from './Itinerary.config';
import type { Stop }        from './Itinerary.config';
import { stopDuration, fmtDuration, timeRangeLabel, canSkip } from './Itinerary.helpers';

interface LinkedFile { _id: string; name: string; mimeType?: string; gcsUrl?: string }

interface Props {
  stop:        Stop | null;
  concurrent:  Stop[];                 // other stops at the same time
  isMobile:    boolean;
  linkedFiles: LinkedFile[];
  reminder:    { local: string; sent: boolean } | null;
  onClose:     () => void;
  onSelect:    (stop: Stop) => void;   // jump to a concurrent stop
  onSkip:      (stop: Stop, skipped: boolean) => void;
  onEdit:      (stop: Stop) => void;
  onDelete:    (stop: Stop) => void;
  onOpenLogistics: () => void;
  onFilterType:    (type: string) => void;   // "show me all the gigs"
}

// Tap a stop → everything about it, plus what else is on at the same time.
// The read-first view: nothing here moves a stop by accident.
export function StopDetailSheet({
  stop, concurrent, isMobile, linkedFiles, reminder,
  onClose, onSelect, onSkip, onEdit, onDelete, onOpenLogistics, onFilterType,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerFile,    setViewerFile]    = useState<ViewableFile | null>(null);

  useEffect(() => { setConfirmDelete(false); }, [stop]);

  const open = !!stop;
  const body = stop && (() => {
    const cfg       = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
    const isFact    = stop.source === 'logistics' && stop.locked === true;
    const deletable = stop.source !== 'logistics' && !!stop._id;
    const editable  = !isFact && !!stop._id;
    const dur       = stopDuration(stop);
    const place     = stop.locationName || stop.address;
    const btnSx     = { fontFamily: D.body, fontWeight: 700, minHeight: 48, borderRadius: '10px', flex: 1 };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {/* ── Scrollable detail ── */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2.5, sm: 3 }, pt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: alpha(cfg.color, 0.12),
            }}>
              <cfg.Icon sx={{ fontSize: 18, color: cfg.color }} />
            </Box>
            <Typography sx={{
              fontFamily: D.display, fontSize: '1.05rem', color: cfg.color,
              fontVariantNumeric: 'tabular-nums', flex: 1,
            }}>
              {timeRangeLabel(stop)}
              {dur > 0 && stop.scheduledStart && (
                <Box component="span" sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.muted, fontWeight: 600, ml: 1 }}>
                  {fmtDuration(dur)}
                </Box>
              )}
            </Typography>
            <IconButton onClick={onClose} sx={{ color: D.muted, width: 44, height: 44 }} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>

          <Typography sx={{ fontFamily: D.display, fontSize: '1.3rem', lineHeight: 1.2, color: D.navy, mb: 1 }}>
            {stop.name?.trim() || 'Unnamed stop'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            <Chip
              size="small"
              icon={<FilterListIcon sx={{ fontSize: '14px !important' }} />}
              label={cfg.label.replace(/^\S+\s*/, '') || cfg.label}
              onClick={() => onFilterType(stop.type)}
              title="Show only these on the day"
              sx={{
                backgroundColor: alpha(cfg.color, 0.1), color: cfg.color, fontWeight: 700, fontFamily: D.body,
                '& .MuiChip-icon': { color: cfg.color },
                '&:hover': { backgroundColor: alpha(cfg.color, 0.18) },
              }}
            />
            {stop.skipped && (
              <Chip size="small" label="Not going"
                sx={{ backgroundColor: alpha(D.navy, 0.08), color: D.navy, fontWeight: 700, fontFamily: D.body }} />
            )}
            {isFact && (
              <Chip size="small" icon={<LockIcon sx={{ fontSize: '12px !important' }} />} label="From a booking"
                sx={{ backgroundColor: alpha(D.terra, 0.1), color: D.terra, fontWeight: 700, fontFamily: D.body, '& .MuiChip-icon': { color: D.terra } }} />
            )}
            {stop.reference && (
              <Chip size="small" label={stop.reference}
                sx={{ backgroundColor: 'rgba(3,105,161,0.10)', color: '#0369a1', fontWeight: 800, fontFamily: D.body }} />
            )}
          </Box>

          {place && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <PlaceIcon sx={{ fontSize: 18, color: D.muted, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 700, color: D.navy }}>
                  {stop.locationName || stop.address}
                </Typography>
                {stop.locationName && stop.address && stop.address !== stop.locationName && (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>{stop.address}</Typography>
                )}
              </Box>
              {(stop.address || stop.coordinates) && (
                <NavigateButton
                  destination={{ name: stop.name, address: stop.address, coordinates: stop.coordinates ?? null }}
                  suggestedMode="walking"
                  size="small"
                  sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
                />
              )}
            </Box>
          )}

          {reminder && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: D.muted }}>
              <NotificationsIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem' }}>
                {reminder.sent ? `Reminder sent at ${reminder.local}` : `Reminder at ${reminder.local}`}
              </Typography>
            </Box>
          )}

          {stop.notes && (
            <Typography sx={{
              fontFamily: D.body, fontSize: '0.92rem', lineHeight: 1.55, color: alpha(D.navy, 0.8),
              whiteSpace: 'pre-wrap', mb: 1.5,
            }}>
              {stop.notes.split(' · ').join('\n')}
            </Typography>
          )}

          {linkedFiles.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
              {linkedFiles.map(f => (
                <Chip key={f._id} icon={<AttachFileIcon sx={{ fontSize: '14px !important' }} />} label={f.name}
                  onClick={() => setViewerFile({ _id: f._id, name: f.name, mimeType: f.mimeType, gcsUrl: f.gcsUrl })}
                  sx={{ fontFamily: D.body, fontWeight: 600, maxWidth: '100%', height: 36 }} />
              ))}
            </Box>
          )}

          {/* ── Same time — step through a clash without hunting on the grid ── */}
          {concurrent.length > 0 && (
            <Box sx={{ mt: 1, mb: 1 }}>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: D.muted, mb: 0.75,
              }}>
                Also at this time · {concurrent.length}
              </Typography>
              {concurrent.map((o, i) => {
                const oc = STOP_CONFIG[o.type] ?? STOP_CONFIG.other;
                return (
                  <Box key={o._id ?? i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    borderTop: i ? `1px solid ${D.rule}` : 'none',
                    opacity: o.skipped ? 0.5 : 1,
                  }}>
                    <Box
                      onClick={() => onSelect(o)}
                      sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, py: 1.25, cursor: 'pointer' }}
                    >
                      <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: oc.color, flexShrink: 0 }} />
                      <Typography sx={{ fontFamily: D.display, fontSize: '0.78rem', color: oc.color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {timeRangeLabel(o)}
                      </Typography>
                      <Typography sx={{
                        fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, color: D.navy, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: o.skipped ? 'line-through' : 'none',
                      }}>
                        {o.name}
                      </Typography>
                    </Box>
                    {canSkip(o) && (
                      <IconButton
                        onClick={() => onSkip(o, !o.skipped)}
                        aria-label={o.skipped ? 'Going after all' : 'Not going'}
                        title={o.skipped ? 'Going after all' : 'Not going'}
                        sx={{ width: 44, height: 44, color: D.muted, flexShrink: 0 }}
                      >
                        {o.skipped ? <UndoIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* ── Actions ── */}
        <Box sx={{
          flexShrink: 0, display: 'flex', gap: 1, flexWrap: 'wrap',
          px: { xs: 2.5, sm: 3 }, pt: 1.5, pb: { xs: 'max(env(safe-area-inset-bottom, 12px), 16px)', sm: 2.5 },
          borderTop: `1px solid ${D.rule}`,
        }}>
          {canSkip(stop) && (
            <Button
              variant="outlined"
              startIcon={stop.skipped ? <UndoIcon /> : <VisibilityOffIcon />}
              onClick={() => onSkip(stop, !stop.skipped)}
              sx={{ ...btnSx, color: D.navy, borderColor: alpha(D.navy, 0.25) }}
            >
              {stop.skipped ? 'Going after all' : 'Not going'}
            </Button>
          )}
          {editable && (
            <Button
              variant="outlined" startIcon={<EditIcon />}
              onClick={() => onEdit(stop)}
              sx={{ ...btnSx, color: D.navy, borderColor: alpha(D.navy, 0.25) }}
            >
              Edit
            </Button>
          )}
          {isFact && (
            <Button
              variant="outlined" startIcon={<LockIcon />}
              onClick={onOpenLogistics}
              sx={{ ...btnSx, color: D.terra, borderColor: alpha(D.terra, 0.4) }}
            >
              Open booking
            </Button>
          )}
          {deletable && (
            <Button
              variant={confirmDelete ? 'contained' : 'text'}
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => (confirmDelete ? onDelete(stop) : setConfirmDelete(true))}
              sx={{ ...btnSx, flex: confirmDelete ? 1 : '0 0 auto', boxShadow: 'none' }}
            >
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </Button>
          )}
        </Box>
      </Box>
    );
  })();

  return (
    <>
      {isMobile ? (
        <Drawer
          anchor="bottom" open={open} onClose={onClose}
          PaperProps={{ sx: {
            borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#ffffff',
          } }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.25, pb: 0.5, flexShrink: 0 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, backgroundColor: alpha('#000', 0.12) }} />
          </Box>
          {body}
        </Drawer>
      ) : (
        <Dialog
          open={open} onClose={onClose} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: '14px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', pt: 2 } }}
        >
          {body}
        </Dialog>
      )}
      <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </>
  );
}
