import { Outlet, useOutletContext } from 'react-router';

// 今後の会員限定ルート/コンテンツ用。実データはDB側のcan_view()とRLSでも保護する。
export default function RequireMember({ children }) {
  const context = useOutletContext();
  if (context.auth.loading) return <p role="status">ログイン状態を確認しています…</p>;
  if (!context.auth.canView) return <p role="alert">このコンテンツを見るには、招待・許可されたアカウントでログインしてください。</p>;
  return children ?? <Outlet context={context} />;
}
