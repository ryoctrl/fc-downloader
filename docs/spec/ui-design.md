# UI 設計

実装は Claude Design のハンドオフ（`docs/design-handoff/`）を視覚仕様として、React + TS へ
移植したもの。プロトタイプ原本は `docs/design-handoff/project/fc-downloader.html` とその
`src/*.jsx`。差異が出たらまずこのドキュメントとハンドオフを正にして実装を合わせる。

## デザインシステム

- フォント: **IBM Plex Sans / IBM Plex Mono**（`@fontsource` でローカル同梱・latin サブセット、
  日本語はシステムフォントへフォールバック。外部 CDN 依存なし）
- 色: **oklch** トークン + `color-mix`。`[data-theme="light|dark"]` で切替（`theme.css`）。
  アクセントは CSS 変数 `--accent`（既定 `#2f6df0`）。
- 角丸・影・ホバー遷移・スクロールバー・アニメーション（spin/pulse）は `theme.css` に集約。

## レイアウト

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar (46px) — ロゴ / fc-downloader / DL状態 or ストレージ量     │
├──────┬────────────────────────────────────────────────────────┤
│ Rail │  Content (screen)                                       │
│ 72px │                                                         │
│ svc  │  service : WebView + 右ダウンロード設定パネル              │
│ svc  │  progress: 進捗ヒーロー + キュー                          │
│ ──   │  library : ツリー + グリッド/リスト + フィルタ             │
│ Lib  │  favorites: お気に入りグリッド                           │
│ Fav  │  post    : 詳細プレビュー + メタ/タグ/保存パス             │
│ Set  │  settings: アカウント/ストレージ/ロゴ/一般/About          │
└──────┴────────────────────────────────────────────────────────┘
```

## 画面 / コンポーネント

| 領域 | ファイル |
| --- | --- |
| シェル | `App.tsx`（prefs/state/routing/theme）, `components/TopBar.tsx`, `components/Rail.tsx` |
| サービス | `screens/ServiceScreen.tsx`（実 `<webview>` + 設定パネル） |
| 進捗 | `screens/ProgressScreen.tsx` |
| ライブラリ | `screens/LibraryScreen.tsx`（ツリー/グリッド/リスト、`PostCard`/`PostRow`/`FilterChip` を export） |
| お気に入り | `screens/FavoritesScreen.tsx` |
| 投稿詳細 | `screens/PostDetail.tsx` |
| 設定 | `screens/SettingsScreen.tsx` |
| 共通 | `design/icons.tsx`, `design/primitives.tsx`（Thumb/ServiceMark/StatusBadge/Btn）, `design/context.tsx` |
| データ/文言 | `design/data.ts`（**モック**）, `design/i18n.ts`（ja/en）, `design/types.ts` |

## 実装上の決定（プロトタイプからの調整）

- **ダウンロード設定パネルのレイアウト**: プロトタイプの right / bottom / overlay のうち、
  既定の **right（右サイドパネル）** のみ実装。bottom/overlay は将来必要なら追加。
- **ウィンドウ Chrome**: プロトタイプの mac（信号機ボタン）ではなく **plain**（ロゴ + タイトル）を採用。
  実 Windows アプリで非機能の信号機を出すのを避けるため。
- **WebView**: プロトタイプはログイン画面/フィードのモックだが、本実装は **実 Electron `<webview>`**
  （`partition="persist:<id>"`）に置換。ログイン Cookie が main 側 DL と共有される。
- **コンテンツデータ**: `design/data.ts` は **モック**。投稿/クリエイター一覧・お気に入り・進捗の
  アニメーションはデモ用。M2 で `window.api`（services/creators/posts, viewer:tree, download）へ置換する。
- **設定の永続化**: prefs（theme/lang/accent/density/viewerView）と brandLogos は現状 **localStorage**。
  将来 `settings:*` IPC（main 側の `settings.json`）へ寄せる余地あり。

## 実装済み（実データ接続後）

- モック→実データ置換、実メディアプレビュー、進捗の実イベント接続、speed/ETA、
  失敗再試行、クリエイター表示名、フォントのローカル同梱（完全オフライン）。詳細は roadmap。

## 今後

- bottom / overlay レイアウト、アクセント色の設定 UI（必要なら）。
- ※ 画像ライトボックス（クリックで全画面・矢印/Esc 操作）は実装済み。
