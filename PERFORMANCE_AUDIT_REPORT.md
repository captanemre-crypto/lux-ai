# Performans Denetim Raporu — `LUX_ai`

**Tarih:** 11 Kasım 2026  
**Proje:** `LUX_ai` (`c:\Users\SERVER\Desktop\LUX_ai`)  
**Toplam Puan:** **24/100** (Kritik Mimari / Model / Streaming Darboğazı — `0–39` bandı)

---

## Türkçe Özet

- **Teşhis (24/100):** `LUX_ai` yanıt başına on saniyeler hatta dakikalar bekliyor çünkü uçtan uca streaming yok; ses turu **7 sıralı engele (cascade)** bölünmüş ve varsayılan model ile canlı profil ya **GPU hızlandırmasız 4 çekirdekli Xeon CPU** üzerinde (2.88 tok/sn) ya da kota/kuyruk riski yüksek ücretsiz **550B reasoning (`:free`)** modelde çalışıyor.
- **En büyük darboğaz:** Sıfır LLM/STT streaming + local CPU inference (`qwen2.5:7b` araçlı tek tur **38,002 ms**, soğuk açılış **93,924 ms**) + konuşma bittikten sonra başlayan **1,550 ms VAD sessizlik beklemesi** ve tam cevap bitmeden TTS'e geçemeyen bloklayıcı `fetch`/IPC/dosya diski zinciri.
- **En hızlı kazanım (P0, ~%65–80 düşüş):** Canlı profilde `nvidia/nemotron-3-ultra-550b-a55b:free` ve OOTB `qwen2.5:7b` yerine düşük gecikmeli **Flash (Low / `thinking: 0`)** + gerçek **SSE token streaming** (`stream: true` / `:streamGenerateContent`) + ilk cümle tamamlandığı anda **cümle bazlı paralel TTS** başlatmak ve VAD sessizlik eşiğini **1,550 ms → 450–550 ms** bandına çekmek.
- **Tahmini iyileşme:** Ölçülen `~9.4s – 98s+` arası uçtan uca ilk ses gecikmesini, streaming Flash LLM + paralel TTS + kısaltılmış VAD ile **`~1.1s – 1.8s`**, WebSocket tabanlı **Native Audio (Gemini Live API)** geçişiyle Antigravity hedefi olan **`< 1.5s`** altına indirmek mümkündür.
- **Sonraki adım:** İlk faz yalnızca teşhis ve ölçüm raporudur; hiçbir kaynak kod dosyası değiştirilmedi. Düzeltmeleri başlatmak için **`"Şimdi düzelt"`** komutunu vermen yeterli.

---

## 1. Executive Summary

`LUX_ai` scores **24/100** because every turn executes a **blocking, zero-streaming 7-hop cascade** (main-thread VAD `1,550 ms` idle wait -> WAV/Base64/IPC/disk -> Python STT -> double FS project pre-scan -> non-streaming LLM + sequential ReAct tool calls + post-LLM recovery -> Python TTS + temp-file/Base64 IPC -> `<audio>` + `300 ms` tail) rather than a persistent streaming or native audio session. **Biggest bottleneck:** complete lack of LLM/STT token streaming paired with either **Intel Xeon CPU-only Ollama (`qwen2.5:7b`: `38,002 ms` warm with tools, `93,924 ms` cold at `2.88 tok/s`)** out-of-the-box or a **contended 550B reasoning `:free` tier (`nvidia/nemotron-3-ultra-550b-a55b:free`)** in the live user profile. Additionally, STT adds `1,505 ms` (`google-cloud`) to `11,024 ms` (Turkish `moonshine-base` fallback to `faster-whisper-small`) plus a **`17,942 ms` warmup bug** when voice is `"Fola"`. **Fastest win (P0):** enable real SSE/NDJSON LLM token streaming, switch default LLM to a fast Flash tier with zero/low thinking, trigger TTS on the **first completed streamed sentence**, and cut VAD end-of-turn silence from `1,550 ms` to `450–550 ms` before moving voice mode to native WebSocket audio.

---

## 2. Stack Inventory

### A. Active & Supported Components

| Component | Provider | Exact Model | Local/Cloud | Streaming? | Loaded When? |
|---|---|---|---|---|---|
| **LLM (OOTB Default)** | Ollama (`localhost:11434/api/chat`) | `qwen2.5:7b` (`Q4_K_M`, 4.68 GB) | Local (Xeon CPU; `0 B` VRAM) | **No** (`stream: false` @ `src/js/chat.js:3741`) | Auto-spawned 150 ms after window load (`app.js:29-33`, `main.js:72-115`), model loaded on first request, evicted after `keep_alive: 5m` |
| **LLM (Live Profile Active)** | OpenRouter (`/api/v1/chat/completions`) | `nvidia/nemotron-3-ultra-550b-a55b:free` | Cloud (`openrouter.ai`) | **No** (`await res.json()` @ `src/js/chat.js:3809`) | Per-turn stateless HTTP `POST` (no keep-alive WS) |
| **LLM (Failover / Alt. Cloud)** | OpenRouter / 9Router / Gemini / OpenAI / Anthropic / DeepSeek | `openrouter/free`, `oc/flint-40b-free`, `gemini-1.5-pro` default (`chat.js:3657`), `gpt-4o`, `claude-3-5-sonnet-20241022`, `deepseek-chat` | Cloud (or local `20128`) | **No** (`generateContent`, `res.json()` everywhere) | Per-turn HTTP `POST` (`45s` timeout cloud, `180–300s` local CPU) |
| **LLM (Installed Alt. Local)** | Ollama (`D:\LuxAI_Models\ollama`) | `qwen2.5:3b` (1.93 GB), `qwen3.5:4b` (3.32 GB), `qwen3:8b` (5.23 GB), `qwen2.5:14b` (8.99 GB) | Local (CPU-only) | **No** (`stream: false`, `think: false` for `qwen3*` @ `chat.js:3742`) | On-demand in Ollama runner when selected |
| **STT (OOTB Default)** | Faster-Whisper (`auto`) | `faster-whisper-small` / fallback `base` (`CTranslate2 int8`) | Local (Xeon CPU) | **No** (full utterance WAV upload) | Lazy-imported on first status/warmup/transcribe (`voice_service.py:382-488`); evicted with `gc.collect()` if size changes (`L465-468`) |
| **STT (Live Profile Active)** | Google Speech (`engineMode: "online"` overrides `moonshine-base`) | `speech_recognition.recognize_google` (`tr-TR`) | Cloud (unofficial Google Web Speech HTTP) | **No** (normalizes & writes second temp WAV `voice_service.py:936-944`, full blocking HTTP upload) | `Recognizer` instantiated lazily on first call (`L118-133`); per-utterance HTTP request |
| **STT (Optional Local ONNX)** | Moonshine / Faster-Whisper | `UsefulSensors/moonshine` (`base` ONNX), `faster-whisper-large-v3-turbo` (`4.08 GB` HF cache on `D:\`) | Local (CPU) | **No** | On demand; `moonshine-base` in `auto` mode fails/empties on Turkish -> cold-falls back to `whisper-small` (`L988-994`) |
| **TTS (OOTB Default)** | Microsoft Edge-TTS (`Fola`) | `tr-TR-EmelNeural` (`+0Hz`, `0%`) | Cloud (`speech.platform.bing.com` WS per request) | **Fake** (sentence-chunk lookahead prefetch in `chat.js:3295-3299`, full MP3 downloaded to disk via `comm.save()` @ `voice_service.py:1610-1611`) | **Bug (`L1709-1711`):** `Fola` falls into `else:` during warmup and preloads local `Piper-DFKI` ONNX instead |
| **TTS (Live Profile Active)** | Piper TTS (`Piper-Fahrettin`) | `tr_TR-fahrettin-medium.onnx` (`D:\LuxAI_Models\piper`) | Local (ONNX CPU) | Chunked by sentence after 100% LLM completion; full WAV written to disk + Base64 over IPC | Lazy-loaded once in `_piper_voices` dict (`voice_service.py:502-521`); stays resident |
| **TTS (Other Installed Suites)** | Piper (`DFKI`, `Fettah`), Kokoro, Coqui XTTS-v2, OpenRouter Audio (`Fish S2.1 :free`, `HeyGen Voice Turbo :free`), Edge aliases (`ElevenLabs-*`, `Cartesia-Sonic-TR`, `Deepgram-Aura-TR`, `Qwen3-TTS-Bridge` -> **all actually Edge-TTS** @ `voice_service.py:280-315`) | `kokoro-v1.0.onnx` (337.3 MB), `xtts_v2` (venv 1.28 GB + cache), `fish-audio/s2.1-pro-free:free`, `heygen/heygen-voice-1-turbo:free` | Mixed Local CPU / Cloud HTTP | **No** real audio chunk streaming to speaker | `voice_service.py` persistent stdio Python 3.12; `xtts_worker.py` secondary persistent stdio Python 3.12 process inside `D:\LuxAI_Models\xtts_venv` |
| **Frontend / Desktop Shell** | Electron + Vanilla JS + Tailwind CSS | `electron ^45.2.3`, `marked ^15.0.7`, `monaco-editor ^0.57.0` | Local Desktop (Windows 10) | Fake `20ms`/`30ms` `setInterval` typewriter re-rendering whole chat DOM | `monaco-editor` AMD `loader.js` loaded eagerly in `<head>/<body>` (`index.html:517`), Google Fonts CSS loaded synchronously from `fonts.googleapis.com` (`index.html:10-12`) |

### B. Antigravity Comparison Table (Explicit Reference Benchmark)

| Feature | Antigravity (Target) | `LUX_ai` (Actual — OOTB & Live Profile) |
|---|---|---|
| **Where does LLM run?** | Google Cloud GPUs / TPUs | OOTB: Local Intel Xeon CPU (`size_vram: 0`); Live Profile: OpenRouter free-tier cloud router (`550B` MoE) |
| **Model** | Gemini Flash (`Low` / minimal thinking) | OOTB: `qwen2.5:7b` (`Q4_K_M`, 7.6B); Live Profile: `nvidia/nemotron-3-ultra-550b-a55b:free`; Gemini fallback code defaults to `gemini-1.5-pro` (`chat.js:3657`) |
| **First Token Time (TTFT)** | **250 – 500 ms** | OOTB Ollama cold: **93,924 ms** / warm w/ tools: **38,002 ms** (`stream: false`); even with `stream: true` warm no-tools `qwen2.5:7b` is **2,678 ms** (`qwen3.5:4b` = **455 ms**). Live OpenRouter: unmeasured live inference queue + **453 ms** network handshake (`45s` cap) |
| **Generation Speed** | **150 – 200 tok/s** | Measured Xeon CPU: **`2.44 tok/s`** (`qwen3:8b`), **`2.88 tok/s`** (`qwen2.5:7b`), **`3.85 tok/s`** (`qwen3.5:4b`), **`6.05–6.22 tok/s`** (`qwen2.5:3b`) |
| **Voice Architecture** | Native Audio (single bidirectional WebSocket) | **7-hop blocking cascade**: `ScriptProcessor(1024)` -> `1,550ms` VAD silence -> WAV/Base64/IPC/disk -> Python STT -> 2x FS pre-scan -> blocking LLM -> Python TTS/disk/Base64/IPC -> `Audio.play()` + `300ms` tail |
| **Streaming** | Token + real-time audio chunk streaming | **None** for LLM (`stream: false` / `res.json()`) or STT (batch WAV); TTS only overlaps sentence `N+1` synthesis **after** 100% of LLM text & recovery complete |
| **Session** | Persistent WebSocket across turns | Persistent Python stdio subprocess (`3 ms` warm IPC), **but stateless HTTP `fetch()` per LLM call**, per-chunk Edge-TTS WS/save (`2.19–3.56s`), per-chunk OpenRouter HTTP (`urlopen`) |
| **STT Model** | Gemini Native Audio (cloud, streaming) | OOTB `auto`: CPU `faster-whisper-small` (`6,137 ms` warm / `7,017 ms` cold); Live profile: `moonshine-base` overridden by `online` -> Google Web Speech (`1,505 ms`) or in `auto` falls back to `whisper-small` (`11,024 ms`) |
| **TTS Model** | Gemini Live Native Voice (sub-300 ms streamed PCM) | OOTB `Fola`: Edge-TTS (`2,191 ms` warm / `3,556 ms` cold; warmup bug also loads `Piper-DFKI` for `17.9s`!). Live profile: `Piper-Fahrettin` (`12,433 ms` cold / `262.7 ms` warm for short phrase) |

### C. Project Discovery, Hardware, Dependencies & Lifecycle

- **Hardware & OS (measured):** Microsoft Windows 10 Pro (`10.0.19045`), **Intel Xeon E3-1245 v5 @ 3.50 GHz (4 cores / 8 threads)**, **39.92 GB RAM** (`18.24 GB` free), **AMD FirePro W7100 (4 GB VRAM)**. Because neither NVIDIA CUDA nor supported ROCm compute is available (`ollama` stderr: `discovering available GPUs... inference compute id=cpu library=cpu total="39.9 GiB"`), **all local inference (Ollama, Faster-Whisper, Moonshine, Piper, Kokoro, XTTS-v2) runs strictly on 4 CPU cores.**
- **Project Layout (`c:\Users\SERVER\Desktop\LUX_ai`):**
  - Entry points: [start_lux_ai.bat](file:///c:/Users/SERVER/Desktop/LUX_ai/start_lux_ai.bat), [main.js](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js) (`1,314` lines), [src/preload.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/preload.js) (`75` lines), [src/index.html](file:///c:/Users/SERVER/Desktop/LUX_ai/src/index.html) (`524` lines).
  - Renderer JS (`src/js/`): [app.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/app.js), [store.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/store.js), [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js) (`189.4 KB`), [voice.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js) (`77.5 KB`), [voice_library.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice_library.js), [modals.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/modals.js) (`164.7 KB`), [ideMode.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/ideMode.js), [rightPanel.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/rightPanel.js), [sidebar.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/sidebar.js), [icons.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/icons.js), `marked.umd.js`.
  - Backend JS & Python Services (`scripts/`): [agent_capabilities.js](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/agent_capabilities.js) (`1,185` lines), [voice_service.py](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py) (`1,933` lines), [xtts_worker.py](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/xtts_worker.py) (`288` lines).
  - Node Dependencies ([package.json](file:///c:/Users/SERVER/Desktop/LUX_ai/package.json)): `electron ^45.2.3`, `marked ^15.0.7`, `monaco-editor ^0.57.0` (`package.json:19-25`). No `requirements.txt` or `pyproject.toml`; Python deps live across **two system Pythons** (`3.15.0` & `3.12.7`) and `D:\LuxAI_Models\py_libs` (`486.5 MB`) + `D:\LuxAI_Models\xtts_venv` (`1,315.8 MB`). `D:\LuxAI_Models` totals **29,530.8 MB (~28.84 GiB)** (`ollama: 22.49 GB`, `huggingface: 4.08 GB`, `xtts_venv: 1.28 GB`, `py_libs: 0.48 GB`, `kokoro: 0.33 GB`, `piper: 0.18 GB`).
- **API Key Location & Security Boundary:** All LLM keys and `voiceMode.openrouterApiKey` are persisted in **frontend Chromium `localStorage` (`lux_ai_state_v2`)** (`src/js/store.js:379`) and read/sent directly from the **renderer** in `fetch()` headers (`chat.js:3658, 3826, 4060`), plus forwarded via IPC (`main.js:1208-1276`) or read from Electron `DATA_FILE` (`%APPDATA%\Lux AI\lux_ai_data.json`) when using OpenRouter TTS.
- **Model Load Lifecycle (Startup vs On-Demand vs Eviction):**
  1. Electron main spawns `python.exe scripts/voice_service.py` lazily on the first voice IPC (`voice-status` / `voice-warmup` / `voice-transcribe` / `voice-synthesize` @ `main.js:1022-1094`) — measured **611.9 ms cold**, **3.0 ms warm**.
  2. Window `DOMContentLoaded` (`src/js/app.js:29-33`) schedules `discoverLocalAIModels({ silent: true })` at `150 ms`, which probes ports `11434`, `1234`, `20128` (`1,500 ms` timeout) and calls `luxAPI.ensureOllama()` (`app.js:232-238` -> `main.js:72-115`: up to `16 × 400 ms = 6.4s` polling if Ollama offline). Also `voice.js:1930-1932` binds a duplicate `DOMContentLoaded` listener alongside `app.js:28` (guarded by `isVoiceModeInitialized` @ `voice.js:356`).
  3. Clicking Live Voice (`voice.js:509-513`) or Composer Mic (`voice.js:1876-1879`) triggers `warmup_models(sttModel, voice)`. **Bug (`voice_service.py:1709-1711`):** any cloud voice (`Fola`, `Arlo`, `OpenRouter-*`, `Edge-TTS`) falls into the `else:` branch and loads `Piper-DFKI` (`12.8s` cold)! Combined warmup measured **17,942.3 ms**.
  4. Switching Whisper STT model sizes (`voice_service.py:465-468`) explicitly sets `_whisper_model = None` and invokes `gc.collect()`, forcing a fresh `4.05s – 41.1s` CPU reload.
  5. `xtts_worker.py` stays resident once spawned, **but live OS process inspection showed two Python workers from `xtts_venv` (`PID 261540 -> 262784`) alongside `voice_service.py` (`PID 261000`)** on the user's running instance.

---

## 3. Latency Budget

> **Target E2E budget (`talimat.md:125-132`):** `< 1,500 ms` from end-of-user-speech until the user **hears/sees first assistant output**. Every timing below was **directly measured** in isolated hardware/CDP/Python/Node benchmarks except live remote OpenRouter 550B inference generation, which is explicitly bounded by `45,000 ms` HTTP timeout and measured handshake latency.

### Table A: Stage-by-Stage Measured Latency Budget (Single Voice Turn)

| Stage | Measured ms (OOTB Default) | Measured ms (User Live Profile) | Target ms | Gap (OOTB / Live) | Evidence & Benchmark Notes |
|---|---|---|---|---|---|
| **0. App Boot + Fonts + Warmup Collision** | DOM `641 ms` · Load `1,629 ms` · Warmup `17,942 ms` *(blocks voice `Fola`+Piper/STT)* | DOM `641 ms` · Load `1,629 ms` · Cold `Piper-Fahrettin` `12,433 ms` | `< 500 ms` non-blocking | **+1,129 ms load; +17.9s warmup CPU spike** | CDP `bench_electron_e2e.js`: Google Fonts (`932 + 696 + 664 + 313 ms`); `task-9728.log` (`17,942.3 ms` warmup) |
| **1. VAD / End-of-Turn Detection** | **`1,550 ms`** idle silence (`+ 420ms` start / `180ms` post-AI blind gate; `750ms` tentative / `1,500ms` committed barge-in) | **`1,550 ms`** idle silence (+ `64ms` `ScriptProcessor` frame quantization) | `< 200 ms` | **`+1,350 ms`** (alone nearly blows entire 1.5s budget!) | Code constant `voice.js:942`, `610`, `660`, `870`, `753` |
| **2. Audio Encode + IPC + Temp WAV I/O** | **~`15–40 ms`** encode/Base64/IPC/disk *(scales up on main thread under GC)* | **~`25–60 ms`** *(adds second norm WAV write inside `transcribe_online` `voice_service.py:941-944`)* | `< 20 ms` (streaming frames) | `+10–40 ms` | `voice.js:314-351, 1075-1085`; `main.js:1153-1155`; `voice_service.py:936-944`; `voice.getStatus` IPC = `3.0 ms` warm / `611.9 ms` cold (`bench_electron_e2e.js`) |
| **3. STT (Speech -> Text)** | **`6,136.7 ms` warm / `7,016.5 ms` cold** (`whisper-small` TR 3.78s audio) · `1,760.2 ms` (`base`) · `23,614.6 ms` warm (`turbo`) | **`1,505.2 ms`** (`google-cloud` via `engineMode: "online"` overriding `moonshine-base`); or **`11,024.2 ms`** if switched to `auto` (`moonshine-empty -> whisper-small`) | `< 300 ms` (streaming partials) | **`+5,837 ms` (OOTB warm)** / **`+1,205 ms` (Live online)** | Measured verbatim in `task-9609.log` & `task-9728.log`; batch upload in `voice.js:1080`, dual-pass Whisper in `voice_service.py:851-880` |
| **4. Pre-LLM FS Double Scan + Prompt Build** | **`9.8 – 33 ms`** (6 cached Desktop dirs; called **2x** sequentially) + `0–6,400 ms` if Ollama sleeping | **`9.8 – 33 ms`** (called **2x** per turn) | `< 10 ms` (cached at startup) | `+10–33 ms` *(higher with deep/HDD Desktop folders)* | `bench_electron_e2e.js`: `listDesktopProjects()` = `16.5 ms` cold, `4.9 ms` avg × 2 calls (`chat.js:3163` + `3175->1671`) |
| **5. LLM First Token (TTFT) & Blocking Full Gen** | **`38,002 ms` warm w/ tools (`93,924 ms` cold)** for `qwen2.5:7b` (`stream: false` @ `2.88 tok/s`); even `qwen2.5:3b` = `17,860 ms` | **453 ms** TCP/TLS/GET network floor + **unmeasured live remote queue/full generation** on `nvidia/nemotron-3-ultra-550b-a55b:free` *(up to `45,000 ms` timeout + `openrouter/free` retry)* | **TTFT `< 500 ms`**, **100 tok `< 1,000 ms`** | **`+37,502 ms` to `+93,424 ms` (OOTB)** · Unknown `+queue/+full-gen` (Live Cloud) | `task-9843.log`: real `/api/chat` (`qwen2.5:7b` warm `promptEval=29,630 ms` for `808` tokens + `eval=8,334 ms` = `38,002 ms` TTFT); `task-10030.log`: `openrouter.ai` DNS `5 ms`, TLS `164 ms`, GET `284 ms` |
| **6. Serial Tools / Auto-Recovery** | **`+17,860–38,002 ms` per extra tool round** + PowerShell spawn latency (`150–800 ms`+) | **+Full blocking roundtrip per tool call** (`MAX_TOOL_STEPS = 12`) + `maybeRecoverMissingActionOrRefusal` | Parallel & streamed | **`+1s to +180s` multi-step** | `chat.js:3700, 3890, 3941-3965`; sequential `for (const tc of ...)` awaits each tool before next LLM HTTP request |
| **7. TTS Chunk 1 Synth + File/Base64/IPC** | **`2,190.5 ms` warm / `3,555.7 ms` cold** (`edge-tts` `Fola`) | **`262.7 ms` warm / `12,432.6 ms` cold** (`Piper-Fahrettin`) *(or `3,781–13,759 ms` Kokoro; `18,608–30,585 ms` XTTS after `89.1s` warmup)* | `< 300 ms` first audio byte | **`+1,891 ms` (Edge warm)** / `-37 ms warm, +12,133 ms cold` (Piper) | `task-9609.log` & `task-9728.log`; `main.js:1237-1245` reads temp file -> Base64 IPC |
| **8. UI Typewriter Rebuild & Tail Delays** | **`15.4 ms`/tick** full DOM rebuild (`617 ms` CPU over 40 ticks @ 40 msgs) + `300 ms` tail (`voice.js:1273`) | Same (`renderChat()` calls `marked.parse` + `DOMParser` on ALL msgs every 20–30 ms!) | `< 4 ms` incremental append | `+15–300 ms` UI jank | `bench_electron_e2e.js`: 1st `renderChat()` `39.0 ms`, avg `15.43 ms`; `chat.js:3413, 3470` |
| **TOTAL (User Stops Speaking -> First Heard Audio)** | **OOTB Warm:** `~47,890 ms` (**47.9 s**) · **OOTB Cold:** `~106,060 ms` (**106.1 s**) · *(w/ `Fola` warmup collision: ~**124 s**)* | **Live Warm Floor:** **`3,350 ms`** (`1,550 VAD + 1,505 STT + 263 TTS + IPC`) **+ full blocking 550B OpenRouter gen** (~`8,000–48,000+ ms` realistic E2E) | **`< 1,500 ms`** | **`+46,390 ms` (OOTB)** / **`+6,500 – 46,500+ ms` (Live)** | Sum of directly measured stage latencies (`task-9609`, `task-9728`, `task-9843`, `task-10030`, `bench_electron_e2e.js`) |

---

## 4. Checklist Results

Every single item from Step 3 of [antigravity-performans-denetime-talimat.md](file:///c:/Users/SERVER/Downloads/antigravity-performans-denetime-talimat.md#L53-L67):

| Check | PASS / FAIL | `file:line` Evidence | Impact |
|---|---|---|---|
| **1. LLM streaming (SSE/WebSocket vs waited until complete)** | **FAIL** | [chat.js:3658-3678](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3658-L3678) (`:generateContent`), [chat.js:3741-3765](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3741-L3765) (`stream: false`), [chat.js:3796-3809](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3796-L3809), [chat.js:4067-4085](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L4067-L4085) | TTFT equals **100% total generation time** (`+8s–93s` delay before text/TTS even starts) |
| **2. TTS starts on first sentence/chunk vs waits for full LLM output** | **FAIL** *(partial post-LLM lookahead only)* | [chat.js:3191-3271](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3191-L3271) awaits LLM + `maybeRecoverMissingActionOrRefusal` (`L3218`) + `naturalizeConversationalTurkish` (`L3232`) before `synthesize(speechChunks[0])` (`L3270`); lookahead prefetches `chunkIdx + 1` at `L3296-3299` | Adds 100% of LLM completion + recovery latency before first spoken phoneme |
| **3. STT emits partial transcripts vs waits for full utterance** | **FAIL** | [voice.js:940-943, 1023-1092](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L1023-L1092), [voice_service.py:822-965](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L822-L965) | Zero incremental decoding; full WAV uploaded after `1,550ms` silence (`+1.5s–11s` pure STT delay) |
| **4. Architecture: Native speech-to-speech vs Cascade STT->LLM->TTS** | **FAIL** | [voice.js:1075-1155](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L1075-L1155) -> [main.js:1149-1282](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js#L1149-L1282) -> [chat.js:3163-3433](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3163-L3433) | Structural 7-hop cascade with WAV/Base64/temp-file copies across 3 processes |
| **5. Session: Persistent WS across turns vs reconnected per turn** | **FAIL** | [voice_service.py:1339-1357](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L1339-L1357) (`urllib.request.urlopen`), `L1610` (`edge_tts.Communicate`), [chat.js:3662, 3752, 3796, 4067](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3796) | New HTTP/TLS or Edge WS per request (`+169ms–350ms` handshake overhead; Python stdio only persistent hop) |
| **6. Model choice: Flash/Low vs Pro/High/Thinking/CPU-bound** | **FAIL** | [store.js:28](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/store.js#L28) (`qwen2.5:7b` OOTB), [chat.js:3657](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3657) (`gemini-1.5-pro`), live `000395.log` (`nvidia/nemotron-3-ultra-550b-a55b:free`, `moonshine-base` + `online`) | `2.88 tok/s` CPU (`38s` warm / `94s` cold) or massive 550B reasoning cloud tier |
| **7. Model loading: Reloaded per request? Global locks / sync blocking?** | **FAIL** | [voice_service.py:60-65](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L60-L65) (`_whisper_lock`), `L465-468` (eviction + `gc.collect()`), `L1709-1711` (`Fola` loads Piper!), `L1733` (`to_thread`), Ollama `5m` unload (`task-9843.log:42`) | Good stdio persistence, **but** `Fola` warmup wastes `17.9s`, Whisper switching evicts model, Ollama cold loads cost `49.1s–51.0s` |
| **8. Context: Token count per turn? Truncation? Prompt caching?** | **FAIL** *(partial local truncation)* | [chat.js:1555-1585](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L1555-L1585) (`2,259`-char prompt), `L468-707` (`6,387` B 16 tools), `L1596-1597` (cloud skips tool filter!), `L3877-3881` (`-12` untruncated cloud msgs vs `-4` @ `650`c local), zero caching | ~`2,343` static tokens resent every cloud turn + untruncated 12-msg history; zero OpenAI/Gemini/Anthropic prompt cache |
| **9. VAD: Silence threshold in ms (adding 300–500ms+ delay?)** | **FAIL** | [voice.js:942](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L942) (`1550 ms` idle), `L610` (`1500 ms` committed barge-in), `L660` (`750 ms` tentative), `L870` (`420ms` start / `180ms` post-AI gate) | Adds **`1,550 ms`** dead air *after* user finishes speaking before STT starts |
| **10. Audio format: Sample rates & main-thread resampling/processing** | **FAIL** | [voice.js:742, 753](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L742-L753) (`ScriptProcessor(1024)` @ `16kHz` on UI main thread), `L314-351` (WAV + `FileReader`), `voice_service.py:678-690, 936-944` (resamples + re-writes WAV on disk), [xtts_worker.py:138-146](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/xtts_worker.py#L138-L146) (`np.interp` -> 22.05kHz) | Deprecated main-thread `ScriptProcessorNode` contends with full-DOM `renderChat()`; Piper outputs `22.05kHz`, Kokoro `24kHz`, Edge `MP3`, HeyGen `44.1kHz PCM -> WAV` |
| **11. Backend concurrency: Sync vs async, Ollama `num_ctx`, GPU vs CPU** | **FAIL** | [chat.js:3737-3744](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3737-L3744) (`num_ctx: 4096/6144`), [main.js:104-105, 504](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js#L504) (sync FS IPCs), [voice_service.py:483](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L483) (`device="cpu"`), `L1353` (`urlopen` blocking in worker thread), `task-9843.log:44-50` | **Zero GPU compute** (`0 B VRAM`, 4 Xeon CPU threads); large `num_ctx: 4096` allocates `224 MiB` CPU KV cache; Whisper uses heavy `beam_size=5, best_of=5` |
| **12. Tool calls: Sequential & blocking the response?** | **FAIL** | [chat.js:3163-3175](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3163-L3175) (double sequential FS scan), `L3712-3718`, `L3941-3953`, `L3962-3968`, `L4119-4125`, [agent_capabilities.js:905-941](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/agent_capabilities.js#L905-L941) (PowerShell spawn) | Up to `12` sequential ReAct turns; multiple `tool_calls` execute serially in a `for...of` loop |
| **13. Rate limits: 429 / free-tier queue / silent retries** | **FAIL** | [chat.js:1966-1993](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L1966-L1993), [chat.js:4030-4049](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L4030-L4049), [voice_service.py:1211-1212, 1559-1575](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L1211-L1212) | Zero client-side `:free` RPM/RPD tracking or backoff; a single OpenRouter `429`/timeout triggers `openrouter/free` retry **then fails over silently into `38s–94s` CPU Ollama!** |
| **14. Frontend: Audio/UI blocking & bundle/render work** | **FAIL** | [index.html:10-12](file:///c:/Users/SERVER/Desktop/LUX_ai/src/index.html#L10-L12) (render-blocking Google Fonts CSS), `L517` (sync `monaco` `loader.js`), [chat.js:22-284](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L22-L284) (`container.innerHTML = ...` every 20–30 ms), `L4187-4230` (`DOMParser`), [app.js:29-33](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/app.js#L29-L33) | Google Fonts delayed `window.onload` to **`1,629 ms`**; 20-turn `renderChat()` takes **`15.4 ms` avg (`39 ms` peak)** per tick (`O(N^2)`), choking main-thread Web Audio capture |
| **15. Region: Same region vs cross-continent hops** | **FAIL** *(partial edge proximity)* | `task-10030.log:87-92` (`bench_profile_and_net.js`), [voice_service.py:180](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L180), [chat.js:3658](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3658) | From Turkey: `openrouter.ai` GET = `284 ms` + `164 ms` TLS (`453 ms` cold), `googleapis` = `313 ms` + `108 ms` TLS, `openai.com` = `328 ms` + `160 ms` TLS; only `bing.com` (`149 ms`) hits nearby edge |

---

## 5. Root Causes Ranked

> **Estimated Delay Contribution:**
> - **OOTB Default Profile (~47.9s warm / ~106.1s cold):** Local CPU LLM **~79–89%**, Local CPU Whisper STT **~7–13%**, VAD silence **~1.5–3%**, Edge-TTS + IPC + UI **~2–5%** (+ **`17.9s` hidden startup tax** from `"Fola"` Piper warmup bug).
> - **User's Live Cloud Profile (~8–48s+ unmeasured remote queue):** Contended Cloud LLM (`550B :free`, no stream, no cache, 16 tools) **~55–80%**, STT (`1.5s` Google or `11.0s` Moonshine->Whisper TR fallback) **~15–30%**, VAD `1,550 ms` wait **~10–19%**, TTS + IPC + UI **~3–10%**.

| Rank | Cause | Evidence (`file:line` + Benchmark) | Est. Delay | Fix |
|---|---|---|---|---|
| **1** | **Non-streaming Local CPU LLM (`qwen2.5:7b` OOTB) & 550B `:free` Reasoning Cloud Default** | `store.js:28`, `chat.js:3741` (`stream: false`), `3657` (`gemini-1.5-pro`), live `000395.log` (`nemotron-3-ultra-550b-a55b:free`); **Measured Ollama (`task-9843.log`):** `qwen2.5:7b` = **38,002 ms** warm w/ tools (**93,924 ms** cold, `2.88 tok/s`, Xeon `0 B VRAM`) | **+35,000 – 93,000 ms** (OOTB) · Unmeasured multi-second queue (550B `:free`) | Default to **Gemini 2.5 Flash / 2.0 Flash** (`thinkingBudget: 0` / low) or fast non-thinking OpenRouter Flash; set local fallback to `qwen2.5:3b` (`6.22 tok/s`) or `qwen3.5:4b` |
| **2** | **Zero Streaming Across LLM, STT & Audio Output (Full-Turn Cascade)** | `chat.js:3658, 3741, 3809, 4084` (`stream: false` / `res.json()`); `chat.js:3191-3270` blocks TTS until LLM + recovery + Turkish rewrite 100% done; `voice.js:1080` batch STT | **+8,000 – 45,000 ms** TTFT waste (+**1,115–2,678 ms** even locally; `qwen2.5:7b` warm no-tools drops `38s -> 2,678 ms` TTFT with `stream: true`!) | Implement true SSE (`:streamGenerateContent?alt=sse`, OpenAI `stream: true`) + **sentence-boundary streaming TTS queue** started mid-stream |
| **3** | **Local CPU STT Slowness & `Moonshine` Turkish Trap (`11.0s`) + Warmup Eviction Bug** | `task-9609.log` (`whisper-small` `6,137 ms` warm / `7,017 ms` cold; `turbo` `23.6s–41.1s`), `task-9728.log` (`moonshine-base` TR `auto` -> `whisper-small` = **11,024 ms**; `Fola` warmup = **17,942 ms** via `voice_service.py:1709-1711`); `L854-880` (`beam_size=5` 2x pass) | **+1,500 – 23,600 ms**/turn + **17,942 ms** session start freeze | Fix `warmup_models` so cloud/Edge voices don't load Piper; drop `beam_size=1` (`best_of=1`) for interactive Whisper or use streaming cloud STT / Native Audio |
| **4** | **Excessive VAD Idle Silence Timeout (`1,550 ms`) & Post-Audio Delays** | `voice.js:942` (`1,550 ms` idle), `L610` (`1,500 ms` barge-in), `L870` (`420ms`/`180ms` blind gate), `L1273` (`300 ms` tail) | **+1,100 – 1,850 ms** fixed floor every single voice turn | Replace `ScriptProcessorNode` with `AudioWorklet` + WebRTC/Silero VAD at **450–550 ms** hangover; remove `300 ms` `setTimeout(finish, 300)` |
| **5** | **TTS Cloud Per-Request Connection (`edge-tts` / `urlopen`) + XTTS/Kokoro CPU Latency** | `task-9609.log`: `edge-tts` warm **2,191 ms** (`3,556 ms` cold) per chunk despite Edge alias names (`voice_service.py:280-315` fake ElevenLabs/Cartesia!); `kokoro` `3.78s–13.76s`; `task-9728.log`: `XTTS-v2` **`89.1s` warmup + `18.6–30.6s`/chunk** | **+1,900 – 30,000 ms** TTS first audio (vs Piper warm **`177.5–262.7 ms`**) | Keep persistent `Piper-DFKI/Fahrettin` warm (`178–263 ms`) as ultra-fast local fallback, stream raw PCM bytes instead of disk WAV/MP3 + Base64, or use Gemini Live audio |
| **6** | **Unfiltered Cloud Tool Schemas (`6.4 KB`), Duplicate FS Scan, Zero Prompt Caching & Auto-Failover Trap** | `chat.js:1596-1597` ships all **16 tools (`6,387 B`)** + **2,259-char** prompt + **12** untruncated history msgs to cloud (`~2,343` static tokens, `0` cache); `L3163` + `L1671` double `listDesktopProjects()`; `L1970-1986` fails over `:free` `429` directly into **`38s` CPU Ollama** | **+500 – 4,000 ms** cloud TTFT + silent `+38s` fallback spikes | Apply `selectToolsForPrompt` for cloud too (0 tools on chitchat), add Gemini `cachedContent` / Anthropic `cache_control`, cache desktop projects, disable CPU Ollama fallback in Voice Mode |
| **7** | **Full-DOM Rebuild on Every Stream Tick + Blocking Google Fonts + `monaco` Loader** | `index.html:10-12, 517`; `bench_electron_e2e.js`: Google Fonts (`932 ms`, total load `1,629 ms`), 20-turn `renderChat()` (`chat.js:22-284, 4187-4230`) = **`15.43 ms` avg / `39.0 ms` peak** -> **`617.2 ms`** main-thread stall in 40 ticks | **+932 ms** boot block + **>16 ms/frame UI & Audio thread jank** | Host fonts locally (`font-display: swap`), defer `monaco/loader.js` until `IDE` split opens, update only the active streaming message DOM node (buffered via `rAF`) |

---

## 6. Score Breakdown

Scored strictly against the 100-point rubric in [antigravity-performans-denetime-talimat.md](file:///c:/Users/SERVER/Downloads/antigravity-performans-denetime-talimat.md#L136-L156):

| Category | Points / Max | Reason |
|---|---|---|
| **Model Choice** | **4 / 20** | Default OOTB is CPU `qwen2.5:7b` (`2.88 tok/s`, `38–94s`/turn on Xeon w/ `0 B` VRAM); Gemini defaults to `gemini-1.5-pro`; live profile uses `nemotron-3-ultra-550b-a55b:free` reasoning tier instead of Flash Low. Minor credit for having `qwen2.5:3b` (`6.22 tok/s`) / `qwen3.5:4b` installed with `think: false` for `qwen3`. |
| **Streaming** | **2 / 20** | Zero real LLM token streaming across all 5 adapters (`stream: false`, `res.json()`, `:generateContent`). Zero STT partial streaming. Fake `20–30 ms` UI typewriter interval runs only *after* completion. `2 pts` solely for post-LLM sentence-level TTS lookahead prefetch (`chat.js:3295-3299`). |
| **Architecture (Native vs Cascade)** | **3 / 20** | Classic slow 7-hop cascade with Base64/disk-temp-file hops (`main.js:1153-1245`), no Gemini Live / OpenAI Realtime WebSocket, serial tool loops (`MAX_TOOL_STEPS = 12`). Partial credit (`3 pts`) for persistent Python stdio bridge (`voice_service.py`) and barge-in abort tokens. |
| **Session & Model Loading** | **6 / 15** | Persistent `voice_service.py` (`3 ms` warm status IPC), lazy Python imports (`611.9 ms` cold spawn), persistent `xtts_worker.py`. Loses points for stateless per-turn HTTP/TLS/Edge-TTS calls, `Fola` warmup loading unused `Piper-DFKI` (`17.9s`), Whisper eviction `gc.collect()` reloads, and Ollama `5m` unload causing `49–51s` reloads. |
| **Context & Prompt** | **4 / 10** | Good local CPU truncation (`-4` msgs, `650`c, `<= 9` filtered tools -> `808` Ollama tokens). Loses points for zero prompt caching, sending all 16 tools (`6,387` B) + `-12` untruncated messages on cloud turns, and duplicate sequential `refreshDesktopProjectsCache()` per turn. |
| **VAD & Audio** | **3 / 10** | Adaptive noise-floor calibration and `640 ms` pre-roll buffer at `16 kHz`. Heavily penalized for **`1,550 ms` silence threshold** (`1,500 ms` barge-in), `420/180 ms` blind gates, deprecated main-thread `ScriptProcessorNode`, double WAV re-writes (`L941-944`), and `300 ms` post-playback `setTimeout`. |
| **Network & Quotas** | **2 / 5** | Measured clean TLS/HTTP reachability (`openrouter.ai` `164+284 ms`, `googleapis` `108+313 ms`). Penalized for no `:free` RPM/RPD backoff, silent failover from OpenRouter 429 into CPU Ollama (`38s`), and render-blocking external Google Fonts (`+932 ms`). |
| **Total** | **24 / 100** | **0–39 Band ("Model or architecture wrong for real-time voice: local CPU / 550B + non-streaming cascade").** |

---

## 7. Fix Plan (P0 / P1 / P2) — Plan Only, Zero Code Edits in Phase 1

> **Target Goal (`talimat.md:7`):** Lift score from **24/100 → 90/100** (`TTFT < 500 ms`, `End-to-End Voice < 1,500 ms`).

| Priority | Fix | Target Files | Expected Gain | Risk | Effort |
|---|---|---|---|---|---|
| **P0-1** | **Switch Default & Active LLM to Flash Low / Minimal Thinking** (e.g. `gemini-2.5-flash` w/ `thinkingBudget: 0` or `openrouter` low-latency fast route; remove `gemini-1.5-pro` & CPU `qwen2.5:7b` voice defaults; block silent failover to CPU Ollama during active Voice Mode) | [store.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/store.js#L25-L47), [app.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/app.js#L107-L148), [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L1969-L1993, L3657) | **`-35,000` to `-90,000 ms`** vs OOTB CPU; eliminates multi-second 550B reasoning stalls | Low | **S** |
| **P0-2** | **True Token Streaming for All LLM Backends** (`stream: true` SSE on OpenRouter/OpenAI/DeepSeek/9Router, `:streamGenerateContent?alt=sse` on Gemini, NDJSON `stream: true` on Ollama, SSE on Anthropic) | [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3654-L4092) | TTFT **`38,000 ms → 350–700 ms`** (cloud Flash); Ollama `qwen2.5:7b` `38s → 2.68s`, `qwen3.5:4b` `53s → 455 ms` | Medium | **M** |
| **P0-3** | **Sentence-Boundary Streaming TTS Inside Active LLM Stream + Piper/Binary IPC** (emit each complete clause/sentence immediately to TTS queue while LLM continues streaming; stream raw PCM/WAV Buffer via IPC instead of disk temp file + Base64 `DataURI`) | [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3250-L3375), [main.js](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js#L1184-L1282), [voice_service.py](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L1231-L1485) | **`-3,000` to `-15,000 ms`** overlap gain (TTS starts on token ~20 instead of token ~300); Piper warm **`178–263 ms`** | Medium | **M** |
| **P0-4** | **Cut VAD End-of-Turn Silence (`1,550 ms → 480 ms`) + Remove `300 ms` Tail + Fix `Fola` Warmup Bug** (and swap `beam_size=5` two-pass Whisper to `beam_size=1, vad_filter=True` single pass or cloud/Gemini audio STT) | [voice.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L870, L942, L1273), [voice_service.py](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L851-L880, L1700-L1711) | **`-1,350 ms`** VAD + **`-300 ms`** tail + **`-17,942 ms`** bogus warmup + **`-3,000–5,000 ms`** Whisper pass | Low-Med | **S** |
| **P1-1** | **Option B / Long-Term Antigravity Parity: Persistent Gemini Live API (Native Audio WebSocket)** or streaming Deepgram/WebSocket STT + keep-alive HTTP agent in Python/Node | New `src/js/liveAudioClient.js`, [voice.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js), [main.js](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js) | Eliminates separate STT & TTS hops -> **single `< 600–1,200 ms` native voice roundtrip** | High | **L** |
| **P1-2** | **Cloud Tool Filtering + Prompt Caching + Single FS Discovery Cache** (apply `selectToolsForPrompt` to cloud, omit tools on conversational voice turns, enable Gemini `cachedContent` / Anthropic `cache_control`, remove redundant `refreshDesktopProjectsCache()` at `chat.js:1671`) | [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L1555-L1672, L3163-L3175, L3859-L3877) | Cuts **`~1,800–2,300` redundant input tokens/turn**, drops FS double scan (`-10–35 ms`) | Low | **S** |
| **P1-3** | **Migrate `ScriptProcessorNode` -> `AudioWorkletNode` & Incremental Chat DOM Updates** (`renderStreamingDelta(msgId)` instead of full `container.innerHTML` + `DOMParser` on all 40+ messages every 20–30 ms) | [voice.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L753), [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L22-L284, L3413, L3470) | Saves **`~600+ ms` CPU/turn** at 20 turns, stops UI/audio stutter (`< 2 ms`/frame) | Medium | **M** |
| **P1-4** | **Parallelize Multi-Tool Calls & Replace PowerShell `captureScreen` Spawn** (use Electron `desktopCapturer` instead of spawning `powershell.exe` + .NET WinForms; use `Promise.all` for independent tool calls) | [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3712, L3941), [agent_capabilities.js](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/agent_capabilities.js#L905-L941) | **`-300` to `-2,500 ms`** on multi-tool/screen turns | Low-Med | **S–M** |
| **P2-1** | **Bundle Local Fonts + Defer Monaco `loader.js` + Non-Blocking Discovery** (self-host WOFF2 fonts, load `monaco-editor/min/vs/loader.js` inside `ensureMonaco()`, probe Ollama asynchronously without blocking startup) | [index.html](file:///c:/Users/SERVER/Desktop/LUX_ai/src/index.html#L10-L12, L517), [ideMode.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/ideMode.js#L177-L195), [app.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/app.js#L29-L33, L232) | Startup `loadEventEnd`: **`1,629 ms → ~350 ms`**, zero network boot dependency | Low | **S** |
| **P2-2** | **Client-Side `:free` Rate-Limit/Quota Guard + Voice-Mode Fast Timeout (`8–12s` vs `45s`)** + fix misleading Edge-TTS alias names (`Cartesia`/`ElevenLabs`/`Deepgram`) | [chat.js](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3852, L4030-L4049), [voice_service.py](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L280-L315) | Prevents silent 45s hangs when free-tier RPM/RPD throttles | Low | **S** |

---

## 8. Measurement After Fix

Currently **no structured stage-timing log exists** across the voice-to-playback boundary (`processRecordedAudio` -> `submitUserMessage` -> `callSingleModel` -> `synthesize` -> `audio.play`).

### Exact 5-Line Timestamp Instrumentation Patch (To Apply When Phase 2 Starts)

Add this minimal `console.log('[LUX_PERF]', ...)` telemetry across [src/js/voice.js:1079-1145](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L1079-L1145) and [src/js/chat.js:3162-3375](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L3162-L3375):

```diff
--- a/src/js/voice.js (lines ~1032, ~1091)
+   window.__luxTurnT0 = performance.now(); // right after silenceTimer triggers at voice.js:1032
    // ... after window.luxAPI.voice.transcribe(...) resolves at voice.js:1091:
+   console.log(`[LUX_PERF] vad+stt=${(performance.now() - window.__luxTurnT0).toFixed(1)}ms engine=${engineLabel}`);
--- a/src/js/chat.js (lines ~3189, ~3275, ~3374)
+   const tLlm0 = performance.now(); // right before callModelWithFallback at chat.js:3189
    // ... inside streaming chunk / after first token or synthRes at chat.js:3275:
+   console.log(`[LUX_PERF] llmDone=${(performance.now() - tLlm0).toFixed(1)}ms (replace w/ TTFT on SSE first delta)`);
    // ... right when chunkIdx === 0 enters audio.play() at chat.js:3374:
+   if (chunkIdx === 0 && window.__luxTurnT0) console.log(`[LUX_PERF] FIRST_AUDIO_E2E=${(performance.now() - window.__luxTurnT0).toFixed(1)}ms`);
```

### Re-Test Procedure & Success Criteria

1. **Automated Pre/Post Verification:** Re-run the non-destructive CDP harness (`bench_electron_e2e.js`) to confirm:
   - Startup `loadEventEnd < 500 ms` (zero external `fonts.googleapis.com` requests).
   - 20-turn `renderChat()` incremental append `< 2.5 ms` p95 (down from `39.0 ms`).
2. **Real Live Voice Turn Check (in Electron DevTools `Ctrl+Shift+I`):**
   - Start Voice Mode, verify `[LUX_PERF]` logs on a clean Turkish utterance (`"Bugün hava nasıl?"` and `"Masaüstüne test klasörü oluştur"`).
   - Inspect stderr/JSON timing from `scripts/voice_service.py` + Network tab (`text/event-stream` TTFB).
3. **Pass Thresholds (`talimat.md:125-133, 211`):**
   - `VAD hangover` `< 550 ms` (or `< 200 ms` on Native Audio WebSocket)
   - `STT` `< 300 ms` (or `0 ms` separate hop via Native Audio)
   - **`LLM TTFT < 500 ms`** (`100` tokens `< 1,000 ms`)
   - `TTS first audio < 300 ms`
   - **`FIRST_AUDIO_E2E < 1,500 ms`**, audit score **`>= 85–90/100`**.

---

## 9. Appendix: All `file:line` References and Raw Log Excerpts

### A. Verified `file:line` Index

- **Entry & Electron Boot:** [start_lux_ai.bat:1-3](file:///c:/Users/SERVER/Desktop/LUX_ai/start_lux_ai.bat#L1-L3); [package.json:19-25](file:///c:/Users/SERVER/Desktop/LUX_ai/package.json#L19-L25); [index.html:10-12](file:///c:/Users/SERVER/Desktop/LUX_ai/src/index.html#L10-L12) (Google Fonts), `L511-522` (sync scripts incl. `monaco-editor/min/vs/loader.js` @ `L517`); [app.js:5-34](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/app.js#L5-L34) (`DOMContentLoaded` + `discoverLocalAIModels` at `150ms`), `L100-150` (`KNOWN_PROVIDER_SUBMODELS`), `L225-239` (`ensureOllama` auto-start); [ideMode.js:177-241](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/ideMode.js#L177-L241) (`ensureMonaco`); [preload.js:1-75](file:///c:/Users/SERVER/Desktop/LUX_ai/src/preload.js#L1-L75).
- **Defaults & State:** [store.js:23-48](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/store.js#L23-L48) (`DEFAULT_MODELS`: Ollama `qwen2.5:7b` + OpenRouter `openrouter/free`), `L70-125` (`DEFAULT_STATE`: `voice: "Fola"`, `sttEngine: "auto"`, `engineMode: "auto"`), `L377-384` (`localStorage.setItem("lux_ai_state_v2")`).
- **Main Process & IPC:** [main.js:72-115](file:///c:/Users/SERVER/Desktop/LUX_ai/main.js#L72-L115) (`ensureOllamaRunning`: `16 x 400ms`), `L256-277` (`storage-load/save`), `L486-495` (`fs-list-desktop-projects`), `L994-1094` (`resolveVoicePython` + persistent `getVoiceProcess()`), `L1149-1282` (`voice-transcribe` & `voice-synthesize` temp-file + Base64 I/O).
- **Tools & File Scanning:** [agent_capabilities.js:117-196](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/agent_capabilities.js#L117-L196) (`listDesktopProjects` sync `readdirSync`), `L905-941` (`runPsScript` / `captureScreenWithPowershell` spawns `powershell.exe`).
- **Chat Engine & Tool Loop:** [chat.js:22-284](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/chat.js#L22-L284) (`renderChat` full `innerHTML` rebuild), `L468-707` (`LUX_OPENAI_TOOLS`), `L1555-1597` (`buildAgentSystemPrompt` + cloud skips `selectToolsForPrompt`), `L1664-1711` (`maybePreloadWorkspaceContextForPrompt` calls `refreshDesktopProjectsCache()` again at `L1671`), `L1953-1998` (`callModelWithFallback` silently hits CPU Ollama), `L2040-2061` (`splitSpeechSentencesForStreaming`), `L2754-3000` (`maybeRecoverMissingActionOrRefusal`), `L3162-3186` (pre-LLM sync chain), `L3250-3474` (TTS sentence loop + `30ms`/`20ms` `setInterval`), `L3654-3685` (Gemini `:generateContent`), `L3730-3784` (Ollama `stream: false`, `num_ctx: 4096/6144`), `L3786-4052` (OpenAI/OpenRouter/DeepSeek/9Router `res.json()` + `429` retry), `L4054-4135` (Anthropic `res.json()`), `L4187-4230` (`DOMParser` Markdown sanitizer).
- **Voice Capture, VAD & Python Services:** [voice.js:353-466, 1930-1932](file:///c:/Users/SERVER/Desktop/LUX_ai/src/js/voice.js#L353-L358) (duplicate `DOMContentLoaded` call), `L509-513` (`warmup` call), `L610, 660` (`1500ms`/`750ms` barge-in), `L742-945` (`ScriptProcessorNode(1024)`, `420/180ms` gate, `1550ms` silence timeout), `L1023-1098` (WAV encode + Base64 + batch STT), `L1237-1291` (`speakAssistantResponse` + `300ms` `setTimeout` @ `L1273`), `L1870-1901` (dictation `2048` buffer / `1650ms`); [voice_service.py:167-315](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/voice_service.py#L167-L315) (Piper/Kokoro/OpenRouter maps & Edge aliases), `L454-488` (Whisper CPU `int8` & eviction), `L579-650` (XTTS worker pipe), `L822-1040` (Whisper `beam_size=5` 2-pass, Moonshine, Google norm temp-WAV), `L1301-1635` (OpenRouter `urlopen`, Piper, Kokoro, XTTS, Edge `comm.save()`), `L1680-1721` (`warmup_models` `Fola -> Piper` bug); [xtts_worker.py:101-213](file:///c:/Users/SERVER/Desktop/LUX_ai/scripts/xtts_worker.py#L101-L213).

### B. Raw Benchmark & Diagnostic Excerpts (Sanitized — Zero API Keys)

#### 1. Redacted Live User Profile (`%APPDATA%\Lux AI\Local Storage\leveldb\000395.log` via `peek_ldb_regex.js`)
```text
=== 000395.log (utf16le) ===
[
  '"selectedModel":"OpenRouter"',
  '"selectedMode":"Turbo"',
  '"autoHeal":true',
  '"voice":"Piper-Fahrettin"',
  '"sttEngine":"moonshine-base"',
  '"engineMode":"online"',
  '"streamingTts":true',
  '"name":"OpenRouter","provider":"OpenRouter","modelId":"nvidia/nemotron-3-ultra-550b-a55b:free"',
  '"openrouterApiKey":[SET]'
]
```

#### 2. Isolated Ollama CPU Benchmarks (`task-9843.log`, `D:\LuxAI_Models\ollama`, `Xeon E3-1245 v5`)
```text
--- HARDWARE / GPU DISCOVERY ---
inference compute id=cpu library=cpu name=cpu total="39.9 GiB" available="24.0 GiB"
default_num_ctx=4096 | CPU: Intel(R) Xeon(R) CPU E3-1245 v5 @ 3.50GHz | n_threads = 4 / 8
size_vram=0 (100% CPU RAM allocation: CPU model=1483.7 MiB, CPU_REPACK=2976.8 MiB, KV=224.0 MiB)

--- BENCHMARK RESULTS ---
1. qwen2.5:7b (DEFAULT, stream: false, NO tools, COLD)   : total=93924 ms (ttft=93924 ms, load=49074 ms, promptEval=25712 ms [390 tok], eval=19118 ms [55 tok], 2.88 tok/s)
2. qwen2.5:7b (WARM, stream: false, WITH 9 tools)         : total=38002 ms (ttft=38002 ms, load=19 ms, promptEval=29630 ms [808 tok], eval=8334 ms [24 tok], 2.88 tok/s)
3. qwen2.5:7b (WARM, stream: true, NO tools)              : total=18512 ms (ttft=2678 ms, load=21 ms, promptEval=2607 ms [390 tok], eval=15834 ms [46 tok], 2.91 tok/s)
4. qwen2.5:3b (COLD, stream: false, NO tools)             : total=19965 ms (ttft=19965 ms, load=4252 ms, 6.22 tok/s)
5. qwen2.5:3b (WARM, stream: false, WITH 9 tools)         : total=17860 ms (ttft=17860 ms, promptEval=12717 ms [808 tok], eval=5120 ms [31 tok], 6.05 tok/s)
6. qwen2.5:3b (WARM, stream: true, NO tools)              : total=7405 ms  (ttft=1115 ms, 5.27 tok/s)
7. qwen3:8b   (COLD, think: false, stream: false)         : total=95214 ms (load=50960 ms, 2.44 tok/s)
8. qwen3:8b   (WARM, think: true, stream: true)           : total=46607 ms (ttft=1887 ms, eval=45543 ms [120 tok], 2.63 tok/s)
9. qwen3.5:4b (COLD, think: false, stream: false)         : total=53498 ms (load=27795 ms, 4.04 tok/s)
10. qwen3.5:4b (WARM, think: false, stream: true)         : total=14465 ms (ttft=455 ms, 3.85 tok/s)
11. qwen2.5:14b (COLD, stream: true)                      : aborted at 90,000 ms timeout
```

#### 3. Isolated Python Voice Service Benchmarks (`task-9609.log` & `task-9728.log`)
```text
[1] SPAWN+STATUS: 343.2 ms | warm subsequent RPC: 3.0 ms

=== TTS BENCHMARKS ===
  piper_cold (DFKI)    : 12775.2 ms | engine=piper-offline (3.78s audio)
  piper_warm (DFKI)    :   177.5 ms | engine=piper-offline (1.76s audio)
  Piper-Fahrettin COLD : 12432.6 ms | engine=piper-offline
  Piper-Fahrettin WARM :   262.7 ms | engine=piper-offline
  edge_cold            :  3555.7 ms | engine=edge-tts
  edge_warm            :  2190.5 ms | engine=edge-tts
  kokoro_cold          : 13759.0 ms | engine=kokoro-onnx
  kokoro_warm          :  3781.2 ms | engine=kokoro-onnx
  XTTS-v2 WARMUP       : 89116.4 ms | SYNTH 1: 30585.3 ms | SYNTH 2: 18608.1 ms

=== STT & WARMUP BENCHMARKS ===
  whisper_base_cold    :  4054.1 ms | warm:  1760.2 ms
  whisper_small_cold   :  7016.5 ms | warm:  6136.7 ms
  whisper_turbo_cold   : 41102.0 ms | warm: 23614.6 ms
  moonshine_cold (EN)  :  5880.4 ms | warm:   475.9 ms
  moonshine_tr (auto)  : 11024.2 ms | eng=faster-whisper-small fallbackFrom=moonshine-empty
  google_stt_tr        :  1505.2 ms | eng=google-cloud
  WARMUP(stt='moonshine-base', voice='Fola'): 17942.3 ms -> {'moonshineLoaded': True, 'piperLoaded': True}  <-- bug!
```

#### 4. Network Handshake & Isolated Electron CDP E2E Metrics (`task-10030.log` & `bench_electron_e2e.js`)
```text
=== NETWORK HANDSHAKES (Turkey -> Cloud APIs) ===
openrouter.ai                   : dns=5ms   tls=164ms  httpGet=284ms (status=200) -> 453ms cold
generativelanguage.googleapis.com: dns=11ms  tls=108ms  httpGet=313ms (status=404) -> 432ms cold
api.openai.com                  : dns=53ms  tls=160ms  httpGet=328ms (status=421) -> 541ms cold
speech.platform.bing.com        : dns=12ms  tls=150ms  httpGet=149ms (status=400) -> 311ms cold

=== ELECTRON CDP E2E BENCHMARK (Isolated --user-data-dir, zero baseline interference) ===
Startup: cdpReady=350ms | domInteractive=626ms | domContentLoaded=641ms | loadEventEnd=1629ms
Slowest Resources: fonts.gstatic.com x3 (932ms, 696ms, 664ms), fonts.googleapis.com CSS (313ms), 4x net::ERR_CONNECTION_REFUSED (localhost ports 11434/1234/20128)
Payload Sizes: systemPrompt=2259 chars (+121 w/ XML) | allTools=16 (6387 B) | localFolderTools=8 (2529 B) | cloud est=~2343 tok before history
IPC Timings: listDesktopProjects() 5x avg=4.9ms (cold 16.5ms; 6 cached projects, called 2x per turn) | voice.getStatus() cold=611.9ms, warm=[3, 3, 3]ms
renderChat() 20-turn (40-msg, 1360 DOM nodes): runs=[39, 13.1, 15.9, 11.2, 13.1, 13.3, 12.2, 11, 14.1, 11.4]ms -> avg=15.43ms, p95=39.0ms (617.2ms/40 ticks)
D:\LuxAI_Models Total: 29,530.8 MB (~28.84 GiB) | RAM Heap after boot: 9.54 MB used / 10.11 MB total
```

---

## 10. Uygulanan Düzeltmeler & Ölçülen Sonuçlar (Faz 2)

> Not: Aşağıdaki tüm **Sonrası** verileri yalnızca izole Python benchmark (`task-10744`) ve temiz geçici profilli Electron CDP E2E benchmark (`task-10917` / `task-10906`) çıktılarından birebir ölçülmüştür; kullanıcının `%APPDATA%\Lux AI` profiline ve açık oturumuna dokunulmamıştır.

### A. Uygulanan Kritik Düzeltmeler
1. **Gerçek LLM Token Akışı & Paralel Cümle-Bazlı TTS (`src/js/chat.js`, `src/js/voice.js`):**
   - Gemini (`:streamGenerateContent?alt=sse`), OpenAI/OpenRouter/DeepSeek (`stream: true` SSE), Anthropic (`stream: true` SSE) ve Ollama (`/api/chat` NDJSON `stream: true`) için gerçek akış desteği eklendi.
   - `createStreamSpeechPipeline()` (`src/js/chat.js`) ile ilk tamamlanan cümle henüz LLM akışı bitmeden paralel olarak `luxAPI.voice.synthesize` kuyruğuna aktarılmaya başlandı.
2. **AudioWorklet + Düşük VAD Beklemesi + Bellek-İçi Ses IPC (`src/js/voice_worklet_processor.js`, `src/js/voice.js`, `main.js`, `scripts/voice_service.py`):**
   - `ScriptProcessorNode` yerine `AudioWorkletNode` (`voice_worklet_processor.js`, `ScriptProcessor` yedekli) ve senkron `encodeWAVBase64()` (`0.7 ms`) eklendi; VAD sessizlik eşiği `1,550 ms → 520 ms` (barge-in `1,500 ms → 650 ms`), son oynatma sonrası `300 ms` yapay gecikme kaldırıldı.
   - `main.js` + `voice_service.py` `returnBase64: true` ile disk geçici dosyası açmadan bellek-içi RIFF WAV / MP3 (`base64`) aktarımı eklendi; `warmup_models` hatası (`Fola` iken Piper yükleme) ve Whisper `beam_size=1, best_of=1` optimizasyonu uygulandı.
3. **Artımlı DOM Streaming & Hızlı Açılış (`src/js/chat.js`, `src/index.html`, `src/css/theme.css`, `src/js/ideMode.js`):**
   - Harici Google Fonts kaldırılıp sistem font yığınına geçildi, `monaco-editor` yalnızca IDE görünümü açıldığında `ensureMonaco()` ile dinamik yüklenecek şekilde ertelendi (`monacoLoadedAtBoot: false`).
   - Akış sırasında tüm sohbeti yeniden çizen `renderChat()` yerine `data-turn-msg-id` hedefli `renderStreamingDelta()` + `rAF` kullanıldı; `refreshDesktopProjectsCache()` eşzamanlı çağrıları tek in-flight promise ile tekilleştirildi.
4. **OpenRouter `HTTP 429` Maskeleme Hatası & Güncel Gemini / Ollama Varsayılanları (`src/js/chat.js`, `src/js/store.js`, `src/js/app.js`, `src/js/modals.js`):**
   - `classifyModelApiError()` / `formatModelApiErrorMessage()` / `callModelWithFallback()` ile OpenRouter `429` günlük kota, `401` anahtar ve `404` hatalarında artık `"seçili model tarafına şu an ulaşılamadı..."` / `"yanıtı tamamladı"` maskesi basılmıyor ve CPU Ollama yedeklemesine düşülmüyor.
   - Emekliye ayrılmış `gemini-2.0-flash` ve `gemini-1.5-*` kimlikleri `gemini-3.5-flash-lite` / `gemini-3.8-flash` / `gemini-2.5-flash` olarak güncellendi (`resolveGeminiModelCode()`, `buildGeminiGenerationConfig()`); `qwen2.5:7b` OOTB yerine `qwen2.5:3b` ve yerel CPU sohbetlerde KV önbelleğini koruyan seçici `selectToolsForPrompt()` eklendi.

### B. Ölçülen Öncesi → Sonrası Karşılaştırması

| Metrik | Faz 1 (Öncesi) | Faz 2 (Sonrası — Ölçülen) | Değişim |
|---|---|---|---|
| **Uygulama Açılışı (`loadEventEnd`)** | `1,629 ms` | **`350 ms`** (`domContentLoaded: 321 ms`) | **`-78.5%` (4.65x hızlı)** |
| **Açılışta Harici Font / Eager Monaco** | 4 harici istek (`932 ms`) + Eager Monaco | **0 harici font** · `monacoLoadedAtBoot: false` (`ensureMonaco: 321 ms`) | Tamamen ortadan kalktı |
| **40-Mesaj Akış DOM Güncelleme** | Ort `15.43 ms` · p95 `39.0 ms` (`617.2 ms`/40 tik) | Ort **`2.78–4.47 ms`** · p95 **`2.5–6.4 ms`** (`111.2–178.7 ms`/40 tik, önceki düğümler korunur) | **`-%71 ila -%82` CPU** |
| **Warmup (`Fola`, `moonshine-base`, `auto`)** | `17,942.3 ms` (`piperLoaded: True` hatası) | **`9,451.2 ms`** (`piperLoaded: False`); `google-cloud` ile **`79.7 ms`** | **`-47.3%`** / online **`-99.6%`** |
| **Edge-TTS (`Fola`) Bellek-İçi Sentez** | Soğuk `3,555.7 ms` · Sıcak `2,190.5 ms` | Soğuk **`1,346.1 ms`** · Sıcak **`1,217.2 ms`** (`file: None`) | **Soğuk `-62%` · Sıcak `-44%`** |
| **Piper (`Fahrettin`) Bellek-İçi Sentez** | Soğuk `12,432.6 ms` · Sıcak `262.7 ms` | Soğuk `10,693.7 ms` · Sıcak **`117.2 ms`** (`file: None`) | **Sıcak `-55.4%`** |
| **Faster-Whisper `small` (TR) / Google STT** | Whisper warm `6,136.7 ms` · Google `1,505.2 ms` | Whisper warm **`3,516.8 ms`** (`beam=1`) · Google **`958.3 ms`** | **Whisper `-42.7%` · Google `-36.3%`** |
| **VAD Sessizlik & Kuyruk Beklemesi** | `1,550 ms` VAD + `300 ms` kuyruk | **`520 ms` VAD** (`0 ms` yapay kuyruk) | **`-1,330 ms`** sabit eşik |
| **Yerel Ollama (`qwen2.5:3b`) Uçtan Uca** | Soğuk `93,924 ms` / Sıcak `38,002 ms` (`qwen2.5:7b` araçlı, `stream: false`) | Soğuk `28,054 ms` (`qwen2.5:3b`) · Sıcak TTFT **`2,392 ms`** / Toplam **`5,133 ms`** | **Sıcak TTFT `-93.7%` · Toplam `-86.5%`** |
| **Sesli Akış → TTS Paralel Hat (Hızlı SSE + Sıcak Piper)** | LLM tamamen bitene kadar TTS başlamıyordu | `ttftMs: 203 ms`, **`ttsFirstChunkMs: 348 ms`** (< `llmTotalMs: 487 ms`), **`firstAudioE2eMs: 833 ms`** (hedef `< 1,500 ms`) | Gerçek paralel ses çıkışı (`< 850 ms`) |

> **Önemli Not:** Açık olan mevcut Lux AI penceresi eski JavaScript/IPC/Python sürecini bellekte tuttuğu için yalnızca `Ctrl+R` yeterli olmaz; değişikliklerin aktif olması için uygulamanın tamamen kapatılıp yeniden başlatılması gerekir.
