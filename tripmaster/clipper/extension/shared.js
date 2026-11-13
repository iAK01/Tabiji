// Talking to Tabiji. A plain script (Safari doesn't load extension modules): what it
// declares is used by background.js and popup.js, which load after it.
// The connection code from Tabiji → Profile → Clip from the web
// is the app's address with the key after a #: https://app.example#tbj_…

const api = globalThis.browser ?? globalThis.chrome;

async function getSettings() {
  const { server, key } = await api.storage.local.get(['server', 'key']);
  return server && key ? { server, key } : null;
}

async function saveSettings(s) {
  await api.storage.local.set(s);
}

async function clearSettings() {
  await api.storage.local.remove(['server', 'key']);
}

function parseCode(code) {
  try {
    const u = new URL(String(code).trim());
    const key = decodeURIComponent(u.hash.slice(1));
    if (!/^https?:$/.test(u.protocol) || !/^tbj_[A-Za-z0-9_-]{20,}$/.test(key)) return null;
    return { server: u.origin, key };
  } catch {
    return null;
  }
}

class TabijiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function call(s, path, options = {}) {
  let res;
  try {
    res = await fetch(s.server + path, {
      ...options,
      headers: { Authorization: `Bearer ${s.key}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new TabijiError('Couldn’t reach Tabiji — check your connection.', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new TabijiError(body?.error || `Tabiji answered ${res.status}.`, res.status);
  return body;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Polls a sent clip until it's saved or failed (up to about two minutes). */
async function waitForClip(s, id, onTick) {
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const r = await call(s, `/api/clip/${id}`);
    if (r.status !== 'processing') return r;
    onTick?.(i);
  }
  return { status: 'processing', saved: [] };
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
