# アーキテクチャ

## プロセス構成

Electron の標準 3 層に分離する。

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (React)                                             │
│  Rail / Service(<webview>) / Progress / Library /           │
│  Favorites / PostDetail(PsdViewer) / Settings               │
│         │  window.api[...]  (typed)                          │
└─────────┼───────────────────────────────────────────────────┘
          │ contextBridge
┌─────────┼───────────────────────────────────────────────────┐
│ Preload │  ipcRenderer.invoke / on  →  window.api            │
└─────────┼───────────────────────────────────────────────────┘
          │ IPC (typed by shared/ipc.ts)
┌─────────┼───────────────────────────────────────────────────┐
│ Main (Node)                                                 │
│  ipc/handlers ─ services/registry ─ Service adapters        │
│       │              │                                       │
│  download/engine ── session/manager (per-service cookies)   │
│       │              │                                       │
│  storage/{db,layout,settings,files,thumbnails,viewer}       │
│  archive / protocol(fcfile,fcicon) / webview / update       │
└─────────────────────────────────────────────────────────────┘
                       │ Chromium net stack (cookies applied)
                       ▼  対象サイト (Fantia 等)
```

## データフロー（ダウンロード）

1. Renderer → `download:start(serviceId, options)`。
2. `handlers` が `DownloadEngine.run` を起動。
3. Engine は `Service.listCreators` / `listPosts` で投稿を列挙
   （`ServiceContext.fetch*` は `session/manager` 経由 = ログイン Cookie 適用）。
   期間指定（`options.period` / `sinceLastSync`）外の投稿は捨てる。
4. 各投稿について `storage/db` で重複判定し、保存先フォルダ（ユーザーのパターンから作るか、
   台帳に記録済みのもの）を決める。フォルダは実際に保存する直前に作る。
5. 未取得ファイルを `options.concurrency` の並列で、ストリーミングでディスクへ書き込む
   （一時的なエラーは指数バックオフで再試行）。
6. `db` に投稿/ファイルを記録、`download:progress` / `download:item` を push、終了時に `download:done`。
   最後まで完了したクリエイターは同期日時（「前回以降」の基準）を進める。
7. ライブラリは `posts:list`（台帳）から構築し、ファイルは `fcfile://` で配信する。
   `storage/viewer` はディスク走査でツリーを作る（台帳が無くても成立する）。

複数サービスの実行はキュー（`download:queue`）で 1 つずつ処理する。

## セッション分離

`session.fromPartition('persist:<serviceId>')` で各サービスに独立した Cookie ジャーを
割り当てる。renderer の `<webview partition="persist:<serviceId>">` と main の
`session/manager.requestFor` が **同じパーティション** を共有するため、ユーザーが
WebView でログインすれば、その Cookie が main 側のダウンロード要求にも自動適用される。

ダウンロード要求は Node の `fetch` ではなく Electron の `net` モジュールを使う
（`net` は Chromium のネットワークスタック=セッション Cookie ジャーを共有するため）。

## 主要モジュール責務

| モジュール | 責務 |
| --- | --- |
| `services/types.ts` | Service 契約（サイト非依存の抽象） |
| `services/<id>/` | 各サイトの列挙・正規化・URL 解決 |
| `session/manager.ts` | パーティション管理 / Cookie 付き HTTP / ストリーミング保存 |
| `session/throttle.ts` | サービスごとのメタデータ要求の間隔制御 |
| `download/engine.ts` | 列挙→重複判定→並列取得→記録 |
| `storage/layout.ts` | パス生成 / 重複キー / ファイル名サニタイズ |
| `storage/db.ts` | メタデータ・重複台帳（JSON ストア。ADR 0003） |
| `storage/viewer.ts` | ディスク走査によるビューワーツリー |
| `archive/` | zip 解凍（ZipCrypto のパスワード対応） |
| `protocol/` | `fcfile://`（保存済みファイル）/ `fcicon://`（クリエイターのアイコン）配信 |
| `webview/popup.ts` | WebView のポップアップ振り分け（サインインはアプリ内、それ以外は外部ブラウザ） |
| `update/check.ts` | GitHub の最新リリースとの比較（通知のみ） |
| `ipc/handlers.ts` | IPC エンドポイントとイベント送出 |

詳細は [service-abstraction.md](service-abstraction.md),
[storage-and-dedup.md](storage-and-dedup.md), [ipc-contract.md](ipc-contract.md)。
