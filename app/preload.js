const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  tabNew: (url) => inv('tab:new', url),
  tabClose: (id) => inv('tab:close', id),
  tabSwitch: (id) => inv('tab:switch', id),
  navigate: (input) => inv('nav:go', input),
  back: () => inv('nav:back'), forward: () => inv('nav:forward'), reload: () => inv('nav:reload'),
  bookmarks: () => inv('bm:list'), bookmarkToggle: () => inv('bm:toggle'), bookmarkRemove: (u) => inv('bm:remove', u),
  tasks: () => inv('task:list'),
  aiConfig: () => inv('ai:config'),
  aiAsk: (text, mode) => inv('ai:ask', text, mode),
  setLayout: (l) => inv('layout:set', l),
  onTabs: (cb) => ipcRenderer.on('tabs', (_, d) => cb(d)),
  onBookmarks: (cb) => ipcRenderer.on('bookmarks', (_, d) => cb(d)),
  onStep: (cb) => ipcRenderer.on('ai:step', (_, d) => cb(d)),
  onTasks: (cb) => ipcRenderer.on('tasks', (_, d) => cb(d)),
});
