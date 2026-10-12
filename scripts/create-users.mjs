#!/usr/bin/env node
// Creates the sample resident accounts and some demo activity.
// Run from your own terminal:  node scripts/create-users.mjs
// Add --reset to give existing accounts a new password (use it if you lost the first ones).
// It asks for your project's SECRET key (hidden input). Never paste that key into chat or commit it.
import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';

const cfg = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const BASE = process.env.SUPABASE_URL || cfg.match(/url:\s*'([^']+)'/)[1];
const PUBLIC_KEY = cfg.match(/key:\s*'([^']+)'/)[1];

function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(q)) process.stdout.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); resolve(a.trim()); });
  });
}

const KEY = process.env.SUPABASE_SECRET_KEY || await askHidden('Secret key (input is hidden): ');
if (!KEY) { console.error('No key given.'); process.exit(1); }
if (KEY.startsWith('sb_publishable_')) { console.error('That is the publishable key. Use the secret key (Project Settings → API Keys).'); process.exit(1); }

const H = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.startsWith('eyJ')) H.Authorization = 'Bearer ' + KEY;       // legacy JWT-style service_role key
const api = (kind, path, opt = {}) => fetch(`${BASE}/${kind}/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
const RESET = process.argv.includes('--reset');
const gen = () => crypto.randomBytes(9).toString('base64url');
const hoursFromNow = h => new Date(Date.now() + h * 3600e3).toISOString();

const PEOPLE = [
  { login: '1204', full: 'علی بنده‌زاده', first: 'علی', email: 'ali@example.com', units: ['1204', '1408'] },
  { login: '407',  full: 'سارا مهرپور',   first: 'سارا', email: 'sara@example.com', units: ['407'] },
];

// 1. The units must exist (seed.sql creates them).
{
  const r = await api('rest', 'units?select=code');
  if (!r.ok) { console.error('Could not reach the database:', r.status, await r.text()); process.exit(1); }
  const have = new Set((await r.json()).map(u => u.code));
  const need = PEOPLE.flatMap(p => p.units).filter(c => !have.has(c));
  if (need.length) { console.error('Run supabase/seed.sql first. Missing units:', need.join(', ')); process.exit(1); }
}

// 2. Accounts.
const out = [];
for (const p of PEOPLE) {
  const email = `${p.login}@afarinesh.test`, pass = gen();
  let r = await api('auth', 'admin/users', { method: 'POST', body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { full_name: p.full } }) });
  let id, password = pass;
  if (r.ok) id = (await r.json()).id;
  else {
    const list = await (await api('auth', 'admin/users?per_page=200')).json();
    const u = (list.users || []).find(x => x.email === email);
    if (!u) { console.error(`Could not create ${p.login}:`, r.status, await r.text()); process.exit(1); }
    id = u.id; password = null;
    if (RESET) {
      password = pass;
      const pr = await api('auth', `admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
      if (!pr.ok) { console.error(`Could not reset ${p.login}:`, pr.status, await pr.text()); process.exit(1); }
    }
  }
  const up = (table, rows, conflict) => api('rest', `${table}?on_conflict=${conflict}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  let x = await up('profiles', [{ id, full_name: p.full, first_name: p.first, email: p.email, app_role: 'resident' }], 'id');
  if (!x.ok) { console.error('profiles:', await x.text()); process.exit(1); }
  x = await up('user_units', p.units.map(unit_code => ({ user_id: id, unit_code })), 'user_id,unit_code');
  if (!x.ok) { console.error('user_units:', await x.text()); process.exit(1); }
  out.push({ login: p.login, password, id });
}

// 2b. Check that each password really works, the same way the app signs in.
console.log('\nChecking sign-in…');
let allOk = true;
for (const o of out) {
  if (!o.password) { console.log(`  unit ${o.login}: skipped (password unchanged; use --reset to set a new one)`); continue; }
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${o.login}@afarinesh.test`, password: o.password }) });
  const j = await r.json().catch(() => ({}));
  o.ok = r.ok;
  if (r.ok) console.log(`  unit ${o.login}: ✓ sign-in works`);
  else { allOk = false; console.log(`  unit ${o.login}: ✗ FAILED (${r.status} ${j.error_code || j.error || ''} ${j.msg || j.error_description || ''})`); }
}

// 3. Demo activity. Each table is filled only if that unit has nothing in it yet.
async function seedActivity(unit, rows) {
  for (const [table, list] of Object.entries(rows)) {
    const has = await (await api('rest', `${table}?select=unit_code&unit_code=eq.${unit}&limit=1`)).json();
    if (has.length) continue;
    const keys = [...new Set(list.flatMap(Object.keys))];                       // every row must have the same fields
    const body = list.map(x => ({ unit_code: unit, ...Object.fromEntries(keys.map(k => [k, x[k] ?? null])) }));
    const r = await api('rest', table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    if (!r.ok) { console.error(table, await r.text()); process.exit(1); }
  }
}
const ago = h => hoursFromNow(-h);
await seedActivity('1204', {
  transactions: [
    { title: 'یوگا · ۸ جلسه', category: 'ورزش و کلاس', amount: -4500000, description: 'دوره یوگا با الناز کریمی، ۸ جلسه', code: '74302', created_at: ago(3) },
    { title: 'واریز کارت به کارت', category: 'واریز', amount: 15000000, description: 'واریز به حساب ساختمان. رسید توسط امور مالی تایید شد.', code: '74300', created_at: ago(5) },
    { title: 'حمام‌کار · طیبه احمدی', category: 'اسپا و زیبایی', amount: -765000, description: 'رزرو با ۱۰٪ تخفیف مالکین', code: '74306', created_at: ago(30) },
    { title: 'آشپزخانه', category: 'غذا و کافه', amount: -780000, description: 'زرشک‌پلو با مرغ ×۱', code: '74296', created_at: ago(40) },
    { title: 'تخفیف ۱۰٪ رزرو', category: 'تخفیف', amount: 400000, description: 'تخفیف مالکین برای رزرو تالار', code: '74294', created_at: ago(70) },
    { title: 'تالار پذیرایی', category: 'رزرو فضا', amount: -4000000, description: 'رزرو تالار برای ۴۰ نفر', code: '74293', created_at: ago(70) },
    { title: 'شارژ ماهانه مهر', category: 'شارژ ساختمان', amount: -1425018, description: 'سهم واحد از هزینه‌های جاری: ۱۰ سهم', code: '73915', created_at: ago(150) },
  ],
  bookings: [
    { provider_id: 'cl-1', starts_at: hoursFromNow(30), price: 0, code: '74310', created_at: ago(72) },
    { provider_id: 'spa-2', starts_at: hoursFromNow(100), price: 765000, paid_by: 'account', code: '74306', created_at: ago(30) },
  ],
  requests: [
    { kind: 'tech', type: 'برق', description: 'تعویض کلید آشپزخانه', status: 'in_progress', assignee: 'مهدی رضایی', code: '74318', created_at: ago(2) },
    { kind: 'rent', type: 'فروش پارکینگ', description: 'مایل به فروش پارکینگ هستم', status: 'received', code: '74290', created_at: ago(96) },
    { kind: 'message', type: 'مشکل', description: 'ساب سنگ طبقه ۱۰ نیاز به رسیدگی دارد', status: 'done', code: '74112', created_at: ago(200) },
  ],
  orders: [
    { venue: 'cafe', items: [{ name: 'لاته با سیروپ', qty: 2, price: 216000 }], total: 432000, delivery: 'unit', status: 'delivered', code: '74288', created_at: ago(20) },
  ],
  notifications: [
    { title: 'کار درخواست شما شروع شد', body: 'برق', created_at: ago(1) },
    { title: 'رزرو قطعی شد', body: 'حمام‌کار · طیبه احمدی', created_at: ago(30) },
  ],
});
await seedActivity('407', {
  transactions: [{ title: 'شارژ ماهانه مهر', category: 'شارژ ساختمان', amount: -855012, description: 'سهم واحد از هزینه‌های جاری: ۶ سهم', code: '73916', created_at: ago(150) }],
});

console.log(allOk ? '\nDone. Sign-in codes and passwords (shown once; save them somewhere safe):\n' : '\nFinished, but a sign-in check FAILED (see above). Passwords below may not work:\n');
for (const o of out) console.log(`  unit ${o.login.padEnd(6)} ${o.password ?? '(account already existed, password unchanged)'}`);
console.log('\nResidents sign in on the app with the unit code and this password.');
