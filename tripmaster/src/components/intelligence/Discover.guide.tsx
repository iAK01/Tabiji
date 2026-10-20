'use client';

import { useMemo, useState } from 'react';
import { Box, Typography, Button, Collapse, Paper } from '@mui/material';
import AddIcon         from '@mui/icons-material/Add';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import OpenInNewIcon   from '@mui/icons-material/OpenInNew';
import { haversineKm } from '@/lib/geo/geocode';
import { KIND_LABELS, type Guide, type GuideListing, type LatLng, type ListingKind, type TripGuide } from '@/lib/guide/types';
import { D, PhotoCredit, SubHeading } from './Intelligence.shared';
import NavigateButton from '@/components/ui/NavigateButton';
import type { AddTarget } from './Addtoitinerarydialog';

const KIND_ORDER: ListingKind[] = ['see', 'do', 'eat', 'drink', 'buy', 'go'];
const PAGE = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// "Ballina (County Mayo)" → "Ballina"
export function placeName(guide: Guide): string {
  return guide.title.split('/')[0].replace(/\s*\(.*\)$/, '');
}

function fmtKm(km: number): string {
  if (km < 1)  return `${Math.max(1, Math.round(km * 10)) * 100} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function checkedOn(lastEdit?: string): string | null {
  if (!lastEdit) return null;
  const d = new Date(lastEdit);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' });
}

export function listingTarget(l: GuideListing): AddTarget {
  const type = l.kind === 'see' ? 'landmark'
    : l.kind === 'eat'   ? 'food'
    : l.kind === 'drink' ? (/caf|coffee/i.test(`${l.group ?? ''} ${l.name}`) ? 'coffee' : 'food')
    : 'experience';
  const notes = [l.hours && `Hours: ${l.hours}`, l.price && `Price: ${l.price}`].filter(Boolean).join('\n');
  return { name: l.name, type, address: l.address, coordinates: l.coordinates, notes: notes || undefined };
}

// The district the stay is in — the one holding the listing nearest to it.
export function stayDistrict(guide: Guide, stay: TripGuide['stay']): string | null {
  if (!stay || !guide.districts.length) return null;
  let best: string | null = null;
  let bestKm = Infinity;
  for (const l of guide.listings) {
    if (!l.district || !l.coordinates) continue;
    const km = haversineKm(stay.coordinates.lat, stay.coordinates.lng, l.coordinates.lat, l.coordinates.lng);
    if (km < bestKm) { bestKm = km; best = l.district; }
  }
  return bestKm <= 1.5 ? best : null;
}

function TextButton({ children, onClick, href, icon }: {
  children: React.ReactNode;
  onClick?: () => void;
  href?:    string;
  icon?:    React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
      endIcon={icon}
      sx={{ minHeight: 44, px: 1, ml: -1, fontWeight: 700, fontSize: '0.88rem', color: D.green, textTransform: 'none' }}
    >
      {children}
    </Button>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function GuideHero({ guide, onAbout }: { guide: Guide; onAbout?: () => void }) {
  const [more, setMore] = useState(false);
  const [first, ...rest] = guide.intro;
  const name = placeName(guide);

  return (
    <Box>
      {guide.photo ? (
        <Box sx={{ position: 'relative', height: { xs: 200, sm: 300, md: 360 }, borderRadius: 2, overflow: 'hidden', backgroundColor: D.rule }}>
          <img src={guide.photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 100%)',
          }} />
          <Typography sx={{
            position: 'absolute', left: { xs: 16, sm: 24 }, right: 16, bottom: { xs: 12, sm: 20 },
            fontFamily: D.display, fontSize: { xs: '2.2rem', sm: '3rem' }, lineHeight: 1,
            color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 16px rgba(0,0,0,0.45)',
          }}>
            {name}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontFamily: D.display, fontSize: { xs: '2rem', sm: '2.4rem' }, color: D.navy, lineHeight: 1.05 }}>
          {name}
        </Typography>
      )}
      {guide.photo && (
        <Box sx={{ mt: 0.5 }}>
          <PhotoCredit name={guide.photo.credit ?? 'Wikimedia Commons'} link={guide.photo.link} licence={guide.photo.licence} />
        </Box>
      )}

      {first && (
        <Typography sx={{ mt: 1.5, fontSize: '1.02rem', lineHeight: 1.65, color: 'rgba(29,38,66,0.82)', maxWidth: '70ch' }}>
          {first}
        </Typography>
      )}
      <Collapse in={more}>
        {rest.map((p, i) => (
          <Typography key={i} sx={{ mt: 1.25, fontSize: '1.02rem', lineHeight: 1.65, color: 'rgba(29,38,66,0.82)', maxWidth: '70ch' }}>
            {p}
          </Typography>
        ))}
      </Collapse>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {rest.length > 0 && <TextButton onClick={() => setMore(m => !m)}>{more ? 'Less' : 'Read more'}</TextButton>}
        {onAbout && guide.sections.length > 0 && <TextButton onClick={onAbout}>About {name}</TextButton>}
      </Box>
    </Box>
  );
}

// ─── Browse ───────────────────────────────────────────────────────────────────

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        flexShrink: 0, minHeight: 44, px: 1.75,
        border: `1px solid ${selected ? D.navy : D.rule}`, borderRadius: 22,
        backgroundColor: selected ? D.navy : D.paper,
        color: selected ? '#fff' : D.navy,
        fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        '&:focus-visible': { outline: `2px solid ${D.terra}`, outlineOffset: 2 },
      }}
    >
      {label}
    </Box>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5,
      mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 },
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {children}
    </Box>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 1, py: 0.5 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, pt: '3px' }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: '0.92rem', color: D.navy, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function ListingRow({ l, km, showDistrict, open, onToggle, onAdd }: {
  l:            GuideListing;
  km:           number | null;
  showDistrict: boolean;
  open:         boolean;
  onToggle:     () => void;
  onAdd:        (t: AddTarget) => void;
}) {
  const meta    = [l.group, showDistrict ? l.district : undefined].filter(Boolean).join(' · ');
  const checked = checkedOn(l.lastEdit);
  const canMap  = !!(l.coordinates || l.address) && l.kind !== 'go';

  return (
    <Box sx={{ borderBottom: `1px solid ${D.rule}`, '&:last-of-type': { borderBottom: 'none' } }}>
      <Box
        component="button"
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'none', border: 'none', font: 'inherit', color: 'inherit',
          px: 2, py: 1.5, minHeight: 44,
          '&:focus-visible': { outline: `2px solid ${D.terra}`, outlineOffset: -2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}>
          <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, lineHeight: 1.2, minWidth: 0 }}>
            {l.name}
            {l.alt && <Box component="span" sx={{ fontFamily: D.body, fontSize: '0.85rem', color: D.muted, fontWeight: 500 }}> · {l.alt}</Box>}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {km != null && <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: D.muted }}>{fmtKm(km)}</Typography>}
            <ExpandMoreIcon sx={{ fontSize: '1.2rem', color: D.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </Box>
        </Box>
        {meta && <Typography sx={{ fontSize: '0.78rem', color: D.muted, mt: 0.25 }}>{meta}</Typography>}
        {l.description && (
          <Typography sx={{
            fontSize: '0.93rem', lineHeight: 1.55, color: 'rgba(29,38,66,0.7)', mt: 0.5,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}>
            {l.description}
          </Typography>
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {l.hours   && <Detail label="Hours">{l.hours}</Detail>}
          {l.price   && <Detail label="Price">{l.price}</Detail>}
          {(l.address || l.directions) && (
            <Detail label="Where">{[l.address, l.directions].filter(Boolean).join(' — ')}</Detail>
          )}
          {l.phone && (
            <Detail label="Phone">
              <Box component="a" href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} sx={{ color: D.navy }}>{l.phone}</Box>
            </Detail>
          )}
          {checked && (
            <Typography sx={{ fontSize: '0.75rem', color: D.muted, mt: 0.5 }}>Details checked {checked}</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
            {canMap && (
              <NavigateButton
                destination={{ name: l.name, coordinates: l.coordinates, address: l.address ?? undefined }}
                intent="view" variant="button" size="medium"
                sx={{ minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: `1px solid ${D.rule}` }}
              />
            )}
            {l.url && (
              <Button
                href={l.url} target="_blank" rel="noopener noreferrer"
                endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem !important' }} />}
                sx={{ minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: `1px solid ${D.rule}` }}
              >
                {l.kind === 'go' ? 'Read the guide' : 'Website'}
              </Button>
            )}
            {l.kind !== 'go' && (
              <Button
                onClick={() => onAdd(listingTarget(l))}
                startIcon={<AddIcon sx={{ fontSize: '1rem !important' }} />}
                sx={{
                  minHeight: 44, fontWeight: 700, fontSize: '0.85rem',
                  color: D.navy, border: '1px solid rgba(29,38,66,0.25)', backgroundColor: 'rgba(29,38,66,0.03)',
                }}
              >
                Add to day
              </Button>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export function GuideBrowse({ guide, stay, area, onArea, onAdd }: {
  guide:  Guide;
  stay:   TripGuide['stay'];
  area:   string | null;
  onArea: (area: string | null) => void;
  onAdd:  (t: AddTarget) => void;
}) {
  const anchor: LatLng | null = stay?.coordinates ?? guide.coordinates ?? null;
  const counts = useMemo(() => {
    const c: Partial<Record<ListingKind, number>> = {};
    for (const l of guide.listings) c[l.kind] = (c[l.kind] ?? 0) + 1;
    return c;
  }, [guide]);
  const kinds = KIND_ORDER.filter(k => counts[k]);

  const [kind,  setKind]  = useState<ListingKind>(kinds[0] ?? 'see');
  const [order, setOrder] = useState<'near' | 'guide'>(anchor ? 'near' : 'guide');
  const [limit, setLimit] = useState(PAGE);
  const [open,  setOpen]  = useState<string | null>(null);

  const byArea = kind !== 'go' && guide.districts.length > 0;
  const rows = useMemo(() => {
    const list = guide.listings
      .filter(l => l.kind === kind && (!byArea || !area || l.district === area))
      .map(l => ({ l, km: anchor && l.coordinates ? haversineKm(anchor.lat, anchor.lng, l.coordinates.lat, l.coordinates.lng) : null }));
    if (order === 'near') list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [guide, kind, area, byArea, order, anchor]);

  if (!kinds.length) return null;
  const reset = () => { setLimit(PAGE); setOpen(null); };
  const yourStay = stayDistrict(guide, stay);

  return (
    <Box>
      <SubHeading
        id="discover-browse"
        action={anchor && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(['near', 'guide'] as const).map(o => (
              <Button
                key={o}
                onClick={() => { setOrder(o); reset(); }}
                aria-pressed={order === o}
                sx={{
                  minHeight: 36, px: 1, fontSize: '0.78rem', textTransform: 'none',
                  fontWeight: order === o ? 800 : 500, color: order === o ? D.navy : D.muted,
                }}
              >
                {o === 'near' ? (stay ? 'Nearest your stay' : 'Nearest') : 'Guide order'}
              </Button>
            ))}
          </Box>
        )}
      >
        In the guide
      </SubHeading>

      <ChipRow>
        {kinds.map(k => (
          <FilterChip key={k} label={`${KIND_LABELS[k]} ${counts[k]}`} selected={k === kind}
            onClick={() => { setKind(k); reset(); }} />
        ))}
      </ChipRow>

      {byArea && (
        <Box sx={{ mt: 0.75 }}>
          <ChipRow>
            <FilterChip label="All areas" selected={!area} onClick={() => { onArea(null); reset(); }} />
            {guide.districts.map(d => (
              <FilterChip key={d.title} label={d.name === yourStay ? `${d.name} · your stay` : d.name}
                selected={area === d.name} onClick={() => { onArea(d.name); reset(); }} />
            ))}
          </ChipRow>
        </Box>
      )}

      <Paper elevation={0} sx={{ mt: 1.5, border: `1px solid ${D.rule}`, borderRadius: 1.5, backgroundColor: D.paper, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <Typography sx={{ p: 2, fontSize: '0.93rem', color: D.muted }}>Nothing listed here for this area.</Typography>
        ) : rows.slice(0, limit).map(({ l, km }) => (
          <ListingRow
            key={l.id} l={l} km={km}
            showDistrict={byArea && !area}
            open={open === l.id}
            onToggle={() => setOpen(o => (o === l.id ? null : l.id))}
            onAdd={onAdd}
          />
        ))}
      </Paper>
      {rows.length > limit && (
        <Button
          onClick={() => setLimit(rows.length)}
          fullWidth
          sx={{ mt: 1, minHeight: 44, fontWeight: 700, fontSize: '0.9rem', color: D.navy, border: `1px solid ${D.rule}` }}
        >
          Show all {rows.length}
        </Button>
      )}
    </Box>
  );
}

// ─── Areas ────────────────────────────────────────────────────────────────────

export function GuideAreas({ guide, stay, onPick }: {
  guide:  Guide;
  stay:   TripGuide['stay'];
  onPick: (area: string) => void;
}) {
  if (!guide.districts.length) return null;
  const yourStay = stayDistrict(guide, stay);

  return (
    <Box>
      <SubHeading>Areas</SubHeading>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        {guide.districts.map(d => (
          <Paper
            key={d.title} elevation={0} component="button" onClick={() => onPick(d.name)}
            sx={{
              textAlign: 'left', cursor: 'pointer', font: 'inherit', p: 2, minHeight: 44,
              border: `1px solid ${d.name === yourStay ? 'rgba(107,124,92,0.45)' : D.rule}`, borderRadius: 1.5,
              backgroundColor: d.name === yourStay ? 'rgba(107,124,92,0.05)' : D.paper,
              '&:hover': { borderColor: D.navy },
              '&:focus-visible': { outline: `2px solid ${D.terra}`, outlineOffset: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy, lineHeight: 1.2 }}>{d.name}</Typography>
              {d.name === yourStay && (
                <Box sx={{ px: 0.75, py: 0.2, backgroundColor: 'rgba(107,124,92,0.12)', borderRadius: 0.75 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: D.green }}>Your stay</Typography>
                </Box>
              )}
            </Box>
            {d.description && (
              <Typography sx={{
                fontSize: '0.9rem', lineHeight: 1.55, color: 'rgba(29,38,66,0.65)',
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {d.description}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

// ─── About — Understand, Get around, Stay safe, Respect ───────────────────────

export function GuideAbout({ guide, open, onToggle }: {
  guide:    Guide;
  open:     string | null;
  onToggle: (key: string) => void;
}) {
  if (!guide.sections.length) return null;

  return (
    <Box>
      <SubHeading id="discover-about">About {placeName(guide)}</SubHeading>
      <Paper elevation={0} sx={{ border: `1px solid ${D.rule}`, borderRadius: 1.5, backgroundColor: D.paper, overflow: 'hidden' }}>
        {guide.sections.map((s, i) => (
          <Box key={s.key} sx={{ borderTop: i ? `1px solid ${D.rule}` : 'none' }}>
            <Box
              component="button"
              onClick={() => onToggle(s.key)}
              aria-expanded={open === s.key}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left',
                px: 2, minHeight: 52,
                '&:focus-visible': { outline: `2px solid ${D.terra}`, outlineOffset: -2 },
              }}
            >
              <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy }}>{s.heading}</Typography>
              <ExpandMoreIcon sx={{ color: D.muted, transform: open === s.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </Box>
            <Collapse in={open === s.key} unmountOnExit>
              <Box sx={{ px: 2, pb: 2.5, maxWidth: '72ch' }}>
                {s.blocks.map((b, j) => (
                  <Box key={j} sx={{ mt: j ? 2 : 0 }}>
                    {b.heading && (
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.navy, mb: 0.75 }}>
                        {b.heading}
                      </Typography>
                    )}
                    {b.paragraphs.map((p, k) => (
                      <Typography key={k} sx={{ fontSize: '0.97rem', lineHeight: 1.65, color: 'rgba(29,38,66,0.8)', mb: 1 }}>{p}</Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

// ─── Credit — required by the CC BY-SA licence ────────────────────────────────

export function GuideCredit({ guide }: { guide: Guide }) {
  const updated = new Date(guide.fetchedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  const link = { color: 'inherit', textDecoration: 'underline' } as const;
  return (
    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(29,38,66,0.45)', lineHeight: 1.5 }}>
      Guide text from{' '}
      <Box component="a" href={guide.url} target="_blank" rel="noopener noreferrer" sx={link}>Wikivoyage</Box>
      {' '}contributors, licensed{' '}
      <Box component="a" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" sx={link}>CC BY-SA 4.0</Box>
      . Updated {updated}.
    </Typography>
  );
}
