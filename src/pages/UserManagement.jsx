import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';

const roles = { admin: '管理者', editor: '編集者', viewer: '閲覧者' };

function UserRow({ user, currentUserId, busy, onSave }) {
  const [role, setRole] = useState(user.role);
  const [allowed, setAllowed] = useState(user.is_allowed);
  const [imageFailed, setImageFailed] = useState(false);
  const protectedUser = user.id === currentUserId || user.role === 'admin';
  const changed = role !== user.role || allowed !== user.is_allowed;
  return (
    <tr>
      <td><div className="managed-user"><span className="avatar">{user.avatar_url && !imageFailed
        ? <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : (user.name || 'U').slice(0, 1)}</span><span>{user.name || 'ユーザー'}{user.id === currentUserId && <small>自分</small>}</span></div></td>
      <td>{user.email}</td>
      <td>{protectedUser ? roles[user.role] : <select aria-label={`${user.email}の権限`} value={role} disabled={busy} onChange={(event) => setRole(event.target.value)}>
        <option value="editor">編集者</option><option value="viewer">閲覧者</option>
      </select>}</td>
      <td><label className="user-allowed"><input type="checkbox" checked={allowed} disabled={protectedUser || busy} onChange={(event) => setAllowed(event.target.checked)} aria-label={`${user.email}の許可`} />{allowed ? '許可' : '未許可'}</label></td>
      <td>{protectedUser ? <span className="user-admin-note">変更不可</span> : <button className="primary-button" type="button" disabled={!changed || busy} onClick={() => onSave('admin_update_user', { p_user_id: user.id, p_role: role, p_is_allowed: allowed }, 'ユーザー情報を更新しました。')}>保存</button>}</td>
    </tr>
  );
}

function AdminUsers({ currentUserId }) {
  const [data, setData] = useState({ users: [], invitations: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const mounted = useRef(false);
  const pending = useRef(false);
  const requestId = useRef(0);
  const emailRef = useRef(null);

  function reportError(failure) {
    if (!mounted.current) return;
    if (failure?.code === '42501') { setDenied(true); setData({ users: [], invitations: [] }); }
    setError(failure?.code === '22023' ? 'メールアドレス・権限を確認してください。管理者アカウントは変更できません。' : '操作に失敗しました。接続と管理者権限を確認して、もう一度お試しください。');
  }

  async function loadUsers() {
    const request = ++requestId.current;
    const { data: result, error: failure } = await supabase.rpc('admin_get_users');
    if (!mounted.current || request !== requestId.current) return;
    if (failure) throw failure;
    if (mounted.current) setData(result);
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    loadUsers().catch((failure) => { if (active) reportError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; requestId.current++; };
  }, []);

  useEffect(() => { if (inviteOpen) emailRef.current?.focus(); }, [inviteOpen]);

  async function save(rpc, args, successMessage) {
    if (pending.current || denied) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: failure } = await supabase.rpc(rpc, args);
      if (failure) throw failure;
      if (!mounted.current) return;
      await loadUsers();
      if (mounted.current) {
        setMessage(successMessage);
        if (rpc === 'admin_invite_user') { setEmail(''); setInviteOpen(false); }
      }
    } catch (failure) { reportError(failure); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  async function reload() {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError('');
    try { await loadUsers(); } catch (failure) { reportError(failure); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  }

  if (denied) return <p role="alert">この画面は許可された管理者のみ利用できます。</p>;

  return (
    <div className="user-management">
      <div className="section-heading"><h2>ログイン済みユーザー</h2><button type="button" className="primary-button" onClick={() => setInviteOpen((open) => !open)} aria-expanded={inviteOpen} aria-controls="user-invitation-form" disabled={busy}>ユーザーを招待</button></div>
      {inviteOpen && <form id="user-invitation-form" className="content-panel user-invite-form" onSubmit={(event) => { event.preventDefault(); void save('admin_invite_user', { p_email: email.trim().toLowerCase(), p_role: role }, '招待を登録しました。次回のGoogleログイン時に権限が付与されます。'); }}>
        <p>メールアドレスを事前登録します。招待メールは送信されません。</p>
        <div className="user-invite-fields">
          <label>メールアドレス<input ref={emailRef} type="email" required maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
          <label>権限<select value={role} onChange={(event) => setRole(event.target.value)} disabled={busy}><option value="viewer">閲覧者</option><option value="editor">編集者</option></select></label>
          <button type="submit" className="primary-button" disabled={busy}>招待を登録</button>
        </div>
      </form>}
      {error && <p role="alert">{error} <button className="primary-button" type="button" onClick={reload} disabled={busy || loading}>再読み込み</button></p>}
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">ユーザーを読み込んでいます…</p> : <>
        <div className="content-panel user-table-scroll"><table className="user-table"><caption className="user-table-caption">これまでにログインしたアカウント</caption><thead><tr><th scope="col">ユーザー</th><th scope="col">メールアドレス</th><th scope="col">権限</th><th scope="col">許可状態</th><th scope="col">操作</th></tr></thead>
          <tbody>{data.users.map((user) => <UserRow key={`${user.id}:${user.role}:${user.is_allowed}`} user={user} currentUserId={currentUserId} busy={busy} onSave={save} />)}</tbody></table>
          {!data.users.length && !error && <p className="user-empty">ログイン済みのユーザーはいません。</p>}
        </div>
        <section className="user-invitations"><div className="section-heading"><h2>ログイン待ちの招待</h2></div>
          {data.invitations.length ? <div className="content-panel user-table-scroll"><table className="user-table"><thead><tr><th scope="col">メールアドレス</th><th scope="col">付与する権限</th><th scope="col">操作</th></tr></thead><tbody>{data.invitations.map((invitation) => <tr key={invitation.email}><td>{invitation.email}</td><td>{roles[invitation.role]}</td><td><button className="primary-button" type="button" disabled={busy} onClick={() => save('admin_cancel_invitation', { p_email: invitation.email }, '招待を取り消しました。')}>招待を取消</button></td></tr>)}</tbody></table></div> : <p className="user-admin-note">ログイン待ちの招待はありません。</p>}
        </section>
      </>}
    </div>
  );
}

export default function UserManagement() {
  const { auth } = useOutletContext();
  const canManage = auth.user && auth.role === 'admin' && auth.canEdit;
  return <>
    <PageHeader eyebrow="ADMINISTRATION" title="ユーザー管理" description="ユーザーの権限と利用許可を管理します。" />
    {auth.loading ? <p role="status">権限を確認しています…</p> : canManage && supabase ? <AdminUsers key={auth.user.id} currentUserId={auth.user.id} /> : <p role="alert">この画面は許可された管理者のみ利用できます。</p>}
  </>;
}
