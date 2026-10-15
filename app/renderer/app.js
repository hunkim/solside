const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let busy = false;

api.onTabs((d) => {
  $('#tabbar').innerHTML = d.tabs.map(t => `<div class="tab ${t.id === d.activeId ? 'active' : ''}" data-id="${t.id}"><span>${t.loading ? '… ' : ''}${esc(t.title)}</span><b data-close="${t.id}">✕</b></div>`).join('');
  const a = d.tabs.find(t => t.id === d.activeId);
  if (a && document.activeElement !== $('#addr')) $('#addr').value = a.url === 'about:blank' ? '' : a.url;
  $('#back').disabled = !d.canBack; $('#fwd').disabled = !d.canForward;
  $('#star').textContent = d.bookmarked ? '★' : '☆';
});
$('#tabbar').onclick = (e) => {
  const c = e.target.closest('[data-close]'); if (c) return api.tabClose(+c.dataset.close);
  const t = e.target.closest('.tab'); if (t) api.tabSwitch(+t.dataset.id);
};
api.onBookmarks(renderBms); api.bookmarks().then(renderBms);
function renderBms(b) {
  $('#bms').innerHTML = b.length ? b.map(x => `<div class="item" data-url="${esc(x.url)}"><span title="${esc(x.url)}">${esc(x.title)}</span><b data-rm="${esc(x.url)}">✕</b></div>`).join('') : '<div class="empty">없음 (☆로 추가)</div>';
}
$('#bms').onclick = (e) => { const r = e.target.closest('[data-rm]'); if (r) return api.bookmarkRemove(r.dataset.rm); const i = e.target.closest('.item'); if (i) api.navigate(i.dataset.url); };
api.onTasks(renderTasks); api.tasks().then(renderTasks);
function renderTasks(t) {
  $('#tasks').innerHTML = t.length ? t.map(x => `<div class="item" title="${esc(x.answer.slice(0, 300))}" data-prompt="${esc(x.prompt)}"><span>${esc(x.prompt)}</span></div>`).join('') : '<div class="empty">아직 없음</div>';
}
$('#tasks').onclick = (e) => { const i = e.target.closest('.item'); if (i) $('#q').value = i.dataset.prompt; };

$('#newtab').onclick = () => api.tabNew('https://www.google.com');
$('#back').onclick = api.back; $('#fwd').onclick = api.forward; $('#reload').onclick = api.reload;
$('#star').onclick = api.bookmarkToggle;
$('#addr').addEventListener('keydown', e => { if (e.key === 'Enter') { api.navigate(e.target.value); e.target.blur(); } });
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 't') api.tabNew(); if ((e.ctrlKey || e.metaKey) && e.key === 'l') { $('#addr').focus(); $('#addr').select(); } });

function applyCfg(c) {
  $('#model').textContent = c.model;
  const n = $('#notice');
  n.hidden = c.hasKey;
  if (!c.hasKey) n.textContent = 'API 키가 없습니다. ⚙ 설정에서 UPSTAGE_API_KEY를 입력하세요.';
  if (c.hasKey) $('#settings').hidden = true;
}
api.aiConfig().then(c => { applyCfg(c); if (!c.hasKey) $('#settings').hidden = false; $('#modelin').placeholder = c.model; });
$('#gear').onclick = () => { $('#settings').hidden = !$('#settings').hidden; };
$('#savecfg').onclick = async () => { const r = await api.aiSave({ key: $('#keyin').value, model: $('#modelin').value }); $('#keyin').value = ''; applyCfg(r); add('step', '설정을 저장했습니다.'); };
$('#clearkey').onclick = async () => { applyCfg(await api.aiSave({ key: '' })); };
function add(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; $('#chat').appendChild(d); $('#chat').scrollTop = 1e9; }
api.onStep(s => add('step', `› ${s.tool}(${JSON.stringify(s.args)}) → ${s.result.slice(0, 80).replace(/\n/g, ' ')}`));
async function ask(text, mode) {
  if (busy) return; busy = true; add('user', mode === 'summarize' ? '이 페이지 요약' : text);
  const r = await api.aiAsk(text, mode); busy = false;
  r.ok ? add('ai', r.answer) : add('err', r.error);
}
$('#form').onsubmit = (e) => { e.preventDefault(); const t = $('#q').value.trim(); if (t) { $('#q').value = ''; ask(t); } };
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#form').requestSubmit(); } });
$('#sum').onclick = () => ask('', 'summarize');
