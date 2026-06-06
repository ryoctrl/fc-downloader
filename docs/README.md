# fc-downloader ドキュメント

設計の source of truth はここ（`docs/`）。コードと食い違ったらまずここを直す。

## 仕様 (spec/)

- [overview.md](spec/overview.md) — プロダクト概要・スコープ
- [requirements.md](spec/requirements.md) — 機能 / 非機能要件
- [architecture.md](spec/architecture.md) — プロセス構成・データフロー
- [service-abstraction.md](spec/service-abstraction.md) — Service 抽象と新規サイト追加手順
- [storage-and-dedup.md](spec/storage-and-dedup.md) — 保存レイアウトと重複検知
- [ipc-contract.md](spec/ipc-contract.md) — main↔renderer の IPC 契約
- [ui-design.md](spec/ui-design.md) — 画面構成（UI 確定後に更新）
- [security-and-legal.md](spec/security-and-legal.md) — セキュリティと利用前提

## 意思決定記録 (adr/)

- [0001-desktop-framework.md](adr/0001-desktop-framework.md) — Electron 採用
- [0002-ui-stack.md](adr/0002-ui-stack.md) — React + TS + Vite 採用
- [0003-metadata-store.md](adr/0003-metadata-store.md) — better-sqlite3 採用

## 計画

- [roadmap.md](roadmap.md) — 実装順のタスクリスト（自動開発の起点）
