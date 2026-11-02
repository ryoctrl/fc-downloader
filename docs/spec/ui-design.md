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
┌──────┬────────────────────────────────────────────────────────┐
│ Rail │  Content (screen)                                       │
│      │                                                         │
│ svc  │  service : WebView + 右ダウンロード設定パネル              │
│ svc  │  progress: 進捗ヒーロー + キュー                          │
│ ──   │  library : ツリー + グリッド/リスト + フィルタ             │
│ Lib  │  favorites: お気に入りグリッド                           │
│ Fav  │  post    : 詳細プレビュー + メタ/タグ/保存パス             │
│ Set  │  settings: アカウント/一括DL/定期DL/保存先/フォルダ名/一般/About │
└──────┴────────────────────────────────────────────────────────┘
```

## 画面 / コンポーネント

| 領域 | ファイル |
| --- | --- |
| シェル | `App.tsx`（prefs/state/routing/theme）, `components/Rail.tsx`（サービス・ダウンロード状況・合計サイズ・画面切り替え） |
| サービス | `screens/ServiceScreen.tsx`（実 `<webview>` + 設定パネル） |
| 進捗 | `screens/ProgressScreen.tsx` |
| ライブラリ | `screens/LibraryScreen.tsx`（ツリー/グリッド/リスト、`PostCard`/`PostRow`/`FilterChip` を export） |
| お気に入り | `screens/FavoritesScreen.tsx` |
| 投稿詳細 | `screens/PostDetail.tsx`（プレビュー・ライトボックス・zip 解凍）, `screens/PsdViewer.tsx`（PSD のレイヤー表示・書き出し） |
| 設定 | `screens/SettingsScreen.tsx` |
| 共通 | `design/icons.tsx`, `design/primitives.tsx`（Thumb/ServiceMark/StatusBadge/Btn）, `design/context.tsx` |
| データ | `design/data.ts`（サービスごとの色・マーク）, `design/library.ts`（`LibraryPost`→`ViewPost`）, `design/types.ts` |
| 文言 | `design/i18n.ts`（ja/en）, `design/locales/zh-CN.ts`（简体中文）, `design/language.ts`（言語の選択肢と OS 言語からの初期値） |

## 実装上の決定（プロトタイプからの調整）

- **ダウンロード設定パネルのレイアウト**: プロトタイプの right / bottom / overlay のうち、
  既定の **right（右サイドパネル）** のみ実装。bottom/overlay は将来必要なら追加。
- **ウィンドウ Chrome**: プロトタイプの mac（信号機ボタン）ではなく OS 標準の枠を使う。
  プロトタイプの TopBar は撤去し、ダウンロード状況と合計サイズは Rail に移した（PR #36）。
- **WebView**: プロトタイプはログイン画面/フィードのモックだが、本実装は **実 Electron `<webview>`**
  （`partition="persist:<id>"`）に置換。ログイン Cookie が main 側 DL と共有される。
- **コンテンツデータ**: モックは撤去済み。投稿/クリエイター一覧・進捗はすべて `window.api` の実データ。
  `design/data.ts` に残るのはサービスごとの表示用の色・マークだけ。
- **設定の永続化**: prefs（theme/lang/accent/density/viewerView）、お気に入り、クリエイター一覧のキャッシュ、
  ダウンロード設定の選択、定期実行の最終実行日は **localStorage**。サービスのロゴは同梱（利用者による差し替えは廃止）。
  保存先・同時数・フォルダ名パターン・定期ダウンロード・zip のパスワードなどは `settings:*` IPC
  （main 側の `settings.json`）。
- **表示言語**: 日本語 / English / 简体中文。保存された選択が無ければ OS の言語から選ぶ
  （`zh-*` は简体中文、それ以外の未対応言語は日本語）。サイトの WebView・クリエイター名・投稿本文・
  ファイル名は翻訳しない。

## 実装済み（実データ接続後）

- モック→実データ置換、実メディアプレビュー、進捗の実イベント接続、speed/ETA、
  失敗再試行、クリエイター表示名、フォントのローカル同梱（完全オフライン）。
- ダウンロード設定パネルの期間指定・「New」表示・クリエイター追加、ダウンロードのキュー表示、
  zip 解凍、PSD ビューワー、Cookie 貼り付け、定期ダウンロード・自動起動、更新通知のバナー、
  简体中文対応。詳細は roadmap。

## 今後

- bottom / overlay レイアウト、アクセント色の設定 UI（必要なら）。
- ※ 画像ライトボックス（クリックで全画面・矢印/Esc 操作）は実装済み。
