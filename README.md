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
    MainLayout.jsx       Sidebar + main/Outlet、モバイルメニューボタン、開閉state、遷移時処理
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
vercel.json              Vercelのビルド・出力先とSPAフォールバック設定
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

## Vercel Hobbyで公開する（GitHub連携）

1. このプロジェクトをGitHubリポジトリへpushします。`vercel.json`と`package-lock.json`も含めます。`dist/`と`node_modules/`は不要です。
2. VercelのHobbyアカウントで新しいProjectを作成し、GitHubを接続して対象リポジトリをImportします。
3. Root Directoryは`package.json`と`vercel.json`があるディレクトリにします。リポジトリ直下に配置した場合は初期値のままです。
4. 以下の設定を確認してDeployします。Framework、Build Command、Output Directoryは`vercel.json`でも指定済みです。

| 項目 | 設定 |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | 自動検出（npm / package-lock.json） |

Node.jsは`package.json`の`engines`を満たすバージョンを使用します。Googleログインには下記の環境変数をホスティング先にも設定し、再ビルドしてください。接続後はProduction Branch（通常`main`）へのpushで本番が更新され、他のブランチへのpushやPull RequestではPreview Deploymentが作成されます。

### 直接アクセスと再読み込み

`vercel.json`にVercel公式のVite SPA向けrewriteを設定しています。

```json
"rewrites": [
  { "source": "/(.*)", "destination": "/index.html" }
]
```

`/page1`、`/page2`、`/settings`を直接開いた場合も、Vercelが`index.html`を返し、BrowserRouterがURLに対応するページを描画します。リダイレクトではないため、アドレスバーのURLは維持されます。既存のJS・CSSなどの静的ファイルはそのまま配信されます。

Viteの`base`は`'/'`を明示し、BrowserRouterは`basename`なしのままです。`https://プロジェクト名.vercel.app/`のようなルートドメインで動作します。HashRouterへの変更は不要です。

デプロイ後は公開URLの`/page1`、`/page2`、`/settings`を直接開き、各ページで再読み込みして表示を確認してください。`npm run preview`はVercelのrewrite自体を検証するものではありません。

公式手順: [Vite on Vercel（SPA設定）](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas)、[GitHub連携と自動デプロイ](https://vercel.com/docs/git/vercel-for-github)。

他の静的ホスティングへ`dist/`を配置する場合も、未解決のアプリURLを`index.html`にフォールバックさせてください。サブディレクトリへ公開する場合はViteの`base`と`BrowserRouter`の`basename`を揃えます。

参考: [React Routerのルーティング](https://reactrouter.com/start/declarative/routing)、[Viteのガイド](https://vite.dev/guide/)。

## Googleログインと権限

1. `.env.example`を`.env`にコピーし、SupabaseのProject URLと`sb_publishable_...`形式のPublishable Keyを設定します。`.env`はGit管理対象外です。service_role / Secret Keyは使用しません。変更後は開発サーバーを再起動し、本番は再ビルドします。
2. Google CloudでWeb用OAuthクライアントを作成し、リダイレクトURIにSupabaseのGoogle Provider画面に表示されるCallback URL（通常`https://PROJECT_REF.supabase.co/auth/v1/callback`）を登録します。Supabase AuthenticationのGoogle Providerを有効にし、Client IDとClient Secretを設定します。Google同意画面がテスト中なら対象アカウントをテストユーザーに登録します。
3. Supabase AuthenticationのURL ConfigurationでSite URLを本番URLに設定し、Redirect URLsに`http://localhost:5173/`と本番URL（末尾`/`付き）を登録します。ログイン後は同じオリジンのホームへ戻ります。
4. 初期構築時はSQL Editorで[`supabase/auth.sql`](supabase/auth.sql)を実行します。適用済みなら再実行は不要です。既に独自の`profiles`が存在する場合は既存定義と照合してください。最初の管理者は初回ログイン後、Authentication > UsersのUUIDを使い、SQL Editorで`profiles`行の`role = 'admin'`と`is_allowed = true`を設定します。ユーザー管理の追加手順は下記を参照してください。

サイドパネル下部をクリックすると直上にアカウントメニューが開きます。未ログイン時はメニュー内の「Googleでログイン」を押した場合のみGoogleログインを開始します。ログイン後はユーザー欄に名前・画像を表示します。メニューには名前・画像・メールアドレス・権限を表示し、「ログアウト」を押した場合のみ現在のブラウザからログアウトします。外側のクリック、Esc、サイドパネルを閉じたときにメニューも閉じます。長い名前はユーザー欄では省略し、メニューでは折り返します。画像を取得できない場合は名前の先頭文字を表示します。

ページ内では`const { auth } = useOutletContext()`で`auth.user` / `auth.role` / `auth.canEdit` / `auth.loading`を参照できます。`canEdit`は許可済みのadmin/editorのみtrueです。未ログイン、未登録、未許可、viewer、権限取得中・失敗時はfalseです。権限はユーザーメタデータではなく`profiles`から読み、認証イベント時に再取得します。

ブラウザ内のサイドパネル表示設定は全員が利用できます。一般コンテンツの編集UIと実行ハンドラーでは`auth.canEdit`を確認し、**編集対象テーブルにも必ずRLSを適用**してください。`auth.sql`末尾にSELECT/INSERT/UPDATE/DELETEのポリシー例があります。`public.can_edit()`はDB側の現在の権限を参照するため、フロントの値を書き換えてもDBの許可は変更されません。プロフィールへのクライアント直接書込みは許可せず、ユーザー管理のみ管理者専用RPCを使用します。

認証・権限テストはSupabaseをモックして実行します。実際のGoogle OAuthとDB側RLSは上記設定後、許可済みeditor・viewer・未登録アカウントで確認してください。

公式設定手順: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 管理者専用のユーザー管理

### Supabaseへの適用

既存の`auth.sql`を適用済みのプロジェクトで、最初の管理者を登録した後、SQL Editorから[`20260910071015_user_management.sql`](supabase/migrations/20260910071015_user_management.sql)、[`20260914073627_require_user_invitation.sql`](supabase/migrations/20260914073627_require_user_invitation.sql)の順に一度ずつ実行してください。適用済みのファイルは再実行不要です。後者は未招待アカウントのAuth登録をDBトリガーで拒否します。Auth Hookの追加設定は不要です。既存の管理者・権限行は保持します。

一括削除機能には、続けて[`20260914075211_admin_delete_users.sql`](supabase/migrations/20260914075211_admin_delete_users.sql)を適用します。既存ユーザーは削除されず、管理画面から呼び出す削除APIが追加されます。

旧実装では未招待アカウントにも未許可プロフィールが作成されていました。過去の招待は消費時に削除されるため、既存の未許可行だけでは未招待か許可取消済みか判別できません。旧データの削除は対象を確認して行い、セッション・リフレッシュトークンを失効させてからAuthユーザーを削除します。プロフィールとidentityは外部キーで連動削除されます。

- `private`スキーマをData APIの公開スキーマに追加しないでください。招待テーブルはRLS有効・クライアント直接アクセス禁止です。
- 公開RPCは`admin_get_users`、`admin_update_user`、`admin_invite_user`、`admin_cancel_invitation`、`admin_delete_users`です。内部処理は非公開スキーマに置き、毎回`auth.uid()`とDB内の`profiles.role = 'admin' / is_allowed = true`を確認します。一般ユーザーはRPCを直接呼んでも拒否されます。
- Authユーザーの作成前に招待を確認します。プロフィールは、確認済みGoogle identityのメールとAuthの確認済みメールが一致し、事前招待が適用された時点で作成します。名前やアイコンに使うメタデータから権限を決定することはありません。
- service_roleキーや新しい環境変数は不要です。管理者の追加・変更はSQL Editorで行い、画面/APIでは自分自身とすべてのadmin行を変更不可にしています。

### 操作

許可済みadminには「管理」カテゴリに「ユーザー管理」（`/users`）が表示されます。一覧にはプロフィールを持つログイン済みアカウントが表示され、管理者が先頭に並びます。招待の確認待ちでプロフィールがまだないアカウントは表示されません。editor/viewerを変更し、「保存」で反映します。許可状態の列はなく、権限の保存で既存の許可状態は変更しません。

表の左端でアカウントを選択すると、表の上に選択件数と「選択したアカウントを削除」が表示されます。未選択のチェックボックスは行へのホバー時だけ表示されます（キーボードフォーカス時とタッチ端末でも操作可能）。選択中は常に表示され、全て解除すると削除ボタンは消えます。管理者自身と他のadminは選択・削除できません。

削除は全件を検証した後、1トランザクションでAuthユーザー・プロフィール・identity・セッション・リフレッシュトークン・対象メールへの未使用招待を削除します。無効な対象が含まれる場合や処理が失敗した場合は全件を取り消します。削除済みのアカウントは、管理者が改めて招待するまで再登録・再ログインできません。発行済みアクセストークン自体は期限まで存在しますが、プロフィール参照による権限判定は削除直後から拒否されます。

「ユーザーを招待」からメールアドレスとeditor/viewerを登録します。メール送信は行いません。メールアドレスの前後の空白・大文字小文字を正規化して照合し、次回Googleログインで指定権限と許可ONを付与します。登録済みのアカウントも次回ログインで反映されます。同じ未使用メールの招待は再登録すると権限を更新します。ログイン待ちの招待は取り消せます。

招待は適用後に削除され、再ログイン時に権限を上書きしません。ユーザー一覧での明示的な権限・許可変更も、そのメールへの未使用招待を取り消します。未招待・招待取消済みの新規アカウントは登録を拒否し、Authユーザーやプロフィールを保存しません。後から招待すればログインできます。招待済みでもメール確認が完了するまではプロフィール・権限を付与しません。登録後に許可をOFFにした既存ユーザーは管理表に残り、再ログインしても許可は復活しません。

### 動作確認

1. `npm test`と`npm run build`でUI・既存機能を検証します。
2. Supabase適用後、adminで`/users`を開き、一覧・権限変更・行選択を確認します。管理者の行は変更・削除不可です。
3. editor/viewer/未許可adminで`/users`を直接開き、一覧・操作が出ないことを確認します。これらのユーザーのセッションで`supabase.rpc('admin_get_users')`や更新RPCを直接呼んだ場合も権限エラーになります。`profiles`への直接UPDATEも拒否されます。
4. 別のGoogleメールをeditorとして招待し、そのアカウントでログインして編集可能になることを確認します。未招待メールはログインを拒否され、Authユーザー・プロフィール・管理一覧に残らないことを確認します。viewer招待は閲覧のみです。
5. 削除してよいテストアカウントを複数選択し、一括削除後にAuth・プロフィール・セッション・未使用招待が残らず、再ログインが拒否されることを確認します。未使用の招待を取り消した場合も権限は付与されません。

DB側の自動テストは[`supabase/tests/user-management.mjs`](supabase/tests/user-management.mjs)です。一時フォルダにPGliteをインストールし、その`dist/index.js`の絶対パスを環境変数`SIDECODEX_PGLITE_PATH`に設定して`node supabase/tests/user-management.mjs`を実行できます。アプリの依存追加は不要です。独立したPostgreSQL上でRLS、RPC、トリガーを検証しますが、実際のGoogle OAuthは上記の実アカウント確認が必要です。
