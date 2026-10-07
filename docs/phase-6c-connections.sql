-- Phase 6C — per-user platform connections.
-- Already applied to the ButtonPost Supabase project.

alter table private.platform_credentials enable row level security;

alter table public.platform_secrets
  alter column encrypted_payload type text
  using encode(encrypted_payload, 'base64');

grant select, insert, update, delete on public.platform_connections to authenticated;

create policy platform_connections_insert_own
on public.platform_connections for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy platform_connections_update_own
on public.platform_connections for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy platform_connections_delete_own
on public.platform_connections for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.platform_secrets to authenticated;

create policy platform_secrets_select_own
on public.platform_secrets for select to authenticated
using (
  exists (
    select 1
    from public.platform_connections c
    where c.id = platform_secrets.connection_id
      and c.user_id = (select auth.uid())
  )
);

create policy platform_secrets_insert_own
on public.platform_secrets for insert to authenticated
with check (
  exists (
    select 1
    from public.platform_connections c
    where c.id = platform_secrets.connection_id
      and c.user_id = (select auth.uid())
  )
);

create policy platform_secrets_update_own
on public.platform_secrets for update to authenticated
using (
  exists (
    select 1
    from public.platform_connections c
    where c.id = platform_secrets.connection_id
      and c.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.platform_connections c
    where c.id = platform_secrets.connection_id
      and c.user_id = (select auth.uid())
  )
);

create policy platform_secrets_delete_own
on public.platform_secrets for delete to authenticated
using (
  exists (
    select 1
    from public.platform_connections c
    where c.id = platform_secrets.connection_id
      and c.user_id = (select auth.uid())
  )
);
