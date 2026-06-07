# ロードマップ / タスクリスト

自動開発の起点。上から順に進める。完了したら `[x]` にし、関連 docs を更新する。

## M0. スキャフォールド（完了）

- [x] 技術選定（Electron / React+TS+Vite / better-sqlite3）と ADR
- [x] プロジェクト初期化（electron-vite, tsconfig, lint/format）
- [x] Service 抽象 / registry / Fantia アダプタ雛形（`VERIFY:` 付き）
- [x] session/manager（パーティション分離 + Cookie 付き `net` リクエスト）
- [x] download/engine（列挙→重複判定→並列取得→記録）
- [x] storage（layout / db / settings / viewer）
- [x] IPC 契約 + handlers + preload
- [x] Renderer（Sidebar / ServicePanel + webview / Viewer / Settings）
- [x] docs 一式 + CLAUDE.md

## M1. ローカル起動の確立

- [x] `npm install`（ネイティブ依存なし＝ビルドチェーン不要を確認）
- [x] `npm run typecheck`（node/web 両方）をクリーンに
- [x] `npm run lint` をクリーンに
- [x] `npm run build`（main/preload/renderer）成功を確認
- [x] vitest 初期テスト（`storage/layout` のパス/サニタイズ）を緑に
- [ ] `npm run dev` で起動・サイドメニュー・WebView 表示を確認（GUI 手動確認）

## M1.5 デザイン実装（完了）

Claude Design ハンドオフ（`docs/design-handoff/`）を React+TS へ移植。

- [x] デザインシステム移植（oklch トークン / light・dark / IBM Plex / `theme.css`）
- [x] シェル（TopBar / Rail）+ 全6画面（service / progress / library / favorites / post / settings）
- [x] 共通プリミティブ（Icon / Thumb / ServiceMark / StatusBadge / Btn）と i18n（ja/en）
- [x] ServiceScreen は実 `<webview>`（partition）に置換
- [x] typecheck / lint / build をクリーンに（[ui-design.md](spec/ui-design.md) に決定事項）
- 注: コンテンツは `design/data.ts` の **モック**。M2 で実データへ置換する（下記）。

## M2. Fantia を実機能化（MVP の核心）

- [ ] WebView ログイン → `checkAuth`（`/api/v1/me`）の実検証とフィクスチャ保存
- [ ] `listCreators`（支援中ファンクラブ列挙）の実装 + テスト
- [ ] `listPosts`（ファンクラブ投稿のページング）の実装 + テスト
- [ ] 投稿詳細 → `PostFile` 正規化（種別マッピング・**ファイル URL 解決**）
- [ ] 実ダウンロード E2E（少数投稿で取得→重複スキップ→再実行が冪等）
- [ ] レート制御 / リトライ / バックオフ

## M2.5 UI を実データへ接続（モック置換）

`design/data.ts`（モック）と localStorage 依存を、実 IPC へ寄せる。

- [x] renderer ブリッジ `src/renderer/src/bridge.ts`（`window.api` 型安全ラッパ + backend 不在時の安全な縮退）
- [x] 保存先（saveDir）/ 同時数を `settings:*` IPC で永続化（Settings 画面の Browse / スライダー）
- [x] **デモモード削除 + 実ログイン状態接続**（`demo:` トグル撤去。`services:checkAuth` で起動時判定、
  `services:authChanged` 購読。Settings の Cookie 削除を `services:clearSession` に接続）
- [x] **ProgressScreen を実イベントに接続**（`download:progress` / `download:item` / 新規 `download:done`）。
  偽アニメーション撤去。実ファイル単位の進捗・完了/スキップ/失敗・サイズ・ライブ一覧を表示。
- [x] **ServiceScreen 設定パネルを実接続**（`creators:list` で実クリエイター取得、`download:start` に
  実 `DownloadOptions` を送信）。モック投稿ベースの scope/range/estimate を撤去。
- [x] **`design/data.ts`（モック投稿）を実データへ置換**: backend `posts:list`（PR #7）+ 新 `design/library.ts`
  （`LibraryPost`→`ViewPost` マップ）で LibraryScreen / Favorites / PostDetail / Settings / TopBar を実データ化。
  お気に入りは postId キーで localStorage 永続化。tags は撤去、creatorName は creatorId フォールバック。
  ダウンロード完了で library を自動リロード。
  - [x] **実メディアプレビュー**: `fcfile://` カスタムプロトコル（ルート配下のみ配信・Range 対応）+
    `posts:files` IPC。PostDetail で実画像 `<img>` / 動画 `<video>` / 音声 `<audio>` / ファイル一覧を描画。
    パス安全性（ルート外拒否）の純関数テスト付き。
  - [x] **クリエイター表示名**: engine が `listCreators` から creatorId→name を解決し
    `upsertPost` で台帳（`PostRecord.creatorName`）へ保存。`LibraryPost.creatorName`（無ければ
    creatorId フォールバック）→ `ViewPost` で表示。db テスト追加。
- [ ] 重複スキップ既定値を設定に永続化（`AppSettings` 拡張）
- [ ] フォントのローカル同梱（`@fontsource/ibm-plex-*`）で完全オフライン化

## M3. ビューワー強化

- [x] サムネイル/プレビューの実ファイル表示（画像/動画/音声インライン。PR #9 `fcfile://`）
- [x] **進捗の speed/ETA**（`design/metrics.ts`: bytesDownloaded から EMA 速度、ファイルベース ETA。
  純関数テスト付き。ProgressScreen に表示）
- [x] **失敗一覧 + 再試行**（ProgressScreen の完了時に失敗のみフィルタ + 「失敗を再試行」。
  同一オプションで再実行し dedup で未取得・失敗分のみ再取得）
  - [ ] 永続的なダウンロード履歴（過去ラン一覧。台帳 or 別ストア）
- [ ] タグ付け・絞り込み（台帳スキーマ拡張）
- [ ] bottom / overlay レイアウト、アクセント色設定（必要なら）

## M4. ダウンロード基盤の堅牢化

- [x] **ストリーミング書き込み**（`session/manager.downloadToFile` で Readable を直接
  WriteStream へ流す。全体バッファ撤去。backpressure 対応）
- [x] **リトライ + 指数バックオフ**（`download/retry.ts`: 一時的エラーのみ再試行、
  AbortError は即中断、純関数テスト付き。engine `downloadFile` がリトライループ）
- [ ] Range によるレジューム / 部分ファイルの検出
- [ ] ファイル名衝突時の連番付与
- [ ] 同時実行のグローバル制御（投稿跨ぎのワーカープール）
- [ ] SQLite バックエンド化（件数増加・検索要件が出たら。`db.ts` を差し替え。ADR 0003）

## M5. 他サービス横展開

- [x] Pixiv Fanbox アダプタ（`src/main/services/fanbox/`、正規化テスト付き。API は `VERIFY:`）
  - [ ] 実アカウントで各エンドポイントを検証しフィクスチャ保存（`VERIFY:` の解消）
  - [ ] レート制御 / リトライ / バックオフ
- [ ] ci-en アダプタ
- [ ] Patreon アダプタ
- [x] Fantia アダプタの**構造実装**（`src/main/services/fantia/`、Fanbox 同等。normalize テスト付き。API は `VERIFY:`）
  - [ ] 実アカウントで各エンドポイント検証しフィクスチャ保存（`VERIFY:` 解消・**外部依存**）

## M6. 配布

- [x] electron-builder 設定（Windows NSIS + portable。PR #4）
- [x] **アプリアイコン**（`build/icon.svg` → `scripts/gen-icons.mjs`(sharp+png-to-ico) で
  `build/icon.{png,ico}` 生成。electron-builder `win.icon` に設定。`npm run gen:icons` で再生成）
- [ ] 自動更新（任意・ローカル完結方針と要相談）
- [ ] コード署名（**外部依存**: 要 OV/EV 証明書。Smart App Control 対応に必須）

## 横断的な技術的負債 / 注意

- `VERIFY:` コメントの箇所はすべて実サイト検証が必要（フィクスチャを残す）。
- `download:status` の `recentItems` は揮発。永続履歴は db 化を検討。
- WebView の `webPreferences` 明示設定（セキュリティ）。
