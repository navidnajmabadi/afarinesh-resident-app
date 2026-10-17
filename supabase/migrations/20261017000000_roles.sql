-- Adds the admin role. An admin can do everything a manager can; later steps give admins
-- the screens to add and edit spaces, menus and residents.
do $$ declare c text; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%app_role%'
  loop execute format('alter table public.profiles drop constraint %I', c); end loop;
end $$;
alter table public.profiles add constraint profiles_app_role_check check (app_role in ('resident','manager','admin'));

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select app_role in ('manager','admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select app_role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
