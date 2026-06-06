# CLAUDE.md — fc-downloader

This file orients an AI agent (and humans) working on this repo. Read it first,
then the docs it points to. Keep it up to date when architecture changes.

## What this is

A **local-first desktop app** to download and view content from fan-club
support sites (Fantia, Pixiv Fanbox, Patreon, ci-en). Everything runs on the
user's PC; nothing is uploaded anywhere. The user logs into each service inside
an embedded WebView; the app reuses those session cookies to download the
content the user already supports, then browses it in a built-in viewer.

Intended use is **personal / private backup only**. See
[docs/spec/security-and-legal.md](docs/spec/security-and-legal.md).

## Tech stack (decided — see docs/adr)

- **Electron** — desktop shell. Per-service cookie isolation via
  `session.fromPartition('persist:<serviceId>')`. ADR 0001.
- **React + TypeScript + Vite**, built with **electron-vite**. ADR 0002.
- **JSON metadata store** (`storage/db.ts`) — dedup ledger, zero native deps.
  SQLite is a documented future backend (M4). ADR 0003.

## Layout

```
src/
  main/        Electron main process (Node)
    services/  Per-site adapters implementing the Service interface
      types.ts     <- the Service contract every site implements
      registry.ts  <- register new services here
      fantia/      <- MVP adapter (endpoints marked VERIFY:)
    session/   Per-service Electron session + cookie-aware fetch (net module)
    download/  Download engine (enumerate -> dedup -> fetch w/ concurrency)
    storage/   layout.ts (paths/dedup key), db.ts (sqlite), settings.ts, viewer.ts
    ipc/       Typed ipcMain handlers
    index.ts   App bootstrap
  preload/     contextBridge -> window.api (typed by shared/ipc.ts)
  renderer/    React UI (ported from the design handoff)
    src/design/    design system: icons, primitives, context, i18n, types,
                   data.ts (MOCK content — replaced by window.api in M2.5)
    src/components/ TopBar, Rail (shell)
    src/screens/   Service, Progress, Library, Favorites, PostDetail, Settings
    src/App.tsx    prefs/state/routing/theme; src/theme.css  design tokens
  shared/      types.ts + ipc.ts  (no Node/DOM imports — used by both sides)
docs/          Spec, ADRs, roadmap (source of truth for design)
  design-handoff/  original Claude Design prototype = visual spec for the UI
```

## How everything connects

1. Renderer calls `window.api['channel'](...)` → preload `ipcRenderer.invoke`
   → main `ipcMain.handle` in `src/main/ipc/handlers.ts`.
2. A **Service** adapter enumerates creators/posts using a `ServiceContext`
   whose `fetchJson/fetchText` go through the service's isolated Electron
   session (so the user's login cookies apply).
3. The **DownloadEngine** walks posts, checks the **dedup** ledger
   (`storage/db.ts`) + disk, and writes files to
   `<root>/<serviceId>/<creatorId>/<year>/<month>/<postId>/`.
4. Progress is pushed to the renderer via typed events (`download:progress`).
5. The **viewer** rebuilds its tree by walking that same folder layout.

The folder-layout tuple **is** the dedup key. Read
[docs/spec/storage-and-dedup.md](docs/spec/storage-and-dedup.md).

## Commands

```bash
npm install        # no native build required (pure-JS deps only)
npm run dev        # launch app with HMR
npm run typecheck  # tsc for both node + web projects — run before committing
npm run lint
npm test           # vitest
npm run build      # typecheck + electron-vite build
npm run dist       # package installers via electron-builder
```

> No native modules: the metadata store is pure JS (JSON-backed), so `npm
> install` needs no Python/MSVC toolchain. If/when SQLite is adopted (M4),
> revisit this note.

## Conventions

- **Adding a service**: implement `Service` in `src/main/services/<id>/`,
  register it in `registry.ts`, add `<id>` to `ServiceId` in
  `src/shared/types.ts`. Nothing else should need to change. Full guide:
  [docs/spec/service-abstraction.md](docs/spec/service-abstraction.md).
- **IPC**: add the channel to `IpcApi` in `src/shared/ipc.ts` first, then the
  handler (`handlers.ts`) and the preload allowlist (`preload/index.ts`). Types
  flow from the contract — don't hand-write `any`.
- `src/shared/*` must stay import-free of Node/Electron/DOM so both processes
  can use it.
- Anything depending on a live site's undocumented API is marked `VERIFY:` in
  comments. Treat those as "unverified until tested against the real site with a
  saved fixture." Don't present them as confirmed.
- Security: `contextIsolation: true`, `nodeIntegration: false`. The renderer
  never gets Node access; everything goes through the typed `window.api`.

## Current status & next steps

MVP scaffold + the **full design UI** are implemented and **verified to
install, typecheck, lint, test (5 passing), and build**. The renderer currently
renders from a **mock data layer** (`src/renderer/src/design/data.ts`) — wiring
it to the real backend is M2.5. The **Fantia adapter's network/parsing is
stubbed** (endpoints marked `VERIFY:`). The remaining M1 item is a manual GUI
launch (`npm run dev`). See
[docs/roadmap.md](docs/roadmap.md) for the ordered task list. The immediate next
task is making Fantia `listCreators` / `listPosts` / file-URL resolution real,
backed by saved HTML/JSON fixtures and tests.
