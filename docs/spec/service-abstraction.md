# Service 抽象と新規サイト追加

すべての対応サイトは `src/main/services/types.ts` の `Service` インターフェースを実装する。
コア（エンジン・ストレージ・UI）はこの契約にのみ依存するので、サイト追加は
**アダプタ実装 + 登録** だけで完結する。

## Service 契約（要約）

```ts
interface Service {
  id: ServiceId
  name: string
  homeUrl: string                                   // WebView で開く URL
  checkAuth(ctx): Promise<boolean>                  // ログイン判定（軽量）
  listCreators(ctx): Promise<Creator[]>             // 支援中クリエイター列挙
  listPosts(ctx, creatorId): AsyncIterable<Post>    // 投稿列挙（内部でページング）
  resolvePost?(ctx, post): Promise<Post>            // 投稿詳細の補完（任意）
}
```

`ServiceContext` は以下を提供する:

- `fetchJson<T>(url, init)` / `fetchText(url, init)` — サービスの隔離セッション経由
  （ログイン Cookie が自動適用される）。
- `log(level, msg, meta)` — サービス単位のロガー。
- `signal: AbortSignal` — キャンセル用。

## 新規サイト追加手順

1. `src/shared/types.ts` の `ServiceId` に `'<id>'` を追加。
2. `src/main/services/<id>/index.ts` に `Service` 実装（`export const <id>Service`）。
3. `src/main/services/registry.ts` で `register(<id>Service)`。
4. サイト固有のレスポンスを `Post` / `PostFile` に正規化する
   （`PostFile.url` は最終的なダウンロード URL、`kind` は種別へマッピング）。
5. フィクスチャ（保存した実 HTML/JSON）を `__tests__` に置き、正規化のユニットテストを書く。

UI・エンジン・ストレージ側の変更は不要。

## VERIFY: 規約

対象サイトの多くは **公開 API を持たない**。内部 XHR エンドポイントやページ構造に依存する
箇所は、コード中で `VERIFY:` コメントを付け、「実サイトで検証しフィクスチャを保存するまでは
未確認」として扱う。確認済みのように記述しない。

検証ワークフロー:

1. WebView でログインし、DevTools / プロキシで実際のリクエストとレスポンスを確認。
2. レスポンスのサンプルを `__tests__/fixtures/` に保存（個人情報は除去）。
3. パーサ（`parse*` / `normalize*`）をフィクスチャに対して実装・テスト。
4. `VERIFY:` コメントを、確認済みなら通常コメントに更新。

## サイト別メモ（埋めていく）

### Fantia（実装・**実 API 検証済み** 2026-06-08）
- 実装: `src/main/services/fantia/`。`scripts/probe-fantia.cjs` で検証。
- ログイン: WebView で `https://fantia.jp/`（Cookie `_session_id`）。画像は署名済み cc.fantia.jp(CloudFront)。
- 認証判定: `GET /api/v1/me` → `{current_user:{id}}`（200=ログイン済 / 401=未）。**`current_user.id`** を見る。
- クリエイター列挙: `GET /api/v1/me/fanclubs` → `{fanclub_ids:[…]}`、各 `GET /api/v1/fanclubs/{id}` で `fanclub_name`/`creator_name` を解決。
- 投稿列挙: **HTML `/fanclubs/{id}/posts?page=N`（XHR ヘッダ無し）**をページングして `/posts/{id}` を抽出（新規ゼロで停止）。
- post 詳細: `GET /api/v1/posts/{id}` に **`X-CSRF-Token`（HTML の `<meta csrf-token>`）+ XHR が必須**（無いと 403）。
- 正規化: `post_contents` の `photo_gallery`（`post_content_photos[].url.original`）/`file`（`download_uri`）。相対は絶対化。`normalize.test.ts`。

### Pixiv Fanbox（実装・**実 API 検証済み** 2026-06-07）
- 実装: `src/main/services/fanbox/`（`index.ts` = ネットワーク、`normalize.ts` = 純粋変換 + テスト）。
- ログイン済みセッションで `scripts/probe-fanbox.cjs` により実 API を検証（checkAuth→列挙→投稿→画像 DL まで通し確認）。
- 確定エンドポイント: `user.countUnreadMessages`（200 `{body:数値}`=ログイン済み）/ `plan.listSupporting`（支援クリエイター）/
  `post.paginateCreator`→ページ URL 配列→各 `post.listCreator`（`body` が投稿配列）→ `post.info`（`body.body.images/files/blocks`）。
- 画像は `downloads.fanbox.cc`（Referer 必須＝`downloadHeaders`）。
- ログイン: WebView で `https://www.fanbox.cc/`。Cookie は `FANBOXSESSID`。
- API は `https://api.fanbox.cc`。**`Origin: https://www.fanbox.cc` ヘッダ必須**（`apiHeaders`）。
- メディア CDN は **`Referer` 必須** → `Service.downloadHeaders` で全ファイル DL に付与（engine が適用）。
- 認証判定: `GET /user.countUnreadMessages`（`VERIFY:`）。
- 支援クリエイター列挙: `GET /plan.listSupporting`（creatorId で重複排除、`VERIFY:`）。
- 投稿列挙: `GET /post.listCreator?creatorId=&limit=50` を `nextUrl` でページング、各 `post.info` で詳細取得（`VERIFY:`）。
- 正規化: image / file / article（blocks + imageMap/fileMap、順序保持）に対応。拡張子で video/audio/file を判別。
  body が null（権限なし）の投稿は skip。`normalize.test.ts` にフィクスチャテストあり。
- 未確認点はコード中 `VERIFY:`。実アカウントでレスポンスを保存し、フィクスチャ化して確定する。

### Patreon / ci-en
- 未着手。`docs/roadmap.md` 参照。
