-- Phase 6E — API abuse protection.
-- Applied to the ButtonPost Supabase project.

create table if not exists private.api_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  created_at timestamptz not null default now()
);

alter table private.api_rate_limit_events enable row level security;

grant usage on schema private to authenticated;
grant select, insert, delete on private.api_rate_limit_events to authenticated;

create policy api_rate_limit_select_own
on private.api_rate_limit_events
for select to authenticated
using ((select auth.uid()) = user_id);

create policy api_rate_limit_insert_own
on private.api_rate_limit_events
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy api_rate_limit_delete_own
on private.api_rate_limit_events
for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists api_rate_limit_user_scope_created_idx
on private.api_rate_limit_events(user_id, scope, created_at desc);

-- The deployed function uses hard-coded per-scope limits and auth.uid().
-- See the live project definition for the complete PL/pgSQL body.
