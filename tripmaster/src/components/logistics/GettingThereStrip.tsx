'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Collapse, IconButton, Alert, Snackbar, TextField,
} from '@mui/material';
import DirectionsCarIcon     from '@mui/icons-material/DirectionsCar';
import TrainIcon             from '@mui/icons-material/Train';
import DirectionsBusIcon     from '@mui/icons-material/DirectionsBus';
import LocalTaxiIcon         from '@mui/icons-material/LocalTaxi';
import DirectionsWalkIcon    from '@mui/icons-material/DirectionsWalk';
import DirectionsBoatIcon    from '@mui/icons-material/DirectionsBoat';
import SubwayIcon            from '@mui/icons-material/Subway';
import FlightIcon            from '@mui/icons-material/Flight';
import CheckCircleIcon       from '@mui/icons-material/CheckCircle';
import WarningAmberIcon      from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon      from '@mui/icons-material/ErrorOutline';
import AutoAwesomeIcon       from '@mui/icons-material/AutoAwesome';
import RefreshIcon           from '@mui/icons-material/Refresh';
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore';
import ExpandLessIcon        from '@mui/icons-material/ExpandLess';
import OpenInNewIcon         from '@mui/icons-material/OpenInNew';
import CalendarPlusIcon      from '@mui/icons-material/PlaylistAdd';
import AccessTimeIcon        from '@mui/icons-material/AccessTime';
import CloseIcon             from '@mui/icons-material/Close';
import type { GroundTransportPlan, TransportLeg, TransportStep } from '@/app/api/trips/[id]/transport/route';
import { readSaved, reportSaveFailure, SaveError } from '@/lib/offline/saveErrors';

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  green:   '#6B7C5C',
  terra:   '#C4714A',
  navy:    '#2C3E50',
  bg:      '#F5F0E8',
  paper:   '#FDFAF5',
  rule:    'rgba(29,38,66,0.10)',
  muted:   'rgba(29,38,66,0.45)',
  display: '"Archivo Black", sans-serif',
  body:    '"Archivo", "Inter", sans-serif',
} as const;

// ─── Static operator URL map ──────────────────────────────────────────────────
// Direct links for known operators — falls back to Google search

const OPERATOR_URLS: Record<string, string> = {
  'pkp intercity':        'https://www.intercity.pl/en/',
  'pkp':                  'https://www.intercity.pl/en/',
  'skm warsaw':           'https://www.skm.warszawa.pl/',
  'flixbus':              'https://www.flixbus.com/',
  'polskibus':            'https://www.flixbus.com/',
  'bus éireann':          'https://www.buseireann.ie/',
  'bus eireann':          'https://www.buseireann.ie/',
  'dublin bus':           'https://www.dublinbus.ie/',
  'irish rail':           'https://www.irishrail.ie/',
  'iarnród éireann':      'https://www.irishrail.ie/',
  'translink':            'https://www.translink.co.uk/',
  'deutsche bahn':        'https://www.bahn.de/en',
  'db':                   'https://www.bahn.de/en',
  'sncf':                 'https://www.sncf-connect.com/en-en',
  'trenitalia':           'https://www.trenitalia.com/en.html',
  'renfe':                'https://www.renfe.com/en/en',
  'ns':                   'https://www.ns.nl/en',
  'sbb':                  'https://www.sbb.ch/en',
  'öbb':                  'https://www.oebb.at/en',
  'obb':                  'https://www.oebb.at/en',
  'eurostar':             'https://www.eurostar.com/',
  'thalys':               'https://www.eurostar.com/',
  'bolt':                 'https://bolt.eu/',
  'uber':                 'https://www.uber.com/',
  'freenow':              'https://www.free-now.com/',
  'free now':             'https://www.free-now.com/',
  'aircoach':             'https://www.aircoach.ie/',
  'airlink':              'https://www.dublinbus.ie/',
};

function operatorUrl(name: string | undefined, searchTerms: string | undefined): string | null {
  if (!name) return null;
  const key = name.toLowerCase();
  for (const [k, url] of Object.entries(OPERATOR_URLS)) {
    if (key.includes(k)) return url;
  }
  if (searchTerms) {
    return `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + (searchTerms ?? ''))}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(name)}`;
}

// ─── Method icon ──────────────────────────────────────────────────────────────

function MethodIcon({ method, size = '1rem' }: { method: string; size?: string }) {
  const sx = { fontSize: size, flexShrink: 0 };
  switch (method) {
    case 'train':     return <TrainIcon sx={sx} />;
    case 'bus':       return <DirectionsBusIcon sx={sx} />;
    case 'metro':     return <SubwayIcon sx={sx} />;
    case 'taxi':
    case 'rideshare': return <LocalTaxiIcon sx={sx} />;
    case 'car':       return <DirectionsCarIcon sx={sx} />;
    case 'walk':      return <DirectionsWalkIcon sx={sx} />;
    case 'ferry':     return <DirectionsBoatIcon sx={sx} />;
    default:          return <FlightIcon sx={sx} />;
  }
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function LegStatusChip({ status }: { status: TransportLeg['status'] }) {
  const cfg = {
    sorted:         { label: 'Sorted',    color: D.green,  bg: 'rgba(107,124,92,0.12)', Icon: CheckCircleIcon },
    gap:            { label: 'Plan needed', color: D.terra, bg: 'rgba(196,113,74,0.12)', Icon: WarningAmberIcon },
    no_data:        { label: 'Add details', color: D.muted, bg: 'rgba(29,38,66,0.07)',   Icon: ErrorOutlineIcon },
    not_applicable: { label: 'N/A',        color: D.muted,  bg: 'rgba(29,38,66,0.07)',   Icon: null },
  }[status] ?? { label: status, color: D.muted, bg: 'rgba(29,38,66,0.07)', Icon: null };

  const { Icon } = cfg;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.3,
      backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      borderRadius: 99,
      flexShrink: 0,
    }}>
      {Icon && <Icon sx={{ fontSize: '0.75rem', color: cfg.color }} />}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, fontFamily: D.body, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {cfg.label}
      </Typography>
    </Box>
  );
}

// ─── Single transport step ────────────────────────────────────────────────────

function StepCard({ step, onDismiss }: { step: TransportStep; onDismiss?: () => void }) {
  const url = operatorUrl(step.operator, step.searchTerms);
  return (
    <Box sx={{
      display: 'flex', gap: 1.5, py: 1.5,
      borderBottom: `1px solid ${D.rule}`,
      '&:last-child': { borderBottom: 'none' },
    }}>
      {/* Method icon dot */}
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        backgroundColor: 'rgba(29,38,66,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: D.navy,
      }}>
        <MethodIcon method={step.method} size="0.95rem" />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', fontWeight: 700, color: D.navy }}>
            {step.label}
          </Typography>
          {step.estimatedDuration && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <AccessTimeIcon sx={{ fontSize: '0.7rem', color: D.muted }} />
              <Typography sx={{ fontSize: '0.72rem', color: D.muted, fontFamily: D.body }}>
                {step.estimatedDuration}
              </Typography>
            </Box>
          )}
          {onDismiss && (
            <IconButton
              size="small"
              title="Not for me"
              onClick={onDismiss}
              sx={{ ml: 'auto', p: 0.5, color: D.muted, '&:hover': { color: D.navy } }}
            >
              <CloseIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          )}
        </Box>

        <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'rgba(29,38,66,0.72)', fontFamily: D.body }}>
          {step.description}
        </Typography>

        {step.uncertainty && (
          <Typography sx={{ fontSize: '0.8rem', color: D.terra, fontStyle: 'italic', mt: 0.5, fontFamily: D.body }}>
            ⚠ {step.uncertainty}
          </Typography>
        )}

        {(step.operator || step.searchTerms) && (
          <Box sx={{ mt: 0.75 }}>
            {url ? (
              <Button
                size="small"
                component="a"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon sx={{ fontSize: '0.75rem !important' }} />}
                sx={{
                  fontSize: '0.75rem', fontWeight: 700, py: 0.35, px: 1.25,
                  border: `1px solid ${D.navy}30`,
                  color: D.navy, backgroundColor: 'rgba(29,38,66,0.04)',
                  textTransform: 'none', fontFamily: D.body,
                  '&:hover': { backgroundColor: 'rgba(29,38,66,0.1)' },
                }}
              >
                {step.operator ? `Search ${step.operator}` : 'Search'}
              </Button>
            ) : step.searchTerms ? (
              <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontFamily: D.body }}>
                Search: <em>{step.searchTerms}</em>
              </Typography>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Leg panel ────────────────────────────────────────────────────────────────

interface LegPanelProps {
  label:         string;
  subtitle:      string;
  leg:           TransportLeg | null;
  generating:    boolean;
  onGenerate:    () => void;
  tripId:        string;
  defaultOpen?:  boolean;
  legKey:        'preDeparture' | 'arrivalLeg' | 'returnLeg' | 'homeCloseout';
  onPlanChange:  (plan: GroundTransportPlan) => void;
}

function LegPanel({ label, subtitle, leg, generating, onGenerate, tripId, defaultOpen, legKey, onPlanChange }: LegPanelProps) {
  const [open,    setOpen]    = useState(defaultOpen ?? false);
  const [added,   setAdded]   = useState(false);
  const [adding,  setAdding]  = useState<number | null>(null);
  const [sortingOpen, setSortingOpen] = useState(false);
  const [note,        setNote]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [hidden,      setHidden]      = useState<Set<string>>(new Set());

  // The traveller's own arrangement overrides whatever the plan said
  const userPlan = leg?.userPlan;
  const status   = userPlan ? 'sorted' : (leg?.status ?? 'gap');
  const steps    = (leg?.steps ?? []).filter(st => !hidden.has(st.label));
  const hasSteps = steps.length > 0;
  const canSort  = !userPlan && (status === 'gap' || !!leg?.earlyMorningWarning);

  // Throws unless the server confirmed the change — each caller undoes its own part and reports.
  const patchLeg = async (payload: Record<string, unknown>) => {
    const res  = await fetch(`/api/trips/${tripId}/transport`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ leg: legKey, ...payload }),
    });
    const data = await readSaved(res);
    if (!data.plan) throw new Error('No plan in response');
    onPlanChange(data.plan);
  };

  const saveUserPlan = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await patchLeg({ action: 'setUserPlan', note });
      setSortingOpen(false);
      setNote('');
    } catch (err) {
      // The box stays open with their note so they can retry.
      reportSaveFailure(`your ${label.toLowerCase()} plan`, err);
    } finally {
      setSaving(false);
    }
  };

  const clearUserPlan = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await patchLeg({ action: 'clearUserPlan' });
    } catch (err) {
      reportSaveFailure(`the undo on your ${label.toLowerCase()} plan`, err);
    } finally {
      setSaving(false);
    }
  };

  const dismissStep = async (step: TransportStep) => {
    setHidden(h => new Set(h).add(step.label));
    try {
      await patchLeg({ action: 'dismissStep', label: step.label });
    } catch (err) {
      setHidden(h => { const next = new Set(h); next.delete(step.label); return next; });
      reportSaveFailure(`the dismissal of “${step.label}”`, err);
    }
  };

  const addToItinerary = async (step: TransportStep, idx: number) => {
    const dayDate = leg?.suggestedDate ?? null;
    if (!dayDate) return; // can't add without a date
    const name = `${step.label}${step.operator ? ` — ${step.operator}` : ''}`;
    setAdding(idx);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayDate,
          stop: {
            name,
            type:           'transport',
            scheduledStart: null,
            duration:       null,
            notes:          [step.description, step.searchTerms ? `Search: ${step.searchTerms}` : null].filter(Boolean).join('\n'),
          },
        }),
      });
      const data = await readSaved(res);
      if (!data.days) throw new Error('No itinerary in response');
      setAdded(true);
    } catch (err) {
      reportSaveFailure(`“${name}” to your itinerary`, err);
    } finally {
      setAdding(null);
    }
  };

  return (
    <Box sx={{ borderBottom: `1px solid ${D.rule}` }}>
      {/* Header row */}
      <Box
        onClick={() => (status !== 'not_applicable') && setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.5,
          cursor: status !== 'not_applicable' ? 'pointer' : 'default',
          '&:hover': status !== 'not_applicable' ? { backgroundColor: 'rgba(29,38,66,0.02)' } : {},
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: D.muted }}>
            {label}
          </Typography>
          <Typography sx={{ fontFamily: D.display, fontSize: '0.95rem', color: D.navy, mt: 0.1 }}>
            {subtitle}
          </Typography>
        </Box>

        <LegStatusChip status={status} />

        {status !== 'not_applicable' && (
          <IconButton size="small" sx={{ flexShrink: 0, color: D.muted }}>
            {open ? <ExpandLessIcon sx={{ fontSize: '1.1rem' }} /> : <ExpandMoreIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
        )}
      </Box>

      {/* Early morning warning — always visible, outside collapse */}
      {leg?.earlyMorningWarning && !userPlan && (
        <Box sx={{
          mx: 2, mb: 1, px: 1.5, py: 1,
          backgroundColor: 'rgba(196,113,74,0.08)',
          border: `1px solid rgba(196,113,74,0.3)`,
          borderRadius: 1,
          display: 'flex', alignItems: 'flex-start', gap: 1,
        }}>
          <AccessTimeIcon sx={{ fontSize: '1rem', color: D.terra, flexShrink: 0, mt: 0.1 }} />
          <Typography sx={{ fontSize: '0.82rem', color: D.terra, lineHeight: 1.5, fontFamily: D.body }}>
            {leg.earlyMorningDetail ?? 'Early departure — check whether public transport will be running.'}
          </Typography>
        </Box>
      )}

      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>

          {/* Traveller's own arrangement */}
          {userPlan && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 1,
              backgroundColor: 'rgba(107,124,92,0.06)',
              border: `1px solid rgba(107,124,92,0.2)`,
              borderLeft: `3px solid ${D.green}`,
              borderRadius: '0 6px 6px 0',
            }}>
              <Typography sx={{ flex: 1, fontSize: '0.85rem', color: D.green, lineHeight: 1.5, fontFamily: D.body }}>
                ✓ {userPlan.note || 'Sorted'}
              </Typography>
              <Button
                size="small"
                disabled={saving}
                onClick={clearUserPlan}
                sx={{ fontSize: '0.72rem', fontWeight: 700, color: D.muted, textTransform: 'none', fontFamily: D.body, minWidth: 0 }}
              >
                Undo
              </Button>
            </Box>
          )}

          {/* "I've sorted this" — the traveller disagrees with the plan */}
          {canSort && (
            sortingOpen ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  autoFocus
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveUserPlan(); if (e.key === 'Escape') setSortingOpen(false); }}
                  placeholder="How? e.g. Driving, staying near the airport"
                  InputProps={{ sx: { fontFamily: D.body, fontSize: '0.85rem' } }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={saving}
                  onClick={saveUserPlan}
                  sx={{ flexShrink: 0, fontFamily: D.body, fontWeight: 700, backgroundColor: D.green, '&:hover': { backgroundColor: D.green } }}
                >
                  {saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Save'}
                </Button>
                <IconButton size="small" onClick={() => setSortingOpen(false)} sx={{ color: D.muted }}>
                  <CloseIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                <Button
                  size="small"
                  startIcon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                  onClick={() => setSortingOpen(true)}
                  sx={{
                    fontSize: '0.75rem', fontWeight: 700, py: 0.35, px: 1.25,
                    color: D.green, border: `1px solid rgba(107,124,92,0.35)`,
                    textTransform: 'none', fontFamily: D.body,
                    '&:hover': { backgroundColor: 'rgba(107,124,92,0.08)' },
                  }}
                >
                  I've sorted this
                </Button>
              </Box>
            )
          )}

          {!userPlan && (<>
            {/* Time pressure */}
            {leg?.timePressure?.active && (
              <Box sx={{
                mb: 1.5, px: 1.5, py: 1,
                backgroundColor: 'rgba(196,113,74,0.06)',
                border: `1px solid rgba(196,113,74,0.25)`,
                borderLeft: `3px solid ${D.terra}`,
                borderRadius: '0 6px 6px 0',
              }}>
                <Typography sx={{ fontSize: '0.82rem', color: D.terra, lineHeight: 1.5, fontFamily: D.body }}>
                  ⏱ {leg.timePressure.reason}
                </Typography>
              </Box>
            )}

            {/* First stop */}
            {leg?.firstStop && (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: D.muted, fontFamily: D.body, mb: 0.25 }}>
                  Head to first
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: D.navy, fontFamily: D.body }}>
                  {leg.firstStop.name}
                </Typography>
                {leg.firstStop.address && (
                  <Typography sx={{ fontSize: '0.8rem', color: D.muted, fontFamily: D.body }}>
                    {leg.firstStop.address}
                  </Typography>
                )}
              </Box>
            )}

            {/* Sorted detail */}
            {status === 'sorted' && leg?.sortedDetail && (
              <Box sx={{
                mb: hasSteps ? 1.5 : 0, px: 1.5, py: 1,
                backgroundColor: 'rgba(107,124,92,0.06)',
                border: `1px solid rgba(107,124,92,0.2)`,
                borderLeft: `3px solid ${D.green}`,
                borderRadius: '0 6px 6px 0',
              }}>
                <Typography sx={{ fontSize: '0.85rem', color: D.green, lineHeight: 1.5, fontFamily: D.body }}>
                  ✓ {leg.sortedDetail}
                </Typography>
              </Box>
            )}

            {/* No data state */}
            {status === 'no_data' && (
              <Typography sx={{ fontSize: '0.88rem', color: D.muted, fontFamily: D.body, py: 1 }}>
                Add accommodation or a venue to your trip and regenerate to get guidance for this leg.
              </Typography>
            )}

            {/* Generate button for gap legs with no steps yet */}
            {(status === 'gap') && !hasSteps && (
              <Button
                variant="outlined"
                startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ fontSize: '0.9rem !important' }} />}
                onClick={e => { e.stopPropagation(); onGenerate(); }}
                disabled={generating}
                sx={{
                  fontFamily: D.body, fontSize: '0.85rem', fontWeight: 700,
                  borderColor: D.navy, color: D.navy, mt: 0.5,
                  '&:hover': { backgroundColor: 'rgba(29,38,66,0.05)' },
                }}
              >
                {generating ? 'Generating…' : 'Generate plan'}
              </Button>
            )}

            {/* Steps */}
            {hasSteps && (
              <Box>
                {steps.map((step, i) => (
                  <Box key={step.label}>
                    <StepCard step={step} onDismiss={() => dismissStep(step)} />
                    {step.method !== 'car' && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pb: 0.5 }}>
                        <Button
                          size="small"
                          startIcon={adding === i ? <CircularProgress size={12} /> : <CalendarPlusIcon sx={{ fontSize: '0.85rem !important' }} />}
                          disabled={adding === i}
                          onClick={() => addToItinerary(step, i)}
                          sx={{
                            fontSize: '0.72rem', fontWeight: 700, py: 0.3, px: 1,
                            color: D.muted, textTransform: 'none', fontFamily: D.body,
                            '&:hover': { color: D.navy },
                          }}
                        >
                          Add to itinerary
                        </Button>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </>)}
        </Box>
      </Collapse>

      <Snackbar
        open={added}
        autoHideDuration={2500}
        onClose={() => setAdded(false)}
        message="Added to itinerary as a placeholder — set the time once booked"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ─── Overview pills — the 4-stop visual strip ─────────────────────────────────

function JourneyOverview({ legs, labels }: {
  legs:   Array<TransportLeg | null>;
  labels: string[];
}) {
  const statusColor = (s: TransportLeg['status'] | undefined) => {
    switch (s) {
      case 'sorted':         return D.green;
      case 'gap':            return D.terra;
      case 'no_data':        return D.muted;
      case 'not_applicable': return 'rgba(29,38,66,0.2)';
      default:               return D.muted;
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, px: 2, py: 1.5, overflowX: 'auto' }}>
      {labels.map((label, i) => {
        const leg   = legs[i];
        const color = statusColor(leg?.status);
        const isLast = i === labels.length - 1;
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%',
                backgroundColor: color,
                border: `2px solid ${color}`,
              }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color, fontFamily: D.body, letterSpacing: '0.04em', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.2 }}>
                {label}
              </Typography>
            </Box>
            {!isLast && (
              <Box sx={{ width: 28, height: 1.5, backgroundColor: 'rgba(29,38,66,0.15)', mx: 0.5, mb: 2.5 }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  tripId:   string;
  trip:     any;
}

export default function GettingThereStrip({ tripId, trip }: Props) {
  const [plan,       setPlan]       = useState<GroundTransportPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [collapsed,  setCollapsed]  = useState(false);

  const originCity      = trip?.origin?.city      ?? 'Home';
  const destinationCity = trip?.destination?.city  ?? 'Destination';

  useEffect(() => {
    fetch(`/api/trips/${tripId}/transport`)
      .then(r => r.json())
      .then(d => { if (d.plan) setPlan(d.plan); })
      .catch(() => {});
  }, [tripId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch(`/api/trips/${tripId}/transport`, { method: 'POST' });
      const data = await readSaved(res);
      if (!data.plan) setError('No plan returned — please try again');
      else setPlan(data.plan);
    } catch (e: any) {
      setError(e instanceof SaveError
        ? (e.message || 'Failed to generate — please try again')
        : 'Failed to generate — check your connection');
    } finally {
      setGenerating(false);
    }
  };

  // A leg the traveller sorted themselves reads as sorted everywhere
  const effective = (leg: TransportLeg | null | undefined): TransportLeg | null =>
    leg ? (leg.userPlan ? { ...leg, status: 'sorted' } : leg) : null;

  const legs = plan
    ? [plan.preDeparture, plan.arrivalLeg, plan.returnLeg, plan.homeCloseout].map(effective)
    : [null, null, null, null];

  const legDefs = [
    {
      key:      'preDeparture' as const,
      label:    'Pre-departure',
      subtitle: `${originCity} → Airport`,
    },
    {
      key:      'arrivalLeg' as const,
      label:    'Arrival',
      subtitle: `Airport → ${destinationCity}`,
    },
    {
      key:      'returnLeg' as const,
      label:    'Return',
      subtitle: `${destinationCity} → Airport`,
    },
    {
      key:      'homeCloseout' as const,
      label:    'Home',
      subtitle: `Airport → ${originCity}`,
    },
  ];

  const needsAction = (leg: TransportLeg | null | undefined) =>
    !!leg && !leg.userPlan && (leg.status === 'gap' || !!leg.earlyMorningWarning);

  const hasAnyGap = plan && legDefs.some(d => needsAction(plan[d.key]));

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1.5px solid ${D.rule}`,
        borderRadius: 2,
        backgroundColor: D.paper,
        overflow: 'hidden',
        mb: 2.5,
      }}
    >
      {/* ── Strip header ── */}
      <Box
        onClick={() => setCollapsed(c => !c)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.5,
          borderBottom: collapsed ? 'none' : `1px solid ${D.rule}`,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'rgba(29,38,66,0.02)' },
        }}
      >
        <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.navy, flex: 1 }}>
          Getting there
        </Typography>

        {hasAnyGap && (
          <Chip
            label="Action needed"
            size="small"
            sx={{
              height: 22, fontSize: '0.68rem', fontWeight: 700,
              backgroundColor: 'rgba(196,113,74,0.12)',
              color: D.terra, border: `1px solid rgba(196,113,74,0.3)`,
              fontFamily: D.body,
            }}
          />
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {plan && (
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); generate(); }}
              disabled={generating}
              title="Regenerate"
              sx={{ color: D.muted }}
            >
              {generating ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: '1rem' }} />}
            </IconButton>
          )}
          <IconButton size="small" sx={{ color: D.muted }}>
            {collapsed ? <ExpandMoreIcon sx={{ fontSize: '1.1rem' }} /> : <ExpandLessIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={!collapsed}>

        {/* ── Journey overview pills ── */}
        {plan && (
          <Box sx={{ borderBottom: `1px solid ${D.rule}` }}>
            <JourneyOverview
              legs={legs}
              labels={legDefs.map(d => d.subtitle)}
            />
          </Box>
        )}

        {/* ── Error ── */}
        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 2, fontFamily: D.body, fontSize: '0.88rem' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── Empty state ── */}
        {!plan && !generating && (
          <Box sx={{
            py: 4, px: 2, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2, textAlign: 'center',
          }}>
            <Typography sx={{ fontSize: '0.92rem', color: D.muted, maxWidth: 320, lineHeight: 1.55, fontFamily: D.body }}>
              Plan all four legs of your journey — from home to airport, across cities, and back — based on your flights, hotel, venues, and schedule.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={generate}
              sx={{
                fontWeight: 700, fontSize: '0.97rem',
                backgroundColor: D.navy, '&:hover': { backgroundColor: '#2a3660' },
                fontFamily: D.body,
              }}
            >
              Generate journey plan
            </Button>
          </Box>
        )}

        {/* ── Generating spinner ── */}
        {generating && !plan && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={20} sx={{ color: D.navy }} />
            <Typography sx={{ fontSize: '0.97rem', color: D.muted, fontFamily: D.body }}>
              Planning your journey…
            </Typography>
          </Box>
        )}

        {/* ── Leg panels ── */}
        {plan && (
          <Box>
            {legDefs.map((def, i) => (
              <LegPanel
                key={def.key}
                legKey={def.key}
                label={def.label}
                subtitle={def.subtitle}
                leg={plan[def.key]}
                generating={generating}
                onGenerate={generate}
                tripId={tripId}
                defaultOpen={needsAction(plan[def.key])}
                onPlanChange={setPlan}
              />
            ))}

            <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(29,38,66,0.3)', fontFamily: D.body }}>
                Generated {new Date(plan.generatedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}transport links and times are indicative — verify before booking
              </Typography>
            </Box>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
