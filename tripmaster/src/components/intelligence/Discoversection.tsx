'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert,
  Chip, Button, IconButton, Tooltip,
} from '@mui/material';
import AutoAwesomeIcon  from '@mui/icons-material/AutoAwesome';
import RefreshIcon      from '@mui/icons-material/Refresh';
import EventIcon        from '@mui/icons-material/Event';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MapIcon          from '@mui/icons-material/Map';
import AddIcon          from '@mui/icons-material/Add';
import type { CultureData, CultureHighlight } from './Intelligence.types';
import { D, TYPE_COLOURS, TYPE_LABELS, buildMapUrl, SectionHeading } from './Intelligence.shared';
import Addtoitinerarydialog from './Addtoitinerarydialog';

// ─── Highlight card — typographic ────────────────────────────────────────────

function HighlightCard({ h, onAddToItinerary }: { h: CultureHighlight; onAddToItinerary: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const spineColor = TYPE_COLOURS[h.type] ?? '#333';
  const mapUrl     = buildMapUrl(h);

  return (
    <Paper elevation={0} sx={{
      display: 'flex', overflow: 'hidden',
      border: `1px solid ${D.rule}`, borderRadius: 1.5,
      backgroundColor: D.paper,
    }}>
      {/* Colour spine */}
      <Box sx={{ width: 4, flexShrink: 0, backgroundColor: spineColor }} />

      <Box sx={{ p: 2.5, flexGrow: 1, minWidth: 0 }}>
        {/* Category micro-label */}
        <Typography sx={{
          fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.09em',
          color: D.muted, mb: 0.4, fontFamily: D.body,
        }}>
          {TYPE_LABELS[h.type] ?? 'Other'}
        </Typography>

        {/* Venue name — typographic anchor */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontFamily: D.display,
            fontSize: '1.25rem', lineHeight: 1.15,
            color: D.navy, letterSpacing: '-0.01em',
          }}>
            {h.name}
          </Typography>
          {h.free && (
            <Box sx={{
              mt: 0.25, px: 0.75, py: 0.2,
              border: `1px solid rgba(107,124,92,0.4)`,
              borderRadius: 0.75, flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: D.green }}>Free entry</Typography>
            </Box>
          )}
          {h.nearVenue && (
            <Box sx={{
              mt: 0.25, px: 0.75, py: 0.2,
              backgroundColor: 'rgba(107,124,92,0.08)',
              borderRadius: 0.75, flexShrink: 0,
            }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: D.green }}>Near {h.nearVenue}</Typography>
            </Box>
          )}
        </Box>

        {/* Description — 3-line clamp, expand on tap */}
        <Typography
          onClick={() => setExpanded(e => !e)}
          sx={{
            fontSize: '0.95rem', lineHeight: 1.6,
            color: 'rgba(29,38,66,0.65)',
            ...(expanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }),
            cursor: 'pointer',
            mb: 0.25,
          }}
        >
          {h.description}
        </Typography>
        {!expanded && h.description.length > 180 && (
          <Typography
            onClick={() => setExpanded(true)}
            sx={{ fontSize: '0.82rem', fontWeight: 700, color: D.green, cursor: 'pointer', mb: 0.5 }}
          >
            Read more
          </Typography>
        )}

        {/* Tip — terracotta pullquote */}
        {h.tip && (
          <Box sx={{
            borderLeft: `2px solid ${D.terra}`,
            pl: 1.5, mt: 1, mb: 0.75,
          }}>
            <Typography sx={{
              fontSize: '0.88rem', color: D.terra,
              fontStyle: 'italic', lineHeight: 1.5,
            }}>
              {h.tip}
            </Typography>
          </Box>
        )}

        {/* Address + actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
          <Box
            component="a" href={mapUrl} target="_blank" rel="noopener noreferrer"
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              fontSize: '0.82rem', color: D.muted, textDecoration: 'none', fontWeight: 500,
              border: `1px solid ${D.rule}`, borderRadius: 1,
              px: 1, py: 0.4,
              '&:hover': { borderColor: D.green, color: D.green },
            }}
          >
            <MapIcon sx={{ fontSize: '0.9rem' }} />
            {h.address ? h.address.split(',').slice(0, 2).join(',') : 'Open in Maps'}
          </Box>

          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: '0.9rem !important' }} />}
            onClick={onAddToItinerary}
            sx={{
              fontSize: '0.82rem', fontWeight: 700, py: 0.4, px: 1.25,
              border: `1px solid rgba(29,38,66,0.25)`,
              color: D.navy, backgroundColor: 'rgba(29,38,66,0.03)',
              '&:hover': { backgroundColor: 'rgba(29,38,66,0.08)' },
            }}
          >
            Add to day
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Category sub-heading ─────────────────────────────────────────────────────

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.09em',
      color: D.muted, mb: 1.5, fontFamily: D.body,
    }}>
      {children}
    </Typography>
  );
}

// ─── Discover section ─────────────────────────────────────────────────────────

interface Props { tripId: string; }

export default function Discoversection({ tripId }: Props) {
  const [culture,    setCulture]    = useState<CultureData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [addTarget,  setAddTarget]  = useState<CultureHighlight | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/culture`)
      .then(r => r.json())
      .then(d => setCulture(d.culture ?? null))
      .catch(() => {});
  }, [tripId]);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const res  = await fetch(`/api/trips/${tripId}/culture`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setCulture(data.culture);
    } catch { setError('Failed to generate — check your connection'); }
    finally { setGenerating(false); }
  };

  const openAddDialog = (h: CultureHighlight) => { setAddTarget(h); setDialogOpen(true); };

  const hasBriefing    = !!culture?.briefing;
  const freeDays       = culture?.freeAccess?.freeDays?.filter((e: any) => !e.dateUnknown) ?? [];
  const standingAccess = culture?.freeAccess?.standing ?? [];
  const freeAccessTip  = culture?.freeAccess?.tip ?? null;

  const cultural = culture?.briefing?.highlights.filter(h => h.category === 'cultural') ?? [];
  const coffees  = culture?.briefing?.highlights.filter(h => h.category === 'coffee')   ?? [];
  const parks    = culture?.briefing?.highlights.filter(h => h.category === 'park')     ?? [];

  return (
    <Box>
      <SectionHeading
        id="discover"
        action={hasBriefing ? (
          <Tooltip title="Regenerate">
            <IconButton size="small" onClick={generate} disabled={generating} sx={{ p: 0.5 }}>
              <RefreshIcon sx={{ fontSize: '1.1rem', color: D.muted }} />
            </IconButton>
          </Tooltip>
        ) : null}
      >
        Discover
      </SectionHeading>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.95rem' }}>{error}</Typography>
        </Alert>
      )}

      {/* Empty state */}
      {!hasBriefing && !generating && (
        <Box sx={{
          py: 5, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2, textAlign: 'center',
          border: `1px dashed ${D.rule}`, borderRadius: 1.5,
        }}>
          <AutoAwesomeIcon sx={{ fontSize: '2rem', color: D.muted }} />
          <Box>
            <Typography sx={{ fontFamily: D.display, fontSize: '1.25rem', color: D.navy, mb: 0.5 }}>
              Cultural briefing
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', color: D.muted, maxWidth: 300, lineHeight: 1.55 }}>
              Curated highlights, the best local coffee, green spaces, and a neighbourhood to explore — generated for this trip.
            </Typography>
          </Box>
          <Button
            variant="contained" startIcon={<AutoAwesomeIcon />} onClick={generate}
            sx={{ fontWeight: 700, fontSize: '0.97rem', backgroundColor: D.navy, '&:hover': { backgroundColor: '#2a3660' } }}
          >
            Generate briefing
          </Button>
        </Box>
      )}

      {generating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 5, justifyContent: 'center' }}>
          <CircularProgress size={20} sx={{ color: D.navy }} />
          <Typography sx={{ fontSize: '0.97rem', color: D.muted }}>
            Thinking about {culture?.briefing?.destination ?? 'your destination'}…
          </Typography>
        </Box>
      )}

      {hasBriefing && !generating && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

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

          {/* ── Cultural highlights ── */}
          {cultural.length > 0 && (
            <Box>
              <SubHeading>Cultural</SubHeading>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {cultural.map((h, i) => <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />)}
              </Box>
            </Box>
          )}

          {/* ── Coffee ── */}
          {coffees.length > 0 && (
            <Box>
              <SubHeading>Coffee</SubHeading>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {coffees.map((h, i) => <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />)}
              </Box>
            </Box>
          )}

          {/* ── Parks ── */}
          {parks.length > 0 && (
            <Box>
              <SubHeading>Green spaces</SubHeading>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {parks.map((h, i) => <HighlightCard key={i} h={h} onAddToItinerary={() => openAddDialog(h)} />)}
              </Box>
            </Box>
          )}

          {/* ── Neighbourhood ── */}
          {culture!.briefing!.neighbourhood && (
            <Box>
              <SubHeading>Walk this neighbourhood</SubHeading>
              <Paper elevation={0} sx={{
                p: 2.5, border: `1px solid rgba(29,38,66,0.2)`,
                backgroundColor: 'rgba(29,38,66,0.03)', borderRadius: 1.5,
                display: 'flex', overflow: 'hidden',
              }}>
                <Box sx={{ width: 4, flexShrink: 0, backgroundColor: D.navy, mr: 2.5 }} />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <LocationCityIcon sx={{ fontSize: '1rem', color: D.navy }} />
                    <Typography sx={{ fontFamily: D.display, fontSize: '1.1rem', color: D.navy }}>
                      {culture!.briefing!.neighbourhood.name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.97rem', lineHeight: 1.6, color: 'rgba(29,38,66,0.65)' }}>
                    {culture!.briefing!.neighbourhood.description}
                  </Typography>
                  {(culture!.briefing!.neighbourhood.address || culture!.briefing!.neighbourhood.coordinates) && (
                    <Box
                      component="a"
                      href={buildMapUrl({ name: culture!.briefing!.neighbourhood.name, coordinates: culture!.briefing!.neighbourhood.coordinates, address: culture!.briefing!.neighbourhood.address })}
                      target="_blank" rel="noopener noreferrer"
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.25,
                        fontSize: '0.85rem', color: D.muted, textDecoration: 'none', fontWeight: 500,
                        border: `1px solid ${D.rule}`, borderRadius: 1, px: 1, py: 0.4,
                        '&:hover': { borderColor: D.navy, color: D.navy },
                      }}
                    >
                      <MapIcon sx={{ fontSize: '0.9rem' }} />
                      Open in Maps
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          )}

          {/* ── Free cultural access ── */}
          {(standingAccess.length > 0 || freeAccessTip) && (
            <Box>
              <SubHeading>Free cultural access</SubHeading>
              <Paper elevation={0} sx={{
                border: `1px solid rgba(107,124,92,0.25)`,
                backgroundColor: 'rgba(107,124,92,0.04)', borderRadius: 1.5,
                overflow: 'hidden',
              }}>
                {standingAccess.map((item: any, i: number) => (
                  <Box key={i} sx={{
                    px: 2.5, py: 2,
                    borderBottom: i < standingAccess.length - 1 ? `1px solid ${D.rule}` : 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                      {item.touristsEligible === false && (
                        <Box sx={{ px: 0.75, py: 0.15, border: `1px solid rgba(196,113,74,0.4)`, borderRadius: 0.75 }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: D.terra }}>Residents only</Typography>
                        </Box>
                      )}
                      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: D.navy }}>
                        {item.title}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.93rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.55 }}>
                      {item.description}
                    </Typography>
                    {item.when && (
                      <Typography sx={{ fontSize: '0.85rem', color: D.green, display: 'block', mt: 0.5 }}>
                        {item.when}
                      </Typography>
                    )}
                    {item.caveat && (
                      <Typography sx={{ fontSize: '0.85rem', color: D.terra, display: 'block', mt: 0.4, fontStyle: 'italic' }}>
                        {item.caveat}
                      </Typography>
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

          {/* ── Practical note ── */}
          {culture!.briefing!.practicalNote && (
            <Box sx={{
              borderLeft: `2px solid ${D.rule}`,
              pl: 1.5,
            }}>
              <Typography sx={{ fontSize: '0.93rem', color: D.muted, lineHeight: 1.6, fontStyle: 'italic' }}>
                {culture!.briefing!.practicalNote}
              </Typography>
            </Box>
          )}

          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(29,38,66,0.3)', textAlign: 'right' }}>
            Generated {new Date(culture!.briefing!.generatedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Typography>
        </Box>
      )}

      <Addtoitinerarydialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        highlight={addTarget}
        tripId={tripId}
      />
    </Box>
  );
}