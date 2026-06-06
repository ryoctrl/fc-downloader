# ADR 0003: メタデータ/重複台帳は JSON ストア（MVP）、SQLite は将来バックエンド

- ステータス: 採用 (2026-06-07)

## 背景

重複ダウンロード防止のため、取得済みの投稿・ファイルを判定する索引が要る。
将来はビューワーの絞り込み/タグ/検索でもクエリが必要。当初は better-sqlite3 を想定した。

## 決定

**MVP は zero-dependency の JSON ストア**（`src/main/storage/db.ts`）を採用する。
SQLite（better-sqlite3 等）は **M4 以降の将来バックエンド** として、件数増加・検索要件が
顕在化した時点で導入する。`db.ts` の公開 API はリレーショナルストアを模した形に保ち、
呼び出し側を変えずに差し替えられるようにする。

## 理由

- **ネイティブビルド不要**: better-sqlite3 はネイティブモジュールで、ビルドに Python +
  MSVC（または Node/Electron ABI 一致の prebuild）が必要。開発・自動開発環境に
  ビルドチェーンが無い場合 `npm install` 自体が失敗する。JSON ストアはこの摩擦を完全に除去する。
- **設計と整合**: 本プロジェクトは「ディスクのフォルダ構成が source of truth、台帳は索引」
  という方針（[storage-and-dedup.md](../spec/storage-and-dedup.md)）。台帳が壊れても
  ディスクから再構築できるため、MVP 規模では JSON で十分。
- **差し替え容易**: 公開関数（`isPostComplete` / `isFileDownloaded` / `upsertPost` /
  `markFileDownloaded` / `refreshPostCompletion`）を介するため、SQLite 実装に置換しても
  engine / handlers は無変更。

## 代替案

- **better-sqlite3（当初案）**: 高速・SQL クエリが強いが、ネイティブビルド依存が
  本環境で `npm install` を破壊した。将来 SQLite が必要になった時に再評価する。
- **node:sqlite（Node 組み込み）**: Electron 同梱 Node のバージョン次第で未提供のため見送り。
- **lowdb / LevelDB**: 依存追加に見合うメリットが MVP 規模では薄い。

## 帰結

- 追加のランタイム依存ゼロ。`npm install` はビルドチェーン無しで成功する。
- 大量データ・検索要件が出たら SQLite バックエンドを実装し `db.ts` を差し替える（M4）。
- ディスクが source of truth、台帳はキャッシュ/索引、という関係を維持する。
