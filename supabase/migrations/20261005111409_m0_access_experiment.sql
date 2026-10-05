begin;

create schema m0_private;
revoke all on schema m0_private from public, anon, authenticated;
grant usage on schema m0_private to authenticated;

create table public.memberships (
    group_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('member', 'admin')),
    status text not null check (status in ('active', 'removed')),
    primary key (group_id, user_id)
);

create table public.contributions (
    id uuid primary key,
    group_id uuid not null,
    owner_id uuid not null,
    state text not null check (state in ('processing', 'available', 'withdrawn')),
    filename text not null check (filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'),
    media_type text not null check (media_type in ('image/jpeg', 'image/png')),
    object_key text not null unique,
    foreign key (group_id, owner_id) references public.memberships(group_id, user_id) on delete cascade,
    check (object_key = group_id::text || '/' || id::text || '/' || filename)
);

create index memberships_user_group_idx on public.memberships(user_id, group_id);
create index contributions_group_state_idx on public.contributions(group_id, state);
create index contributions_group_owner_idx on public.contributions(group_id, owner_id);

alter table public.memberships enable row level security;
alter table public.contributions enable row level security;
revoke all on public.memberships, public.contributions from public, anon, authenticated;
grant select on public.memberships, public.contributions to authenticated;
grant all on public.memberships, public.contributions to service_role;

create function m0_private.can_read_contribution(target_group uuid, contributor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select auth.uid() is not null
        and exists (
            select 1 from public.memberships
            where group_id = target_group
                and user_id = auth.uid()
                and status = 'active'
        )
        and exists (
            select 1 from public.memberships
            where group_id = target_group
                and user_id = contributor
                and status = 'active'
        );
$$;

revoke all on function m0_private.can_read_contribution(uuid, uuid) from public, anon, authenticated;
grant execute on function m0_private.can_read_contribution(uuid, uuid) to authenticated;

create policy memberships_read_self on public.memberships
for select to authenticated
using (user_id = (select auth.uid()));

create policy contributions_read_available on public.contributions
for select to authenticated
using (state = 'available' and m0_private.can_read_contribution(group_id, owner_id));

revoke all on storage.objects, storage.buckets from anon, authenticated;
grant select on storage.objects, storage.buckets to authenticated;

create policy m0_originals_read_available on storage.objects
for select to authenticated
using (
    bucket_id = 'm0-originals'
    and exists (
        select 1 from public.contributions
        where object_key = storage.objects.name
    )
);

notify pgrst, 'reload schema';
commit;
