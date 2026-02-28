'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Divider, LinearProgress, alpha, Fab,
  useTheme, useMediaQuery, Menu, Autocomplete,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedTo {
  collection?: string;
  entryId?: string;
  label?: string;
}

interface TripFile {
  _id: string;
  resourceType: 'file' | 'link' | 'contact' | 'note';
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
}

// A linkable item built from logistics + itinerary data
interface LinkableItem {
  label:      string;   // Human-readable, also used for matching in notify route
  collection: string;   // 'transportation' | 'accommodation' | 'venue' | 'itinerary'
  entryId:    string;   // Index or stop _id
  group:      string;   // Group header in dropdown
}

interface FilesTabProps { tripId: string; }

type Mode = 'file' | 'link' | 'contact' | 'note';

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
  { value: 'promoter',              label: 'Promoter',       Icon: CampaignIcon },
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
  other: '#6b7280',
};

const BLANK_FILE_FORM    = { name: '', type: 'other' as FileTypeValue,    notes: '' };
const BLANK_LINK_FORM    = { name: '', type: 'event_website' as LinkTypeValue, url: '', notes: '' };
const BLANK_CONTACT_FORM = { name: '', type: 'other' as ContactTypeValue, phone: '', email: '', notes: '' };
const BLANK_NOTE_FORM    = { name: '', type: 'general' as NoteTypeValue,  body: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
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

// Build human-readable label for a transport entry — must match what notify route searches
function transportLabel(t: any): string {
  const from  = t.departureLocation ?? '';
  const to    = t.arrivalLocation   ?? '';
  const route = from && to ? `${from} to ${to}` : (from || to);
  switch (t.type) {
    case 'flight':
      return [t.details?.airline, t.details?.flightNumber, route].filter(Boolean).join(' · ');
    case 'train':
    case 'bus':
    case 'ferry':
      return [t.details?.operator, route].filter(Boolean).join(' · ');
    case 'car_hire':
      return [t.details?.rentalCompany, t.details?.pickupLocation ? `Pickup: ${t.details.pickupLocation}` : ''].filter(Boolean).join(' · ');
    case 'taxi':
    case 'private_transfer':
      return route || 'Transfer';
    default:
      return route || t.type;
  }
}

function transportEmoji(type: string): string {
  const map: Record<string, string> = {
    flight: '✈', train: '🚂', bus: '🚌', ferry: '⛴',
    car_hire: '🚗', car: '🚗', taxi: '🚕', private_transfer: '🚐', bicycle: '🚲',
  };
  return map[type] ?? '🚌';
}

// Build the list of linkable items from logistics + itinerary data
function buildLinkableItems(logistics: any, itinerary: any): LinkableItem[] {
  const items: LinkableItem[] = [];

  // Transport entries
  for (let i = 0; i < (logistics?.transportation ?? []).length; i++) {
    const t = logistics.transportation[i];
    items.push({
      label:      transportLabel(t),
      collection: 'transportation',
      entryId:    String(i),
      group:      `${transportEmoji(t.type)} Transport`,
    });
  }

  // Accommodation entries
  for (let i = 0; i < (logistics?.accommodation ?? []).length; i++) {
    const a = logistics.accommodation[i];
    items.push({
      label:      a.name ?? `Accommodation ${i + 1}`,
      collection: 'accommodation',
      entryId:    String(i),
      group:      '🏨 Accommodation',
    });
  }

  // Venues
  for (let i = 0; i < (logistics?.venues ?? []).length; i++) {
    const v = logistics.venues[i];
    items.push({
      label:      v.name ?? `Venue ${i + 1}`,
      collection: 'venue',
      entryId:    String(i),
      group:      '🎟 Venues',
    });
  }

  // Itinerary stops (skip logistics-synced transport stops)
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
  items,
  value,
  onChange,
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
            {file.name && (
              <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.9rem' }}>{file.name}</Typography>
            )}
            {typeMeta && (
              <Chip label={typeMeta.label} size="small"
                sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(color, 0.12), color }} />
            )}
          </Box>
          {file.body && (
            <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.875rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {file.body}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              {new Date(file.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {new Date(file.createdAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            {file.linkedTo?.label && (
              <>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                <Chip label={file.linkedTo.label} size="small" sx={{ height: 16, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha(color, 0.1), color }} />
              </>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }} sx={{ flexShrink: 0, alignSelf: 'flex-start', mt: 0.25 }}>
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
        <DialogTitle fontWeight={700} sx={{ fontSize: '1.1rem' }}>Delete note?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">This note will be permanently deleted. This cannot be undone.</Typography>
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
                  sx={{ fontSize: '0.78rem', fontWeight: 700, py: 0.5, px: 1.25, borderColor: alpha('#0891b2', 0.35), color: '#0891b2', '&:hover': { borderColor: '#0891b2', backgroundColor: alpha('#0891b2', 0.06) }, minHeight: 32 }}>
                  {file.email}
                </Button>
              )}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              {new Date(file.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
            {file.linkedTo?.label && (
              <>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                <Chip label={file.linkedTo.label} size="small" sx={{ height: 16, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha(color, 0.1), color }} />
              </>
            )}
          </Box>
          {file.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 0.25, display: 'block' }}>{file.notes}</Typography>}
        </Box>
        <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }} sx={{ flexShrink: 0, alignSelf: 'flex-start', mt: 0.25 }}>
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
          {isLink ? <LinkIcon sx={{ fontSize: 20, color: '#0891b2' }} /> : <MimeIcon mimeType={file.mimeType} size={20} />}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.88rem', sm: '0.875rem' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
            {isLink && file.linkUrl && <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{file.linkUrl}</Typography>}
            {!isLink && file.size && <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>{formatBytes(file.size)}</Typography>}
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              {new Date(file.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
            {file.linkedTo?.label && (
              <>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                <Chip label={file.linkedTo.label} size="small" sx={{ height: 16, fontSize: '0.65rem', fontWeight: 700, backgroundColor: alpha(color, 0.1), color }} />
              </>
            )}
          </Box>
          {file.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 0.25, display: 'block' }}>{file.notes}</Typography>}
        </Box>
        <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }} sx={{ flexShrink: 0 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <MenuItem component="a" href={actionUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
          <OpenInNewIcon fontSize="small" /> {isLink ? 'Open link' : 'Open'}
        </MenuItem>
        {!isLink && (
          <MenuItem component="a" href={actionUrl} download={file.name} onClick={() => setMenuAnchor(null)} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
            <DownloadIcon fontSize="small" /> Download
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(file); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}><EditIcon fontSize="small" /> Edit</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}><DeleteIcon fontSize="small" /> Delete</MenuItem>
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

export default function FilesTab({ tripId }: FilesTabProps) {
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
  const [linkedTo,      setLinkedTo]      = useState<LinkableItem | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [editingFile,   setEditingFile]   = useState<TripFile | null>(null);

  // Fetch files, logistics, and itinerary in parallel on mount
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
    setLinkedTo(null);
    setEditingFile(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (file: TripFile) => {
    setEditingFile(file);
    setError(null);

    // Restore linkedTo selection if the file has one
    const existingLink = file.linkedTo?.label
      ? linkableItems.find(i => i.label === file.linkedTo!.label) ?? null
      : null;
    setLinkedTo(existingLink);

    if (file.resourceType === 'note') {
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

  const handleUpload = async () => {
    setUploading(true);
    setUploadPct(0);
    setError(null);

    const fd = new FormData();

    // Append linkedTo as JSON string — matches what the API expects
    if (linkedTo) {
      fd.append('linkedTo', JSON.stringify({
        label:      linkedTo.label,
        collection: linkedTo.collection,
        entryId:    linkedTo.entryId,
      }));
    }

    if (mode === 'note') {
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

  const grouped    = groupByType(files);
  const typeOrder  = ALL_TYPES.map(t => t.value);
  const sortedKeys = [...grouped.keys()].sort((a, b) => typeOrder.indexOf(a as any) - typeOrder.indexOf(b as any));

  const canSubmit =
    mode === 'note'    ? !!noteForm.body.trim() :
    mode === 'contact' ? !!contactForm.name.trim() && (!!contactForm.phone.trim() || !!contactForm.email.trim()) :
    mode === 'link'    ? !!linkForm.name.trim() && !!linkForm.url.trim() :
                         (!!editingFile || !!pendingFile) && !!fileForm.name.trim();

  const dialogTitle =
    editingFile
      ? mode === 'note' ? 'Edit note' : mode === 'contact' ? 'Edit contact' : mode === 'link' ? 'Edit link' : 'Edit file details'
      : mode === 'note' ? 'Add a note' : mode === 'contact' ? 'Add a contact' : mode === 'link' ? 'Add a link' : 'Upload a file';

  const submitLabel =
    uploading          ? <CircularProgress size={20} sx={{ color: 'white' }} /> :
    mode === 'note'    ? (editingFile ? 'Save note' : 'Add note') :
    mode === 'contact' ? (editingFile ? 'Save contact' : 'Add contact') :
    mode === 'link'    ? (editingFile ? 'Save link' : 'Add link') : (editingFile ? 'Save file' : 'Upload file');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pb: 10 }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
            Resources
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {files.length === 0 ? 'No resources yet' : `${files.length} item${files.length !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

      {!loading && files.length === 0 && (
        <Paper sx={{ p: { xs: 3, sm: 4 }, backgroundColor: 'background.paper' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <FolderOpenIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body1" fontWeight={700} color="text.secondary" gutterBottom>No resources yet</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 380, mx: 'auto' }}>
              Upload boarding passes and documents, save links to event websites and venues, add key contacts, or jot a note.
            </Typography>
          </Box>
          <DropZone onFile={f => { setMode('file'); handleFileSelected(f); }} />
        </Paper>
      )}

      {!loading && files.length > 0 && (
        <>
          <DropZone onFile={f => { setMode('file'); handleFileSelected(f); }} />
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

      {/* ── Quick-capture FAB ── */}
      <Fab
        size="medium"
        onClick={() => openDialog('note')}
        sx={{ position: 'fixed', bottom: 24, right: 24, backgroundColor: '#55702C', color: 'white', '&:hover': { backgroundColor: '#455f24' }, zIndex: 1200 }}
      >
        <NoteAddIcon />
      </Fab>

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
                <TextField label="Display name" value={fileForm.name} autoFocus={!!pendingFile} fullWidth disabled={uploading}
                  onChange={e => setFileForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Ryanair boarding pass DUB to BUH" />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>File type</InputLabel>
                  <Select value={fileForm.type} label="File type" onChange={e => setFileForm(p => ({ ...p, type: e.target.value as FileTypeValue }))}>
                    {FILE_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Notes (optional)" value={fileForm.notes} fullWidth multiline rows={2} disabled={uploading}
                  onChange={e => setFileForm(p => ({ ...p, notes: e.target.value }))} />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* ── Link mode ── */}
            {mode === 'link' && (
              <>
                <TextField label="URL" value={linkForm.url} autoFocus fullWidth disabled={uploading}
                  onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." type="url" />
                <TextField label="Display name" value={linkForm.name} fullWidth disabled={uploading}
                  onChange={e => setLinkForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Interland Festival Programme" />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Link type</InputLabel>
                  <Select value={linkForm.type} label="Link type" onChange={e => setLinkForm(p => ({ ...p, type: e.target.value as LinkTypeValue }))}>
                    {LINK_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Notes (optional)" value={linkForm.notes} fullWidth multiline rows={2} disabled={uploading}
                  onChange={e => setLinkForm(p => ({ ...p, notes: e.target.value }))} />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {/* ── Contact mode ── */}
            {mode === 'contact' && (
              <>
                <TextField label="Name" value={contactForm.name} autoFocus fullWidth disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sarah Kavanagh" />
                <FormControl fullWidth disabled={uploading}>
                  <InputLabel>Role</InputLabel>
                  <Select value={contactForm.type} label="Role" onChange={e => setContactForm(p => ({ ...p, type: e.target.value as ContactTypeValue }))}>
                    {CONTACT_TYPES.map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Phone number" value={contactForm.phone} fullWidth disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="+353 87 123 4567" type="tel"
                  InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 1 }} /> }} />
                <TextField label="Email address" value={contactForm.email} fullWidth disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="sarah@venue.ie" type="email"
                  InputProps={{ startAdornment: <EmailIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 1 }} /> }} />
                <TextField label="Notes (optional)" value={contactForm.notes} fullWidth multiline rows={2} disabled={uploading}
                  onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Best reached after 10am" />
                <LinkToSelector items={linkableItems} value={linkedTo} onChange={setLinkedTo} />
              </>
            )}

            {uploading && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {mode === 'file' ? 'Uploading...' : 'Saving...'}
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>{uploadPct}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={uploadPct} sx={{ height: 6, borderRadius: 3, backgroundColor: alpha('#55702C', 0.15), '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: '#55702C' } }} />
              </Box>
            )}

            {error && <Typography variant="caption" color="error.main" fontWeight={600}>{error}</Typography>}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button onClick={() => { setDialogOpen(false); setEditingFile(null); setLinkedTo(null); }} disabled={uploading} fullWidth={mobile} size="large">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleUpload} disabled={!canSubmit || uploading} fullWidth={mobile} size="large" sx={{ fontWeight: 700 }}>
            {submitLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}