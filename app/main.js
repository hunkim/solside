const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { runAgent, cfg } = require('./agent');

let win, tabs = [], activeId = null, nextId = 1;
let layout = { sidebar: 220, panel: 360 };
const TOOLBAR_H = 84;
const PARTITION = 'persist:solside';

const store = (name, def) => {
  const f = path.join(app.getPath('userData'), name);
  return {
    read() { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } },
    write(v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); },
  };
};
let bmStore, taskStore;

const toUrl = (s) => {
  s = (s || '').trim();
  if (!s) return 'about:blank';
  if (/^(https?|file|about):/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) || /^localhost(:\d+)?/.test(s)) return 'https://' + s;
  return 'https://www.google.com/search?q=' + encodeURIComponent(s);
};

const active = () => tabs.find(t => t.id === activeId);
function sendTabs() {
  if (!win || win.isDestroyed()) return;
  const bms = bmStore.read();
  win.webContents.send('tabs', {
    activeId,
    tabs: tabs.map(t => ({ id: t.id, title: t.view.webContents.getTitle() || t.url || 'New Tab', url: t.view.webContents.getURL(), loading: t.view.webContents.isLoading() })),
    canBack: !!active() && active().view.webContents.navigationHistory.canGoBack(),
    canForward: !!active() && active().view.webContents.navigationHistory.canGoForward(),
    bookmarked: !!active() && bms.some(b => b.url === active().view.webContents.getURL()),
  });
}
function layoutViews() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const x = layout.sidebar, width = Math.max(100, w - layout.sidebar - layout.panel);
  for (const t of tabs) t.view.setBounds(t.id === activeId ? { x, y: TOOLBAR_H, width, height: h - TOOLBAR_H } : { x: 0, y: 0, width: 0, height: 0 });
}
function newTab(url) {
  const view = new WebContentsView({ webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true } });
  const tab = { id: nextId++, view, url: '' };
  tabs.push(tab);
  win.contentView.addChildView(view);
  const wc = view.webContents;
  ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-start-loading', 'did-stop-loading']
    .forEach(e => wc.on(e, () => { tab.url = wc.getURL(); sendTabs(); }));
  wc.setWindowOpenHandler(({ url }) => { newTab(url); return { action: 'deny' }; });
  activeId = tab.id;
  wc.loadURL(toUrl(url || 'https://www.google.com')).catch(() => {});
  layoutViews(); sendTabs();
  return tab.id;
}
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  win.contentView.removeChildView(t.view); t.view.webContents.close();
  if (!tabs.length) return newTab('about:blank');
  if (activeId === id) activeId = tabs[Math.min(i, tabs.length - 1)].id;
  layoutViews(); sendTabs();
}

// ---- page tools for the agent ----
const EXTRACT = `(() => {
  const sel = 'a[href],button,input,textarea,select,[role=button],[role=link],[onclick]';
  window.__solsideEls = [];
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') return;
    if (window.__solsideEls.length >= 80) return;
    const id = window.__solsideEls.push(el) - 1;
    const label = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.title || '').trim().replace(/\\s+/g,' ').slice(0,80);
    out.push('[' + id + '] <' + el.tagName.toLowerCase() + (el.type ? ' type=' + el.type : '') + '> ' + label + (el.href ? ' -> ' + el.href.slice(0,100) : ''));
  });
  return 'URL: ' + location.href + '\\nTITLE: ' + document.title + '\\n\\nTEXT:\\n' + (document.body ? document.body.innerText : '').slice(0, 8000) + '\\n\\nINTERACTIVE ELEMENTS:\\n' + out.join('\\n');
})()`;
const wcx = () => { const t = active(); if (!t) throw new Error('no active tab'); return t.view.webContents; };
const host = {
  getPageText: () => wcx().executeJavaScript(EXTRACT),
  click: (id) => wcx().executeJavaScript(`(() => { const e = window.__solsideEls && window.__solsideEls[${+id}]; if (!e) return 'no such element; call get_page_text again'; e.scrollIntoView({block:'center'}); e.click(); return 'clicked'; })()`),
  type: async (id, text, submit) => {
    const r = await wcx().executeJavaScript(`(() => { const e = window.__solsideEls && window.__solsideEls[${+id}]; if (!e) return 'no such element'; e.focus(); const p = e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p,'value'); if (s && s.set) s.set.call(e, ${JSON.stringify(text)}); else e.value = ${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return 'typed'; })()`);
    if (submit && r === 'typed') { const w = wcx(); for (const type of ['keyDown', 'keyUp']) w.sendInputEvent({ type, keyCode: 'Enter' }); return 'typed and submitted'; }
    return r;
  },
  scroll: (d) => wcx().executeJavaScript(`window.scrollBy(0, ${d === 'up' ? -1 : 1} * innerHeight * 0.8), 'scrolled'`),
  navigate: async (url) => { await wcx().loadURL(toUrl(url)).catch(() => {}); return 'navigated to ' + wcx().getURL(); },
};

function sendTasks() { win.webContents.send('tasks', taskStore.read().slice(0, 30)); }

function registerIpc() {
  ipcMain.handle('tab:new', (_, u) => newTab(u));
  ipcMain.handle('tab:close', (_, id) => closeTab(id));
  ipcMain.handle('tab:switch', (_, id) => { activeId = id; layoutViews(); sendTabs(); });
  ipcMain.handle('nav:go', (_, s) => { wcx().loadURL(toUrl(s)).catch(() => {}); });
  ipcMain.handle('nav:back', () => { const h = wcx().navigationHistory; if (h.canGoBack()) h.goBack(); });
  ipcMain.handle('nav:forward', () => { const h = wcx().navigationHistory; if (h.canGoForward()) h.goForward(); });
  ipcMain.handle('nav:reload', () => wcx().reload());
  ipcMain.handle('bm:list', () => bmStore.read());
  ipcMain.handle('bm:toggle', () => {
    const w = wcx(), url = w.getURL(); let b = bmStore.read();
    b = b.some(x => x.url === url) ? b.filter(x => x.url !== url) : [{ url, title: w.getTitle() || url, at: Date.now() }, ...b];
    bmStore.write(b); win.webContents.send('bookmarks', b); sendTabs(); return b;
  });
  ipcMain.handle('bm:remove', (_, url) => { const b = bmStore.read().filter(x => x.url !== url); bmStore.write(b); win.webContents.send('bookmarks', b); sendTabs(); });
  ipcMain.handle('task:list', () => taskStore.read().slice(0, 30));
  ipcMain.handle('ai:config', () => ({ hasKey: !!cfg().key, model: cfg().model, base: cfg().base }));
  ipcMain.handle('layout:set', (_, l) => { layout = { ...layout, ...l }; layoutViews(); });
  const history = [];
  ipcMain.handle('ai:ask', async (_, text, mode) => {
    const steps = [];
    const prompt = mode === 'summarize' ? '현재 페이지를 요약해줘. (get_page_text를 사용해 읽고 핵심만 불릿으로)' : text;
    try {
      const r = await runAgent({ history: history.slice(-10), userText: prompt, host, onStep: s => { steps.push(s); win.webContents.send('ai:step', s); } });
      history.push({ role: 'user', content: prompt }, { role: 'assistant', content: r.answer });
      const tasks = [{ id: Date.now(), prompt, answer: r.answer, steps: r.steps.length, url: wcx().getURL(), at: Date.now() }, ...taskStore.read()].slice(0, 100);
      taskStore.write(tasks); sendTasks();
      return { ok: true, answer: r.answer };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}

app.whenReady().then(() => {
  bmStore = store('bookmarks.json', []); taskStore = store('tasks.json', []);
  win = new BrowserWindow({ width: 1400, height: 900, title: 'Solside', backgroundColor: '#0f1115',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  registerIpc();
  win.on('resize', layoutViews);
  win.webContents.once('did-finish-load', () => {
    newTab(process.env.ASIDE_START_URL || 'https://www.google.com');
    sendTasks(); win.webContents.send('bookmarks', bmStore.read());
    if (process.env.ASIDE_SHOT) setTimeout(async () => {
      const img = await win.capturePage(); fs.writeFileSync(process.env.ASIDE_SHOT, img.toPNG()); app.quit();
    }, 4000);
  });
  if (process.env.ASIDE_SESSION) session.fromPartition(PARTITION);
});
app.on('window-all-closed', () => app.quit());
