import { useOutletContext } from 'react-router';
import { PanelLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function Settings() {
  const { collapsed, setCollapsed } = useOutletContext();
  return (
    <>
      <PageHeader eyebrow="PREFERENCES" title="設定" description="使いやすい表示に整えましょう。" />
      <section className="content-panel">
        <div className="panel-heading"><span className="card-icon"><PanelLeft size={21} aria-hidden="true" /></span><h2>表示設定</h2></div>
        <div className="setting-row"><div><label htmlFor="compact-sidebar">サイドパネルをコンパクトに表示</label><p id="compact-description">PCではアイコンのみを表示します。設定はこのブラウザに保存されます。</p></div>
          <input id="compact-sidebar" className="switch" type="checkbox" role="switch" checked={collapsed} onChange={(event) => setCollapsed(event.target.checked)} aria-describedby="compact-description" />
        </div>
        <div className="settings-note">スマートフォンでは、画面上部のメニューボタンからサイドパネルを開けます。</div>
      </section>
    </>
  );
}
