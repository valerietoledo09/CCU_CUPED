-- Run once in the SQL Editor of your own Supabase project.
-- This stores a publicly readable calendar. Only its signed-in creator can edit it.
-- Never place the service_role or secret key in the website.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
revoke all on table public.plans from anon, authenticated;
grant select on table public.plans to anon, authenticated;
grant insert, update on table public.plans to authenticated;

drop policy if exists "Public calendar viewing" on public.plans;
create policy "Public calendar viewing" on public.plans for select to anon, authenticated using (true);
drop policy if exists "Create own calendar" on public.plans;
create policy "Create own calendar" on public.plans for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "Update own calendar" on public.plans;
create policy "Update own calendar" on public.plans for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- No anonymous writes, public sign-up UI, or delete endpoint is needed.
-- Create your owner account under Authentication > Users > Add user.
-- Use that account's email/password in the website's owner sign-in screen.
