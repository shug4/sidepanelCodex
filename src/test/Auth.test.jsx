import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from '../App';
import useAuth from '../hooks/useAuth';

const mock = vi.hoisted(() => ({
  listener: null, initial: null, unsubscribe: vi.fn(), query: vi.fn(),
  oauth: vi.fn(), signOut: vi.fn(), eq: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: {
    onAuthStateChange: (listener) => {
      mock.listener = listener;
      listener('INITIAL_SESSION', mock.initial);
      return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
    },
    signInWithOAuth: (...args) => mock.oauth(...args),
    signOut: (...args) => mock.signOut(...args),
  },
  from: (table) => {
    expect(table).toBe('profiles');
    return { select: () => ({ eq: (...args) => { mock.eq(...args); return { maybeSingle: mock.query }; } }) };
  },
} }));

const session = (id = 'google-user') => ({ access_token: `token-${id}`, user: {
  id, email: 'taro@example.com', user_metadata: { full_name: '山田 太郎', avatar_url: 'https://example.com/avatar.png', role: 'admin' },
} });

beforeEach(() => {
  vi.clearAllMocks();
  mock.initial = null;
  mock.query.mockResolvedValue({ data: null, error: null });
  mock.oauth.mockResolvedValue({ error: null });
  mock.signOut.mockImplementation(async () => { mock.listener('SIGNED_OUT', null); return { error: null }; });
});

describe('Google認証と権限', () => {
  it('ユーザー欄で開いたメニューからのみOAuthを開始し、名前・画像を表示してログアウトできる', async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.queryByRole('button', { name: 'Googleでログイン' })).toBeNull();
    const guest = screen.getByRole('button', { name: 'ゲストモード：アカウントメニュー' });
    expect(guest.textContent).toBe('ゲストモード');
    await user.click(guest);
    const guestMenu = screen.getByRole('dialog', { name: 'アカウントメニュー' });
    expect(within(guestMenu).getByText('ゲストモード')).toBeTruthy();
    expect(within(guestMenu).getByText('ログインしていません')).toBeTruthy();
    expect(mock.oauth).not.toHaveBeenCalled();
    const login = within(screen.getByRole('dialog', { name: 'アカウントメニュー' })).getByRole('button', { name: 'Googleでログイン' });
    expect(document.activeElement).toBe(login);
    await user.click(login);
    expect(mock.oauth).toHaveBeenCalledOnce();
    expect(mock.oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    act(() => mock.listener('SIGNED_IN', session()));
    const account = await screen.findByRole('button', { name: '山田 太郎：アカウントメニュー' });
    expect(account.className).toBe('sidebar-footer');
    expect(account.querySelector('img').getAttribute('src')).toBe('https://example.com/avatar.png');
    fireEvent.error(account.querySelector('img'));
    expect(account.querySelector('.avatar').textContent).toBe('山');
    await user.click(account);
    expect(mock.signOut).not.toHaveBeenCalled();
    const menu = screen.getByRole('dialog', { name: 'アカウントメニュー' });
    expect(within(menu).getByText('山田 太郎')).toBeTruthy();
    expect(within(menu).getByText('taro@example.com')).toBeTruthy();
    await user.click(within(menu).getByRole('button', { name: 'ログアウト' }));
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByRole('button', { name: 'ゲストモード：アカウントメニュー' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'アカウントメニュー' })).toBeNull();
  });

  it.each([['admin', '管理者'], ['editor', '編集者'], ['viewer', '閲覧者'], [null, '未設定']])('プロフィールの%sを%sと表示する', async (role, label) => {
    mock.initial = session();
    mock.query.mockResolvedValue({ data: role ? { role, is_allowed: true } : null, error: null });
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);
    await user.click(screen.getByRole('button', { name: '山田 太郎：アカウントメニュー' }));
    const menu = screen.getByRole('dialog', { name: 'アカウントメニュー' });
    expect(await within(menu).findByText(`権限：${label}`)).toBeTruthy();
    expect(menu.querySelector('img').getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(mock.signOut).not.toHaveBeenCalled();
  });

  it.each([true, false])('ログイン済み=%s：再クリック・外側クリック・Esc・折りたたみで閉じ、コンパクト表示でも開ける', async (signedIn) => {
    mock.initial = signedIn ? session() : null;
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);
    const account = screen.getByRole('button', { name: signedIn ? '山田 太郎：アカウントメニュー' : 'ゲストモード：アカウントメニュー' });
    const menu = () => screen.queryByRole('dialog', { name: 'アカウントメニュー' });
    await user.click(account);
    expect(account.getAttribute('aria-expanded')).toBe('true');
    await user.click(account);
    expect(menu()).toBeNull();
    await user.click(account);
    await user.click(screen.getByRole('heading', { level: 1 }));
    expect(menu()).toBeNull();
    await user.click(account);
    await user.keyboard('{Escape}');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(account);
    await user.click(account);
    // 外側クリックに依存せず、キーボード/プログラムによる閉鎖でもメニューを閉じる。
    fireEvent.click(screen.getByRole('button', { name: 'サイドパネルを閉じる' }));
    expect(menu()).toBeNull();
    await user.click(account);
    expect(menu()).toBeTruthy();
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(mock.oauth).not.toHaveBeenCalled();
  });

  it.each([true, false])('ログイン済み=%s：モバイルのEscはメニューを先に閉じ、サイドパネル閉鎖後に再表示しない', async (signedIn) => {
    mock.initial = signedIn ? session() : null;
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);
    await user.click(screen.getByRole('button', { name: 'メニューを開く' }));
    const account = screen.getByRole('button', { name: signedIn ? '山田 太郎：アカウントメニュー' : 'ゲストモード：アカウントメニュー' });
    await user.click(account);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'アカウントメニュー' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'サイドパネル' })).toBeTruthy();
    await user.click(account);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを閉じる' }));
    await user.click(screen.getByRole('button', { name: 'メニューを開く' }));
    expect(screen.queryByRole('dialog', { name: 'アカウントメニュー' })).toBeNull();
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(mock.oauth).not.toHaveBeenCalled();
  });

  it.each([
    ['admin', true, true], ['editor', true, true], ['viewer', true, false],
    ['admin', false, false], ['editor', false, false], ['owner', true, false],
  ])('%s / 許可=%s の編集可否は %s', async (role, allowed, expected) => {
    mock.initial = session();
    mock.query.mockResolvedValue({ data: { role, is_allowed: allowed }, error: null });
    const { result, unmount } = renderHook(() => useAuth());
    expect(result.current.canEdit).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(expected);
    expect(mock.eq).toHaveBeenCalledWith('id', 'google-user');
    unmount();
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'error', 'network'])('権限が %s ならメタデータがadminでも編集不可', async (mode) => {
    mock.initial = session();
    if (mode === 'error') mock.query.mockResolvedValue({ data: null, error: new Error('denied') });
    if (mode === 'network') mock.query.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.role).toBeNull();
  });

  it('未ログイン時はプロフィールを取得せず編集不可', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.canEdit).toBe(false);
    expect(mock.query).not.toHaveBeenCalled();
  });

  it('ログアウト前に開始した取得結果で権限が復活しない', async () => {
    let resolve;
    mock.initial = session();
    mock.query.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useAuth());
    act(() => mock.listener('SIGNED_OUT', null));
    await act(async () => resolve({ data: { role: 'admin', is_allowed: true }, error: null }));
    expect(result.current.user).toBeNull();
    expect(result.current.canEdit).toBe(false);
  });

  it('アカウント変更・権限再取得中は旧ユーザーの編集権限を使わない', async () => {
    mock.initial = session();
    mock.query.mockResolvedValue({ data: { role: 'admin', is_allowed: true }, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    let resolve;
    mock.query.mockReturnValue(new Promise((done) => { resolve = done; }));
    act(() => mock.listener('SIGNED_IN', session('other-user')));
    expect(result.current.canEdit).toBe(false);
    await act(async () => resolve({ data: { role: 'viewer', is_allowed: true }, error: null }));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.role).toBe('viewer');
  });

  it.each(['login', 'logout'])('%s失敗を通知し、再操作できる', async (action) => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    if (action === 'logout') mock.initial = session();
    const api = action === 'login' ? mock.oauth : mock.signOut;
    api.mockResolvedValue({ error: new Error('failed') });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.accountAction(); });
    expect(alert).toHaveBeenCalledOnce();
    expect(result.current.busy).toBe(false);
    expect(Boolean(result.current.user)).toBe(action === 'logout');
  });
});
