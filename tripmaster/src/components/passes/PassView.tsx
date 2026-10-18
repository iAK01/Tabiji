'use client';

// A boarding pass (or ticket) as the gate scanner wants it: the barcode alone,
// big, on white, with the screen kept awake. Redrawn from the payload read out
// of the uploaded screenshot, so it's sharp and works offline; the original
// stays a tap away for anyone who wants to see the whole thing.

import { useEffect, useState } from 'react';
import { Box, ButtonBase, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon  from '@mui/icons-material/Close';
import ImageIcon  from '@mui/icons-material/ImageOutlined';
import DocumentViewer, { type ViewableFile } from '@/components/files/DocumentViewer';
import AddPassButton from './AddPassButton';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { wallClock } from '@/lib/push/timezones';
import { barcodeSrc, legFlight, passLabel, type Pass } from '@/lib/passes/passes';
import { closingTimes, flightPhase, statusLine, type FlightStatus } from '@/lib/flights/status';
import { D } from '@/components/logistics/logistics.helpers';
import { TONE } from '@/components/flights/FlightLive';

interface PassViewProps {
  open:    boolean;
  passes:  Pass[];
  t:       any;              // the booking they're for
  flight?: FlightStatus | null;
  onClose: () => void;
  // Another traveller's pass, or a re-issued one after a seat change.
  add?:    { tripId: string; index: number; onAdded: (files: any[]) => void };
}

export default function PassView({ open, passes, t, flight: status, onClose, add }: PassViewProps) {
  const [which,  setWhich]  = useState(0);
  const [viewer, setViewer] = useState<ViewableFile | null>(null);
  useWakeLock(open && passes.length > 0, () => {});

  useEffect(() => { if (open) setWhich(0); }, [open]);

  const pass = passes[Math.min(which, passes.length - 1)];
  if (!pass) return null;

  const leg     = pass.leg;
  const flight  = t?.details?.flightNumber || (leg ? `${leg.carrier} ${leg.flightNumber}` : '');
  const dep     = wallClock(t?.departureTime, 'UTC');
  const route   = leg ? `${leg.from} → ${leg.to}` : [t?.departureLocation, t?.arrivalLocation].filter(Boolean).join(' → ');
  const wide    = pass.barcode.format === 'PDF417';
  // The gate first once it shows — it's what you're looking for at the airport.
  const gate    = status && !['airborne', 'landed'].includes(flightPhase(status)) ? status.dep.gate : null;
  const facts   = [
    ['Gate', gate],
    ...(leg ? [['Seat', leg.seat], ['Seq', leg.sequence], ['Booking ref', leg.pnr]] : []),
  ].filter(([, v]) => v) as string[][];
  const close   = closingTimes(t);
  const live    = status ? statusLine(status) : null;
  const liveBits = [
    live?.text,
    status?.dep.terminal && `Terminal ${status.dep.terminal}`,
    close && `Gate closes ${close.gate.toFormat('HH:mm')}`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        PaperProps={{ sx: { backgroundColor: '#FFFFFF' } }}
      >
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1, pt: 'calc(env(safe-area-inset-top) + 8px)', pb: 1,
        }}>
          <IconButton onClick={onClose} aria-label="Close" sx={{ width: 44, height: 44 }}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
            {[flight, passLabel(pass)].filter(Boolean).join(' · ')}
          </Typography>
        </Box>

        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          px: 2, pb: 'calc(env(safe-area-inset-bottom) + 24px)', overflowY: 'auto',
        }}>
          <Box
            component="img"
            src={barcodeSrc(pass.barcode.svg)}
            alt={`${passLabel(pass)} barcode`}
            sx={{
              display: 'block', mt: { xs: 2, sm: 4 },
              width: wide ? '100%' : 'min(80vw, 360px)', maxWidth: wide ? 560 : undefined,
              height: 'auto', p: 2, backgroundColor: '#FFFFFF',
            }}
          />

          {pass.mismatch && leg && (
            <Typography sx={{ mt: 1.5, fontFamily: D.body, fontSize: '0.85rem', fontWeight: 700, color: D.terra, textAlign: 'center' }}>
              This pass is for {legFlight(leg, t?.departureTime)}
            </Typography>
          )}

          {pass.barcode.bcbp?.passenger && (
            <Typography sx={{ mt: 2.5, fontFamily: D.display, fontSize: '1.4rem', color: D.navy, textAlign: 'center', lineHeight: 1.15 }}>
              {pass.barcode.bcbp.passenger}
            </Typography>
          )}
          <Typography sx={{ mt: 0.5, fontFamily: D.body, fontSize: '0.9rem', color: 'text.secondary', textAlign: 'center' }}>
            {[route, dep?.toFormat('EEE d MMM · HH:mm')].filter(Boolean).join(' · ')}
          </Typography>

          {liveBits && (
            <Typography sx={{ mt: 1, fontFamily: D.body, fontSize: '0.85rem', fontWeight: 700, color: live ? TONE[live.tone] : D.navy, textAlign: 'center' }}>
              {liveBits}
            </Typography>
          )}

          {facts.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 4, rowGap: 1.5, mt: 2.5, justifyContent: 'center' }}>
              {facts.map(([label, value]) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontFamily: D.display, fontSize: label === 'Booking ref' ? '1.1rem' : '1.6rem', color: label === 'Booking ref' ? D.terra : D.navy, lineHeight: 1.3 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Several travellers on one booking — one pass each */}
          {passes.length > 1 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3, justifyContent: 'center' }}>
              {passes.map((p, i) => (
                <ButtonBase
                  key={p.file._id}
                  onClick={() => setWhich(i)}
                  sx={{
                    minHeight: 44, px: 2, borderRadius: 99, fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem',
                    border: '1.5px solid', borderColor: i === which ? D.navy : 'divider',
                    backgroundColor: i === which ? D.navy : 'transparent',
                    color: i === which ? '#FFFFFF' : D.navy,
                  }}
                >
                  {p.barcode.bcbp?.passenger?.split(' ')[0] || `Pass ${i + 1}`}
                </ButtonBase>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 1, mt: 3 }}>
            {pass.file.gcsUrl && (
              <ButtonBase
                onClick={() => setViewer({ _id: pass.file._id, name: pass.file.name, mimeType: pass.file.mimeType, gcsUrl: pass.file.gcsUrl })}
                sx={{ minHeight: 44, px: 2, gap: 1, borderRadius: 2, color: 'text.secondary', fontFamily: D.body, fontWeight: 600, fontSize: '0.85rem' }}
              >
                <ImageIcon sx={{ fontSize: '1.1rem' }} />
                Show original
              </ButtonBase>
            )}
            {add && <AddPassButton variant="text" tripId={add.tripId} index={add.index} t={t} onAdded={add.onAdded} />}
          </Box>
        </Box>
      </Dialog>
      <DocumentViewer file={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
