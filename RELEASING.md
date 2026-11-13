# Releasing Lux AI

Releases are **tag-driven**. The maintainer cuts a tag; CI builds Windows + Linux artifacts and attaches them to a GitHub Release. Nothing is published without that step.

## TL;DR

```bash
# 1) bump version in package.json (+ package-lock.json), update CHANGELOG.md
npm version 1.4.0 --no-git-tag-version   # or edit by hand
# 2) full local battery MUST be green (single command)
npm run verify   # = test + lint + prettier + CSS drift + smoke + e2e + settings audit + i18n probe + visual (TR/EN)
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

## Auto-update (wired since v1.5.0)

`package.json` → `build.publish` is set to GitHub (`captanemre-crypto/lux-ai`) and `electron-updater` ships as a runtime dependency. In a **production build** (`app.isPackaged === true`) the app silently checks the GitHub Releases feed at startup:

- `update-available` → background download starts (`autoDownload: true`, `autoInstallOnAppQuit: true`),
- a small **update banner** appears bottom-right ("Lux vX.Y.Z mevcut…"),
- when the download finishes, the banner switches to **"Yeniden Başlat ve Yükle"** (`update-quit-and-install` → `autoUpdater.quitAndInstall(false, true)`),
- manual check anytime: **Settings → Uygulama → Güncelleme → Güncellemeleri Denetle**,
- development builds (`app.isPackaged === false`) never touch the network and the banner never appears,
- `release.yml` attaches `latest*.yml` (updater manifests) to the GitHub Release — that is what this runtime reads. Do not delete those assets from a release.

Note: updater behavior on an unsigned build is OS-dependent (macOS refuses unsigned/notarized update installation; Windows NSIS works, SmartScreen may still warn). This environment cannot produce the signed installer — the full chain is only proven on the maintainer's machine/CI.

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
- [ ] Full battery green (`npm run verify` — test / lint / prettier / CSS drift / e2e / smoke / settings audit / i18n probe / visual TR+EN)
- [ ] Release notes mention user-visible changes, known issues, and the unsigned-build caveat if applicable
