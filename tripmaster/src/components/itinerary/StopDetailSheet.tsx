'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Drawer, Dialog, Chip, Collapse,
  Menu, MenuItem, ListItemIcon, ListItemText, ListSubheader, Divider,
} from '@mui/material';
import { alpha }            from '@mui/material/styles';
import CloseIcon            from '@mui/icons-material/Close';
import EditIcon             from '@mui/icons-material/Edit';
import EditNoteIcon         from '@mui/icons-material/EditNote';
import ExpandMoreIcon       from '@mui/icons-material/ExpandMore';
import VisibilityOffIcon    from '@mui/icons-material/VisibilityOff';
import UndoIcon             from '@mui/icons-material/Undo';
import LockIcon             from '@mui/icons-material/Lock';
import NotificationsIcon    from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import AttachFileIcon       from '@mui/icons-material/AttachFile';
import PlaceIcon            from '@mui/icons-material/Place';
import FilterListIcon       from '@mui/icons-material/FilterList';
import HotelIcon            from '@mui/icons-material/Hotel';
import CheckIcon            from '@mui/icons-material/Check';
import EventRepeatIcon      from '@mui/icons-material/EventRepeat';
import MapIcon              from '@mui/icons-material/Map';
import EastIcon             from '@mui/icons-material/East';
import NavigateButton       from '@/components/ui/NavigateButton';
import { haversineKm }      from '@/lib/geo/geocode';
import type { TravelOrigin } from '@/lib/navigation/useTravelTimes';
import type { NavOrigin }  from '@/lib/navigation/links';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import { STOP_CONFIG, QUICK_ADD_TYPES, D } from './Itinerary.config';
import type { Stop }        from './Itinerary.config';
import { stopDuration, fmtDuration, timeRangeLabel, canSkip, canNote, canColour, skipLabel } from './Itinerary.helpers';
import { HighlightSwatches } from './HighlightPicker';
import { HIGHLIGHTS, type Highlight } from '@/lib/itinerary/highlight';
import { recordable, type LinkedItem } from './record';
import { LinkedResources }  from './LinkedResources';
import FlightLive from '@/components/flights/FlightLive';
import { REMINDER_OPTIONS } from '@/lib/push/leads';
import type { FlightStatus } from '@/lib/flights/status';

interface LinkedFile { _id: string; name: string; mimeType?: string; gcsUrl?: string }

interface Props {
  stop:        Stop | null;
  concurrent:  Stop[];                 // other stops at the same time
  isMobile:    boolean;
  linkedFiles: LinkedFile[];
  /** Contacts, to-dos, notes and links from Resources linked to this stop */
  resources?:  LinkedItem[];
  /** Whether a stop has begun, in the zone you'll be in then — after that it's went / didn't go */
  isStarted:   (stop: Stop) => boolean;
  reminder:    { local: string; sent: boolean } | null;
  /** What can be changed here: a lead time for your own stops, on/off for a booking's reminders. */
  reminderSetting?: { mode: 'lead'; value: number | null; own?: boolean } | { mode: 'booking'; on: boolean } | null;
  /** Set, but won't be sent: everything off, the trip muted, or this kind switched off. */
  reminderNotice?:  string | null;
  onReminderChange?: (stop: Stop, value: number | null | boolean) => void;
  /** The flight this stop mirrors, with its live status. */
  flight?:     { t: any; fs: FlightStatus | null; phase?: string } | null;
  onClose:     () => void;
  onSelect:    (stop: Stop) => void;   // jump to a concurrent stop
  onSkip:      (stop: Stop, skipped: boolean) => void;
  onEdit:      (stop: Stop) => void;
  onEditNote:  (stop: Stop) => void;
  onHighlight: (stop: Stop, h: Highlight | null) => void;
  onChangeType: (stop: Stop, type: string) => void;
  /** Open the day picker to repeat this stop on other days */
  onRepeat:    (stop: Stop) => void;
  onOpenLogistics: () => void;
  onFilterType:    (type: string) => void;   // "show me all the gigs"
  /** Where Navigate's times start when you're not near this stop yet */
  navFrom?:        TravelOrigin | null;
  /** Where you're staying that day — a route from each, laid out in the map app */
  hotels?:         NavOrigin[];
  /** Navigate found a pin for this unpinned stop — keep it on the stop */
  onPinned?:       (stop: Stop, pin: { lat: number; lng: number }) => void;
  /** The day's map, centred on this stop */
  onShowOnMap?:    (stop: Stop) => void;
}

// How far a pin is from where you're staying, so a wrong one shows before you set off
function fromStay(stop: Stop, hotels: NavOrigin[]): string | null {
  const c = stop.coordinates;
  const h = hotels.find(x => x.coordinates && Number.isFinite(x.coordinates.lat) && Number.isFinite(x.coordinates.lng));
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng) || !h?.coordinates) return null;
  const km = haversineKm(h.coordinates.lat, h.coordinates.lng, c.lat, c.lng);
  if (km < 0.05) return `At ${h.name}`;
  const dist = km < 1 ? `${Math.round(km * 20) * 50} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  return `${dist} from ${h.name} in a straight line`;
}

const sectionLabelSx = {
  fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: D.muted,
} as const;

// Tap a stop → everything about it, plus what else is on at the same time.
// The read-first view: nothing here moves a stop by accident. It changes with
// time rather than growing: before a stop, the reminder and the clash are what
// matter; once it's started, your note and whether you went.
export function StopDetailSheet({
  stop, concurrent, isMobile, linkedFiles, resources = [], isStarted, reminder, flight,
  reminderSetting = null, reminderNotice = null, onReminderChange,
  onClose, onSelect, onSkip, onEdit, onEditNote, onHighlight, onChangeType, onRepeat, onOpenLogistics, onFilterType, navFrom = null, hotels = [],
  onPinned, onShowOnMap,
}: Props) {
  const [viewerFile,     setViewerFile]     = useState<ViewableFile | null>(null);
  const [reminderOpen,   setReminderOpen]   = useState(false);
  const [concurrentOpen, setConcurrentOpen] = useState(false);
  const [typeAnchor,     setTypeAnchor]     = useState<HTMLElement | null>(null);

  useEffect(() => { setReminderOpen(false); setConcurrentOpen(false); setTypeAnchor(null); }, [stop?._id]);

  const open = !!stop;
  const body = stop && (() => {
    const cfg       = STOP_CONFIG[stop.type] ?? STOP_CONFIG.other;
    const isFact    = stop.source === 'logistics' && stop.locked === true;
    const editable  = !isFact && !!stop._id;
    const started   = isStarted(stop);
    const dur       = stopDuration(stop);
    const place     = stop.locationName || stop.address;
    const myNotes   = stop.myNotes?.trim() ?? '';
    // A booking's stops are rebuilt from the booking — a new type or a repeat wouldn't fit
    const canRetype = !!stop._id && stop.source !== 'logistics';
    const typeName  = (t: string) => { const l = (STOP_CONFIG[t] ?? STOP_CONFIG.other).label; return l.replace(/^\S+\s*/, '') || l; };
    // Shown with the night before — name the date it's really on
    const lateDate  = stop.afterMidnight && stop.scheduledStart
      ? new Date(`${stop.scheduledStart.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })
      : null;
    const btnSx     = { fontFamily: D.body, fontWeight: 700, minHeight: 48, borderRadius: '10px', flex: 1 };
    // The clash is decided once the stop is under way — fold it away, one tap to look again
    const showConcurrent = !started || concurrentOpen;

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

          {canColour(stop) && (
            <Box sx={{ ml: -1, mt: -0.5, mb: 0.5 }}>
              <HighlightSwatches value={stop.highlight} onChange={h => onHighlight(stop, h)} />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            <Chip
              size="small"
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  {typeName(stop.type)}
                  <ExpandMoreIcon sx={{ fontSize: 16, mr: -0.5 }} />
                </Box>
              }
              onClick={e => setTypeAnchor(e.currentTarget)}
              aria-haspopup="true"
              aria-expanded={!!typeAnchor}
              sx={{
                backgroundColor: alpha(cfg.color, 0.1), color: cfg.color, fontWeight: 700, fontFamily: D.body,
                '&:hover': { backgroundColor: alpha(cfg.color, 0.18) },
              }}
            />
            <Menu
              anchorEl={typeAnchor} open={!!typeAnchor} onClose={() => setTypeAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: '12px', minWidth: 220 } } }}
            >
              <MenuItem onClick={() => { setTypeAnchor(null); onFilterType(stop.type); }} sx={{ minHeight: 48 }}>
                <ListItemIcon><FilterListIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Show only this type" slotProps={{ primary: { sx: { fontFamily: D.body, fontWeight: 700 } } }} />
              </MenuItem>
              {canRetype && <Divider />}
              {canRetype && (
                <ListSubheader disableSticky sx={{ ...sectionLabelSx, lineHeight: 1, pt: 1.5, pb: 0.75, backgroundColor: 'transparent' }}>
                  Change to
                </ListSubheader>
              )}
              {canRetype && QUICK_ADD_TYPES.map(t => {
                const c  = STOP_CONFIG[t];
                const on = t === stop.type;
                return (
                  <MenuItem
                    key={t} selected={on} sx={{ minHeight: 44 }}
                    onClick={() => { setTypeAnchor(null); if (!on) onChangeType(stop, t); }}
                  >
                    <ListItemIcon><c.Icon fontSize="small" sx={{ color: c.color }} /></ListItemIcon>
                    <ListItemText primary={typeName(t)} slotProps={{ primary: { sx: { fontFamily: D.body, fontWeight: 600 } } }} />
                    {on && <CheckIcon fontSize="small" sx={{ color: D.muted, ml: 1 }} />}
                  </MenuItem>
                );
              })}
            </Menu>
            {lateDate && (
              <Chip size="small" label={`After midnight · ${lateDate}`}
                sx={{ backgroundColor: alpha(D.navy, 0.08), color: D.navy, fontWeight: 700, fontFamily: D.body }} />
            )}
            {stop.skipped && (
              <Chip size="small" label={started ? 'Didn’t go' : 'Not going'}
                sx={{ backgroundColor: alpha(D.navy, 0.08), color: D.navy, fontWeight: 700, fontFamily: D.body }} />
            )}
            {started && !stop.skipped && canSkip(stop) && recordable(stop) && (
              <Chip size="small" label="Went"
                sx={{ backgroundColor: alpha(D.green, 0.14), color: D.green, fontWeight: 700, fontFamily: D.body }} />
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
                {(() => {
                  const far = fromStay(stop, hotels);
                  return far && <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>{far}</Typography>;
                })()}
              </Box>
              {(stop.address || stop.coordinates) && (
                <NavigateButton
                  destination={{ name: stop.name, address: stop.address, coordinates: stop.coordinates ?? null }}
                  suggestedMode="walking"
                  from={navFrom}
                  onPinned={pin => onPinned?.(stop, pin)}
                  size="small"
                  sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
                />
              )}
            </Box>
          )}

          {(stop.address || stop.coordinates) && hotels.map(h => (
            <NavigateButton
              key={`${h.name}|${h.address ?? ''}`}
              variant="text"
              icon={HotelIcon}
              label={`Route from ${h.name}`}
              origin={h}
              destination={{ name: stop.name, address: stop.address, coordinates: stop.coordinates ?? null }}
              onPinned={pin => onPinned?.(stop, pin)}
              suggestedMode="walking"
              sx={{
                display: 'flex', justifyContent: 'flex-start', width: '100%', minHeight: 44, px: 0, mt: -1, mb: 1,
                fontFamily: D.body, fontSize: '0.85rem', fontWeight: 700, textAlign: 'left',
                '& .MuiButton-startIcon': { ml: 0, mr: 1 },
                '& .MuiButton-startIcon > *': { fontSize: '18px !important' },
              }}
            />
          ))}

          {/* ── A transport stop's destination ── */}
          {(stop.to?.name || stop.to?.address) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <EastIcon sx={{ fontSize: 18, color: D.muted, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.92rem', fontWeight: 700, color: D.navy }}>
                  To {stop.to!.name || stop.to!.address}
                </Typography>
                {stop.to!.name && stop.to!.address && stop.to!.address !== stop.to!.name && (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>{stop.to!.address}</Typography>
                )}
              </Box>
              <NavigateButton
                destination={{ name: stop.to!.name, address: stop.to!.address, coordinates: stop.to!.coordinates ?? null }}
                suggestedMode="driving"
                size="small"
                sx={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
              />
            </Box>
          )}

          {onShowOnMap && stop.coordinates && (
            <Box
              component="button"
              onClick={() => onShowOnMap(stop)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, width: '100%', minHeight: 44, mt: -0.5, mb: 1,
                p: 0, border: 'none', background: 'none', cursor: 'pointer', color: D.muted, textAlign: 'left',
              }}
            >
              <MapIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700 }}>Show on the day’s map</Typography>
            </Box>
          )}

          {flight && (
            <Box sx={{ mb: 1.5 }}>
              <FlightLive t={flight.t} fs={flight.fs} side={flight.phase === 'arrival' ? 'arrival' : 'auto'} />
            </Box>
          )}

          {/* ── Your note: one line until there's something in it ── */}
          {canNote(stop) && (myNotes ? (
            <Box
              onClick={() => onEditNote(stop)}
              sx={{
                mb: 1.5, p: 1.5, borderRadius: '10px', cursor: 'pointer',
                backgroundColor: alpha(D.navy, 0.04),
                '&:hover': { backgroundColor: alpha(D.navy, 0.07) },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ ...sectionLabelSx, flex: 1 }}>Notes</Typography>
                <EditNoteIcon sx={{ fontSize: 18, color: D.muted }} />
              </Box>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.92rem', lineHeight: 1.55, color: D.navy, whiteSpace: 'pre-wrap',
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 8, overflow: 'hidden',
              }}>
                {myNotes}
              </Typography>
            </Box>
          ) : (
            <Box
              component="button"
              onClick={() => onEditNote(stop)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, width: '100%', minHeight: 44, mb: 1,
                p: 0, border: 'none', background: 'none', cursor: 'pointer', color: D.muted, textAlign: 'left',
              }}
            >
              <EditNoteIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700 }}>Add a note</Typography>
            </Box>
          ))}

          {/* ── Reminder: one line, the choices one tap away; gone once it's started ── */}
          {!started && (reminderSetting ? (() => {
            const on    = reminderSetting.mode === 'lead' ? reminderSetting.value !== null : reminderSetting.on;
            const when  = reminder ? ` · ${reminder.sent ? 'sent' : 'at'} ${reminder.local}` : '';
            const label = reminderSetting.mode === 'lead'
              ? (reminderSetting.value === null
                  ? (reminderSetting.own === false ? 'No reminder (trip setting)' : 'No reminder')
                  : `${REMINDER_OPTIONS.find(o => o.value === reminderSetting.value)?.label ?? `${reminderSetting.value}m`} before${reminderSetting.own === false ? ' (default)' : ''}${when}`)
              : (on ? `Reminders on${when}` : 'Reminders off for this booking');
            const choices: Array<{ label: string; value: number | null | boolean; selected: boolean }> =
              reminderSetting.mode === 'lead'
                ? REMINDER_OPTIONS.map(o => ({ label: o.label, value: o.value, selected: o.value === reminderSetting.value }))
                : [{ label: 'On', value: true, selected: on }, { label: 'Off', value: false, selected: !on }];
            return (
              <Box sx={{ mb: 1.5 }}>
                <Box
                  component="button"
                  onClick={() => setReminderOpen(o => !o)}
                  aria-expanded={reminderOpen}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, width: '100%', minHeight: 44,
                    p: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {on ? <NotificationsIcon sx={{ fontSize: 18, color: D.muted }} /> : <NotificationsOffIcon sx={{ fontSize: 18, color: D.muted }} />}
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', fontWeight: 700, color: D.navy, flex: 1 }}>
                    {label}
                  </Typography>
                  <ExpandMoreIcon sx={{
                    fontSize: 20, color: D.muted,
                    transform: reminderOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                  }} />
                </Box>
                <Collapse in={reminderOpen}>
                  <Box role="radiogroup" aria-label="Reminder" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', pt: 0.5 }}>
                    {choices.map(c => (
                      <Chip
                        key={String(c.value)}
                        role="radio"
                        aria-checked={c.selected}
                        label={c.label}
                        onClick={() => !c.selected && onReminderChange?.(stop, c.value)}
                        sx={{
                          height: 40, minWidth: 52, borderRadius: '10px', fontFamily: D.body, fontWeight: 700,
                          backgroundColor: c.selected ? D.navy : alpha(D.navy, 0.06),
                          color: c.selected ? '#fff' : D.navy,
                          '&:hover': { backgroundColor: c.selected ? D.navy : alpha(D.navy, 0.12) },
                        }}
                      />
                    ))}
                  </Box>
                </Collapse>
                {reminderNotice && (
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.terra, mt: 0.75 }}>
                    {reminderNotice}
                  </Typography>
                )}
              </Box>
            );
          })() : reminder && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: D.muted }}>
              <NotificationsIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem' }}>
                {reminder.sent ? `Reminder sent at ${reminder.local}` : `Reminder at ${reminder.local}`}
              </Typography>
            </Box>
          ))}

          {canRetype && (
            <Box
              component="button"
              onClick={() => onRepeat(stop)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, width: '100%', minHeight: 44, mb: 1,
                p: 0, border: 'none', background: 'none', cursor: 'pointer', color: D.muted, textAlign: 'left',
              }}
            >
              <EventRepeatIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700 }}>Repeat on other days</Typography>
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

          {resources.some(r => r.resourceType !== 'file') && (
            <Box sx={{ mb: 1.5 }}>
              <LinkedResources items={resources} />
            </Box>
          )}

          {/* ── Same time — step through a clash without hunting on the grid ── */}
          {concurrent.length > 0 && (
            <Box sx={{ mt: 1, mb: 1 }}>
              {started ? (
                <Box
                  component="button"
                  onClick={() => setConcurrentOpen(o => !o)}
                  aria-expanded={concurrentOpen}
                  sx={{
                    display: 'flex', alignItems: 'center', width: '100%', minHeight: 44,
                    p: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Typography sx={{ ...sectionLabelSx, flex: 1 }}>
                    {concurrent.length} other{concurrent.length === 1 ? '' : 's'} at this time
                  </Typography>
                  <ExpandMoreIcon sx={{
                    fontSize: 20, color: D.muted,
                    transform: concurrentOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                  }} />
                </Box>
              ) : (
                <Typography sx={{ ...sectionLabelSx, mb: 0.75 }}>
                  Also at this time · {concurrent.length}
                </Typography>
              )}
              <Collapse in={showConcurrent}>
                {concurrent.map((o, i) => {
                  const oc = STOP_CONFIG[o.type] ?? STOP_CONFIG.other;
                  const label = skipLabel(o, isStarted(o));
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
                        {o.highlight && (
                          <Box title={HIGHLIGHTS[o.highlight].label} sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: HIGHLIGHTS[o.highlight].swatch, flexShrink: 0 }} />
                        )}
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
                          aria-label={label}
                          title={label}
                          sx={{ width: 44, height: 44, color: D.muted, flexShrink: 0 }}
                        >
                          {o.skipped ? <UndoIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
                        </IconButton>
                      )}
                    </Box>
                  );
                })}
              </Collapse>
            </Box>
          )}
        </Box>

        {/* ── Actions ── (delete is in Edit) */}
        <Box sx={{
          flexShrink: 0, display: 'flex', gap: 1, flexWrap: 'wrap',
          px: { xs: 2.5, sm: 3 }, pt: 1.5, pb: { xs: 'max(env(safe-area-inset-bottom, 12px), 16px)', sm: 2.5 },
          borderTop: `1px solid ${D.rule}`,
        }}>
          {canSkip(stop) && (
            <Button
              variant="outlined"
              startIcon={stop.skipped ? <UndoIcon /> : started ? <CloseIcon /> : <VisibilityOffIcon />}
              // One tap and done — a failed save comes back with its error toast
              onClick={() => { onSkip(stop, !stop.skipped); onClose(); }}
              sx={{ ...btnSx, color: D.navy, borderColor: alpha(D.navy, 0.25) }}
            >
              {skipLabel(stop, started)}
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
