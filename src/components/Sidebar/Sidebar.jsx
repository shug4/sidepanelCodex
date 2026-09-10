import { memo, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, Command } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { groupMenu, menuItems } from '../../data/menuItems';

const defaultBrand = <><span className="brand-icon"><Command size={20} aria-hidden="true" /></span><span className="brand-name">Workspace</span></>;
const defaultFooter = <><span className="avatar">U</span><span className="user-info">ユーザー<span>パーソナルスペース</span></span></>;

function Sidebar({ collapsed, isMobile, mobileOpen, onToggle, onClose, onExpand, items = menuItems, brand = defaultBrand, footer = defaultFooter, auth }) {
  const sidebarRef = useRef(null);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  const logoutRef = useRef(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const compact = !isMobile && collapsed;
  const metadata = auth?.user?.user_metadata;
  const name = metadata?.full_name || metadata?.name || auth?.user?.email || 'ユーザー';
  const avatar = metadata?.avatar_url || metadata?.picture;
  const roleLabel = { admin: '管理者', editor: '編集者', viewer: '閲覧者' }[auth?.role] ?? (auth?.loading ? '取得中' : '未設定');
  const accountAvatar = <span className="avatar">{avatar && failedAvatar !== avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatar)} /> : name.slice(0, 1)}</span>;

  useEffect(() => {
    setAccountOpen(false);
  }, [collapsed, isMobile, mobileOpen, auth?.user?.id]);

  useEffect(() => {
    if (!accountOpen) return;
    logoutRef.current?.focus();
    const closeOutside = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      // モバイルでは最初のEscでポップアップだけを閉じる。
      event.preventDefault();
      event.stopPropagation();
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const panel = sidebarRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.querySelector('button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button, a[href], [tabindex="0"]')]
        .filter((element) => !element.closest('[hidden]') && !element.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isMobile, mobileOpen, onClose]);

  return (
    <>
      {isMobile && mobileOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside id="app-sidebar" ref={sidebarRef}
        className={`sidebar${compact ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}
        role={isMobile && mobileOpen ? 'dialog' : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined} aria-label="サイドパネル"
        inert={isMobile && !mobileOpen ? true : undefined}>
        <div className="sidebar-top">
          <div className="brand">{brand}</div>
          <button type="button" className="icon-button sidebar-toggle" onClick={isMobile ? onClose : onToggle}
            aria-label={isMobile ? 'メニューを閉じる' : compact ? 'サイドパネルを開く' : 'サイドパネルを閉じる'}
            title={compact ? 'サイドパネルを開く' : 'サイドパネルを閉じる'}
            aria-expanded={isMobile ? mobileOpen : !collapsed} aria-controls="sidebar-navigation">
            {isMobile ? <X size={19} /> : compact ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>
        <nav id="sidebar-navigation" aria-label="メインメニュー" className="sidebar-navigation">
          {groupMenu(items).map(([category, entries]) => (
            <div className="menu-group" key={category}>
              <p className="menu-category">{category}</p>
              <ul>{entries.map((item) => <SidebarItem key={item.id} item={item} collapsed={compact} onNavigate={onClose} onExpand={onExpand} />)}</ul>
            </div>
          ))}
        </nav>
        {auth && footer === defaultFooter ? (
          <div className="sidebar-account" ref={accountRef}>
            {auth.user && accountOpen && (
              <div id="account-menu" className="account-menu" role="dialog" aria-label="アカウントメニュー">
                <div className="account-menu-identity">{accountAvatar}<span className="account-menu-name">{name}</span></div>
                <p className="account-menu-email">{auth.user.email}</p>
                <p className="account-menu-role">権限：{roleLabel}</p>
                <button type="button" className="account-menu-logout" ref={logoutRef} disabled={auth.busy} onClick={auth.accountAction}>ログアウト</button>
              </div>
            )}
            <button type="button" className="sidebar-footer" ref={accountButtonRef}
              onClick={auth.user ? () => setAccountOpen((open) => !open) : auth.accountAction}
              disabled={auth.busy || auth.loading && !auth.user}
              aria-label={auth.user ? `${name}：アカウントメニュー` : 'Googleでログイン'}
              aria-haspopup={auth.user ? 'dialog' : undefined}
              aria-expanded={auth.user ? accountOpen : undefined}
              aria-controls={auth.user && accountOpen ? 'account-menu' : undefined}
              title={auth.error || (auth.user ? 'アカウントメニュー' : 'Googleでログイン')}>
              {auth.user ? <>{accountAvatar}<span className="user-info">{name}<span>パーソナルスペース</span></span></> : defaultFooter}
            </button>
          </div>
        ) : <div className="sidebar-footer">{footer}</div>}
      </aside>
    </>
  );
}

// ルート変更はNavLink側で反映する。Sidebar全体を再マウントしない。
export default memo(Sidebar);
