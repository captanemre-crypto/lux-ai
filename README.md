# ⚡ Lux AI — Agentic Desktop Application & IDE

Electron tabanlı masaüstü yapay zeka ajanı ve gömülü IDE. Koyu tema (`#070709`),
çift çerçeveli yüzen mesaj kutusu, araç adımları, gömülü terminal, Monaco tabanlı
editör ve çok motorlu ses (STT/TTS) altyapısı içerir.

**Sürüm:** 1.1.0 · **Node:** ≥ 22.12 · **Python (ses için):** 3.12 önerilir

---

## 🚀 Kurulum ve Çalıştırma

```bash
git clone <repo-url> lux-ai
cd lux-ai
npm install          # Monaco vendor kopyası da otomatik hazırlanır (postinstall)
npm start
```

Windows'ta çift tıklama: **`start_lux_ai.bat`** (bağımlılıklar eksikse otomatik kurar).

### Doğrulama

```bash
npm test              # 21 mimari test + 6 mock-fetch model istemcisi testi
npm run test:e2e      # gerçek çalışma döngüsü testi (pencere gerçekten açılır, IPC'ler çağrılır)
npm run vendor:monaco # Monaco dosyalarını elle yeniden kopyala
npm run css:build     # Tailwind v4: src/css/tailwind.input.css -> src/css/compiled_tailwind.css
npm run css:watch     # aynı çıktı, --watch modu
npm run lint          # ESLint — dar, gerçek-hata odaklı kural seti
npx prettier --check . # Format kapısı (kod tabanının tamamı 12.11.2026'da biçimlendi)
```

Test paketi şunları denetler: JS sözdizimi, marka temizliği, IPC paritesi
(invoke↔handle, on↔webContents.send), agent yetenekleri, **silme güvenlik kalkanı**,
tek örnek kilidi (+ `whenReady` koruması), izin beyaz listesi, şifreli anahtar kasası,
Monaco vendor köprüsü, terminal `runId` ayrımı, terminal çocuk süreçlerinin
`before-quit` temizliği, eklenti bağımlılık köprüsü, `resolveOllamaExecutable` PATH
kontrolü, renderer↔preload `luxAPI` eşleşmesi, **Myers diff doğruluğu** (rastgele 150
vaka eski DP LCS ile birebir aynı, test #18), **renderer bundle bütünlüğü** (ayrıştırılan
çekirdek fonksiyonların bundle'da tanımlı olması + `index.html` script sırası, test #19), **SSRF koruması +
PowerShell sanitize regresyonu** (test #20), **yüksek riskli araç onay kapısı** (test #21) ve `.gitignore` kapsamı.
`scripts/test_model_client.js` global.fetch'i stub'layarak model katmanını ağsız doğrular; `scripts/test_validate.js` ise IPC girdi doğrulama yardımcılarını birim olarak sınar.

`npm run test:e2e` ise uygulamayı **gerçekten** başlatır (izole `userData` profili
ile) ve şunları doğrular: `getAppInfo` sürümü, kalıcı state yaz/bekle/oku döngüsü,
secrets set/get/status/temizle, `terminal-execute` + `runId`, geçici git deposunda
`git-diff`, dosya yaz/oku/sil ve **HOME silme girişiminin engellenmesi**,
`voice-cancel`'ın servisi başlatmaması, `voice-status`'ün asılı kalmaması →
**0 konsol hatası**. Linux'ta `xvfb-run -a npm run test:e2e` (veya başsız ortamda
`npm run test:smoke`). CI: `.github/workflows/ci.yml` (Ubuntu xvfb ile gerçek
döngü testi + Windows).

### Ses (opsiyonel)

```bash
python -m venv .venv-voice
.venv-voice\Scripts\activate           # Windows   (Linux/macOS: source .venv-voice/bin/activate)
pip install -r scripts/requirements-voice.txt
```

Uygulama yorumlayıcıyı şu sırayla arar: `.env` içindeki `LUX_PYTHON` →
proje içi `.venv-voice` → `%LOCALAPPDATA%\Programs\Python\Python312|313` → `python3.12/python3/python`.
Hiçbiri yoksa ses özellikleri kapalı kalır, uygulama normal çalışır.

---

## 🔐 Güvenlik Modeli (v1.1'de sertleştirildi)

| Konu                                                | Davranış                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS izinleri                                         | Beyaz liste: `media`, `audioCapture`, `videoCapture`, `fullscreen`, `clipboard-read`. Geri kalanı (USB, HID, geolocation, bildirim…) **reddedilir**.                                                                                            |
| `<webview>`                                         | Kapalı (`webviewTag: false`) — kodda kullanılmıyor.                                                                                                                                                                                             |
| API anahtarları                                     | `localStorage`'a düz metin yazılmaz. Main process'te `safeStorage` (DPAPI/Keychain) veya AES-256-GCM ile `lux_secrets.json` içinde şifreli saklanır; renderer'a yalnızca `••••<son4>` maskesi gider, gerçek değer istek anında kasadan çözülür. |
| Sır dosyaları                                       | `env_secrets_protection` **varsayılan AÇIK**: `.env`, `*.pem`, `id_rsa`, `secrets.json` ajan tarafından okunamaz.                                                                                                                               |
| Dosya silme                                         | Varsayılan olarak **geri dönüşüm kutusuna** (`shell.trashItem`). Kök dizin, sistem klasörleri, ev dizini, sır dosyaları ve çalışma alanı dışındaki yollar engellenir (`assertSafeDestructiveTarget`).                                           |
| PC kontrolü / arka plan ajanı / tarayıcı otomasyonu | Varsayılan **kapalı** (opt-in).                                                                                                                                                                                                                 |
| Tek örnek                                           | `requestSingleInstanceLock` — ikinci başlatma mevcut pencereyi öne getirir.                                                                                                                                                                     |
| Kalıcılık                                           | `userData/lux_ai_state.json` (atomik yazma + debounce). `localStorage` yedek olarak kalır; anahtarlar dosyaya hiç yazılmaz.                                                                                                                     |

---

## 🎨 Arayüz

1. **Üst Pencere & Menü Çubuğu:** Windows `titleBarOverlay` (#111114), `Lux AI / Workspace / View / Window` menüleri, monogram logo, `Ctrl+P` arama, `Open IDE` ve Overview düğmeleri.
2. **Sol Kenar Çubuğu:** `+ New Conversation`, `Automations`, `Customizations`, klasör tabanlı proje ağacı, pinlenen sohbetler, `Settings`.
3. **Merkezi Sohbet & Yüzen Mesaj Kutusu:** çift çerçeveli `surface-composer`, model seçici, mod seçici (`⚡ Turbo`, `Standard`, `🧠 Deep Think`), ses/mikrofon/dosya düğmeleri, açılır-kapanır araç adımları, sesli yanıt (cümle bazlı akışkan TTS).
4. **Sağ Araç Paneli:** `Overview` (çalışma alanı özeti + Git diff incelemesi), `Files`, `Terminal` (PowerShell), `Background Tasks`. _(Eski README'de geçen "Webview / LUX Futures XL" sekmesi kodda yok — kaldırıldı.)_
5. **Gömülü IDE (`Open IDE`):** Monaco editörü `src/vendor/monaco` üzerinden yüklenir (node_modules/CDN gerekmez). Monaco bulunamazsa otomatik olarak basit metin editörüne düşer ve durum çubuğunda uyarır.

---

## 🧩 Mimari

| Dosya                                 | Görev                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.js`                             | Electron ana süreç: pencere, izinler, terminal, ses alt süreci, kalıcı state — IPC çekirdekleri `src/main/` modüllerine ayrıldı                                 |
| `src/main/secrets_vault.js`           | Şifreli anahtar kasası v2: safeStorage + AES-256-GCM yedek, v1→v2 göçü, `secrets-rotate` ile yeniden şifreleme                                                  |
| `src/main/agent_ipc.js`               | Agent IPC'leri: web/görsel arama-üretim, ekran görüntüsü, PC kontrolü                                                                                           |
| `src/main/git_ipc.js`                 | `git-diff` / `git-action` (gerçek repo + oturum anlık görüntüsü fallback'i)                                                                                     |
| `src/main/plugins_ipc.js`             | Eklenti bağımlılık denetimi/kurulumu (paket adı doğrulaması + `execFile`, kabuksuz)                                                                             |
| `src/main/edit_snapshots.js`          | Oturum içi düzenleme anlık görüntüleri + promisified `execFile` paylaşımı                                                                                       |
| `src/preload.js`                      | `contextBridge` ile dar API yüzeyi (`luxAPI.*`), abonelikten çıkılabilir dinleyiciler                                                                           |
| `src/js/store.js`                     | Durum yönetimi, kalıcı state, izin politikası, anahtar kasası entegrasyonu                                                                                      |
| `src/js/chat.js`                      | Sohbet, akışkan (SSE) yanıtlar, ajan araç döngüsü, markdown + XSS temizliği, uzun sohbet pencereleme (son 40 mesaj + “Önceki mesajları yükle”)                  |
| `src/js/tool_approval.js`             | Yüksek riskli araçlar (`run_command` / `delete_path` / salt-okunur olmayan `pc_control`) için kullanıcı onay kapısı — `auto_approve_commands=false` varsayılanı |
| `src/js/agent_context.js`             | Sistem promptu derleme: hafıza girdileri, çalışma alanı envanteri, stil kuralları, araç seçimi                                                                  |
| `src/js/i18n.js`                      | i18n iskeleti: TR varsayılan / EN anahtarları, `LuxI18n.t('key', params)`                                                                                       |
| `src/js/ideMode.js`                   | Monaco editörü, dosya ağacı, kaydetme                                                                                                                           |
| `src/js/rightPanel.js`                | Overview / Files / Terminal / Extensions sekmeleri                                                                                                              |
| `src/js/voice.js`, `voice_library.js` | Sesli mod, dikte, TTS kuyruğu, ses kütüphanesi                                                                                                                  |
| `src/js/plugin_system.js`             | `window.luxPlugins` eklenti kayıt sistemi (sidebar slotları)                                                                                                    |
| `src/logger.js`                       | Dosya döndürmeli, asenkron log (main süreç)                                                                                                                     |
| `scripts/voice_service.py`            | Stdio JSON protokolüyle STT/TTS motorları (faster-whisper, Piper, Kokoro, Edge-TTS, XTTS-v2)                                                                    |
| `scripts/agent_capabilities.js`       | Facade — dış API `scripts/agent/` altındaki modüllerden yeniden dışa aktarır                                                                                    |
| `scripts/agent/paths.js`              | Silme kalkanı (`assertSafeDestructiveTarget`), akıllı yol çözümleme                                                                                             |
| `scripts/agent/files.js`              | Dosya listeleme/arama, masaüstü projeleri                                                                                                                       |
| `scripts/agent/web.js`                | Web/hava durumu arama, sayfa getirme                                                                                                                            |
| `scripts/agent/images.js`             | Görsel arama/indirme, AI görsel üretimi, Studio HTML                                                                                                            |
| `scripts/agent/pc.js`                 | `system_info`, klasör açma, ekran görüntüsü, PC kontrolü                                                                                                        |
| `scripts/unified_diff.js`             | Myers O(ND) satır farkı (Git diff hunk'ları)                                                                                                                    |
| `src/css/tailwind.input.css`          | Tailwind v4 kaynak tema (derleme: `npm run css:build`)                                                                                                          |
| `src/js/markdown.js`                  | Ortak `escapeHtml` + `sanitizeMarkdownHtml` + `renderMarkdown`                                                                                                  |
| `src/js/audio_cache.js`               | Statik mp3'ler için AudioBuffer önbelleği (decode-once)                                                                                                         |
| `src/js/speech_text.js`               | Konuşma metni yardımcıları (TTS'e giden metin temizliği/cümle bölme)                                                                                            |
| `src/js/prompt_intents.js`            | Türkçe komut niyet ayrıştırma (klasör/dosya/sil/taşı), starter HTML üretimi                                                                                     |
| `src/js/tool_schemas.js`              | OpenAI-uyumlu araç (tool) function-calling şemaları                                                                                                             |
| `src/js/model_output_parse.js`        | Araç çağrısı JSON/XML ayrıştırma, think/lux_tool temizliği, Türkçe dil doğallaştırma                                                                            |
| `src/js/model_client.js`              | Model istemci katmanı: Gemini/Ollama/OpenAI-uyumlu/Anthropic uçları, fallback/cooldown, çevrimdışı yanıt motoru                                                 |
| `scripts/sync-monaco.js`              | `npm install` sonrası Monaco'yu `src/vendor/monaco`'ya kopyalar                                                                                                 |
| `scripts/test_lifecycle_e2e.js`       | `npm test` — 21 maddelik mimari/yaşam döngüsü test paketi                                                                                                       |
| `scripts/test_model_client.js`        | Mock-fetch birim testleri: Gemini SSE/JSON ayrıştırma, HTTP 429 sınıflandırma, anahtarsız açılışta yerel modele geçiş, ses turu politikası (6 test)             |
| `scripts/e2e_runtime.js`              | `npm run test:e2e` — gerçek çalışma döngüsü (headless)                                                                                                          |
| `scripts/smoke_harness.js`            | `npm run test:smoke` — açılış + konsol hatası duman testi                                                                                                       |

### Eklenti ekleme

```js
window.luxPlugins.register({
  id: "ornek-eklenti",
  name: "Örnek",
  slot: "sidebar", // sidebar | aux | composer
  title: "Örnek Sekme",
  contentHtml: "<div>Merhaba</div>"
});
```

---

## 🧾 Sürüm Notları — v1.1.0 (denetim düzeltmeleri)

**Kritik**

- `node_modules` ve `__pycache__` artık takip edilmiyor; `package-lock.json` yeniden üretildi (`npm ci` çalışıyor).
- Monaco `node_modules` yerine `src/vendor/monaco` üzerinden yükleniyor (postinstall ile kopyalanır) → temiz klonda ve asar paketinde IDE çalışır.
- OS izinleri beyaz listeye indirildi; `webviewTag` kapatıldı; `UNLIMITED_PERMISSIONS` yerine güvenli `DEFAULT_PERMISSIONS` (sır koruması açık).
- `sendSync` tabanlı state okuması kaldırıldı (renderer kilitlenme riski), asenkron hidrasyon eklendi.

**Yüksek**

- `requestSingleInstanceLock` gerçekten eklendi.
- Test paketi baştan yazıldı: async testler artık gerçekten bekleniyor, var olmayan özellikleri arayan ölü testler kaldırıldı → **12/12 PASS**; CI bağlandı.
- Sabit `c:\Users\SERVER\...` ve `D:\LuxAI_Models` yolları dinamik çözümleniyor.
- Kalıcılık tek kaynağa taşındı (`state-save-durable`, atomik yazma) + API anahtarları `safeStorage`/AES-256-GCM kasada.
- Ölü dosyalar silindi (`index.html`, `custom_*`, `audio_check`), `plugin_system.js` gerçekten yükleniyor, `logger.js` kullanılıyor.
- `scripts/requirements-voice.txt` + Python sürüm doğrulaması + ses isteği **iptal (cancel)** protokolü.

**Orta**

- Terminal çıktısı `runId` ile ayrıştırıldı; `onData` artık unsubscribe döndürüyor (bellek sızıntısı giderildi).
- Silme/taşıma işlemlerine güvenlik kalkanı + geri dönüşüm kutusu.
- Marka temizliği: kaynak kodda eski marka adı **0** (CSS sınıfları `lux-voice-orb-*` olarak yeniden adlandırıldı).
- `marked` tek kaynaktan (gömülü UMD) kullanılıyor; Gemini'de kapatılmış modeller sessizce değiştirilmiyor, uyarı veriliyor.
- `electron-builder` yapılandırması (`npm run dist`) ve `.env.example` eklendi.

---

## 🧾 Sürüm Notları — v1.2.0 (satır satır 2. tur + yaşam döngüsü denetimi)

**Kritik**

- Tek örnek kilidi: kaybedildiğinde `whenReady` artık pencere açmıyor (ikinci kopya sessizce kapanıyordu ama `createWindow()` çağrılabiliyordu).
- Monaco AMD yükleyici yolu hatalıydı (`../vendor/monaco/vs` → `/vendor`'e çözülüyordu); IDE editörü hiç yüklenemiyordu. Artık `vendor/monaco/vs` — E2E ile doğrulandı (`monacoVendorFetchable: true`).
- `voice-synthesize` fallback anahtar zinciri: şifreli kasa artık `lux_ai_data.json`'dan bağımsız her zaman deneniyor; dosya şekli `{state, savedAt}` (yeni) ve düz (eski) iki biçimde de doğru okunuyor; dosya dalı yanıtına `requestId` eklendi.
- `fs-delete-path` / `fs-move-path`: güvenlik kalkanı artık `options.workspaceDir`'i de dikkate alıyor (önceden farklı çalışma alanı verildiğinde kalkan yanlış köke bakıyordu).
- `resolveOllamaExecutable`: `ollama` kurulu değilse artık koşulsuz `'ollama'` dönmüyor; PATH `which`/`where` ile hızlıca çözülüyor (6+ sn boş bekleme bitti; `ollama-ensure` anında `{running:false}` dönüyor).
- `luxAPI.plugins` köprüsü (`checkDependency` / `installDependency`) main + preload'da gerçekten uygulandı (paket adı doğrulaması + `npm --no-save`, kabuksuz `execFile`); eklenti bağımlılık kurulumu artık çalışıyor.

**Yüksek**

- `terminal-execute` çocuk süreçleri artık izleniyor ve `before-quit`'te öldürülüyor; ana process kapanırken başıboş kabuk kalmıyor.
- `storage-save` atomik (`tmp + rename`) — `state-save-durable` ile aynı disk davranışı; yarıda kalmış JSON riski giderildi.
- `voice-cancel`: servis çalışmıyorsa Python sürecini **başlatmıyor**; yalnızca bekleyen callback'ler temizlenip `serviceRunning:false` dönüyor.
- `logger.flush()` senkron (`appendFileSync`) + zamanlayıcı `unref`'li + paketlenmiş asar'da `userData/logs`'a düşüyor (quit anında son loglar artık kaybolmuyor).
- `git-diff` / `git-action`: CWD çözümlemesi `process.cwd()` yerine `configuredWorkspaceDir` tabanı kullanıyor; `get-app-info` sürümü hardcoded `1.0.0` yerine `app.getVersion()`.
- `saveState()` artık localStorage'a API anahtarlarını maskeleyerek yazıyor (ham anahtar `userData`'da kalmıyordu; artık garanti) — `maskSecretsForPersist`; yüklemede durable kopyadaki boş anahtarlar yerine localStorage'daki maskeler geri konur (`id` eşlemesiyle).

**Orta / Küçük**

- İndirme yardımcılarının `URL.createObjectURL`'leri 4 sn sonra `revokeObjectURL` ile serbest bırakılıyor.
- `sandbox: true` etkinleştirildi (preload yalnızca `contextBridge`/`ipcRenderer` kullanıyor).
- Kalıcı state dosya adına ilişkin bayat yorumlar düzeltildi (`lux_ai_data.json`).
- Test paketi 12 → **17 madde**; yeni: `scripts/e2e_runtime.js` gerçek çalışma döngüsü doğrulaması (izole `userData` ile açılış → state/secrets/terminal/git/fs/voice → temiz çıkış, **0 konsol hatası**) + `scripts/smoke_harness.js` duman testi. CI'ya xvfb'li gerçek döngü testi eklendi.

---

## 🧾 Sürüm Notları — v1.3.0 (eksiklerin kapatılması)

**Performans**

- `renderChat()` artık parçalı (incremental) render yapıyor: değişmeyen mesaj satırları DOM'da aynen kalıyor; djb2 tabanlı satır imzası + `data-chat-row-id` düğüm takibi. Streaming `renderStreamingDelta` davranışı korunuyor. E2E: değişmeyen user satırı düğümü **kimlik olarak korunuyor**, yalnızca değişen assistant satırı yeniden kuruluyor.
- `buildUnifiedLineDiff` O(n·m) DP LCS matrisinden → ortak önek/sonek budama + **Myers O(ND)**; 3000 satırlık dosyada 3 değişiklik **2 ms**. Rastgele vakalarda eski algoritmayla +/− sayıları birebir eşit (150 vaka, test #18); patolojik devasa farklarda doğrusal sınırlı önizlemeye düşüyor.
- Statik 124 mp3 (ninni notaları, chime'lar) artık her çalınmada `new Audio()` ile yeniden decode edilmiyor — yeni `AudioBuffer` önbelleği (`src/js/audio_cache.js`, decode-once). Lullaby notaları çalınmadan önce arka planda preload ediliyor. E2E: ilk çalma 39 ms → ikinci çalma 0 ms, `decodeReused: true`.

**Mimari / Bakım**

- `scripts/agent_capabilities.js` (1.261 satır) → `scripts/agent/{paths,files,web,images,pc}.js` + ince facade; dış API birebir (testler ve `main.js` değişmeden).
- `escapeHtml` kopya sayısı 3 → 1 (`src/js/markdown.js`); `sanitizeMarkdownHtml`/`renderMarkdown` da ortak dosyada; `marked.umd.js`'den önce yükleniyor.
- Tailwind v4 derleme hattı: `src/css/tailwind.input.css` (tema token'ları jetbox CSS değişkenlerine `@theme inline` ile bağlı; eski derlemede Tailwind çıktısına **elle gömülmüş ~1.200 satırlık agy tema base katmanı** birebir kurtarılıp kaynağa eklendi) + `npm run css:build` / `css:watch`. `compiled_tailwind.css` 294 KB → **114 KB** (1.700+ ölü utility sınıfı elendi; eski dosyadaki tüm tema/bileşen kuralları bayt-bayt korunuyor — kural parmak izi karşılaştırmasıyla doğrulandı; duman testi aynı render çıktısını veriyor, arayüz ekran görüntüsüyle görsel doğrulama yapıldı). `chat.js` kısmen ayrıştırıldı: konuşma metni yardımcıları → `src/js/speech_text.js`, Türkçe komut niyet ayrıştırıcıları → `src/js/prompt_intents.js`, araç şemaları → `src/js/tool_schemas.js`, model çıktısı ayrıştırma → `src/js/model_output_parse.js`, LLM istemci katmanı (Gemini/Ollama/OpenAI/Anthropic) → `src/js/model_client.js` (5.354 → **3.069 satır**); markdown/kod-string kaçışları `src/js/markdown.js`'te. Eksik bir fonksiyonun (`stripMarkupForLiveStream`) ayrıştırmada düşmesi yakalanıp geri eklendi; yeni test #19 (çekirdek fonksiyon varlığı + index.html script sırası) bu sınıfı kalıcı olarak kapatıyor.
- `LICENSE` (ISC) eklendi; `build/` buildResources + `icon.png` (512×512). electron-builder `--dir` doğrulandı: paket 384 MB, asar içinde main.js/Monaco/Python servisi/yeni modüller mevcut ve **paketlenmiş uygulama xvfb altında gerçekten açılıyor** (18 sn canlı doğrulama).

**Güvenlik**

- `npm audit` → **0 vulnerability** (öncesi: 1 critical dompurify vía monaco-editor, 6 moderate minimatch vía electron-builder). Çözüm `overrides` (dompurify ^3.4.17, minimatch ^11.0.8); `npm audit fix --force` ile gelen downgrade bilinçli olarak KULLANILMADI.

---

## 🧾 Sürüm Notları — v1.4.1 (güvenlik sertleştirme, 2026-11-12)

**Güvenlik**

- **Content-Security-Policy**: sayfaya `script-src 'self'` dahil kapalı-liste CSP meta etiketi eklendi (`object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `img-src`/`frame-src` uzak içeriğe açık ama `connect-src` kullanıcı tanımlı uçlara serbest — fetch_url görselleri ve Aux Browser etkilenmez).
- **Satır içi `onclick` tamamen kaldırıldı (39 site)**: menü çubuğu + dinamik şablonlar `data-action` özniteliklerine taşındı; tek document-level delegasyon noktası `src/js/delegated_actions.js`. Chat içeriğindeki dinamik aksiyonlar (`lightbox-img`, `remove-media`, `copy-msg`…) `chat.js`'in dinleyicisinde çalışmaya devam eder.
- **`terminal-execute` sender guard**: ana süreç yalnızca ana pencerenin webContents'inden gelen terminal çağrılarını kabul eder.
- **Ana süreç hata loglama**: `uncaughtException` / `unhandledRejection` artık yerel log dosyasına stack ile düşer.

**CI/Release**

- `ci.yml`: `actions/setup-python@v5`; Python sözdizimi adımı garantili Python ile koşar.
- `release.yml`: GitHub Release'e `latest*.yml` (electron-updater manifestleri) de eklenir; artifact retention 14 gün.

**Not**: `v1.4.1`, v1.4.0'ın güvenlik tamamlama sürümüdür; ürün özelliklerinde değişiklik yoktur.

---

## 🧾 Sürüm Notları — v1.4.0 (öneriler turu — 2026-11-12)

**Güvenlik**

- **SSRF koruması**: ajanın keyfi URL erişimi (`fetch_url`, görsel indirme) artık `scripts/agent/net_guard.js` üzerinden doğrulanıyor — yalnız http/https; loopback/özel/link-local/CGNAT/multicast IP'ler ve `localhost`, `*.local`, `*.internal` gibi dahili adlar reddedilir; DNS çözümlemesiyle dahili IP'ye giden alan adları engellenir; yönlendirmeler elle izlenip her sıçramada yeniden doğrulanır. Bulut metadata ucu `169.254.169.254` kapalı.
- **PowerShell enjeksiyonu**: `pc_control(volume)` serbest metni çift tırnaklı dizgiye ham gömülüyordu (`$(…)` ile çalıştırılabilirdi) — `sanitizePsDoubleQuoted` ile ayıklandı; `send_keys`/`type_text`/`open_app` tek tırnak kaçısı + satır sonu temizliği; fare koordinatları `clampInt` ile sınırlandı.
- **Yüksek riskli araç onay kapısı**: `run_command`, `delete_path` ve salt-okunur olmayan `pc_control` (open_url/open_app/type_text/mouse_*/…), `auto_approve_commands=false` varsayılanında artık kullanıcıya onay diyaloğu gösteriyor (Esc=red, Enter=onay, 3 dk sessizlikte otomatik red; "bir daha sorma" `Ayarlar > İzinler` anahtarını açar). Önceden bu anahtar hiçbir kod yolunda okunmuyordu. `system_info`, `list_windows`, `clipboard_get` onaydan muaftır.

**Mimari**

- `main.js` 1.704 → **~1.220 satır**: IPC çekirdekleri `src/main/{secrets_vault,agent_ipc,git_ipc,plugins_ipc,edit_snapshots}.js` modüllerine ayrıldı; vault IPC'leri `createSecretsVault()` fabrikasında.
- Renderer: `src/js/tool_approval.js` + `src/js/agent_context.js` + `src/js/i18n.js` ayrıldı; `chat.js` ~2.880 satıra indi. Test #19 bundle bütünlük listesi ve `index.html` sıra kontrolü yeni modülleri kapsayacak şekilde genişletildi.
- Sistem promptundaki hardcoded `c:\Users\SERVER\Desktop\LUX_ai` yolu kaldırıldı (`luxAppInfo.currentWorkspace` zinciri).
- **Uzun sohbet pencereleme**: render yalnızca son 40 mesajı kapsar; "Önceki N mesajı yükle" düğmesiyle genişletilir (streaming davranışı değişmedi, e2e incrementalRender korundu).
- **Bağlam rollover/özetleme (`src/js/context_rollup.js`)**: modelle paylaşılan istekte eski turlar artık sessizce düşürülmüyor — deterministik, çevrimdışı özet bloğu (`[ÖNCEKİ KONUŞMANIN ÖZETİ]`) üretilip kullanıcı sorusuna eklenir; son 12 mesaj (yerel CPU'da 4) birebir korunur. Gemini / OpenAI-uyumlu / Anthropic üç yolu da kullanır; araç seçimi ve sistem promptu özgün metinle çalışır (regresyon yok). Ağ çağrısı yok, 9 birim testi (`npm run test:rollup`).

**Kalite altyapısı**

- `scripts/test_model_client.js`: global.fetch stub'u ile model katmanı ağsız test edilir (Gemini SSE/JSON ayrıştırma, 429 rate-limit → yedek yok, anahtarsız açılışta yerel modele geçiş, ses turunda yedek model yok) — **6/6 PASS**. `npm test` artık her iki paketi koşar.
- Mimari test paketi 19 → **21 madde** (#20 SSRF/PowerShell sanitize, #21 onay kapısı).
- ESLint (flat config, yalnız gerçek-hata kuralları) + `npm run lint` CI kapısı; **Prettier kod tabanının tamamına uygulandı (12.11.2026)** ve `prettier --check` CI'da zorunlu.
- CI sertleştirildi: `npm audit --audit-level=high`, `css:build` çıktısının commit'li `compiled_tailwind.css` ile aynı olduğunu doğrulayan drift bekçisi, **Windows e2e artık gerçek kapıcı** (`continue-on-error` kaldırıldı), `npm run lint` ve `prettier --check` adımları eklendi.
- Yeni `.github/workflows/release.yml`: `v*` etiketi → Windows NSIS + Linux AppImage + GitHub Release (artifact upload; imza `CSC_LINK`/`CSC_KEY_PASSWORD` secret'larıyla, yoksa imzasız üretir).
- Kapsam dışı bırakılanlar (kullanıcıya ait): gerçek Windows imza sertifikası, GitHub secret'ları ve Release onayı; NSIS bu Linux ortamında üretilemez.

**Ürün / UX**

- i18n iskeleti (`src/js/i18n.js`, TR/EN; onay diyaloğu, **kasa kartı ve ses-indirme onay bandı** da `LuxI18n`'e bağlı), streaming bölgesine `aria-live="polite"` + `aria-busy`, `prefers-reduced-motion` altında `.streaming-cursor` dâhil tüm animasyonlar kapanır (`src/css/app.css`).
- Ses: ilk STT ısıtması öncesi faster-whisper (~244 MB) indirme **onay bandı** gösterilir ("İndir ve Hazırla" / "Şimdi Değil", 45 sn sessizlikte ret — indirme başlamaz); yeni `luxAPI.voice.modelStatus` IPC'si yalnız diski okur, indirme TETİKLEMEZ.
- `crashReporter`: varsayılan yalnız yerel dump; `LUX_CRASH_URL` verilirse o uca yüklenir (mahremiyet varsayılanı: hiçbir veri makineden çıkmaz).
- **Görsel chip tasarımı**: ajanın bulduğu/ürettiği görseller ve ekran görüntüleri artık büyük kartlar yerine örneğinizdeki küçük chip boyunda (`thumbnail + dosya adı + format`); × mesajı sohbetten kaldırır, mini görsele tık lightbox açar. Ad verilmezse dosya adı kullanılır.
- **Dahili Tarayıcı — konum seçici**: IDE bölünmesindeki tarayıcı araç çubuğuna crosshair düğmesi eklendi; sayfanın üstünde (cross-origin sayfalarda bile) geçici katman açar, ESC iptal eder. Tıklanan nokta mesaj metnine **yazılmaz**; sohbet kutusunun üstünde örnek boyutunda küçük **chip** (`host · x · y · %`) belirir ve × ile kaldırılır. Gönderim anında koordinatlar modele yalnızca gizli `[KONUM REFERANSLARI]` bağlamı olarak eklenir.
- **"Geri Bildirim Gönder"** kaldırıldı (Settings düğmesi + arkasındaki modal).
- Projeler: "Yeni Proje" (+) düğmesi artık klasör seçiciyle gerçek yolunu bulur — proje adı klasör adından türetilir, `project.path`'e bağlanır (ajan bağlamı bu yolu kullanır); iptal edilirse eski yalnız-ad akışına düşer.
- Anahtar kasası **v2 şema sürümü**ne geçti (v1 ile okuma uyumlu); `secrets-rotate` IPC'si tüm kayıtları çözüp güncel şema/anahtarla yeniden yazar; herhangi bir kayıt çözülemezse kasa değiştirilmez.

**Doğrulama** (Linux, Node 20.20.2): `npm test` 21/21 + 6/6 + 10/10 + **9/9** PASS · smoke `ok:true` · xvfb e2e `ok:true` (secrets roundTrip **ve `secrets-rotate` IPC sonrası değer korunumu**, **`voice-model-status` IPC başarısı (indirme yok)**, git diff eylem beyaz listesi, terminal girdi doğrulama reddi, fs, incrementalRender, liveStreamMarkup, audioCache decode-reuse, saveStateMask leaked:false, voice) · `eslint .` temiz · `prettier --check` temiz · `css:build` yeniden üretildi (derlenmiş çıktı bu turdaki yeni `border-amber-500/40` kullanımını içerir) · `npm audit` 0 vulnerability · **paketlenmiş uygulama xvfb altında 14 sn canlı doğrulamada çalıştı** (`crashReporter hazır (yükleme: kapalı)` logu görüldü; dist/linux-unpacked) · **temiz-ağaç (git archive → /tmp → `npm ci`) doğrulaması yeşil**: dört test paketi + lint + Prettier + CSS determinizmi (kaynak↔derlenmiş bayt-bayt) + smoke/e2e aynı sonucu veriyor; bu doğrulama sırasında iki gerçek hata yakalanıp düzeltildi: `build/icon.png` (electron-builder buildResources) snapshot'larda kaybolmuştu → geri yüklendi; `modals.js` içinde kalan hardcoded `c:\Users\SERVER\Desktop\LUX_ai` çalışma dizini yedek yolu → `window.luxAppInfo.currentWorkspace` zincirine bağlandı.

**Bilinen sınırlar**: canlı LLM API çağrıları gerçek anahtarla test edilmedi; Windows kurulum/imza ve otomatik güncelleme yalnız `RELEASING.md` + `release.yml` ile hazırlandı; Windows e2e'nin CI'daki sonucu bu makinede doğrulanamaz; aksiyom: ağ gerektirmeyen her şey yerel olarak yeşil.

---

## 📄 Lisans

ISC — ayrıntılar için `LICENSE` dosyasına bakın (yoksa ekleyin).
