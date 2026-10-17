// Runs every migration and the seed on a local in-memory Postgres (PGlite) and checks the rules:
// privacy between units, opening hours and capacity, double booking, the 3-minute hold, refunds,
// payments, assistant proposals, manager and admin powers.
// Usage: cd tests && npm install && npm test
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

export async function makeDb() {
  const R = new URL('../supabase/', import.meta.url).pathname;
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated;`);
  const run = f => db.exec(fs.readFileSync(R + f, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await run('migrations/20261012000000_init.sql');
  for (const f of ['20261012010000_actions.sql', '20261013000000_manager.sql', '20261017000000_roles.sql', '20261018000000_schedules_assistant.sql']) {
    await run('migrations/' + f); await run('migrations/' + f);                  // twice: must be re-runnable
  }
  await db.exec(`grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;`);
  await run('seed.sql'); await run('seed.sql');
  return db;
}

export const IDS = { A: '11111111-1111-1111-1111-111111111111', B: '22222222-2222-2222-2222-222222222222', M: '33333333-3333-3333-3333-333333333333', ADM: '44444444-4444-4444-4444-444444444444' };

export async function seedPeople(db) {
  const { A, B, M, ADM } = IDS;
  await db.exec(`
    insert into auth.users values ('${A}'),('${B}'),('${M}'),('${ADM}');
    insert into profiles(id,full_name,first_name) values ('${A}','علی','علی'),('${B}','سارا','سارا');
    insert into profiles(id,full_name,first_name,app_role) values ('${M}','مدیر','مدیر','manager'),('${ADM}','مدیر سیستم','مدیر','admin');
    insert into user_units values ('${A}','1204'),('${A}','1408'),('${B}','407');
    update units set balance=0;`);
}

export const makeAs = db => async (uid, sql, params = []) => {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid || ''}',false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return { ok: true, rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};

if (process.argv[1] && process.argv[1].endsWith('db.test.mjs')) {
  const db = await makeDb();
  const { A, B, M, ADM } = IDS;
  await seedPeople(db);
  const as = makeAs(db);
  let pass = 0, fail = 0;
  const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
  const bal = async u => Number((await db.query(`select balance from units where code=$1`, [u])).rows[0].balance);
  const future = h => new Date(Date.now() + h * 3600e3).toISOString();
  // n-th free slot of a place that starts more than `hours` from now, as seen by `uid`
  const slot = async (uid, prov, hours = 0, n = 0) =>
    (await as(uid, `select starts_at from available_slots($1, null, 14) where free > 0 and starts_at > now() + ($2 || ' hours')::interval order by 1 offset $3 limit 1`, [prov, String(hours), n])).rows[0]?.starts_at;
  const hhmm = d => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
  let r;

  // ---- opening hours generate the slots
  r = await as(A, `select starts_at from available_slots('sp-1', null, 3)`);
  const poolTimes = new Set(r.rows.map(x => hhmm(x.starts_at)));
  t('pool offers 06:00 and 21:00 but not 22:00', poolTimes.has('06:00') && poolTimes.has('21:00') && !poolTimes.has('22:00'), [...poolTimes].join());
  r = await as(A, `select starts_at from available_slots('sp-2', null, 7)`);
  t('hall offers only 10:00, 14:00 and 18:00', r.ok && [...new Set(r.rows.map(x => hhmm(x.starts_at)))].sort().join() === '10:00,14:00,18:00');
  r = await as(A, `select starts_at from available_slots('hk-1', null, 7)`);
  t('housekeeping slots start at least 24 hours ahead', r.ok && r.rows.length > 0 && r.rows.every(x => new Date(x.starts_at) > new Date(Date.now() + 24 * 3600e3)));
  r = await as(null, `select * from available_slots('sp-1', null, 1)`);
  t('anonymous cannot list slots', !r.ok);

  // ---- booking
  const s1 = await slot(A, 'spa-2', 0, 1);
  r = await as(A, `select * from book_slot('1204','spa-2',$1,'account')`, [s1]);
  t('owner books spa-2', r.ok, r.err);
  t('price has 10% owner discount (850000 -> 765000)', r.ok && Number(r.rows[0].price) === 765000);
  t('balance went down by 765000', await bal('1204') === -765000);
  r = await as(B, `select * from book_slot('407','spa-2',$1,'account')`, [s1]);
  t('second resident cannot take the same slot', !r.ok && /slot_taken/.test(r.err), r.err);
  t('failed booking charged nothing', await bal('407') === 0);
  r = await as(B, `select free from available_slots('spa-2', null, 14) where starts_at = $1`, [s1]);
  t('the booked slot no longer shows as free', r.ok && r.rows.length === 1 && r.rows[0].free === 0, JSON.stringify(r));
  r = await as(B, `select * from book_slot('1204','spa-1',$1,'account')`, [await slot(B, 'spa-1')]);
  t("cannot book for someone else's unit", !r.ok && /not_your_unit/.test(r.err), r.err);
  r = await as(null, `select * from book_slot('1204','spa-1',$1,'account')`, [await slot(A, 'spa-1')]);
  t('anonymous cannot call book_slot', !r.ok);
  r = await as(A, `select * from book_slot('1204','hk-1',$1,'account')`, [future(5)]);
  t('housekeeping needs a day ahead', !r.ok && /needs_day_ahead/.test(r.err), r.err);
  r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [future(0.2)]);
  t('too-soon booking rejected', !r.ok && /too_soon/.test(r.err), r.err);
  const offGrid = new Date(new Date(s1).getTime() + 7 * 60000).toISOString();
  r = await as(A, `select * from book_slot('1204','spa-1',$1,'account')`, [offGrid]);
  t('a time that is not on the schedule is rejected', !r.ok && /bad_slot/.test(r.err), r.err);
  const pool1 = await slot(A, 'sp-1', 48);
  r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [pool1]);
  t('free facility booking costs nothing', r.ok && Number(r.rows[0].price) === 0, r.err);
  t('free booking left balance unchanged', await bal('1204') === -765000);
  r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [pool1]);
  t('the same unit cannot book the same slot twice', !r.ok && /already_booked/.test(r.err), r.err);
  r = await as(B, `select * from book_slot('407','spa-3',$1,'card')`, [await slot(B, 'spa-3', 0, 2)]);
  t('tenant pays full price by card (no discount)', r.ok && Number(r.rows[0].price) === 1200000, r.err);
  t('card payment leaves account balance unchanged', await bal('407') === 0);

  // ---- capacity: the pool holds 6
  await db.exec(`insert into units(code,role,shares) values ('X1','owner',1),('X2','owner',1),('X3','owner',1),('X4','owner',1),('X5','owner',1),('X6','owner',1);
                 insert into user_units select '${A}', code from units where code like 'X%';`);
  const pool2 = await slot(A, 'sp-1', 72, 3);
  let okCount = 0;
  for (const u of ['X1', 'X2', 'X3', 'X4', 'X5', 'X6']) { r = await as(A, `select * from book_slot('${u}','sp-1',$1,'account')`, [pool2]); if (r.ok) okCount++; }
  t('six units can share one pool slot', okCount === 6);
  r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [pool2]);
  t('the seventh is refused: pool slot is full', !r.ok && /slot_taken/.test(r.err), r.err);
  r = await as(B, `select free, capacity from available_slots('sp-1', null, 14) where starts_at = $1`, [pool2]);
  t('a full slot shows 0 free of 6', r.ok && r.rows[0].free === 0 && r.rows[0].capacity === 6, JSON.stringify(r.rows));

  // ---- privacy
  r = await as(B, `select count(*)::int n from bookings`); t('resident B sees only their own bookings', r.rows[0].n === 1, JSON.stringify(r.rows));
  r = await as(B, `select count(*)::int n from units`); t('resident B sees only their own unit', r.rows[0].n === 1);
  await as(B, `update units set balance=999999999 where code='407'`);
  t('resident cannot edit own balance directly', await bal('407') === 0);
  r = await as(B, `insert into bookings(unit_code,provider_id,starts_at,price) values ('407','spa-1',now()+interval '3 days',0)`);
  t('resident cannot insert a booking directly', !r.ok);
  r = await as(B, `insert into transactions(unit_code,title,category,amount) values ('407','x','y',5000000)`);
  t('resident cannot insert transactions directly', !r.ok);
  await as(B, `update profiles set app_role='manager' where id='${B}'`);
  t('resident cannot promote self to manager', (await db.query(`select app_role from profiles where id='${B}'`)).rows[0].app_role === 'resident');

  // ---- cancel
  const bk = (await db.query(`select id from bookings where unit_code='1204' and provider_id='spa-2'`)).rows[0].id;
  r = await as(B, `select cancel_booking('${bk}')`); t("cannot cancel another unit's booking", !r.ok && /not_your_unit/.test(r.err), r.err);
  r = await as(A, `select cancel_booking('${bk}') j`);
  const farEnough = new Date(s1) - Date.now() >= 24 * 3600e3;
  t('cancel refunds when the slot is more than 24h away', r.ok && r.rows[0].j.refunded === (farEnough ? 765000 : 0), JSON.stringify(r));
  await db.exec(`update units set balance=0 where code='1204'`);
  r = await as(A, `select cancel_booking('${bk}')`); t('cannot cancel twice', !r.ok && /not_cancellable/.test(r.err));
  const sFar = await slot(A, 'spa-4', 40);
  r = await as(A, `select * from book_slot('1204','spa-4',$1,'account')`, [sFar]);
  const farId = r.rows[0].id;
  t('setup: owner booked a far-away massage (1305000)', Number(r.rows[0].price) === 1305000, r.err);
  r = await as(A, `select cancel_booking('${farId}') j`); t('cancel >24h ahead refunds full price', r.ok && r.rows[0].j.refunded === 1305000, JSON.stringify(r));
  t('refund restored the balance', await bal('1204') === 0);
  await db.exec(`update bookings set starts_at = now() + interval '5 hours' where unit_code='407' and provider_id='spa-3'`);
  const bk2 = (await db.query(`select id from bookings where unit_code='407' and provider_id='spa-3'`)).rows[0].id;
  r = await as(B, `select cancel_booking('${bk2}') j`); t('cancel <24h gives no refund', r.ok && r.rows[0].j.refunded === 0, JSON.stringify(r));
  r = await as(B, `select * from book_slot('407','spa-4',$1,'account')`, [sFar]);
  t('a cancelled slot can be booked again', r.ok, r.err);

  // ---- orders
  const item = async (v, n) => (await db.query(`select id,price from menu_items where venue=$1 and name=$2 limit 1`, [v, n])).rows[0];
  const latte = await item('cafe', 'لاته با سیروپ');
  await db.exec(`update units set balance=0`);
  r = await as(A, `select * from place_order('1204','cafe',$1::jsonb,'unit')`, [JSON.stringify([{ id: latte.id, qty: 2 }])]);
  t('café order total = 2 x 216000', r.ok && Number(r.rows[0].total) === 432000, r.err);
  t('order charged the account', await bal('1204') === -432000);
  r = await as(A, `select * from place_order('1204','cafe',$1::jsonb)`, [JSON.stringify([{ id: latte.id, qty: -3 }])]); t('negative quantity rejected', !r.ok && /bad_quantity/.test(r.err));
  r = await as(A, `select * from place_order('1204','kitchen',$1::jsonb)`, [JSON.stringify([{ id: latte.id, qty: 1 }])]); t('item from another venue rejected', !r.ok && /item_not_found/.test(r.err));
  const kz = await item('kitchen', 'زرشک‌پلو با مرغ');
  await db.exec(`update units set balance=0`);
  r = await as(A, `select * from place_order('1204','kitchen',$1::jsonb)`, [JSON.stringify([{ id: kz.id, qty: 30 }])]);
  t('30 kitchen portions get 10% off (30x680000 -> 18360000)', r.ok && Number(r.rows[0].total) === 18360000, r.err);
  r = await as(A, `select quote_order('1204','kitchen',$1::jsonb) q`, [JSON.stringify([{ id: kz.id, qty: 30 }])]);
  t('the quote shows the same total as the order', r.ok && Number(r.rows[0].q.total) === 18360000, JSON.stringify(r));
  r = await as(B, `select * from place_order('1204','cafe',$1::jsonb)`, [JSON.stringify([{ id: latte.id, qty: 1 }])]); t("cannot order on someone else's unit", !r.ok && /not_your_unit/.test(r.err));

  // ---- payment
  await db.exec(`update units set balance=-5000000 where code='407'`);
  r = await as(B, `select make_payment('407', 5000000) b`); t('payment clears the debt', r.ok && Number(r.rows[0].b) === 0, r.err);
  r = await as(B, `select make_payment('407', 5)`); t('tiny payment rejected', !r.ok && /bad_amount/.test(r.err));
  r = await as(B, `select make_payment('1204', 5000000)`); t('cannot pay into another unit', !r.ok && /not_your_unit/.test(r.err));
  await db.exec(`update app_settings set value='false'::jsonb where key='demo_payments'`);
  r = await as(B, `select make_payment('407', 50000)`); t('payments can be switched off', !r.ok && /payments_disabled/.test(r.err), r.err);
  await db.exec(`update app_settings set value='true'::jsonb where key='demo_payments'`);

  // ---- requests and manager
  r = await as(B, `insert into requests(unit_code,kind,type,description) values ('407','tech','برق','کلید خراب است') returning id`);
  t('resident can create a request for own unit', r.ok, r.err);
  const rid = r.rows?.[0]?.id;
  r = await as(B, `insert into requests(unit_code,kind,type,description) values ('1204','tech','برق','x')`); t('cannot create a request for another unit', !r.ok);
  r = await as(B, `select * from set_request_status('${rid}','in_progress')`); t('resident cannot change request status', !r.ok && /forbidden/.test(r.err), r.err);
  r = await as(M, `select * from set_request_status('${rid}','in_progress','مهدی رضایی')`); t('manager can move a request to in_progress', r.ok && r.rows[0].status === 'in_progress', r.err);
  r = await as(B, `select title from notifications where unit_code='407' order by created_at desc limit 1`); t('resident is notified of the status change', r.ok && /شروع شد/.test(r.rows[0]?.title || ''));
  r = await as(M, `select count(*)::int n from bookings`); t('manager sees all bookings', r.ok && r.rows[0].n >= 3);
  await db.exec(`update units set balance=0`);
  const mSlot = await slot(A, 'spa-4', 30, 1);
  r = await as(A, `select * from book_slot('1204','spa-4',$1,'account')`, [mSlot]);
  const mb = r.rows?.[0]?.id;
  r = await as(B, `select set_booking_status('${mb}','done')`); t('resident cannot use manager booking action', !r.ok && /forbidden/.test(r.err));
  r = await as(M, `select set_booking_status('${mb}','cancelled') j`); t('manager cancel refunds in full', r.ok && r.rows[0].j.refunded === 1305000, r.err);
  t('refund restored the unit balance', await bal('1204') === 0);
  r = await as(A, `select description from transactions where unit_code='1204' and title='بازگشت وجه' order by created_at desc limit 1`); t('resident sees a refund transaction from the office', r.ok && /مدیریت/.test(r.rows[0]?.description || ''));
  r = await as(A, `select title from notifications where unit_code='1204' order by created_at desc limit 1`); t('resident is told the booking was cancelled', r.ok && /توسط مدیریت/.test(r.rows[0]?.title || ''));
  r = await as(M, `select set_booking_status('${mb}','done')`); t('cancelled booking cannot be changed again', !r.ok && /not_changeable/.test(r.err));
  r = await as(M, `select set_booking_status('${pool1 ? (await db.query(`select id from bookings where unit_code='1204' and provider_id='sp-1' limit 1`)).rows[0].id : ''}','done') j`); t('manager can mark a booking done', r.ok && r.rows[0].j.refunded === 0, r.err);
  r = await as(M, `select count(*)::int n from units`); t('manager sees every unit', r.ok && r.rows[0].n >= 3, JSON.stringify(r.rows));
  r = await as(M, `select * from set_order_status((select id from orders limit 1),'delivered')`); t('manager can mark an order delivered', r.ok && r.rows[0].status === 'delivered', r.err);
  r = await as(B, `select * from set_order_status((select id from orders limit 1),'delivered')`); t('resident cannot change an order status', !r.ok && /forbidden/.test(r.err));

  // ---- admin role
  r = await as(ADM, `select is_manager() m, is_admin() a`); t('admin counts as manager and as admin', r.ok && r.rows[0].m === true && r.rows[0].a === true, JSON.stringify(r));
  r = await as(M, `select is_manager() m, is_admin() a`); t('manager is not admin', r.ok && r.rows[0].m === true && r.rows[0].a === false);
  r = await as(B, `select is_manager() m, is_admin() a`); t('resident is neither', r.ok && r.rows[0].m === false && r.rows[0].a === false);
  r = await as(ADM, `select * from set_request_status('${rid}','done')`); t('admin can change request status', r.ok && r.rows[0].status === 'done', r.err);
  await as(B, `update profiles set app_role='admin' where id='${B}'`);
  t('resident cannot make self admin', (await db.query(`select app_role from profiles where id='${B}'`)).rows[0].app_role === 'resident');
  await as(M, `update profiles set app_role='admin' where id='${M}'`);
  t('manager cannot make self admin', (await db.query(`select app_role from profiles where id='${M}'`)).rows[0].app_role === 'manager');
  try { await db.exec(`insert into auth.users values ('55555555-5555-5555-5555-555555555555'); insert into profiles(id,full_name,first_name,app_role) values ('55555555-5555-5555-5555-555555555555','x','x','superuser')`); t('unknown role is rejected', false, 'accepted'); }
  catch { t('unknown role is rejected', true); }

  // ---- assistant proposals and the 3-minute hold
  const sq = await slot(A, 'sp-3', 24);
  r = await as(A, `select * from create_proposal('1204','book',$1::jsonb,'رزرو اسکواش')`, [JSON.stringify({ provider_id: 'sp-3', starts_at: sq })]);
  t('assistant can propose a booking', r.ok && r.rows[0].status === 'pending', r.err);
  const pid = r.rows?.[0]?.id;
  r = await as(B, `select free from available_slots('sp-3', null, 14) where starts_at = $1`, [sq]);
  t("another resident sees the proposed slot as held (0 free)", r.ok && r.rows[0].free === 0, JSON.stringify(r.rows));
  r = await as(A, `select free from available_slots('sp-3', null, 14) where starts_at = $1`, [sq]);
  t('the proposer still sees it as theirs to take', r.ok && r.rows[0].free === 1, JSON.stringify(r.rows));
  r = await as(B, `select * from book_slot('407','sp-3',$1,'account')`, [sq]);
  t('during the hold nobody else can book it', !r.ok && /slot_taken/.test(r.err), r.err);
  r = await as(B, `select * from create_proposal('407','book',$1::jsonb,'x رزرو')`, [JSON.stringify({ provider_id: 'sp-3', starts_at: sq })]);
  t('nor propose it', !r.ok && /slot_taken/.test(r.err), r.err);
  r = await as(B, `select approve_proposal('${pid}')`); t("cannot approve someone else's proposal", !r.ok && /not_found/.test(r.err), r.err);
  r = await as(A, `select approve_proposal('${pid}') j`);
  t('approving books the slot', r.ok && r.rows[0].j.kind === 'booking', r.err);
  r = await as(A, `select source from bookings where id = $1`, [r.rows?.[0]?.j?.id]); t('the booking is marked as made by the assistant', r.ok && r.rows[0].source === 'assistant');
  r = await as(A, `select approve_proposal('${pid}')`); t('a proposal can only be approved once', !r.ok && /not_pending/.test(r.err), r.err);
  r = await as(A, `update ai_proposals set status='pending' where id='${pid}'`);
  t('residents cannot edit proposals directly', (await db.query(`select status from ai_proposals where id='${pid}'`)).rows[0].status === 'approved');

  const sq2 = await slot(A, 'sp-3', 24, 3);
  r = await as(A, `select * from create_proposal('1204','book',$1::jsonb,'اسکواش دوم')`, [JSON.stringify({ provider_id: 'sp-3', starts_at: sq2 })]);
  const pid2 = r.rows[0].id;
  await db.exec(`update ai_proposals set expires_at = now() - interval '1 minute' where id='${pid2}'`);
  r = await as(B, `select * from book_slot('407','sp-3',$1,'account')`, [sq2]);
  t('after 3 minutes the hold ends and others can book', r.ok, r.err);
  r = await as(A, `select approve_proposal('${pid2}') j`); t('an expired proposal cannot be approved', r.ok && r.rows[0].j.kind === 'expired', JSON.stringify(r));

  const sq3 = await slot(A, 'sp-3', 24, 6);
  const sq4 = await slot(A, 'sp-3', 24, 8);
  const p1 = (await as(A, `select * from create_proposal('1204','book',$1::jsonb,'اول')`, [JSON.stringify({ provider_id: 'sp-3', starts_at: sq3 })])).rows[0].id;
  await as(A, `select * from create_proposal('1204','book',$1::jsonb,'دوم')`, [JSON.stringify({ provider_id: 'sp-3', starts_at: sq4 })]);
  t('a new proposal lapses the previous one and frees its hold', (await db.query(`select status from ai_proposals where id='${p1}'`)).rows[0].status === 'expired');

  await db.exec(`update units set balance=0 where code='1204'`);
  r = await as(A, `select * from create_proposal('1204','order',$1::jsonb,'سفارش کافه')`, [JSON.stringify({ venue: 'cafe', items: [{ id: latte.id, qty: 3 }], delivery: 'unit' })]);
  const po = r.rows?.[0]?.id; t('assistant can propose an order', r.ok, r.err);
  r = await as(A, `select approve_proposal('${po}') j`);
  t('approving places the order and charges 3 x 216000', r.ok && r.rows[0].j.kind === 'order' && await bal('1204') === -648000, r.err);
  r = await as(A, `select * from create_proposal('1204','order',$1::jsonb,'x سفارش')`, [JSON.stringify({ venue: 'cafe', items: [{ id: kz.id, qty: 1 }], delivery: 'unit' })]);
  t('a proposal with an item from the wrong venue is refused', !r.ok && /item_not_found/.test(r.err), r.err);
  r = await as(B, `select * from create_proposal('407','create_request',$1::jsonb,'درخواست برق')`, [JSON.stringify({ kind: 'tech', type: 'برق', description: 'کلید برق آشپزخانه خراب است', urgency: 'high' })]);
  const pr = r.rows?.[0]?.id; t('assistant can propose a repair request', r.ok, r.err);
  r = await as(B, `select approve_proposal('${pr}') j`); t('approving creates the request', r.ok && r.rows[0].j.kind === 'request', r.err);
  r = await as(B, `select source, urgency from requests where id = $1`, [r.rows?.[0]?.j?.id]); t('the request is marked as made by the assistant', r.ok && r.rows[0].source === 'assistant' && r.rows[0].urgency === 'high');
  r = await as(B, `select * from create_proposal('1204','create_request',$1::jsonb,'x درخواست')`, [JSON.stringify({ kind: 'tech', type: 'برق', description: 'something broken here' })]);
  t("cannot propose on someone else's unit", !r.ok && /not_your_unit/.test(r.err), r.err);
  const pj = (await as(B, `select * from create_proposal('407','create_request',$1::jsonb,'درخواست دیگر')`, [JSON.stringify({ kind: 'message', type: 'پیشنهاد', description: 'ساعت استخر بیشتر شود' })])).rows[0].id;
  await as(B, `select reject_proposal('${pj}')`); t('a proposal can be rejected', (await db.query(`select status from ai_proposals where id='${pj}'`)).rows[0].status === 'rejected');

  // ---- assistant helpers
  r = await as(A, `select ai_account('1204') a`); t('assistant can read the resident account', r.ok && r.rows[0].a.unit === '1204' && Array.isArray(r.rows[0].a.upcoming_bookings), JSON.stringify(r).slice(0, 200));
  r = await as(A, `select ai_account('407')`); t("assistant cannot read another unit's account", !r.ok && /not_your_unit/.test(r.err));
  r = await as(A, `select ai_services('1204') s`); t('assistant can list services with owner prices', r.ok && r.rows[0].s.find(x => x.id === 'spa-2').price_for_you === 765000, JSON.stringify(r).slice(0, 200));
  r = await as(A, `select ai_menu('kitchen') m`); t('assistant can list a menu', r.ok && r.rows[0].m.length >= 5);
  await as(A, `select ai_log('1204','user','سلام')`); await as(A, `select ai_log('1204','assistant','سلام! چه خبر؟','{"chips":["a"]}'::jsonb)`);
  r = await as(A, `select ai_history('1204', 10) h`); t('chat history comes back in order', r.ok && r.rows[0].h.length === 2 && r.rows[0].h[0].role === 'user' && r.rows[0].h[1].meta.chips[0] === 'a', JSON.stringify(r).slice(0, 200));
  r = await as(B, `select ai_history('407', 10) h`); t("another resident's chat is not visible", r.ok && r.rows[0].h.length === 0);
  await db.exec(`update app_settings set value='2'::jsonb where key='ai_daily_limit'`);
  await as(A, `select ai_log('1204','user','دوم')`);
  r = await as(A, `select ai_limit_ok('1204') ok`); t('the daily message limit stops further messages', r.ok && r.rows[0].ok === false, JSON.stringify(r));
  r = await as(B, `select ai_limit_ok('407') ok`); t('the limit is per resident', r.ok && r.rows[0].ok === true, JSON.stringify(r));

  r = await as(A, `select * from next_free_slots()`); t('next free slot is listed for every place', r.ok && r.rows.length >= 12, String(r.rows?.length));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
