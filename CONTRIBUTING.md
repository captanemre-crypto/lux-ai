# Contributing to Lux AI

Thanks for helping! This document is the short path for a first PR.

## Ground rules

1. **Real, verified fixes over claims.** If you say it works, run it: `npm test`, `npm run test:e2e`, `npm run test:smoke`, `npm run lint`. Honest "not verified" notes are acceptable; silent breakage is not.
2. **`src/css/tailwind.input.css` is the source of truth** for styles. Never hand-edit `compiled_tailwind.css`; change the input and run `npm run css:build`. CI enforces they match (`git diff --exit-code`).
3. **No new dependencies without a reason.** `marked` and `monaco-editor` are the only runtime deps — keep it that way unless there is a strong case.
4. **Classic scripts, not modules (yet).** Renderer files share the global scope and must tolerate any load order after their `index.html` `<script>` tags; `scripts/test_lifecycle_e2e.js` test #19 enforces load order and bundle integrity.
5. **Security-sensitive areas** (second pair of eyes required): `scripts/agent/paths.js` (delete shield), `scripts/agent/net_guard.js` (SSRF/PowerShell), vault (`src/main/secrets_vault.js`), tool approval gate (`src/js/tool_approval.js`), IPC surface (`src/preload.js`).

## Setup

```bash
npm install            # postinstall vendors Monaco into src/vendor/monaco
npm run css:build
npm start              # xvfb-run -a npm start on headless Linux
```

## Before you open a PR

- [ ] `npm test` green (21 architecture + 6 model-client + 10 IPC-validator + 9 context-rollup tests)
- [ ] `npm run verify` green before any release (full local gate: tests, lint, prettier, CSS drift, xvfb smoke/e2e, settings audit, i18n runtime probe, visual regression TR+EN)
- [ ] `npm run test:e2e` green (isolated `userData`; attaches nothing to your real profile)
- [ ] `npm run lint` clean
- [ ] `npx prettier --check .` clean (or `npm run format` applied)
- [ ] If UI strings were touched: Turkish **and** English keys in `src/js/i18n.js`
- [ ] If you touched styles: `npm run css:build` run and the compiled output committed
- [ ] If you touched IPC: channel added/removed consistently in `scripts/*` handler → `src/preload.js` → renderer call site (test #3 enforces invoke↔handle parity)
- [ ] `CHANGELOG.md` updated under `Unreleased`

## Code style

- Prettier config included and **the whole codebase was formatted on 2026-11-12** (`npx prettier --check .` is a CI gate) — run `npm run format` before committing; avoid hand-formatting deviations.
- Renderer JS: double quotes, 2-space, semicolons. Main-process/CommonJS: single quotes.
- Turkish UI copy is intentional; keep user-facing text in Turkish unless the string goes through `LuxI18n.t`.

## Commit & releases

- Conventional-ish messages (`fix:`, `feat:`, `chore:`) are welcome but not enforced.
- Releases are tag-driven (`v*` → `.github/workflows/release.yml`). See [RELEASING.md](RELEASING.md). Do not commit to `main` without running the full battery.
