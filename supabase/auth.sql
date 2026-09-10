-- Supabase SQL Editorで一度実行する。既存profilesテーブルがある場合は先に構成を確認する。
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  is_allowed boolean not null default false
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- プロフィール/権限の作成・更新はSQL Editorまたは信頼できるサーバーのみ。
-- ユーザー自身によるrole/is_allowedの書き換えは許可しない。

create function public.can_edit()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_allowed = true
      and role in ('admin', 'editor')
  );
$$;
revoke all on function public.can_edit() from public, anon;
grant execute on function public.can_edit() to authenticated;

commit;

-- 初回Googleログイン後、Authentication > UsersのUUIDで管理者が明示的に許可する。
-- insert into public.profiles (id, role, is_allowed)
-- values ('USER_UUID', 'editor', true)
-- on conflict (id) do update set role = excluded.role, is_allowed = excluded.is_allowed;
-- 許可解除: update public.profiles set is_allowed = false where id = 'USER_UUID';

-- 今後作る編集対象テーブル用の例（contentを実際のテーブル名に置換して適用）。
-- 既存の書込み許可ポリシーがある場合は併せて見直す。通常のポリシーはORで結合される。
-- alter table public.content enable row level security;
-- grant select on public.content to anon, authenticated;
-- grant insert, update, delete on public.content to authenticated;
-- create policy "Read content" on public.content for select to anon, authenticated using (true);
-- create policy "Insert content" on public.content for insert to authenticated
--   with check ((select public.can_edit()));
-- create policy "Update content" on public.content for update to authenticated
--   using ((select public.can_edit())) with check ((select public.can_edit()));
-- create policy "Delete content" on public.content for delete to authenticated
--   using ((select public.can_edit()));
