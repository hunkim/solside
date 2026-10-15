// Validates syntax + agent module loads and reports missing key properly.
const { runAgent } = require('./agent');
delete process.env.AI_API_KEY;
runAgent({ history: [], userText: 'x', host: {} }).then(() => { console.error('FAIL'); process.exit(1); }, (e) => {
  if (!/AI_API_KEY/.test(e.message)) { console.error('FAIL', e.message); process.exit(1); }
  console.log('smoke ok: missing-key message works'); });
