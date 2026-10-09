# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The official desktop + web client for Pufferblow (a self-hosted, Discord-like
community platform). Built with React 19, React Router v7 (SSR disabled —
`ssr: false` in `react-router.config.ts`, so this is effectively a SPA built
via the React Router toolchain), Tailwind CSS v4, and Electron 36.

It is one of four sibling repos:

| Repo | Language | Role |
|---|---|---|
| `pufferblow` | Python / FastAPI | Control plane — REST API, auth, storage, federation (the server instance) |
| `client` (this repo) | TypeScript / React / Electron | Desktop and web client |
| `media-sfu` | Go / Pion WebRTC | Media plane — WebRTC voice/screen-share forwarding |
| `pypufferblow` | Python | Official SDK and bot framework |

**Key platform concept — the client is instance-agnostic.** There is no
hardcoded backend URL. Users point the client at *any* self-hosted Pufferblow
instance (host:port), stored as `host_port` (cookie + storage) and resolved
via `app/services/instance.ts`'s `resolveInstance()`. That single function
derives the API base URL, WS base URL, and whether to use `http/ws` vs
`https/wss` (private IPs / `localhost` / `.local` / `.internal` get plain
`http`; everything else gets `https`). Every service module calls
`createApiClient()` / `getHostPortFromStorage()` rather than importing a
fixed base URL — don't introduce one.

## Commands

```bash
npm install                        # install deps (Node >= 20.17, see .nvmrc)

npm run dev                        # web dev server (Vite) at http://localhost:5173
npm run desktop:dev                # desktop dev: runs 3 processes concurrently —
                                    #   1. Vite dev server on 127.0.0.1:5173 (strict port)
                                    #   2. tsup --watch compiling electron/*.ts -> dist-electron/
                                    #   3. electron dist-electron/main.js once the server is up (wait-on + nodemon)

npm run build                      # production web build -> build/client
npm run typecheck                  # react-router typegen, then tsc
npm run lint                       # eslint . --ext ts,tsx --max-warnings 0
npm run lint:fix
npm run format / format:check      # prettier

npm run test                       # vitest watch mode
npm run test:run                   # vitest run once (what CI runs)
npm run test:ui                    # vitest UI

npm run desktop:build              # full desktop build for current OS (build + electron main + electron-builder)
npm run desktop:build:windows      # NSIS + MSI -> release/
npm run desktop:build:linux        # AppImage + deb + rpm -> release/ (needs rpm, libfuse2 on the build host)
npm run desktop:build:macos        # dmg + zip -> release/
```

CI (`.github/workflows/deploy.yml`, push/PR to `main`): installs, lints,
`format:check`s, runs `test:run`, builds, then deploys `build/client` to
GitHub Pages. `.github/workflows/desktop-release.yml` (on GitHub Release
publish, or manual dispatch) builds installers on all three OSes and attaches
them to the release — that's also how `electron-updater` gets its update
feed (`publish:` in `electron-builder.yml` points at GitHub Releases for
`PufferBlow/client`, `releaseType: release` so drafts/prereleases are
ignored).

## Architecture

### Electron: main / preload / renderer split

- `electron/main.ts` — the main process. Compiled by **tsup** (not Vite) to
  `dist-electron/main.js`, `preload.js`, `tray.js` as CJS, with `electron`
  marked external. This is a separate build pipeline from the Vite web build;
  `npm run build:electron:main` (or its `:watch` variant) must run alongside
  the Vite build for the desktop app to work (`desktop:dev` wires both up via
  `concurrently`).
- `electron/preload.ts` — the only renderer-facing surface. Uses
  `contextBridge.exposeInMainWorld('electron', {...})` with
  `contextIsolation: true` / `nodeIntegration: false`; the renderer detects
  Electron via `'electron' in window` (see `app/root.tsx`). Exposes:
  window controls (custom frameless title bar — `frame: false` on
  `BrowserWindow`), auto-update IPC, deep-link draining, tray/notification
  muting, and the hardware-acceleration toggle.
- Production renderer loads from a custom `app://pufferblow/` protocol
  (registered as secure/standard in `protocol.registerSchemesAsPrivileged`),
  serving files out of `build/client/`. Dev loads `http://localhost:5173`
  directly. `protocol.handle('app', ...)` falls back to `index.html` for any
  unresolved path (SPA client-side routing).
- A splash `BrowserWindow` (loads `dist-electron/splash.html`, copied there
  by `build:electron:assets`) fronts the app during boot/update-check and is
  driven by `executeJavaScript` calls into a `window.__pbSetSplashStatus` /
  `__pbSetSplashProgress` shim rather than a preload, since its lifetime is
  too short to justify one.
- Non-obvious main-process behaviors worth knowing before touching
  `main.ts`: a Chromium `disable-features` switch works around Private
  Network Access preflights blocking fetches to local-network instances from
  the `app://` origin; `onBeforeSendHeaders` spoofs `Origin:
  http://localhost:5173` on every outgoing renderer request so instances'
  CORS policy accepts them; single-instance lock + `pufferblow://` custom
  protocol handles OS-level deep links (argv-based on Windows/Linux via
  `second-instance`, `open-url` event on macOS); window `close` is trapped to
  hide-to-tray unless `before-quit` has set `quittingForReal`.
- Auto-updates (`electron-updater`) poll GitHub Releases every 6h plus once
  at boot; auto-download defaults on but is a persisted, user-togglable
  per-install setting (`main-settings.json` in `userData`) alongside
  hardware-acceleration (also default-off, needs restart).

### Routing and top-level app shell

`app/routes.ts` is the React Router v7 route table (not file-based routing —
explicit `route()`/`index()` calls). `app/root.tsx`'s default export wraps
every route and does the real access control in render logic (not route
loaders): it reads the auth cookie via `getAuthTokenFromCookies()`,
classifies the current path as public/auth/home/protected, and issues
`<Navigate>` redirects accordingly — including an Electron-only rule that
immediately bounces `/` and `/download` (web-only marketing/download pages)
to `/login` or `/dashboard` since the desktop build never ships them.
`TanStack Query`'s cache is persisted to `localStorage` (keyed
`PUFFERBLOW_QUERY_CACHE`, busted via `CACHE_BUSTER`) so channel/user data
survives reloads and app restarts; it's cleared on auth expiry.
`startBackgroundAuthRefresh` (in `authSession.ts`) runs a periodic token
refresh independent of any one component's lifecycle.

### Service layer (`app/services/`)

This is where almost all non-UI logic lives; components should stay thin.
Notable modules beyond the obvious CRUD ones (`user.ts`, `channel.ts`,
`message.ts`):

- **`apiClient.ts`** — the shared REST client. Transparently injects the
  current auth token into the request body/query/FormData (whichever the
  endpoint expects — note the API takes `auth_token` as a request parameter,
  not an `Authorization` header), retries once on 401 via
  `refreshAuthSession()` (except for the signin/signup/refresh endpoints
  themselves, to avoid loops), and flattens FastAPI's two different
  `detail` error shapes (string vs. Pydantic validation-error array) into one
  readable message.
- **`instance.ts`** — see the platform-concept note above; this is the
  single source of truth for turning a user-entered `host:port` into API/WS
  base URLs.
- **`authSession.ts`** — cookie + storage-backed session persistence
  (`remember me` controls localStorage vs. sessionStorage), background
  refresh loop, and the public-route list used for post-logout redirects.
- **`decentralizedAuth.ts`** / **`activitypub.ts`** — client-side pieces of
  the federation model: cross-instance auth challenges and the
  ActivityPub-based DM/follow bridge. Federation moves messages, not logins —
  a user's credentials only ever work against the instance they signed up on.
- **`voiceTransport.ts`** + **`voiceCallSession.ts`** — the WebRTC voice/
  screen-share stack, and the most intricate code in the client:
  - `VoiceTransport` owns one `RTCPeerConnection` + one signaling
    `WebSocket` opened directly against **media-sfu's** `signaling_url`
    (handed back by the Pufferblow backend's voice-join REST call as a
    `VoiceSessionBootstrap` — `session_id`, `join_token`, `signaling_url`,
    `ice_servers`, a quality profile). The client never talks WebRTC to the
    Pufferblow API itself; the API only issues join tokens and relays
    control-plane state (participants, mute state) — media flows
    client ↔ media-sfu.
  - It builds a local audio graph through `AudioContext` (mic →
    `GainNode` for the volume slider → `MediaStreamDestination` fed to the
    peer connection) so volume/PTT/device changes don't require renegotiating
    with the SFU.
  - Screen share reuses the same peer connection (`addTrack` + manual
    `renegotiate()`, not `onnegotiationneeded` — that's deliberately not wired
    up because the initial connect already does `createOffer` by hand).
    Incoming video tracks are matched to users via a FIFO queue
    (`pendingVideoUserIds`) populated by a `screen_share_started` signal that
    arrives just before the track.
  - Reconnection uses exponential backoff (`RECONNECT_BACKOFF_MS`) and
    replays the **same** `join_token`/`session_id` rather than re-hitting the
    REST join endpoint, so peers see a resume instead of a leave+rejoin.
  - `voiceCallSession.ts` is a module-level (not React-state) singleton
    registry so the call survives route navigation — e.g. opening Settings
    while in a voice channel doesn't tear down the `VoiceTransport` the way
    it would if it were owned by a component's `useEffect`. Components
    re-attach callbacks via `transport.setCallbacks()` on remount instead of
    recreating the transport. Only one active call is supported at a time.
- **`websocket.ts`** — the regular chat/presence WebSocket (separate
  connection from voice signaling), typed message unions for chat,
  presence, channel membership, read receipts, and ActivityPub "ping"
  events.
- **`secureStorage.ts`**, **`deepLink.ts`**, **`desktopNotifications.ts`**,
  **`githubReleases.ts`** — Electron-adjacent concerns (secure credential
  storage, `pufferblow://` deep-link parsing shared between main-process IPC
  and the renderer router, desktop notification + unread-badge plumbing, and
  update-check metadata fetched from GitHub).

### State management

No Redux/Zustand. State is: TanStack Query (server data, persisted to
localStorage as above) + a handful of small React Contexts
(`app/context/TitleBarContext.tsx` for the custom title bar;
`ThemeProvider`/`ToastProvider` live under `app/components/`) + module-level
singletons for things that must outlive component trees (voice call
session, background auth refresh).

### Directory layout quick-reference

```
app/
  components/      UI, grouped by feature (control-panel/, dashboard/, settings/, ui/...)
  routes/           React Router route modules (paired 1:1 with app/routes.ts entries)
  services/         almost all business logic — see above
  models/           TS types for API entities (Channel, Message, Ping, User)
  context/          React Context providers
  utils/            shared helpers (logger, auth-redirect path builder, etc.)
electron/           main/preload/tray source, compiled by tsup -> dist-electron/
resources/icons/    multi-platform app icons consumed by electron-builder.yml
```
