'use client';

// On the trip: right now, the next four hours, and what changes soon — a dark
// "sky" card in the trip hero's style, its glow set by the time of day and the
// weather, the condition icon ghosted large behind the number.

import { Box, Typography } from '@mui/material';
import UmbrellaIcon   from '@mui/icons-material/Umbrella';
import WbSunnyIcon    from '@mui/icons-material/WbSunny';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { compass, hourLabel, type NowRead } from '@/lib/weather-insights';
import { D, weatherIcon, type IconComponent } from './weatherUi';

const NOTE_ICON: Record<NowRead['notes'][number]['key'], IconComponent> = {
  rain: UmbrellaIcon,
  sun:  WbSunnyIcon,
  temp: ThermostatIcon,
};

const AMBER = '#F2B66D';
const SKY   = '#7DD3FC';

function skyFor(now: NowRead): string {
  const c = now.code ?? 2;
  const grey = c === 3 || c === 45 || c === 48 || (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
  const glow = !now.isDay ? 'rgba(124,108,196,0.38)' : grey ? 'rgba(148,178,199,0.42)' : 'rgba(242,166,90,0.62)';
  const base = !now.isDay ? '#141B35, #0F1530' : '#2A3352, #1D2642';
  return `radial-gradient(120% 95% at 88% -5%, ${glow} 0%, transparent 62%), linear-gradient(180deg, ${base})`;
}

export default function WeatherNow({ now, place }: { now: NowRead; place: string }) {
  const { Icon } = weatherIcon(now.code, now.condition, now.isDay);
  const facts = [
    now.feels != null ? `Feels ${now.feels}°` : null,
    now.windKph != null ? `${now.windKph} km/h${now.dir != null ? ` ${compass(now.dir)}` : ''}` : null,
    now.uv != null && now.isDay ? `UV ${Math.round(now.uv)}` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '18px',
      background: skyFor(now), color: '#fff',
      p: { xs: 2.25, sm: 3 },
      boxShadow: '0 10px 30px rgba(29,38,66,0.25)',
      display: 'flex', flexDirection: 'column', gap: 2.25,
    }}>
      {/* Ghosted condition icon */}
      <Icon aria-hidden sx={{
        position: 'absolute', right: { xs: -18, sm: -10 }, top: { xs: -14, sm: -20 },
        fontSize: { xs: '9.5rem', sm: '12rem' }, color: 'rgba(255,255,255,0.09)', pointerEvents: 'none',
      }} />

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, position: 'relative' }}>
        <Typography sx={{
          fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: AMBER, fontFamily: D.body,
        }}>
          Right now
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontFamily: D.body, minWidth: 0 }}>
          {now.clock} · {place}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography sx={{
            fontFamily: D.display, fontSize: { xs: '4.4rem', sm: '5.2rem' },
            lineHeight: 0.9, letterSpacing: '-0.04em', textShadow: '0 2px 18px rgba(0,0,0,0.25)',
          }}>
            {now.temp}°
          </Typography>
          <Box sx={{ pt: 0.75, minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: D.body, lineHeight: 1.2 }}>
              {now.condition}
            </Typography>
            {facts && (
              <Typography sx={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', fontFamily: D.body, mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {facts}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Next hours — glass tiles */}
      {now.next.length > 0 && (
        <Box sx={{
          display: 'grid', gridTemplateColumns: `repeat(${now.next.length}, minmax(0, 1fr))`, gap: 1,
          position: 'relative',
        }}>
          {now.next.map(p => {
            const { Icon: HIcon } = weatherIcon(p.code, '', p.isDay);
            const chance = p.rain ?? 0;
            return (
              <Box key={`${p.date}-${p.hour}`} sx={{
                py: 1.25, px: 0.5, borderRadius: '12px', textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(6px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
                fontVariantNumeric: 'tabular-nums',
              }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: D.body }}>
                  {hourLabel(p.hour)}
                </Typography>
                <HIcon sx={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.92)' }} />
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: D.body, lineHeight: 1.1 }}>
                  {p.temp}°
                </Typography>
                <Box sx={{ width: '64%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', mt: 0.25 }}>
                  <Box sx={{ height: '100%', width: `${Math.min(100, chance)}%`, backgroundColor: SKY, borderRadius: 2 }} />
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: chance >= 50 ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: chance >= 50 ? 800 : 500, fontFamily: D.body }}>
                  {chance}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* What changes soon */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, position: 'relative' }}>
        {now.notes.map(n => {
          const NIcon = NOTE_ICON[n.key];
          return (
            <Box key={n.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(242,182,109,0.16)',
              }}>
                <NIcon sx={{ fontSize: '1rem', color: AMBER }} />
              </Box>
              <Typography sx={{ fontSize: '0.98rem', fontFamily: D.body, lineHeight: 1.35, color: 'rgba(255,255,255,0.92)' }}>
                {n.text}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
