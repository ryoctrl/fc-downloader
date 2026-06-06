# fc-downloader

ファンクラブ系支援サイト（Fantia / Pixiv Fanbox / Patreon / ci-en）の
コンテンツを **完全ローカル** でダウンロード・閲覧するデスクトップアプリ。

- 各サービスのログインは内蔵 WebView で行い、Cookie はアプリ内（サービスごとに隔離）で管理
- ログイン済みのコンテンツを一斉ダウンロード
- `サービス / ユーザー / 年 / 月 / 投稿ID` のフォルダ構成で保存し、重複ダウンロードを自動回避
- 内蔵ファイルビューワーで一覧閲覧

> ⚠️ 本アプリは **個人利用・私的バックアップ目的** です。各サイトの利用規約を遵守し、
> ダウンロードしたコンテンツの再配布は行わないでください。詳細は
> [docs/spec/security-and-legal.md](docs/spec/security-and-legal.md)。

## 開発

```bash
npm install      # 依存導入（ネイティブビルド不要）
npm run dev      # 開発起動 (HMR)
npm run build    # 型チェック + ビルド
npm run dist     # 配布ビルド（インストーラ + ポータブル exe）
```

### 配布ビルド

`npm run dist` で Windows 向けの **インストーラ（`fc-downloader-<ver>-x64.exe`）** と
**ポータブル exe（`fc-downloader-<ver>-portable.exe`）** を `release/` に生成します
（設定は [electron-builder.yml](electron-builder.yml)）。動作検証にはポータブル exe が手軽です。

> 現状ビルドは**未署名**のため、初回起動時に Windows SmartScreen の警告が出ます
> （「詳細情報」→「実行」で起動可）。コード署名は今後の課題です。

技術構成・設計の詳細は [CLAUDE.md](CLAUDE.md) と [docs/](docs/) を参照。

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| デスクトップ | Electron |
| UI | React + TypeScript + Vite (electron-vite) |
| メタデータ/重複検知 | better-sqlite3 |
