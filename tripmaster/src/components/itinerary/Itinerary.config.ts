import FlightIcon         from '@mui/icons-material/Flight';
import HotelIcon          from '@mui/icons-material/Hotel';
import WorkIcon           from '@mui/icons-material/Work';
import RestaurantIcon     from '@mui/icons-material/Restaurant';
import ExploreIcon        from '@mui/icons-material/Explore';
import DirectionsBusIcon  from '@mui/icons-material/DirectionsBus';
import EventIcon          from '@mui/icons-material/Event';
import FreeBreakfastIcon  from '@mui/icons-material/FreeBreakfast';
import LuggageIcon        from '@mui/icons-material/Luggage';


// ─── Timeline constants ────────────────────────────────────────────────────────
export const DAY_START_HOUR     = 6;
export const DAY_END_HOUR       = 24;
export const PX_PER_MIN_MOBILE  = 1.0;
export const PX_PER_MIN_DESKTOP = 1.2;
export const TOTAL_MINS         = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const SNAP_MINS          = 15;

// ─── Design tokens ─────────────────────────────────────────────────────────────
export const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

// ─── Stop type config ──────────────────────────────────────────────────────────
export const STOP_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  flight:      { label: '✈️ Flight',        color: '#C9521B', bg: '#FFF0EB', Icon: FlightIcon       },
  hotel:       { label: '🏨 Accommodation', color: '#5c35a0', bg: '#F3EEFF', Icon: HotelIcon        },
  meeting:     { label: '💼 Meeting',       color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon         },
  meal:        { label: '🍽️ Meal',          color: '#b45309', bg: '#FFFBEB', Icon: RestaurantIcon   },
  breakfast:   { label: '☕ Breakfast',     color: '#b45309', bg: '#FFFBEB', Icon: FreeBreakfastIcon },
  activity:    { label: '🎯 Activity',      color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon      },
  sightseeing: { label: '📸 Sightseeing',  color: '#55702C', bg: '#F0F5E8', Icon: ExploreIcon      },
  transport:   { label: '🚌 Transport',     color: '#0369a1', bg: '#E0F2FE', Icon: DirectionsBusIcon },
  checkin:    { label: '🧳 Check-in',       color: '#0369a1', bg: '#EFF6FF', Icon: LuggageIcon },
  work:        { label: '💻 Work block',   color: '#1D2642', bg: '#E8EAF0', Icon: WorkIcon         },
  other:       { label: '📍 Other',        color: '#6b7280', bg: '#F3F4F6', Icon: EventIcon        },
  gig:         { label: '🎤 Gig',          color: '#ff69b4', bg: '#ffe0f0', Icon: EventIcon        },
};

export const QUICK_ADD_TYPES = [
  'meeting', 'meal', 'breakfast', 'activity', 'sightseeing', 'transport', 'work', 'other', 'gig',
];

export const DEFAULT_DURATIONS: Record<string, number> = {
  flight: 180, hotel: 0, meeting: 60, meal: 75, breakfast: 45,
  activity: 120, sightseeing: 90, transport: 45, work: 120, other: 60, gig: 120,
};

// ─── Interfaces ────────────────────────────────────────────────────────────────
export interface Stop {
  _id?: string;
  name: string;
  type: string;
  reference?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  scheduledStart?: string;
  scheduledEnd?: string;
  time?: string;
  duration: number;
  notes?: string;
  completed?: boolean;
  source?: string;
  icon?: string;
  notificationLeadMins?: number | null;
  travelToNext?: {
    duration:    number;
    mode:        string;
    isTight:     boolean;
    isImpossible: boolean;
    distance:    number;
  };
}

export interface Day {
  date:      string;
  dayNumber: number;
  stops:     Stop[];
}

export interface KnownLocation {
  label:        string;
  address?:     string;
  coordinates?: { lat: number; lng: number };
  type:         'hotel' | 'venue' | 'airport';
}