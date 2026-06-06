# 保存レイアウトと重複検知

## フォルダレイアウト

```
<downloadRoot>/
  <serviceId>/            例: fantia
    <creatorId>/          クリエイター識別子（必要に応じてサニタイズ）
      <year>/             投稿年   例: 2026
        <month>/          投稿月(2桁)  例: 06
          <postId>/       投稿ID
            <fileName>    実ファイル
```

このタプル `(serviceId, creatorId, year, month, postId)` が **投稿の識別子** であり、
そのまま **重複検知のキー** になる。`storage/layout.ts` がパス生成と
ファイル名サニタイズ（Windows 禁止文字の置換、長さ制限）を担う。

年/月は投稿日時（`postedAt`, ISO-8601）の UTC から導出する（`toLocationParts`）。

## メタデータ台帳（重複台帳）

`storage/db.ts`。MVP は **zero-dependency の JSON ストア**（ネイティブビルド不要、ADR 0003）。
ディスクのフォルダ構成を **正** とし、台帳は索引 + 重複台帳として機能する。

- 投稿レコード（`completed`: 既知ファイルが全取得済みかのフラグ）。
- ファイルレコード（`downloaded`: ファイル単位の取得済みフラグ）。

公開 API（`isPostComplete` / `isFileDownloaded` / `upsertPost` / `markFileDownloaded` /
`refreshPostCompletion`）はリレーショナルストアを模した形に保ち、将来 SQLite へ
差し替えても呼び出し側を変えずに済むようにしている。

## 重複判定ロジック（engine）

ファイル取得前に、`options.skipExisting` が ON のとき以下の順で判定:

1. `posts.completed = 1`（投稿全体が完了済み）→ 投稿ごとスキップ。
2. `files.downloaded = 1`（当該ファイルが台帳上取得済み）→ スキップ。
3. 実ファイルが既にディスクに存在 → 台帳を更新してスキップ。

いずれも該当しなければ取得し、`files` に記録、最後に `refreshPostCompletion` で
`posts.completed` を再計算する。

→ 何度実行しても取得済みは再取得されない（冪等）。DB を消してもディスクから復元できる
（`viewer.ts` のツリー構築はディスク走査のみで成立する）。

## 注意点 / 将来課題

- 現状はファイル全体をメモリにバッファしてから書き込む。大容量動画向けに
  **ストリーミング書き込み + レジューム（Range）** を導入予定（[roadmap](../roadmap.md)）。
- `creatorId` にサイト由来の名前を使う場合のサニタイズ衝突に注意（数値 ID 推奨）。
- 同一投稿内のファイル名重複は `file_id` で区別。ファイル名衝突時の連番付与は今後検討。
