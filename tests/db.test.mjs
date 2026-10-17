// Runs every migration and the seed on a local in-memory Postgres (PGlite) and checks the rules:
// privacy between units, double booking, refunds, payments, manager and admin powers.
// Usage: cd tests && npm install && npm test
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
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
for (const f of ['20261012010000_actions.sql', '20261013000000_manager.sql', '20261017000000_roles.sql']) { await run('migrations/' + f); await run('migrations/' + f); } // twice: must be re-runnable
await db.exec(`grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;`);
await run('seed.sql'); await run('seed.sql');

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', M = '33333333-3333-3333-3333-333333333333', ADM = '44444444-4444-4444-4444-444444444444';
await db.exec(`
  insert into auth.users values ('${A}'),('${B}'),('${M}'),('${ADM}');
  insert into profiles(id,full_name,first_name) values ('${A}','علی','علی'),('${B}','سارا','سارا');
  insert into profiles(id,full_name,first_name,app_role) values ('${M}','مدیر','مدیر','manager'),('${ADM}','مدیر سیستم','مدیر','admin');
  insert into user_units values ('${A}','1204'),('${A}','1408'),('${B}','407');
  update units set balance=0;`);

let pass = 0, fail = 0;
const as = async (uid, sql, params = []) => {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid || ''}',false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return { ok: true, rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};
const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
const bal = async u => Number((await db.query(`select balance from units where code=$1`, [u])).rows[0].balance);
const future = h => new Date(Date.now() + h * 3600e3).toISOString();
let r;

// ---- booking
r = await as(A, `select * from book_slot('1204','spa-2',$1,'account')`, [future(48)]);
t('owner books spa-2', r.ok, r.err);
t('price has 10% owner discount (850000 -> 765000)', r.ok && Number(r.rows[0].price) === 765000);
t('balance went down by 765000', await bal('1204') === -765000);
r = await as(B, `select * from book_slot('407','spa-2',$1,'account')`, [r.rows?.[0]?.starts_at]);
t('second resident cannot take the same slot', !r.ok && /slot_taken/.test(r.err), r.err);
t('failed booking charged nothing', await bal('407') === 0);
r = await as(B, `select * from book_slot('1204','spa-1',$1,'account')`, [future(48)]);
t("cannot book for someone else's unit", !r.ok && /not_your_unit/.test(r.err), r.err);
r = await as(null, `select * from book_slot('1204','spa-1',$1,'account')`, [future(48)]);
t('anonymous cannot call book_slot', !r.ok);
r = await as(A, `select * from book_slot('1204','hk-1',$1,'account')`, [future(5)]);
t('housekeeping needs a day ahead', !r.ok && /needs_day_ahead/.test(r.err), r.err);
r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [future(0.2)]);
t('too-soon booking rejected', !r.ok && /too_soon/.test(r.err), r.err);
r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [future(72)]);
t('free facility booking costs nothing', r.ok && Number(r.rows[0].price) === 0);
t('free booking left balance unchanged', await bal('1204') === -765000);
r = await as(B, `select * from book_slot('407','spa-3',$1,'card')`, [future(100)]);
t('tenant pays full price by card (no discount)', r.ok && Number(r.rows[0].price) === 1200000, r.err);
t('card payment leaves account balance unchanged', await bal('407') === 0);

// ---- privacy
r = await as(B, `select count(*)::int n from bookings`); t('resident B sees only their own bookings', r.rows[0].n === 1);
r = await as(A, `select count(*)::int n from bookings`); t('resident A sees only their own bookings', r.rows[0].n === 2);
r = await as(B, `select count(*)::int n from units`); t('resident B sees only their own unit', r.rows[0].n === 1);
await as(B, `update units set balance=999999999 where code='407'`);
t('resident cannot edit own balance directly', await bal('407') === 0);
r = await as(B, `insert into bookings(unit_code,provider_id,starts_at,price) values ('407','spa-1',now()+interval '3 days',0)`);
t('resident cannot insert a booking directly', !r.ok);
r = await as(B, `insert into transactions(unit_code,title,category,amount) values ('407','x','y',5000000)`);
t('resident cannot insert transactions directly', !r.ok);
await as(B, `update profiles set app_role='manager' where id='${B}'`);
t('resident cannot promote self to manager', (await db.query(`select app_role from profiles where id='${B}'`)).rows[0].app_role === 'resident');
r = await as(B, `select * from taken_slots('spa-2')`);
t('taken_slots shows times only, no unit info', r.ok && r.rows.length === 1 && !('unit_code' in r.rows[0]));

// ---- cancel
const bk = (await db.query(`select id from bookings where unit_code='1204' and provider_id='spa-2'`)).rows[0].id;
r = await as(B, `select cancel_booking('${bk}')`); t("cannot cancel another unit's booking", !r.ok && /not_your_unit/.test(r.err), r.err);
r = await as(A, `select cancel_booking('${bk}') j`); t('cancel >24h ahead refunds full price', r.ok && r.rows[0].j.refunded === 765000, JSON.stringify(r));
t('refund restored the balance', await bal('1204') === 0);
r = await as(A, `select cancel_booking('${bk}')`); t('cannot cancel twice', !r.ok && /not_cancellable/.test(r.err));
await db.exec(`update bookings set starts_at=now()+interval '5 hours' where unit_code='407'`);
const bk2 = (await db.query(`select id from bookings where unit_code='407'`)).rows[0].id;
r = await as(B, `select cancel_booking('${bk2}') j`); t('cancel <24h gives no refund', r.ok && r.rows[0].j.refunded === 0, JSON.stringify(r));
r = await as(B, `select * from book_slot('407','spa-2',$1,'account')`, [(await db.query(`select starts_at from bookings where id='${bk}'`)).rows[0].starts_at]);
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
r = await as(A, `select * from book_slot('1204','spa-4',$1,'account')`, [future(30)]);
const mb = r.rows?.[0]?.id;
t('setup: booking costs 1305000 after discount', Number(r.rows?.[0]?.price) === 1305000, r.err);
r = await as(B, `select set_booking_status('${mb}','done')`); t('resident cannot use manager booking action', !r.ok && /forbidden/.test(r.err));
r = await as(M, `select set_booking_status('${mb}','cancelled') j`); t('manager cancel refunds in full even <48h away', r.ok && r.rows[0].j.refunded === 1305000, r.err);
t('refund restored the unit balance', await bal('1204') === 0);
r = await as(A, `select description from transactions where unit_code='1204' and title='بازگشت وجه' order by created_at desc limit 1`); t('resident sees a refund transaction from the office', r.ok && /مدیریت/.test(r.rows[0]?.description || ''));
r = await as(A, `select title from notifications where unit_code='1204' order by created_at desc limit 1`); t('resident is told the booking was cancelled', r.ok && /توسط مدیریت/.test(r.rows[0]?.title || ''));
r = await as(M, `select set_booking_status('${mb}','done')`); t('cancelled booking cannot be changed again', !r.ok && /not_changeable/.test(r.err));
r = await as(A, `select * from book_slot('1204','sp-1',$1,'account')`, [future(60)]);
r = await as(M, `select set_booking_status('${r.rows?.[0]?.id}','done') j`); t('manager can mark a booking done', r.ok && r.rows[0].j.refunded === 0, r.err);
r = await as(M, `select count(*)::int n from units`); t('manager sees every unit', r.ok && r.rows[0].n === 3, JSON.stringify(r.rows));
r = await as(M, `select count(*)::int n from profiles`); t('manager sees every profile', r.ok && r.rows[0].n === 4, JSON.stringify(r.rows));
r = await as(M, `select * from set_order_status((select id from orders limit 1),'delivered')`); t('manager can mark an order delivered', r.ok && r.rows[0].status === 'delivered', r.err);
r = await as(B, `select * from set_order_status((select id from orders limit 1),'delivered')`); t('resident cannot change an order status', !r.ok && /forbidden/.test(r.err));

// ---- admin role
r = await as(ADM, `select is_manager() m, is_admin() a`); t('admin counts as manager and as admin', r.ok && r.rows[0].m === true && r.rows[0].a === true, JSON.stringify(r));
r = await as(M, `select is_manager() m, is_admin() a`); t('manager is not admin', r.ok && r.rows[0].m === true && r.rows[0].a === false);
r = await as(B, `select is_manager() m, is_admin() a`); t('resident is neither', r.ok && r.rows[0].m === false && r.rows[0].a === false);
r = await as(ADM, `select count(*)::int n from units`); t('admin sees every unit', r.ok && r.rows[0].n === 3);
r = await as(ADM, `select * from set_request_status('${rid}','done')`); t('admin can change request status', r.ok && r.rows[0].status === 'done', r.err);
await as(B, `update profiles set app_role='admin' where id='${B}'`);
t('resident cannot make self admin', (await db.query(`select app_role from profiles where id='${B}'`)).rows[0].app_role === 'resident');
await as(M, `update profiles set app_role='admin' where id='${M}'`);
t('manager cannot make self admin', (await db.query(`select app_role from profiles where id='${M}'`)).rows[0].app_role === 'manager');
try { await db.exec(`insert into auth.users values ('55555555-5555-5555-5555-555555555555'); insert into profiles(id,full_name,first_name,app_role) values ('55555555-5555-5555-5555-555555555555','x','x','superuser')`); t('unknown role is rejected', false, 'accepted'); }
catch { t('unknown role is rejected', true); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
