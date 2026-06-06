# アーキテクチャ

## プロセス構成

Electron の標準 3 層に分離する。

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (React)                                             │
│  Sidebar / ServicePanel(<webview>) / ViewerPanel / Settings │
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
│  storage/{db,layout,settings,viewer}                        │
└─────────────────────────────────────────────────────────────┘
                       │ Chromium net stack (cookies applied)
                       ▼  対象サイト (Fantia 等)
```

## データフロー（ダウンロード）

1. Renderer → `download:start(serviceId, options)`。
2. `handlers` が `DownloadEngine.run` を起動。
3. Engine は `Service.listCreators` / `listPosts` で投稿を列挙
   （`ServiceContext.fetch*` は `session/manager` 経由 = ログイン Cookie 適用）。
4. 各投稿について保存先 `postDir` を作成し、`storage/db` で重複判定。
5. 未取得ファイルを `options.concurrency` の並列で取得しディスクへ。
6. `db` に投稿/ファイルを記録、`download:progress` / `download:item` を push。
7. Viewer は `storage/viewer` でディスクを走査してツリーを構築。

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
| `session/manager.ts` | パーティション管理 / Cookie 付き HTTP |
| `download/engine.ts` | 列挙→重複判定→並列取得→記録 |
| `storage/layout.ts` | パス生成 / 重複キー / ファイル名サニタイズ |
| `storage/db.ts` | メタデータ・重複台帳（sqlite） |
| `storage/viewer.ts` | ディスク走査によるビューワーツリー |
| `ipc/handlers.ts` | IPC エンドポイントとイベント送出 |

詳細は [service-abstraction.md](service-abstraction.md),
[storage-and-dedup.md](storage-and-dedup.md), [ipc-contract.md](ipc-contract.md)。
