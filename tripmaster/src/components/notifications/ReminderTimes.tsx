'use client';

// Reminder times in bulk: the reminder before each stop on a trip (from the
// notification centre on a trip page), your default for every trip (Profile,
// and the notification centre elsewhere), and starting a trip's reminders again.

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Typography, alpha,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { REMINDER_OPTIONS, LEAD_CHOICES, type TripLead } from '@/lib/push/leads';
import { reloadNotificationPrefs, useNotificationPrefs } from '@/lib/push/useNotifications';
import { changeTripReminders, fetchTripLeads, REMINDERS_CHANGED, type TripLeads } from '@/lib/push/tripReminders';
import { reportSaveFailure } from '@/lib/offline/saveErrors';

const NAVY  = '#2C3E50';
const MUTED = 'rgba(29,38,66,0.55)';

const leadLabel = (v: number) => REMINDER_OPTIONS.find(o => o.value === v)?.label ?? `${v}m`;

type ChipValue = string | number;

export function LeadChips({ options, value, onPick, disabled }: {
  options:   Array<{ label: string; value: ChipValue }>;
  value:     ChipValue;
  onPick:    (v: ChipValue) => void;
  disabled?: boolean;
}) {
  return (
    <Box role="radiogroup" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {options.map(o => {
        const selected = o.value === value;
        return (
          <Chip
            key={String(o.value)}
            role="radio"
            aria-checked={selected}
            label={o.label}
            disabled={disabled}
            onClick={() => !selected && onPick(o.value)}
            sx={{
              height: 40, minWidth: 52, borderRadius: '10px', fontWeight: 700,
              backgroundColor: selected ? NAVY : alpha(NAVY, 0.06),
              color: selected ? '#fff' : NAVY,
              '&:hover': { backgroundColor: selected ? NAVY : alpha(NAVY, 0.12) },
            }}
          />
        );
      })}
    </Box>
  );
}

const LEAD_ONLY = LEAD_CHOICES.map(v => ({ label: leadLabel(v), value: v }));

/** Your default reminder before every stop without its own time, on every trip. */
export function DefaultStopReminder({ compact }: { compact?: boolean }) {
  const { prefs, update } = useNotificationPrefs();
  if (!prefs) return null;
  return (
    <Box>
      {!compact && (
        <Typography sx={{ fontSize: '0.75rem', color: MUTED, mb: 1 }}>
          For stops without a time of their own. A trip can set its own from its bell.
        </Typography>
      )}
      <LeadChips
        options={[{ label: 'By type', value: 'type' }, ...LEAD_ONLY]}
        value={prefs.stopLeadMins ?? 'type'}
        onPick={v => update({ stopLeadMins: v === 'type' ? null : Number(v) })}
      />
    </Box>
  );
}

/** The reminder before each stop on one trip, with "start again". */
export function TripReminderTimes({ tripId }: { tripId: string }) {
  const { prefs } = useNotificationPrefs();
  const [open,    setOpen]    = useState(false);
  const [leads,   setLeads]   = useState<TripLeads | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'replace'; lead: TripLead | null } | { kind: 'reset' }>(null);

  const refresh = useCallback(() => {
    fetchTripLeads(tripId).then(l => { if (l) setLeads(l); });
  }, [tripId]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);
  useEffect(() => {
    window.addEventListener(REMINDERS_CHANGED, refresh);
    return () => window.removeEventListener(REMINDERS_CHANGED, refresh);
  }, [refresh]);

  const userDefault = prefs?.stopLeadMins ?? leads?.user ?? null;
  const defaultName = userDefault ? `Default (${leadLabel(userDefault)})` : 'Default';
  const current     = leads?.trip ?? 'default';
  const summary     = !leads
    ? ''
    : leads.trip === 'off'
      ? 'Off for stops on this trip'
      : typeof leads.trip === 'number'
        ? `${leadLabel(leads.trip)} before each stop`
        : userDefault ? `${leadLabel(userDefault)} before each stop` : 'By type of stop';

  const apply = async (change: Parameters<typeof changeTripReminders>[1], what: string) => {
    setSaving(true);
    const before = leads;
    if (leads) {
      setLeads({
        ...leads,
        trip: change.action === 'reset' ? null : change.leadMins,
        ownStops: change.action === 'reset' || change.replaceStops ? 0 : leads.ownStops,
      });
    }
    try {
      await changeTripReminders(tripId, change);
      if (change.action === 'reset') await reloadNotificationPrefs();
    } catch (err) {
      setLeads(before);
      reportSaveFailure(what, err);
    } finally {
      setSaving(false);
    }
  };

  const pick = (v: ChipValue) => {
    const lead: TripLead | null = v === 'default' ? null : v === 'off' ? 'off' : Number(v);
    if (leads?.ownStops) setConfirm({ kind: 'replace', lead });
    else apply({ action: 'setTripLead', leadMins: lead, replaceStops: false }, 'the reminder time for this trip');
  };

  const pickedLabel = (lead: TripLead | null) =>
    lead === null ? 'your default' : lead === 'off' ? 'no reminder' : `${leadLabel(lead)} before`;

  return (
    <Box>
      <Box
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, minHeight: 56, cursor: 'pointer' }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>Reminder times</Typography>
          {summary && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{summary}</Typography>}
        </Box>
        <ExpandMoreIcon sx={{ color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, mb: 1 }}>
            Before each stop on this trip
          </Typography>
          <LeadChips
            options={[
              { label: defaultName, value: 'default' },
              { label: 'Off', value: 'off' },
              ...LEAD_ONLY,
            ]}
            value={current}
            disabled={!leads || saving}
            onPick={pick}
          />
          {!!leads?.ownStops && (
            <Typography sx={{ fontSize: '0.75rem', color: MUTED, mt: 1 }}>
              {leads.ownStops} stop{leads.ownStops === 1 ? ' has its' : 's have their'} own time
            </Typography>
          )}
          <Button
            startIcon={<RestartAltIcon />}
            disabled={!leads || saving}
            onClick={() => setConfirm({ kind: 'reset' })}
            sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, color: NAVY, minHeight: 44 }}
          >
            Reset this trip’s reminders
          </Button>
        </Box>
      </Collapse>

      <Dialog open={confirm?.kind === 'replace'} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        {confirm?.kind === 'replace' && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Use {pickedLabel(confirm.lead)} for every stop?</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: '0.9rem' }}>
                {leads?.ownStops} stop{leads?.ownStops === 1 ? ' on this trip has its' : 's on this trip have their'} own reminder time.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
              <Button
                onClick={() => { const c = confirm; setConfirm(null); apply({ action: 'setTripLead', leadMins: c.lead, replaceStops: false }, 'the reminder time for this trip'); }}
                sx={{ textTransform: 'none', fontWeight: 700, color: NAVY, minHeight: 44 }}
              >
                Keep their times
              </Button>
              <Button
                variant="contained"
                onClick={() => { const c = confirm; setConfirm(null); apply({ action: 'setTripLead', leadMins: c.lead, replaceStops: true }, 'the reminder time for this trip'); }}
                sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: NAVY, minHeight: 44, boxShadow: 'none' }}
              >
                Change them too
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={confirm?.kind === 'reset'} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reset this trip’s reminders?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem' }}>
            Every stop goes back to your default reminder time, booking reminders you switched off come back on, and the trip is unmuted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none', fontWeight: 700, color: NAVY, minHeight: 44 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => { setConfirm(null); apply({ action: 'reset' }, 'the reset of this trip’s reminders'); }}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: NAVY, minHeight: 44, boxShadow: 'none' }}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
