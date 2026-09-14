import { useOutletContext } from 'react-router';
import PageHeader from '../components/PageHeader';

export default function Page3() {
  const { auth } = useOutletContext();

  return (
    <>
      <PageHeader eyebrow="PAGE 03" title="ページ3" description="権限に応じたメッセージを表示します。" />
      <section className="content-panel">
        <div className="panel-heading"><h2>メッセージ</h2></div>
        <div className="panel-body">
          <p>これは誰でも見られるメッセージです</p>
          {!auth.loading && auth.canView && <p>これは閲覧者以上のみが見られるメッセージです</p>}
          {!auth.loading && auth.canEdit && <p>これは編集者以上のみが見られるメッセージです</p>}
        </div>
      </section>
    </>
  );
}
