'use client';

// A day's tasks — things to get done and tick off that don't need a time block.
// Sits near the top of every itinerary day, in every view. Ticking is one tap;
// adding, editing, moving to another day and reminders happen in the sheet.

import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, ButtonBase, IconButton, Chip, Collapse, Dialog, TextField, MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon                  from '@mui/icons-material/Add';
import TaskAltIcon              from '@mui/icons-material/TaskAlt';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import NotificationsIcon        from '@mui/icons-material/Notifications';
import ExpandMoreIcon           from '@mui/icons-material/ExpandMore';
import { D } from './Itinerary.config';
import { newTaskId, TASK_MAX_LENGTH, type DayTask } from '@/lib/itinerary/tasks';

type TaskFields = Partial<Pick<DayTask, 'text' | 'remindAt' | 'date'>>;

interface Props {
  date:           string;   // YYYY-MM-DD — the day on screen
  tasks:          DayTask[];
  /** Every day of the trip, for moving a task */
  dayOptions:     Array<{ date: string; label: string }>;
  isMobile:       boolean;
  highlightId:    string | null;
  /** Now on the itinerary's clock — to say when a reminder time has already gone */
  now:            { ymd: string; mins: number };
  /** The planner's reminder for a task (sent or not), from /api/trips/[id]/reminders */
  reminderFor:    (task: DayTask) => { local: string; sent: boolean } | null;
  /** Why reminders wouldn't arrive at all (notifications off, trip muted…) */
  reminderNotice: string | null;
  onToggle:       (task: DayTask) => void;
  /** Each resolves false when it couldn't be saved or queued — the sheet stays open with the input */
  onAdd:          (task: DayTask) => Promise<boolean>;
  onUpdate:       (task: DayTask, fields: TaskFields) => Promise<boolean>;
  onDelete:       (task: DayTask) => Promise<boolean>;
}

const labelSx = {
  fontFamily: D.body, fontSize: '0.62rem', fontWeight: 800,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: D.muted, lineHeight: 1,
} as const;

export function DayTasks({
  date, tasks, dayOptions, isMobile, highlightId, now, reminderFor, reminderNotice,
  onToggle, onAdd, onUpdate, onDelete,
}: Props) {
  const openCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.length - openCount;
  // Open while there's something left to do; folds once it's all ticked off
  const [openPick, setOpenPick] = useState<boolean | null>(null);
  const linkedHere = !!highlightId && tasks.some(t => t._id === highlightId);
  const open = linkedHere || (openPick ?? openCount > 0);
  const [sheet, setSheet] = useState<{ task: DayTask | null } | null>(null);

  const sheetEl = sheet && (
    <TaskSheet
      task={sheet.task}
      date={date}
      dayOptions={dayOptions}
      isMobile={isMobile}
      now={now}
      reminderNotice={reminderNotice}
      onAdd={onAdd}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onClose={() => setSheet(null)}
    />
  );

  const boxSx = {
    mb: 1.5, border: `1px solid ${D.rule}`, borderRadius: '8px',
    backgroundColor: '#ffffff', overflow: 'hidden',
  } as const;

  // The sheet stays last in the box, so adding the first task doesn't remount it
  return (
    <Box sx={boxSx}>
      {tasks.length === 0 ? (
        <ButtonBase
          onClick={() => setSheet({ task: null })}
          sx={{ width: '100%', minHeight: 44, px: 1.25, gap: 1, justifyContent: 'flex-start', textAlign: 'left' }}
        >
          <TaskAltIcon sx={{ fontSize: 18, color: D.muted, flexShrink: 0 }} />
          <Typography sx={labelSx}>Tasks</Typography>
          <Typography sx={{ flex: 1, fontFamily: D.body, fontSize: '0.82rem', fontWeight: 600, color: D.muted }}>
            Add a task
          </Typography>
          <AddIcon sx={{ fontSize: 20, color: D.green, flexShrink: 0 }} />
        </ButtonBase>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ButtonBase
              onClick={() => setOpenPick(!open)}
              aria-expanded={open}
              sx={{ flex: 1, minWidth: 0, minHeight: 44, pl: 1.25, pr: 0.5, gap: 1, justifyContent: 'flex-start', textAlign: 'left' }}
            >
              <TaskAltIcon sx={{ fontSize: 18, color: openCount ? D.navy : D.green, flexShrink: 0 }} />
              <Typography sx={labelSx}>Tasks</Typography>
              <Typography sx={{
                flex: 1, minWidth: 0, fontFamily: D.body, fontSize: '0.8rem', fontWeight: 700,
                color: openCount ? D.navy : D.green, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {openCount === 0 ? 'All done' : `${doneCount} of ${tasks.length} done`}
              </Typography>
              <ExpandMoreIcon sx={{
                fontSize: 20, color: D.muted, flexShrink: 0,
                transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
              }} />
            </ButtonBase>
            <IconButton
              onClick={() => setSheet({ task: null })}
              aria-label="Add a task"
              sx={{ width: 44, height: 44, flexShrink: 0, color: D.green }}
            >
              <AddIcon />
            </IconButton>
          </Box>

          <Collapse in={open}>
            {tasks.map(task => {
              const rem  = task.done ? null : (reminderFor(task) ?? (task.remindAt ? { local: task.remindAt, sent: false } : null));
              const ring = task._id === highlightId;
              return (
                <Box
                  key={task._id}
                  data-task-id={task._id}
                  sx={{
                    display: 'flex', alignItems: 'center', minHeight: 44,
                    borderTop: `1px solid ${D.rule}`,
                    transition: 'box-shadow 0.3s, background-color 0.3s',
                    ...(ring && { boxShadow: `inset 0 0 0 2px ${D.terra}`, backgroundColor: alpha(D.terra, 0.06) }),
                  }}
                >
                  <IconButton
                    onClick={() => onToggle(task)}
                    aria-label={task.done ? `Mark “${task.text}” not done` : `Mark “${task.text}” done`}
                    aria-pressed={task.done}
                    sx={{ width: 44, height: 44, flexShrink: 0, ml: 0.25 }}
                  >
                    {task.done
                      ? <CheckCircleIcon sx={{ fontSize: 22, color: D.green }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 22, color: alpha(D.navy, 0.4) }} />}
                  </IconButton>
                  <ButtonBase
                    onClick={() => setSheet({ task })}
                    aria-label={`Edit “${task.text}”`}
                    sx={{
                      flex: 1, minWidth: 0, minHeight: 44, py: 0.75, pr: 1.25,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, textAlign: 'left',
                    }}
                  >
                    <Typography sx={{
                      fontFamily: D.body, fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.35,
                      color: task.done ? D.muted : D.navy,
                      textDecoration: task.done ? 'line-through' : 'none',
                      overflowWrap: 'anywhere',
                    }}>
                      {task.text}
                    </Typography>
                    {rem && (
                      <Box
                        component="span"
                        title={rem.sent ? `Reminder sent at ${rem.local}` : `Reminder at ${rem.local}`}
                        sx={{
                          display: 'inline-flex', alignItems: 'center', gap: 0.25, flexShrink: 0,
                          fontFamily: D.body, fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: rem.sent ? alpha(D.navy, 0.3) : alpha(D.navy, 0.6),
                        }}
                      >
                        <NotificationsIcon sx={{ fontSize: 13 }} />
                        {rem.local}
                      </Box>
                    )}
                  </ButtonBase>
                </Box>
              );
            })}
          </Collapse>
        </Box>
      )}
      {sheetEl}
    </Box>
  );
}

// ─── Add / edit sheet ─────────────────────────────────────────────────────────

const toMins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// A reminder time to start from: the next half hour on today's page, else 09:00
function suggestedTime(date: string, now: { ymd: string; mins: number }): string {
  if (date !== now.ymd) return '09:00';
  const next = Math.min(23 * 60 + 30, Math.ceil((now.mins + 1) / 30) * 30);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

function TaskSheet({ task, date: pageDate, dayOptions, isMobile, now, reminderNotice, onAdd, onUpdate, onDelete, onClose }: {
  task:           DayTask | null;   // null: a new one
  date:           string;
  dayOptions:     Props['dayOptions'];
  isMobile:       boolean;
  now:            Props['now'];
  reminderNotice: string | null;
  onAdd:          Props['onAdd'];
  onUpdate:       Props['onUpdate'];
  onDelete:       Props['onDelete'];
  onClose:        () => void;
}) {
  const editing = !!task;
  const [text,     setText]     = useState(task?.text ?? '');
  const [date,     setDate]     = useState(task?.date ?? pageDate);
  const [remind,   setRemind]   = useState(!!task?.remindAt);
  const [time,     setTime]     = useState(task?.remindAt ?? suggestedTime(task?.date ?? pageDate, now));
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  // Added while the sheet's been open — it stays open for the next one
  const [added,    setAdded]    = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // A new day's suggestion, unless a time's been picked already
  const pickedTime = useRef(!!task?.remindAt);
  useEffect(() => {
    if (!pickedTime.current) setTime(suggestedTime(date, now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const trimmed  = text.trim();
  const remindAt = remind && /^\d{2}:\d{2}$/.test(time) ? time : null;
  const passed   = !!remindAt && (date < now.ymd || (date === now.ymd && toMins(remindAt) <= now.mins));
  const busy     = saving || deleting;

  const submit = async () => {
    if (!trimmed || busy) return;
    setSaving(true);
    if (task) {
      const fields: TaskFields = {};
      if (trimmed !== task.text) fields.text = trimmed;
      if (date !== task.date) fields.date = date;
      if (remindAt !== (task.remindAt ?? null)) fields.remindAt = remindAt;
      const ok = Object.keys(fields).length ? await onUpdate(task, fields) : true;
      setSaving(false);
      if (ok) onClose();
      return;
    }
    const ok = await onAdd({ _id: newTaskId(), date, text: trimmed, done: false, remindAt, createdAt: new Date().toISOString() });
    setSaving(false);
    if (!ok) return;
    setAdded(a => [...a, trimmed]);
    setText('');
    setRemind(false);
    pickedTime.current = false;
    setTime(suggestedTime(date, now));
    inputRef.current?.focus();
  };

  const remove = async () => {
    if (!task || busy) return;
    setDeleting(true);
    const ok = await onDelete(task);
    setDeleting(false);
    if (ok) onClose();
  };

  const chipSx = (on: boolean) => ({
    height: 40, borderRadius: '10px', fontFamily: D.body, fontWeight: 700,
    backgroundColor: on ? D.navy : alpha(D.navy, 0.06),
    color: on ? '#fff' : D.navy,
    '&:hover': { backgroundColor: on ? D.navy : alpha(D.navy, 0.12) },
  });
  const btnSx = { minHeight: 44, fontFamily: D.body, fontWeight: 700 } as const;

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      fullWidth maxWidth="xs"
      // Phone: at the top, so the keyboard doesn't cover it
      sx={{ '& .MuiDialog-container': { alignItems: isMobile ? 'flex-start' : 'center' } }}
      PaperProps={{ sx: {
        borderRadius: '14px', backgroundColor: D.paper,
        ...(isMobile && { m: 2, mt: 'max(env(safe-area-inset-top), 16px)', width: 'calc(100% - 32px)' }),
      } }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        <Typography sx={{ fontFamily: D.display, fontSize: '1.05rem', color: D.navy }}>
          {editing ? 'Task' : 'New task'}
        </Typography>

        <TextField
          inputRef={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          placeholder="Close all the windows"
          autoFocus multiline maxRows={4} fullWidth
          inputProps={{ maxLength: TASK_MAX_LENGTH, enterKeyHint: editing ? 'done' : 'enter', 'aria-label': 'Task' }}
          InputProps={{ sx: { fontFamily: D.body, fontSize: '1rem' } }}
        />

        {added.length > 0 && (
          <Typography sx={{ fontFamily: D.body, fontSize: '0.8rem', color: D.green, fontWeight: 700, mt: -0.75 }}>
            Added: {added.join(' · ')}
          </Typography>
        )}

        <TextField
          select label="Day" value={date} size="small"
          onChange={e => setDate(e.target.value)}
          InputProps={{ sx: { fontFamily: D.body } }}
          InputLabelProps={{ sx: { fontFamily: D.body } }}
        >
          {dayOptions.map(o => (
            <MenuItem key={o.date} value={o.date} sx={{ fontFamily: D.body }}>{o.label}</MenuItem>
          ))}
        </TextField>

        <Box>
          <Box role="radiogroup" aria-label="Reminder" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip role="radio" aria-checked={!remind} label="No reminder" onClick={() => setRemind(false)} sx={chipSx(!remind)} />
            <Chip
              role="radio" aria-checked={remind}
              icon={<NotificationsIcon sx={{ fontSize: '16px !important', color: 'inherit !important' }} />}
              label="Remind me" onClick={() => setRemind(true)} sx={chipSx(remind)}
            />
            {remind && (
              <TextField
                type="time" size="small" value={time}
                onChange={e => { pickedTime.current = true; setTime(e.target.value); }}
                inputProps={{ 'aria-label': 'Reminder time', step: 300 }}
                InputProps={{ sx: { fontFamily: D.body, fontWeight: 700, height: 40 } }}
                sx={{ width: 120 }}
              />
            )}
          </Box>
          {remind && passed && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.terra, mt: 0.75 }}>
              That time has already passed
            </Typography>
          )}
          {remind && reminderNotice && (
            <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.terra, mt: 0.75 }}>
              {reminderNotice}
            </Typography>
          )}
        </Box>

        {confirm && task ? (
          <Box sx={{ borderTop: `1px solid ${D.rule}`, pt: 1.5 }}>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 700, color: D.navy }}>
              Delete “{task.text}”?
            </Typography>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.82rem', color: D.muted, mt: 0.5 }}>
              {task.remindAt ? `Its reminder at ${task.remindAt} goes too. ` : ''}This can’t be undone.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.25 }}>
              <Button onClick={() => setConfirm(false)} disabled={busy} sx={btnSx}>Keep it</Button>
              <Button
                variant="contained" color="error" onClick={remove} disabled={busy}
                sx={{ ...btnSx, boxShadow: 'none' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editing && (
              <Button color="error" onClick={() => setConfirm(true)} disabled={busy} sx={{ ...btnSx, mr: 'auto' }}>
                Delete
              </Button>
            )}
            <Button onClick={onClose} disabled={busy} sx={{ ...btnSx, ml: editing ? 0 : 'auto' }}>
              {added.length ? 'Done' : 'Cancel'}
            </Button>
            <Button
              variant="contained" onClick={submit} disabled={!trimmed || busy}
              sx={{ ...btnSx, backgroundColor: D.navy, boxShadow: 'none', '&:hover': { backgroundColor: D.navy, boxShadow: 'none' } }}
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
