import { Home, FileText, Layers, Settings, Users } from 'lucide-react';

// iconにはReactコンポーネントを渡す。childrenは同じ形式で再帰的に定義できる。
// childrenを持つ項目は展開ボタンとなり、pathは葉の項目に指定する。
export const menuItems = [
  { id: 'home', label: 'ホーム', icon: Home, path: '/', category: 'ワークスペース' },
  { id: 'page1', label: 'ページ1', icon: FileText, path: '/page1', category: 'ワークスペース' },
  { id: 'page2', label: 'ページ2', icon: Layers, path: '/page2', category: 'ワークスペース' },
  { id: 'settings', label: '設定', icon: Settings, path: '/settings', category: '管理' },
  { id: 'users', label: 'ユーザー管理', icon: Users, path: '/users', category: '管理', adminOnly: true },
];

export function flattenMenu(items) {
  return items.flatMap((item) => item.children ? flattenMenu(item.children) : [item]);
}

export function groupMenu(items) {
  const groups = new Map();
  for (const item of items) {
    const category = item.category ?? 'メニュー';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  return Array.from(groups);
}
