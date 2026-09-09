import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import App from '../App';
import Sidebar from '../components/Sidebar/Sidebar';

function renderApp() { return render(<BrowserRouter><App /></BrowserRouter>); }

describe('再利用できるSPAレイアウト', () => {
  it('同じSidebar DOMと開閉状態を維持して遷移し、戻る・進むにも対応する', async () => {
    const user = userEvent.setup();
    renderApp();
    const sidebar = screen.getByRole('complementary', { name: 'サイドパネル' });
    await user.click(screen.getByRole('button', { name: 'サイドパネルを閉じる' }));
    await user.click(within(sidebar).getByRole('link', { name: 'ページ1' }));
    expect(window.location.pathname).toBe('/page1');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ページ1');
    expect(screen.getByRole('complementary')).toBe(sidebar);
    expect(sidebar.classList.contains('is-collapsed')).toBe(true);
    expect(within(sidebar).getByRole('link', { name: 'ページ1' }).getAttribute('aria-current')).toBe('page');
    await user.click(within(sidebar).getByRole('link', { name: 'ページ2' }));
    window.history.back();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ページ1'));
    window.history.forward();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ページ2'));
    expect(screen.getByRole('complementary')).toBe(sidebar);
  });

  it('設定と開閉ボタンを同期し、再マウント後にも保存状態を復元する', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/settings');
    const view = renderApp();
    await user.click(screen.getByRole('switch'));
    expect(localStorage.getItem('workspace.sidebar.collapsed')).toBe('true');
    expect(screen.getByRole('complementary').classList.contains('is-collapsed')).toBe(true);
    view.unmount();
    renderApp();
    expect(screen.getByRole('switch').checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'サイドパネルを開く' }));
    expect(screen.getByRole('switch').checked).toBe(false);
  });

  it('モバイルではフォーカスをメニュー内に保ち、選択・Esc・背景で閉じる', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup();
    const { container } = renderApp();
    const open = screen.getByRole('button', { name: 'メニューを開く' });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'サイドパネル' });
    expect(document.body.style.overflow).toBe('hidden');
    expect(container.querySelector('.main-shell').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'メニューを閉じる' }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: '設定' }));
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'メニューを閉じる' }));
    await user.click(within(dialog).getByRole('link', { name: 'ページ2' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ページ2');
    expect(document.body.style.overflow).toBe('');
    await user.click(open);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(open);
    await user.click(open);
    await user.click(container.querySelector('.sidebar-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('workspace.sidebar.collapsed')).toBe('false');
  });

  it('localStorageが壊れている場合や利用不可でも表示・開閉できる', async () => {
    localStorage.setItem('workspace.sidebar.collapsed', '{broken');
    const user = userEvent.setup();
    const view = renderApp();
    expect(screen.getByRole('button', { name: 'サイドパネルを閉じる' })).toBeTruthy();
    view.unmount();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    renderApp();
    await user.click(screen.getByRole('button', { name: 'サイドパネルを閉じる' }));
    expect(screen.getByRole('button', { name: 'サイドパネルを開く' })).toBeTruthy();
  });

  it('メニュー配列のカテゴリ・サブメニューを描画できる', async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><Sidebar items={[
      { id: 'tools', label: 'ツール', category: '追加カテゴリ', children: [{ id: 'detail', label: '詳細', path: '/detail' }] },
    ]} collapsed={false} isMobile={false} mobileOpen={false} onClose={() => {}} onToggle={() => {}} onExpand={() => {}} /></BrowserRouter>);
    expect(screen.getByText('追加カテゴリ')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '詳細' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'ツール' }));
    expect(screen.getByRole('link', { name: '詳細' }).getAttribute('href')).toBe('/detail');
  });

  it('不明なURLでも共通レイアウトと404ページを表示する', () => {
    window.history.replaceState(null, '', '/unknown');
    renderApp();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ページが見つかりません');
    expect(screen.getByRole('complementary')).toBeTruthy();
  });
});
