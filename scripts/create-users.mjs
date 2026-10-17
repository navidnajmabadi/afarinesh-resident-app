#!/usr/bin/env node
// Creates the three accounts (Ali, Navid, Admin) and fills every unit with sample activity.
// Run from your own terminal:  node scripts/create-users.mjs
//   --reset   give existing accounts a new password again (Ali and Navid get 123456, Admin asks you)
// It asks for your project's SECRET key (typing is hidden). Never paste that key into chat or commit it.
// Run supabase/migrations/20261017000000_roles.sql in the SQL editor first (it adds the admin role).
import fs from 'node:fs';
import readline from 'node:readline';

const cfg = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const BASE = process.env.SUPABASE_URL || cfg.match(/url:\s*'([^']+)'/)[1];
const PUBLIC_KEY = cfg.match(/key:\s*'([^']+)'/)[1];
const RESET = process.argv.includes('--reset');

function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(q)) process.stdout.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); resolve(a.trim()); });
  });
}
async function askAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (;;) {
    const a = await askHidden('Choose the Admin password (at least 8 characters, typing is hidden): ');
    if (a.length < 8) { console.log('  Too short. Admin can see every resident, so use at least 8 characters.'); continue; }
    const b = await askHidden('Type it again: ');
    if (a !== b) { console.log('  The two entries differ. Try again.'); continue; }
    return a;
  }
}

const KEY = process.env.SUPABASE_SECRET_KEY || await askHidden('Secret key (typing is hidden): ');
if (!KEY) { console.error('No key given.'); process.exit(1); }
if (KEY.startsWith('sb_publishable_')) { console.error('That is the publishable key. Use the secret key (Project Settings → API Keys).'); process.exit(1); }

const H = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.startsWith('eyJ')) H.Authorization = 'Bearer ' + KEY;       // legacy JWT-style service_role key
const api = (kind, path, opt = {}) => fetch(`${BASE}/${kind}/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
const up = (table, rows, conflict, prefer = 'resolution=merge-duplicates') => api('rest', `${table}?on_conflict=${conflict}`, { method: 'POST', headers: { Prefer: prefer + ',return=minimal' }, body: JSON.stringify(rows) });

/* ---------- who ---------- */
const FIXED = '123456';   // Supabase refuses anything shorter than 6 characters
const PEOPLE = [
  { login: 'ali',   name: 'Ali',   full: 'علی بنده‌زاده', first: 'علی',  email: 'ali@example.com',   units: ['1204'], password: FIXED },
  { login: 'navid', name: 'Navid', full: 'نوید',          first: 'نوید', email: 'navid@example.com', units: ['907'],  password: FIXED },
  { login: 'admin', name: 'Admin', full: 'مدیر سیستم',    first: 'مدیر', email: 'admin@example.com', units: [], role: 'admin', ask: true },
];
const UNITS = [
  { code: '1204', role: 'owner',  shares: 10, balance: -12634541 },
  { code: '1408', role: 'owner',  shares: 8,  balance: 3850000 },
  { code: '407',  role: 'tenant', shares: 6,  balance: -2140000 },
  { code: '907',  role: 'owner',  shares: 7,  balance: -3250000 },
];

/* ---------- 1. units ---------- */
{
  const r = await up('units', UNITS, 'code', 'resolution=ignore-duplicates');
  if (!r.ok) { console.error('Could not reach the database or the units table:', r.status, await r.text()); process.exit(1); }
}

/* ---------- 2. accounts ---------- */
const out = [];
for (const p of PEOPLE) {
  const email = `${p.login}@afarinesh.test`;
  let id, password = null, state = 'existing';
  const list = await (await api('auth', 'admin/users?per_page=200')).json();
  const found = (list.users || []).find(x => x.email === email);
  if (!found) {
    password = p.ask ? await askAdminPassword() : p.password;
    const r = await api('auth', 'admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: p.full } }) });
    if (!r.ok) { console.error(`Could not create ${p.login}:`, r.status, await r.text()); process.exit(1); }
    id = (await r.json()).id; state = 'created';
  } else {
    id = found.id;
    if (RESET) {
      password = p.ask ? await askAdminPassword() : p.password;
      const pr = await api('auth', `admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
      if (!pr.ok) { console.error(`Could not reset ${p.login}:`, pr.status, await pr.text()); process.exit(1); }
      state = 'reset';
    }
  }
  let x = await up('profiles', [{ id, full_name: p.full, first_name: p.first, email: p.email, app_role: p.role || 'resident' }], 'id');
  if (!x.ok) {
    const msg = await x.text();
    console.error('profiles:', msg);
    if (/app_role|23514|check/i.test(msg)) console.error('\nThe admin role is missing. Run supabase/migrations/20261017000000_roles.sql in the SQL editor, then run this again.');
    process.exit(1);
  }
  if (p.units.length) {
    x = await up('user_units', p.units.map(unit_code => ({ user_id: id, unit_code })), 'user_id,unit_code');
    if (!x.ok) { console.error('user_units:', await x.text()); process.exit(1); }
  }
  out.push({ ...p, id, password, state });
}

/* ---------- 3. check each known password the way the app signs in ---------- */
console.log('\nChecking sign-in…');
let allOk = true;
for (const o of out) {
  if (!o.password) { console.log(`  ${o.name}: skipped (account already existed; run with --reset to set the password again)`); continue; }
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${o.login}@afarinesh.test`, password: o.password }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok) console.log(`  ${o.name}: ✓ sign-in works`);
  else { allOk = false; console.log(`  ${o.name}: ✗ FAILED (${r.status} ${j.error_code || j.error || ''} ${j.msg || j.error_description || ''})`); }
}

/* ---------- 4. sample activity for every unit (a table is filled only when that unit has nothing in it) ---------- */
const ago = h => new Date(Date.now() - h * 3600e3).toISOString();
const inH = h => new Date(Date.now() + h * 3600e3).toISOString();
const SAMPLE = {
  '1204': {
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
      { provider_id: 'cl-1', starts_at: inH(30), price: 0, code: '74310', created_at: ago(72) },
      { provider_id: 'spa-2', starts_at: inH(100), price: 765000, paid_by: 'account', code: '74306', created_at: ago(30) },
    ],
    requests: [
      { kind: 'tech', type: 'برق', description: 'تعویض کلید آشپزخانه', status: 'in_progress', assignee: 'مهدی رضایی', code: '74318', created_at: ago(2) },
      { kind: 'rent', type: 'فروش پارکینگ', description: 'مایل به فروش پارکینگ هستم', status: 'received', code: '74290', created_at: ago(96) },
      { kind: 'message', type: 'مشکل', description: 'ساب سنگ طبقه ۱۰ نیاز به رسیدگی دارد', status: 'done', code: '74112', created_at: ago(200) },
    ],
    orders: [{ venue: 'cafe', items: [{ name: 'لاته با سیروپ', qty: 2, price: 216000 }], total: 432000, delivery: 'unit', status: 'delivered', code: '74288', created_at: ago(20) }],
    notifications: [
      { title: 'کار درخواست شما شروع شد', body: 'برق', created_at: ago(1) },
      { title: 'رزرو قطعی شد', body: 'حمام‌کار · طیبه احمدی', created_at: ago(30) },
    ],
  },
  '907': {
    transactions: [
      { title: 'واریز کارت به کارت', category: 'واریز', amount: 6000000, description: 'واریز به حساب ساختمان. رسید تایید شد.', code: '75001', created_at: ago(120) },
      { title: 'بدنسازی خصوصی · پویا شریفی', category: 'ورزش و کلاس', amount: -6600000, description: 'دوره ۸ جلسه تک‌نفره', code: '75002', created_at: ago(90) },
      { title: 'کاوه نوری · ماساژ', category: 'اسپا و زیبایی', amount: -1305000, description: 'رزرو با ۱۰٪ تخفیف مالکین', code: '75003', created_at: ago(60) },
      { title: 'آشپزخانه', category: 'غذا و کافه', amount: -1360000, description: 'زرشک‌پلو با مرغ ×۲', code: '75004', created_at: ago(48) },
      { title: 'کافی‌شاپ', category: 'غذا و کافه', amount: -648000, description: 'لاته با سیروپ ×۳', code: '75005', created_at: ago(26) },
      { title: 'کارواش', category: 'کارواش', amount: -500000, description: 'روشویی و توشویی · سواری', code: '75006', created_at: ago(10) },
      { title: 'شارژ ماهانه مهر', category: 'شارژ ساختمان', amount: -997512, description: 'سهم واحد از هزینه‌های جاری: ۷ سهم', code: '75007', created_at: ago(150) },
    ],
    bookings: [
      { provider_id: 'sp-3', starts_at: inH(52), price: 0, code: '75010', created_at: ago(24) },
      { provider_id: 'cl-3', starts_at: inH(76), price: 0, code: '75011', created_at: ago(90) },
      { provider_id: 'spa-4', starts_at: inH(101), price: 1305000, paid_by: 'account', code: '75012', created_at: ago(60) },
      { provider_id: 'sp-1', starts_at: ago(60), status: 'done', price: 0, code: '75013', created_at: ago(100) },
    ],
    requests: [
      { kind: 'tech', type: 'مکانیک', description: 'شیر آب آشپزخانه نشتی دارد', status: 'received', code: '75020', created_at: ago(3) },
      { kind: 'rent', type: 'اجاره دادن واحد', description: 'مایل به اجاره دادن واحد خود هستم', status: 'assigned', assignee: 'دفتر املاک ساختمان', code: '75021', created_at: ago(70) },
      { kind: 'message', type: 'پیشنهاد', description: 'پیشنهاد می‌کنم ساعت کار استخر تا ۲۳ باشد', status: 'done', code: '75022', created_at: ago(300) },
    ],
    orders: [
      { venue: 'kitchen', items: [{ name: 'زرشک‌پلو با مرغ', qty: 2, price: 680000 }], total: 1360000, delivery: 'unit', status: 'delivered', code: '75030', created_at: ago(48) },
      { venue: 'cafe', items: [{ name: 'لاته با سیروپ', qty: 3, price: 216000 }], total: 648000, delivery: 'unit', status: 'preparing', code: '75031', created_at: ago(0.3) },
    ],
    notifications: [
      { title: 'سفارش ثبت شد', body: 'کافی‌شاپ', created_at: ago(0.3) },
      { title: 'رزرو قطعی شد', body: 'اسکواش', created_at: ago(24) },
      { title: 'درخواست شما ارجاع شد', body: 'اجاره دادن واحد', created_at: ago(60) },
    ],
  },
  '1408': {
    transactions: [
      { title: 'واریز کارت به کارت', category: 'واریز', amount: 10000000, description: 'واریز به حساب ساختمان', code: '76001', created_at: ago(100) },
      { title: 'تالار پذیرایی', category: 'رزرو فضا', amount: -16200000, description: 'رزرو تالار با ۱۰٪ تخفیف مالکین', code: '76002', created_at: ago(40) },
      { title: 'خانه‌داری · رضا امینی', category: 'خانه‌داری', amount: -855000, description: 'نظافت کامل واحد', code: '76003', created_at: ago(20) },
      { title: 'شارژ ماهانه مهر', category: 'شارژ ساختمان', amount: -1140000, description: 'سهم واحد از هزینه‌های جاری: ۸ سهم', code: '76004', created_at: ago(150) },
    ],
    bookings: [
      { provider_id: 'sp-2', starts_at: inH(120), price: 16200000, paid_by: 'account', code: '76010', created_at: ago(40) },
      { provider_id: 'hk-1', starts_at: inH(50), price: 855000, paid_by: 'account', code: '76011', created_at: ago(20) },
    ],
    requests: [{ kind: 'tech', type: 'تعمیرات', description: 'درب کمد دیواری بسته نمی‌شود', status: 'in_progress', assignee: 'مهدی رضایی', code: '76020', created_at: ago(30) }],
    orders: [{ venue: 'cafe', items: [{ name: 'کاپوچینو', qty: 2, price: 198000 }], total: 396000, delivery: 'cafe', status: 'delivered', code: '76030', created_at: ago(15) }],
    notifications: [{ title: 'رزرو قطعی شد', body: 'تالار پذیرایی', created_at: ago(40) }],
  },
  '407': {
    transactions: [
      { title: 'شارژ ماهانه مهر', category: 'شارژ ساختمان', amount: -855012, description: 'سهم واحد از هزینه‌های جاری: ۶ سهم', code: '77001', created_at: ago(150) },
      { title: 'آموزش پیانو', category: 'ورزش و کلاس', amount: -3800000, description: 'دوره ۴ جلسه', code: '77002', created_at: ago(80) },
      { title: 'واریز آنلاین', category: 'واریز', amount: 3000000, description: 'پرداخت از درگاه بانکی', code: '77003', created_at: ago(70) },
    ],
    bookings: [
      { provider_id: 'sp-1', starts_at: inH(34), price: 0, code: '77010', created_at: ago(10) },
      { provider_id: 'spa-1', starts_at: inH(54), price: 650000, paid_by: 'card', code: '77011', created_at: ago(8) },
      { provider_id: 'cl-4', starts_at: inH(80), price: 0, code: '77012', created_at: ago(80) },
    ],
    requests: [{ kind: 'message', type: 'شکایت', description: 'صدای آسانسور شب‌ها زیاد است', status: 'received', code: '77020', created_at: ago(12) }],
    orders: [{ venue: 'kitchen', items: [{ name: 'قورمه‌سبزی', qty: 1, price: 390000 }], total: 390000, delivery: 'unit', status: 'delivered', code: '77030', created_at: ago(30) }],
    notifications: [{ title: 'رزرو قطعی شد', body: 'استخر', created_at: ago(10) }],
  },
};
let filled = 0;
for (const [unit, tables] of Object.entries(SAMPLE)) {
  for (const [table, list] of Object.entries(tables)) {
    const has = await (await api('rest', `${table}?select=unit_code&unit_code=eq.${unit}&limit=1`)).json();
    if (has.length) continue;
    const keys = [...new Set(list.flatMap(Object.keys))];                       // every row must have the same fields
    const body = list.map(x => ({ unit_code: unit, ...Object.fromEntries(keys.map(k => [k, x[k] ?? null])) }));
    const r = await api('rest', table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    if (!r.ok) { console.error(`${table} (unit ${unit}):`, await r.text()); process.exit(1); }
    filled++;
  }
}
console.log(filled ? `\nSample activity added to ${filled} tables.` : '\nSample activity was already there.');

/* ---------- 5. summary ---------- */
console.log(allOk ? '\nDone. Sign in at the app with:\n' : '\nFinished, but a sign-in check FAILED (see above):\n');
for (const o of out) {
  const pw = o.password ? (o.ask ? '(the password you just typed)' : o.password) : '(unchanged)';
  console.log(`  ${o.name.padEnd(6)} user: ${o.login.padEnd(6)} password: ${pw.padEnd(30)} ${o.units.length ? 'unit ' + o.units.join(', ') : 'whole building'}`);
}
console.log('');
