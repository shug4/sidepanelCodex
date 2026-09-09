# サイドパネル付き React SPA ひな型

React + Vite + React Router。PCでは折りたためるサイドパネル、767px以下ではオーバーレイ式メニューを表示します。

## 起動・確認

Node.js 22.12以上（24 LTS推奨）を使用します。

```sh
npm install
npm run dev
```

ターミナルに表示されるURLを開いてください。ポートを指定する場合は `npm run dev -- --port 5173`。

```sh
npm test         # 遷移・状態復元・モバイル操作などの結合テスト
npm run build   # dist/ に本番用ファイルを出力
npm run preview # 本番ビルドをローカルで確認
```

## ファイルと役割

```text
src/
  components/
    Sidebar/
      Sidebar.jsx        サイドパネル本体、ロゴ・フッターの差し替え口、モバイル操作
      SidebarItem.jsx    NavLink、選択表示、再帰的なサブメニュー
    PageHeader.jsx       ページ共通の見出し
  layouts/
    MainLayout.jsx       Sidebar + ヘッダー + main/Outlet、開閉state、遷移時処理
  pages/
    Home.jsx             ホームとページへのショートカット
    Page1.jsx            /page1 の仮ページ
    Page2.jsx            /page2 の仮ページ
    Settings.jsx         /settings の表示設定
    NotFound.jsx         未定義URLの404表示
  data/
    menuItems.js         メニュー、アイコン、カテゴリ定義
  hooks/
    usePersistentState.js localStorageの読み書き（失敗時はstateのみで継続）
    useIsMobile.js       メディアクエリの購読
  test/
    App.test.jsx         SPAの動作テスト
    setup.js             テスト環境初期化
  App.jsx                ルート定義
  main.jsx               ReactとBrowserRouterのエントリーポイント
  styles.css             共通トークン、レイアウト、レスポンシブ・モーション設定
index.html               HTML言語、タイトル、メタ情報
vite.config.js           Reactプラグインとテスト設定
package.json             依存パッケージ、起動・ビルド・テストコマンド
package-lock.json        依存バージョンの固定
.gitignore               生成物・環境変数の除外
```

## ページを追加する

1. `src/pages/Page3.jsx` を作成します。

```jsx
import PageHeader from '../components/PageHeader';

export default function Page3() {
  return <PageHeader title="ページ3" description="新しいページです。" />;
}
```

2. `src/App.jsx` にimportと、`MainLayout`の子ルートを追加します。

```jsx
import Page3 from './pages/Page3';

// <Route element={<MainLayout />}> の中に追加
<Route path="page3" element={<Page3 />} />
```

## サイドパネルの項目を追加する

`src/data/menuItems.js` の配列に1件追加します。サイドパネルのJSXは変更不要です。

```js
{ id: 'page3', label: 'ページ3', icon: FileText, path: '/page3', category: 'ワークスペース' }
```

`id`は全階層で一意、`path`はルート定義に対応する絶対パスにします。メニューを追加してもページ本体は生成されないため、新しいページには上記のルート追加も必要です。ホームのショートカットは独立したサンプルなので、必要に応じて`Home.jsx`も変更してください。

## 拡張する場所

- **アイコン**: `menuItems.js`で`lucide-react`から必要なアイコンをimportし、`icon`へコンポーネントを渡します。省略時は丸アイコンになります。
- **カテゴリ**: 各項目の`category`を指定。同名はまとめられ、最初の出現順で表示されます。省略時は「メニュー」です。
- **サブメニュー**: 以下のように`children`を指定します。親項目は開閉ボタン、葉の項目はリンクです。折りたたみ中に親を押すとパネルと子項目が開きます。
- **ロゴ・ユーザー情報**: `MainLayout.jsx`の`Sidebar`に`brand`と`footer` propsで任意のReact要素を渡せます。標準表示を直接変更する場合は`Sidebar.jsx`を編集します。コンパクト時に隠す文字には`brand-name`または`user-info`クラスを使用してください。
- **外観**: `styles.css`冒頭の色、幅、角丸、アニメーションのCSS変数を変更します。
- **画面幅の境界**: `styles.css`と`useIsMobile.js`の767pxを一緒に変更します。
- **設定項目**: `Settings.jsx`に追加します。サイドパネルのstateは`MainLayout.jsx`から`useOutletContext()`で共有しています。
- **保存キー**: `MainLayout.jsx`の`workspace.sidebar.collapsed`をアプリ固有の名前に変更できます。

```js
{
  id: 'projects',
  label: 'プロジェクト',
  icon: Layers,
  category: 'ワークスペース',
  children: [
    { id: 'projects-list', label: '一覧', icon: FileText, path: '/projects' },
    { id: 'projects-archive', label: 'アーカイブ', icon: Layers, path: '/projects/archive' },
  ],
}
```

## レイアウトと状態の考え方

`BrowserRouter` → `Routes` → `MainLayout` → `Outlet`の構成です。共通レイアウトを各ページの外に置くため、遷移してもSidebarはアンマウントされず、開閉・サブメニューのstateを維持します。Sidebar本体は`memo`化し、ルート依存の処理は子コンポーネントへ分離しています。アクティブ表示を持つ`NavLink`などは遷移時に必要な再レンダーを行います。「Reactの再レンダー」と「ページ全体の再読み込み」は別です。

PCの開閉状態だけを`localStorage`へ保存し、モバイルの一時的な開閉は保存しません。モバイルはメニュー選択・背景クリック・閉じるボタン・Escで閉じ、Tabキーのフォーカスをメニュー内に保ちます。背景領域には`inert`を付けます。OSのモーション軽減設定にも対応しています。

開発時の`StrictMode`はReactが副作用を検証するため初回に追加実行を行います。ルート遷移による再マウントではありません。

## 公開する場合

`dist/`を静的ホスティングへ配置できます。`BrowserRouter`を使用しているため、`/page1`などへの直接アクセス・再読み込みを処理するには、サーバーで未解決のアプリURLを`index.html`にフォールバックさせてください。Viteの開発・プレビューサーバーはこの動作に対応しています。サブディレクトリへ公開する場合はViteの`base`と`BrowserRouter`の`basename`を揃えます。

参考: [React Routerのルーティング](https://reactrouter.com/start/declarative/routing)、[Viteのガイド](https://vite.dev/guide/)。
