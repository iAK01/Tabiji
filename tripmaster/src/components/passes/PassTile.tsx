'use client';

// The way into a booking's passes: a small copy of the barcode, what it is, and
// the seat — or, when it was uploaded against the wrong flight, which one it's for.

import { Box, ButtonBase, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { barcodeSrc, legFlight, passLabel, passSummary, type Pass } from '@/lib/passes/passes';
import { D } from '@/components/logistics/logistics.helpers';

export default function PassTile({ passes, t, onOpen }: { passes: Pass[]; t: any; onOpen: () => void }) {
  const first = passes[0];
  if (!first) return null;
  const mismatch = passes.find(p => p.mismatch);
  const title    = passes.length > 1 ? `${passes.length} ${first.barcode.bcbp ? 'boarding passes' : 'tickets'}` : passLabel(first);
  const detail   = mismatch?.leg
    ? `For ${legFlight(mismatch.leg, t?.departureTime)}`
    : passes.length > 1
      ? passes.map(p => p.barcode.bcbp?.passenger?.split(' ')[0]).filter(Boolean).join(', ')
      : passSummary(first);

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, width: '100%',
        p: 1, minHeight: 60, borderRadius: 2, textAlign: 'left',
        border: '1px solid rgba(29,38,66,0.12)', backgroundColor: '#FFFFFF',
      }}
    >
      <Box
        component="img"
        src={barcodeSrc(first.barcode.svg)}
        alt=""
        sx={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: D.body, fontWeight: 700, fontSize: '0.85rem', color: D.navy }}>
          {title}
        </Typography>
        {detail && (
          <Typography noWrap sx={{ fontFamily: D.body, fontSize: '0.75rem', color: mismatch ? D.terra : 'text.secondary', fontWeight: mismatch ? 700 : 400 }}>
            {detail}
          </Typography>
        )}
      </Box>
      <ChevronRightIcon sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );
}
