'use client';

import { useEffect, useState } from 'react';
import {
  Box, Chip, Paper, Switch, TextField, Typography, alpha,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { CATEGORY_OPTIONS, type NotificationCategory } from '@/lib/push/prefs';
import { useNotificationPrefs } from '@/lib/push/useNotifications';

const GREEN = '#55702C';
const MUTED = 'rgba(29,38,66,0.45)';

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: GREEN },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: MUTED, mt: 2, mb: 0.75,
    }}>
      {children}
    </Typography>
  );
}

function Row({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.25 }}>
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: disabled ? 'text.disabled' : 'text.primary' }}>
        {label}
      </Typography>
      <Switch size="small" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} sx={switchSx} />
    </Box>
  );
}

// A time field that saves once it holds a complete time.
function TimeField({ label, value, disabled, onSave }: {
  label: string; value: string; disabled?: boolean; onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label={label}
      type="time"
      size="small"
      value={draft}
      disabled={disabled}
      onChange={e => {
        setDraft(e.target.value);
        if (/^\d{2}:\d{2}$/.test(e.target.value) && e.target.value !== value) onSave(e.target.value);
      }}
      InputLabelProps={{ shrink: true }}
      sx={{ width: 130 }}
    />
  );
}

export default function NotificationSettings() {
  const { prefs, update } = useNotificationPrefs();
  const [tripNames, setTripNames] = useState<Map<string, string>>(new Map());

  // Names for muted trips
  useEffect(() => {
    if (!prefs?.mutedTrips.length) return;
    fetch('/api/trips')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setTripNames(new Map((data?.trips ?? []).map((t: any) => [String(t._id), t.name]))))
      .catch(() => {});
  }, [prefs?.mutedTrips.length]);

  // Arriving from the inbox's "Notification settings" link
  const ready = !!prefs;
  useEffect(() => {
    if (ready && window.location.hash === '#notifications') {
      document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [ready]);

  if (!prefs) return null;

  const setCategory = (key: NotificationCategory, on: boolean) => update({ categories: { [key]: on } });
  const muted = prefs.mutedTrips.filter(id => tripNames.has(id) || !tripNames.size);

  return (
    <Paper id="notifications" elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, scrollMarginTop: 80 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <TuneIcon sx={{ fontSize: 18, color: GREEN }} />
        <Typography variant="body1" fontWeight={800}>Notification settings</Typography>
      </Box>

      <Label>Send me</Label>
      {CATEGORY_OPTIONS.map(({ key, label }) => (
        <Row key={key} label={label} checked={prefs.categories[key]} onChange={on => setCategory(key, on)} />
      ))}

      <Label>Quiet hours</Label>
      <Row
        label="Hold notifications overnight"
        checked={prefs.quietHours.enabled}
        onChange={on => update({ quietHours: { enabled: on } })}
      />
      <Typography sx={{ fontSize: '0.75rem', color: MUTED, mb: 1.25 }}>
        Local time wherever you are. Check-in, to-do and expense reminders wait until it ends; everything else still comes through.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TimeField label="From" value={prefs.quietHours.start} disabled={!prefs.quietHours.enabled}
          onSave={v => update({ quietHours: { start: v } })} />
        <TimeField label="Until" value={prefs.quietHours.end} disabled={!prefs.quietHours.enabled}
          onSave={v => update({ quietHours: { end: v } })} />
      </Box>

      <Label>Briefings</Label>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TimeField label="Morning" value={prefs.briefingTimes.morning} disabled={!prefs.categories.briefings}
          onSave={v => update({ briefingTimes: { morning: v } })} />
        <TimeField label="Evening before" value={prefs.briefingTimes.evening} disabled={!prefs.categories.briefings}
          onSave={v => update({ briefingTimes: { evening: v } })} />
      </Box>

      {muted.length > 0 && (
        <>
          <Label>Muted trips</Label>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {muted.map(id => (
              <Chip
                key={id}
                label={tripNames.get(id) ?? 'Trip'}
                onDelete={() => update({ mute: { tripId: id, muted: false } })}
                sx={{ fontWeight: 600, backgroundColor: alpha(GREEN, 0.08) }}
              />
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
}
