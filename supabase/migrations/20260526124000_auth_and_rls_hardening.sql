-- Authentication + per-user data isolation hardening

-- 1) Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill for existing users
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- 3) Reports ownership hardening
alter table public.reports alter column user_id set default auth.uid();

-- Keep nullable to avoid breaking legacy rows created before auth rollout.
-- RLS policies below enforce user-scoped access for all new app interactions.

-- 4) Chat message ownership
alter table public.chat_messages add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.chat_messages alter column user_id set default auth.uid();

-- 5) Remove permissive legacy policies
drop policy if exists "anyone can read reports" on public.reports;
drop policy if exists "anyone can insert reports" on public.reports;
drop policy if exists "anyone can update reports" on public.reports;
drop policy if exists "anyone can delete reports" on public.reports;
drop policy if exists "anyone read chat" on public.chat_messages;
drop policy if exists "anyone insert chat" on public.chat_messages;
drop policy if exists "public read lab-reports" on storage.objects;
drop policy if exists "public upload lab-reports" on storage.objects;

-- 6) Secure RLS policies
create policy "users can view own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "users can insert own profile"
on public.profiles
for insert
with check (id = auth.uid());

create policy "users can update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "users can insert own reports"
on public.reports
for insert
with check (user_id = auth.uid());

create policy "users can view own reports"
on public.reports
for select
using (user_id = auth.uid());

create policy "users can update own reports"
on public.reports
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own reports"
on public.reports
for delete
using (user_id = auth.uid());

create policy "users can read own chat messages"
on public.chat_messages
for select
using (user_id = auth.uid());

create policy "users can insert own chat messages"
on public.chat_messages
for insert
with check (user_id = auth.uid());

create policy "users can update own chat messages"
on public.chat_messages
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own chat messages"
on public.chat_messages
for delete
using (user_id = auth.uid());

-- Storage policies: user folder isolation under lab-reports/<auth.uid()>/...
create policy "users can read own lab files"
on storage.objects
for select
using (
  bucket_id = 'lab-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can upload own lab files"
on storage.objects
for insert
with check (
  bucket_id = 'lab-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update own lab files"
on storage.objects
for update
using (
  bucket_id = 'lab-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'lab-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete own lab files"
on storage.objects
for delete
using (
  bucket_id = 'lab-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);
