import { memo, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, Command } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { groupMenu, menuItems } from '../../data/menuItems';

const defaultBrand = <><span className="brand-icon"><Command size={20} aria-hidden="true" /></span><span className="brand-name">Workspace</span></>;
const defaultFooter = <><span className="avatar">U</span><span className="user-info">ユーザー<span>パーソナルスペース</span></span></>;

function Sidebar({ collapsed, isMobile, mobileOpen, onToggle, onClose, onExpand, items = menuItems, brand = defaultBrand, footer = defaultFooter, auth }) {
  const sidebarRef = useRef(null);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const compact = !isMobile && collapsed;
  const metadata = auth?.user?.user_metadata;
  const name = metadata?.full_name || metadata?.name || auth?.user?.email || 'ユーザー';
  const avatar = metadata?.avatar_url || metadata?.picture;

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
          <button type="button" className="sidebar-footer" onClick={auth.accountAction}
            disabled={auth.busy || auth.loading && !auth.user}
            aria-label={auth.user ? `${name}：ログアウト` : 'Googleでログイン'}
            title={auth.error || (auth.user ? 'ログアウト' : 'Googleでログイン')}>
            {auth.user ? <>
              <span className="avatar">{avatar && failedAvatar !== avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatar)} /> : name.slice(0, 1)}</span>
              <span className="user-info">{name}<span>ログアウト</span></span>
            </> : defaultFooter}
          </button>
        ) : <div className="sidebar-footer">{footer}</div>}
      </aside>
    </>
  );
}

// ルート変更はNavLink側で反映する。Sidebar全体を再マウントしない。
export default memo(Sidebar);
