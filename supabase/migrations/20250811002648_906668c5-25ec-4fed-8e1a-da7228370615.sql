-- Create a reusable trigger function for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PROFILES table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  primary_website_id uuid,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- updated_at trigger
create or replace trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- WEBSITES table
create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  url text not null,
  gbp_place_id text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists websites_owner_url_unique on public.websites(owner_user_id, url);

alter table public.websites enable row level security;

create or replace trigger set_websites_updated_at
before update on public.websites
for each row execute function public.set_updated_at();

-- Add FK from profiles.primary_website_id to websites.id
alter table public.profiles
  drop constraint if exists profiles_primary_website_fk,
  add constraint profiles_primary_website_fk
  foreign key (primary_website_id) references public.websites(id) on delete set null;

-- AUDITS table (basic scaffold for the Auditor module)
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audits_website_id_idx on public.audits(website_id);

alter table public.audits enable row level security;

create or replace trigger set_audits_updated_at
before update on public.audits
for each row execute function public.set_updated_at();

-- RLS Policies
-- Profiles: users can access only their own row
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Websites: owner has full CRUD
create policy "Owners can select own websites"
  on public.websites for select
  to authenticated
  using (auth.uid() = owner_user_id);

create policy "Owners can insert websites"
  on public.websites for insert
  to authenticated
  with check (auth.uid() = owner_user_id);

create policy "Owners can update own websites"
  on public.websites for update
  to authenticated
  using (auth.uid() = owner_user_id);

create policy "Owners can delete own websites"
  on public.websites for delete
  to authenticated
  using (auth.uid() = owner_user_id);

-- Audits: accessible only if user owns the parent website
create policy "Owners can select audits for own websites"
  on public.audits for select
  to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_id and w.owner_user_id = auth.uid()
    )
  );

create policy "Owners can insert audits for own websites"
  on public.audits for insert
  to authenticated
  with check (
    exists (
      select 1 from public.websites w
      where w.id = website_id and w.owner_user_id = auth.uid()
    )
  );

create policy "Owners can update audits for own websites"
  on public.audits for update
  to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_id and w.owner_user_id = auth.uid()
    )
  );

create policy "Owners can delete audits for own websites"
  on public.audits for delete
  to authenticated
  using (
    exists (
      select 1 from public.websites w
      where w.id = website_id and w.owner_user_id = auth.uid()
    )
  );
