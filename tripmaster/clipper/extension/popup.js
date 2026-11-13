// shared.js loads first (popup.html) — api, getSettings, call and the rest come from it.

const $ = id => document.getElementById(id);

function show(view) {
  for (const v of ['setup', 'clip', 'result']) $(v).hidden = v !== view;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

// ── Connect ─────────────────────────────────────────────────────────────────

function showSetup(message = '') {
  show('setup');
  showError($('setup-error'), message);
  $('connect').onclick = async () => {
    const s = parseCode($('code').value);
    if (!s) return showError($('setup-error'), 'That isn’t the code from Tabiji → Profile → Clip from the web.');
    $('connect').disabled = true;
    try {
      await call(s, '/api/clip/trips');   // checks the key works
      await saveSettings(s);
      await showClip(s);
    } catch (err) {
      showError($('setup-error'), err.message);
    } finally {
      $('connect').disabled = false;
    }
  };
}

// ── Clip ────────────────────────────────────────────────────────────────────

async function selectedText(tabId) {
  try {
    const [r] = await api.scripting.executeScript({
      target: { tabId },
      func: () => String(window.getSelection?.() ?? ''),
    });
    return String(r?.result ?? '').trim();
  } catch {
    return '';   // a page scripts can't run on (Safari's own pages, the App Store)
  }
}

function fill(select, options) {
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    select.append(opt);
  }
}

async function showLast() {
  const { last } = await api.storage.local.get('last');
  if (!last || Date.now() - last.at > 10 * 60 * 1000) return;
  const n = last.result?.saved?.length ?? 0;
  const what = last.error ?? (last.result?.status === 'failed' ? last.result.error : n ? `${n} saved` : 'nothing saved');
  $('last').textContent = `Last clip — “${last.title}”: ${what}`;
  $('last').hidden = false;
}

async function showClip(s) {
  show('clip');
  showError($('clip-error'), '');
  showLast();

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  $('page-title').textContent = tab?.title || tab?.url || 'This page';
  $('page-host').textContent = hostOf(tab?.url ?? '');
  if (tab?.id != null) $('selection').value = await selectedText(tab.id);

  try {
    const d = await call(s, '/api/clip/trips');
    if ($('trip').options.length === 1) {
      fill($('trip'), d.trips.map(t => ({ value: t.id, label: t.city && !t.name.includes(t.city) ? `${t.name} · ${t.city}` : t.name })));
      fill($('category'), d.categories.map(c => ({ value: c.id, label: c.label })));
    }
  } catch (err) {
    if (err.status === 401) return showSetup(err.message);
    showError($('clip-error'), err.message);
  }

  $('send').onclick = () => send(s, tab);
  $('disconnect').onclick = async () => { await clearSettings(); showSetup(); };
}

// A screen capture at full Retina size is far more than needed to read it.
async function shrink(dataUrl, maxWidth = 1600) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  if (scale === 1) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function send(s, tab) {
  $('send').disabled = true;
  showError($('clip-error'), '');
  try {
    let screenshot = null;
    if ($('shot').checked) {
      try {
        screenshot = await shrink(await api.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 }));
      } catch {
        throw new Error('Couldn’t take a screenshot of this page — untick it and try again.');
      }
    }
    const { id } = await call(s, '/api/clip', {
      method: 'POST',
      body: JSON.stringify({
        url: tab?.url ?? '',
        title: tab?.title ?? '',
        selection: $('selection').value.trim(),
        note: $('note').value.trim(),
        tripId: $('trip').value,
        category: $('category').value,
        screenshot,
      }),
    });
    await showResult(s, id);
  } catch (err) {
    showError($('clip-error'), err.message);
  } finally {
    $('send').disabled = false;
  }
}

// ── After sending ───────────────────────────────────────────────────────────

async function showResult(s, id) {
  show('result');
  const status = $('result-status');
  const list = $('result-list');
  list.replaceChildren();
  status.textContent = 'Reading it… you can close this — it carries on.';
  $('again').onclick = () => showClip(s);

  let r;
  try {
    r = await waitForClip(s, id);
  } catch (err) {
    status.textContent = err.message;
    return;
  }
  if (r.status === 'failed') {
    status.textContent = `Couldn’t save it: ${r.error ?? 'something went wrong'}`;
    return;
  }
  if (r.status === 'processing') {
    status.textContent = 'Still working on it — it’ll appear in Discover.';
    return;
  }
  if (!r.saved?.length) {
    status.textContent = r.summary || 'Nothing to save on that page.';
    return;
  }
  status.textContent = `Saved to Discover${r.saved.length > 1 ? ` (${r.saved.length})` : ''}:`;
  for (const item of r.saved) {
    const li = document.createElement('li');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = [item.category, item.where, item.kind === 'place' && !item.pinned ? 'no map pin' : ''].filter(Boolean).join(' · ');
    li.append(name, meta);
    list.append(li);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────

getSettings().then(settings => (settings ? showClip(settings) : showSetup()));
