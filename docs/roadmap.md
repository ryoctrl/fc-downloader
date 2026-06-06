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

## M2. Fantia を実機能化（MVP の核心）

- [ ] WebView ログイン → `checkAuth`（`/api/v1/me`）の実検証とフィクスチャ保存
- [ ] `listCreators`（支援中ファンクラブ列挙）の実装 + テスト
- [ ] `listPosts`（ファンクラブ投稿のページング）の実装 + テスト
- [ ] 投稿詳細 → `PostFile` 正規化（種別マッピング・**ファイル URL 解決**）
- [ ] 実ダウンロード E2E（少数投稿で取得→重複スキップ→再実行が冪等）
- [ ] レート制御 / リトライ / バックオフ

## M3. ビューワー強化

- [ ] クリエイター選択 UI（一覧/検索/チェック）
- [ ] サムネイルグリッド・画像/動画インラインプレビュー
- [ ] ダウンロード履歴・失敗一覧と再試行
- [ ] タグ付け・絞り込み（db スキーマ拡張）

## M4. ダウンロード基盤の堅牢化

- [ ] ストリーミング書き込み（メモリ常駐の解消）
- [ ] Range によるレジューム / 部分ファイルの検出
- [ ] ファイル名衝突時の連番付与
- [ ] 同時実行のグローバル制御（投稿跨ぎのワーカープール）
- [ ] SQLite バックエンド化（件数増加・検索要件が出たら。`db.ts` を差し替え。ADR 0003）

## M5. 他サービス横展開

- [ ] Pixiv Fanbox アダプタ
- [ ] ci-en アダプタ
- [ ] Patreon アダプタ

## M6. 配布

- [ ] electron-builder 設定（Windows NSIS、署名は任意）
- [ ] 自動更新（任意・ローカル完結方針と要相談）
- [ ] アイコン / ブランディング

## 横断的な技術的負債 / 注意

- `VERIFY:` コメントの箇所はすべて実サイト検証が必要（フィクスチャを残す）。
- `download:status` の `recentItems` は揮発。永続履歴は db 化を検討。
- WebView の `webPreferences` 明示設定（セキュリティ）。
