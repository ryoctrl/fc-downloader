# Contributing

[日本語](CONTRIBUTING.md) | English | [简体中文](CONTRIBUTING.zh-CN.md)

Thank you for your interest in contributing to fc-downloader.
Bug reports, feature requests and pull requests (PRs) are all welcome, in English or Japanese.

This is the English version of the [contributing guide](CONTRIBUTING.md).

Please follow the [Code of Conduct](https://github.com/ryoctrl/.github/blob/master/CODE_OF_CONDUCT.md) when taking part.

---

## ⚠️ Read this first

This app is a tool for **personally backing up and viewing content you support**
([disclaimer](README.en.md#%EF%B8%8F-disclaimer-please-read) / [docs/spec/security-and-legal.md](docs/spec/security-and-legal.md)).
Changes that go against this — obtaining paid content without paying, bypassing access restrictions, features
meant for redistribution or sharing, and so on — will not be accepted.

This repository is public. **Never include** the following in issues, PRs or commits:

- Credentials such as cookies, sessions, tokens or passwords
- Values taken from a real account, such as real creator names, post ids, content hashes or signed URLs
- Downloaded non-public content (including anything visible in images, files or screenshots)

Use **made-up values** in tests and fixtures (dummy creator ids, dummy hashes, placeholder tokens).
CI runs a secret scan (gitleaks / ggshield); a PR with a finding cannot be merged.

## Issues

- Open bug reports and feature requests from the [issue templates](https://github.com/ryoctrl/fc-downloader/issues/new/choose).
- If you'd like to discuss a larger change before starting, please open an issue first.
- Don't report vulnerabilities in a public issue; report them privately as described in [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js 24 (the version CI uses) and npm. The app uses no native modules, so build tools such as
Python or MSVC are not needed.

```bash
npm install        # install dependencies
npm run dev        # start the app with HMR
npm run typecheck  # type-check both node and web
npm run lint       # ESLint
npm test           # vitest
npm run build      # type-check + electron-vite build
```

The design and directory layout are described in [CLAUDE.md](CLAUDE.md) and [docs/](docs/) (mostly in Japanese).
These are especially useful:

- [docs/spec/architecture.md](docs/spec/architecture.md) — overall structure
- [docs/spec/service-abstraction.md](docs/spec/service-abstraction.md) — adding a supported site
- [docs/spec/ipc-contract.md](docs/spec/ipc-contract.md) — adding an IPC channel
- [docs/spec/storage-and-dedup.md](docs/spec/storage-and-dedup.md) — save layout and duplicate detection

## Code conventions

- **Adding a site**: implement `Service` in `src/main/services/<id>/`, register it in `registry.ts`, and add `<id>` to `ServiceId` in `src/shared/types.ts`.
- **Adding IPC**: first add the channel to `IpcApi` in `src/shared/ipc.ts`, then the handler in `src/main/ipc/handlers.ts` and the allowlist entry in `src/preload/index.ts`. Don't hand-write `any`.
- Keep Node / Electron / DOM imports out of `src/shared/*` (it is used by both main and renderer).
- Mark code that depends on a site's undocumented API and hasn't been checked against the real site with a `VERIFY:` comment.
- Don't give the renderer Node access (keep `contextIsolation: true` / `nodeIntegration: false`; everything goes through `window.api`).
- Put investigation scripts in `scripts/_*.cjs` (a gitignored prefix) and don't commit them.
- Formatting follows Prettier (`npm run format`) and `.editorconfig`.
- **UI text**: add every new string to all three languages — Japanese and English in `src/renderer/src/design/i18n.ts`, Simplified Chinese in `src/renderer/src/design/locales/zh-CN.ts`. `i18n.test.ts` checks that keys and placeholders match.

## Pull requests

1. Branch off `main`. Keep each PR to a single purpose.
2. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages (e.g. `fix(cien): ...`, `feat(viewer): ...`, `docs: ...`).
3. Before opening a PR, make sure all of these pass (CI runs the same):
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
4. For changes that affect behavior, check them in the actual app where possible and describe the result in the PR.
5. Fill in the PR template with what changed, why, and any related issue.

## License

By contributing, you agree that your contribution is released under the same [MIT License](LICENSE) as this repository.
