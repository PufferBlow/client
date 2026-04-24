<div align="center">

<img src="./public/pufferblow-logo.svg" width="120" alt="Pufferblow logo" />

# Pufferblow Client

**The official desktop and web client for Pufferblow.**

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-36-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/PufferBlow/client/deploy.yml?branch=main&style=flat-square&label=CI)](https://github.com/PufferBlow/client/actions)
[![GitHub Stars](https://img.shields.io/github/stars/PufferBlow/client?style=flat-square&color=yellow)](https://github.com/PufferBlow/client/stargazers)

</div>

---

## Overview

The Pufferblow client is a cross-platform desktop application and progressive web app built with [React Router v7](https://reactrouter.com/), [Tailwind CSS v4](https://tailwindcss.com/), and [Electron](https://www.electronjs.org/). It connects to any self-hosted Pufferblow instance.

**Desktop app** (Electron) — native window, system tray, auto-update support, available for Windows and Linux.

**Web app** — runs directly in the browser by pointing to a Pufferblow instance.

---

## Download

Pre-built installers are attached to each [GitHub Release](https://github.com/PufferBlow/client/releases):

| Platform | File |
|---|---|
| Windows (installer) | `pufferblow-client-windows-x64-setup.exe` |
| Windows (MSI) | `pufferblow-client-windows-x64.msi` |
| Linux (AppImage) | `pufferblow-client-linux-x86_64.AppImage` |
| Linux (deb) | `pufferblow-client_*.deb` |
| Linux (rpm) | `pufferblow-client-*.rpm` |

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + React Router v7 |
| Styling | Tailwind CSS v4 |
| Desktop shell | Electron 36 |
| Build | Vite 7 + tsup |
| Packaging | electron-builder |
| Testing | Vitest + Testing Library |
| Language | TypeScript 5 |

---

## Development Setup

### Prerequisites

- Node.js 20 or later
- npm 10 or later

### Install dependencies

```bash
npm install
```

### Run as a web app

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Run as a desktop app

```bash
npm run desktop:dev
```

This command runs three processes concurrently:

1. Vite dev server at `127.0.0.1:5173`
2. tsup watching and compiling `electron/` to `dist-electron/`
3. Electron loading the dev server once it is ready

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the web dev server |
| `npm run build` | Build the web app |
| `npm run desktop:dev` | Start the desktop app in dev mode |
| `npm run desktop:build` | Build the desktop app for the current OS |
| `npm run desktop:build:windows` | Build Windows installers (NSIS + MSI) |
| `npm run desktop:build:linux` | Build Linux packages (AppImage + deb + rpm) |
| `npm run desktop:build:macos` | Build macOS packages (dmg + zip) |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test:run` | Run the test suite once |
| `npm run test` | Run tests in watch mode |
| `npm run test:ui` | Run tests with the Vitest UI |

---

## Project Structure

```
client/
├── app/
│   ├── components/       UI components (chat, control panel, layout…)
│   ├── routes/           React Router route modules
│   ├── services/         API service layer
│   ├── models/           TypeScript data models
│   └── utils/            Shared utility functions
├── electron/
│   ├── main.ts           Electron main process
│   ├── preload.ts        Context bridge (renderer ↔ main)
│   └── tray.ts           System tray integration
├── resources/
│   └── icons/            App icons for all platforms
├── public/               Static assets
├── electron-builder.yml  electron-builder packaging config
└── .github/workflows/    CI/CD pipelines
```

---

## Building Production Installers

### Windows

```bash
npm run desktop:build:windows
```

Output in `release/`: NSIS setup `.exe` and `.msi`.

### Linux

```bash
npm run desktop:build:linux
```

Output in `release/`: `.AppImage`, `.deb`, and `.rpm`.

> On Linux you may need `rpm` and `libfuse2` installed for RPM and AppImage support:
> ```bash
> sudo apt-get install rpm libfuse2
> ```

---

## CI/CD

Two GitHub Actions workflows are included:

| Workflow | Trigger | Purpose |
|---|---|---|
| `deploy.yml` | Push / PR to `main` | Lint, test, build, deploy to GitHub Pages |
| `desktop-release.yml` | GitHub Release published | Build and attach Windows + Linux installers to the release |

---

## License

Released under the [GNU General Public License v3.0](LICENSE).
