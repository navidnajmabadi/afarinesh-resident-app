-- Manager action for bookings. Managers can also read every unit through the policies in migration 1.
-- Mark a booking done, or cancel it (staff cancellation always refunds in full).
create or replace function public.set_booking_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_refund bigint := 0; v_name text;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('done','cancelled') then raise exception 'bad_status'; end if;
  select * into v_b from public.bookings where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_b.status <> 'confirmed' then raise exception 'not_changeable'; end if;
  update public.bookings set status = p_status where id = p_id;
  if p_status = 'cancelled' then
    select name into v_name from public.providers where id = v_b.provider_id;
    if v_b.price > 0 then
      v_refund := v_b.price;
      if v_b.paid_by = 'account' then
        update public.units set balance = balance + v_refund where code = v_b.unit_code;
      end if;
      insert into public.transactions (unit_code, title, category, amount, description)
      values (v_b.unit_code, 'بازگشت وجه', 'بازگشت وجه', v_refund,
              'لغو رزرو توسط مدیریت' || case when v_b.paid_by = 'card' then ' · به کارت برگشت داده شد' else ' · به حساب واحد برگشت داده شد' end);
    end if;
    insert into public.notifications (unit_code, title, body) values (v_b.unit_code, 'رزرو شما توسط مدیریت لغو شد', v_name);
  end if;
  return jsonb_build_object('refunded', v_refund);
end $$;

revoke all on function public.set_booking_status(uuid, text) from public, anon;
grant execute on function public.set_booking_status(uuid, text) to authenticated;
