-- Server-side actions. Residents never write bookings, orders or balances directly;
-- they call these functions, which check the unit, the price and the slot.
-- The AI assistant will call the very same functions, as the signed-in resident.

alter table public.profiles   add column if not exists prefs jsonb not null default '{}'::jsonb;
alter table public.menu_items add column if not exists position int not null default 0;

create table if not exists public.app_settings (key text primary key, value jsonb not null);
alter table public.app_settings enable row level security;
drop policy if exists "settings readable" on public.app_settings;
create policy "settings readable" on public.app_settings for select to authenticated using (true);
-- Payments below are simulated until a real gateway is connected. Set to false to switch them off.
insert into public.app_settings values ('demo_payments', 'true'::jsonb) on conflict do nothing;

-- Close the direct-write paths from migration 1.
drop policy if exists "unit bookings insert" on public.bookings;
drop policy if exists "unit bookings update" on public.bookings;
drop policy if exists "unit orders insert"   on public.orders;
drop policy if exists "manager updates bookings" on public.bookings;
create policy "manager updates bookings" on public.bookings for update using (public.is_manager());
drop policy if exists "manager updates orders" on public.orders;
create policy "manager updates orders"   on public.orders   for update using (public.is_manager());

-- ============ helpers ============
create or replace function public.assert_my_unit(p_unit text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or p_unit is null or p_unit not in (select public.my_units()) then
    raise exception 'not_your_unit' using errcode = '42501';
  end if;
end $$;

create or replace function public.category_label(c text) returns text
language sql immutable as $$
  select case c when 'spa' then 'اسپا و زیبایی' when 'classes' then 'ورزش و کلاس' when 'hk' then 'خانه‌داری'
                when 'spaces' then 'رزرو فضا' when 'carwash' then 'کارواش' else 'خدمات' end
$$;

-- Which slots are already taken. Returns only provider and time, never who booked.
create or replace function public.taken_slots(p_provider text default null, p_from timestamptz default now(), p_to timestamptz default now() + interval '14 days')
returns table (provider_id text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.provider_id, b.starts_at from public.bookings b
  where auth.uid() is not null and b.status = 'confirmed'
    and b.starts_at between p_from and p_to
    and (p_provider is null or b.provider_id = p_provider)
$$;

-- ============ booking ============
create or replace function public.book_slot(p_unit text, p_provider text, p_starts timestamptz,
  p_pay text default 'account', p_note text default null, p_source text default 'app')
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_prov public.providers; v_unit public.units; v_price bigint; v_disc bigint := 0; v_b public.bookings;
begin
  perform public.assert_my_unit(p_unit);
  select * into v_prov from public.providers where id = p_provider and active;
  if not found then raise exception 'provider_not_found'; end if;
  if p_starts < now() + interval '1 hour' then raise exception 'too_soon'; end if;
  if v_prov.category = 'hk' and p_starts < now() + interval '24 hours' then raise exception 'needs_day_ahead'; end if;
  if p_pay not in ('account','card') then raise exception 'bad_payment'; end if;

  select * into v_unit from public.units where code = p_unit for update;
  v_price := v_prov.price;
  if v_unit.role = 'owner' and v_price > 0 then v_disc := round(v_price * 0.1); end if;
  v_price := v_price - v_disc;

  begin
    insert into public.bookings (unit_code, provider_id, starts_at, price, paid_by, note, source)
    values (p_unit, p_provider, p_starts, v_price, case when v_price > 0 then p_pay end, p_note, p_source)
    returning * into v_b;
  exception when unique_violation then
    raise exception 'slot_taken';
  end;

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

create or replace function public.cancel_booking(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_refund bigint := 0;
begin
  select * into v_b from public.bookings where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_my_unit(v_b.unit_code);
  if v_b.status <> 'confirmed' then raise exception 'not_cancellable'; end if;
  update public.bookings set status = 'cancelled' where id = p_id;
  if v_b.price > 0 and v_b.starts_at - now() >= interval '24 hours' then
    v_refund := v_b.price;
    if v_b.paid_by = 'account' then
      update public.units set balance = balance + v_refund where code = v_b.unit_code;
    end if;
    insert into public.transactions (unit_code, title, category, amount, description)
    values (v_b.unit_code, 'بازگشت وجه', 'بازگشت وجه', v_refund,
            case when v_b.paid_by = 'card' then 'به کارت پرداخت‌کننده برگشت داده شد' else 'به حساب واحد برگشت داده شد' end);
  end if;
  insert into public.notifications (unit_code, title, body) values (v_b.unit_code, 'رزرو لغو شد', null);
  return jsonb_build_object('refunded', v_refund);
end $$;

-- ============ orders ============
create or replace function public.place_order(p_unit text, p_venue text, p_items jsonb,
  p_delivery text default 'unit', p_source text default 'app')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare e jsonb; m public.menu_items; v_qty int; v_total bigint := 0; v_n int := 0; v_disc bigint := 0;
        v_lines jsonb := '[]'::jsonb; v_o public.orders; v_title text;
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
  v_total := v_total - v_disc;
  v_title := case p_venue when 'cafe' then 'کافی‌شاپ' when 'kitchen' then 'آشپزخانه' else 'کارواش' end;

  perform 1 from public.units where code = p_unit for update;
  insert into public.orders (unit_code, venue, items, total, delivery, source)
  values (p_unit, p_venue, v_lines, v_total, p_delivery, p_source) returning * into v_o;
  update public.units set balance = balance - v_total where code = p_unit;
  insert into public.transactions (unit_code, title, category, amount, description)
  values (p_unit, v_title, case when p_venue = 'carwash' then 'کارواش' else 'غذا و کافه' end, -v_total,
          (select string_agg((l->>'name') || ' ×' || (l->>'qty'), '، ') from jsonb_array_elements(v_lines) l)
          || case when v_disc > 0 then ' · ۱۰٪ تخفیف' else '' end);
  insert into public.notifications (unit_code, title, body) values (p_unit, 'سفارش ثبت شد', v_title);
  return v_o;
end $$;

-- ============ payment (simulated until a real gateway is connected) ============
create or replace function public.make_payment(p_unit text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  perform public.assert_my_unit(p_unit);
  if coalesce((select (value)::text = 'true' from public.app_settings where key = 'demo_payments'), false) is not true then
    raise exception 'payments_disabled';
  end if;
  if p_amount is null or p_amount < 10000 or p_amount > 10000000000 then raise exception 'bad_amount'; end if;
  update public.units set balance = balance + p_amount where code = p_unit returning balance into v_bal;
  insert into public.transactions (unit_code, title, category, amount, description)
  values (p_unit, 'پرداخت آنلاین', 'واریز', p_amount, 'پرداخت از درگاه بانکی (نسخه آزمایشی)');
  insert into public.notifications (unit_code, title, body) values (p_unit, 'پرداخت موفق', null);
  return v_bal;
end $$;

-- ============ manager actions ============
create or replace function public.set_request_status(p_id uuid, p_status text, p_assignee text default null)
returns public.requests
language plpgsql security definer set search_path = public as $$
declare v_r public.requests;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('received','assigned','in_progress','done','cancelled') then raise exception 'bad_status'; end if;
  update public.requests set status = p_status, assignee = coalesce(p_assignee, assignee) where id = p_id returning * into v_r;
  if not found then raise exception 'not_found'; end if;
  insert into public.notifications (unit_code, title, body) values (v_r.unit_code,
    case p_status when 'assigned' then 'درخواست شما ارجاع شد' when 'in_progress' then 'کار درخواست شما شروع شد'
                  when 'done' then 'درخواست شما انجام شد' else 'وضعیت درخواست تغییر کرد' end, v_r.type);
  return v_r;
end $$;

create or replace function public.set_order_status(p_id uuid, p_status text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare v_o public.orders;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('preparing','delivered','cancelled') then raise exception 'bad_status'; end if;
  update public.orders set status = p_status where id = p_id returning * into v_o;
  if not found then raise exception 'not_found'; end if;
  insert into public.notifications (unit_code, title, body) values (v_o.unit_code,
    case p_status when 'delivered' then 'سفارش شما تحویل شد' else 'وضعیت سفارش تغییر کرد' end, null);
  return v_o;
end $$;

-- Only signed-in users may call any of these.
revoke all on function public.assert_my_unit(text) from public, anon;
revoke all on function public.taken_slots(text, timestamptz, timestamptz) from public, anon;
revoke all on function public.book_slot(text, text, timestamptz, text, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.place_order(text, text, jsonb, text, text) from public, anon;
revoke all on function public.make_payment(text, bigint) from public, anon;
revoke all on function public.set_request_status(uuid, text, text) from public, anon;
revoke all on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.taken_slots(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.book_slot(text, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.place_order(text, text, jsonb, text, text) to authenticated;
grant execute on function public.make_payment(text, bigint) to authenticated;
grant execute on function public.set_request_status(uuid, text, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
