-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. TEAM MEMBERS
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text not null,
  role text default 'Collaborator',
  avatar text,
  created_at timestamptz default now() not null
);

alter table public.team_members enable row level security;

create policy "Users can perform all actions on their own team members"
  on public.team_members
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. CUSTOM CARDS
create table public.custom_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('process', 'lead')),
  folder_name text not null,
  lead_name text,
  cards_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now() not null,
  constraint unique_user_type_folder_lead unique (user_id, type, folder_name, lead_name)
);

alter table public.custom_cards enable row level security;

create policy "Users can perform all actions on their own custom cards"
  on public.custom_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. ONBOARDING CARDS
create table public.onboarding_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_name text not null,
  cards_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now() not null,
  constraint unique_user_onboarding_folder unique (user_id, folder_name)
);

alter table public.onboarding_cards enable row level security;

create policy "Users can perform all actions on their own onboarding cards"
  on public.onboarding_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. FOLDER ACCESS
create table public.folder_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  view_type text not null check (view_type in ('Process', 'Lead')),
  folder_name text not null,
  member_emails text[] not null default '{}'::text[],
  updated_at timestamptz default now() not null,
  constraint unique_user_view_folder unique (user_id, view_type, folder_name)
);

alter table public.folder_access enable row level security;

create policy "Users can perform all actions on their own folder access"
  on public.folder_access
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. PROCESS LEADS
create table public.process_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stage_name text not null,
  leads text[] not null default '{}'::text[],
  updated_at timestamptz default now() not null,
  constraint unique_user_stage unique (user_id, stage_name)
);

alter table public.process_leads enable row level security;

create policy "Users can perform all actions on their own process leads"
  on public.process_leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. LEAD EMAILS
create table public.lead_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_name text not null,
  email text not null,
  updated_at timestamptz default now() not null,
  constraint unique_user_lead_name unique (user_id, lead_name)
);

alter table public.lead_emails enable row level security;

create policy "Users can perform all actions on their own lead emails"
  on public.lead_emails
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. PROPOSAL THREADS
create table public.proposal_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lead_name text not null,
  thread_id text not null,
  recipient text not null,
  subject text not null,
  sent_at timestamptz default now() not null,
  constraint unique_user_thread_id unique (user_id, thread_id)
);

alter table public.proposal_threads enable row level security;

create policy "Users can perform all actions on their own proposal threads"
  on public.proposal_threads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
