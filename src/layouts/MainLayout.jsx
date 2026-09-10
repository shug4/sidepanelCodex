import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar/Sidebar';
import usePersistentState from '../hooks/usePersistentState';
import useIsMobile from '../hooks/useIsMobile';
import useAuth from '../hooks/useAuth';

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
  const auth = useAuth();
  const [collapsed, setCollapsed] = usePersistentState('workspace.sidebar.collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const contentRef = useRef(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const toggleSidebar = useCallback(() => setCollapsed((value) => !value), [setCollapsed]);
  const expandSidebar = useCallback(() => setCollapsed(false), [setCollapsed]);
  const preferences = useMemo(() => ({ collapsed, setCollapsed, auth }), [collapsed, setCollapsed, auth]);

  useEffect(() => { if (!isMobile) closeMobile(); }, [isMobile, closeMobile]);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">メインコンテンツへ移動</a>
      <Sidebar collapsed={collapsed} isMobile={isMobile} mobileOpen={mobileOpen} onToggle={toggleSidebar} onClose={closeMobile} onExpand={expandSidebar} auth={auth} />
      <div className="main-shell" inert={isMobile && mobileOpen ? true : undefined}>
        <main id="main-content" className="main-content" ref={contentRef} tabIndex={-1}>
          <div className="page-container">
            <button type="button" className="icon-button mobile-menu-button" onClick={openMobile} aria-label="メニューを開く" aria-haspopup="dialog" aria-controls="app-sidebar"><Menu size={21} /></button>
            <Outlet context={preferences} />
          </div>
        </main>
      </div>
      <RouteEffects onNavigate={closeMobile} contentRef={contentRef} />
    </div>
  );
}
