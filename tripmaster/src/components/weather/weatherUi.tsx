// Shared look for the Weather tab and its day sheet.

import WbSunnyIcon      from '@mui/icons-material/WbSunny';
import NightsStayIcon   from '@mui/icons-material/NightsStay';
import FilterDramaIcon  from '@mui/icons-material/FilterDrama';
import CloudIcon        from '@mui/icons-material/Cloud';
import FoggyIcon        from '@mui/icons-material/Foggy';
import UmbrellaIcon     from '@mui/icons-material/Umbrella';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import AcUnitIcon       from '@mui/icons-material/AcUnit';

export const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#1D2642',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  muted:   'rgba(29,38,66,0.45)',
  rule:    'rgba(29,38,66,0.10)',
  cool:    '#0891b2',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
};

export type IconComponent = typeof WbSunnyIcon;

// By WMO code. Text matching only for v1 cached days, which carry no code.
export function weatherIcon(
  code: number | null | undefined, condition = '', isDay = true,
): { Icon: IconComponent; color: string } {
  let c = code;
  if (c == null) {
    const t = condition.toLowerCase();
    c = t.includes('thunder') ? 95
      : /snow|sleet|blizzard/.test(t) ? 71
      : /rain|drizzle|shower/.test(t) ? 61
      : /fog|mist/.test(t) ? 45
      : t.includes('overcast') ? 3
      : /cloud|partly/.test(t) ? 2
      : 0;
  }
  if (c >= 95)                                         return { Icon: ThunderstormIcon, color: '#5c35a0' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86)    return { Icon: AcUnitIcon,       color: '#0369a1' };
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))    return { Icon: UmbrellaIcon,     color: D.cool };
  if (c === 45 || c === 48)                            return { Icon: FoggyIcon,        color: '#6b7280' };
  if (c === 3)                                         return { Icon: CloudIcon,        color: '#6b7280' };
  if (c === 2)                                         return { Icon: FilterDramaIcon,  color: '#8b7d6b' };
  return isDay ? { Icon: WbSunnyIcon, color: D.terra } : { Icon: NightsStayIcon, color: '#4b5576' };
}

// Colour of a temperature, so hot vs cold reads before the number does.
export function warmth(t: number): string {
  if (t >= 30) return '#A8432A';
  if (t >= 22) return D.terra;
  if (t >= 14) return D.navy;
  if (t >= 6)  return D.cool;
  return '#0369a1';
}
