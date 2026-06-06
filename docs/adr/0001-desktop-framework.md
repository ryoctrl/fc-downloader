# ADR 0001: デスクトップフレームワークに Electron を採用

- ステータス: 採用 (2026-06-07)
- 決定者: プロジェクトオーナー（ユーザー承認済み）

## 背景

本アプリの核心要件は、(1) 対象サイトのログインページを埋め込み表示する WebView、
(2) サービスごとに隔離した Cookie/セッション管理、(3) そのセッションを使った認証付き
ダウンロード、の 3 点。フレームワーク選定はこれらの成熟度で決まる。

## 選択肢

- **Electron**: Chromium を同梱。`session.fromPartition()` でサービス別 Cookie ジャーを
  完全分離でき、`<webview>` / `BrowserView` でログイン画面を埋め込み、`net` モジュールで
  セッション Cookie を共有した認証ダウンロードが可能。スクレイピング/認証フローが成熟。
  欠点: バイナリが大きい（~150MB）、メモリ消費が多め。
- **Tauri**: Rust 製で軽量（~10MB）・省メモリ。OS 標準 WebView（Windows=WebView2）を使用。
  欠点: 複数 WebView の制御や Cookie 抽出（WebView2 経由）の成熟度が Electron より低く、
  本要件（多サービスの Cookie 隔離 + 認証 DL）で追加実装コストが読みにくい。

## 決定

**Electron** を採用する。Cookie 隔離・複数 WebView・認証付きダウンロードという中核要件に
対する成熟度と実装容易性を優先する。バイナリサイズ等の欠点は許容範囲。

## 帰結

- `session.fromPartition('persist:<serviceId>')` を Cookie 隔離の基盤とする。
- ダウンロードは Node `fetch` ではなく Electron `net`（Chromium スタック）で行う。
- 配布は electron-builder。
- 将来 Tauri へ移すなら Service 抽象とストレージ層は再利用可能（コアはフレームワーク非依存）。
