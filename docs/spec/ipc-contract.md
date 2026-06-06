# IPC 契約

main↔renderer の通信は `src/shared/ipc.ts` の型で一元管理する。型を契約とし、
ハンドラ・プリロードは型から導出する（`any` を手書きしない）。

## invoke/handle チャネル（`IpcApi`）

| チャネル | 引数 | 戻り | 説明 |
| --- | --- | --- | --- |
| `services:list` | — | `ServiceDescriptor[]` | 登録サービス一覧 |
| `services:openLogin` | `serviceId` | `void` | ログイン意図の通知（実体は WebView） |
| `services:checkAuth` | `serviceId` | `boolean` | ログイン判定 |
| `services:clearSession` | `serviceId` | `void` | セッション破棄 |
| `creators:list` | `serviceId` | `Creator[]` | 支援中クリエイター |
| `download:start` | `serviceId, options` | `void` | ダウンロード開始 |
| `download:cancel` | — | `void` | 実行中のキャンセル |
| `download:status` | — | `DownloadItem[]` | 直近の結果一覧 |
| `settings:get` | — | `AppSettings` | 設定取得 |
| `settings:update` | `patch` | `AppSettings` | 設定更新 |
| `settings:pickDownloadRoot` | — | `string \| null` | 保存先選択ダイアログ |
| `viewer:tree` | — | `ViewerNode[]` | ビューワーツリー |
| `viewer:openPath` | `path` | `void` | OS ファイラで開く |

## push イベント（`IpcEvents`、main → renderer）

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `download:progress` | `DownloadProgress` | 集計進捗 |
| `download:item` | `DownloadItem` | ファイル単位の結果 |
| `services:authChanged` | `{ serviceId, loggedIn }` | 認証状態変化 |

renderer では `window.api.on(event, listener)` で購読し、戻り値の関数で解除する。

## チャネル追加手順

1. `IpcApi`（または `IpcEvents`）に型を追加。
2. `src/main/ipc/handlers.ts` に `handle('<channel>', …)` を追加。
3. `src/preload/index.ts` の `invokeChannels` 配列にチャネル名を追加。

型が通れば renderer から `window.api['<channel>'](...)` で呼べる。
