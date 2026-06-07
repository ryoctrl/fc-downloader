# fc-downloader

ファンクラブ系支援サイト（Fantia / pixiv FANBOX / Patreon / ci-en）の
コンテンツを **完全ローカル** でダウンロード・閲覧するデスクトップアプリ。

- 各サービスのログインは内蔵 WebView で行い、Cookie はアプリ内（サービスごとに隔離）で管理
- ログイン済みのコンテンツをまとめてダウンロード（並列・リトライ・速度/ETA 表示）
- `サービス / ユーザー / 年 / 月 / 投稿ID` のフォルダ構成で保存し、重複ダウンロードを自動回避
- 内蔵ビューワーでサムネイル一覧・画像ライトボックス・動画/音声プレビュー・zip 解凍
- サービスの有効/無効、全サイト一括ダウンロード、日次の自動ダウンロード、ログアウト検知
- すべてローカル完結（外部サーバ送信・テレメトリなし）

> ⚠️ 本アプリは **個人利用・私的バックアップ目的** です。各サイトの利用規約を遵守し、
> ダウンロードしたコンテンツの再配布は行わないでください。詳細は
> [docs/spec/security-and-legal.md](docs/spec/security-and-legal.md)。

## インストール（Windows）

[Releases](https://github.com/ryoctrl/fc-downloader/releases) から以下のいずれかを入手します。

- **インストーラ版** `fc-downloader-<ver>-x64.exe` — 通常のセットアップ（インストール先選択可）
- **ポータブル版** `fc-downloader-<ver>-portable.exe` — インストール不要、単体 exe

### ⚠️ 起動時の警告について（未署名ビルド）

現状のビルドは **コード署名なし** のため、ダウンロードした exe には Windows の
「Mark of the Web」が付与され、以下が発生します。

- **SmartScreen**（「Windows によって PC が保護されました」）
  → 「**詳細情報**」→「**実行**」で起動できます。
  または、exe を右クリック →「プロパティ」→「**許可する（Unblock）**」にチェック → OK。
  ポータブル版なら同梱の **`Unblock-and-run.bat`** を exe と同じフォルダに置いて実行すると、
  Mark of the Web を除去して起動します。
- **Smart App Control (SAC)**（Windows 11 の一部環境で有効）
  → SAC は署名/評判をカーネルで評価するため、**`.bat` 等では回避できません**。
  SAC を無効化（Windows セキュリティ →「アプリとブラウザー制御」→「Smart App Control」）するか、
  署名済みビルドが必要です。コード署名の方針は
  [docs/spec/security-and-legal.md](docs/spec/security-and-legal.md) を参照。

## 開発

```bash
npm install      # 依存導入（ネイティブビルド不要 / 純 JS 依存のみ）
npm run dev      # 開発起動 (HMR)
npm run typecheck
npm run lint
npm test         # vitest
npm run build    # 型チェック + ビルド
npm run dist     # 配布ビルド（インストーラ + ポータブル exe を release/ に生成）
```

配布ビルドの設定は [electron-builder.yml](electron-builder.yml)。技術構成・設計の詳細は
[CLAUDE.md](CLAUDE.md) と [docs/](docs/) を参照。

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| デスクトップ | Electron（サービスごとに `persist:<serviceId>` で Cookie 隔離） |
| UI | React + TypeScript + Vite (electron-vite) |
| メタデータ/重複検知 | JSON メタデータストア（ネイティブ依存なし。将来 SQLite を検討） |
| サムネイル/zip | Electron `nativeImage`（縮小生成）/ `fflate`（純 JS 解凍） |
