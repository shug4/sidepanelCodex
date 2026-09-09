import { memo, useState } from 'react';
import { NavLink } from 'react-router';
import { ChevronDown, Circle } from 'lucide-react';

function SidebarItem({ item, collapsed, onNavigate, onExpand }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = item.icon ?? Circle;
  const content = <><Icon size={19} aria-hidden="true" /><span className="menu-label">{item.label}</span></>;

  if (item.children?.length) {
    return (
      <li>
        <button className="sidebar-item" type="button" title={collapsed ? item.label : undefined}
          aria-label={item.label} aria-expanded={!collapsed && expanded} aria-controls={`submenu-${item.id}`}
          onClick={() => { if (collapsed) onExpand(); setExpanded(collapsed || !expanded); }}>
          {content}<ChevronDown size={15} className={`submenu-chevron ${expanded ? 'expanded' : ''}`} aria-hidden="true" />
        </button>
        <ul id={`submenu-${item.id}`} className="submenu" hidden={collapsed || !expanded}>
          {item.children.map((child) => <SidebarItem key={child.id} item={child} collapsed={false} onNavigate={onNavigate} onExpand={onExpand} />)}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <NavLink to={item.path} end={item.path === '/'} onClick={onNavigate}
        title={collapsed ? item.label : undefined} aria-label={item.label}
        className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
        {content}<span className="active-dot" aria-hidden="true" />
      </NavLink>
    </li>
  );
}

export default memo(SidebarItem);
