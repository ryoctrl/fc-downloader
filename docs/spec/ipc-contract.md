# IPC 契約

main↔renderer の通信は `src/shared/ipc.ts` の型で一元管理する。型を契約とし、
ハンドラ・プリロードは型から導出する（`any` を手書きしない）。下の表は要約で、正は `ipc.ts`。

保存済みファイルを読み書きするチャネル（`posts:files` / `posts:deleteFile` / `psd:read` /
`psd:saveThumb` / `archive:extract`）は、main 側で**保存先ルート配下のパスだけ**を受け付ける。

## invoke/handle チャネル（`IpcApi`）

### サービス / クリエイター

| チャネル | 引数 | 戻り | 説明 |
| --- | --- | --- | --- |
| `services:list` | — | `ServiceDescriptor[]` | 登録サービス一覧 |
| `services:openLogin` | `serviceId` | `void` | ログイン意図の通知（実体は WebView） |
| `services:checkAuth` | `serviceId` | `boolean` | ログイン判定 |
| `services:clearSession` | `serviceId` | `void` | セッション破棄 |
| `services:importSessionCookie` | `serviceId, value` | `ImportSessionCookieResult` | 貼り付けた Cookie の値を保存し `checkAuth` で確認 |
| `creators:list` | `serviceId` | `Creator[]` | 支援中クリエイター |
| `creators:checkNew` | `serviceId` | `string[]` | 未取得の新着投稿があるクリエイター ID |
| `creators:add` | `serviceId, pageUrl` | `AddCreatorResult` | 表示中ページのクリエイターを一覧に追加 |
| `creators:remove` | `serviceId, creatorId` | `void` | `creators:add` で追加したものを外す |

### ダウンロード

| チャネル | 引数 | 戻り | 説明 |
| --- | --- | --- | --- |
| `download:start` | `serviceId, options` | `void` | ダウンロード開始（実行中ならキューに積む） |
| `download:cancel` | — | `void` | 実行中のキャンセル |
| `download:status` | — | `DownloadItem[]` | 直近の結果一覧 |

### ライブラリ / ファイル

| チャネル | 引数 | 戻り | 説明 |
| --- | --- | --- | --- |
| `posts:list` | — | `LibraryPost[]` | 台帳の投稿一覧 |
| `posts:files` | `dirPath` | `LibraryFile[]` | 投稿フォルダ内のファイル |
| `posts:deleteFile` | `dirPath, fileName` | `boolean` | 利用者が作ったファイル（PSD の書き出し等）の削除。ダウンロード済みファイルは拒否 |
| `library:backfillAvatars` | — | `number` | アイコンの無いクリエイターのアイコン取得 |
| `library:reconcile` | — | `{ removedPosts, updatedPosts, removedFiles }` | 台帳とディスクの照合 |
| `viewer:tree` | — | `ViewerNode[]` | ディスク走査のツリー |
| `viewer:openPath` | `path` | `void` | OS ファイラで開く |
| `archive:extract` | `dirPath, fileName, password?` | `ExtractResult` | zip を解凍 |
| `archive:hasZipPassword` | `dirPath` | `boolean` | 投稿のパスワードを記憶済みか |
| `archive:clearZipPassword` | `dirPath` | `void` | 記憶したパスワードを削除 |
| `psd:read` | `dirPath, fileName` | `Uint8Array \| null` | PSD の読み込み |
| `psd:exportImage` | `suggestedPath, data` | `string \| null` | 保存ダイアログで画像を書き出し |
| `psd:saveThumb` | `dirPath, psdFileName, data` | `string \| null` | PSD のサムネイルを保存 |

### 設定 / アプリ

| チャネル | 引数 | 戻り | 説明 |
| --- | --- | --- | --- |
| `settings:get` | — | `AppSettings` | 設定取得 |
| `settings:update` | `patch` | `AppSettings` | 設定更新 |
| `settings:pickDownloadRoot` | — | `string \| null` | 保存先選択ダイアログ |
| `app:checkUpdate` | — | `UpdateInfo \| null` | GitHub の最新リリースと比較 |
| `app:getStartupEnabled` | — | `boolean` | ログイン時の自動起動の状態 |
| `app:setStartupEnabled` | `enabled` | `boolean` | 自動起動の切り替え |
| `shell:openExternal` | `url` | `void` | http(s) URL を既定のブラウザで開く |
| `window:pinBounds` | — | `void` | WebView 表示前のウィンドウ位置を記録（スナップ解除の復元用） |

## push イベント（`IpcEvents`、main → renderer）

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `download:progress` | `DownloadProgress` | 集計進捗 |
| `download:item` | `DownloadItem` | ファイル単位の結果 |
| `download:done` | `DownloadProgress` | 実行の終了（完了・失敗・キャンセル）で 1 回 |
| `download:queue` | `{ active, queued }` | 実行中と待機中のサービス |
| `services:authChanged` | `{ serviceId, loggedIn }` | 認証状態変化 |
| `creators:progress` | `{ serviceId, done, total }` | クリエイター一覧の取得進捗 |

renderer では `window.api.on(event, listener)` で購読し、戻り値の関数で解除する。

## チャネル追加手順

1. `IpcApi`（または `IpcEvents`）に型を追加。
2. `src/main/ipc/handlers.ts` に `handle('<channel>', …)` を追加。
3. `src/preload/index.ts` の `invokeChannels` 配列にチャネル名を追加。

型が通れば renderer から `window.api['<channel>'](...)` で呼べる。
