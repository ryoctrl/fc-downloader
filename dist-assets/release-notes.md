ファンクラブ系支援サイト（Fantia / pixiv FANBOX / Patreon / ci-en）のコンテンツを
**完全ローカル**でダウンロード・閲覧するデスクトップアプリ。

## ダウンロード

- **インストーラ版** `fc-downloader-*-x64.exe` — 通常のセットアップ（インストール先選択可）
- **ポータブル版** `fc-downloader-*-portable.exe` — インストール不要の単体 exe

## ⚠️ 起動時の警告（未署名ビルド）

コード署名がないため、初回起動時に Windows の警告が出ます。

- **SmartScreen**（「Windows によって PC が保護されました」）
  →「詳細情報」→「実行」、または exe を右クリック →「プロパティ」→「**許可する（Unblock）**」。
  ポータブル版は同梱の **`Unblock-and-run.bat`** を exe と同じフォルダで実行すると、
  ダウンロード時のマークを除去して起動します。
- **Smart App Control (SAC)**（Windows 11 の一部環境で有効）
  → 署名/評判をカーネルで評価するため `.bat` 等では回避できません。
  SAC を無効化するか署名済みビルドが必要です。

詳細は [README](https://github.com/ryoctrl/fc-downloader#インストールwindows) と
[security-and-legal.md](https://github.com/ryoctrl/fc-downloader/blob/main/docs/spec/security-and-legal.md) を参照。

> 個人利用・私的バックアップ目的のツールです。各サイトの利用規約を遵守し、
> ダウンロードしたコンテンツの再配布は行わないでください。
