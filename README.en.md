# Lux AI — Agentic Desktop Application (English overview)

> Türkçe belgeler için: [README.md](README.md). Katkı: [CONTRIBUTING.md](CONTRIBUTING.md). Güvenlik bildirimi: [SECURITY.md](SECURITY.md). Yayın süreci: [RELEASING.md](RELEASING.md).

Lux AI is an agentic desktop assistant (Electron) that can actually act on your machine — not just chat. It searches the live web, finds and generates images, creates and edits files/projects, runs terminal commands and controls the PC — always behind explicit, visible permission gates. Turkish-first UI and agent, with an i18n skeleton (EN keys included).

## Highlights

- **Agent with real tools**: web search/fetch, image search & AI generation, file/folder CRUD on Desktop & workspace, PowerShell terminal, screen capture, PC control — each tool's permission is toggled in Settings → Permissions.
- **High-risk actions need your click**: `run_command`, `delete_path` and non-read-only `pc_control` show an in-app approval dialog while `auto_approve_commands` is off (default).
- **Voice-first**: dictation, voice mode, TTS with local engines (Piper, Kokoro), offline Whisper STT — models download only with your consent (~244 MB once).
- **Key vault**: API keys are stored encrypted (Electron safeStorage or AES-256-GCM fallback), never in localStorage/plaintext; vault schema v2 with rotation.
- **Model freedom**: Google Gemini, OpenAI-compatible (incl. local LM Studio / Ollama / 9Router), Anthropic, OpenRouter — with automatic fallback to a local model when cloud is unreachable (never in voice turns, never on 401/403/429).
- **Hardened**: SSRF guard for agent network access, PowerShell injection sanitization, IPC parity tests, encrypted vault, single-instance lock, fs-destructive-target shield, zero npm audit vulnerabilities.

## Requirements

- Windows 10/11 (primary target) or Linux; Node.js **≥ 22.12** (CI and Electron 45's embedded Node align on 22), Python 3.12 for the voice service.
- `npm ci` → Monaco vendored automatically (`postinstall`) → `npm start`.

## Development quickstart

```bash
npm install
npm run vendor:monaco   # if needed
npm run css:build       # src/css/tailwind.input.css -> compiled_tailwind.css (commit both)
npm start
```

### Verification (all local, no network needed)

```bash
npm test                # 21 architecture + 6 model-client + 10 IPC-validator + 9 context-rollup tests
npm run test:e2e        # real boot cycle (auto xvfb on Linux): IPC, vault, terminal, git, fs, voice
npm run test:smoke      # boot + console errors
npm run lint            # ESLint (sharp, bug-focused rule set)
```

## Architecture (map)

- `main.js` — window, permissions, terminal, voice subprocess, state bridge; IPC cores live in `src/main/*.js` (`secrets_vault`, `agent_ipc`, `git_ipc`, `plugins_ipc`, `edit_snapshots`).
- `src/preload.js` — `contextBridge` surface (`luxAPI.*`), minimal and typed.
- `src/js/*` — renderer: `chat.js` (orchestration), `model_client.js`, `model_output_parse.js`, `agent_context.js` (system prompt), `tool_schemas.js`, `store.js` (state), `voice.js`, `tool_approval.js`, `i18n.js`, … Loaded as classic scripts in `index.html` order (tests enforce the order).
- `scripts/agent/*.js` — main-process agent capabilities (web, images, pc, files, paths) + `net_guard.js` (SSRF/PowerShell hardening).
- `scripts/voice_service.py` — stdio-JSON Python service for STT/TTS.

## Testing philosophy

Every fix ships with a failing-first test where practical; tests run on real files, not mocks of our own code. Network-adjacent layers are tested with stubbed `fetch` (see `scripts/test_model_client.js`). E2E uses an isolated `userData` profile — your real data is never touched.

## License

ISC — see [LICENSE](LICENSE).
