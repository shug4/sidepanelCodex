-- Prerequisite: user_management. New Auth users must have an administrator invitation.
begin;

create function private.require_signup_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Lock until the signup transaction ends so cancellation cannot race signup.
  perform 1 from private.user_invitations
  where email = lower(btrim(new.email)) for update;
  if not found then
    raise exception 'An administrator invitation is required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.require_signup_invitation() from public, anon, authenticated;

create trigger workspace_require_signup_invitation before insert on auth.users
for each row execute function private.require_signup_invitation();

create or replace function private.apply_user_invitation(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare verified_email text; current_role text; invited_role text;
begin
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
  -- Only verified, invited users receive a profile. Existing revoked users stay revoked.
  insert into public.profiles (id, role, is_allowed) values (p_user_id, invited_role, true)
  on conflict (id) do update set role = excluded.role, is_allowed = excluded.is_allowed;
  delete from private.user_invitations where email = verified_email;
end;
$$;

create or replace function private.admin_get_users() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare users_data jsonb; invitations_data jsonb;
begin
  perform private.require_user_admin();
  select coalesce(jsonb_agg(to_jsonb(u) order by (u.role = 'admin') desc, u.email, u.id), '[]'::jsonb) into users_data
  from (
    select a.id, a.email,
      coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name', a.email, 'ユーザー') as name,
      coalesce(a.raw_user_meta_data->>'avatar_url', a.raw_user_meta_data->>'picture') as avatar_url,
      p.role, p.is_allowed
    from auth.users a join public.profiles p on p.id = a.id
    where a.last_sign_in_at is not null
  ) u;
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'role', role) order by email), '[]'::jsonb)
  into invitations_data from private.user_invitations;
  return jsonb_build_object('users', users_data, 'invitations', invitations_data);
end;
$$;

notify pgrst, 'reload schema';
commit;
