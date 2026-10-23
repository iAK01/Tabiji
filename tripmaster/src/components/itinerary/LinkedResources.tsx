'use client';

import { Box, Typography, Link } from '@mui/material';
import PersonOutlineIcon         from '@mui/icons-material/PersonOutline';
import TaskAltIcon               from '@mui/icons-material/TaskAlt';
import RadioButtonUncheckedIcon  from '@mui/icons-material/RadioButtonUnchecked';
import StickyNote2Icon           from '@mui/icons-material/StickyNote2';
import LinkIcon                  from '@mui/icons-material/Link';
import { D } from './Itinerary.config';
import type { LinkedItem } from './record';

// Contacts, to-dos, notes and links from Resources that are linked to a stop.
// Files show as chips where they open, not here.
export function LinkedResources({ items, full = false }: { items: LinkedItem[]; full?: boolean }) {
  const shown = items.filter(i => i.resourceType !== 'file');
  if (!shown.length) return null;
  const linkSx = { color: D.navy, fontWeight: 700, textDecorationColor: D.rule };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {shown.map(item => {
        const Icon = item.resourceType === 'contact' ? PersonOutlineIcon
                   : item.resourceType === 'todo'    ? (item.completed ? TaskAltIcon : RadioButtonUncheckedIcon)
                   : item.resourceType === 'link'    ? LinkIcon
                   : StickyNote2Icon;
        return (
          <Box key={item._id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Icon sx={{ fontSize: 18, color: D.muted, mt: 0.15, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{
                fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, color: D.navy, lineHeight: 1.35,
                textDecoration: item.resourceType === 'todo' && item.completed ? 'line-through' : 'none',
              }}>
                {item.resourceType === 'link' && item.linkUrl
                  ? <Link href={item.linkUrl} target="_blank" rel="noopener noreferrer" sx={linkSx}>{item.name}</Link>
                  : item.name}
              </Typography>
              {item.resourceType === 'contact' && (item.phone || item.email) && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.muted, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  {item.phone && <Link href={`tel:${item.phone}`} sx={linkSx}>{item.phone}</Link>}
                  {item.phone && item.email && ' · '}
                  {item.email && <Link href={`mailto:${item.email}`} sx={linkSx}>{item.email}</Link>}
                </Typography>
              )}
              {item.resourceType === 'note' && item.body && (
                <Typography sx={{
                  fontFamily: D.body, fontSize: '0.8rem', color: D.muted, lineHeight: 1.45, whiteSpace: 'pre-wrap',
                  ...(!full && { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }),
                }}>
                  {item.body}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
