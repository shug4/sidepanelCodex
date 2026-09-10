import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
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
  id, user_metadata: { full_name: '山田 太郎', avatar_url: 'https://example.com/avatar.png', role: 'admin' },
} });

beforeEach(() => {
  vi.clearAllMocks();
  mock.initial = null;
  mock.query.mockResolvedValue({ data: null, error: null });
  mock.oauth.mockResolvedValue({ error: null });
  mock.signOut.mockImplementation(async () => { mock.listener('SIGNED_OUT', null); return { error: null }; });
});

describe('Google認証と権限', () => {
  it('既存のユーザー欄からOAuthを開始し、名前・画像を表示してログアウトできる', async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);
    await user.click(screen.getByRole('button', { name: 'Googleでログイン' }));
    expect(mock.oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    act(() => mock.listener('SIGNED_IN', session()));
    const account = await screen.findByRole('button', { name: '山田 太郎：ログアウト' });
    expect(account.className).toBe('sidebar-footer');
    expect(account.querySelector('img').getAttribute('src')).toBe('https://example.com/avatar.png');
    fireEvent.error(account.querySelector('img'));
    expect(account.querySelector('.avatar').textContent).toBe('山');
    await user.click(account);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByRole('button', { name: 'Googleでログイン' })).toBeTruthy();
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
