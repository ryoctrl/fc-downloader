ファンクラブ系支援サイト（Fantia / pixiv FANBOX / Patreon / ci-en）のコンテンツを
**完全ローカル**でダウンロード・閲覧するデスクトップアプリ。

## ダウンロード

### Windows（zip 同梱）
exe は **zip に梱包**して配布しています。**zip を展開してから中の exe を実行**してください。

- **インストーラ版** `fc-downloader-*-x64.zip` — 展開すると通常セットアップ用 exe（インストール先選択可）
- **ポータブル版** `fc-downloader-*-portable.zip` — 展開するとインストール不要の単体 exe

### macOS
- **`fc-downloader-*-universal.dmg`** — Intel / Apple Silicon 両対応のユニバーサルバイナリ。
  マウントして `fc-downloader.app` を「アプリケーション」へドラッグ。

## ⚠️ 起動時の警告（未署名ビルド）

コード署名がないため、初回起動時に OS の警告が出ます。

**Windows**
- **おすすめ手順**: ダウンロードした **zip を右クリック →「プロパティ」→「許可する（Unblock）」に
  チェック → OK** してから展開すると、中の exe にダウンロードマーク（Mark of the Web）が付かず、
  SmartScreen の警告を避けられます。
- それでも **SmartScreen**（「Windows によって PC が保護されました」）が出た場合は
  「詳細情報」→「実行」で起動できます。
- **Smart App Control (SAC)**（Windows 11 の一部環境で有効）
  → 署名/評判をカーネルで評価するため zip 化では回避できません。
  SAC を無効化するか署名済みビルドが必要です。

**macOS**（Gatekeeper）
- 「壊れているため開けません」等が出る場合、ターミナルで検疫属性を除去します：
  ```sh
  xattr -dr com.apple.quarantine "/Applications/fc-downloader.app"
  ```
- Apple Silicon でなお起動しない場合はアドホック署名を付与：
  ```sh
  codesign --force --deep --sign - "/Applications/fc-downloader.app"
  ```

詳細は [README](https://github.com/ryoctrl/fc-downloader#インストール) と
[security-and-legal.md](https://github.com/ryoctrl/fc-downloader/blob/main/docs/spec/security-and-legal.md) を参照。

> 個人利用・私的バックアップ目的のツールです。各サイトの利用規約を遵守し、
> ダウンロードしたコンテンツの再配布は行わないでください。
