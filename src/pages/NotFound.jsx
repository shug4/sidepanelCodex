import { Link } from 'react-router';
import PageHeader from '../components/PageHeader';

export default function NotFound() {
  return <><PageHeader eyebrow="404" title="ページが見つかりません" description="URLを確認するか、ホームへ戻ってください。" /><Link to="/" className="primary-button">ホームに戻る</Link></>;
}
