# セキュリティと利用前提

## 利用前提（重要）

本アプリは **利用者自身が支援/課金しているコンテンツを、私的にバックアップ・閲覧する
目的** のツールである。

- 各対象サイト（Fantia / Pixiv Fanbox / Patreon / ci-en 等）の **利用規約を遵守** すること。
- ダウンロードしたコンテンツの **再配布・公開・共有は行わない**。
- 支援していない / 認証を回避するようなアクセスは行わない。ログインは利用者本人が
  内蔵 WebView で正規に行い、アプリはそのセッションを再利用するだけである。
- 取得したファイルの権利はクリエイターに帰属する。

## アプリのセキュリティ方針

- **ローカル完結**: 対象サイト以外の外部サーバへ通信しない。テレメトリ・自動アップロードなし。
  フォントも `@fontsource` でローカル同梱（Google Fonts 等の CDN 依存なし）。CSP も外部許可を撤去。
- **Renderer 隔離**: `contextIsolation: true` / `nodeIntegration: false`。
  renderer は Node / Electron API へ直接触れず、`window.api`（型付き IPC・許可制）経由でのみ
  特権操作を行う。
- **CSP**: renderer の `index.html` に Content-Security-Policy を設定。
- **WebView の扱い**: `<webview>` は対象サイトの表示専用。`target=_blank` 等の新規ウィンドウは
  既定の外部ブラウザへ送る（`setWindowOpenHandler` で deny + `openExternal`）。
- **Cookie 隔離**: サービスごとに `persist:<serviceId>` パーティションで分離。クリアも個別。
- **資格情報**: パスワードはアプリで保持しない。認証はサイトのセッション Cookie のみに依存し、
  OS のユーザープロファイル下（Electron userData）に格納される。

## 今後の検討

- WebView の `webPreferences`（`nodeIntegration` 無効・`sanitize`）の明示設定。
- ダウンロードファイルの拡張子/MIME 検証。
- 保存先のディスク容量チェックと書き込み権限確認。
