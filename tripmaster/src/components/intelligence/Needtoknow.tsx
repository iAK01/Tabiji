'use client';

import { Box, Typography, Paper, Button, Chip } from '@mui/material';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import OpenInNewIcon     from '@mui/icons-material/OpenInNew';
import type { Intelligence } from './Intelligence.types';
import { D, SectionHeading, TimezoneCard } from './Intelligence.shared';

interface Props {
  visa:       Intelligence['visa'];
  tipping:    Intelligence['tipping'];
  water:      Intelligence['water'];
  payment:    Intelligence['payment'];
  cultural:   Intelligence['cultural'];
  timezone:   Intelligence['timezone'];
  electrical: Intelligence['electrical'];
  emergency:  Intelligence['emergency'];
}

// ─── Reference row ────────────────────────────────────────────────────────────

function RefRow({
  label, value, status, sub,
}: {
  label:   string;
  value:   string;
  status?: 'ok' | 'warn' | 'error' | 'neutral';
  sub?:    string;
}) {
  const dotColor = status === 'ok' ? '#4caf50' : status === 'warn' ? D.terra : status === 'error' ? '#d32f2f' : 'transparent';
  const rowBg    = status === 'error' ? 'rgba(211,47,47,0.04)' : status === 'warn' ? 'rgba(196,113,74,0.03)' : 'transparent';

  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: '110px 1fr 14px',
      alignItems: 'center', gap: 1.5,
      px: 1.75, py: 1.25,
      backgroundColor: rowBg,
      borderBottom: `1px solid ${D.rule}`,
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: D.muted, fontFamily: D.body,
      }}>
        {label}
      </Typography>
      <Box>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: D.navy, lineHeight: 1.3 }}>
          {value}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: '0.8rem', color: D.muted, lineHeight: 1.3 }}>{sub}</Typography>
        )}
      </Box>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
    </Box>
  );
}

// ─── Plug type friendly names ────────────────────────────────────────────────

const PLUG_LABEL: Record<string, string> = {
  A: 'US / Japan',
  B: 'US / Canada',
  C: 'European standard',
  D: 'India',
  E: 'France / Belgium',
  F: 'Germany / Austria',
  G: 'UK / Ireland',
  H: 'Israel',
  I: 'Australia / NZ',
  J: 'Switzerland',
  K: 'Denmark',
  L: 'Italy',
  M: 'South Africa',
  N: 'Brazil',
  O: 'Thailand',
};

interface PlugGroup {
  displayType: string;
  name:        string;
  typeLabel:   string;
  footnote?:   string;
}

function groupPlugs(plugStr: string, side: 'origin' | 'destination'): PlugGroup[] {
  const types = plugStr.split('/');

  if (side === 'origin') {
    return types.map(t => ({
      displayType: t,
      name:        PLUG_LABEL[t] ?? `Type ${t}`,
      typeLabel:   `Type ${t}`,
    }));
  }

  const euroTypes = types.filter(t => ['C', 'E', 'F'].includes(t));
  const usTypes   = types.filter(t => ['A', 'B'].includes(t));
  const others    = types.filter(t => !['C', 'E', 'F', 'A', 'B'].includes(t));
  const result: PlugGroup[] = [];

  if (euroTypes.length > 0) {
    const display = euroTypes.includes('C') ? 'C' : euroTypes[0];
    const extras  = euroTypes.filter(t => t !== display);
    result.push({
      displayType: display,
      name:        'European standard',
      typeLabel:   `Type ${euroTypes.join('/')}`,
      footnote:    extras.length > 0
        ? `Also used as Type ${extras.join('/')} in some countries — a Type C adapter works everywhere in Europe`
        : undefined,
    });
  }

  if (usTypes.length > 0) {
    const hasA = usTypes.includes('A');
    const hasB = usTypes.includes('B');
    result.push({
      displayType: hasA ? 'A' : 'B',
      name:        hasA && hasB ? 'US / Canada' : hasA ? 'US / Japan' : 'US / Canada',
      typeLabel:   `Type ${usTypes.join('/')}`,
      footnote:    hasA && hasB ? 'Type B adds grounding — most devices work with either' : undefined,
    });
  }

  for (const t of others) {
    result.push({ displayType: t, name: PLUG_LABEL[t] ?? `Type ${t}`, typeLabel: `Type ${t}` });
  }

  return result;
}

// ─── Need to Know ─────────────────────────────────────────────────────────────

export default function Needtoknow({ visa, tipping, water, payment, cultural, timezone, electrical, emergency }: Props) {

  const visaRowValue = !visa?.available
    ? 'Data unavailable'
    : !visa?.required
    ? `No visa · ${visa.maxStay ?? 'unlimited'}`
    : visa.typeLabel ?? 'Required';

  const visaRowStatus: 'ok' | 'warn' | 'neutral' = !visa?.available
    ? 'neutral'
    : !visa?.required ? 'ok' : 'warn';

  return (
    <Box>
      <SectionHeading id="need-to-know">Need to Know</SectionHeading>

      {/* ── Reference table ── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${D.rule}`, borderRadius: 1.5,
        overflow: 'hidden', backgroundColor: D.paper, mb: 3,
      }}>
        {visa     && <RefRow label="Visa"     value={visaRowValue}                                                               status={visaRowStatus} />}
        {water    && <RefRow label="Water"    value={water.drinkable ? 'Tap safe' : 'Bottled only'}                              status={water.drinkable ? 'ok' : 'warn'}    sub={water.drinkable ? undefined : water.notes} />}
        {payment  && <RefRow label="Payments" value={payment.cashCulture.charAt(0).toUpperCase() + payment.cashCulture.slice(1).replace('-', ' ')} sub={payment.contactless ? 'Contactless accepted' : undefined} status="neutral" />}
        {tipping  && <RefRow label="Tipping"  value={tipping.culture.charAt(0).toUpperCase() + tipping.culture.slice(1)}        status={tipping.culture === 'mandatory' || tipping.culture === 'expected' ? 'warn' : tipping.culture === 'offensive' || tipping.culture === 'not expected' ? 'ok' : 'neutral'} sub={`Restaurants: ${tipping.restaurants}`} />}
        {cultural && <RefRow label="Dress"    value={cultural.dressCode.charAt(0).toUpperCase() + cultural.dressCode.slice(1)}  status="neutral" />}
        {electrical && <RefRow label="Adapter" value={electrical.needsAdapter ? `${electrical.originPlug} → ${electrical.destinationPlug}` : 'No adapter needed'} status={electrical.needsAdapter ? 'warn' : 'ok'} />}
        <RefRow label="Emergency" value={emergency.number} sub={emergency.country} status="neutral" />
      </Paper>

      {/* ── Timezone — id for pill anchor ── */}
      <Box id="ntk-timezone" sx={{ mb: 3, scrollMarginTop: 60 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
          Timezone
        </Typography>
        <TimezoneCard timezone={timezone} />
      </Box>

      {/* ── Tipping detail — id for pill anchor ── */}
      {tipping && (
        <Box id="ntk-tipping" sx={{ mb: 3, scrollMarginTop: 60 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
            Tipping breakdown
          </Typography>
          <Paper elevation={0} sx={{ border: `1px solid ${D.rule}`, borderRadius: 1.5, backgroundColor: D.paper, overflow: 'hidden' }}>
            {[
              { label: 'Restaurants', value: tipping.restaurants },
              { label: 'Taxis',       value: tipping.taxis },
              { label: 'Hotels',      value: tipping.hotels },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 1.5, px: 1.75, py: 1.1, borderBottom: `1px solid ${D.rule}`, '&:last-child': { borderBottom: 'none' } }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: D.navy }}>{value}</Typography>
              </Box>
            ))}
            {tipping.notes && (
              <Box sx={{ px: 1.75, py: 1.25, borderTop: `1px solid ${D.rule}`, borderLeft: `2px solid ${D.terra}` }}>
                <Typography sx={{ fontSize: '0.88rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.5 }}>{tipping.notes}</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* ── Cultural notes ── */}
      {cultural?.notes && (
        <Box id="ntk-cultural" sx={{ mb: 3, scrollMarginTop: 60 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
            Cultural notes
          </Typography>
          <Box sx={{ borderLeft: `2px solid ${D.rule}`, pl: 1.5 }}>
            <Typography sx={{ fontSize: '0.93rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.6 }}>{cultural.notes}</Typography>
          </Box>
        </Box>
      )}

      {/* ── Payments detail ── */}
      {payment?.notes && (
        <Box id="ntk-payments" sx={{ mb: 3, scrollMarginTop: 60 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
            Payment notes
          </Typography>
          <Box sx={{ borderLeft: `2px solid ${D.rule}`, pl: 1.5 }}>
            <Typography sx={{ fontSize: '0.93rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.6 }}>{payment.notes}</Typography>
          </Box>
        </Box>
      )}

      {/* ── Visa detail (required only) — id for pill anchor ── */}
      {visa?.required && visa.available && (
        <Box id="ntk-visa" sx={{ mb: 3, scrollMarginTop: 60 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
            Visa details
          </Typography>
          <Paper elevation={0} sx={{ border: `1px solid rgba(196,113,74,0.3)`, backgroundColor: 'rgba(196,113,74,0.04)', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ borderLeft: `3px solid ${D.terra}` }}>
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningAmberIcon sx={{ fontSize: '1rem', color: D.terra }} />
                <Typography sx={{ fontFamily: D.display, fontSize: '1rem', color: D.navy }}>{visa.typeLabel}</Typography>
                {visa.name && <Chip label={visa.name} size="small" sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }} />}
              </Box>
              {[
                { label: 'Cost',       value: visa.cost },
                { label: 'Processing', value: visa.processingTime },
                { label: 'Max stay',   value: visa.maxStay },
              ].filter(r => r.value).map(({ label, value }) => (
                <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 1.5, px: 2, py: 1, borderTop: `1px solid ${D.rule}` }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: D.navy }}>{value}</Typography>
                </Box>
              ))}
              {visa.notes && (
                <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${D.rule}` }}>
                  <Typography sx={{ fontSize: '0.88rem', color: 'rgba(29,38,66,0.65)', lineHeight: 1.5 }}>{visa.notes}</Typography>
                </Box>
              )}
              {visa.applyUrl && (
                <Box sx={{ px: 2, pb: 1.75, pt: 0.5 }}>
                  <Button variant="outlined" size="small" endIcon={<OpenInNewIcon />}
                    href={visa.applyUrl} target="_blank" rel="noopener noreferrer"
                    sx={{ fontSize: '0.88rem', fontWeight: 700, borderColor: D.terra, color: D.terra, '&:hover': { borderColor: D.terra, backgroundColor: 'rgba(196,113,74,0.06)' } }}>
                    Apply online
                  </Button>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      )}

      {/* ── Electrical — id for pill anchor ── */}
      {electrical?.needsAdapter && (
        <Box id="ntk-adapter" sx={{ mb: 3, scrollMarginTop: 60 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, mb: 1.25 }}>
            Electrical adapter
          </Typography>
          <Paper elevation={0} sx={{
            border: `1px solid rgba(196,113,74,0.3)`,
            backgroundColor: 'rgba(196,113,74,0.04)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <Box sx={{ borderLeft: `4px solid ${D.terra}`, px: 3, pt: 2.5, pb: 3 }}>
              <Typography sx={{ fontFamily: D.display, fontSize: '1.25rem', color: D.navy, mb: 2.5 }}>
                {electrical.message}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 }, flexWrap: 'wrap' }}>
                {groupPlugs(electrical.originPlug, 'origin').map(g => (
                  <Box key={g.displayType} sx={{ textAlign: 'center', maxWidth: 100 }}>
                    <Box sx={{
                      width: 80, height: 80, borderRadius: 2,
                      border: `1px solid ${D.rule}`, backgroundColor: D.paper,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1,
                    }}>
                      <img src={`/plugs/${g.displayType}.svg`} alt={g.name} width={52} height={52} />
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, lineHeight: 1.2 }}>Home</Typography>
                    <Typography sx={{ fontSize: '0.97rem', fontWeight: 800, color: D.navy, lineHeight: 1.2 }}>{g.name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: D.muted }}>{g.typeLabel}</Typography>
                  </Box>
                ))}

                <Typography sx={{ fontSize: '1.5rem', color: D.muted, fontWeight: 300, flexShrink: 0 }}>→</Typography>

                {groupPlugs(electrical.destinationPlug, 'destination').map(g => (
                  <Box key={g.displayType}>
                    <Box sx={{ textAlign: 'center', maxWidth: 100 }}>
                      <Box sx={{
                        width: 80, height: 80, borderRadius: 2,
                        border: `1px solid rgba(196,113,74,0.35)`,
                        backgroundColor: 'rgba(196,113,74,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1,
                      }}>
                        <img src={`/plugs/${g.displayType}.svg`} alt={g.name} width={52} height={52} />
                      </Box>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: D.muted, lineHeight: 1.2 }}>There</Typography>
                      <Typography sx={{ fontSize: '0.97rem', fontWeight: 800, color: D.navy, lineHeight: 1.2 }}>{g.name}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: D.muted }}>{g.typeLabel}</Typography>
                    </Box>
                    {g.footnote && (
                      <Typography sx={{ fontSize: '0.78rem', color: D.muted, fontStyle: 'italic', mt: 1, maxWidth: 280 }}>
                        {g.footnote}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ── Emergency — id for pill anchor ── */}
      <Box id="ntk-emergency" sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: 2, borderTop: `1px solid ${D.rule}`, scrollMarginTop: 60 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '3rem', lineHeight: 1, color: '#d32f2f', letterSpacing: '-0.02em' }}>
          {emergency.number}
        </Typography>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.97rem', color: D.navy, mb: 0.5 }}>{emergency.country}</Typography>
          <Button variant="outlined" size="small" color="error" href={`tel:${emergency.number}`}
            sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
            Call {emergency.number}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}