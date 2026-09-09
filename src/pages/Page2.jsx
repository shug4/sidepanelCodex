import { Layers } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function Page2() {
  return (
    <>
      <PageHeader eyebrow="PAGE 02" title="ページ2" description="もうひとつの作業スペースです。" />
      <section className="content-panel">
        <div className="panel-heading"><span className="card-icon"><Layers size={21} aria-hidden="true" /></span><h2>サンプルコンテンツ</h2><span className="subtle-badge">サンプル</span></div>
        <div className="panel-body"><h3>アイデアを広げる場所</h3><p>こちらには、ページ1とは別の内容を表示できます。</p><p>レポートや資料、プロジェクトの詳細など、必要なページへ育てていきましょう。</p></div>
      </section>
    </>
  );
}
