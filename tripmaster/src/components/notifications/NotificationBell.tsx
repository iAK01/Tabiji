'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';
import {
  Badge, Box, Button, Divider, Drawer, IconButton, Switch, Typography, alpha,
} from '@mui/material';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import NotificationsOffIcon   from '@mui/icons-material/NotificationsOff';
import CloseIcon              from '@mui/icons-material/Close';
import SettingsOutlinedIcon   from '@mui/icons-material/SettingsOutlined';
import { openAppUrl, useNotificationInbox, useNotificationPrefs, type InboxItem } from '@/lib/push/useNotifications';

const NAVY  = '#2C3E50';
const GREEN = '#55702C';

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: GREEN },
};

function dayLabel(iso: string): string {
  const d     = DateTime.fromISO(iso);
  const today = DateTime.now().startOf('day');
  const diff  = Math.round(today.diff(d.startOf('day'), 'days').days);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toFormat(diff < 7 ? 'EEEE' : 'EEE d MMM');
}

function grouped(items: InboxItem[]): Array<[string, InboxItem[]]> {
  const groups = new Map<string, InboxItem[]>();
  for (const item of items) {
    const label = dayLabel(item.sentAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return [...groups.entries()];
}

interface Props {
  /** On a trip page: adds the switch to mute this trip. */
  tripId?:   string;
  tripName?: string;
}

export default function NotificationBell({ tripId, tripName }: Props) {
  const [open, setOpen] = useState(false);
  const { items, unread, loaded, refresh, markRead } = useNotificationInbox();
  const { prefs, update } = useNotificationPrefs();
  const allOff = prefs?.enabled === false;
  const muted  = !!tripId && !!prefs?.mutedTrips.includes(tripId);

  const show = async () => {
    setOpen(true);
    await refresh();
    markRead();
  };

  const go = (url: string) => {
    setOpen(false);
    openAppUrl(url);
  };

  return (
    <>
      <IconButton color="inherit" size="small" onClick={show} aria-label="Notifications" sx={{ ml: 0.5 }}>
        <Badge badgeContent={unread} max={9} color="error" overlap="circular">
          {allOff || muted ? <NotificationsOffIcon fontSize="small" /> : <NotificationsIcon fontSize="small" />}
        </Badge>
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, backgroundColor: '#FDFAF5' } }}
      >
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
          pt: 'calc(env(safe-area-inset-top) + 12px)',
          backgroundColor: NAVY, color: 'white',
        }}>
          <NotificationsIcon fontSize="small" />
          <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>Notifications</Typography>
          <IconButton color="inherit" size="small" onClick={() => setOpen(false)} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, minHeight: 56 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>All notifications</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: allOff ? 'error.main' : 'text.secondary' }}>
              {allOff ? 'Off — nothing will be sent' : 'On'}
            </Typography>
          </Box>
          <Switch
            checked={!allOff}
            disabled={!prefs}
            onChange={e => update({ enabled: e.target.checked })}
            inputProps={{ 'aria-label': 'All notifications' }}
            sx={switchSx}
          />
        </Box>
        <Divider />

        {tripId && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, minHeight: 56, opacity: allOff ? 0.5 : 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }} noWrap>
                  {tripName ? `Notifications for ${tripName}` : 'Notifications for this trip'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {muted ? 'Muted' : 'On'}
                </Typography>
              </Box>
              <Switch
                checked={!muted}
                disabled={!prefs || allOff}
                onChange={e => update({ mute: { tripId, muted: !e.target.checked } })}
                inputProps={{ 'aria-label': 'Notifications for this trip' }}
                sx={switchSx}
              />
            </Box>
            <Divider />
          </>
        )}

        <Box sx={{ flexGrow: 1, overflowY: 'auto', pb: 2 }}>
          {loaded && items.length === 0 && (
            <Typography sx={{ px: 2, py: 4, color: 'text.secondary', fontSize: '0.88rem', textAlign: 'center' }}>
              Nothing yet. Notifications you receive will show up here.
            </Typography>
          )}

          {grouped(items).map(([label, group]) => (
            <Box key={label}>
              <Typography sx={{
                px: 2, pt: 2, pb: 0.75, fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary',
              }}>
                {label}
              </Typography>
              {group.map(item => (
                <Box
                  key={item.id}
                  onClick={() => go(item.url)}
                  sx={{
                    display: 'flex', gap: 1.25, px: 2, py: 1.25, cursor: 'pointer',
                    borderBottom: '1px solid', borderColor: 'divider',
                    backgroundColor: item.read ? 'transparent' : alpha(GREEN, 0.06),
                    '&:hover': { backgroundColor: alpha(NAVY, 0.04) },
                  }}
                >
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', mt: 0.75, flexShrink: 0,
                    backgroundColor: item.read ? 'transparent' : GREEN,
                  }} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3 }}>
                      {item.title}
                    </Typography>
                    {item.body && (
                      <Typography sx={{
                        fontSize: '0.8rem', color: 'text.secondary', mt: 0.25, whiteSpace: 'pre-line',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {item.body}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mt: 0.5 }}>
                      {[item.tripName, DateTime.fromISO(item.sentAt).toFormat('HH:mm')].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>

        <Divider />
        <Box sx={{ px: 2, py: 1.25, pb: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
          <Button
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => go('/profile#notifications')}
            sx={{ textTransform: 'none', fontWeight: 700, color: NAVY }}
          >
            Notification settings
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
