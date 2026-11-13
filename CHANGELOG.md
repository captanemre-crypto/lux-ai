# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/) principles, dates ISO-8601.

## [Unreleased]

### Added

- **Renderer sessiz `catch {}` triajı**: `src/js/debug_log.js` (ilk yüklenen script) — `window.luxDebug(scope, err)` LUX_DEBUG=1 veya `localStorage lux-debug=1` kapısından geçen tek günlük kanalı. Renderer'daki 98 bilinçli-sessiz yakalama bloğu artık bu kapıdan geçiyor (kapalıyken maliyeti bir boolean); vendored dosyalar (marked, worklet, i18n map) kapsam dışında.
- **`npm run verify` 6/6 → 9/9**: `scripts/verify_release.js` artık 7) settings audit (76 kontrol), 8) i18n runtime probe ve 9) visual regression (`--all`: TR + EN) adımlarını da koşuyor; `test:visual:en` / `test:visual:all` betikleri eklendi.
- **EN görsel regresyon baseline'ları** (`tests/visual/baselines/en/`): `visual_regression.js` artık `--en` / `--all`; EN pasosu `localStorage.clear()` + `luxAPI.storage.wipe()` (çift katmanlı, debounce artıklarını da temizler) ardından native `webContents.reload()` ile önyükleme yolunu EN locale ile derler — `tests/visual/baselines/en/` 5 kare (main-empty, chat-media-chips, settings-application, settings-data-logs, tool-approval-dialog).
- **Açılışta `document.documentElement.lang` locale'e göre ayarlanıyor** (i18n.js; önceden yalnızca `setLocale()` yazıyordu).

### Changed

- **Otomasyon zamanlayıcısı (`src/js/automation_scheduler.js`)**: Ayarlar → Otomasyonlar'da kaydedilen görevler artık gerçekten çalışıyor. 30 saniyede bir denetleyen aralık `Her Saat` / `Her N dakika|saat|gün` / `Her Gün SS:DD` (TR/EN, büyük/küçük harf duyarsız) kalıplarını ayrıştırır; zamanı gelen etkin otomasyonun `desc`i (yoksa adı) sohbete kullanıcı mesajı olarak gönderilir — böylece model, araçlar ve izinler/onay akışı aynen geçerli kalır. `runNow` (yeni “Şimdi çalıştır” butonu) son çalışma damgasına dokunmaz; yeni kayıtlar `createdAt` ile damgalanır (geçmişe dönük ateşleme yok); uygulama kapalıyken kaçırılan tetiklemeler açılışta bir kez çalışır; çalışınca mevcut `triggerSystemNotification` (kullanıcının bildirim ayarına saygılı) tetiklenir ve açık ayarlar sekmesi damgaları tazeler. Anlaşılamayan zamanlama metinleri manuel sayılır ve satırda uyarılır.
- **Arka plan görevleri paneli dürüstleştirildi**: görev yokken `|| 1` kalıntısı rozeti, iptal butonu, “Tümünü gör” ve “Görev yok” yerine duran sahte görev adı gösterilmiyor (rightPanel.js + ideMode.js).
- **Özelleştirmeler sekmesi sahte değerleri temizlendi**: “.rules” durumu çalışma alanında `.rules` gerçekten var mı diye okunarak “Aktif (.rules bulundu) / .rules yok” rozeti gösterir; “7 Beceri Yüklü” → “Yerleşik”; “Eklenti Pazarı” çekmecesi hardcoded 4 “Aktif” modül yerine gerçek `luxPlugins.list()` kaydını (yoksa “Yüklü eklenti bulunmuyor”) gösterir.

### Fixed

- **Electron deprecation uyarıları**: test betiklerinde (`e2e_runtime`, `i18n_runtime_probe`, `settings_audit_e2e`, `smoke_harness`, `visual_regression`) `console-message` imzası yeni `Event<WebContentsConsoleMessageEventParams>` biçimine taşındı (`level >= 3` → `level === 'error'`); `safeStorage.isEncryptionAvailable()` (deprecated sync) `isAsyncEncryptionAvailable()`'a taşındı — `src/main/secrets_vault.js` async memoize edildi (secrets-set/get/status/rotate) ve `voice-synthesize` kasa anahtarını `new Promise` executor'ı senkron olduğundan handler girişinde önceden çözüyor.
- Bilinmeyen ayarlar sekmesi yer tutucusu (“Bu bölümün ayarları ayrı olarak tasarlanacaktır”) nötr bir mesaja çevrildi (“Bu bölüm şu anda kullanılamıyor”).
- i18n exact haritasına “Görev yok” / “Çalışan görev” eklendi (`residualTurkish` boş kalır).

## [1.6.0] — 2026-11-13

### Added

- **Ayarlar denetimi (`npm run test:settings`)**: `scripts/settings_audit_e2e.js` — 12 çekirdek sekmenin gerçek render'u doğrulanır; tüm toggle'lar (Auto-Heal, donanım ivmesi, DevTools, bildirimler), izin anahtarları (pc_control dahil), accent swatch'lar ve ses slider'ının store'a yansıması roundtrip ile test edilir; "Tümünü Etkinleştir / Varsayılana Sıfırla"; otomasyon ekle → aç/kapa → sil döngüsü; `lux_ai_data.json` (atomik yazma, 400 ms debounce) + localStorage + reload sonrası kalıcılık; vault status IPC; modeller kartı render'ı; kritik buton varlığı. **76/76 kontrol geçiyor.**
- **i18n TR/EN — çalışma zamanı artık taraması**: Ayarların tüm sekmeleri EN yerelinde gezilip 2500 ms settle sonrası **0 Türkçe artık** olduğu kanıtlandı (`scripts/i18n_runtime_probe.js`; `npm run test:i18n:runtime`). Harita exact 577 / substr 161 (parts 1–9).
- **Locale-aware sistem promptları**: EN yerelinde model persona'sı, stil uyarıları, hafıza/çalışma-alanı bağlam satırları, araç-seçimi ve token-bütçesi regex'leri EN varyantlara kavuştu; model istemcisi hata kartları, adım etiketleri, post-tool yönlendirmeleri, tone-calibration çifti ve offline doğal-yanıt motoru EN'de doğal İngilizce üretiyor; başlangıç sitesi iskelesi (prompt_intents) EN şablon basıyor. EN kullanıcı artık Türkçe sistem talimatı/yanıt görmüyor.

### Changed

- **`chat.js` modüler ayrıştırma**: 2359 → 717 satır; `chat_shared.js` (35), `chat_render.js` (714), `chat_tools.js` (1252), `chat_voice.js` (374). Davranış bire bir korundu; e2e 21/21.
- **Ana süreç sessiz `catch {}` triajı**: ~40 boş yakalama bloğuna `logger.debug` (LUX_DEBUG=1 kapılı) eklendi; `src/logger.js`'e debug seviyesi eklendi; akış ve dönüş değerleri değişmedi.
- `selectToolsForPrompt` İngilizce anahtar kelimeleri de tanıyor (EN istemlerde yerel CPU'da araçsız kalma hatası giderildi); `shouldAttachToolsForPrompt` EN küçük-sohbet istisnası aldı.

### Fixed

- **Bildirimler ayarı ölüydü**: ana süreç izin beyaz listesi `notifications` iznini reddediyordu → renderer `new Notification()` hiç izne kavuşamıyor, `Notification.permission` kalıcı `denied` kalıyor ve "Bildirimler" anahtarı sessizce hiçbir şey yapmıyordu. Beyaz listeye `notifications` eklendi; denetim artık `Notification.permission !== 'denied'` olduğunu doğruluyor.

### Verified

- `npm run verify` **6/6 yeşil** (test, lint, prettier, CSS drift, smoke, e2e). Görsel regresyon TR baseline'larında yeşil; i18n runtime probe 0 artık; settings audit 76/76.
- IPC paritesi (preload ↔ main): 54/54 invoke kanalı handler'lı; ayarlar `getElementById` referansları statik taramada temiz.

## [1.5.0] — 2026-11-12

### Added

- **Uygulama içi otomatik güncelleme**: `electron-updater` bağımlılığı + ana süreç kablolaması (açılışta sessiz denetim, yalnız üretim paketinde); sağ-alt köşede TR/EN bildirim bandı (`update-available` → indirme → "Yeniden Başlat ve Yükle"); Settings → Uygulama → Güncelleme → "Güncellemeleri Denetle" manuel denetim. `release.yml` artifact'lerine `latest*.yml` eklendi (updater kanal manifestleri).
- **Veri yedekleme** (`Ayarlar → Uygulama → Veri & Yedek`): sohbetler/ayarlar/workspace haritası `.luxbackup` dosyasına aktarılır; API anahtarları yedeğe dahil değildir (sırlar yazılmaz). Opsiyonel parola → scrypt + AES-256-GCM. İçe aktarmada otomatik `.bak` kopyası alınır, doğrulanır ve uygulama yeniden yüklenir.
- **Canlı günlük görüntüleyici** (`Ayarlar → Uygulama → Günlükler`): son 64 KB görüntülenir; Yenile / Kopyala / Klasörü Aç / Temizle. Yeni `logs-read` / `logs-clear` / `logs-open-folder` IPC'leri (yalnız ana pencere göndericisi).
- **Görsel regresyon kapısı**: `scripts/visual_regression.js` — uygulamayı gerçekten açar (xvfb), 5 deterministik kare yakalar (`main-empty`, `chat-media-chips`, `settings-application`, `settings-data-logs`, `tool-approval-dialog`), `tests/visual/baselines/` ile piksel düzeyinde karşılaştırır (eşik %1.0). `npm run test:visual`; Linux dışında rapor-only.
- **i18n anahtar kapsamı testi**: `scripts/test_i18n.js` — TR/EN parity + kodda geçen bilinen-önek her anahtarın sözlükte varlığı; `npm test` zincirine eklendi.
- **Dokümantasyon**: her iki README'ye gerçek ekran görüntüleri (`docs/screenshots/*.png`); `RELEASING.md` "Auto-update (wired)" bölümü; `SECURITY.md` şema/sınır listesine yedek/updater/plugin-sandbox/CSP notları.

### Changed

- **Eklenti (plugin) yolu sandbox'landı**: `plugin_system.js` blob: belgeleri artık Aux Browser iframe'inde `sandbox="allow-scripts"` (same-origin yok) açılır — eklenti HTML/JS'i üst pencereye/`luxAPI`'ye ulaşamıyor. Normal Aux Browser gezinmesi değişmedi.
- **`chat.js` → `agent_workspace.js` ayrıştırması**: masaüstü proje önbelleği, çalışma-ağacı analizi ve turn-bağlamı kancaları (~222 satır) ayrı dosyaya taşındı; `index.html` sırası ve bundle bütünlük testi güncellendi.
- Yeni `data-logs` IPC'leri ve `update-status` kanalı `preload.js` üzerinden `luxAPI.logs|updates|backup` olarak açıldı.

### Verified

- Ses servisi bu turda CANLI denenebildi: `faster-whisper base` ile TR STT'nin ürettiği metnin kaynak metnin birebir aynısı çıktığı (`Bugün hava parçalı bulutlu olacak.` → aynı metin), `edge-tts` ile sentezin geçerli MP3 ürettiği (`Fola`) ve `status` CLI'ın doğru raporladığı görüldü. (Geçici test venv'i repodan silindi.)
- Görsel regresyon: baseline üretimi sonrası ardışık koşumda tüm kareler ~%0.00 fark; eşik `VISUAL_MAX_DIFF=0` altında kapanın gerçekten kırdığı doğrulandı (exit 1).
- `npm run verify` bu değişiklik setiyle **6/6 yeşil** (46 test + i18n testi = 7 paket, lint, prettier, CSS drift, xvfb smoke, e2e).

## [1.4.1] — 2026-11-12

### Security

- **Content-Security-Policy eklendi**: sayfaya `<meta http-equiv>` ile gömülü CSP — `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `default-src 'self'`; `style-src 'self' 'unsafe-inline'` (render edilmiş satır içi stiller zorunlu), `img-src 'self' data: file: https: http:` (ajan görsel arama sonuçları + Aux Browser ile uyumlu), `connect-src 'self' https: http: ws: wss:` (kullanıcı tanımlı OpenAI-uyumlu uçlar serbest), `frame-src 'self' blob: https: http:` (eklenti blob: belgeleri + Aux Browser).
- **Satır içi `onclick` temizliği (39 site)**: tüm menü çubuğu ve dinamik şablon aksiyonları `data-action` özniteliklerine taşındı; yeni `src/js/delegated_actions.js` içindeki tek document-level delegasyona bağlandı. Chat içeriğine gömülü dinamik aksiyonlar (`lightbox-img`, `remove-media`, `copy-msg` vb.) `chat.js`'in kendi dinleyicisinde kalır; delegasyon bilinmeyen aksiyonlarda sessiz geçer.
- **`terminal-execute` sender guard**: ana süreç, yalnızca ana pencerenin `webContents`'inden gelen çağrıları kabul eder; harici göndericiler `success:false` alır.
- **Ana süreç hata loglama**: `uncaughtException` ve `unhandledRejection` artık `logger`'a stack ile düşer (önceden sessiz sonlanma riski vardı); `crashReporter` davranışı değişmedi.

### CI/Release

- `ci.yml`: `actions/setup-python@v5` eklendi; Python sözdizimi adımı artık garantili Python altında koşar.
- `release.yml`: artifact'lere `dist/latest*.yml` (electron-updater kanal manifestleri) eklendi; artifact retention 14 güne sabitlendi.

### Docs

- `README.en.md`: v1.4.0 özellikleri İngilizceye çevrildi; v1.4.1 güvenlik/CI notları eklendi.

## [1.4.0] — 2026-11-12

> Release verified on a **clean tree built from the git index** (`git archive` → `npm ci` → full battery + xvfb smoke/e2e), not only on the working copy.

### Security

- SSRF guard for all agent-driven URL fetches (`scripts/agent/net_guard.js`): http/https only, private/loopback/link-local/CGNAT/multicast IPs and internal hostnames refused, per-hop redirect re-validation, DNS answer checks.
- PowerShell injection fixed: `pc_control(volume)` free text no longer interpolated into double-quoted scripts; `send_keys`/`type_text`/`open_app` sanitized; mouse coordinates clamped (`clampInt`).
- High-risk tool approval gate: `run_command`, `delete_path`, non-read-only `pc_control` now require an in-app confirmation while `auto_approve_commands` is off (default). Read-only `pc_control` actions (`system_info`, `list_windows`, `clipboard_get`) exempt.
- Vault schema v2 with in-place v1→v2 reads and `secrets-rotate` IPC (re-encrypt all records; aborts without modifying the vault if any record fails to decrypt).

### Changed (architecture)

- `main.js` split into `src/main/{secrets_vault,agent_ipc,git_ipc,plugins_ipc,edit_snapshots}.js` (~1.7k → ~1.2k lines).
- New renderer modules `src/js/tool_approval.js`, `src/js/agent_context.js`, `src/js/i18n.js`.
- Conversation rendering is windowed: last 40 messages + "load earlier" expansion (streaming unchanged).
- First STT warmup now asks before downloading faster-whisper (~244 MB, once) — quiet pre-warm removed.

### Added

- Agent-found/generated images and screenshots now render as **compact chips** (~37 px, thumbnail + filename + format) instead of large 220 px grid cards; clicking the thumbnail opens the lightbox, the × button removes the image from the message (persisted via `saveState`), and the display name falls back to the file name when the model provides no title.
- Dahili Tarayıcı (IDE split) gained a **coordinate picker**: crosshair toolbar button overlays the page (works on cross-origin pages too, since the overlay sits above the iframe), ESC cancels. Picking a point adds a compact attachment **chip** to the composer — thumbnail-sized `host · x · y · %` pill like the reference design — with × to remove. The coordinates are **never written into the message text**; on send they are injected into the model prompt as a hidden `[KONUM REFERANSLARI]` block (`window.consumePendingLocationPrompt`). Sending with only a location pending uses the fixed minimal text "İşaretlediğim konuma bak.". e2e gained a true end-to-end probe: overlay shown/ESC-cancel/click → chip added/textarea kept clean/suffix consumed/chip removed/tray hidden.
- Sidebar "Yeni Proje" button now opens the native folder picker to find the project's real path: on pick, the project name is derived from the folder basename and stored in `project.path` (consumed by `chat.js` agent context resolution and the project "Open Explorer" action). Cancelling the picker (or running without `luxAPI.pickFolder`) falls back to the previous name-only inline flow; the inline box also gained a bind-folder button and a hint row showing the selected path.
- Windows installer icon is now a real multi-layer `.ico` (`build/icon.ico`, 16–256 px, 32-bpp RGBA) built from the 512 px brand artwork; `build.win.icon` points at it, so the NSIS installer ships crisp 16–256 px icons instead of relying on conversion of a single 512 px PNG.
- `npm run test:live` (`scripts/test_live_api.js`): manual smoke test against the real Gemini / OpenAI-compatible / Anthropic endpoints using `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OPENAI_API_KEY` (override `LUX_OPENAI_BASE`/`LUX_OPENAI_MODEL`) and `ANTHROPIC_API_KEY` (override `LUX_ANTHROPIC_MODEL`). Keys are only read from the environment, never stored or logged. Exits 0 with a skip notice when no keys are configured; **not** part of `npm test` or CI.
- `npm run verify` (`scripts/verify_release.js`): single-command local release gate — test + lint + prettier + CSS-drift check + xvfb smoke + xvfb e2e, with a pass/fail summary and non-zero exit on any failure.
- `SECURITY.md` now documents supported 1.4.x and a data-privacy matrix (what leaves the machine by default: nothing except explicitly configured model endpoints, opt-in `LUX_CRASH_URL` crash uploads, and agent-browsed web pages).
- `scripts/test_model_client.js`: mock-fetch tests for Gemini SSE/JSON parsing, 429 classification, missing-key local fallback, voice-turn no-fallback (6 tests).
- `src/js/context_rollup.js`: **context rollover/summarization** — older turns that used to be silently dropped from the wire are now folded into a deterministic, offline digest (`[ÖNCEKİ KONUŞMANIN ÖZETİ]`) prepended to the user turn; last 12 messages (4 on local CPU) always kept verbatim; system prompt & tool selection keep the original prompt (no behavior change there). 9 unit tests (`scripts/test_context_rollup.js`, `npm run test:rollup`); `npm test` runs all four suites.
- Key vault UI (Settings → Permissions → "Anahtar Kasası (Şifreli)"): schema version, entry count, encryption scheme, created/rotated timestamps, record ids (never plaintext keys); "Kasayı Yeniden Şifrele" re-encrypts via `secrets-rotate` IPC.
- i18n keys for the vault card and the STT-download consent band (TR/EN).
- Test suite 19 → 21 (`#20` SSRF/PowerShell sanitize, `#21` tool approval gate); plus model-client (6), IPC validators (10) and context-rollup (9) unit tests.
- ESLint flat config + `npm run lint` (CI gate); Prettier config (opt-in for new files).
- `.github/workflows/release.yml`: tag `v*` → Windows NSIS + Linux AppImage + GitHub Release (signing via `CSC_LINK`/`CSC_KEY_PASSWORD` when present).
- i18n skeleton (TR default, EN keys) wired into the approval dialog.
- `aria-live`/`aria-busy` on streaming output; `prefers-reduced-motion` honored (streaming cursor included).
- `crashReporter` starts at boot — local dumps only unless `LUX_CRASH_URL` is set.
- Docs: `README.en.md`, `CONTRIBUTING.md`, `SECURITY.md`, `RELEASING.md`.

### Removed

- Settings → sidebar **"Geri Bildirim Gönder"** button and the feedback modal behind it (`window.giveFeedback`) — removed entirely, including its Escape handling; no remaining references.

### Fixed

- Hardcoded `c:\Users\SERVER\Desktop\LUX_ai` fallback removed from system-prompt assembly (now uses `luxAppInfo`).
- Hardcoded `c:\Users\SERVER\Desktop\LUX_ai` fallback in Settings → Application ("Varsayılan Çalışma Dizini" placeholder) — now resolves via `window.luxAppInfo.currentWorkspace`.
- `build/icon.png` restored (electron-builder `buildResources`); lost copies caused silent default-icon packaging.
- CI: `npm audit --audit-level=high` gate, compiled-CSS drift check, Windows e2e is now a real gate (`continue-on-error` removed), `npm run lint` step.
- Renderer global `stripMarkupForLiveStream` permanently guarded by bundle-integrity test #19 + e2e probe.

## [1.3.0] — 2026-11-12

- Performance: incremental `renderChat` (djb2 row signatures), Myers O(ND) line diff, `AudioBuffer` decode-once for static mp3s.
- Architecture: `scripts/agent_capabilities.js` split into `scripts/agent/*.js`; renderer cores split out of `chat.js` (5,354 → ~3,069 lines): `speech_text`, `prompt_intents`, `tool_schemas`, `model_output_parse`, `model_client`, `markdown`.
- Tailwind v4 build pipeline (`tailwind.input.css` → `compiled_tailwind.css`, 294 KB → 114 KB); theme base layer rescued from the compiled artifact into source.
- Security: npm audit 8 → 0 (overrides); `build/` resources fixed (`build/*` + `!build/icon.png`).
- Verification: `npm test`, xvfb e2e (isolated profile), smoke harness. `electron-builder --dir` verified (384 MB, app boots headless).

## [1.2.0] — earlier

- Second-pass fixes + lifecycle e2e rewrite (async tests actually awaited). See README.md "Sürüm Notları".

## [1.1.0] — earlier

- Initial hardening pass (node_modules untracked, Monaco vendored, test suite, CI). See README.md "Sürüm Notları".
