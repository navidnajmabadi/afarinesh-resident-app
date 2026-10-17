/* آف‌بات: the chat start page. Loaded before app.js, which merges CR / CACT into its route and action tables.
   The assistant runs on the server (Supabase Edge Function "assistant"). It can look things up and PROPOSE actions;
   a proposal only becomes real when the resident taps the button on its card (approve_proposal runs the checked database functions). */

const CR = {}, CACT = {};
const CHAT = { unit: null, msgs: [], state: {}, busy: false, loaded: false, draft: '', timer: 0 };
const STARTERS = ['استخر فردا عصر خالیه؟', 'می‌خوام غذا سفارش بدم', 'موجودی حسابم چقدره؟', 'یه خرابی دارم'];
const CHAT_ERR = {
  not_configured: 'کلید هوش مصنوعی هنوز تنظیم نشده. به مدیر سیستم بگو.',
  openai_key_invalid: 'کلید هوش مصنوعی درست نیست. به مدیر سیستم بگو.',
  openai_quota: 'اعتبار هوش مصنوعی تموم شده. به مدیر سیستم بگو.',
  openai_busy: 'سرور هوش مصنوعی شلوغه. یه دقیقه دیگه دوباره بگو.',
  forbidden: 'این واحد مال تو نیست.',
  ai_error: 'یه چیزی وسط راه خراب شد. دوباره بگو.',
  server_error: 'یه چیزی وسط راه خراب شد. دوباره بگو.',
  bad_request: 'پیامت خالیه!',
  offline: 'اتصال برقرار نشد. اینترنتت رو چک کن.',
  missing: 'آف‌بات هنوز روی سرور نصب نشده. به مدیر سیستم بگو.',
};

function chatReset() { clearInterval(CHAT.timer); Object.assign(CHAT, { unit: null, msgs: [], state: {}, busy: false, loaded: false, draft: '', timer: 0 }); }

/* ---------- text ---------- */
const hasFa = t => /[\u0600-\u06FF]/.test(t);
function fmtMsg(t) {
  const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n');
  let out = '', list = false;
  for (const l of lines) {
    if (/^\s*[-•]\s+/.test(l)) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + l.replace(/^\s*[-•]\s+/, '') + '</li>'; }
    else { if (list) { out += '</ul>'; list = false; } out += (out && !out.endsWith('</ul>') ? '<br>' : '') + l; }
  }
  return list ? out + '</ul>' : out;
}
const chatGreeting = () => ({ role: 'assistant', local: true, starter: true, content: `سلام ${ST.me.name}! من آف‌بات‌ام، دستیار برج. رزرو می‌کنم، غذا سفارش می‌دم، خرابی ثبت می‌کنم، و اگه حوصله‌ت سر رفته سربه‌سرت هم می‌ذارم. چی لازم داری؟`, meta: { chips: STARTERS } });

/* ---------- messages ---------- */
function proposalCard(p) {
  const s = CHAT.state[p.id] || { status: 'pending', expires_at: p.expires_at };
  const isFa = p.lang !== 'en', exp = new Date(s.expires_at || p.expires_at).getTime();
  const lines = p.card.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto">${esc(v)}</dd></div>`).join('');
  let foot;
  if (s.status === 'pending' && exp > Date.now()) {
    foot = `<div class="pbtns"><button class="btn pri sm" data-act="papprove:${p.id}">${p.action === 'create_request' ? (isFa ? 'ثبت' : 'Submit') : (isFa ? 'تایید' : 'Approve')}</button><button class="btn sec sm" data-act="preject:${p.id}">${isFa ? 'انصراف' : 'Cancel'}</button></div><span class="m ptimer" data-exp="${exp}" data-fa="${isFa ? 1 : 0}"></span>`;
  } else if (s.status === 'approved') {
    foot = `<span class="pdone">${I('check', 'xs')} ${isFa ? 'انجام شد' : 'Done'}${s.result && s.result.code ? ` · ${isFa ? 'کد' : 'code'} ${isFa ? faDigits(s.result.code) : s.result.code}` : ''}</span>`;
  } else if (s.status === 'rejected') foot = `<span class="m">${isFa ? 'لغو شد' : 'Cancelled'}</span>`;
  else if (s.status === 'failed') foot = `<span class="perr">${esc(s.error || '')}</span>`;
  else foot = `<span class="m">${isFa ? 'منقضی شد' : 'Expired'}</span>`;
  return `<div class="pcard ${s.status}" data-pid="${p.id}"><b class="pt" dir="auto">${esc(p.card.title)}</b><dl>${lines}</dl>${foot}</div>`;
}
function messageHtml(m, last) {
  if (m.role === 'user') return `<div class="cm u"><div class="cb" dir="auto">${fmtMsg(m.content)}</div></div>`;
  const meta = m.meta || {};
  const cards = (meta.proposals || []).map(proposalCard).join('');
  const screens = (meta.screens || []).map(s => `<button class="qchip go" data-act="cscreen:${s.screen}">${esc(s.label[hasFa(m.content) ? 0 : 1])} ${I('chevL', 'xs')}</button>`).join('');
  const chips = last && !CHAT.busy ? (meta.chips || []).map((c, i) => `<button class="qchip" data-act="${m.starter ? 'starter' : 'chip'}:${i}">${esc(c)}</button>`).join('') : '';
  return `<div class="cm a"><span class="cav" aria-hidden="true">${I('sparkle', 'xs')}</span><div class="cstack"><div class="cb" dir="auto">${fmtMsg(m.content)}</div>${cards}${screens || chips ? `<div class="qrow">${screens}${chips}</div>` : ''}</div></div>`;
}
function threadHtml() {
  const msgs = CHAT.msgs.length ? CHAT.msgs : [chatGreeting()];
  const lastA = msgs.map(m => m.role).lastIndexOf('assistant');
  return msgs.map((m, i) => messageHtml(m, i === lastA && i === msgs.length - 1)).join('')
    + (CHAT.busy ? `<div class="cm a"><span class="cav" aria-hidden="true">${I('sparkle', 'xs')}</span><div class="cb typing" aria-label="آف‌بات در حال نوشتن است"><i></i><i></i><i></i></div></div>` : '');
}
function drawThread(scroll = true) {
  const th = document.getElementById('thread'); if (!th) return;
  th.innerHTML = threadHtml();
  if (scroll) requestAnimationFrame(() => { view.scrollTop = view.scrollHeight; });
}

/* ---------- talking to the server ---------- */
async function loadChat() {
  const unit = ST.unit;
  const { data, error } = await SB.rpc('ai_history', { p_unit: unit, p_limit: 40 });
  if (unit !== ST.unit) return;
  CHAT.unit = unit; CHAT.loaded = true;
  if (error || !data || !data.length) return;
  CHAT.msgs = data.map(m => ({ role: m.role, content: m.content, meta: m.meta || null }));
  const ids = data.flatMap(m => ((m.meta && m.meta.proposals) || []).map(p => p.id));
  if (ids.length) {
    const r = await SB.from('ai_proposals').select('id,status,result,expires_at').in('id', ids);
    (r.data || []).forEach(p => { CHAT.state[p.id] = { status: p.status === 'pending' && new Date(p.expires_at) < Date.now() ? 'expired' : p.status, result: p.result, expires_at: p.expires_at }; });
  }
}
async function sendChat(text) {
  text = String(text || '').trim();
  if (!text || CHAT.busy) return;
  CHAT.msgs.push({ role: 'user', content: text });
  CHAT.busy = true; CHAT.draft = ''; drawThread();
  let reply;
  try {
    const { data, error } = await SB.functions.invoke('assistant', { body: { unit: ST.unit, message: text } });
    if (error) throw error;
    if (data && data.error) reply = { role: 'assistant', local: true, content: CHAT_ERR[data.error] || CHAT_ERR.server_error };
    else {
      const meta = { chips: data.chips || [], proposals: data.proposals || [], screens: data.screens || [] };
      (meta.proposals).forEach(p => { CHAT.state[p.id] = { status: 'pending', expires_at: p.expires_at }; });
      reply = { role: 'assistant', content: data.reply || '…', meta };
    }
  } catch (e) {
    const name = (e && e.name) || '', status = e && e.context && e.context.status;
    console.warn('assistant call failed:', name, status, e && e.message);
    reply = { role: 'assistant', local: true, content: status === 404 || /not found/i.test((e && e.message) || '') ? CHAT_ERR.missing : /fetch|network|failed to send/i.test(name + ((e && e.message) || '')) ? CHAT_ERR.offline : CHAT_ERR.server_error };
  }
  CHAT.busy = false; CHAT.msgs.push(reply); drawThread();
}

async function chatFollowUp(text, meta) {
  CHAT.msgs.push({ role: 'assistant', content: text, meta: meta || null });
  SB.rpc('ai_log', { p_unit: ST.unit, p_role: 'assistant', p_content: text, p_meta: meta || null }).then(() => {});
}
const findProposal = id => { for (const m of CHAT.msgs) for (const p of ((m.meta && m.meta.proposals) || [])) if (p.id === id) return p; return null; };

/* ---------- screen ---------- */
CR.home = () => {
  const live = ST.acts.find(a => a.st === 'live' || a.st === 'wait');
  return { html: `
  <header class="top">
    <button class="unit-chip glass press" data-sheet="units">${I('building', 'sm')}<span>واحد ${faDigits(ST.unit)}</span>${I('chevD', 'xs')}</button>
    <button class="icon-btn glass press" aria-label="اعلان‌ها" data-sheet="notifs">${I('bell')}${ST.unread ? '<span class="dot"></span>' : ''}</button>
  </header>
  <div class="sumstrip">
    <button class="sumchip press" data-tabgo="finance"><span class="m">مانده حساب</span><b class="num">${ST.bal < 0 ? '−' : ''}${T(ST.bal)}</b><small class="m">تومان</small></button>
    ${live ? `<button class="sumchip press" data-sheet="act:${live.id}"><span class="m">در جریان</span><b class="ellipsis">${esc(live.t)}</b></button>` : ''}
  </div>
  <div class="thread" id="thread" aria-live="polite"></div>`,
  bar: `<form class="chatbar" id="chatform" autocomplete="off"><textarea id="chat-in" rows="1" dir="auto" enterkeyhint="send" placeholder="هر چی می‌خوای بپرس…" aria-label="پیام به آف‌بات"></textarea><button type="submit" class="send" aria-label="ارسال">${I('send')}</button></form>`,
  after() {
    drawThread(true);
    const ta = document.getElementById('chat-in'), form = document.getElementById('chatform');
    ta.value = CHAT.draft;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
    ta.addEventListener('input', () => { CHAT.draft = ta.value; grow(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', e => { e.preventDefault(); const v = ta.value; ta.value = ''; ta.style.height = 'auto'; sendChat(v); });
    grow();
    if (CHAT.unit !== ST.unit || !CHAT.loaded) { chatReset(); CHAT.unit = ST.unit; loadChat().then(() => drawThread(true)); }
    clearInterval(CHAT.timer);
    CHAT.timer = setInterval(() => {
      document.querySelectorAll('.ptimer').forEach(el => {
        const left = Math.max(0, Math.round((+el.dataset.exp - Date.now()) / 1000));
        if (!left) { const id = el.closest('.pcard').dataset.pid; CHAT.state[id] = { ...(CHAT.state[id] || {}), status: 'expired' }; drawThread(false); return; }
        const t = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        el.textContent = el.dataset.fa === '1' ? `این زمان برایت نگه داشته شده · ${faDigits(t)}` : `Held for you · ${t}`;
      });
    }, 1000);
  } };
};

/* ---------- actions ---------- */
Object.assign(CACT, {
  chip: i => { const last = [...CHAT.msgs].reverse().find(m => m.role === 'assistant'); const c = last && last.meta && last.meta.chips && last.meta.chips[+i]; if (c) sendChat(c); },
  starter: i => sendChat(STARTERS[+i]),
  cscreen: s => { if (s === 'pay') { clearPhotos(); openSheet('pay'); } else if (s === 'report') go('report'); else go(s, { root: true }); },
  preject: async id => {
    const p = findProposal(id); const isFa = !p || p.lang !== 'en';
    await SB.rpc('reject_proposal', { p_id: id });
    CHAT.state[id] = { status: 'rejected' }; chatFollowUp(isFa ? 'باشه، لغو شد. هر وقت خواستی بگو.' : 'Okay, cancelled. Tell me whenever you want it.'); drawThread();
  },
  papprove: async id => {
    const p = findProposal(id); const isFa = !p || p.lang !== 'en';
    busy(document.querySelector(`[data-act="papprove:${id}"]`), true, '…');
    const { data, error } = await SB.rpc('approve_proposal', { p_id: id });
    if (error) {
      const taken = /slot_taken|already_booked/.test(error.message || '');
      const text = taken ? (isFa ? 'یکی زودتر از تو جلو افتاد.' : 'Someone beat you to it.') : dbError(error);
      CHAT.state[id] = { status: 'failed', error: text };
      CHAT.msgs.push({ role: 'assistant', local: true, content: taken ? (isFa ? 'این ساعت همین الان رفت. بگم ساعت‌های خالی بعدی چیه؟' : 'That slot just went. Want me to show the next free ones?') : text, meta: { chips: taken ? [isFa ? 'ساعت‌های خالی' : 'Show free times'] : [] } });
      drawThread(); return;
    }
    if (data && data.kind === 'expired') { CHAT.state[id] = { status: 'expired' }; drawThread(); return; }
    CHAT.state[id] = { status: 'approved', result: data };
    try { await refresh(); } catch { /* the card is already confirmed */ }
    const word = { booking: isFa ? 'رزرو شد' : 'Booked', order: isFa ? 'سفارش ثبت شد' : 'Order placed', request: isFa ? 'درخواست ثبت شد' : 'Request sent' }[data.kind] || (isFa ? 'انجام شد' : 'Done');
    chatFollowUp(`${word} ✓ ${isFa ? 'در «فعالیت‌ها» می‌بینیش.' : 'You can follow it in Activity.'}`, { screens: [{ screen: 'activity', label: ['دیدن در فعالیت‌ها', 'See it in Activity'] }] });
    redraw();
  },
});
