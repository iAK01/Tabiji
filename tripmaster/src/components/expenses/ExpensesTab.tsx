'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Snackbar, useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import ReceiptIcon    from '@mui/icons-material/Receipt';
import CameraAltIcon  from '@mui/icons-material/CameraAlt';
import DownloadIcon   from '@mui/icons-material/Download';
import DeleteIcon     from '@mui/icons-material/Delete';
import EditIcon       from '@mui/icons-material/Edit';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { queueAction, saveTripCache, getTripCache } from '@/lib/offline/db';
import { EXPENSE_CATEGORIES as CATEGORIES, EXPENSE_PAYERS as PAYERS, EXPENSE_STATUSES as STATUSES, getPayerLabel, payerNameMissing, type TripPayerNames } from '@/lib/logistics/expenseConstants';
import { getProofSlots, FUEL_RECEIPT_SLOT, type ProofSlot } from '@/lib/logistics/expenseProofs';
import { compressImageFile } from '@/lib/utils/imageCompression';

const D = {
  navy: '#1D2642', terra: '#C4714A', green: '#6B7C5C',
  bg: '#F5F0E8', paper: '#FDFAF5', muted: 'rgba(29,38,66,0.45)', rule: 'rgba(29,38,66,0.10)',
  display: '"Archivo Black", sans-serif', body: '"Archivo", "Inter", sans-serif',
} as const;

const STATUS_COLOUR: Record<string, string> = {
  captured: '#6b7280', confirmed: '#0369a1', submitted: '#b45309', paid: '#22c55e',
};

function categoryMenuItems() {
  const groups = Array.from(new Set(CATEGORIES.map(c => c.group)));
  return groups.flatMap(group => [
    <MenuItem key={`hdr-${group}`} disabled sx={{ opacity: 1, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
      {group}
    </MenuItem>,
    ...CATEGORIES.filter(c => c.group === group).map(c => (
      <MenuItem key={c.value} value={c.value} sx={{ pl: 3 }}>{c.label}</MenuItem>
    )),
  ]);
}

const todayStr = () => new Date().toISOString().split('T')[0];
const BLANK_FORM = {
  date: todayStr(), category: 'other', amount: '', currency: 'EUR', gratuity: '', notes: '', payer: 'tbc', status: 'captured',
  reimbursementMethod: '', mileageDistance: '', mileageUnit: 'km', mileageRate: '',
};

interface ExpensesTabProps {
  tripId:      string;
  trip?:       TripPayerNames | null;
  fabTrigger?: { action: string; seq: number } | null;
}

export default function ExpensesTab({ tripId, trip, fabTrigger }: ExpensesTabProps) {
  const theme  = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [expenses,    setExpenses]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [payerFilter, setPayerFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,        setForm]        = useState(BLANK_FORM);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Proof checklist — existing (already-saved) proofs for the item being edited,
  // newly-selected files staged until Save, and gcsPaths marked for removal on Save.
  const [existingProofs,   setExistingProofs]   = useState<any[]>([]);
  const [proofUploads,     setProofUploads]     = useState<Record<string, File[]>>({});
  const [removedProofPaths, setRemovedProofPaths] = useState<string[]>([]);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureForm, setCaptureForm] = useState({ amount: '', category: 'other' });
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  // Files still waiting behind captureFile — populated when several files are
  // dropped at once, so a batch of separate receipts gets worked through one
  // dialog at a time instead of silently keeping only the first.
  const [captureQueue, setCaptureQueue] = useState<File[]>([]);
  const [captureBatchTotal, setCaptureBatchTotal] = useState(0);

  const [zipping, setZipping] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [view, setView] = useState<'expenses' | 'documents'>('expenses');
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0); // dragenter/dragleave fire per child element — a counter avoids flicker

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/trips/${tripId}/expenses`);
        const data = await res.json();
        setExpenses(data.expenses ?? []);
        await saveTripCache(tripId, { ...(await getTripCache(tripId)), expenses: data.expenses ?? [] });
      } catch {
        const cached = await getTripCache(tripId);
        if (cached?.expenses) setExpenses(cached.expenses);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  // ── FAB trigger — "quickly capture" opens the minimal camera-first dialog ────
  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.action === 'expense_capture') {
      setCaptureFile(null); setCaptureQueue([]); setCaptureBatchTotal(0);
      setCaptureOpen(true);
    }
  }, [fabTrigger]);

  const openAdd = () => {
    setEditId(null); setForm(BLANK_FORM); setReceiptFile(null);
    setExistingProofs([]); setProofUploads({}); setRemovedProofPaths([]);
    setDialogOpen(true);
  };
  const openEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      date:     (e.date ?? '').split('T')[0] || BLANK_FORM.date,
      category: e.category ?? 'other',
      amount:   String(e.amount ?? ''),
      currency: e.currency ?? 'EUR',
      gratuity: e.gratuity != null ? String(e.gratuity) : '',
      notes:    e.notes ?? '',
      payer:    e.payer ?? 'tbc',
      status:   e.status ?? 'captured',
      reimbursementMethod: e.reimbursementMethod ?? '',
      mileageDistance:     e.mileageDistance != null ? String(e.mileageDistance) : '',
      mileageUnit:         e.mileageUnit ?? 'km',
      mileageRate:         e.mileageRate != null ? String(e.mileageRate) : '',
    });
    setReceiptFile(null);
    setExistingProofs(e.proofs ?? []);
    setProofUploads({});
    setRemovedProofPaths([]);
    setDialogOpen(true);
  };

  const addProofFiles = (key: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProofUploads(prev => ({ ...prev, [key]: [...(prev[key] ?? []), ...Array.from(files)] }));
  };
  const removeExistingProof = (gcsPath: string) => {
    setExistingProofs(prev => prev.filter(p => p.gcsPath !== gcsPath));
    setRemovedProofPaths(prev => [...prev, gcsPath]);
  };
  const removePendingProof = (key: string, idx: number) => {
    setProofUploads(prev => ({ ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== idx) }));
  };

  // One checklist row: label, required/optional, upload button, and chips for
  // whatever's already attached (saved or newly staged) with a way to remove each.
  const renderProofSlot = (slot: ProofSlot) => {
    const existing = existingProofs.filter(p => p.key === slot.key);
    const pending  = proofUploads[slot.key] ?? [];
    const has      = existing.length > 0 || pending.length > 0;
    return (
      <Box key={slot.key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {has
            ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
            : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />}
          <Typography sx={{ fontFamily: D.body, fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>
            {slot.label}
            {!slot.required && <Typography component="span" sx={{ fontFamily: D.body, fontWeight: 400, color: D.muted }}> (optional)</Typography>}
          </Typography>
          <Button component="label" size="small" sx={{ fontFamily: D.body, fontSize: '0.72rem', flexShrink: 0 }}>
            {has && !slot.multiple ? 'Replace' : 'Add'}
            <input type="file" hidden multiple={slot.multiple} accept="image/*,application/pdf"
              onChange={e => addProofFiles(slot.key, e.target.files)} />
          </Button>
        </Box>
        {(existing.length > 0 || pending.length > 0) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 3 }}>
            {existing.map(p => (
              <Chip key={p.gcsPath} size="small" label={p.originalName || slot.label}
                onClick={() => window.open(p.gcsUrl, '_blank')}
                onDelete={() => removeExistingProof(p.gcsPath)}
                sx={{ fontFamily: D.body, fontSize: '0.68rem', cursor: 'pointer' }} />
            ))}
            {pending.map((f, i) => (
              <Chip key={i} size="small" label={f.name} color="primary" variant="outlined"
                onClick={() => window.open(URL.createObjectURL(f), '_blank')}
                onDelete={() => removePendingProof(slot.key, i)}
                sx={{ fontFamily: D.body, fontSize: '0.68rem', cursor: 'pointer' }} />
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const buildFormData = (f: typeof form, file: File | null) => {
    const fd = new FormData();
    fd.append('date', f.date);
    fd.append('category', f.category);
    fd.append('amount', f.amount);
    fd.append('currency', f.currency);
    if (f.gratuity) fd.append('gratuity', f.gratuity);
    if (f.notes) fd.append('notes', f.notes);
    fd.append('payer', f.payer);
    fd.append('status', f.status);
    if (file) fd.append('receipt', file);
    return fd;
  };

  const saveExpense = async () => {
    if (!form.amount) return;
    setSaving(true);
    // Compressed before upload — a 200MP camera photo shouldn't cost 40MB of
    // mobile data or risk hitting the server's size cap. PDFs pass through
    // untouched; compression only ever applies to actual images.
    const compressedReceipt = receiptFile ? await compressImageFile(receiptFile) : null;
    const fd = buildFormData(form, compressedReceipt);
    if (form.category === 'car') {
      fd.append('reimbursementMethod', form.reimbursementMethod);
      if (form.reimbursementMethod === 'mileage') {
        fd.append('mileageDistance', form.mileageDistance);
        fd.append('mileageUnit', form.mileageUnit);
        fd.append('mileageRate', form.mileageRate);
      }
    }
    const proofCount = Object.values(proofUploads).reduce((n, files) => n + files.length, 0);
    for (const [key, files] of Object.entries(proofUploads)) {
      for (const file of files) {
        const compressed = await compressImageFile(file);
        fd.append(`proof_${key}`, compressed);
      }
    }
    if (removedProofPaths.length > 0) fd.append('removedProofPaths', JSON.stringify(removedProofPaths));

    const url    = editId ? `/api/trips/${tripId}/expenses/${editId}` : `/api/trips/${tripId}/expenses`;
    const method = editId ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || undefined);
      }
      const data = await res.json();
      setExpenses(prev => editId ? prev.map(e => e._id === editId ? data.expense : e) : [data.expense, ...prev]);
      setDialogOpen(false);
      setSnackbarMsg(proofCount > 0 ? `Saved — ${proofCount} document${proofCount === 1 ? '' : 's'} uploaded` : 'Expense saved');
    } catch (err: any) {
      // A specific validation error (bad file type, too large) isn't a connectivity
      // problem — show what the server actually said instead of a generic guess.
      setSnackbarMsg(err?.message || 'Save failed — check your connection and try again');
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setExpenses(prev => prev.filter(e => e._id !== id));
      setSnackbarMsg('Expense deleted');
    } catch {
      setSnackbarMsg('Delete failed — check your connection and try again');
    }
  };

  const advanceStatus = async (e: any) => {
    const next = STATUSES[Math.min(STATUSES.indexOf(e.status) + 1, STATUSES.length - 1)];
    const fd = new FormData();
    fd.append('status', next);
    const res  = await fetch(`/api/trips/${tripId}/expenses/${e._id}`, { method: 'PUT', body: fd });
    const data = await res.json();
    setExpenses(prev => prev.map(x => x._id === e._id ? data.expense : x));
  };

  // ── Quick capture — photo + amount only, everything else filled in later ────
  const saveCapture = async () => {
    if (!captureForm.amount) return;
    setSaving(true);
    // Compressed once, up front — matters even more for the offline path, since
    // an uncompressed 200MP photo sitting in IndexedDB is a real storage-quota
    // risk while it waits to sync.
    const compressedFile = captureFile ? await compressImageFile(captureFile) : null;
    const payload = {
      date: todayStr(), category: captureForm.category, amount: captureForm.amount,
      currency: 'EUR', gratuity: '', notes: '', payer: 'tbc', status: 'captured',
    };
    if (!navigator.onLine) {
      // The blob rides straight into IndexedDB (structured clone supports File/Blob
      // natively) — flushQueue() builds the real multipart upload once back online.
      await queueAction({
        type: 'ADD_EXPENSE', tripId, payload,
        receiptBlob: compressedFile ?? null,
        receiptName: compressedFile?.name ?? null,
        receiptType: compressedFile?.type ?? null,
      });
      setExpenses(prev => [{ _id: `pending-${Date.now()}`, ...payload, amount: parseFloat(payload.amount), _pending: true }, ...prev]);
      setSaving(false);
      setSnackbarMsg(
        captureQueue.length > 0
          ? `Captured offline (${captureQueue.length} more queued) — will finish uploading once you're back online`
          : 'Captured offline — will finish uploading once you\'re back online',
      );
      advanceCaptureQueue();
      return;
    }
    try {
      const fd  = buildFormData(payload as any, compressedFile);
      const res = await fetch(`/api/trips/${tripId}/expenses`, { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || undefined);
      }
      const data = await res.json();
      setExpenses(prev => [data.expense, ...prev]);
      setSnackbarMsg(
        captureQueue.length > 0
          ? `Captured — ${captureQueue.length} more to go`
          : (captureFile ? 'Captured — photo uploaded' : 'Captured'),
      );
      advanceCaptureQueue();
    } catch (err: any) {
      // Failure doesn't advance the queue — retry this file, don't silently
      // skip past it and lose it.
      setSnackbarMsg(err?.message || 'Capture failed — check your connection and try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Drag-and-drop anywhere on the tab — opens quick capture pre-attached ──
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter.current++;
    setDragActive(true);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    // A dropped batch is realistically either several separate receipts (a
    // folder of taxi receipts) or several pages of one — either way, every file
    // gets its own turn through the dialog rather than the rest being discarded.
    setCaptureQueue(files.slice(1));
    setCaptureBatchTotal(files.length);
    setCaptureFile(files[0]);
    setCaptureForm({ amount: '', category: 'other' });
    setCaptureOpen(true);
  };

  // Moves to the next queued file after the current one is saved or skipped —
  // keeps the dialog open mid-batch, closes it once the queue is empty.
  const advanceCaptureQueue = () => {
    const [next, ...rest] = captureQueue;
    setCaptureQueue(rest);
    if (next) {
      setCaptureFile(next);
      setCaptureForm({ amount: '', category: 'other' });
    } else {
      setCaptureFile(null);
      setCaptureOpen(false);
      setCaptureBatchTotal(0);
    }
  };

  const downloadZip = async () => {
    setZipping(true);
    const qs  = payerFilter !== 'all' ? `?payer=${payerFilter}` : '';
    const res = await fetch(`/api/trips/${tripId}/expenses/export${qs}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `receipts${payerFilter !== 'all' ? '-' + payerFilter : ''}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setZipping(false);
  };

  // Every uploaded document across every expense, in one place — the structured
  // proof checklist entries plus each expense's single quick-capture receipt.
  const allProofs = expenses.filter(e => !e._pending).flatMap((e: any) => {
    const slots = getProofSlots(e.category);
    const structured = (e.proofs ?? []).map((p: any) => ({
      ...p,
      slotLabel: slots.find(s => s.key === p.key)?.label ?? p.key,
      expenseId: e._id,
      expenseLabel: `${(e.currency ?? 'EUR') === 'EUR' ? '€' : e.currency + ' '}${Number(e.amount ?? 0).toFixed(2)} · ${CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}`,
    }));
    const receipt = e.receiptGcsUrl ? [{
      key: 'receipt', gcsPath: e.receiptGcsPath, gcsUrl: e.receiptGcsUrl,
      originalName: null, uploadedAt: e.createdAt, slotLabel: 'Receipt',
      expenseId: e._id,
      expenseLabel: `${(e.currency ?? 'EUR') === 'EUR' ? '€' : e.currency + ' '}${Number(e.amount ?? 0).toFixed(2)} · ${CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}`,
    }] : [];
    return [...structured, ...receipt];
  }).sort((a, b) => new Date(b.uploadedAt ?? 0).getTime() - new Date(a.uploadedAt ?? 0).getTime());

  const deleteDocument = async (expenseId: string, gcsPath: string) => {
    const fd = new FormData();
    fd.append('removedProofPaths', JSON.stringify([gcsPath]));
    try {
      const res  = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, { method: 'PUT', body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExpenses(prev => prev.map(e => e._id === expenseId ? data.expense : e));
      setSnackbarMsg('Document removed');
    } catch {
      setSnackbarMsg('Remove failed — check your connection and try again');
    }
  };

  const filtered = payerFilter === 'all' ? expenses : expenses.filter(e => e.payer === payerFilter);
  const payerTotals = PAYERS
    .map(p => ({
      ...p, label: getPayerLabel(p.value, trip),
      total: expenses.filter(e => e.payer === p.value).reduce((s, e) => s + (e.amount ?? 0), 0),
      count: expenses.filter(e => e.payer === p.value).length,
    }))
    .filter(p => p.count > 0);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box>;
  }

  return (
    <Box
      onDragEnter={handleDragEnter} onDragOver={handleDragOver}
      onDragLeave={handleDragLeave} onDrop={handleDrop}
      sx={{ position: 'relative', minHeight: 200 }}
    >
      {dragActive && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 1400,
          bgcolor: 'rgba(29,38,66,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <CameraAltIcon sx={{ fontSize: '3rem', color: '#fff', mb: 1 }} />
            <Typography sx={{ fontFamily: D.display, fontSize: '1.5rem', color: '#fff' }}>
              Drop to add expense
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip
          label="Expenses" onClick={() => setView('expenses')}
          variant={view === 'expenses' ? 'filled' : 'outlined'}
          sx={{ fontFamily: D.body, fontWeight: 700, ...(view === 'expenses' && { bgcolor: D.navy, color: '#fff' }) }}
        />
        <Chip
          label={`Documents${allProofs.length > 0 ? ` · ${allProofs.length}` : ''}`} onClick={() => setView('documents')}
          variant={view === 'documents' ? 'filled' : 'outlined'}
          sx={{ fontFamily: D.body, fontWeight: 700, ...(view === 'documents' && { bgcolor: D.navy, color: '#fff' }) }}
        />
      </Box>

      {view === 'expenses' && payerTotals.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
          <Chip
            label="All" onClick={() => setPayerFilter('all')}
            variant={payerFilter === 'all' ? 'filled' : 'outlined'}
            sx={{ fontFamily: D.body, fontWeight: 700, ...(payerFilter === 'all' && { bgcolor: D.navy, color: '#fff' }) }}
          />
          {payerTotals.map(p => (
            <Chip
              key={p.value}
              label={`${p.label} · ${p.count} · €${p.total.toFixed(2)}`}
              onClick={() => setPayerFilter(p.value)}
              variant={payerFilter === p.value ? 'filled' : 'outlined'}
              sx={{ fontFamily: D.body, fontWeight: 700, ...(payerFilter === p.value && { bgcolor: D.navy, color: '#fff' }) }}
            />
          ))}
        </Box>
      )}

      {view === 'expenses' && (filtered.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2, fontFamily: D.body }}>No expenses captured yet.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {filtered.map(e => (
            <Paper key={e._id} elevation={0} sx={{ p: 2, border: '1.5px solid', borderColor: D.rule, borderRadius: '10px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ fontFamily: D.display, fontSize: '1.3rem', color: D.navy }}>
                      {(e.currency ?? 'EUR') === 'EUR' ? '€' : e.currency + ' '}{Number(e.amount ?? 0).toFixed(2)}
                    </Typography>
                    <Typography sx={{ fontFamily: D.body, fontSize: '0.78rem', color: D.muted }}>
                      {CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted, mt: 0.25 }}>
                    {e.date ? new Date(e.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : ''}
                    {e.notes ? ` · ${e.notes}` : ''}
                    {e._pending ? ' · queued offline' : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={getPayerLabel(e.payer, trip)} sx={{ fontFamily: D.body, fontSize: '0.7rem' }} />
                    <Chip
                      size="small" label={e.status}
                      onClick={() => !e._pending && advanceStatus(e)}
                      sx={{
                        fontFamily: D.body, fontSize: '0.7rem', textTransform: 'capitalize',
                        bgcolor: `${STATUS_COLOUR[e.status]}18`, color: STATUS_COLOUR[e.status],
                        cursor: e._pending ? 'default' : 'pointer',
                      }}
                      icon={e.status !== 'paid' && !e._pending ? <ArrowForwardIcon sx={{ fontSize: '0.75rem !important' }} /> : undefined}
                    />
                  </Box>
                  {/* Every proof slot shown, attached or not — a received document has to be
                      visible here, not just inferred from the absence of a warning. */}
                  {!e._pending && getProofSlots(e.category).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                      {getProofSlots(e.category).map(slot => {
                        const matches = (e.proofs ?? []).filter((p: any) => p.key === slot.key);
                        const attached = matches.length > 0;
                        // Attached → open the actual file (verify it's the right one). Missing →
                        // open the edit dialog (there's nothing to view, only something to add).
                        return (
                          <Chip
                            key={slot.key} size="small"
                            onClick={() => attached ? window.open(matches[0].gcsUrl, '_blank') : openEdit(e)}
                            icon={attached
                              ? <CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />
                              : <RadioButtonUncheckedIcon sx={{ fontSize: '0.8rem !important' }} />}
                            label={matches.length > 1 ? `${slot.label} (${matches.length})` : slot.label}
                            sx={{
                              fontFamily: D.body, fontSize: '0.68rem', cursor: 'pointer',
                              bgcolor: attached ? 'rgba(34,197,94,0.12)' : 'rgba(29,38,66,0.05)',
                              color: attached ? '#16a34a' : D.muted,
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Box>
                {!e._pending && (
                  <Box sx={{ display: 'flex', flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => openEdit(e)}><EditIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                    <IconButton size="small" onClick={() => deleteExpense(e._id)}><DeleteIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                  </Box>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      ))}

      {view === 'documents' && (
        allProofs.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2, fontFamily: D.body }}>No documents uploaded yet.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            {allProofs.map((doc, i) => (
              <Paper key={`${doc.gcsPath}-${i}`} elevation={0}
                sx={{ p: 1.5, border: '1.5px solid', borderColor: D.rule, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ReceiptIcon sx={{ fontSize: '1.2rem', color: D.muted, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.88rem', fontWeight: 600, color: D.navy }}>
                    {doc.slotLabel}
                  </Typography>
                  <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.expenseLabel}{doc.originalName ? ` · ${doc.originalName}` : ''}
                    {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}` : ''}
                  </Typography>
                </Box>
                <Button size="small" onClick={() => window.open(doc.gcsUrl, '_blank')} sx={{ fontFamily: D.body, fontSize: '0.72rem', flexShrink: 0 }}>
                  View
                </Button>
                <IconButton size="small" onClick={() => deleteDocument(doc.expenseId, doc.gcsPath)} sx={{ flexShrink: 0 }}>
                  <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Paper>
            ))}
          </Box>
        )
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd} sx={{ fontFamily: D.body }}>
          Add expense
        </Button>
        <Button variant="outlined" startIcon={<CameraAltIcon />}
          onClick={() => { setCaptureFile(null); setCaptureQueue([]); setCaptureBatchTotal(0); setCaptureOpen(true); }}
          sx={{ fontFamily: D.body }}>
          Quick capture
        </Button>
        {expenses.some(e => e.receiptGcsUrl) && (
          <Button
            variant="outlined" startIcon={<DownloadIcon />} onClick={downloadZip} disabled={zipping}
            sx={{ fontFamily: D.body }}
          >
            {zipping ? 'Preparing…' : `Download receipts${payerFilter !== 'all' ? ` (${getPayerLabel(payerFilter, trip)})` : ''}`}
          </Button>
        )}
      </Box>

      {/* ── Full add/edit dialog ── */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={mobile}>
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={form.category} label="Category" onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {categoryMenuItems()}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="Amount" type="number" fullWidth value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              <TextField label="Currency" fullWidth value={form.currency}
                onChange={e => setForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} sx={{ maxWidth: 110 }} />
            </Box>
            <TextField label="Gratuity (optional)" type="number" fullWidth value={form.gratuity}
              onChange={e => setForm(p => ({ ...p, gratuity: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Payer</InputLabel>
              <Select value={form.payer} label="Payer" onChange={e => setForm(p => ({ ...p, payer: e.target.value }))}>
                {PAYERS.map(p => <MenuItem key={p.value} value={p.value}>{getPayerLabel(p.value, trip)}</MenuItem>)}
              </Select>
              {payerNameMissing(form.payer, trip) && (
                <Typography sx={{ fontFamily: D.body, fontSize: '0.72rem', color: D.muted, mt: 0.5 }}>
                  Add the {form.payer === 'third_party' ? 'third party\'s' : `${form.payer}'s`} actual name via Edit Trip — it'll show up here instead.
                </Typography>
              )}
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Notes" fullWidth multiline rows={2} value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />

            {form.category === 'car' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted }}>
                  How are you claiming this?
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Method</InputLabel>
                  <Select value={form.reimbursementMethod} label="Method"
                    onChange={e => setForm(p => ({ ...p, reimbursementMethod: e.target.value }))}>
                    <MenuItem value="mileage">Mileage</MenuItem>
                    <MenuItem value="fuel">Fuel receipts</MenuItem>
                  </Select>
                </FormControl>
                {form.reimbursementMethod === 'mileage' && (
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField label="Distance" type="number" fullWidth value={form.mileageDistance}
                      onChange={e => setForm(p => ({ ...p, mileageDistance: e.target.value }))} />
                    <FormControl sx={{ minWidth: 90 }}>
                      <InputLabel>Unit</InputLabel>
                      <Select value={form.mileageUnit} label="Unit"
                        onChange={e => setForm(p => ({ ...p, mileageUnit: e.target.value }))}>
                        <MenuItem value="km">km</MenuItem>
                        <MenuItem value="mi">mi</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField label="Rate" type="number" fullWidth value={form.mileageRate}
                      onChange={e => setForm(p => ({ ...p, mileageRate: e.target.value }))} />
                  </Box>
                )}
                {form.reimbursementMethod === 'fuel' && renderProofSlot(FUEL_RECEIPT_SLOT)}
              </Box>
            ) : getProofSlots(form.category).length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography sx={{ fontFamily: D.body, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.muted }}>
                  Proof needed
                </Typography>
                {getProofSlots(form.category).map(slot => renderProofSlot(slot))}
              </Box>
            )}

            <Button component="label" variant="outlined" startIcon={<ReceiptIcon />} sx={{ fontFamily: D.body }}>
              {receiptFile ? receiptFile.name : 'Attach / replace receipt'}
              <input type="file" hidden accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ fontFamily: D.body }}>Cancel</Button>
          <Button variant="contained" onClick={saveExpense} disabled={saving || !form.amount}
            startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
            sx={{ fontFamily: D.display, bgcolor: D.navy, boxShadow: 'none', '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' } }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Quick capture dialog — camera-first, minimal friction ── */}
      <Dialog open={captureOpen} onClose={() => !saving && advanceCaptureQueue()} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: D.display, fontSize: '1.15rem' }}>
          Capture Expense
          {captureBatchTotal > 1 && (
            <Typography component="span" sx={{ fontFamily: D.body, fontSize: '0.85rem', color: D.muted, ml: 1 }}>
              {captureBatchTotal - captureQueue.length} of {captureBatchTotal}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Button
              component="label" variant={captureFile ? 'outlined' : 'contained'}
              startIcon={<CameraAltIcon />}
              sx={{
                fontFamily: D.display, py: 1.5,
                ...(!captureFile && { bgcolor: D.navy, boxShadow: 'none', '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' } }),
              }}
            >
              {captureFile ? captureFile.name : 'Take photo / attach file'}
              {/* capture="environment" biases mobile toward the camera (correct default —
                  most captures are a live photo of a receipt) but is a no-op on desktop,
                  where accept including application/pdf is what actually matters — someone
                  at their desk with an invoice PDF already saved needs to be able to just
                  throw it in here too, not be forced into the full Add Expense form. */}
              <input type="file" hidden accept="image/*,application/pdf" capture="environment"
                onChange={e => setCaptureFile(e.target.files?.[0] ?? null)} />
            </Button>
            <TextField label="Amount" type="number" fullWidth autoFocus value={captureForm.amount}
              onChange={e => setCaptureForm(p => ({ ...p, amount: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={captureForm.category} label="Category" onChange={e => setCaptureForm(p => ({ ...p, category: e.target.value }))}>
                {categoryMenuItems()}
              </Select>
            </FormControl>
            <Typography sx={{ fontFamily: D.body, fontSize: '0.75rem', color: D.muted }}>
              Who's paying and everything else can be filled in later — this just captures it before you lose the receipt.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => advanceCaptureQueue()} disabled={saving} sx={{ fontFamily: D.body }}>
            {captureQueue.length > 0 ? 'Skip' : 'Cancel'}
          </Button>
          <Button variant="contained" onClick={saveCapture} disabled={saving || !captureForm.amount}
            startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
            sx={{ fontFamily: D.display, bgcolor: D.navy, boxShadow: 'none', '&:hover': { bgcolor: '#1a2235', boxShadow: 'none' } }}>
            {saving ? 'Uploading…' : 'Capture'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbarMsg} autoHideDuration={4000} onClose={() => setSnackbarMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarMsg('')} severity={snackbarMsg.includes('failed') ? 'error' : 'success'}
          sx={{ fontFamily: D.body }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
