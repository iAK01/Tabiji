'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Button, IconButton, Tooltip,
} from '@mui/material';
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome';
import RefreshIcon      from '@mui/icons-material/Refresh';
import EventIcon        from '@mui/icons-material/Event';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import type { CultureData, CultureHighlight } from './Intelligence.types';
import { pickKey, type TripGuide } from '@/lib/guide/types';
import { D, SectionHeading, SubHeading } from './Intelligence.shared';
import NavigateButton from '@/components/ui/NavigateButton';
import Addtoitinerarydialog, { type AddTarget } from './Addtoitinerarydialog';
import { PicksRow } from './Discover.picks';
import { GuideAbout, GuideAreas, GuideBrowse, GuideCredit, GuideHero, placeName } from './Discover.guide';
import { isOffline, subscribeConnectivity } from '@/lib/offline/connectivity';
import { sendOrQueue } from '@/lib/offline/writes';
import { readSaved, reportSaveFailure } from '@/lib/offline/saveErrors';

function pickTarget(h: CultureHighlight): AddTarget {
  return { name: h.name, type: h.type, address: h.address, coordinates: h.coordinates, notes: h.tip };
}

function scrollToId(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// ─── Discover section ─────────────────────────────────────────────────────────
// The Wikivoyage guide (works offline once saved) plus AI picks for this trip.

interface Props { tripId: string; }

export default function Discoversection({ tripId }: Props) {
  const offline = useSyncExternalStore(subscribeConnectivity, isOffline, () => false);

  const [culture,    setCulture]    = useState<CultureData | null>(null);
  const [guide,      setGuide]      = useState<TripGuide | null>(null);
  const [guideState, setGuideState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [addTarget,  setAddTarget]  = useState<AddTarget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [area,       setArea]       = useState<string | null>(null);
  const [about,      setAbout]      = useState<string | null>(null);

  const loadGuide = useCallback(() => {
    setGuideState('loading');
    fetch(`/api/trips/${tripId}/guide`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: TripGuide) => { setGuide(d); setGuideState('ready'); })
      .catch(() => setGuideState('failed'));
  }, [tripId]);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/culture`)
      .then(r => r.json())
      .then(d => {
        const c: CultureData | null = d.culture ?? null;
        setCulture(c);
        // Quietly fetch photos for picks that never got one
        if (!isOffline() && c?.briefing?.highlights?.some(h => !h.imageUrl && !h.imageChecked)) {
          fetch(`/api/trips/${tripId}/culture`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'backfillImages' }),
          })
            .then(r => r.json())
            .then(d => { if (d.culture) setCulture(d.culture); })
            .catch(() => {});
        }
      })
      .catch(() => {});
    loadGuide();
  }, [tripId, loadGuide]);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const res  = await fetch(`/api/trips/${tripId}/culture`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setCulture(data.culture);
    } catch { setError('Couldn’t reach the server — check your connection'); }
    finally { setGenerating(false); }
  };

  // Hidden at once; queued offline like any other change, and remembered so a
  // regenerate never brings it back.
  const dismissPick = async (h: CultureHighlight) => {
    const id   = pickKey(h);
    const prev = culture;
    const without = (c: CultureData | null) => c?.briefing
      ? { ...c, briefing: { ...c.briefing, highlights: c.briefing.highlights.filter(x => pickKey(x) !== id) } }
      : c;
    setCulture(without);
    try {
      const res = await sendOrQueue(
        { type: 'DISMISS_PICK', tripId, payload: { id, name: h.name } },
        () => fetch(`/api/trips/${tripId}/culture`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismissPick', id, name: h.name }),
        }),
        { [`/api/trips/${tripId}/culture`]: (saved: any) => saved?.culture && { ...saved, culture: without(saved.culture) } },
      );
      if (res) {
        const data = await readSaved(res);
        if (data.culture) setCulture(data.culture);
      }
    } catch (err) {
      setCulture(prev);
      reportSaveFailure(`the dismissal of “${h.name}”`, err);
    }
  };

  const openAdd = (t: AddTarget) => { setAddTarget(t); setDialogOpen(true); };

  const g              = guide?.guide ?? null;
  const briefing       = culture?.briefing ?? null;
  const picks          = briefing?.highlights ?? [];
  const city           = g ? placeName(g) : briefing?.destination?.split(',')[0] ?? 'your destination';
  const freeDays       = culture?.freeAccess?.freeDays?.filter((e: any) => !e.dateUnknown) ?? [];
  const standingAccess = culture?.freeAccess?.standing ?? [];
  const freeAccessTip  = culture?.freeAccess?.tip ?? null;

  return (
    <Box>
      <SectionHeading id="discover">Discover</SectionHeading>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* ── Guide opener ── */}
        {guideState === 'loading' && !g && (
          <Box sx={{ height: { xs: 200, sm: 300 }, borderRadius: 2, backgroundColor: D.rule }} />
        )}
        {g && (
          <GuideHero
            guide={g}
            onAbout={() => { setAbout(g.sections[0]?.key ?? null); scrollToId('discover-about'); }}
          />
        )}
        {guideState === 'failed' && !g && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.93rem', color: D.muted }}>
              {offline ? 'The guide isn’t saved for offline yet.' : 'The guide didn’t load.'}
            </Typography>
            {!offline && (
              <Button onClick={loadGuide} sx={{ minHeight: 44, fontWeight: 700, color: D.green }}>Try again</Button>
            )}
          </Box>
        )}

        {/* ── Date-matched free days ── */}
        {freeDays.length > 0 && (
          <Box>
            {freeDays.map((day: any, i: number) => (
              <Box key={i} sx={{
                mb: 1, px: 2, py: 1.5,
                borderLeft: `3px solid ${D.terra}`,
                backgroundColor: 'rgba(196,113,74,0.05)',
                borderRadius: '0 8px 8px 0',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <EventIcon sx={{ fontSize: '1rem', color: D.terra }} />
                  <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.terra }}>
                    {day.label}
                  </Typography>
                </Box>
                {day.includes?.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {day.includes.slice(0, 4).map((inc: string) => (
                      <Chip key={inc} label={inc} size="small" sx={{ height: 22, fontSize: '0.78rem', fontWeight: 600 }} />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* ── Picks for this trip ── */}
        <Box>
          <SubHeading
            action={picks.length > 0 && !generating ? (
              <Tooltip title={offline ? 'Needs a connection' : 'New picks'}>
                <span>
                  <IconButton onClick={generate} disabled={offline} aria-label="New picks" sx={{ width: 44, height: 44 }}>
                    <RefreshIcon sx={{ color: D.muted }} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          >
            Picked for this trip
          </SubHeading>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.95rem' }}>{error}</Typography>
            </Alert>
          )}

          {generating ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 5, justifyContent: 'center' }}>
              <CircularProgress size={20} sx={{ color: D.navy }} />
              <Typography sx={{ fontSize: '0.97rem', color: D.muted }}>Picking places in {city}…</Typography>
            </Box>
          ) : picks.length > 0 ? (
            <PicksRow picks={picks} onAdd={h => openAdd(pickTarget(h))} onDismiss={dismissPick} />
          ) : (
            <Paper elevation={0} sx={{
              p: 2.5, border: `1px dashed ${D.rule}`, borderRadius: 1.5, backgroundColor: 'transparent',
              display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2,
            }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.navy, mb: 0.25 }}>
                  Six places for this trip
                </Typography>
                <Typography sx={{ fontSize: '0.93rem', color: D.muted, lineHeight: 1.5 }}>
                  Sights, a café, a park and somewhere to eat — chosen for your dates, your stay and the forecast.
                </Typography>
              </Box>
              <Button
                variant="contained" startIcon={<AutoAwesomeIcon />} onClick={generate} disabled={offline}
                sx={{ minHeight: 44, flexShrink: 0, fontWeight: 700, fontSize: '0.95rem', backgroundColor: D.navy, '&:hover': { backgroundColor: '#2a3660' } }}
              >
                {offline ? 'Needs a connection' : briefing ? 'Pick again' : 'Pick for me'}
              </Button>
            </Paper>
          )}

          {/* ── Neighbourhood + local tip, from the same picks ── */}
          {briefing && !generating && (briefing.neighbourhood || briefing.practicalNote) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2.5 }}>
              {briefing.neighbourhood && (
                <Paper elevation={0} sx={{
                  p: 2.5, border: `1px solid rgba(29,38,66,0.2)`,
                  backgroundColor: 'rgba(29,38,66,0.03)', borderRadius: 1.5,
                  display: 'flex', overflow: 'hidden',
                }}>
                  <Box sx={{ width: 4, flexShrink: 0, backgroundColor: D.navy, mr: 2.5 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: D.muted, mb: 0.5 }}>
                      Evenings
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <LocationCityIcon sx={{ fontSize: '1rem', color: D.navy }} />
                      <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.navy }}>
                        {briefing.neighbourhood.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.97rem', lineHeight: 1.6, color: 'rgba(29,38,66,0.65)' }}>
                      {briefing.neighbourhood.description}
                    </Typography>
                    {(briefing.neighbourhood.address || briefing.neighbourhood.coordinates) && (
                      <NavigateButton
                        destination={{ name: briefing.neighbourhood.name, coordinates: briefing.neighbourhood.coordinates, address: briefing.neighbourhood.address ?? undefined }}
                        intent="view" variant="button" size="medium"
                        sx={{ mt: 1.25, minHeight: 44, fontWeight: 700, fontSize: '0.85rem', color: D.navy, border: `1px solid ${D.rule}` }}
                      />
                    )}
                  </Box>
                </Paper>
              )}
              {briefing.practicalNote && (
                <Box sx={{ borderLeft: `2px solid ${D.rule}`, pl: 1.5 }}>
                  <Typography sx={{ fontSize: '0.93rem', color: D.muted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {briefing.practicalNote}
                  </Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(29,38,66,0.35)', textAlign: 'right' }}>
                Picked {new Date(briefing.generatedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── The guide ── */}
        {g && guide && (
          <GuideBrowse guide={g} stay={guide.stay} area={area} onArea={setArea} onAdd={openAdd} />
        )}
        {g && guide && (
          <GuideAreas guide={g} stay={guide.stay} onPick={a => { setArea(a); scrollToId('discover-browse'); }} />
        )}
        {g && (
          <GuideAbout guide={g} open={about} onToggle={k => setAbout(o => (o === k ? null : k))} />
        )}

        {/* ── Free cultural access ── */}
        {(standingAccess.length > 0 || freeAccessTip) && (
          <Box>
            <SubHeading>Free cultural access</SubHeading>
            <Paper elevation={0} sx={{
              border: `1px solid rgba(107,124,92,0.25)`,
              backgroundColor: 'rgba(107,124,92,0.04)', borderRadius: 1.5, overflow: 'hidden',
            }}>
              {standingAccess.map((item: any, i: number) => (
                <Box key={i} sx={{
                  px: 2.5, py: 2,
                  borderBottom: i < standingAccess.length - 1 ? `1px solid ${D.rule}` : 'none',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4, flexWrap: 'wrap' }}>
                    {item.touristsEligible === false && (
                      <Box sx={{ px: 0.75, py: 0.15, border: `1px solid rgba(196,113,74,0.4)`, borderRadius: 0.75 }}>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: D.terra }}>Residents only</Typography>
                      </Box>
                    )}
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: D.navy }}>{item.title}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.93rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.55 }}>{item.description}</Typography>
                  {item.when && (
                    <Typography sx={{ fontSize: '0.85rem', color: D.green, display: 'block', mt: 0.5 }}>{item.when}</Typography>
                  )}
                  {item.caveat && (
                    <Typography sx={{ fontSize: '0.85rem', color: D.terra, display: 'block', mt: 0.4, fontStyle: 'italic' }}>{item.caveat}</Typography>
                  )}
                </Box>
              ))}
              {freeAccessTip && (
                <Box sx={{
                  px: 2.5, py: 1.5,
                  borderTop: standingAccess.length > 0 ? `1px solid ${D.rule}` : 'none',
                  borderLeft: `3px solid ${D.green}`,
                }}>
                  <Typography sx={{ fontSize: '0.88rem', color: D.green, fontStyle: 'italic', lineHeight: 1.5 }}>
                    {freeAccessTip}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {g && <GuideCredit guide={g} />}
      </Box>

      <Addtoitinerarydialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        highlight={addTarget}
        tripId={tripId}
      />
    </Box>
  );
}
