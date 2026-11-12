# Releasing Lux AI

Releases are **tag-driven**. The maintainer cuts a tag; CI builds Windows + Linux artifacts and attaches them to a GitHub Release. Nothing is published without that step.

## TL;DR

```bash
# 1) bump version in package.json (+ package-lock.json), update CHANGELOG.md
npm version 1.4.0 --no-git-tag-version   # or edit by hand
# 2) full local battery MUST be green (single command)
npm run verify   # = test + lint + prettier + CSS drift + smoke + e2e
# 3) commit, tag, push
git commit -am "release: v1.4.0"
git tag v1.4.0
git push && git push --tags
# 4) .github/workflows/release.yml builds artifacts and creates the GitHub Release
```

## What the release workflow does (`.github/workflows/release.yml`)

- `build-windows`: `npm ci` → vendor Monaco → `npm test` → `npx electron-builder --win nsis --publish never` → uploads `dist/*.exe` artifact (signed automatically if `CSC_LINK`/`CSC_KEY_PASSWORD` secrets exist).
- `build-linux`: same steps → AppImage artifact.
- `github-release` (tags `v*` only): downloads artifacts → creates GitHub Release with generated notes (softprops/action-gh-release).

## Code signing (Windows)

SmartScreen warns on unsigned installers until reputation builds. To sign:

1. Buy OV/EV code-signing certificate (e.g. from a CA supporting token/cloud HSM; EV clears SmartScreen fastest).
2. Export as `.pfx`, base64 it (`certutil -encode` → single-line base64).
3. Add repo secrets: `CSC_LINK` (the base64 string) and `CSC_KEY_PASSWORD` (pfx password).
4. Done — electron-builder picks them up automatically. Never commit the pfx or its password.

## Auto-update (publish scaffolded; runtime not wired)

`package.json` → `build.publish` is **already set** to GitHub (`captanemre-crypto/lux-ai`), so update-info metadata can be emitted when a publishing target runs. The app still ships **no** auto-updater — updating means re-installing — until `electron-updater` is wired and **one real tagged release** is published with `latest.yml` attached. To enable:

1. `npm install electron-updater` (runtime dependency).
2. In `main.js` after `app.whenReady()`:
   ```js
   try {
     const { autoUpdater } = require("electron-updater");
     if (app.isPackaged) {
       autoUpdater.autoDownload = false; // ask first; downloads are big
       autoUpdater.checkForUpdates(); // or on a menu item
       autoUpdater.on("update-available", (info) => mainWindow?.webContents.send("update-available", info.version));
       autoUpdater.on("update-downloaded", () => mainWindow?.webContents.send("update-ready"));
     }
   } catch (e) {
     logger.warn("auto-update unavailable", e);
   }
   ```
3. Publish releases via the tag flow — `electron-updater` reads `latest.yml` from the GitHub Release. Attach `dist/latest.yml` (Windows job) and `dist/latest-linux.yml` (Linux job) to the release alongside the installers, or switch the build steps to `--publish onTag` with `GH_TOKEN` set so electron-builder uploads everything itself.

## Crash reporting (optional)

Default: crash dumps stay **local** (`app.getPath('crashDumps')`, path logged at boot). To upload: set `LUX_CRASH_URL` to your collection endpoint (e.g. Sentry's Electron `submitURL`) in the environment that launches the app. No prompts, messages, file contents or API keys are ever attached — only the native crash dump + platform metadata Electron includes.

## Environment variables

| Var                             | Purpose                                       | Default                                            |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `LUX_MODELS_DIR`                | Root for voice/LLM model storage              | platform-dependent (see RELEASING notes in README) |
| `LUX_CRASH_URL`                 | Crash upload endpoint                         | unset → local-only dumps                           |
| `LUX_PYTHON`                    | Override Python interpreter for voice service | auto-detect                                        |
| `LUX_OPENAI_*`                  | Used by scripts/tests for provider selection  | unset                                              |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | CI/release only: Windows signing              | unset → unsigned build                             |

## Pre-flight checklist

- [ ] Version bumped in `package.json` **and** `package-lock.json`
- [ ] `CHANGELOG.md` updated (`Unreleased` → version + date)
- [ ] `npm run css:build` produced **no diff** (or the diff is committed)
- [ ] Full battery green (`npm run verify` — test / e2e / smoke / lint / CSS drift)
- [ ] Release notes mention user-visible changes, known issues, and the unsigned-build caveat if applicable
