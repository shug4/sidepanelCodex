import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router';
import { Menu, ChevronRight } from 'lucide-react';
import Sidebar from '../components/Sidebar/Sidebar';
import { flattenMenu, menuItems } from '../data/menuItems';
import usePersistentState from '../hooks/usePersistentState';
import useIsMobile from '../hooks/useIsMobile';

const Header = memo(function Header({ onOpen }) {
  const { pathname } = useLocation();
  const current = flattenMenu(menuItems).find((item) => matchPath({ path: item.path, end: item.path === '/' }, pathname));
  return (
    <header className="main-header">
      <button type="button" className="icon-button mobile-menu-button" onClick={onOpen} aria-label="メニューを開く" aria-haspopup="dialog" aria-controls="app-sidebar"><Menu size={21} /></button>
      <div className="breadcrumb"><span>ワークスペース</span><ChevronRight size={14} aria-hidden="true" /><span>{current?.label ?? 'ページが見つかりません'}</span></div>
      <span className="header-badge">パーソナル</span>
    </header>
  );
});

// ルート依存の処理を分離し、遷移時にMainLayoutやSidebarのstateを作り直さない。
function RouteEffects({ onNavigate, contentRef }) {
  const { pathname } = useLocation();
  useEffect(() => {
    onNavigate();
    const title = contentRef.current?.querySelector('h1')?.textContent;
    document.title = `${title ?? 'ホーム'} | Workspace`;
    contentRef.current?.scrollTo?.(0, 0);
    contentRef.current?.focus({ preventScroll: true });
  }, [pathname, onNavigate, contentRef]);
  return null;
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = usePersistentState('workspace.sidebar.collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const contentRef = useRef(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const toggleSidebar = useCallback(() => setCollapsed((value) => !value), [setCollapsed]);
  const expandSidebar = useCallback(() => setCollapsed(false), [setCollapsed]);
  const preferences = useMemo(() => ({ collapsed, setCollapsed }), [collapsed, setCollapsed]);

  useEffect(() => { if (!isMobile) closeMobile(); }, [isMobile, closeMobile]);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">メインコンテンツへ移動</a>
      <Sidebar collapsed={collapsed} isMobile={isMobile} mobileOpen={mobileOpen} onToggle={toggleSidebar} onClose={closeMobile} onExpand={expandSidebar} />
      <div className="main-shell" inert={isMobile && mobileOpen ? true : undefined}>
        <Header onOpen={openMobile} />
        <main id="main-content" className="main-content" ref={contentRef} tabIndex={-1}>
          <div className="page-container"><Outlet context={preferences} /></div>
        </main>
      </div>
      <RouteEffects onNavigate={closeMobile} contentRef={contentRef} />
    </div>
  );
}
