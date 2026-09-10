import { memo, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, Command, UserRound } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { groupMenu, menuItems } from '../../data/menuItems';

const defaultBrand = <><span className="brand-icon"><Command size={20} aria-hidden="true" /></span><span className="brand-name">Workspace</span></>;
const guestAvatar = <span className="avatar"><UserRound size={20} aria-hidden="true" /></span>;
const defaultFooter = <>{guestAvatar}<span className="user-info">ゲストモード</span></>;
const googleIcon = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path fill="#4285F4" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92c-.26 1.28-1.04 2.37-2.21 3.1v2.58h3.58c2.08-1.92 3.27-4.75 3.27-7.55Z" />
  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.58-2.78c-.98.66-2.24 1.06-3.7 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
  <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.15A11 11 0 0 0 1 12c0 1.78.43 3.45 1.15 4.93l3.69-2.84Z" />
  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A10.56 10.56 0 0 0 12 1a11 11 0 0 0-9.85 6.07l3.69 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
</svg>;

function Sidebar({ collapsed, isMobile, mobileOpen, onToggle, onClose, onExpand, items = menuItems, brand = defaultBrand, footer = defaultFooter, auth }) {
  const sidebarRef = useRef(null);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  const accountActionRef = useRef(null);
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
    if (auth?.error && !auth.user && (!isMobile || mobileOpen)) setAccountOpen(true);
  }, [auth?.error, auth?.user?.id, isMobile, mobileOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    accountActionRef.current?.focus();
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
          {groupMenu(items.filter((item) => !item.adminOnly || auth?.user && !auth.loading && auth.role === 'admin' && auth.canEdit)).map(([category, entries]) => (
            <div className="menu-group" key={category}>
              <p className="menu-category">{category}</p>
              <ul>{entries.map((item) => <SidebarItem key={item.id} item={item} collapsed={compact} onNavigate={onClose} onExpand={onExpand} />)}</ul>
            </div>
          ))}
        </nav>
        {auth && footer === defaultFooter ? (
          <div className="sidebar-account" ref={accountRef}>
            {accountOpen && (
              <div id="account-menu" className="account-menu" role="dialog" aria-label="アカウントメニュー">
                {auth.user ? <>
                  <div className="account-menu-identity">{accountAvatar}<span className="account-menu-name">{name}</span></div>
                  <p className="account-menu-email">{auth.user.email}</p>
                  <p className="account-menu-role">権限：{roleLabel}</p>
                </> : <div className="account-menu-identity account-menu-guest">
                  {guestAvatar}<div className="account-menu-guest-text"><strong>ゲストモード</strong><span>ログインしていません</span></div>
                </div>}
                {auth.error && <p className="account-menu-role" role="alert">{auth.error}</p>}
                <button type="button" className={`account-menu-logout${auth.user ? '' : ' account-menu-login'}`} ref={accountActionRef} disabled={auth.busy || auth.loading && !auth.user} onClick={auth.accountAction}>{auth.user ? 'ログアウト' : <>{googleIcon}<span>Googleでログイン</span></>}</button>
              </div>
            )}
            <button type="button" className="sidebar-footer" ref={accountButtonRef}
              onClick={() => setAccountOpen((open) => !open)}
              disabled={auth.busy || auth.loading && !auth.user}
              aria-label={auth.user ? `${name}：アカウントメニュー` : 'ゲストモード：アカウントメニュー'}
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              aria-controls={accountOpen ? 'account-menu' : undefined}
              title={auth.error || 'アカウントメニュー'}>
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
