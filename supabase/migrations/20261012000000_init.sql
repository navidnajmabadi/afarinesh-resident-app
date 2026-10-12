-- Afarinesh resident app: core schema, row-level security and AI tables.
-- Every resident can only read and write rows that belong to their own unit(s).
-- Managers can see the whole building. The AI agent runs as the signed-in user,
-- so it is limited by the same rules.

create extension if not exists pgcrypto;

-- ============ people and units ============
create table public.units (
  code        text primary key,
  tower       text not null default 'آفرینش سبز',
  role        text not null default 'owner' check (role in ('owner','tenant')),
  shares      int  not null default 0,
  balance     bigint not null default 0,          -- toman; negative = debt
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  first_name  text not null,
  email       text,
  app_role    text not null default 'resident' check (app_role in ('resident','manager')),
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.user_units (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  unit_code   text not null references public.units(code) on delete cascade,
  primary key (user_id, unit_code)
);

-- ============ helpers used by every policy ============
create or replace function public.my_units() returns setof text
language sql stable security definer set search_path = public as $$
  select unit_code from public.user_units where user_id = auth.uid()
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select app_role = 'manager' from public.profiles where id = auth.uid()), false)
$$;

-- ============ catalogue ============
create table public.providers (
  id          text primary key,
  category    text not null check (category in ('spa','classes','hk','spaces','carwash')),
  name        text not null,
  description text,
  price       bigint not null default 0,
  rating      numeric(2,1),
  duration_min int not null default 60,
  place       text,
  audience    text[] not null default '{}',
  active      boolean not null default true
);

create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  venue       text not null check (venue in ('cafe','kitchen','carwash')),
  category    text not null,
  name        text not null,
  description text,
  price       bigint not null,
  active      boolean not null default true
);

-- ============ resident activity ============
create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  code        text not null default (floor(random()*90000+10000))::text,
  unit_code   text not null references public.units(code),
  provider_id text not null references public.providers(id),
  starts_at   timestamptz not null,
  status      text not null default 'confirmed' check (status in ('confirmed','done','cancelled')),
  price       bigint not null default 0,
  paid_by     text check (paid_by in ('account','card')),
  note        text,
  source      text not null default 'app' check (source in ('app','assistant')),
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
-- Two people can never hold the same slot.
create unique index bookings_one_per_slot on public.bookings (provider_id, starts_at) where status = 'confirmed';
create index bookings_unit_idx on public.bookings (unit_code, starts_at);

create table public.requests (
  id          uuid primary key default gen_random_uuid(),
  code        text not null default (floor(random()*90000+10000))::text,
  unit_code   text not null references public.units(code),
  kind        text not null check (kind in ('tech','rent','message')),
  type        text not null,
  description text not null,
  urgency     text not null default 'normal' check (urgency in ('low','normal','high')),
  status      text not null default 'received' check (status in ('received','assigned','in_progress','done','cancelled')),
  assignee    text,
  photos      text[] not null default '{}',
  source      text not null default 'app' check (source in ('app','assistant')),
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index requests_unit_idx on public.requests (unit_code, created_at desc);

create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  code        text not null default (floor(random()*90000+10000))::text,
  unit_code   text not null references public.units(code),
  venue       text not null check (venue in ('cafe','kitchen','carwash')),
  items       jsonb not null,                       -- [{name, qty, price}]
  total       bigint not null,
  delivery    text not null default 'unit',
  status      text not null default 'preparing' check (status in ('preparing','delivered','cancelled')),
  source      text not null default 'app' check (source in ('app','assistant')),
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null default (floor(random()*90000+10000))::text,
  unit_code   text not null references public.units(code),
  title       text not null,
  category    text not null,
  amount      bigint not null,                      -- negative = charge, positive = payment/refund
  description text,
  created_at  timestamptz not null default now()
);
create index transactions_unit_idx on public.transactions (unit_code, created_at desc);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  unit_code   text not null references public.units(code),
  title       text not null,
  body        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============ AI assistant ============
-- What the assistant remembers about a unit (usual class, café order, preferred times...).
create table public.ai_memory (
  unit_code   text not null references public.units(code) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (unit_code, key)
);

-- Every action the assistant wants to take waits here until the resident approves it.
create table public.ai_proposals (
  id          uuid primary key default gen_random_uuid(),
  unit_code   text not null references public.units(code),
  user_id     uuid not null references auth.users(id) default auth.uid(),
  action      text not null check (action in ('book','cancel_booking','order','create_request','pay','send_report')),
  params      jsonb not null,
  summary     text not null,                        -- the confirm-card text shown to the resident
  status      text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create table public.ai_messages (
  id          uuid primary key default gen_random_uuid(),
  unit_code   text not null references public.units(code) on delete cascade,
  user_id     uuid not null references auth.users(id) default auth.uid(),
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ============ row-level security ============
alter table public.units         enable row level security;
alter table public.profiles      enable row level security;
alter table public.user_units    enable row level security;
alter table public.providers     enable row level security;
alter table public.menu_items    enable row level security;
alter table public.bookings      enable row level security;
alter table public.requests      enable row level security;
alter table public.orders        enable row level security;
alter table public.transactions  enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_memory     enable row level security;
alter table public.ai_proposals  enable row level security;
alter table public.ai_messages   enable row level security;

create policy "own profile"        on public.profiles   for select using (id = auth.uid() or public.is_manager());
create policy "update own profile" on public.profiles   for update using (id = auth.uid()) with check (id = auth.uid() and app_role = (select app_role from public.profiles where id = auth.uid()));
create policy "own unit links"     on public.user_units for select using (user_id = auth.uid() or public.is_manager());
create policy "own units"          on public.units      for select using (code in (select public.my_units()) or public.is_manager());
-- No update policy on units: balances only change through server functions.

create policy "catalogue readable" on public.providers  for select to authenticated using (true);
create policy "menu readable"      on public.menu_items for select to authenticated using (true);

create policy "unit bookings read"   on public.bookings for select using (unit_code in (select public.my_units()) or public.is_manager());
create policy "unit bookings insert" on public.bookings for insert with check (unit_code in (select public.my_units()));
create policy "unit bookings update" on public.bookings for update using (unit_code in (select public.my_units()) or public.is_manager());

create policy "unit requests read"   on public.requests for select using (unit_code in (select public.my_units()) or public.is_manager());
create policy "unit requests insert" on public.requests for insert with check (unit_code in (select public.my_units()));
create policy "manager updates requests" on public.requests for update using (public.is_manager());

create policy "unit orders read"     on public.orders for select using (unit_code in (select public.my_units()) or public.is_manager());
create policy "unit orders insert"   on public.orders for insert with check (unit_code in (select public.my_units()));

create policy "unit transactions read" on public.transactions for select using (unit_code in (select public.my_units()) or public.is_manager());
create policy "unit notifications"     on public.notifications for select using (unit_code in (select public.my_units()) or public.is_manager());
create policy "mark notifications read" on public.notifications for update using (unit_code in (select public.my_units()));

create policy "unit memory read"     on public.ai_memory   for select using (unit_code in (select public.my_units()));
create policy "unit memory write"    on public.ai_memory   for all using (unit_code in (select public.my_units())) with check (unit_code in (select public.my_units()));
create policy "own proposals read"   on public.ai_proposals for select using (user_id = auth.uid());
create policy "own proposals decide" on public.ai_proposals for update using (user_id = auth.uid() and status = 'pending') with check (status in ('approved','rejected'));
create policy "own chat read"        on public.ai_messages for select using (user_id = auth.uid());
create policy "own chat write"       on public.ai_messages for insert with check (user_id = auth.uid() and unit_code in (select public.my_units()));

-- Live updates for the screens that change while the resident watches.
alter publication supabase_realtime add table public.requests, public.orders, public.bookings, public.notifications, public.ai_proposals;
