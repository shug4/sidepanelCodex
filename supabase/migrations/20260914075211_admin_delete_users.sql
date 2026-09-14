begin;

create function private.admin_delete_users(p_user_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare target_count integer; locked_count integer;
begin
  perform private.require_user_admin();
  if p_user_ids is null or cardinality(p_user_ids) = 0 or array_position(p_user_ids, null) is not null
    or auth.uid() = any(p_user_ids) then
    raise exception 'Invalid selection or protected account' using errcode = '22023';
  end if;
  select count(distinct id) into target_count from unnest(p_user_ids) as selected(id);
  -- Validate the entire batch before changing anything; concurrent role changes wait.
  perform u.id from auth.users u join public.profiles p on p.id = u.id
  where u.id = any(p_user_ids) order by u.id for update of u, p;
  get diagnostics locked_count = row_count;
  if locked_count <> target_count or exists (
    select 1 from public.profiles where id = any(p_user_ids) and role = 'admin'
  ) then
    raise exception 'Unknown or protected account' using errcode = '22023';
  end if;

  -- Remove pending invitations too: deletion must not grant a new signup.
  delete from private.user_invitations i using auth.users u
  where u.id = any(p_user_ids) and i.email = lower(btrim(u.email));
  delete from auth.refresh_tokens where user_id in (select id::text from unnest(p_user_ids) as selected(id));
  delete from auth.sessions where user_id = any(p_user_ids);
  -- Profiles, identities and other Auth records cascade. RLS immediately loses the profile.
  delete from auth.users where id = any(p_user_ids);
  return target_count;
end;
$$;

create function public.admin_delete_users(p_user_ids uuid[]) returns integer
language sql security invoker set search_path = '' as $$ select private.admin_delete_users(p_user_ids); $$;

revoke all on function private.admin_delete_users(uuid[]), public.admin_delete_users(uuid[]) from public, anon, authenticated;
grant execute on function private.admin_delete_users(uuid[]), public.admin_delete_users(uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
