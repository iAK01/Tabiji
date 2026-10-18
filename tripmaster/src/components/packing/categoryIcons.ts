import type { ElementType } from 'react';
import ArticleIcon           from '@mui/icons-material/Article';
import DevicesIcon           from '@mui/icons-material/Devices';
import CableIcon             from '@mui/icons-material/Cable';
import CheckroomIcon         from '@mui/icons-material/Checkroom';
import HikingIcon            from '@mui/icons-material/Hiking';
import ChildCareIcon         from '@mui/icons-material/ChildCare';
import SportsEsportsIcon     from '@mui/icons-material/SportsEsports';
import PaletteIcon           from '@mui/icons-material/Palette';
import FavoriteIcon          from '@mui/icons-material/Favorite';
import BlenderIcon           from '@mui/icons-material/Blender';
import SpaIcon               from '@mui/icons-material/CleanHands';
import MedicationIcon        from '@mui/icons-material/Medication';
import BusinessCenterIcon    from '@mui/icons-material/BusinessCenter';
import LuggageIcon           from '@mui/icons-material/Luggage';
import StyleIcon             from '@mui/icons-material/Style';
import CoffeeIcon            from '@mui/icons-material/Coffee';
import CategoryIcon          from '@mui/icons-material/Category';
import DirectionsWalkIcon    from '@mui/icons-material/DirectionsRun';
import AirlineSeatIcon       from '@mui/icons-material/AirlineSeatReclineNormal';

// Category → MUI icon, shared by the catalogue page and the packing card deck.
export const CATEGORY_ICONS: Record<string, ElementType> = {
  'Documents':          ArticleIcon,
  'Electronics':        DevicesIcon,
  'Tech Accessories':   CableIcon,
  'Clothes':            CheckroomIcon,
  'Sport / Outdoor':    HikingIcon,
  'Footwear':           DirectionsWalkIcon,
  'Baby / Kids':        ChildCareIcon,
  'Entertainment':      SportsEsportsIcon,
  'Hobby / Creative':   PaletteIcon,
  'Health & Recovery':  FavoriteIcon,
  'Food / Supplements': BlenderIcon,
  'Toiletries':         SpaIcon,
  'Medicines':          MedicationIcon,
  'Work Gear':          BusinessCenterIcon,
  'Luggage':            LuggageIcon,
  'Plane / Train':      AirlineSeatIcon,
  'Accessories':        StyleIcon,
  'Coffee':             CoffeeIcon,
  'Other':              CategoryIcon,
};
