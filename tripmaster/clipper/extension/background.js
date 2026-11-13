// Right-click → Clip to Tabiji. Sends straight away with the trip and category
// worked out by Tabiji; the toolbar icon shows how it went (a count, or ! on a
// problem), and the pop-up shows the details next time it's opened.

// shared.js loads first (manifest) — api, getSettings, call, waitForClip come from it.

const MENUS = [
  { id: 'clip-selection', title: 'Clip to Tabiji', contexts: ['selection'] },
  { id: 'clip-page', title: 'Clip this page to Tabiji', contexts: ['page'] },
];

// Made afresh each time the background starts, so they're there after an update or restart.
// iPhone Safari has no right-click menu — there it's the pop-up only.
async function setUpMenus() {
  try { await api.contextMenus.removeAll(); } catch { /* none yet */ }
  for (const m of MENUS) api.contextMenus.create(m);
}
if (api.contextMenus) setUpMenus();

function badge(text) {
  api.action.setBadgeText({ text });
  api.action.setBadgeBackgroundColor?.({ color: text === '!' ? '#C4714A' : '#55702C' });
  if (text !== '…') setTimeout(() => api.action.setBadgeText({ text: '' }), 20000);
}

async function remember(last) {
  await api.storage.local.set({ last: { ...last, at: Date.now() } });
}

api.contextMenus?.onClicked.addListener(async (info, tab) => {
  const s = await getSettings();
  const title = tab?.title || tab?.url || 'this page';
  if (!s) {
    await remember({ title, error: 'Not connected yet — open the clipper to connect it.' });
    badge('!');
    return;
  }
  badge('…');
  try {
    const { id } = await call(s, '/api/clip', {
      method: 'POST',
      body: JSON.stringify({
        url: tab?.url ?? '',
        title: tab?.title ?? '',
        selection: info.menuItemId === 'clip-selection' ? (info.selectionText ?? '') : '',
      }),
    });
    const result = await waitForClip(s, id);
    await remember({ title, result });
    badge(result.status === 'failed' ? '!' : String(result.saved?.length ?? 0));
  } catch (err) {
    await remember({ title, error: err.message });
    badge('!');
  }
});
