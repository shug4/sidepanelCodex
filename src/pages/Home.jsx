import { Link } from 'react-router';
import { ArrowUpRight, FileText, Layers, Settings, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const pages = [
  { title: 'ページ1', description: '情報をまとめる、最初のページ。', path: '/page1', icon: FileText, number: '01' },
  { title: 'ページ2', description: 'アイデアを広げる、もうひとつのページ。', path: '/page2', icon: Layers, number: '02' },
  { title: '設定', description: 'ワークスペースの表示を調整。', path: '/settings', icon: Settings, number: '03' },
];

export default function Home() {
  return (
    <>
      <PageHeader eyebrow="OVERVIEW" title="ホーム" description="ここから、今日の作業をはじめましょう。" />
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-marker">YOUR SPACE</div>
        <h2 id="welcome-title">自分らしいワークスペースへ。</h2>
        <p>ページを選んで、必要な情報や作業をひとつの場所に。</p>
        <Link to="/page1" className="primary-button">ページ1を開く<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
      <div className="section-heading"><h2>ページ一覧</h2><span>3 ページ</span></div>
      <div className="page-grid">
        {pages.map(({ title, description, path, icon: Icon, number }) => (
          <Link className="page-card" to={path} key={path}>
            <div className="card-top"><span className="card-icon"><Icon size={22} aria-hidden="true" /></span><ArrowUpRight size={18} className="card-arrow" aria-hidden="true" /></div>
            <h3>{title}</h3><p>{description}</p><span className="card-number">{number}</span>
          </Link>
        ))}
      </div>
      <p className="home-note">左のメニューから、いつでもページを切り替えられます。</p>
    </>
  );
}
