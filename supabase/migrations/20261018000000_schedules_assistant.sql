-- Real opening hours and capacity for every place and service, plus everything the assistant (آف‌بات) needs:
--   * slots are generated from opening hours; a slot holds as many bookings as its capacity
--   * the assistant creates a "proposal"; the resident approves it; approval runs the same checked functions as the buttons
--   * while a proposal is pending, its slot is held for 3 minutes so nobody else can take it
-- Safe to run more than once.

-- ============ schedules ============
alter table public.providers
  add column if not exists open_time  time not null default '09:00',
  add column if not exists close_time time not null default '18:00',
  add column if not exists open_days  int[] not null default '{1,2,3,4,5,6,7}',     -- ISO weekdays: 1 = Monday … 7 = Sunday
  add column if not exists capacity   int  not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'providers_capacity_check') then
    alter table public.providers add constraint providers_capacity_check check (capacity >= 1);
  end if;
end $$;

update public.providers p set open_time = v.o::time, close_time = v.c::time, duration_min = v.d, capacity = v.k
from (values
  ('spa-1','09:00','18:00',60,1),  ('spa-2','09:00','18:00',60,1),  ('spa-3','09:00','18:00',90,1),  ('spa-4','10:00','21:00',60,1),
  ('cl-1','17:00','19:00',60,12),  ('cl-2','16:00','20:00',60,6),   ('cl-3','07:00','21:00',60,1),   ('cl-4','15:00','20:00',60,1),
  ('hk-1','08:00','18:00',300,1),  ('hk-2','08:00','18:00',180,2),
  ('sp-1','06:00','22:00',60,6),   ('sp-2','10:00','22:00',240,1),  ('sp-3','07:00','23:00',60,1),   ('sp-4','08:00','22:00',120,4)
) as v(id,o,c,d,k) where p.id = v.id;

-- ============ assistant tables ============
alter table public.ai_proposals add column if not exists expires_at timestamptz not null default now() + interval '3 minutes';
alter table public.ai_proposals add column if not exists result jsonb;
alter table public.ai_messages  add column if not exists meta jsonb;
-- Proposals change state only through the functions below.
drop policy if exists "own proposals decide" on public.ai_proposals;
insert into public.app_settings values ('ai_daily_limit', '80'::jsonb) on conflict do nothing;

-- A slot may now hold several bookings, so the one-booking-per-slot index goes.
drop index if exists public.bookings_one_per_slot;

-- ============ slots ============
-- Every start time a place offers in a date range, from its opening hours (Tehran time).
create or replace function public.provider_slot_times(p_provider text, p_from date, p_days int)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select ((g.d::date + make_interval(mins => m))::timestamp at time zone 'Asia/Tehran')
  from public.providers p,
       generate_series(p_from::timestamp, (p_from + (greatest(p_days,1) - 1))::timestamp, interval '1 day') g(d),
       generate_series((extract(epoch from p.open_time)/60)::int, (extract(epoch from p.close_time)/60)::int - p.duration_min, p.duration_min) m
  where p.id = p_provider and p.active and extract(isodow from g.d)::int = any (p.open_days)
$$;

-- How many places of a slot are used: confirmed bookings, plus other people's pending proposals (the 3-minute hold).
create or replace function public.slot_load(p_provider text, p_starts timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.bookings b where b.provider_id = p_provider and b.starts_at = p_starts and b.status = 'confirmed')::int
       + (select count(*) from public.ai_proposals a
          where a.action = 'book' and a.status = 'pending' and a.expires_at > now()
            and a.user_id is distinct from auth.uid()
            and a.params->>'provider_id' = p_provider and (a.params->>'starts_at')::timestamptz = p_starts)::int
$$;

create or replace function public.available_slots(p_provider text, p_from date default null, p_days int default 7)
returns table (starts_at timestamptz, capacity int, free int)
language plpgsql stable security definer set search_path = public as $$
declare v_cat text; v_cap int; v_from date; v_min interval;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select category, providers.capacity into v_cat, v_cap from public.providers where id = p_provider and active;
  if not found then return; end if;
  v_from := coalesce(p_from, (now() at time zone 'Asia/Tehran')::date);
  v_min := case when v_cat = 'hk' then interval '24 hours' else interval '1 hour' end;
  return query
    select s.starts_at, v_cap, greatest(v_cap - public.slot_load(p_provider, s.starts_at), 0)
    from public.provider_slot_times(p_provider, v_from, least(coalesce(p_days, 7), 21)) s
    where s.starts_at > now() + v_min
    order by s.starts_at;
end $$;

-- The earliest slot with room, for every place (used for «first free time» on the cards).
create or replace function public.next_free_slots() returns table (provider_id text, starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare r record; v timestamptz;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  for r in select id from public.providers where active loop
    select s.starts_at into v from public.available_slots(r.id, null, 7) s where s.free > 0 order by s.starts_at limit 1;
    if v is not null then provider_id := r.id; starts_at := v; return next; end if;
  end loop;
end $$;

-- Raises a clear error unless this exact slot can be booked right now.
create or replace function public.check_slot(p_provider text, p_starts timestamptz) returns public.providers
language plpgsql stable security definer set search_path = public as $$
declare v_prov public.providers;
begin
  select * into v_prov from public.providers where id = p_provider and active;
  if not found then raise exception 'provider_not_found'; end if;
  if p_starts < now() + interval '1 hour' then raise exception 'too_soon'; end if;
  if v_prov.category = 'hk' and p_starts < now() + interval '24 hours' then raise exception 'needs_day_ahead'; end if;
  if not exists (select 1 from public.provider_slot_times(p_provider, (p_starts at time zone 'Asia/Tehran')::date, 1) s where s.starts_at = p_starts) then
    raise exception 'bad_slot';
  end if;
  if public.slot_load(p_provider, p_starts) >= v_prov.capacity then raise exception 'slot_taken'; end if;
  return v_prov;
end $$;

-- ============ booking (now capacity aware) ============
create or replace function public.book_slot(p_unit text, p_provider text, p_starts timestamptz,
  p_pay text default 'account', p_note text default null, p_source text default 'app')
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_prov public.providers; v_unit public.units; v_price bigint; v_disc bigint := 0; v_b public.bookings;
begin
  perform public.assert_my_unit(p_unit);
  if p_pay not in ('account','card') then raise exception 'bad_payment'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider || '|' || extract(epoch from p_starts)::text, 0));
  v_prov := public.check_slot(p_provider, p_starts);
  if exists (select 1 from public.bookings b where b.unit_code = p_unit and b.provider_id = p_provider and b.starts_at = p_starts and b.status = 'confirmed') then
    raise exception 'already_booked';
  end if;

  select * into v_unit from public.units where code = p_unit for update;
  v_price := v_prov.price;
  if v_unit.role = 'owner' and v_price > 0 then v_disc := round(v_price * 0.1); end if;
  v_price := v_price - v_disc;

  insert into public.bookings (unit_code, provider_id, starts_at, price, paid_by, note, source)
  values (p_unit, p_provider, p_starts, v_price, case when v_price > 0 then p_pay end, p_note, p_source)
  returning * into v_b;

  if v_price > 0 then
    insert into public.transactions (unit_code, title, category, amount, description)
    values (p_unit, v_prov.name, public.category_label(v_prov.category), -v_price,
            'رزرو ' || v_prov.name || case when v_disc > 0 then ' با ۱۰٪ تخفیف مالکین' else '' end);
    if p_pay = 'account' then
      update public.units set balance = balance - v_price where code = p_unit;
    else
      insert into public.transactions (unit_code, title, category, amount, description)
      values (p_unit, 'پرداخت با کارت', 'واریز', v_price, 'پرداخت آنلاین بابت ' || v_prov.name);
    end if;
  end if;
  insert into public.notifications (unit_code, title, body) values (p_unit, 'رزرو قطعی شد', v_prov.name);
  return v_b;
end $$;

-- ============ orders: one price calculation for the quote and for the real order ============
create or replace function public.quote_order(p_unit text, p_venue text, p_items jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e jsonb; m public.menu_items; v_qty int; v_total bigint := 0; v_n int := 0; v_disc bigint := 0; v_lines jsonb := '[]'::jsonb;
begin
  perform public.assert_my_unit(p_unit);
  if p_venue not in ('cafe','kitchen','carwash') then raise exception 'bad_venue'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    v_qty := (e->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then raise exception 'bad_quantity'; end if;
    select * into m from public.menu_items where id = (e->>'id')::uuid and venue = p_venue and active;
    if not found then raise exception 'item_not_found'; end if;
    v_total := v_total + m.price * v_qty;
    v_n := v_n + v_qty;
    v_lines := v_lines || jsonb_build_object('name', m.name, 'qty', v_qty, 'price', m.price);
  end loop;
  if p_venue = 'kitchen' and v_n >= 30 then v_disc := round(v_total * 0.1); end if;
  return jsonb_build_object('lines', v_lines, 'qty', v_n, 'subtotal', v_total, 'discount', v_disc, 'total', v_total - v_disc);
end $$;

create or replace function public.place_order(p_unit text, p_venue text, p_items jsonb,
  p_delivery text default 'unit', p_source text default 'app')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare q jsonb; v_o public.orders; v_title text;
begin
  perform public.assert_my_unit(p_unit);
  q := public.quote_order(p_unit, p_venue, p_items);
  v_title := case p_venue when 'cafe' then 'کافی‌شاپ' when 'kitchen' then 'آشپزخانه' else 'کارواش' end;
  perform 1 from public.units where code = p_unit for update;
  insert into public.orders (unit_code, venue, items, total, delivery, source)
  values (p_unit, p_venue, q->'lines', (q->>'total')::bigint, p_delivery, p_source) returning * into v_o;
  update public.units set balance = balance - (q->>'total')::bigint where code = p_unit;
  insert into public.transactions (unit_code, title, category, amount, description)
  values (p_unit, v_title, case when p_venue = 'carwash' then 'کارواش' else 'غذا و کافه' end, -(q->>'total')::bigint,
          (select string_agg((l->>'name') || ' ×' || (l->>'qty'), '، ') from jsonb_array_elements(q->'lines') l)
          || case when (q->>'discount')::bigint > 0 then ' · ۱۰٪ تخفیف' else '' end);
  insert into public.notifications (unit_code, title, body) values (p_unit, 'سفارش ثبت شد', v_title);
  return v_o;
end $$;

-- ============ proposals: what the assistant may ask the resident to approve ============
create or replace function public.create_proposal(p_unit text, p_action text, p_params jsonb, p_summary text)
returns public.ai_proposals
language plpgsql security definer set search_path = public as $$
declare v_p public.ai_proposals; v_starts timestamptz;
begin
  perform public.assert_my_unit(p_unit);
  if p_action not in ('book','order','create_request') then raise exception 'bad_action'; end if;
  if p_summary is null or length(p_summary) < 3 then raise exception 'bad_summary'; end if;
  -- one open proposal at a time: older ones lapse (and their hold ends)
  update public.ai_proposals set status = 'expired', decided_at = now() where user_id = auth.uid() and status = 'pending';
  if p_action = 'book' then
    v_starts := (p_params->>'starts_at')::timestamptz;
    perform public.check_slot(p_params->>'provider_id', v_starts);
    p_params := jsonb_build_object('provider_id', p_params->>'provider_id',
                                   'starts_at', to_char(v_starts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                   'pay', coalesce(nullif(p_params->>'pay',''), 'account'), 'note', p_params->>'note');
  elsif p_action = 'order' then
    perform public.quote_order(p_unit, p_params->>'venue', p_params->'items');
    p_params := jsonb_build_object('venue', p_params->>'venue', 'items', p_params->'items', 'delivery', coalesce(nullif(p_params->>'delivery',''), 'unit'));
  else
    if p_params->>'kind' not in ('tech','rent','message') then raise exception 'bad_kind'; end if;
    if length(coalesce(p_params->>'description','')) < 5 then raise exception 'bad_description'; end if;
    p_params := jsonb_build_object('kind', p_params->>'kind', 'type', coalesce(nullif(p_params->>'type',''), 'درخواست'),
                                   'description', left(p_params->>'description', 1500), 'urgency', coalesce(nullif(p_params->>'urgency',''), 'normal'));
  end if;
  insert into public.ai_proposals (unit_code, user_id, action, params, summary)
  values (p_unit, auth.uid(), p_action, p_params, left(p_summary, 600)) returning * into v_p;
  return v_p;
end $$;

create or replace function public.approve_proposal(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p public.ai_proposals; v_res jsonb; v_b public.bookings; v_o public.orders; v_r public.requests;
begin
  select * into v_p from public.ai_proposals where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if v_p.status <> 'pending' then raise exception 'not_pending'; end if;
  if v_p.expires_at < now() then
    update public.ai_proposals set status = 'expired', decided_at = now() where id = p_id;
    return jsonb_build_object('kind', 'expired');
  end if;
  if v_p.action = 'book' then
    select * into v_b from public.book_slot(v_p.unit_code, v_p.params->>'provider_id', (v_p.params->>'starts_at')::timestamptz,
                                            v_p.params->>'pay', v_p.params->>'note', 'assistant');
    v_res := jsonb_build_object('kind', 'booking', 'id', v_b.id, 'code', v_b.code, 'starts_at', v_b.starts_at, 'price', v_b.price);
  elsif v_p.action = 'order' then
    select * into v_o from public.place_order(v_p.unit_code, v_p.params->>'venue', v_p.params->'items', v_p.params->>'delivery', 'assistant');
    v_res := jsonb_build_object('kind', 'order', 'id', v_o.id, 'code', v_o.code, 'total', v_o.total);
  else
    insert into public.requests (unit_code, kind, type, description, urgency, source)
    values (v_p.unit_code, v_p.params->>'kind', v_p.params->>'type', v_p.params->>'description', v_p.params->>'urgency', 'assistant')
    returning * into v_r;
    v_res := jsonb_build_object('kind', 'request', 'id', v_r.id, 'code', v_r.code);
  end if;
  update public.ai_proposals set status = 'approved', decided_at = now(), result = v_res where id = p_id;
  return v_res;
end $$;

create or replace function public.reject_proposal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ai_proposals set status = 'rejected', decided_at = now()
  where id = p_id and user_id = auth.uid() and status = 'pending';
end $$;

-- ============ read helpers for the assistant (each one checks that the unit is yours) ============
create or replace function public.ai_account(p_unit text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u public.units;
begin
  perform public.assert_my_unit(p_unit);
  select * into u from public.units where code = p_unit;
  return jsonb_build_object('name', (select first_name from public.profiles where id = auth.uid()), 'unit', u.code, 'role', u.role, 'shares', u.shares, 'balance', u.balance,
    'recent_transactions', (select coalesce(jsonb_agg(jsonb_build_object('title', t.title, 'category', t.category, 'amount', t.amount, 'at', t.created_at) order by t.created_at desc), '[]'::jsonb)
                            from (select * from public.transactions where unit_code = p_unit order by created_at desc limit 6) t),
    'upcoming_bookings', (select coalesce(jsonb_agg(jsonb_build_object('what', pr.name, 'place', pr.place, 'starts_at', b.starts_at, 'price', b.price, 'code', b.code) order by b.starts_at), '[]'::jsonb)
                          from (select * from public.bookings where unit_code = p_unit and status = 'confirmed' and starts_at > now() order by starts_at limit 6) b
                          join public.providers pr on pr.id = b.provider_id),
    'open_requests', (select coalesce(jsonb_agg(jsonb_build_object('type', r.type, 'status', r.status, 'code', r.code, 'assignee', r.assignee) order by r.created_at desc), '[]'::jsonb)
                      from (select * from public.requests where unit_code = p_unit and status in ('received','assigned','in_progress') order by created_at desc limit 6) r),
    'active_orders', (select coalesce(jsonb_agg(jsonb_build_object('venue', o.venue, 'total', o.total, 'status', o.status, 'code', o.code)), '[]'::jsonb)
                      from (select * from public.orders where unit_code = p_unit and status = 'preparing' order by created_at desc limit 6) o));
end $$;

create or replace function public.ai_services(p_unit text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean;
begin
  perform public.assert_my_unit(p_unit);
  select role = 'owner' into v_owner from public.units where code = p_unit;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'name', name, 'description', description,
            'price_for_you', case when v_owner and price > 0 then price - round(price * 0.1) else price end,
            'minutes', duration_min, 'place', place, 'audience', audience, 'capacity', capacity,
            'hours', to_char(open_time, 'HH24:MI') || '-' || to_char(close_time, 'HH24:MI'), 'rating', rating) order by category, name), '[]'::jsonb)
          from public.providers where active);
end $$;

create or replace function public.ai_menu(p_venue text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'name', name, 'description', description, 'price', price) order by position), '[]'::jsonb)
  from public.menu_items where venue = p_venue and active and auth.uid() is not null
$$;

create or replace function public.ai_history(p_unit text, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_my_unit(p_unit);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'role', m.role, 'content', m.content, 'meta', m.meta, 'at', m.created_at) order by m.created_at), '[]'::jsonb)
          from (select * from public.ai_messages where user_id = auth.uid() and unit_code = p_unit order by created_at desc limit least(p_limit, 100)) m);
end $$;

create or replace function public.ai_log(p_unit text, p_role text, p_content text, p_meta jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_my_unit(p_unit);
  if p_role not in ('user','assistant') then raise exception 'bad_role'; end if;
  insert into public.ai_messages (unit_code, user_id, role, content, meta) values (p_unit, auth.uid(), p_role, left(p_content, 6000), p_meta) returning id into v_id;
  return v_id;
end $$;

create or replace function public.ai_limit_ok(p_unit text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_limit int;
begin
  perform public.assert_my_unit(p_unit);
  select coalesce((value)::text::int, 80) into v_limit from public.app_settings where key = 'ai_daily_limit';
  return (select count(*) from public.ai_messages where user_id = auth.uid() and role = 'user' and created_at > now() - interval '1 day') < coalesce(v_limit, 80);
end $$;

-- ============ who may call what ============
do $$ declare f text; begin
  foreach f in array array[
    'provider_slot_times(text,date,int)','slot_load(text,timestamptz)','available_slots(text,date,int)','next_free_slots()','check_slot(text,timestamptz)',
    'book_slot(text,text,timestamptz,text,text,text)','quote_order(text,text,jsonb)','place_order(text,text,jsonb,text,text)',
    'create_proposal(text,text,jsonb,text)','approve_proposal(uuid)','reject_proposal(uuid)',
    'ai_account(text)','ai_services(text)','ai_menu(text)','ai_history(text,int)','ai_log(text,text,text,jsonb)','ai_limit_ok(text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
