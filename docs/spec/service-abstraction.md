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
  downloadHeaders?: Record<string, string>          // ファイル DL に付ける追加ヘッダ（Referer 等）
  checkAuth(ctx): Promise<boolean>                  // ログイン判定（軽量）
  listCreators(ctx): Promise<Creator[]>             // 支援中クリエイター列挙
  resolveCreator?(ctx, pageUrl): Promise<Creator | null>  // 表示中ページのクリエイター特定（任意）
  recentPosts?(ctx, maxPages): AsyncIterable<RecentPost>  // ホームのフィード（「New」表示用・任意）
  listPosts(ctx, creatorId): AsyncIterable<Post>    // 投稿列挙（内部でページング）
  countPosts?(ctx, creatorId): Promise<number>      // 詳細を取らずに件数だけ数える（任意）
  resolvePost?(ctx, post): Promise<Post>            // 投稿詳細の補完（任意）
}
```

任意メソッドを実装しないサービスでは、対応する UI（クリエイター追加・「New」表示・
件数の事前表示）が出ないだけで、他は動く。

`ServiceContext` は以下を提供する:

- `fetchJson<T>(url, init)` / `fetchText(url, init)` — サービスの隔離セッション経由
  （ログイン Cookie が自動適用される）。
- `log(level, msg, meta)` — サービス単位のロガー。
- `signal: AbortSignal` — キャンセル用。
- `progress?(done, total)` — 列挙の進捗を UI に伝える。
- `completedPostStub?(creatorId, postId)` — 取得済みの投稿なら台帳から組み立てた `Post` を返す。
  アダプタはこれを使って投稿詳細の取得（多くはレート制限のある 1 投稿 1 リクエスト）を省ける。
- `period?` — 実行の期間指定（エポックミリ秒）。一覧に公開日があるアダプタは、範囲外の詳細取得を
  省き、ページングを早めに止めてよい（範囲外はエンジンが最終的に捨てる）。
- `markIncomplete?()` — 一覧ページや投稿詳細の取得に失敗して飛ばしたときに呼ぶ。エンジンは
  そのクリエイターの同期日時（「前回以降」の基準）を進めない。

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

## サイト別メモ

### Fantia（実装・**実 API 検証済み** 2026-06-08）
- 実装: `src/main/services/fantia/`。`scripts/probe-fantia.cjs` で検証。
- ログイン: WebView で `https://fantia.jp/`（Cookie `_session_id`）。画像は署名済み cc.fantia.jp(CloudFront)。
- 認証判定: `GET /api/v1/me` → `{current_user:{id}}`（200=ログイン済 / 401=未）。**`current_user.id`** を見る。
- クリエイター列挙: `GET /api/v1/me/fanclubs` → `{fanclub_ids:[…]}`、各 `GET /api/v1/fanclubs/{id}` で `fanclub_name`/`creator_name` を解決。
- 投稿列挙: **HTML `/fanclubs/{id}/posts?page=N`（XHR ヘッダ無し）**をページングして `/posts/{id}` を抽出（新規ゼロで停止）。
- post 詳細: `GET /api/v1/posts/{id}` に **`X-CSRF-Token`（HTML の `<meta csrf-token>`）+ XHR が必須**（無いと 403）。
- 正規化: `post_contents` の `photo_gallery`（`post_content_photos[].url.original`）/`file`（`download_uri`）。相対は絶対化。`normalize.test.ts`。
- 購入済みショップ商品（`purchases.ts`）: 注文履歴 `/mypage/users/purchases` → 各注文
  `/mypage/users/purchases/<orderId>`（商品ごとのファイル名と `/products/<id>/content_download`）、
  販売元は `/products/<id>` の最初のファンクラブリンク。1 商品を投稿 `product-<id>` として扱い、
  通常のレイアウト・台帳・ビューワーにそのまま流す。フォローしていない販売元の商品も対象。
  HTML スクレイプのため `VERIFY:` 扱い（2026-07 に実サイトで形を確認）。

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
- 支援クリエイター列挙: `GET /plan.listSupporting` + フォロー中の `creator.listFollowing`（creatorId で重複排除、`VERIFY:`）。
- 投稿列挙: `post.paginateCreator` のページ URL を順に取得し、各 `post.info` で詳細取得（`VERIFY:`）。
  2026-07 に `post.paginateCreator` の形が変わり、ダウンロードが空振りした前例がある。
- 新着（`recentPosts`）: `post.listHome`。
- 正規化: image / file / article（blocks + imageMap/fileMap、順序保持）に対応。拡張子で video/audio/file を判別。
  body が null（権限なし）の投稿は skip。`normalize.test.ts` にフィクスチャテストあり。
- 未確認点はコード中 `VERIFY:`。実アカウントでレスポンスを保存し、フィクスチャ化して確定する。

### ci-en（実装・**実サイト検証済み** 2026-06-08）
- 実装: `src/main/services/cien/`（`parse.ts` = HTML パース + テスト）。`scripts/probe-cien.cjs` で検証。
- ドメイン: `ci-en.net` から `ci-en.dlsite.com` へ移行済み。旧ドメインはリダイレクトされるが Cookie が
  引き継がれないため、新ドメインを直接使う（移行前にログインした利用者は再ログインが必要）。
  メディアは `media.ci-en.jp`。
- 認証判定: `/mypage` に会員用ナビ（`/mypage/settings` 等）があるか。2026-10 のリニューアルで
  `/logout` リンクが無くなったため、それには頼らない。
- クリエイター列挙: `/mypage/subscription` の `/creator/<id>`。
- 投稿列挙: `/creator/<id>/article?page=N`。限定公開の添付は署名付き
  `media.ci-en.jp/private/attachment/...`（`upload/<name>` がオリジナル）。
- 新着（`recentPosts`）: `/mypage/recent`（支援先の新着記事一覧）。

### Patreon（実装・一部検証済み）
- 実装: `src/main/services/patreon/`（`creators.ts` / `normalize.ts` = 純粋変換 + テスト）。
  サイト内部の JSON:API（`www.patreon.com/api`）を使う。
- 認証判定: `GET /api/current_user` → 200 `{data:{id,type:"user"}}`（2026-06-08 検証済み）。
- クリエイター列挙: 有料の支援は `current_user` の `pledges`（2026-10 に利用者が確認）。
  無料メンバーシップはどの一覧にも出ないため、ホームのフィード
  （`/api/stream?filter[is_following]=true`）を数ページ読んで見つける。それでも出ない
  クリエイターは、利用者がそのページから追加する（`resolveCreator`）。
- 投稿・メディア列挙: `/api/posts?filter[campaign_id]=...`（JSON:API）。**`VERIFY:`** — 有料で支援中の
  アカウントでの実取得確認が未了。
- アプリ内で Google ログインを完了できない場合に備え、Cookie `session_id` の貼り付けに対応。
