// Isolated PostgreSQL (PGlite) verification; no connection to the live project.
// Set SIDECODEX_PGLITE_PATH to a temporary installation's dist/index.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.SIDECODEX_PGLITE_PATH ? pathToFileURL(process.env.SIDECODEX_PGLITE_PATH).href : '@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const check = (value, expected) => { assert.deepEqual(value, expected); checks++; };
async function asUser(userId, sql, params = [], role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function denied(userId, sql, params = [], code = '42501', role) {
  await assert.rejects(asUser(userId, sql, params, role), (error) => error.code === code);
  checks++;
}
async function addUser(n, email, verified = true) {
  await db.query("insert into auth.users (id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values ($1,$2,$3,now(),$4)",
    [id(n), email, verified ? new Date().toISOString() : null, JSON.stringify({ full_name: `User ${n}`, avatar_url: 'https://example.com/avatar.png', role: 'admin' })]);
}
async function googleIdentity(n, email, verified = true) {
  await db.query("insert into auth.identities (id,user_id,provider,identity_data) values ($1,$1,'google',$2)",
    [id(n), JSON.stringify({ email, email_verified: verified })]);
}
async function profile(n) { return (await db.query('select role,is_allowed from public.profiles where id=$1', [id(n)])).rows[0]; }

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz, last_sign_in_at timestamptz);
    create table auth.identities (id uuid primary key, user_id uuid references auth.users on delete cascade, provider text, identity_data jsonb);
    create table auth.sessions (id uuid primary key, user_id uuid references auth.users on delete cascade);
    create table auth.refresh_tokens (id bigint generated always as identity primary key, user_id text, session_id uuid references auth.sessions on delete cascade);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.exec(await readFile(new URL('../auth.sql', import.meta.url), 'utf8'));
  // Existing admin survives the migration; legacy users without profiles are backfilled.
  await addUser(1, 'admin@example.com');
  await db.query("insert into public.profiles values ($1,'admin',true)", [id(1)]);
  await addUser(2, 'editor@example.com');
  await db.exec(await readFile(new URL('../migrations/20260910071015_user_management.sql', import.meta.url), 'utf8'));
  check(await profile(1), { role: 'admin', is_allowed: true });
  check(await profile(2), { role: 'viewer', is_allowed: false });
  await addUser(3, 'viewer@example.com');
  await addUser(4, 'blocked-admin@example.com');
  await addUser(5, 'other-admin@example.com');
  await db.query("update public.profiles set role='editor',is_allowed=true where id=$1", [id(2)]);
  await db.query("update public.profiles set is_allowed=true where id=$1", [id(3)]);
  await db.query("update public.profiles set role='admin' where id=$1", [id(4)]);
  await db.query("update public.profiles set role='admin',is_allowed=true where id=$1", [id(5)]);
  await db.exec(await readFile(new URL('../migrations/20260914073627_require_user_invitation.sql', import.meta.url), 'utf8'));
  check(await profile(1), { role: 'admin', is_allowed: true });
  check(await profile(4), { role: 'admin', is_allowed: false });
  await db.exec(await readFile(new URL('../migrations/20260914075211_admin_delete_users.sql', import.meta.url), 'utf8'));

  for (const n of [2, 3, 4]) {
    await denied(id(n), 'select public.admin_get_users()');
    await denied(id(n), "select public.admin_update_user($1,'editor',true)", [id(3)]);
    await denied(id(n), "select public.admin_invite_user('new@example.com','editor')");
    await denied(id(n), "select public.admin_cancel_invitation('new@example.com')");
    await denied(id(n), 'select public.admin_delete_users($1)', [[id(3)]]);
  }
  await denied(null, 'select public.admin_get_users()', [], '42501', 'anon');
  await denied(null, 'select public.admin_get_users()');
  await denied(id(1), 'select private.apply_user_invitation($1)', [id(1)]);
  await denied(id(1), 'select private.require_signup_invitation()');
  await denied(id(1), "update public.profiles set role='admin' where id=$1", [id(2)]);
  await denied(id(2), 'select * from private.user_invitations');
  check((await asUser(id(2), 'select id from public.profiles')).rows, [{ id: id(2) }]);

  const listing = (await asUser(id(1), 'select public.admin_get_users() as data')).rows[0].data;
  check(listing.users.length, 5);
  check(listing.users[0].name, 'User 1');
  check(listing.users[0].avatar_url, 'https://example.com/avatar.png');
  check(listing.users.slice(0, 3).every((user) => user.role === 'admin'), true);
  for (const n of [1, 5]) await denied(id(1), "select public.admin_update_user($1,'viewer',false)", [id(n)], '22023');
  await denied(id(1), "select public.admin_update_user($1,'admin',true)", [id(2)], '22023');
  await denied(id(1), "select public.admin_invite_user('admin@example.com','editor')", [], '22023');
  await denied(id(1), "select public.admin_invite_user('x@example.com','admin')", [], '22023');
  await denied(id(1), "select public.admin_invite_user('not an email','viewer')", [], '22023');

  await asUser(id(1), "select public.admin_update_user($1,'viewer',false)", [id(2)]);
  check(await profile(2), { role: 'viewer', is_allowed: false });
  check((await asUser(id(2), 'select public.can_edit() as allowed')).rows[0].allowed, false);

  await asUser(id(1), "select public.admin_invite_user(' INVITED@EXAMPLE.COM ','editor')");
  await addUser(6, 'invited@example.com');
  check(await profile(6), undefined);
  check((await asUser(id(1), 'select public.admin_get_users() as data')).rows[0].data.users.some((user) => user.id === id(6)), false);
  await googleIdentity(6, 'invited@example.com');
  check(await profile(6), { role: 'editor', is_allowed: true });
  check((await asUser(id(6), 'select public.can_edit() as allowed')).rows[0].allowed, true);
  check((await db.query('select count(*)::int as n from private.user_invitations')).rows[0].n, 0);
  // Consumed invitations cannot undo a later revocation on the next login.
  await asUser(id(1), "select public.admin_update_user($1,'viewer',false)", [id(6)]);
  await db.query('update auth.users set last_sign_in_at=now() where id=$1', [id(6)]);
  check(await profile(6), { role: 'viewer', is_allowed: false });

  // Invitation for an already-registered user takes effect on next Google login.
  await asUser(id(1), "select public.admin_invite_user('invited@example.com','viewer')");
  await db.query('update auth.users set last_sign_in_at=now() where id=$1', [id(6)]);
  check(await profile(6), { role: 'viewer', is_allowed: true });
  // Explicit edits also remove still-pending invitations.
  await asUser(id(1), "select public.admin_invite_user('invited@example.com','editor')");
  await asUser(id(1), "select public.admin_update_user($1,'viewer',false)", [id(6)]);
  await db.query('update auth.users set last_sign_in_at=now() where id=$1', [id(6)]);
  check(await profile(6), { role: 'viewer', is_allowed: false });

  await asUser(id(1), "select public.admin_invite_user('cancel@example.com','editor')");
  await asUser(id(1), "select public.admin_cancel_invitation('CANCEL@example.com')");
  for (const [n, email] of [[7, 'cancel@example.com'], [8, 'stranger@example.com'], [10, null]]) {
    await assert.rejects(addUser(n, email), (error) => error.code === '42501'); checks++;
    check((await db.query('select count(*)::int as n from auth.users where id=$1', [id(n)])).rows[0].n, 0);
    check(await profile(n), undefined);
    check((await db.query('select count(*)::int as n from auth.identities where user_id=$1', [id(n)])).rows[0].n, 0);
  }
  // A previously rejected account can register after receiving an invitation.
  await asUser(id(1), "select public.admin_invite_user(' STRANGER@EXAMPLE.COM ','viewer')");
  await addUser(8, 'Stranger@Example.com'); await googleIdentity(8, 'stranger@example.com');
  check(await profile(8), { role: 'viewer', is_allowed: true });

  // Unverified identities, a different verified identity email, and editable metadata
  // are insufficient to claim a privileged invitation.
  await asUser(id(1), "select public.admin_invite_user('verify@example.com','editor')");
  await addUser(9, 'verify@example.com', false); await googleIdentity(9, 'verify@example.com', false);
  check(await profile(9), undefined);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id(9)]);
  check(await profile(9), undefined);
  await db.query("update auth.identities set identity_data=$2 where id=$1", [id(9), JSON.stringify({ email: 'different@example.com', email_verified: true })]);
  check(await profile(9), undefined);
  await db.query("update auth.identities set identity_data=$2 where id=$1", [id(9), JSON.stringify({ email: 'verify@example.com', email_verified: true })]);
  check(await profile(9), { role: 'editor', is_allowed: true });

  await denied(null, 'select public.admin_delete_users($1)', [[id(8)]], '42501', 'anon');
  await denied(null, 'select public.admin_delete_users($1)', [[id(8)]]);
  for (const ids of [null, [], [null], [id(8), id(1)], [id(8), id(5)], [id(8), id(99)]]) {
    await denied(id(1), 'select public.admin_delete_users($1)', [ids], '22023');
    check(await profile(8), { role: 'viewer', is_allowed: true });
  }
  for (const n of [8, 9]) {
    await db.query('insert into auth.sessions(id,user_id) values ($1,$1)', [id(n)]);
    await db.query('insert into auth.refresh_tokens(user_id,session_id) values ($1,$2)', [id(n), id(n)]);
  }
  await asUser(id(1), "select public.admin_invite_user('stranger@example.com','editor')");
  // Duplicates are harmless; the whole batch and associated records disappear together.
  check((await asUser(id(1), 'select public.admin_delete_users($1) as deleted', [[id(8), id(9), id(8)]])).rows[0].deleted, 2);
  for (const n of [8, 9]) {
    check(await profile(n), undefined);
    check((await db.query('select count(*)::int as n from auth.users where id=$1', [id(n)])).rows[0].n, 0);
    for (const table of ['identities', 'sessions', 'refresh_tokens']) {
      check((await db.query(`select count(*)::int as n from auth.${table} where user_id=$1`, [id(n)])).rows[0].n, 0);
    }
    check((await asUser(id(n), 'select public.can_edit() as allowed')).rows[0].allowed, false);
    await denied(id(n), 'select public.admin_get_users()');
  }
  check((await db.query("select count(*)::int as n from private.user_invitations where email='stranger@example.com'")).rows[0].n, 0);
  await assert.rejects(addUser(8, 'stranger@example.com'), (error) => error.code === '42501'); checks++;
  await assert.rejects(addUser(9, 'verify@example.com'), (error) => error.code === '42501'); checks++;
  check(await profile(1), { role: 'admin', is_allowed: true });
  check(await profile(6), { role: 'viewer', is_allowed: false });

  // Security catalog checks, in addition to executing calls under real DB roles.
  check((await db.query("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin_%' and p.prosecdef")).rows[0].n, 0);
  check((await db.query("select relrowsecurity from pg_class where oid='private.user_invitations'::regclass")).rows[0].relrowsecurity, true);
  check((await db.query("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and has_function_privilege('anon',p.oid,'execute')")).rows[0].n, 0);
  console.log(`PostgreSQL security/invitation checks passed: ${checks}`);
} finally { await db.close(); }
