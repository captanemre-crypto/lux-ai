# Security Policy

## Supported versions

| Version | Supported             |
| ------- | --------------------- |
| 1.4.x   | ✅ (current)          |
| < 1.4   | ❌ — upgrade to 1.4.x |

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting ("Security → Report a vulnerability") on the repository, or contact the maintainers through the same channel the application was distributed to you. Include:

- affected version/commit and OS,
- minimal reproduction (a tool call, IPC payload, or config that triggers it),
- impact assessment (what an attacker gains).

We aim to acknowledge within **72 hours** and to ship or schedule a fix within **14 days** for critical issues (RCE, vault/secret disclosure, sandbox escape). You will be credited in the release notes unless you prefer otherwise.

## Threat model (what this app is)

Lux AI is an **agentic** desktop app: with your permission it can run shell commands, write/delete files and control the PC. Design consequences:

- **Permission gates** are the security boundary. `auto_approve_commands` (default **off**) requires an explicit user click before `run_command`, `delete_path` and non-read-only `pc_control` execute. Do not enable it unless you fully trust the model, prompt and plugins in use.
- **Vault**: API keys live in `lux_secrets.json` under the user profile, encrypted via OS keychain (safeStorage) or AES-256-GCM fallback. Vault schema v2 supports rotation (`secrets-rotate`). Keys never touch localStorage or chat logs.
- **Agent network access is SSRF-guarded** (`scripts/agent/net_guard.js`): http/https only; loopback/private/link-local/CGNAT/multicast and internal hostnames are refused; redirects are re-validated per hop; DNS answers are checked before connect.
- **PowerShell strings** built from model/tool input are sanitized for single/double-quoted contexts.
- **Renderer** is `contextIsolation: true`, `nodeIntegration: false`, navigation locked to the packaged origin; IPC surface is intentionally minimal (`src/preload.js`).
- **Backups** (`.luxbackup`, Settings → Application) never contain API keys (state is secrets-stripped at rest). Optional user password encrypts with scrypt + AES-256-GCM; without a password the file is plain JSON — treat it as private.
- **Updates** (`electron-updater`) download from the GitHub Release feed referenced by `build.publish`; the update banner installs on restart. The updater channel integrity relies on GitHub's release assets + (optionally) code signing.
- **Plugins** (`plugin_system.js`) render their HTML in a **sandboxed** Aux Browser iframe (`sandbox="allow-scripts"`, no `allow-same-origin`) — plugin markup/scripts cannot reach the app DOM or `luxAPI`.
- **CSP**: the renderer page embeds a Content-Security-Policy meta (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`); inline event handlers are eliminated app-wide via delegated actions (`src/js/delegated_actions.js`).
- **Crash reports** are **local only** by default. Setting `LUX_CRASH_URL` is explicit opt-in for upload; no content (prompts, messages, keys) is ever included.

## Data & privacy (what leaves your machine by default)

Nothing leaves your machine unless you explicitly configure it:

| Data                                       | Leaves the machine?                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Chat / prompts sent to your model provider | Yes — that is the point of a model call; only to the endpoint you configure                                                      |
| API keys (vault)                           | No — stored OS-keychain / AES-256-GCM encrypted; sent only to that endpoint per request                                          |
| Crash reports                              | No by default; only local dumps unless `LUX_CRASH_URL` is set (then: native dump + platform metadata, no content)                |
| Voice / microphone audio                   | No — STT runs locally (voice service); no audio is uploaded anywhere                                                             |
| Telemetry / analytics                      | None — the app ships no analytics SDK and sends no usage data                                                                    |
| Web pages the agent reads                  | Yes, over plain HTTPS — that is the agent browsing; contents go to the model as context, subject to your model provider's policy |

If you use a hosted model endpoint, your prompts and any context the agent
attaches are processed by that provider under its terms. To keep everything
on-device, point `LUX_MODELS_DIR`/model endpoints at Ollama or another local
server — all inference then stays local.

## Out of scope

- Content of model responses (hallucinations, bad advice) — report as bugs, not vulnerabilities.
- Social engineering: the model can be prompt-injected by web pages it reads; the approval gates are the intended mitigation for destructive effects. If you find a bypass of the approval gate or the delete shield, that **is** in scope and we will treat it as critical.
