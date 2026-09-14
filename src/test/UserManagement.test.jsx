import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from '../App';

const mock = vi.hoisted(() => ({ auth: null, rpc: vi.fn(), users: [], invitations: [] }));
vi.mock('../hooks/useAuth', () => ({ default: () => mock.auth }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args) => mock.rpc(...args) } }));
const renderApp = () => render(<BrowserRouter><App /></BrowserRouter>);
beforeEach(() => {
  window.history.replaceState(null, '', '/users');
  mock.auth = { user: { id: 'admin', email: 'admin@example.com' }, role: 'admin', canEdit: true, loading: false };
  mock.users = [
    { id: 'admin', name: '管理者本人', email: 'admin@example.com', role: 'admin', is_allowed: true },
    { id: 'member', name: '登録ユーザー', email: 'member@example.com', avatar_url: 'https://example.com/avatar.png', role: 'viewer', is_allowed: false },
  ];
  mock.invitations = [];
  mock.rpc.mockReset();
  mock.rpc.mockImplementation(async (name, args) => {
    if (name === 'admin_get_users') return { data: { users: [...mock.users], invitations: [...mock.invitations] }, error: null };
    if (name === 'admin_update_user') mock.users = mock.users.map((user) => user.id === args.p_user_id ? { ...user, role: args.p_role, is_allowed: args.p_is_allowed } : user);
    if (name === 'admin_invite_user') mock.invitations = [{ email: args.p_email, role: args.p_role }];
    if (name === 'admin_cancel_invitation') mock.invitations = [];
    if (name === 'admin_delete_users') mock.users = mock.users.filter((user) => !args.p_user_ids.includes(user.id));
    return { error: null };
  });
});

describe('管理者専用ユーザー管理', () => {
  it.each(['editor', 'viewer', 'unregistered', 'blocked-admin', 'anonymous', 'loading'])('%sは直接URLを開いても一覧取得・操作ができない', (kind) => {
    if (kind === 'anonymous') mock.auth.user = null;
    else if (kind === 'loading') mock.auth.loading = true;
    else if (kind === 'blocked-admin') mock.auth.canEdit = false;
    else mock.auth.role = kind;
    renderApp();
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'ユーザー管理' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ユーザーを招待' })).toBeNull();
  });

  it('管理者にメニュー・一覧を表示し、自分自身を変更不可にする', async () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'ユーザー管理' })).toBeTruthy();
    const own = (await screen.findByText('管理者本人')).closest('tr');
    expect(within(own).getByText('管理者')).toBeTruthy();
    expect(within(own).queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '許可状態' })).toBeNull();
    expect(within(own).queryByRole('combobox')).toBeNull();
    expect(within(own).queryByRole('button', { name: '保存' })).toBeNull();
    const member = screen.getByText('登録ユーザー').closest('tr');
    expect(member.querySelector('img').getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(within(member).getByText('member@example.com')).toBeTruthy();
  });

  it('editor/viewerを明示的な保存で更新し、既存の許可は変更しない', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('登録ユーザー');
    await user.selectOptions(screen.getByRole('combobox', { name: 'member@example.comの権限' }), 'editor');
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(mock.rpc).toHaveBeenCalledWith('admin_update_user', { p_user_id: 'member', p_role: 'editor', p_is_allowed: false });
    expect(await screen.findByText('ユーザー情報を更新しました。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' }).disabled).toBe(true);
  });

  it('メールアドレスと権限で事前招待を登録し、ログイン待ちの招待を取り消せる', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('登録ユーザー');
    await user.click(screen.getByRole('button', { name: 'ユーザーを招待' }));
    await user.type(screen.getByRole('textbox', { name: 'メールアドレス' }), 'Invited@Example.com');
    await user.selectOptions(screen.getByRole('combobox', { name: '権限', exact: true }), 'editor');
    await user.click(screen.getByRole('button', { name: '招待を登録' }));
    expect(mock.rpc).toHaveBeenCalledWith('admin_invite_user', { p_email: 'invited@example.com', p_role: 'editor' });
    expect(await screen.findByText('invited@example.com')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '招待を取消' }));
    expect(mock.rpc).toHaveBeenCalledWith('admin_cancel_invitation', { p_email: 'invited@example.com' });
    await waitFor(() => expect(screen.queryByText('invited@example.com')).toBeNull());
  });

  it('DBで権限を取り消されたら失敗を表示し、取得済み一覧と操作を隠す', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('登録ユーザー');
    mock.rpc.mockResolvedValue({ error: { code: '42501' } });
    await user.selectOptions(screen.getByRole('combobox', { name: 'member@example.comの権限' }), 'editor');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('登録ユーザー')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ユーザーを招待' })).toBeNull();
  });

  it('一覧取得失敗後に再読み込みできる', async () => {
    const user = userEvent.setup();
    mock.rpc.mockResolvedValueOnce({ error: { code: 'NETWORK' } });
    renderApp();
    await user.click(await screen.findByRole('button', { name: '再読み込み' }));
    expect(await screen.findByText('登録ユーザー')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('左端のチェックで複数選択し、表の外のボタンから一括削除できる', async () => {
    mock.users.push({ id: 'member2', name: '別ユーザー', email: 'second@example.com', role: 'editor', is_allowed: true });
    const user = userEvent.setup();
    renderApp();
    const first = await screen.findByRole('checkbox', { name: 'member@example.comを選択' });
    expect(first.closest('td')).toBe(first.closest('tr').cells[0]);
    expect(screen.queryByRole('button', { name: '選択したアカウントを削除' })).toBeNull();
    await user.click(first);
    await user.click(screen.getByRole('checkbox', { name: 'second@example.comを選択' }));
    expect(screen.getByText('2件選択中')).toBeTruthy();
    const remove = screen.getByRole('button', { name: '選択したアカウントを削除' });
    expect(remove.closest('table')).toBeNull();
    await user.click(remove);
    expect(mock.rpc).toHaveBeenCalledWith('admin_delete_users', { p_user_ids: ['member', 'member2'] });
    expect(await screen.findByText('2件のアカウントを削除しました。')).toBeTruthy();
    expect(screen.queryByText('member@example.com')).toBeNull();
    expect(screen.queryByText('second@example.com')).toBeNull();
    expect(screen.getByRole('cell', { name: 'admin@example.com' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '選択したアカウントを削除' })).toBeNull();
  });

  it('全ての選択を解除すると削除ボタンを隠す', async () => {
    const user = userEvent.setup();
    renderApp();
    const checkbox = await screen.findByRole('checkbox', { name: 'member@example.comを選択' });
    await user.click(checkbox);
    await user.click(checkbox);
    expect(screen.queryByRole('button', { name: '選択したアカウントを削除' })).toBeNull();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it('削除中の二重操作を防ぎ、失敗時は選択を残して再試行できる', async () => {
    const user = userEvent.setup();
    renderApp();
    const checkbox = await screen.findByRole('checkbox', { name: 'member@example.comを選択' });
    await user.click(checkbox);
    let resolve;
    mock.rpc.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await user.dblClick(screen.getByRole('button', { name: '選択したアカウントを削除' }));
    expect(mock.rpc.mock.calls.filter(([name]) => name === 'admin_delete_users')).toHaveLength(1);
    expect(checkbox.disabled).toBe(true);
    await act(async () => resolve({ error: { code: 'NETWORK' } }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(checkbox.checked).toBe(true);
    await user.click(screen.getByRole('button', { name: '選択したアカウントを削除' }));
    expect(await screen.findByText('1件のアカウントを削除しました。')).toBeTruthy();
  });

  it('待機中に非管理者へ切り替わっても応答を画面に表示しない', async () => {
    let resolve;
    mock.rpc.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = renderApp();
    mock.auth = { ...mock.auth, role: 'viewer', canEdit: false };
    view.rerender(<BrowserRouter><App /></BrowserRouter>);
    await act(async () => resolve({ data: { users: mock.users, invitations: [] }, error: null }));
    expect(screen.queryByText('登録ユーザー')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
