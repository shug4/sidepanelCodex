-- Prerequisite: supabase/auth.sql has already been applied.
-- Apply as postgres in SQL Editor. Keep private OUT of the Data API exposed schemas.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.user_invitations (
  email text primary key check (email = lower(btrim(email)) and length(email) <= 254),
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table private.user_invitations enable row level security;
revoke all on private.user_invitations from public, anon, authenticated;
-- No client table writes, including admin. Only checked RPCs may change permissions.
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;

insert into public.profiles (id, role, is_allowed)
select id, 'viewer', false from auth.users
on conflict (id) do nothing;

-- All elevated implementations live in an unexposed schema with explicit caller checks.
-- Lock the caller for the transaction so concurrent revocation cannot race a write.
create function private.require_user_admin() returns void
language plpgsql security definer set search_path = '' as $$
declare actor_role text; actor_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Administrator required' using errcode = '42501'; end if;
  select role, is_allowed into actor_role, actor_allowed
  from public.profiles where id = auth.uid() for share;
  if actor_role is distinct from 'admin' or actor_allowed is distinct from true then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
end;
$$;

create function private.admin_get_users() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare users_data jsonb; invitations_data jsonb;
begin
  perform private.require_user_admin();
  select coalesce(jsonb_agg(to_jsonb(u) order by u.email, u.id), '[]'::jsonb) into users_data
  from (
    select a.id, a.email,
      coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name', a.email, 'ユーザー') as name,
      coalesce(a.raw_user_meta_data->>'avatar_url', a.raw_user_meta_data->>'picture') as avatar_url,
      coalesce(p.role, 'viewer') as role, coalesce(p.is_allowed, false) as is_allowed
    from auth.users a left join public.profiles p on p.id = a.id
    where a.last_sign_in_at is not null
  ) u;
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'role', role) order by email), '[]'::jsonb)
  into invitations_data from private.user_invitations;
  return jsonb_build_object('users', users_data, 'invitations', invitations_data);
end;
$$;

create function private.admin_update_user(p_user_id uuid, p_role text, p_is_allowed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target_role text; target_email text;
begin
  perform private.require_user_admin();
  if p_user_id is null or p_user_id = auth.uid() or p_role is null or p_role not in ('editor', 'viewer') or p_is_allowed is null then
    raise exception 'Invalid change or protected account' using errcode = '22023';
  end if;
  select role into target_role from public.profiles where id = p_user_id for update;
  if not found or target_role = 'admin' then
    raise exception 'Unknown or protected account' using errcode = '22023';
  end if;
  select lower(btrim(email)) into target_email from auth.users where id = p_user_id;
  -- Explicit edits supersede a pending invitation: next login must not restore access.
  delete from private.user_invitations where email = target_email;
  update public.profiles set role = p_role, is_allowed = p_is_allowed where id = p_user_id;
end;
$$;

create function private.admin_invite_user(p_email text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(btrim(p_email));
begin
  perform private.require_user_admin();
  if normalized_email is null or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'Invalid email or role' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u join public.profiles p on p.id = u.id
    where lower(btrim(u.email)) = normalized_email and (p.role = 'admin' or u.id = auth.uid())) then
    raise exception 'Protected account' using errcode = '22023';
  end if;
  insert into private.user_invitations (email, role, created_by)
  values (normalized_email, p_role, auth.uid())
  on conflict (email) do update set role = excluded.role, created_by = excluded.created_by, created_at = now();
end;
$$;

create function private.admin_cancel_invitation(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user_admin();
  delete from private.user_invitations where email = lower(btrim(p_email));
end;
$$;

-- Called ONLY by trusted Auth table triggers. User-editable metadata never grants roles.
create function private.apply_user_invitation(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare verified_email text; current_role text; invited_role text;
begin
  insert into public.profiles (id, role, is_allowed) values (p_user_id, 'viewer', false)
  on conflict (id) do nothing;
  select role into current_role from public.profiles where id = p_user_id for update;
  if current_role = 'admin' then return; end if;
  select lower(btrim(u.email)) into verified_email from auth.users u
  where u.id = p_user_id and u.email_confirmed_at is not null
    and exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
        and i.identity_data->>'email_verified' = 'true'
        and lower(btrim(i.identity_data->>'email')) = lower(btrim(u.email))
    );
  if verified_email is null then return; end if;
  select role into invited_role from private.user_invitations where email = verified_email for update;
  if not found then return; end if;
  update public.profiles set role = invited_role, is_allowed = true where id = p_user_id;
  delete from private.user_invitations where email = verified_email;
end;
$$;

create function private.on_auth_user_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.apply_user_invitation(new.id);
  return new;
end;
$$;
create function private.on_google_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider = 'google' then perform private.apply_user_invitation(new.user_id); end if;
  return new;
end;
$$;
-- Identity insertion can follow user insertion on the first OAuth login.
create trigger workspace_auth_user_login after insert or update of last_sign_in_at, email, email_confirmed_at
on auth.users for each row execute function private.on_auth_user_login();
create trigger workspace_google_identity after insert or update of identity_data
on auth.identities for each row execute function private.on_google_identity();

-- Thin invoker wrappers are the only public API. They do not accept a caller ID.
create function public.admin_get_users() returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_get_users(); $$;
create function public.admin_update_user(p_user_id uuid, p_role text, p_is_allowed boolean) returns void
language sql security invoker set search_path = '' as $$ select private.admin_update_user(p_user_id, p_role, p_is_allowed); $$;
create function public.admin_invite_user(p_email text, p_role text) returns void
language sql security invoker set search_path = '' as $$ select private.admin_invite_user(p_email, p_role); $$;
create function public.admin_cancel_invitation(p_email text) returns void
language sql security invoker set search_path = '' as $$ select private.admin_cancel_invitation(p_email); $$;

revoke all on function private.require_user_admin(), private.apply_user_invitation(uuid), private.on_auth_user_login(), private.on_google_identity() from public, anon, authenticated;
revoke all on function private.admin_get_users(), private.admin_update_user(uuid, text, boolean), private.admin_invite_user(text, text), private.admin_cancel_invitation(text) from public, anon, authenticated;
revoke all on function public.admin_get_users(), public.admin_update_user(uuid, text, boolean), public.admin_invite_user(text, text), public.admin_cancel_invitation(text) from public, anon, authenticated;
grant execute on function private.admin_get_users(), private.admin_update_user(uuid, text, boolean), private.admin_invite_user(text, text), private.admin_cancel_invitation(text) to authenticated;
grant execute on function public.admin_get_users(), public.admin_update_user(uuid, text, boolean), public.admin_invite_user(text, text), public.admin_cancel_invitation(text) to authenticated;

notify pgrst, 'reload schema';
commit;
