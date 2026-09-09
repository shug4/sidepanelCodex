import { FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function Page1() {
  return (
    <>
      <PageHeader eyebrow="PAGE 01" title="ページ1" description="情報やメモをまとめるためのページです。" />
      <section className="content-panel">
        <div className="panel-heading"><span className="card-icon"><FileText size={21} aria-hidden="true" /></span><h2>サンプルコンテンツ</h2><span className="subtle-badge">サンプル</span></div>
        <div className="panel-body"><h3>最初のページへようこそ</h3><p>このスペースには、一覧やフォーム、作業に必要な情報などを配置できます。</p><p>アプリの目的に合わせて、自由に内容を置き換えてください。</p></div>
      </section>
    </>
  );
}
