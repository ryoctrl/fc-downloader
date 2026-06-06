# ADR 0002: UI スタックに React + TypeScript + Vite を採用

- ステータス: 採用 (2026-06-07)
- 決定者: プロジェクトオーナー（ユーザー承認済み）

## 背景

ファイルビューワー（ツリー/グリッド）やダウンロード設定など、状態を持つ UI を
継続的に拡張する。型安全性とエコシステムの広さが重要。

## 決定

**React + TypeScript + Vite** を採用し、Electron 統合は **electron-vite** で行う。

## 理由

- React はビューワー/ツリー/プレビュー系のライブラリ選択肢が最も豊富。
- TypeScript で IPC 契約（`shared/ipc.ts`）を main/renderer 間で共有し、型安全に保てる。
- electron-vite は main/preload/renderer を一括ビルドし HMR を提供、設定が簡潔。

## 代替案

- Vue / Svelte: いずれも妥当だが、ビューワー周りのライブラリ資産と将来人員確保の観点で
  React を優先。

## 帰結

- `electron.vite.config.ts` で 3 ターゲットを構成。
- `tsconfig.node.json`（main/preload）と `tsconfig.web.json`（renderer）を分離。
- `src/shared/*` は Node/DOM 非依存に保ち、両プロセスから利用する。
