# コントリビューションガイド / Contributing

fc-downloader への貢献に興味を持っていただきありがとうございます。
バグ報告・機能要望・プルリクエスト（PR）のいずれも歓迎します。

> English: Issues and PRs in English are welcome too. The steps below apply as-is.

参加にあたっては [行動規範（Code of Conduct）](https://github.com/ryoctrl/.github/blob/master/CODE_OF_CONDUCT.md) を守ってください。

---

## ⚠️ はじめに必ずお読みください

本アプリは**自分が支援しているコンテンツを、個人的にバックアップ・閲覧する目的**のツールです
（[免責事項](README.md#%EF%B8%8F-%E5%85%8D%E8%B2%AC%E4%BA%8B%E9%A0%85%E5%BF%85%E3%81%9A%E3%81%8A%E8%AA%AD%E3%81%BF%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84) / [docs/spec/security-and-legal.md](docs/spec/security-and-legal.md)）。
この方針に反する変更（有料コンテンツの不正取得、アクセス制限の回避、再配布・共有を目的とした機能など）は受け付けません。

また、このリポジトリは公開されています。Issue・PR・コミットに次のものを**絶対に含めないでください**。

- Cookie・セッション・トークン・パスワードなどの認証情報
- 実在のクリエイター名・投稿 ID・コンテンツのハッシュ・署名付き URL など、実アカウントから取得した値
- ダウンロードした非公開コンテンツ（画像・ファイル・スクリーンショットへの写り込みを含む）

テストやフィクスチャには**架空の値**（ダミーのクリエイター ID、ダミーのハッシュ、プレースホルダのトークン）を使ってください。
CI では secret scan（gitleaks / ggshield）が実行され、検出されると PR はマージできません。

## Issue

- バグ報告・機能要望は [Issue テンプレート](https://github.com/ryoctrl/fc-downloader/issues/new/choose) から作成してください。
- 着手前に大きめの変更を相談したい場合も、まず Issue を立ててもらえると助かります。
- 脆弱性は公開の Issue に書かず、[SECURITY.md](SECURITY.md) の手順で非公開に報告してください。

## 開発環境

必要なもの: Node.js 20 以上、npm。ネイティブモジュールは使っていないため、Python や MSVC などのビルドツールは不要です。

```bash
npm install        # 依存関係のインストール
npm run dev        # HMR 付きでアプリを起動
npm run typecheck  # node / web 両方の型チェック
npm run lint       # ESLint
npm test           # vitest
npm run build      # 型チェック + electron-vite build
```

設計やディレクトリ構成は [CLAUDE.md](CLAUDE.md) と [docs/](docs/) にまとまっています。特に次の文書が参考になります。

- [docs/spec/architecture.md](docs/spec/architecture.md) — 全体構成
- [docs/spec/service-abstraction.md](docs/spec/service-abstraction.md) — 対応サイトの追加方法
- [docs/spec/ipc-contract.md](docs/spec/ipc-contract.md) — IPC チャネルの追加方法
- [docs/spec/storage-and-dedup.md](docs/spec/storage-and-dedup.md) — 保存先レイアウトと重複判定

## コードの約束事

- **対応サイトの追加**: `src/main/services/<id>/` に `Service` を実装し、`registry.ts` に登録、`src/shared/types.ts` の `ServiceId` に `<id>` を追加します。
- **IPC の追加**: まず `src/shared/ipc.ts` の `IpcApi` にチャネルを追加し、次に `src/main/ipc/handlers.ts` のハンドラと `src/preload/index.ts` の許可リストを追加します。`any` を手書きしないでください。
- `src/shared/*` には Node / Electron / DOM の import を入れないでください（main と renderer の両方から使うため）。
- 各サイトの非公開 API に依存する箇所で、実サイトで確認できていないものはコメントに `VERIFY:` を付けてください。
- renderer に Node の権限を与えないでください（`contextIsolation: true` / `nodeIntegration: false` を維持し、すべて `window.api` 経由にします）。
- 調査用のスクリプトは `scripts/_*.cjs`（gitignore 済みの接頭辞）に置き、コミットしないでください。
- 整形は Prettier（`npm run format`）と `.editorconfig` に従います。

## プルリクエスト

1. `main` からブランチを切って作業してください。1 つの PR には 1 つの目的の変更だけを含めてください。
2. コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 形式でお願いします（例: `fix(cien): ...`、`feat(viewer): ...`、`docs: ...`）。
3. PR を出す前に、次がすべて通ることを確認してください（CI でも同じものが実行されます）。
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
4. 動作に関わる変更は、可能な範囲で実際のアプリで確認し、その結果を PR に書いてください。
5. PR テンプレートに沿って、変更内容と理由、関連 Issue を記入してください。

## ライセンス

あなたの貢献は、このリポジトリと同じ [MIT License](LICENSE) で公開されることに同意したものとみなします。
