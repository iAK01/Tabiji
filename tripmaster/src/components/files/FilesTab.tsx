'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Divider, LinearProgress, alpha, Fab,
  useTheme, useMediaQuery, Menu, Autocomplete,
  Switch, FormControlLabel,
} from '@mui/material';
import AddIcon                from '@mui/icons-material/Add';
import DeleteIcon             from '@mui/icons-material/Delete';
import DownloadIcon           from '@mui/icons-material/Download';
import OpenInNewIcon          from '@mui/icons-material/OpenInNew';
import MoreVertIcon           from '@mui/icons-material/MoreVert';
import InsertDriveFileIcon    from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon       from '@mui/icons-material/PictureAsPdf';
import ImageIcon              from '@mui/icons-material/Image';
import LinkIcon               from '@mui/icons-material/Link';
import FlightIcon             from '@mui/icons-material/Flight';
import TrainIcon              from '@mui/icons-material/Train';
import HotelIcon              from '@mui/icons-material/Hotel';
import DirectionsCarIcon      from '@mui/icons-material/DirectionsCar';
import EventIcon              from '@mui/icons-material/Event';
import BadgeIcon              from '@mui/icons-material/Badge';
import HealthAndSafetyIcon    from '@mui/icons-material/HealthAndSafety';
import FolderOpenIcon         from '@mui/icons-material/FolderOpen';
import CloudUploadIcon        from '@mui/icons-material/CloudUpload';
import PublicIcon             from '@mui/icons-material/Public';
import EditIcon               from '@mui/icons-material/Edit';
import MusicNoteIcon          from '@mui/icons-material/MusicNote';
import LocationOnIcon         from '@mui/icons-material/LocationOn';
import InfoIcon               from '@mui/icons-material/Info';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PersonIcon             from '@mui/icons-material/Person';
import PhoneIcon              from '@mui/icons-material/Phone';
import EmailIcon              from '@mui/icons-material/Email';
import CampaignIcon           from '@mui/icons-material/Campaign';
import EngineeringIcon        from '@mui/icons-material/Engineering';
import DirectionsBusIcon      from '@mui/icons-material/DirectionsBus';
import LocalHospitalIcon      from '@mui/icons-material/LocalHospital';
import GroupIcon              from '@mui/icons-material/Group';
import NoteAddIcon            from '@mui/icons-material/NoteAdd';
import NotesIcon              from '@mui/icons-material/Notes';
import LightbulbIcon          from '@mui/icons-material/Lightbulb';
import AlarmIcon              from '@mui/icons-material/Alarm';
import StarIcon               from '@mui/icons-material/Star';
import CheckBoxIcon           from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import NotificationsOffIcon   from '@mui/icons-material/NotificationsOff';
import AssignmentIcon         from '@mui/icons-material/Assignment';
import BoltIcon               from '@mui/icons-material/Bolt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedTo {
  collection?: string;
  entryId?: string;
  label?: string;
}

interface TripFile {
  _id: string;
  resourceType: 'file' | 'link' | 'contact' | 'note' | 'todo';
  name: string;
  type: string;
  gcsUrl?: string;
  linkUrl?: string;
  mimeType?: string;
  size?: number;
  phone?: string;
  email?: string;
  body?: string;
  notes?: string;
  linkedTo?: LinkedTo;
  createdAt: string;
  // Todo-specific
  dueAt?: string;
  completed?: boolean;
  completedAt?: string;
  source?: 'manual' | 'packing_advisory';
  packingItemRef?: string;
  notification?: { enabled: boolean };
}

interface LinkableItem {
  label:      string;
  collection: string;
  entryId:    string;
  group:      string;
}

interface FilesTabProps {
  tripId: string;
  fabTrigger?: { action: string; seq: number } | null;
}

type Mode = 'file' | 'link' | 'contact' | 'note' | 'todo';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILE_TYPES = [
  { value: 'boarding_pass',      label: 'Boarding Pass',       Icon: FlightIcon },
  { value: 'train_ticket',       label: 'Train Ticket',        Icon: TrainIcon },
  { value: 'hotel_confirmation', label: 'Hotel Confirmation',  Icon: HotelIcon },
  { value: 'car_hire',           label: 'Car Hire',            Icon: DirectionsCarIcon },
  { value: 'event_brief',        label: 'Event Brief',         Icon: EventIcon },
  { value: 'visa',               label: 'Visa',                Icon: BadgeIcon },
  { value: 'insurance',          label: 'Insurance',           Icon: HealthAndSafetyIcon },
  { value: 'passport',           label: 'Passport Copy',       Icon: BadgeIcon },
  { value: 'other',              label: 'Other',               Icon: InsertDriveFileIcon },
] as const;

const LINK_TYPES = [
  { value: 'primary',            label: 'Primary',             Icon: FolderOpenIcon },
  { value: 'hotel',              label: 'Hotel',               Icon: HotelIcon },
  { value: 'event_website',      label: 'Event Website',       Icon: PublicIcon },
  { value: 'artist_lineup',      label: 'Artist / Lineup',     Icon: MusicNoteIcon },
  { value: 'venue',              label: 'Venue',               Icon: LocationOnIcon },
  { value: 'booking_reference',  label: 'Booking Reference',   Icon: ConfirmationNumberIcon },
  { value: 'useful_info',        label: 'Useful Info',         Icon: InfoIcon },
  { value: 'other',              label: 'Other',               Icon: LinkIcon },
] as const;

const CONTACT_TYPES = [
  { value: 'artist',                label: 'Artist',         Icon: MusicNoteIcon },
  { value: 'venue_manager',         label: 'Venue Manager',  Icon: LocationOnIcon },
  { value: 'event_manager',         label: 'Event Manager',  Icon: EventIcon },
  { value: 'tour_manager',          label: 'Tour Manager',   Icon: GroupIcon },
  { value: 'production',            label: 'Production',     Icon: EngineeringIcon },
  { value: 'promoter',             label: 'Promoter',        Icon: CampaignIcon },
  { value: 'accommodation_contact', label: 'Accommodation',  Icon: HotelIcon },
  { value: 'transport_contact',     label: 'Transport',      Icon: DirectionsBusIcon },
  { value: 'emergency_contact',     label: 'Emergency',      Icon: LocalHospitalIcon },
  { value: 'other',                 label: 'Other',          Icon: PersonIcon },
] as const;

const NOTE_TYPES = [
  { value: 'general',        label: 'General',        Icon: NotesIcon },
  { value: 'observation',    label: 'Observation',    Icon: LightbulbIcon },
  { value: 'reminder',       label: 'Reminder',       Icon: AlarmIcon },
  { value: 'recommendation', label: 'Recommendation', Icon: StarIcon },
] as const;

type FileTypeValue    = typeof FILE_TYPES[number]['value'];
type LinkTypeValue    = typeof LINK_TYPES[number]['value'];
type ContactTypeValue = typeof CONTACT_TYPES[number]['value'];
type NoteTypeValue    = typeof NOTE_TYPES[number]['value'];

const ALL_TYPES = [...FILE_TYPES, ...LINK_TYPES, ...CONTACT_TYPES, ...NOTE_TYPES];

const TYPE_COLOUR: Record<string, string> = {
  boarding_pass: '#C9521B', train_ticket: '#0369a1', hotel_confirmation: '#5c35a0',
  car_hire: '#55702C', event_brief: '#1D2642', visa: '#b45309', insurance: '#0891b2',
  passport: '#b45309', event_website: '#0891b2', artist_lineup: '#7c3aed',
  venue: '#55702C', booking_reference: '#C9521B', useful_info: '#6b7280',
  artist: '#7c3aed', venue_manager: '#55702C', event_manager: '#1D2642',
  tour_manager: '#0369a1', production: '#374151', promoter: '#C9521B',
  accommodation_contact: '#5c35a0', transport_contact: '#0891b2', emergency_contact: '#dc2626',
  general: '#55702C', observation: '#0891b2', reminder: '#C9521B', recommendation: '#7c3aed',
  task: '#1D2642', packing_advisory: '#b45309',
  other: '#6b7280',
};

const BLANK_FILE_FORM    = { name: '', type: 'other' as FileTypeValue,    notes: '' };
const BLANK_LINK_FORM    = { name: '', type: 'event_website' as LinkTypeValue, url: '', notes: '' };
const BLANK_CONTACT_FORM = { name: '', type: 'other' as ContactTypeValue, phone: '', email: '', notes: '' };
const BLANK_NOTE_FORM    = { name: '', type: 'general' as NoteTypeValue,  body: '' };
const BLANK_TODO_FORM    = { name: '', body: '', dueDate: '', dueTime: '', notificationEnabled: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// Convert a stored ISO date string to separate date (YYYY-MM-DD) and time (HH:MM) parts
function splitDueAt(iso: string | undefined): { dueDate: string; dueTime: string } {
  if (!iso) return { dueDate: '', dueTime: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { dueDate: '', dueTime: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    dueTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// Combine dueDate + dueTime into a UTC ISO string for storage
function combineDueAt(dueDate: string, dueTime: string): string | null {
  if (!dueDate || !dueTime) return null;
  const d = new Date(`${dueDate}T${dueTime}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Format a dueAt for display in cards
function formatDueAt(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const match = ALL_TYPES.find(t => t.value === type);
  const Icon  = match?.Icon ?? InsertDriveFileIcon;
  return <Icon sx={{ fontSize: size }} />;
}

function MimeIcon({ mimeType, size = 16 }: { mimeType?: string; size?: number }) {
  if (!mimeType) return <LinkIcon sx={{ fontSize: size, color: '#0891b2' }} />;
  if (mimeType === 'application/pdf') return <PictureAsPdfIcon sx={{ fontSize: size, color: '#e53e3e' }} />;
  if (mimeType.startsWith('image/'))  return <ImageIcon sx={{ fontSize: size, color: '#0369a1' }} />;
  return <InsertDriveFileIcon sx={{ fontSize: size, color: 'text.disabled' }} />;
}

function groupByType(files: TripFile[]): Map<string, TripFile[]> {
  const map = new Map<string, TripFile[]>();
  for (const f of files) {
    map.set(f.type, [...(map.get(f.type) ?? []), f]);
  }
  return map;
}

function transportLabel(t: any): string {
  const from  = t.departureLocation ?? '';
  const to    = t.arrivalLocation   ?? '';
  const route = from && to ? `${from} to ${to}` : (from || to);
  switch (t.type) {
    case 'flight':      return [t.details?.airline, t.details?.flightNumber, route].filter(Boolean).join(' - ');
    case 'train':
    case 'bus':
    case 'ferry':       return [t.details?.operator, route].filter(Boolean).join(' - ');
    case 'car_hire':    return [t.details?.rentalCompany, t.details?.pickupLocation ? `Pickup: ${t.details.pickupLocation}` : ''].filter(Boolean).join(' - ');
    case 'taxi':
    case 'private_transfer': return route || 'Transfer';
    default:            return route || t.type;
  }
}

function buildLinkableItems(logistics: any, itinerary: any): LinkableItem[] {
  const items: LinkableItem[] = [];
  for (let i = 0; i < (logistics?.transportation ?? []).length; i++) {
    const t = logistics.transportation[i];
    items.push({
      label:      transportLabel(t),
      collection: 'transport',
      entryId:    String(i),
      group:      '🚀 Transport',
    });
  }
  for (let i = 0; i < (logistics?.accommodation ?? []).length; i++) {
    const a = logistics.accommodation[i];
    items.push({
      label:      a.name ?? `Accommodation ${i + 1}`,
      collection: 'accommodation',
      entryId:    String(i),
      group:      '🏨 Accommodation',
    });
  }
  for (let i = 0; i < (logistics?.venues ?? []).length; i++) {
    const v = logistics.venues[i];
    items.push({
      label:      v.name ?? `Venue ${i + 1}`,
      collection: 'venue',
      entryId:    String(i),
      group:      '🎟 Venues',
    });
  }
  for (const day of (itinerary?.days ?? [])) {
    for (const stop of (day.stops ?? [])) {
      if (stop.source === 'logistics' && stop.type === 'transport') continue;
      items.push({
        label:      stop.name,
        collection: 'itinerary',
        entryId:    stop._id?.toString() ?? `${day.date}-${stop.name}`,
        group:      `📅 ${day.date?.split('T')[0] ?? 'Itinerary'}`,
      });
    }
  }
  return items;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <Box
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: over ? '#55702C' : 'divider',
        borderRadius: 2,
        p: { xs: 2.5, sm: 3 },
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: over ? alpha('#55702C', 0.04) : 'transparent',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: '#55702C', backgroundColor: alpha('#55702C', 0.03) },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <CloudUploadIcon sx={{ fontSize: 32, color: over ? '#55702C' : 'text.disabled', mb: 0.75 }} />
      <Typography variant="body2" fontWeight={700} color={over ? '#55702C' : 'text.secondary'}>
        Drop a file or click to browse
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
        PDF, JPEG, PNG, WEBP, HEIC · Max 20MB
      </Typography>
    </Box>
  );
}

// ─── Link To selector ─────────────────────────────────────────────────────────

function LinkToSelector({
  items, value, onChange,
}: {
  items:    LinkableItem[];
  value:    LinkableItem | null;
  onChange: (item: LinkableItem | null) => void;
}) {
  if (!items.length) return null;
  return (
    <Autocomplete
      options={items}
      groupBy={opt => opt.group}
      getOptionLabel={opt => opt.label}
      value={value}
      onChange={(_, v) => onChange(v)}
      isOptionEqualToValue={(a, b) => a.collection === b.collection && a.entryId === b.entryId}
      renderInput={params => (
        <TextField
          {...params}
          label="Link to trip item (optional)"
          placeholder="Search transport, venues, itinerary stops..."
          helperText="Link this resource to a specific event so it surfaces in notifications"
        />
      )}
      renderGroup={params => (
        <Box key={params.key}>
          <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 800, color: 'text.disabled', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {params.group}
          </Typography>
          {params.children}
        </Box>
      )}
      clearOnEscape
      fullWidth
    />
  );
}

// ─── To-do card ───────────────────────────────────────────────────────────────

function ToDoCard({
  file,
  onDelete,
  onEdit,
  onToggleComplete,
}: {
  file:             TripFile;
  onDelete:         (id: string) => void;
  onEdit:           (file: TripFile) => void;
  onToggleComplete: (file: TripFile) => void;
}) {
  const [menuAnchor,  setMenuAnchor]  = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggling,    setToggling]    = useState(false);

  const isPacking  = file.type === 'packing_advisory';
  const isComplete = !!file.completed;
  const color      = isPacking ? '#b45309' : '#1D2642';

  const handleToggle = async () => {
    setToggling(true);
    await onToggleComplete(file);
    setToggling(false);
  };

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>

        {/* Completion checkbox */}
        <IconButton
          size="small"
          onClick={handleToggle}
          disabled={toggling}
          sx={{ mt: 0.25, flexShrink: 0, color: isComplete ? 'success.main' : 'text.disabled', p: 0.5 }}
          aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
        >
          {toggling
            ? <CircularProgress size={20} />
            : isComplete
              ? <CheckBoxIcon sx={{ fontSize: 22 }} />
              : <CheckBoxOutlineBlankIcon sx={{ fontSize: 22 }} />
          }
        </IconButton>

        {/* Accent bar */}
        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: isComplete ? alpha(color, 0.3) : color, flexShrink: 0 }} />

        {/* Content */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
            {isPacking && (
              <BoltIcon sx={{ fontSize: 15, color: '#b45309', flexShrink: 0 }} />
            )}
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                fontSize: '0.9rem',
                textDecoration: isComplete ? 'line-through' : 'none',
                color: isComplete ? 'text.disabled' : 'text.primary',
              }}
            >
              {file.name}
            </Typography>
            {file.notification?.enabled && !isComplete && (
              <NotificationsIcon sx={{ fontSize: 14, color: '#55702C', flexShrink: 0 }} />
            )}
          </Box>

          {file.body && (
            <Typography
              variant="body2"
              color={isComplete ? 'text.disabled' : 'text.secondary'}
              sx={{ fontSize: '0.82rem', mb: 0.5, mt: 0.25 }}
            >
              {file.body}
            </Typography>
          )}

          {file.dueAt && (
            <Typography variant="caption" sx={{ fontSize: '0.72rem', color: isComplete ? 'text.disabled' : color, fontWeight: 600, display: 'block' }}>
              {isComplete ? '✓ Done' : `Due: ${formatDueAt(file.dueAt)}`}
            </Typography>
          )}

          {isComplete && file.completedAt && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', display: 'block' }}>
              Completed {new Date(file.completedAt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </Box>

        {/* Menu */}
        <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0, alignSelf: 'flex-start', mt: 0.25 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(file); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
          <EditIcon fontSize="small" /> Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}>
          <DeleteIcon fontSize="small" /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ fontSize: '1.1rem' }}>Delete to-do?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            <strong>{file.name}</strong> will be permanently removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { setConfirmOpen(false); onDelete(file._id); }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({ file, onDelete, onEdit }: { file: TripFile; onDelete: (id: string) => void; onEdit: (file: TripFile) => void }) {
  const [menuAnchor,  setMenuAnchor]  = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const color    = TYPE_COLOUR[file.type] ?? '#55702C';
  const typeMeta = NOTE_TYPES.find(t => t.value === file.type);

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, display: 'flex', gap: 1.5 }}>
        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: file.body ? 0.5 : 0 }}>
            {file.name && <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.9rem' }}>{file.name}</Typography>}
            {typeMeta && <Chip label={typeMeta.label} size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(color, 0.12), color }} />}
          </Box>
          {file.body && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {file.body}
            </Typography>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
            {new Date(file.createdAt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {file.linkedTo?.label ? ` · ${file.linkedTo.label}` : ''}
          </Typography>
        </Box>
        <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0, alignSelf: 'flex-start', mt: 0.25 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(file); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}><EditIcon fontSize="small" /> Edit</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}><DeleteIcon fontSize="small" /> Delete</MenuItem>
      </Menu>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ fontSize: '1.1rem' }}>Delete note?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary"><strong>{file.name || 'This note'}</strong> will be permanently removed. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { setConfirmOpen(false); onDelete(file._id); }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Contact card ─────────────────────────────────────────────────────────────

function ContactCard({ file, onDelete, onEdit }: { file: TripFile; onDelete: (id: string) => void; onEdit: (file: TripFile) => void }) {
  const [menuAnchor,  setMenuAnchor]  = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const color    = TYPE_COLOUR[file.type] ?? '#6b7280';
  const typeMeta = CONTACT_TYPES.find(t => t.value === file.type);

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, display: 'flex', gap: 1.5 }}>
        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, backgroundColor: alpha(color, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TypeIcon type={file.type} size={20} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.9rem' }}>{file.name}</Typography>
            {typeMeta && <Chip label={typeMeta.label} size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(color, 0.12), color }} />}
          </Box>
          {(file.phone || file.email) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {file.phone && (
                <Button component="a" href={`tel:${file.phone}`} size="small" startIcon={<PhoneIcon sx={{ fontSize: '0.95rem !important' }} />} variant="outlined"
                  sx={{ fontSize: '0.78rem', fontWeight: 700, py: 0.5, px: 1.25, borderColor: alpha(color, 0.35), color, '&:hover': { borderColor: color, backgroundColor: alpha(color, 0.06) }, minHeight: 32 }}>
                  {file.phone}
                </Button>
              )}
              {file.email && (
                <Button component="a" href={`mailto:${file.email}`} size="small" startIcon={<EmailIcon sx={{ fontSize: '0.95rem !important' }} />} variant="outlined"
                  sx={{ fontSize: '0.78rem', fontWeight: 700, py: 0.5, px: 1.25, borderColor: alpha(color, 0.35), color, '&:hover': { borderColor: color, backgroundColor: alpha(color, 0.06) }, minHeight: 32 }}>
                  {file.email}
                </Button>
              )}
            </Box>
          )}
          {file.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: '0.78rem' }}>{file.notes}</Typography>}
        </Box>
        <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0, alignSelf: 'flex-start', mt: 0.25 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        {file.phone && <MenuItem component="a" href={`tel:${file.phone}`} onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, fontSize: '0.875rem' }}><PhoneIcon fontSize="small" /> Call {file.phone}</MenuItem>}
        {file.email && <MenuItem component="a" href={`mailto:${file.email}`} onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, fontSize: '0.875rem' }}><EmailIcon fontSize="small" /> Email</MenuItem>}
        {(file.phone || file.email) && <Divider />}
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(file); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}><EditIcon fontSize="small" /> Edit</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}><DeleteIcon fontSize="small" /> Delete</MenuItem>
      </Menu>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ fontSize: '1.1rem' }}>Remove contact?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary"><strong>{file.name}</strong> will be permanently removed. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { setConfirmOpen(false); onDelete(file._id); }}>Remove</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── File / link card ─────────────────────────────────────────────────────────

function ResourceCard({ file, onDelete, onEdit }: { file: TripFile; onDelete: (id: string) => void; onEdit: (file: TripFile) => void }) {
  const [menuAnchor,  setMenuAnchor]  = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const color     = TYPE_COLOUR[file.type] ?? '#6b7280';
  const isLink    = file.resourceType === 'link';
  const actionUrl = isLink ? file.linkUrl : file.gcsUrl;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 1.75 } }}>
        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
        <Box sx={{ flexShrink: 0 }}>
          {isLink
            ? <LinkIcon sx={{ fontSize: 20, color }} />
            : <MimeIcon mimeType={file.mimeType} size={20} />
          }
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </Typography>
          {file.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block' }}>{file.notes}</Typography>}
          {!isLink && file.size && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>{formatBytes(file.size)}</Typography>
          )}
          {file.linkedTo?.label && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', display: 'block' }}>↳ {file.linkedTo.label}</Typography>
          )}
        </Box>
        {actionUrl && (
          <IconButton size="small" component="a" href={actionUrl} target="_blank" rel="noopener noreferrer"
            aria-label={isLink ? 'Open link' : 'Download file'}>
            {isLink ? <OpenInNewIcon fontSize="small" /> : <DownloadIcon fontSize="small" />}
          </IconButton>
        )}
        <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        {actionUrl && (
          <MenuItem component="a" href={actionUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
            {isLink ? <OpenInNewIcon fontSize="small" /> : <DownloadIcon fontSize="small" />}
            {isLink ? 'Open link' : 'Download'}
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(file); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}><EditIcon fontSize="small" /> Edit details</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}><DeleteIcon fontSize="small" /> {isLink ? 'Remove link' : 'Delete file'}</MenuItem>
      </Menu>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ fontSize: '1.1rem' }}>{isLink ? 'Remove link?' : 'Delete file?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary"><strong>{file.name}</strong> will be permanently removed. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { setConfirmOpen(false); onDelete(file._id); }}>{isLink ? 'Remove' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FilesTab({ tripId, fabTrigger }: FilesTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [files,         setFiles]         = useState<TripFile[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [linkableItems, setLinkableItems] = useState<LinkableItem[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [mode,          setMode]          = useState<Mode>('file');
  const [pendingFile,   setPendingFile]   = useState<File | null>(null);
  const [fileForm,      setFileForm]      = useState({ ...BLANK_FILE_FORM });
  const [linkForm,      setLinkForm]      = useState({ ...BLANK_LINK_FORM });
  const [contactForm,   setContactForm]   = useState({ ...BLANK_CONTACT_FORM });
  const [noteForm,      setNoteForm]      = useState({ ...BLANK_NOTE_FORM });
  const [todoForm,      setTodoForm]      = useState({ ...BLANK_TODO_FORM });
  const [linkedTo,      setLinkedTo]      = useState<LinkableItem | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [editingFile,   setEditingFile]   = useState<TripFile | null>(null);

  // Refs for the date/time inputs — MUI's synthetic event layer can silently
  // drop onChange on type="date" and type="time" in some versions.
  // Reading from the DOM directly at submit time is bulletproof.
  const dueDateRef = useRef<HTMLInputElement>(null);
  const dueTimeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${tripId}/files`).then(r => r.json()),
      fetch(`/api/trips/${tripId}/logistics`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/trips/${tripId}/itinerary`).then(r => r.json()).catch(() => ({})),
    ]).then(([filesData, logisticsData, itineraryData]) => {
      setFiles(filesData.files ?? []);
      const items = buildLinkableItems(
        logisticsData.logistics ?? logisticsData,
        itineraryData.itinerary ?? itineraryData
      );
      setLinkableItems(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tripId]);

  const openDialog = (m: Mode) => {
    setMode(m);
    setPendingFile(null);
    setFileForm({ ...BLANK_FILE_FORM });
    setLinkForm({ ...BLANK_LINK_FORM });
    setContactForm({ ...BLANK_CONTACT_FORM });
    setNoteForm({ ...BLANK_NOTE_FORM });
    setTodoForm({ ...BLANK_TODO_FORM });
    setLinkedTo(null);
    setEditingFile(null);
    setError(null);
    setDialogOpen(true);
  };

  useEffect(() => {
  if (!fabTrigger) return;
  const validModes: Mode[] = ['file', 'link', 'contact', 'note', 'todo'];
  if (validModes.includes(fabTrigger.action as Mode)) openDialog(fabTrigger.action as Mode);
}, [fabTrigger]);

  const openEdit = (file: TripFile) => {
    setEditingFile(file);
    setError(null);

    const existingLink = file.linkedTo?.label
      ? linkableItems.find(i => i.label === file.linkedTo!.label) ?? null
      : null;
    setLinkedTo(existingLink);

    if (file.resourceType === 'todo') {
      setMode('todo');
      const { dueDate, dueTime } = splitDueAt(file.dueAt);
      setTodoForm({
        name:                file.name ?? '',
        body:                file.body ?? '',
        dueDate,
        dueTime,
        notificationEnabled: file.notification?.enabled ?? false,
      });
    } else if (file.resourceType === 'note') {
      setMode('note');
      setNoteForm({ name: file.name ?? '', type: file.type as NoteTypeValue, body: file.body ?? '' });
    } else if (file.resourceType === 'contact') {
      setMode('contact');
      setContactForm({ name: file.name, type: file.type as ContactTypeValue, phone: file.phone ?? '', email: file.email ?? '', notes: file.notes ?? '' });
    } else if (file.resourceType === 'link') {
      setMode('link');
      setLinkForm({ name: file.name, type: file.type as LinkTypeValue, url: file.linkUrl ?? '', notes: file.notes ?? '' });
    } else {
      setMode('file');
      setFileForm({ name: file.name, type: file.type as FileTypeValue, notes: file.notes ?? '' });
      setPendingFile(null);
    }
    setDialogOpen(true);
  };

  const handleFileSelected = (file: File) => {
    setPendingFile(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setFileForm(p => ({ ...p, name: nameWithoutExt }));
    setError(null);
    if (!dialogOpen) setDialogOpen(true);
  };

  // ── Toggle complete (PATCH) ────────────────────────────────────────────────
  const handleToggleComplete = async (file: TripFile) => {
    const newCompleted = !file.completed;
    // Optimistic update
    setFiles(prev => prev.map(f =>
      f._id === file._id ? { ...f, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : undefined } : f
    ));
    try {
      const res  = await fetch(`/api/trips/${tripId}/files/${file._id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ completed: newCompleted }),
      });
      const data = await res.json();
      if (res.ok && data.file) {
        setFiles(prev => prev.map(f => f._id === file._id ? data.file : f));
      }
    } catch {
      // Revert on failure
      setFiles(prev => prev.map(f =>
        f._id === file._id ? { ...f, completed: file.completed, completedAt: file.completedAt } : f
      ));
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadPct(0);
    setError(null);

    const fd = new FormData();

    if (linkedTo) {
      fd.append('linkedTo', JSON.stringify({
        label:      linkedTo.label,
        collection: linkedTo.collection,
        entryId:    linkedTo.entryId,
      }));
    }

    if (mode === 'todo') {
      if (!todoForm.name.trim()) { setError('Title is required'); setUploading(false); return; }

      // Read directly from DOM — bypasses any MUI synthetic event issues
      const dueDate = dueDateRef.current?.value ?? '';
      const dueTime = dueTimeRef.current?.value ?? '';
      const dueAtIso = combineDueAt(dueDate, dueTime);

      console.log('[todo submit] dueDate:', dueDate, 'dueTime:', dueTime, 'iso:', dueAtIso);

      fd.append('resourceType', 'todo');
      fd.append('name', todoForm.name.trim());
      if (todoForm.body.trim()) fd.append('body', todoForm.body.trim());
      if (dueAtIso) fd.append('dueAt', dueAtIso);
      fd.append('notification.enabled', todoForm.notificationEnabled && !!dueAtIso ? 'true' : 'false');
      fd.append('source', 'manual');
    } else if (mode === 'note') {
      if (!noteForm.body.trim()) { setError('Note content is required'); setUploading(false); return; }
      fd.append('resourceType', 'note');
      fd.append('name',  noteForm.name.trim());
      fd.append('type',  noteForm.type);
      fd.append('body',  noteForm.body.trim());
    } else if (mode === 'contact') {
      if (!contactForm.name) { setError('Name is required'); setUploading(false); return; }
      if (!contactForm.phone && !contactForm.email) { setError('At least one of phone or email is required'); setUploading(false); return; }
      fd.append('resourceType', 'contact');
      fd.append('name',  contactForm.name.trim());
      fd.append('type',  contactForm.type);
      fd.append('phone', contactForm.phone.trim());
      fd.append('email', contactForm.email.trim());
      fd.append('notes', contactForm.notes);
    } else if (mode === 'link') {
      if (!linkForm.url || !linkForm.name) { setError('Name and URL are required'); setUploading(false); return; }
      fd.append('resourceType', 'link');
      fd.append('name',    linkForm.name.trim());
      fd.append('type',    linkForm.type);
      fd.append('linkUrl', linkForm.url.trim());
      fd.append('notes',   linkForm.notes);
    } else {
      if (editingFile) {
        fd.append('resourceType', 'file');
        fd.append('name',  fileForm.name.trim());
        fd.append('type',  fileForm.type);
        fd.append('notes', fileForm.notes);
      } else {
        if (!pendingFile || !fileForm.name) { setError('File and name are required'); setUploading(false); return; }
        fd.append('resourceType', 'file');
        fd.append('file',  pendingFile);
        fd.append('name',  fileForm.name.trim());
        fd.append('type',  fileForm.type);
        fd.append('notes', fileForm.notes);
      }
    }

    const isEdit = !!editingFile;
    const url    = isEdit ? `/api/trips/${tripId}/files/${editingFile!._id}` : `/api/trips/${tripId}/files`;
    const method = isEdit ? 'PUT' : 'POST';

    const tick = setInterval(() => setUploadPct(p => Math.min(p + 12, 85)), 300);
    try {
      const res  = await fetch(url, { method, body: fd });
      const data = await res.json();
      clearInterval(tick);
      if (!res.ok) { setError(data.error ?? 'Failed'); setUploading(false); return; }
      setUploadPct(100);
      if (isEdit) {
        setFiles(prev => prev.map(f => f._id === editingFile!._id ? data.file : f));
      } else {
        setFiles(prev => [data.file, ...prev]);
      }
      setTimeout(() => {
        setDialogOpen(false); setUploading(false); setUploadPct(0);
        setPendingFile(null); setEditingFile(null); setLinkedTo(null);
      }, 400);
    } catch {
      clearInterval(tick);
      setError('Something went wrong — please try again');
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    await fetch(`/api/trips/${tripId}/files/${fileId}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f._id !== fileId));
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // Split todos from all other resource types
  const todos    = files.filter(f => f.resourceType === 'todo');
  const nonTodos = files.filter(f => f.resourceType !== 'todo');

  // Sort todos: incomplete first (by dueAt asc), then completed (by completedAt desc)
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (!a.completed && !b.completed) {
      // Both incomplete — sort by dueAt ascending (soonest first), undated last
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    }
    // Both complete — most recently completed first
    const aAt = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bAt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bAt - aAt;
  });

  const pendingTodos    = sortedTodos.filter(t => !t.completed);
  const completedTodos  = sortedTodos.filter(t => t.completed);

  const grouped    = groupByType(nonTodos);
  const typeOrder  = ALL_TYPES.map(t => t.value);
  const sortedKeys = [...grouped.keys()].sort((a, b) => typeOrder.indexOf(a as any) - typeOrder.indexOf(b as any));

  const canSubmit =
    mode === 'todo'    ? !!todoForm.name.trim() :
    mode === 'note'    ? !!noteForm.body.trim() :
    mode === 'contact' ? !!contactForm.name.trim() && (!!contactForm.phone.trim() || !!contactForm.email.trim()) :
    mode === 'link'    ? !!linkForm.name.trim() && !!linkForm.url.trim() :
                         (!!editingFile || !!pendingFile) && !!fileForm.name.trim();
    mode === 'note'    ? !!noteForm.body.trim() :
    mode === 'contact' ? !!contactForm.name.trim() && (!!contactForm.phone.trim() || !!contactForm.email.trim()) :
    mode === 'link'    ? !!linkForm.name.trim() && !!linkForm.url.trim() :
                         (!!editingFile || !!pendingFile) && !!fileForm.name.trim();

  const dialogTitle =
    editingFile
      ? mode === 'todo'    ? 'Edit to-do'
      : mode === 'note'    ? 'Edit note'
      : mode === 'contact' ? 'Edit contact'
      : mode === 'link'    ? 'Edit link'
      :                      'Edit file details'
      : mode === 'todo'    ? 'Add a to-do'
      : mode === 'note'    ? 'Add a note'
      : mode === 'contact' ? 'Add a contact'
      : mode === 'link'    ? 'Add a link'
      :                      'Upload a file';

  const submitLabel =
    uploading          ? <CircularProgress size={20} sx={{ color: 'white' }} /> :
    mode === 'todo'    ? (editingFile ? 'Save to-do'   : 'Add to-do') :
    mode === 'note'    ? (editingFile ? 'Save note'    : 'Add note') :
    mode === 'contact' ? (editingFile ? 'Save contact' : 'Add contact') :
    mode === 'link'    ? (editingFile ? 'Save link'    : 'Add link') :
                         (editingFile ? 'Save file'    : 'Upload file');

  const totalCount = files.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pb: 10 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
            Resources
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {totalCount === 0 ? 'No resources yet' : `${totalCount} item${totalCount !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<AssignmentIcon />} onClick={() => openDialog('todo')} sx={{ fontWeight: 700 }}>Add to-do</Button>
          <Button variant="outlined" startIcon={<PersonIcon />} onClick={() => openDialog('contact')} sx={{ fontWeight: 700 }}>Add contact</Button>
          <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => openDialog('link')} sx={{ fontWeight: 700 }}>Add link</Button>
          <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={() => openDialog('note')} sx={{ fontWeight: 700 }}>Add note</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog('file')} sx={{ fontWeight: 700 }}>Upload file</Button>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && totalCount === 0 && (
        <Paper sx={{ p: { xs: 3, sm: 4 }, backgroundColor: 'background.paper' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <FolderOpenIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body1" fontWeight={700} color="text.secondary" gutterBottom>No resources yet</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 380, mx: 'auto' }}>
              Upload boarding passes and documents, save links, add key contacts, jot a note, or add a to-do with reminders.
            </Typography>
          </Box>
          <DropZone onFile={f => { setMode('file'); handleFileSelected(f); }} />
        </Paper>
      )}

      {!loading && totalCount > 0 && (
        <>
          {/* ── To-dos section — always first ── */}
          {sortedTodos.length > 0 && (
            <Paper sx={{ backgroundColor: 'background.paper', overflow: 'hidden' }}>
              <Box sx={{
                px: { xs: 2, sm: 2.5 }, py: 1.5,
                display: 'flex', alignItems: 'center', gap: 1.25,
                borderBottom: '1px solid', borderColor: 'divider',
                backgroundColor: alpha('#1D2642', 0.04),
              }}>
                <AssignmentIcon sx={{ fontSize: 17, color: '#1D2642' }} />
                <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.82rem', letterSpacing: 0.3, textTransform: 'uppercase', color: '#1D2642' }}>
                  To-dos
                </Typography>
                {pendingTodos.length > 0 && (
                  <Chip
                    label={`${pendingTodos.length} pending`}
                    size="small"
                    sx={{ ml: 'auto', height: 20, backgroundColor: alpha('#1D2642', 0.12), color: '#1D2642', fontWeight: 800, fontSize: '0.72rem' }}
                  />
                )}
                {completedTodos.length > 0 && pendingTodos.length === 0 && (
                  <Chip
                    label={`${completedTodos.length} done`}
                    size="small"
                    color="success"
                    sx={{ ml: 'auto', height: 20, fontWeight: 800, fontSize: '0.72rem' }}
                  />
                )}
              </Box>

              {/* Pending todos */}
              {pendingTodos.map((todo, i) => (
                <Box key={todo._id}>
                  {i > 0 && <Divider />}
                  <ToDoCard
                    file={todo}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                    onToggleComplete={handleToggleComplete}
                  />
                </Box>
              ))}

              {/* Completed todos — shown below pending with a subtle separator */}
              {completedTodos.length > 0 && (
                <>
                  {pendingTodos.length > 0 && (
                    <Box sx={{ px: 2.5, py: 1, backgroundColor: alpha('#000', 0.02), borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Completed
                      </Typography>
                    </Box>
                  )}
                  {completedTodos.map((todo, i) => (
                    <Box key={todo._id}>
                      {(i > 0 || pendingTodos.length > 0) && <Divider />}
                      <ToDoCard
                        file={todo}
                        onDelete={handleDelete}
                        onEdit={openEdit}
                        onToggleComplete={handleToggleComplete}
                      />
                    </Box>
                  ))}
                </>
              )}
            </Paper>
          )}

          {/* ── Drop zone for files ── */}
          <DropZone onFile={f => { setMode('file'); handleFileSelected(f); }} />

          {/* ── Grouped resources (files / links / contacts / notes) ── */}
          {sortedKeys.map(type => {
            const group    = grouped.get(type) ?? [];
            const typeMeta = ALL_TYPES.find(t => t.value === type);
            const color    = TYPE_COLOUR[type] ?? '#6b7280';
            return (
              <Paper key={type} sx={{ backgroundColor: 'background.paper', overflow: 'hidden' }}>
                <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: alpha(color, 0.04) }}>
                  <Box sx={{ color, display: 'flex' }}><TypeIcon type={type} size={17} /></Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.82rem', letterSpacing: 0.3, textTransform: 'uppercase', color }}>
                    {typeMeta?.label ?? type}
                  </Typography>
                  <Chip label={group.length} size="small" sx={{ ml: 'auto', height: 20, backgroundColor: alpha(color, 0.12), color, fontWeight: 800, fontSize: '0.72rem' }} />
                </Box>
                {group.map((file, i) => (
                  <Box key={file._id}>
                    {i > 0 && <Divider />}
                    {file.resourceType === 'note'
                      ? <NoteCard    file={file} onDelete={handleDelete} onEdit={openEdit} />
                      : file.resourceType === 'contact'
                      ? <ContactCard file={file} onDelete={handleDelete} onEdit={openEdit} />
                      : <ResourceCard file={file} onDelete={handleDelete} onEdit={openEdit} />
                    }
                  </Box>
                ))}
              </Paper>
            );
          })}
        </>
      )}

      {/* ── Dialog ── */}
      <Dialog
        open={dialogOpen}
        onClose={() => { if (!uploading) { setDialogOpen(false); setEditingFile(null); setLinkedTo(null); } }}
        maxWidth="sm" fullWidth fullScreen={mobile}
      >
        <DialogTitle fontWeight={700} sx={{ fontSize: { xs: '1.15rem', sm: '1.2rem' } }}>
          {dialogTitle}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

            {/* ── Todo mode ── */}
            {mode === 'todo' && (
              <>
                <TextField
                  label="Title"
                  value={todoForm.name}
                  autoFocus
                  fullWidth
                  required
                  disabled={uploading}
                  onChange={e => setTodoForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Charge all devices before packing"
                  InputProps={{ sx: mobile ? { fontSize: '1rem' } : {} }}
                />
                <TextField
                  label="Notes (optional)"
                  value={todoForm.body}
                  fullWidth
                  multiline
                  rows={3}
                  disabled={uploading}
                  onChange={e => setTodoForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Any extra detail..."
                  InputProps={{ sx: mobile ? { fontSize: '1rem' } : {} }}
                />
                {/* Plain inputs — MUI wrappers swallow onChange/refs on date in this MUI build */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                      Due date
                    </Typography>
                    <input
                      ref={dueDateRef}
                      type="date"
                      defaultValue={todoForm.dueDate}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        fontSize: mobile ? '1rem' : '0.875rem',
                        border: '1px solid rgba(0,0,0,0.23)',
                        borderRadius: 4,
                        backgroundColor: 'transparent',
                        outline: 'none',
                        color: 'inherit',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                      Due time
                    </Typography>
                    <input
                      ref={dueTimeRef}
                      type="time"
                      defaultValue={todoForm.dueTime}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        fontSize: mobile ? '1rem' : '0.875rem',
                        border: '1px solid rgba(0,0,0,0.23)',
                        borderRadius: 4,
                        backgroundColor: 'transparent',
                        outline: 'none',
                        color: 'inherit',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
                  Set both to enable push notification
                </Typography>
                {/* Notification toggle — always visible so user can enable it after setting the date/time */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={todoForm.notificationEnabled}
                      onChange={e => setTodoForm(p => ({ ...p, notificationEnabled: e.target.checked }))}
                      disabled={uploading}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {todoForm.notificationEnabled
                        ? <NotificationsIcon sx={{ fontSize: 18, color: '#55702C' }} />
                        : <NotificationsOffIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      }
                      <Typography variant="body2" fontWeight={600}>
                        {todoForm.notificationEnabled ? 'Push notification on (requires due date + time)' : 'Push notification off'}
                      </Typography>
                    </Box>
                  }
                />
              </>
            )}

            {/* ── Note mode ── */}
            {mode === 'note' && (
              <>
                <TextField
                  label="Title (optional)" value={noteForm.name} autoFocus fullWidth disabled={uploading}
                  onChange={e => setNoteForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Amazing support act, must check out"
                />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Note type</InputLabel>
                  <Select value={noteForm.type} label="Note type" onChange={e => setNoteForm(p => ({ ...p, type: e.target.value as NoteTypeValue }))}>
                    {NOTE_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  label="Note" value={noteForm.body} fullWidth multiline rows={5} disabled={uploading}
                  onChange={e => setNoteForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="What's on your mind?"
                />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* ── Contact mode ── */}
            {mode === 'contact' && (
              <>
                <TextField
                  label="Name" value={contactForm.name} autoFocus fullWidth required disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Contact type</InputLabel>
                  <Select value={contactForm.type} label="Contact type" onChange={e => setContactForm(p => ({ ...p, type: e.target.value as ContactTypeValue }))}>
                    {CONTACT_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  label="Phone" value={contactForm.phone} fullWidth disabled={uploading} type="tel"
                  onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                />
                <TextField
                  label="Email" value={contactForm.email} fullWidth disabled={uploading} type="email"
                  onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                />
                <TextField
                  label="Notes (optional)" value={contactForm.notes} fullWidth disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))}
                />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* ── Link mode ── */}
            {mode === 'link' && (
              <>
                <TextField
                  label="Name" value={linkForm.name} autoFocus fullWidth required disabled={uploading}
                  onChange={e => setLinkForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Venue website"
                />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Link type</InputLabel>
                  <Select value={linkForm.type} label="Link type" onChange={e => setLinkForm(p => ({ ...p, type: e.target.value as LinkTypeValue }))}>
                    {LINK_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  label="URL" value={linkForm.url} fullWidth required disabled={uploading} type="url"
                  onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://"
                />
                <TextField
                  label="Notes (optional)" value={linkForm.notes} fullWidth disabled={uploading}
                  onChange={e => setLinkForm(p => ({ ...p, notes: e.target.value }))}
                />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* ── File mode ── */}
            {mode === 'file' && !pendingFile && !editingFile && <DropZone onFile={handleFileSelected} />}
            {mode === 'file' && editingFile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 1.5, backgroundColor: alpha('#55702C', 0.06), border: '1px solid', borderColor: alpha('#55702C', 0.2) }}>
                <MimeIcon mimeType={editingFile.mimeType} size={22} />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>{editingFile.name}</Typography>
                  <Typography variant="caption" color="text.secondary">Editing metadata only — file cannot be replaced</Typography>
                </Box>
              </Box>
            )}
            {mode === 'file' && pendingFile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 1.5, backgroundColor: alpha('#55702C', 0.06), border: '1px solid', borderColor: alpha('#55702C', 0.2) }}>
                <MimeIcon mimeType={pendingFile.type} size={22} />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatBytes(pendingFile.size)}</Typography>
                </Box>
                {!uploading && <IconButton size="small" onClick={() => setPendingFile(null)}><DeleteIcon fontSize="small" /></IconButton>}
              </Box>
            )}
            {mode === 'file' && (pendingFile || editingFile) && (
              <>
                <TextField
                  label="Display name" value={fileForm.name} autoFocus={!!pendingFile} fullWidth disabled={uploading}
                  onChange={e => setFileForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Outbound boarding pass"
                />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Document type</InputLabel>
                  <Select value={fileForm.type} label="Document type" onChange={e => setFileForm(p => ({ ...p, type: e.target.value as FileTypeValue }))}>
                    {FILE_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  label="Notes (optional)" value={fileForm.notes} fullWidth disabled={uploading}
                  onChange={e => setFileForm(p => ({ ...p, notes: e.target.value }))}
                />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* Upload progress */}
            {uploading && uploadPct > 0 && mode === 'file' && (
              <LinearProgress variant="determinate" value={uploadPct} sx={{ borderRadius: 2, height: 6 }} />
            )}

            {error && (
              <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>{error}</Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 3, sm: 2.5 }, pt: 1, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            onClick={() => { setDialogOpen(false); setEditingFile(null); setLinkedTo(null); }}
            disabled={uploading}
            fullWidth={mobile}
            size={mobile ? 'large' : 'medium'}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || !canSubmit}
            fullWidth={mobile}
            size={mobile ? 'large' : 'medium'}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}