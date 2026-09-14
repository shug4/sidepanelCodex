import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from '../App';

const mock = vi.hoisted(() => ({ auth: null }));
vi.mock('../hooks/useAuth', () => ({ default: () => mock.auth }));
vi.mock('../lib/supabase', () => ({ supabase: null }));
const renderApp = () => render(<BrowserRouter><App /></BrowserRouter>);
const publicMessage = 'これは誰でも見られるメッセージです';
const viewerMessage = 'これは閲覧者以上のみが見られるメッセージです';
const editorMessage = 'これは編集者以上のみが見られるメッセージです';

beforeEach(() => {
  window.history.replaceState(null, '', '/page3');
  mock.auth = { user: null, role: null, canView: false, canEdit: false, loading: false };
});

describe('ページ3のメッセージ表示', () => {
  it.each([
    ['ゲスト', null, false, false],
    ['閲覧者', 'viewer', true, false],
    ['編集者', 'editor', true, true],
    ['管理者', 'admin', true, true],
    ['未許可', null, false, false],
  ])('%sには権限に合ったメッセージだけ表示する', (_label, role, canView, canEdit) => {
    mock.auth = { ...mock.auth, role, user: role ? { id: role } : null, canView, canEdit };
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'ページ3' })).toBeTruthy();
    expect(screen.getByText(publicMessage)).toBeTruthy();
    expect(Boolean(screen.queryByText(viewerMessage))).toBe(canView);
    expect(Boolean(screen.queryByText(editorMessage))).toBe(canEdit);
  });

  it('権限確認中とログアウト後は限定メッセージを表示しない', () => {
    mock.auth = { ...mock.auth, user: { id: 'admin' }, role: 'admin', canView: true, canEdit: true };
    const view = renderApp();
    expect(screen.getByText(editorMessage)).toBeTruthy();
    mock.auth = { ...mock.auth, loading: true };
    view.rerender(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByText(publicMessage)).toBeTruthy();
    expect(screen.queryByText(viewerMessage)).toBeNull();
    expect(screen.queryByText(editorMessage)).toBeNull();
    mock.auth = { user: null, role: null, canView: false, canEdit: false, loading: false };
    view.rerender(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByText(publicMessage)).toBeTruthy();
    expect(screen.queryByText(viewerMessage)).toBeNull();
    expect(screen.queryByText(editorMessage)).toBeNull();
  });

  it('未ログインでもホームとサイドメニューからページ3へ移動できる', async () => {
    window.history.replaceState(null, '', '/');
    renderApp();
    const links = screen.getAllByRole('link', { name: /ページ3/ });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('/page3');
    await userEvent.setup().click(screen.getByRole('link', { name: 'ページ3', exact: true }));
    expect(window.location.pathname).toBe('/page3');
    expect(screen.getByText(publicMessage)).toBeTruthy();
  });
});
