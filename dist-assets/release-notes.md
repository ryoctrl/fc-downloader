ファンクラブ系支援サイト（Fantia / pixiv FANBOX / Patreon / ci-en）のコンテンツを
**完全ローカル**でダウンロード・閲覧するデスクトップアプリ。

## ダウンロード

### Windows
- **インストーラ版** `fc-downloader-*-x64.exe` — **そのまま実行**してインストール（インストール先選択可）。
  ダウンロードした exe には Mark of the Web が付くため、初回実行時のみ SmartScreen 警告が出ますが
  「詳細情報」→「実行」で進めます。インストール後の本体は警告なしで起動します。
- **ポータブル版** `fc-downloader-*-portable.zip` — インストール不要の単体 exe。**zip を展開してから
  中の exe を実行**してください（本体を毎回直接起動するため、毎回の SmartScreen 警告を避ける目的で
  zip 同梱にしています）。

### macOS
- **`fc-downloader-*-universal.dmg`** — Intel / Apple Silicon 両対応のユニバーサルバイナリ。
  マウントして `fc-downloader.app` を「アプリケーション」へドラッグ。

## ⚠️ 起動時の警告（未署名ビルド）

コード署名がないため、初回起動時に OS の警告が出ます。

**Windows**
- **インストーラ版（.exe）**: 実行時に **SmartScreen**（「Windows によって PC が保護されました」）が
  出ることがあります。「詳細情報」→「実行」でインストールを進められます。インストール後の本体は
  Mark of the Web を持たないため、以降は警告なしで起動します。
- **ポータブル版（.zip）**: ダウンロードした **zip を右クリック →「プロパティ」→「許可する（Unblock）」
  → OK** してから展開すると、中の exe に Mark of the Web が付かず SmartScreen を避けられます。
  それでも出た場合は「詳細情報」→「実行」で起動できます。
- **Smart App Control (SAC)**（Windows 11 の一部環境で有効）
  → 署名/評判をカーネルで評価するため、直 exe でも zip でも回避できません。
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
