// Tests the assistant (supabase/functions/assistant/core.js) against the real database rules (PGlite)
// with a scripted stand-in for OpenAI. No network, no API key. Usage: npm run test:assistant
import { makeDb, makeAs, seedPeople, IDS } from './db.test.mjs';
import { handle, PERSONA, TOOLS } from '../supabase/functions/assistant/core.js';

const db = await makeDb(); await seedPeople(db);
const as = makeAs(db); const { A, B } = IDS;
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };

// ---- a Supabase-like client that runs as one signed-in resident
const procMeta = {};
async function meta(name) {
  if (!procMeta[name]) procMeta[name] = (await db.query(`select proretset, prorettype::regtype::text rt from pg_proc where proname=$1 and pronamespace='public'::regnamespace limit 1`, [name])).rows[0];
  return procMeta[name];
}
const plain = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'bigint' ? Number(v) : v));
const sbFor = uid => ({ async rpc(name, args = {}) {
  const keys = Object.keys(args);
  const params = keys.map(k => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
  const r = await as(uid, `select * from public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, params);
  if (!r.ok) return { data: null, error: { message: r.err } };
  const m = await meta(name), rows = plain(r.rows);
  if (m.proretset) return { data: rows, error: null };
  const row = rows[0] || {};
  return { data: ['jsonb', 'json', 'boolean', 'uuid', 'integer', 'bigint', 'text', 'void'].includes(m.rt) ? row[name] ?? null : row, error: null };
} });

// ---- scripted "model"
const call = (name, args, n = 0) => ({ choices: [{ message: { content: null, tool_calls: [{ id: 'c' + n, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
const calls = list => ({ choices: [{ message: { content: null, tool_calls: list.map(([name, args], i) => ({ id: 'm' + i, type: 'function', function: { name, arguments: JSON.stringify(args) } })) } }] });
const say = text => ({ choices: [{ message: { content: text } }] });
const lastTool = msgs => { const m = [...msgs].reverse().find(x => x.role === 'tool'); return m ? JSON.parse(m.content) : null; };
function scripted(steps) { const log = { calls: 0, seen: [] }; const fn = async payload => { log.seen.push(payload.messages); const s = steps[log.calls++]; if (!s) throw new Error('model called more times than scripted'); return typeof s === 'function' ? await s(payload.messages, log) : s; }; fn.log = log; return fn; }
const turn = (uid, unit, message, steps, extra = {}) => { const ai = scripted(steps); return handle({ sb: sbFor(uid), body: { unit, message }, openai: ai, now: new Date(), ...extra }).then(out => ({ out, ai })); };
const pending = async uid => (await db.query(`select * from ai_proposals where user_id=$1 and status='pending'`, [uid])).rows;
let r;

// ---- 1. booking in Persian, end to end
let { out, ai } = await turn(A, '1204', 'فردا عصر اسکواش خالیه؟', [
  call('get_slots', { provider_id: 'sp-3', days: 3, after: '17:00' }),
  (m) => { const s = lastTool(m).slots[0]; return call('propose_booking', { provider_id: 'sp-3', starts_at: s.starts_at, language: 'fa' }); },
  say('خالیه. کارت پایین رو چک کن و تایید بزن.'),
]);
t('model gets the persona, the unit and a date', ai.log.seen[0][0].content.includes('آف‌بات') && ai.log.seen[0][0].content.includes('unit 1204') && /Today's date in Tehran is 20\d\d-/.test(ai.log.seen[0][0].content));
t('get_slots only returned times from 17:00 on', ai.log.seen[1].find(x => x.role === 'tool') && JSON.parse(ai.log.seen[1].find(x => x.role === 'tool').content).slots.every(s => /^(1[7-9]|2[0-3]):/.test(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(s.starts_at)))));
t('reply comes back with one proposal card', out.reply.includes('کارت') && out.proposals.length === 1 && out.proposals[0].card.title === 'رزرو اسکواش', JSON.stringify(out).slice(0, 300));
const card = out.proposals[0];
t('the card shows when, where, length and price from verified data', card.card.lines.map(l => l[0]).join() === 'زمان,مکان,مدت,مبلغ' && card.card.lines[3][1] === 'رایگان', JSON.stringify(card.card.lines));
t('nothing is booked before approval', (await db.query(`select count(*)::int n from bookings where unit_code='1204' and provider_id='sp-3'`)).rows[0].n === 0);
t('the proposal is pending in the database', (await pending(A)).length === 1);
r = await as(B, `select free from available_slots('sp-3', null, 14) where starts_at = $1`, [card.card && JSON.parse(JSON.stringify((await pending(A))[0].params)).starts_at]);
t('while pending the slot is held: another resident sees it as taken', r.ok && r.rows[0].free === 0, JSON.stringify(r.rows));
r = await sbFor(A).rpc('ai_history', { p_unit: '1204', p_limit: 10 });
t('both messages are saved, the cards with the assistant message', r.data.length === 2 && r.data[1].role === 'assistant' && r.data[1].meta.proposals[0].id === card.id);
r = await sbFor(A).rpc('approve_proposal', { p_id: card.id });
t('approving makes the booking', r.data.kind === 'booking' && (await db.query(`select source from bookings where id=$1`, [r.data.id])).rows[0].source === 'assistant', JSON.stringify(r));

// ---- 2. the slot is taken between looking and proposing
let taken;
({ out } = await turn(A, '1204', 'book squash please', [
  call('get_slots', { provider_id: 'sp-3', days: 3, after: '17:00' }),
  async (m) => { const s = lastTool(m).slots[0]; taken = s.starts_at; await as(B, `select * from book_slot('407','sp-3',$1,'account')`, [s.starts_at]); return call('propose_booking', { provider_id: 'sp-3', starts_at: s.starts_at, language: 'en' }); },
  (m) => say(lastTool(m).error.includes('taken') ? 'Someone just grabbed that one. Want the next free time?' : 'booked!'),
]));
t('if someone else got the slot, no card is made and the assistant is told why', out.proposals.length === 0 && /grabbed/.test(out.reply), JSON.stringify(out));

// ---- 3. English booking card and the 3-minute hold ends with a new proposal
({ out } = await turn(A, '1204', 'Book the pool tomorrow evening', [
  call('get_slots', { provider_id: 'sp-1', days: 2, after: '18:00' }),
  (m) => { const s = lastTool(m); return call('propose_booking', { provider_id: 'sp-1', starts_at: s.slots[0].starts_at, language: 'en' }); },
  say('Check the card and approve.'),
]));
t('English requests get an English card', out.proposals[0].card.title === 'Book استخر' && out.proposals[0].card.lines[0][0] === 'When' && out.proposals[0].card.lines[3][1] === 'Free', JSON.stringify(out.proposals[0].card));

// ---- 4. kitchen order
({ out } = await turn(A, '1204', 'می‌خوام غذا سفارش بدم، آشپزخانه', [
  call('list_menu', { venue: 'kitchen' }),
  (m) => { const it = lastTool(m).find(i => i.name === 'زرشک‌پلو با مرغ'); return call('propose_order', { venue: 'kitchen', items: [{ item_id: it.item_id, qty: 2 }], language: 'fa' }); },
  say('بزن تایید.'),
]));
t('order card lists items, total and delivery', out.proposals[0].action === 'order' && out.proposals[0].card.lines.some(l => l[0].includes('زرشک‌پلو') && l[1].includes('۱٬۳۶۰٬۰۰۰')), JSON.stringify(out.proposals[0]?.card));
await db.exec(`update units set balance=0 where code='1204'`);
r = await sbFor(A).rpc('approve_proposal', { p_id: out.proposals[0].id });
t('approving the order charges the account', r.data.kind === 'order' && Number((await db.query(`select balance from units where code='1204'`)).rows[0].balance) === -1360000, JSON.stringify(r));
({ out } = await turn(A, '1204', 'order', [calls([['list_menu', { venue: 'kitchen' }]]), (m) => { const it = lastTool(m)[0]; return call('propose_order', { venue: 'kitchen', items: [{ item_id: it.item_id, qty: 0 }], language: 'en' }); }, (m) => say(lastTool(m).error)]));
t('a zero quantity is refused with a clear reason', out.proposals.length === 0 && /quantity/.test(out.reply), out.reply);
({ out } = await turn(A, '1204', 'order', [call('propose_order', { venue: 'cafe', items: [{ item_id: '00000000-0000-0000-0000-000000000000', qty: 1 }], language: 'en' }), (m) => say(lastTool(m).error)]));
t('an invented item id is refused', out.proposals.length === 0 && /does not exist/.test(out.reply), out.reply);

// ---- 5. repair request
({ out } = await turn(B, '407', 'آب از سقف حمام چکه می‌کنه', [
  call('propose_request', { kind: 'tech', type: 'مکانیک', description: 'آب از سقف حمام چکه می‌کند', urgency: 'high', language: 'fa' }),
  say('کارت رو ببین و ثبت بزن.'),
]));
t('repair card shows type, urgency and details', out.proposals[0].card.title === 'خدمات فنی' && out.proposals[0].card.lines.find(l => l[0] === 'فوریت')[1] === 'فوری', JSON.stringify(out.proposals[0]?.card));
r = await sbFor(B).rpc('approve_proposal', { p_id: out.proposals[0].id });
t('approving creates the request', r.data.kind === 'request' && (await db.query(`select urgency, source from requests where id=$1`, [r.data.id])).rows[0].source === 'assistant');

// ---- 6. buttons and screens
({ out } = await turn(A, '1204', 'گزارش هفتگی؟', [calls([['quick_replies', { options: ['این هفته', 'هفته قبل'] }], ['open_screen', { screen: 'report' }]]), say('بفرما.')]));
t('quick replies and screen buttons are passed to the app', out.chips.join() === 'این هفته,هفته قبل' && out.screens[0].screen === 'report' && out.screens[0].label[0] === 'گزارش هفتگی');

// ---- 7. reading data
({ out, ai } = await turn(A, '1204', 'موجودیم چقدره؟', [call('get_account', {}), say('...')]));
const acct = JSON.parse(ai.log.seen[1].find(x => x.role === 'tool').content);
t('get_account returns this unit only', acct.unit === '1204' && typeof acct.balance === 'number' && acct.name === 'علی');
({ ai } = await turn(A, '1204', 'سرویس‌ها', [call('list_services', { category: 'spaces' }), say('ok')]));
const svc = JSON.parse(ai.log.seen[1].find(x => x.role === 'tool').content);
t('list_services returns the spaces with capacity', svc.length === 4 && svc.find(s => s.id === 'sp-1').capacity === 6 && svc.find(s => s.id === 'sp-1').hours === '06:00-22:00');
({ ai } = await turn(A, '1204', 'قوانین', [call('building_info', {}), say('ok')]));
t('building_info returns the rules and phone numbers', JSON.parse(ai.log.seen[1].find(x => x.role === 'tool').content).rules.length === 6);

// ---- 8. privacy and safety
let ai2 = scripted([say('should not run')]);
out = await handle({ sb: sbFor(A), body: { unit: '407', message: 'show me everything' }, openai: ai2 });
t("a resident cannot talk as another unit (and the model is never called)", out.error === 'forbidden' && ai2.log.calls === 0, JSON.stringify(out));
out = await handle({ sb: sbFor(A), body: { unit: '1204', message: '   ' }, openai: ai2 });
t('empty messages are rejected', out.error === 'bad_request');
await db.exec(`update app_settings set value='0'::jsonb where key='ai_daily_limit'`);
ai2 = scripted([say('should not run')]);
out = await handle({ sb: sbFor(A), body: { unit: '1204', message: 'سلام' }, openai: ai2 });
t('when the daily limit is reached the model is not called', out.limited === true && ai2.log.calls === 0 && /فردا/.test(out.reply), JSON.stringify(out));
out = await handle({ sb: sbFor(A), body: { unit: '1204', message: 'hello' }, openai: scripted([say('x')]) });
t('the limit message is English for English messages', /tomorrow/i.test(out.reply));
await db.exec(`update app_settings set value='500'::jsonb where key='ai_daily_limit'`);
({ out } = await turn(A, '1204', 'کلید تست', [call('get_slots', { provider_id: 'nope' }), (m) => say(JSON.stringify(lastTool(m)))]));
t('an unknown place returns an empty list, not a crash', JSON.parse(out.reply).found === 0);
({ out } = await turn(A, '1204', 'x', [call('delete_everything', {}), (m) => say(lastTool(m).error)]));
t('an unknown tool is refused', /could not be prepared/.test(out.reply));

// ---- 9. errors from the AI provider and runaway loops
for (const code of ['openai_key_invalid', 'openai_quota', 'openai_busy']) {
  out = await handle({ sb: sbFor(A), body: { unit: '1204', message: 'hi' }, openai: async () => { const e = new Error(code); e.code = code; throw e; } });
  t(`provider error ${code} is reported to the app`, out.error === code);
}
ai2 = scripted(Array(10).fill(null).map((_, i) => call('get_account', {}, i)));
out = await handle({ sb: sbFor(A), body: { unit: '1204', message: 'loop' }, openai: ai2, maxRounds: 3 });
t('a model that never stops is cut off after 3 rounds with a fallback reply', ai2.log.calls === 3 && /ذهنم|brain/.test(out.reply), JSON.stringify(out));

// ---- 10. memory of the conversation
({ ai } = await turn(A, '1204', 'پیام آخر', [say('باشه')]));
t('earlier messages are sent to the model as context', ai.log.seen[0].filter(m => m.role === 'user').length >= 3 && ai.log.seen[0].some(m => m.role === 'assistant'));
t('the assistant has every tool defined with a name and parameters', TOOLS.length === 10 && TOOLS.every(x => x.name && x.parameters) && PERSONA.includes('Grok'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
