# 依存パッケージのバージョンと互換性

ビルド・実行の土台になる依存（ツールチェーン）の現在のバージョンと、
互いの対応範囲をまとめる。Dependabot の更新 PR を判断するときはここを見て、
更新したらこの表と「更新履歴」を直す。

## 現在のバージョン

| 対象 | バージョン | 役割 |
|---|---|---|
| Node.js（CI・リリース） | 24 | `npm ci`・ビルド・テストの実行環境（`.github/workflows/*.yml`） |
| electron | 42.11.x | アプリ本体の実行環境 |
| electron-builder | 26.18.x | インストーラー作成（`electron-builder.yml`） |
| vite | 8.3.x | バンドラー（内部のバンドラーは Rolldown） |
| electron-vite | 6.0.x | main / preload / renderer をまとめてビルドする vite のラッパー |
| @vitejs/plugin-react | 6.1.x | renderer の React 変換 |
| vitest | 5.0.x | テストランナー |
| typescript | 5.x | 型チェック |
| sharp | 0.35.x | アイコン生成スクリプト（`scripts/gen-icons.mjs`）専用 |

## 互換性の制約

vite・electron-vite・@vitejs/plugin-react・vitest は、どれも vite を
peer dependency（同居する vite のバージョンを指定する依存）として持つ。
**1 つだけ上げると `npm ci` が ERESOLVE で失敗する**ので、必ず同じ PR で揃えて上げる。

| パッケージ | 対応する vite | 対応する Node.js |
|---|---|---|
| electron-vite 6 | 6 / 7 / 8 | 20.19 以上、または 22.12 以上 |
| @vitejs/plugin-react 6 | 8 のみ | 20.19 以上、または 22.12 以上 |
| vitest 5 | 6.4 / 7 / 8 | 22.12 以上（24、26 以上も可） |
| electron 42 | — | 22.12 以上（インストール時の要件） |

- いま 4 つ全部を満たす vite は 8 だけ（@vitejs/plugin-react 6 が 8 しか受け付けない）。
- Node.js の下限は vitest 5 と electron 42 で決まり、22.12 以上。CI は LTS（長期サポート版）の 24 を使う。
- Dependabot が vite 系を別々の PR に分けて出してきた場合は、マージせず手動で 1 本にまとめる。
  上げ方: `npm uninstall` で 4 つを外してから `npm install -D` で同時に入れ直す
  （そのまま `npm install` すると、古い lock の vite 5 に引っ張られて解決できない）。

## 移行時の注意

- **electron 42 以降は、インストール時に本体をダウンロードしない。** 初回の `require('electron')`
  で取得するため、テストで本物の `electron` を読み込むと、テスト中にダウンロードが走る。
  `electron` を使わないテストでは `vi.mock('electron', ...)` で差し替える。
- electron-vite 5 以降、`externalizeDepsPlugin()` は非推奨。`build.externalizeDeps`
  （既定で有効）が同じことをするので、プラグイン指定は不要。
- vite 8 では `build.rollupOptions` は非推奨で、`build.rolldownOptions` に名前が変わった。

## 更新履歴

| 日付 | PR | 変更 | 理由 |
|---|---|---|---|
| 2026-10-30 | [#202](https://github.com/ryoctrl/fc-downloader/pull/202) | Node.js（CI・リリース） 20 → 24 | Node.js 20 のサポート終了。electron 42 が 22.12 以上を要求 |
| 2026-10-30 | [#201](https://github.com/ryoctrl/fc-downloader/pull/201) | electron 31.7.7 → 42.11.16 | セキュリティ修正（Dependabot） |
| 2026-10-30 | [#205](https://github.com/ryoctrl/fc-downloader/pull/205) | source-map-js 1.2.1 → 1.2.2 | セキュリティ修正（Dependabot） |
| 2026-10-30 | [#206](https://github.com/ryoctrl/fc-downloader/pull/206) | sharp 0.34.5 → 0.35.5 | セキュリティ修正（Dependabot） |
| 2026-10-30 | [#209](https://github.com/ryoctrl/fc-downloader/pull/209) | テストで `electron` をモック | electron 42 の初回ダウンロードがテスト中に並列で走るため |
| 2026-10-30 | [#210](https://github.com/ryoctrl/fc-downloader/pull/210) | vite 5.4.21 → 8.3.5、electron-vite 2.3.0 → 6.0.0、@vitejs/plugin-react 4.7.0 → 6.1.2、vitest 2.1.9 → 5.0.5 | セキュリティ修正（vite・vitest・tinypool ほか）。Dependabot の #203・#204・#207 を 1 本にまとめたもの |
| 2026-10-30 | [#212](https://github.com/ryoctrl/fc-downloader/pull/212) | electron-builder 25.1.8 → 26.18.0 | セキュリティ修正（同梱の app-builder-lib・builder-util-runtime・@xmldom/xmldom・ip-address など）。Dependabot の PR は無し |
| 2026-10-30 | 本 PR | brace-expansion 1.1.15 → 1.1.21・5.0.6 → 5.0.12、js-yaml 4.2.0 → 4.3.2（いずれも間接依存。lock のみ） | セキュリティ修正。`npm audit fix` で `npm audit` が 0 件になる |
