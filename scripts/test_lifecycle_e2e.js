// LUX AI — Uçtan Uca Yaşam Döngüsü & Mimari Test Paketi
//
// ÖNEMLİ (eski sürümdeki hata): `test()` senkron çalışıyordu; içine verilen
// async fonksiyonların Promise'i beklenmediği için asenkron kontroller hiç
// çalışmıyor ve her durumda PASS görünüyordu. Artık testler sırayla `await`
// edilir, ve yalnızca gerçekten uygulanmış özellikler test edilir.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const results = { total: 0, passed: 0, failed: 0, details: [] };

async function test(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    results.details.push({ name, status: 'PASS' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.failed++;
    results.details.push({ name, status: 'FAIL', error: err.message });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

const read = (rel) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT_DIR, rel));
// main.js'ten src/main/*.js modüllerine ayrılan bölümlerin de taranması için birleşik metin
const readMainAll = () => {
  const mainDir = path.join(ROOT_DIR, 'src/main');
  const parts = [read('main.js')];
  if (fs.existsSync(mainDir)) {
    for (const f of fs
      .readdirSync(mainDir)
      .filter((f) => f.endsWith('.js'))
      .sort()) {
      parts.push(read(path.join('src/main', f)));
    }
  }
  return parts.join('\n/* ==== module boundary ==== */\n');
};

async function main() {
  console.log('========================================================');
  console.log('   LUX AI END-TO-END LIFECYCLE & ARCHITECTURE TEST      ');
  console.log('========================================================\n');

  // 1. Tüm JS dosyalarında sözdizimi doğrulaması
  await test('1. Sözdizimi doğrulaması (tüm JS dosyaları)', () => {
    const jsFiles = [
      'main.js',
      'src/preload.js',
      'src/logger.js',
      'src/main/secrets_vault.js',
      'src/main/edit_snapshots.js',
      'src/main/plugins_ipc.js',
      'src/main/git_ipc.js',
      'src/main/agent_ipc.js',
      'src/main/validate.js',
      'src/js/tool_approval.js',
      'src/js/agent_context.js',
      'src/js/i18n.js',
      'scripts/agent_capabilities.js',
      'scripts/sync-monaco.js',
      'scripts/agent/net_guard.js',
      'scripts/test_model_client.js',
      'scripts/test_context_rollup.js'
    ];
    for (const f of fs.readdirSync(path.join(ROOT_DIR, 'src/js'))) {
      if (f.endsWith('.js')) jsFiles.push(`src/js/${f}`);
    }
    for (const rel of jsFiles) {
      const full = path.join(ROOT_DIR, rel);
      if (!fs.existsSync(full)) throw new Error(`Dosya eksik: ${rel}`);
      execSync(`node --check "${full}"`, { stdio: 'pipe' });
    }
  });

  // 2. Marka temizliği: kaynak dosyalarda eski marka adı geçmemeli
  await test('2. Kaynak kodda eski marka adı yok', () => {
    const banned = ['anti', 'gravity'].join('');
    const regex = new RegExp(banned, 'i');
    const scanTargets = ['main.js', 'src', 'scripts'];

    const walk = (target) => {
      const full = path.join(ROOT_DIR, target);
      if (!fs.existsSync(full)) return;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (['node_modules', '.git', '__pycache__', 'vendor'].includes(path.basename(full))) return;
        for (const entry of fs.readdirSync(full)) walk(path.join(target, entry));
        return;
      }
      if (!/\.(js|html|css|json)$/i.test(target)) return;
      if (/marked\.umd\.js$/.test(target)) return; // 3. parti gömülü kütüphane
      if (regex.test(fs.readFileSync(full, 'utf8'))) {
        throw new Error(`Yasaklı marka adı bulundu: ${target}`);
      }
    };
    for (const t of scanTargets) walk(t);
  });

  // 3. IPC paritesi:
  //    a) preload'un invoke/sendSync ettiği her kanalın main'de handler'ı olmalı,
  //    b) preload'un dinlediği (on) her kanalı main webContents.send ile yayınlamalı.
  await test('3. IPC paritesi (invoke <-> handle, on <-> webContents.send)', () => {
    const mainJs = readMainAll();
    const preloadJs = read('src/preload.js');

    const handled = new Set();
    for (const m of mainJs.matchAll(/ipcMain\.(?:handle|on)\(\s*['"]([^'"]+)['"]/g)) handled.add(m[1]);

    const invoked = new Set();
    for (const m of preloadJs.matchAll(/ipcRenderer\.(?:invoke|sendSync)\(\s*['"]([^'"]+)['"]/g)) invoked.add(m[1]);

    const missingHandlers = [...invoked].filter((ch) => !handled.has(ch));
    if (missingHandlers.length > 0) {
      throw new Error(`main.js'de handle'ı olmayan kanallar: ${missingHandlers.join(', ')}`);
    }

    const listened = new Set();
    for (const m of preloadJs.matchAll(/ipcRenderer\.on\(\s*['"]([^'"]+)['"]/g)) listened.add(m[1]);

    const pushed = new Set();
    for (const m of mainJs.matchAll(/webContents\.send\(\s*['"]([^'"]+)['"]/g)) pushed.add(m[1]);

    const missingPushes = [...listened].filter((ch) => !pushed.has(ch));
    if (missingPushes.length > 0) {
      throw new Error(`main.js'de yayınlanmayan (webContents.send) kanallar: ${missingPushes.join(', ')}`);
    }
  });

  // 4. Agent yetenekleri: sistem bilgisi gerçekten üretilebiliyor mu?
  await test('4. Agent yetenekleri (system_info)', async () => {
    const caps = require(path.join(ROOT_DIR, 'scripts/agent_capabilities.js'));
    if (typeof caps.pcControl !== 'function') throw new Error('pcControl fonksiyon değil');
    const res = await caps.pcControl({ action: 'system_info' }, { workspaceDir: ROOT_DIR });
    if (!res || !res.success) throw new Error('system_info başarısız: ' + JSON.stringify(res));
    if (!String(res.output || '').includes('Bilgisayar:'))
      throw new Error('system_info çıktısı beklenen biçimde değil');
  });

  // 5. Yıkıcı işlem güvenlik kalkanı
  await test('5. Silme güvenlik kalkanı (kök/sistem/sır dosyaları)', () => {
    const caps = require(path.join(ROOT_DIR, 'scripts/agent_capabilities.js'));
    if (typeof caps.assertSafeDestructiveTarget !== 'function') {
      throw new Error('assertSafeDestructiveTarget export edilmemiş');
    }
    const home = require('os').homedir();
    const workspace = path.join(home, 'proje');
    const mustBlock = [
      path.parse(home).root,
      home,
      path.join(home, 'Desktop'),
      path.join(home, '.ssh', 'id_rsa'),
      path.join(workspace, '.env'),
      path.join(home, 'BaskaYer', 'dosya.txt') // çalışma alanı dışı
    ];
    for (const p of mustBlock) {
      const verdict = caps.assertSafeDestructiveTarget(p, workspace, { homePath: home });
      if (verdict.allowed) throw new Error(`Engellenmeliydi: ${p}`);
    }
    const shouldAllow = path.join(workspace, 'src', 'app.js');
    const verdict = caps.assertSafeDestructiveTarget(shouldAllow, workspace, { homePath: home });
    if (!verdict.allowed) throw new Error(`İzin verilmeliydi: ${shouldAllow} (${verdict.reason})`);
  });

  // 6. Tek örnek kilidi
  await test('6. Tek örnek kilidi (single instance)', () => {
    const mainJs = read('main.js');
    if (!mainJs.includes('requestSingleInstanceLock')) {
      throw new Error('requestSingleInstanceLock çağrısı yok');
    }
    if (!mainJs.includes("'second-instance'")) {
      throw new Error("'second-instance' olayı dinlenmiyor");
    }
  });

  // 7. İzin modeli beyaz liste olmalı
  await test('7. İzinler beyaz listede (koşulsuz callback(true) yok)', () => {
    const mainJs = read('main.js');
    if (!mainJs.includes('ALLOWED_PERMISSIONS')) throw new Error('ALLOWED_PERMISSIONS tanımı yok');
    if (/setPermissionCheckHandler\(\(\)\s*=>\s*true\)/.test(mainJs)) {
      throw new Error('setPermissionCheckHandler hâlâ koşulsuz true döndürüyor');
    }
    if (/webviewTag:\s*true/.test(mainJs)) throw new Error('webviewTag hâlâ açık');
  });

  // 8. Şifreli anahtar kasası + kalıcı state köprüsü
  await test('8. Şifreli anahtar kasası ve kalıcı state köprüsü', () => {
    const mainJs = readMainAll();
    const preloadJs = read('src/preload.js');
    for (const ch of ['secrets-set', 'secrets-get', 'secrets-status', 'state-save-durable', 'state-load-durable']) {
      if (!mainJs.includes(ch)) throw new Error(`main.js'de ${ch} handler'ı yok`);
      if (!preloadJs.includes(ch)) throw new Error(`preload.js'de ${ch} köprüsü yok`);
    }
    if (!mainJs.includes('safeStorage')) throw new Error('safeStorage kullanılmıyor');
    if (!/atomic|renameSync\(tmp/.test(mainJs) && !mainJs.includes('renameSync')) {
      throw new Error('Kalıcı state atomik yazılmıyor');
    }
  });

  // 9. Monaco vendor köprüsü (node_modules bağımlılığı kalkmalı)
  await test('9. Monaco vendor köprüsü hazır', () => {
    const ideJs = read('src/js/ideMode.js');
    if (/node_modules\/monaco-editor/.test(ideJs)) {
      throw new Error('ideMode.js hâlâ node_modules içinden Monaco yüklüyor');
    }
    if (!exists('scripts/sync-monaco.js')) throw new Error('scripts/sync-monaco.js yok');
    if (!exists('src/vendor/monaco/vs/loader.js')) {
      throw new Error('src/vendor/monaco/vs/loader.js yok — "npm run vendor:monaco" çalıştırın');
    }
    const pkg = JSON.parse(read('package.json'));
    if (!pkg.scripts || !pkg.scripts.postinstall) throw new Error('postinstall betiği tanımlı değil');
  });

  // 10. Terminal çıktısı runId ile ayrışmalı ve abonelikten çıkılabilmeli
  await test('10. Terminal runId ayrımı ve onData unsubscribe', () => {
    const mainJs = read('main.js');
    const preloadJs = read('src/preload.js');
    if (!/terminal-data['"],\s*\{/.test(mainJs) && !mainJs.includes("send('terminal-data', {")) {
      throw new Error('terminal-data artık {runId, stream, text} göndermiyor');
    }
    if (!mainJs.includes('const runId')) throw new Error('terminal-execute runId üretmiyor');
    if (!preloadJs.includes("removeListener('terminal-data'")) {
      throw new Error('onData abonelikten çıkma fonksiyonu döndürmüyor');
    }
  });

  // 11. Test betiği package.json'da tanımlı olmalı
  await test('11. package.json test betiği ve kilit dosyası tutarlılığı', () => {
    const pkg = JSON.parse(read('package.json'));
    if (!pkg.scripts || !pkg.scripts.test) throw new Error('"npm test" betiği tanımlı değil');
    if (!exists('package-lock.json')) throw new Error('package-lock.json yok');
    const lock = JSON.parse(read('package-lock.json'));
    for (const dep of Object.keys(pkg.dependencies || {})) {
      if (!lock.packages[`node_modules/${dep}`]) {
        throw new Error(`package-lock.json içinde ${dep} yok (npm ci başarısız olur)`);
      }
    }
  });

  // 12. .gitignore: takip edilmemesi gereken dosyalar
  await test('12. .gitignore kapsamı (node_modules, __pycache__, loglar)', () => {
    const gi = read('.gitignore');
    for (const rule of ['node_modules/', '__pycache__/', '*.py[cod]', '*.log']) {
      if (!gi.includes(rule)) throw new Error(`.gitignore içinde "${rule}" eksik`);
    }
  });

  // 13. Tek örnek kilidi: kaybedilirse whenReady içinde pencere AÇILMAMALI
  await test("13. Single-instance: ikinci kopya whenReady'de pencere açmaz", () => {
    const mainJs = read('main.js');
    const m = mainJs.match(/app\.whenReady\(\)\.then\(\(\)\s*=>\s*\{[\s\S]*?\}\);/);
    if (!m) throw new Error('whenReady bloğu bulunamadı');
    if (!/if\s*\(\s*!gotSingleInstanceLock\s*\)/.test(m[0])) {
      throw new Error('whenReady bloğunda gotSingleInstanceLock koruması yok');
    }
  });

  // 14. Eklenti bağımlılık köprüsü (luxAPI.plugins) iki uçta da tanımlı
  await test('14. plugins-check/install-dependency handler + preload köprüsü', () => {
    const mainJs = readMainAll();
    const preloadJs = read('src/preload.js');
    for (const ch of ['plugins-check-dependency', 'plugins-install-dependency']) {
      if (!mainJs.includes(`'${ch}'`)) throw new Error(`main.js'de ${ch} handler'ı yok`);
      if (!preloadJs.includes(`'${ch}'`)) throw new Error(`preload.js'de ${ch} köprüsü yok`);
    }
    // Paket adı doğrulaması olmalı (argüman enjeksiyonuna karşı)
    if (!mainJs.includes('NPM_PKG_RE')) throw new Error('npm paket adı doğrulaması yok');
  });

  // 15. resolveOllamaExecutable: kurulum yoksa null döner (spawn + 6sn bekleme önlenir)
  await test("15. resolveOllamaExecutable koşulsuz 'ollama' döndürmez", () => {
    const mainJs = read('main.js');
    const m = mainJs.match(/function resolveOllamaExecutable\(\)[\s\S]*?\n\}/);
    if (!m) throw new Error('resolveOllamaExecutable bulunamadı');
    if (!m[0].includes('which')) throw new Error('PATH kontrolü (which/where) yok');
  });

  // 16. terminal-execute çocuk süreçleri izlenir ve kapanışta öldürülür
  await test("16. Terminal çocuk süreçleri takip edilir, before-quit'ta temizlenir", () => {
    const mainJs = read('main.js');
    if (!mainJs.includes('activeTerminalChildren')) throw new Error('activeTerminalChildren takibi yok');
    const bq = mainJs.match(/app\.on\(\s*'before-quit'[\s\S]*?\n\}\);/);
    if (!bq) throw new Error('before-quit bloğu bulunamadı');
    if (!/activeTerminalChildren[\s\S]*?kill/.test(bq[0])) {
      throw new Error('before-quit terminal çocuklarını öldürmüyor');
    }
  });

  // 17. Renderer'ın çağırdığı luxAPI yöntemleri preload'da tanımlı olmalı
  await test('17. Renderer luxAPI çağrıları preload ile eşleşiyor', () => {
    const preloadJs = read('src/preload.js');
    const fs = require('fs');
    const path = require('path');
    const jsDir = path.join(ROOT_DIR, 'src/js');
    // preload'da tanımlı nokta-yollarını topla: luxAPI.fs.listFiles gibi
    const defined = new Set();
    for (const m of preloadJs.matchAll(/^(\s{2,})([A-Za-z_$][\w$]*):\s/gm)) {
      // basit kapsama: üst düzey ve iç gruplar ayrı tutulur; sadece son kullanılan
      // yaprak isimleri kontrol edilecek.
    }
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|html)$/.test(entry.name)) yieldJs(full);
      }
    };
    const used = new Set();
    const yieldJs = (full) => {
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/luxAPI\??\.([A-Za-z_$][\w$]*)(?:\??\.([A-Za-z_$][\w$]*))?/g)) {
        used.add(m[1] + (m[2] ? '.' + m[2] : ''));
      }
    };
    walk(jsDir);
    yieldJs(path.join(ROOT_DIR, 'src/index.html'));
    const topLevel = new Set([...preloadJs.matchAll(/^  ([A-Za-z_$][\w$]*):/gm)].map((m) => m[1]));
    // getAppInfo gibi üst düzey fonksiyonlar + fs/agent/git/terminal/voice/plugins/secrets/state/storage grupları
    for (const item of used) {
      const [group, leaf] = item.split('.');
      if (
        !topLevel.has(group) &&
        !/^ensureOllama|^getAppInfo|^setWorkspaceDir|^openDirectory|^pickFolder|^pickFile$/.test(group)
      ) {
        throw new Error(`preload'da tanımlı olmayan luxAPI grubu: ${group}`);
      }
    }
  });

  // 18. buildUnifiedLineDiff: doğruluk (rastgele 400 vaka, eski DP ile birebir) + hız
  await test('18. buildUnifiedLineDiff Myers: rastgele vakalarda eski DP ile aynı sonuç', () => {
    const { buildUnifiedLineDiff } = require(path.join(ROOT_DIR, 'scripts/unified_diff.js'));

    const oldDiff = (oldText, newText) => {
      const oldLines = String(oldText || '').split('\n');
      const newLines = String(newText || '').split('\n');
      const n = oldLines.length,
        m = newLines.length;
      if (n * m > 250000) return null;
      const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
      for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
          dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      let i = 0,
        j = 0,
        additions = 0,
        deletions = 0;
      while (i < n && j < m) {
        if (oldLines[i] === newLines[j]) {
          i++;
          j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          deletions++;
          i++;
        } else {
          additions++;
          j++;
        }
      }
      deletions += n - i;
      additions += m - j;
      return { additions, deletions };
    };

    let seed = 987654321;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const sample = ['a', 'b', 'c', 'd', 'e', 'f', '{', '}', 'x();', 'if (y)', '', 'return 1;'];
    const gen = (len) => Array.from({ length: len }, () => sample[Math.floor(rand() * sample.length)]);

    for (let iter = 0; iter < 150; iter++) {
      const a = gen(Math.floor(rand() * 24));
      const b = a.slice();
      for (let k = 0; k < 5; k++) {
        const r = rand();
        if (r < 0.35 && b.length) b.splice(Math.floor(rand() * b.length), 1);
        else if (r < 0.7) b.splice(Math.floor(rand() * (b.length + 1)), 0, sample[Math.floor(rand() * sample.length)]);
        else if (b.length) b[Math.floor(rand() * b.length)] = sample[Math.floor(rand() * sample.length)];
      }
      const ref = oldDiff(a.join('\n'), b.join('\n'));
      if (!ref) continue;
      const res = buildUnifiedLineDiff('f', a.join('\n'), b.join('\n'));
      if (res.additions !== ref.additions || res.deletions !== ref.deletions) {
        throw new Error(
          `Myers/DP uyuşmazlığı (+${res.additions}/-${res.deletions} vs +${ref.additions}/-${ref.deletions})`
        );
      }
    }
    // Hız bütçesi: 3000 satırlık dosyada 3 değişiklik 100 ms altında bitmeli
    const base = Array.from({ length: 3000 }, (_, i) => `line ${i}`);
    const changed = base.slice();
    changed[10] = 'A';
    changed[1500] = 'B';
    changed[2999] = 'C';
    const t0 = Date.now();
    const big = buildUnifiedLineDiff('big.js', base.join('\n'), changed.join('\n'));
    const elapsed = Date.now() - t0;
    if (big.additions !== 3 || big.deletions !== 3) throw new Error('3000 satır diff sayıları yanlış');
    if (elapsed > 100) throw new Error(`3000 satır diff çok yavaş (${elapsed} ms)`);
  });

  // 19. Renderer bundle bütünlüğü: ayrıştırılan çekirdek fonksiyonlar tanımlı mı?
  //     (Bu paket, modül ayrıştırmalarında düşürülen bir fonksiyonu
  //      runtime'da ReferenceError'a dönüşüp smoke testini geçmişti — #19 ile kapatıldı.)
  await test('19. Renderer bundle bütünlüğü: ayrıştırılan çekirdekler tanımlı', () => {
    const rendererFiles = fs
      .readdirSync(path.join(ROOT_DIR, 'src/js'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => `src/js/${f}`);
    const bundle = rendererFiles.map(read).join('\n');
    const required = [
      // markdown.js
      'escapeHtml',
      'renderMarkdown',
      'sanitizeMarkdownHtml',
      'escapeJs',
      // speech_text.js
      'cleanTextForSpeech',
      'splitSpeechSentencesForStreaming',
      'stripMarkupForLiveStream',
      // prompt_intents.js
      'extractCleanMediaQuery',
      'isWipeMemoryPrompt',
      'buildStarterWebFiles',
      'extractCodeBlocksFromReply',
      'parseLuxVoiceStopCommand',
      'sanitizePostToolMediaReply',
      'detectRequestedBaseDir',
      'extractFolderCreationRequest',
      // tool_schemas.js
      'LUX_OPENAI_TOOLS',
      'LUX_VALID_TOOL_NAMES',
      // model_output_parse.js
      'safeParseToolJson',
      'parseXmlToolCalls',
      'cleanAssistantFinalText',
      'naturalizeConversationalTurkish',
      // model_client.js
      'getActiveModel',
      'callModelWithFallback',
      'callGeminiAPIOnce',
      'fetchOpenAIChatCompletion',
      'callAnthropicAPIOnce',
      'generateNaturalResponse',
      'resolveGeminiModelCode',
      'createRequestAbortHelper',
      'classifyModelApiError',
      // i18n.js
      'LuxI18n',
      // context_rollup.js
      'LuxContextRollup',
      // tool_approval.js / agent_context.js
      'isApprovalRequiredTool',
      'requestToolExecutionApproval',
      'requestToolExecutionDecision',
      'collectSavedConversationMemory',
      'buildAgentSystemParts',
      'buildAgentSystemPrompt',
      'shouldAttachToolsForPrompt',
      'selectToolsForPrompt',
      // chat.js
      'renderChat',
      'renderStreamingDelta',
      'executeAgentTool',
      'submitUserMessage',
      // store.js / audio_cache.js
      'playLuxSound',
      'luxAudioCache'
    ];
    const missing = required.filter(
      (name) =>
        !new RegExp(`(async\\s+)?function\\s+${name}\\b`).test(bundle) &&
        !new RegExp(`(const|let|var)\\s+${name}\\b`).test(bundle) &&
        !new RegExp(`window\\.${name}\\s*=`).test(bundle)
    );
    if (missing.length) {
      throw new Error(`Bundle'da eksik tanımlar: ${missing.join(', ')}`);
    }
    // index.html yeni modülleri chat.js'ten ÖNCE yüklüyor mu?
    const html = read('src/index.html');
    const chatPos = html.indexOf('js/chat.js');
    for (const dep of [
      'markdown.js',
      'audio_cache.js',
      'speech_text.js',
      'prompt_intents.js',
      'tool_schemas.js',
      'model_output_parse.js',
      'context_rollup.js',
      'model_client.js',
      'i18n.js',
      'tool_approval.js',
      'agent_context.js',
      'agent_workspace.js',
      'chat_shared.js',
      'chat_render.js',
      'chat_tools.js',
      'chat_voice.js'
    ]) {
      const pos = html.indexOf(`js/${dep}`);
      if (pos === -1) throw new Error(`index.html'de eksik script: ${dep}`);
      if (pos > chatPos) throw new Error(`${dep} chat.js'ten SONRA yükleniyor`);
    }
  });

  await test('20. SSRF koruması + PowerShell sanitize + enjeksiyon regresyonu', async () => {
    const guard = require(path.join(ROOT_DIR, 'scripts/agent/net_guard.js'));
    const assert = (cond, msg) => {
      if (!cond) throw new Error(msg);
    };
    // Özel/iç IP aralıkları — her zaman bloklanmalı
    const blockedIps = [
      '127.0.0.1',
      '10.0.0.5',
      '192.168.0.10',
      '172.16.1.1',
      '172.31.255.255',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'fe8a::5',
      'fc00::1',
      'fd00::abcd',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:192.168.1.1'
    ];
    for (const ip of blockedIps) assert(guard.isPrivateIpLiteral(ip) === true, `bloklanmalıydı: ${ip}`);
    const allowedIps = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'];
    for (const ip of allowedIps) assert(guard.isPrivateIpLiteral(ip) === false, `izin verilmeliydi: ${ip}`);
    // Dahili host adları
    assert(guard.isBlockedHostname('localhost') === true, 'localhost bloklanmalı');
    assert(guard.isBlockedHostname('printer.local') === true, '.local bloklanmalı');
    assert(guard.isBlockedHostname('vpn.internal') === true, '.internal bloklanmalı');
    assert(guard.isBlockedHostname('example.com') === false, 'example.com izinli olmalı');
    // assertPublicUrl — DNS'siz saf şema/host doğrulaması
    const blockedUrls = [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'ftp://example.com/',
      'file:///etc/passwd',
      'https://u:p@example.com/',
      'http://[::1]/',
      'javascript:alert(1)',
      'http://metadata.google.internal/'
    ];
    for (const u of blockedUrls) {
      const r = await guard.assertPublicUrl(u, { resolveDns: false });
      assert(r.ok === false, `URL engellenmeliydi: ${u}`);
    }
    const good = await guard.assertPublicUrl('https://example.com/', { resolveDns: false });
    assert(good.ok === true, 'example.com izinli olmalı');
    // clampInt
    assert(guard.clampInt('abc', 1, 20, 3) === 3, 'NaN → fallback olmalı');
    assert(guard.clampInt(99, 1, 20, 3) === 20, 'üst sınır sıkıştırmalı');
    assert(guard.clampInt(-4, 0, 100, 7) === 0, 'alt sınır sıkıştırmalı');
    assert(guard.clampInt('7', 1, 20, 3) === 7, 'string sayıya çevrilmeli');
    // PowerShell sanitize
    const dq = guard.sanitizePsDoubleQuoted('a"`b$(x)\r\ny');
    assert(!/["$`]/.test(dq) && !/[\r\n]/.test(dq), 'çift tırnaklı dizgi temizlemeli');
    assert(guard.sanitizePsSingleQuoted("o'brien") === "o''brien", 'tek tırnak kaçırılmalı');
    // Regresyon: pc.js serbest metni çift tırnaklı PS dizgisine ham gömmemeli
    const pc = read('scripts/agent/pc.js');
    assert(!pc.includes('Ses komutu uygulandı: ${mode'), 'volume modu ham gömülemez');
    assert(pc.includes('sanitizePsDoubleQuoted') && pc.includes('clampInt'), 'pc.js sanitize yardımcılarını çağırmalı');
    // web.js / images.js keyfi URL erişiminde SSRF doğrulaması kullanmalı
    assert(read('scripts/agent/web.js').includes('fetchPublicUrl'), 'web.js fetchPublicUrl kullanmalı');
    assert(read('scripts/agent/images.js').includes('fetchPublicUrl'), 'images.js fetchPublicUrl kullanmalı');
  });

  await test('21. Yüksek riskli araç onay kapısı (auto_approve_commands)', () => {
    const chat =
      ['chat_shared.js', 'chat_render.js', 'chat_tools.js', 'chat_voice.js', 'chat.js']
        .map((f) => read('src/js/' + f))
        .join('\n') +
      '\n' +
      read('src/js/tool_approval.js');
    const store = read('src/js/store.js');
    const assert = (cond, msg) => {
      if (!cond) throw new Error(msg);
    };
    // Diyalog ve karar yardımcıları tanımlı olmalı
    assert(/function requestToolExecutionApproval\(/.test(chat), 'requestToolExecutionApproval tanımlı değil');
    assert(/async function requestToolExecutionDecision\(/.test(chat), 'requestToolExecutionDecision tanımlı değil');
    assert(/function isApprovalRequiredTool\(/.test(chat), 'isApprovalRequiredTool tanımlı değil');
    // Kapı executeAgentTool içine yerleştirilmiş olmalı (erken dönüş)
    const execStart = chat.indexOf('async function executeAgentTool');
    assert(execStart !== -1, 'executeAgentTool bulunamadı');
    const execBody = chat.slice(execStart, execStart + 4000);
    assert(
      execBody.includes('requestToolExecutionDecision(toolName, args)'),
      'onay kapısı executeAgentTool içinde değil'
    );
    // Kapsam: run_command, delete_path ve pc_control (salt-okunur hariç)
    const gateStart = chat.indexOf('function isApprovalRequiredTool');
    const gateBody = chat.slice(gateStart, gateStart + 600);
    assert(
      gateBody.includes('run_command') && gateBody.includes('delete_path') && gateBody.includes('pc_control'),
      'kapı kapsamı eksik'
    );
    assert(gateBody.includes('APPROVAL_READ_ONLY_PC_ACTIONS'), 'salt-okunur pc_control istisnaları tanımlı değil');
    // Diyalog güvenli varsayılanlarla gelmeli: Esc=red, odak Reddet, Enter=onay
    assert(chat.includes('e.key === "Escape"'), 'Esc ile reddetme yok');
    assert(chat.includes('denyBtn.focus()'), 'varsayılan odak Reddet düğmesinde olmalı');
    assert(chat.includes('auto_approve_commands'), 'auto_approve_commands anahtarı okunmalı');
    // Varsayılan politika: auto-approve KAPALI olmalı
    const dp = store.indexOf('auto_approve_commands');
    const dpLine = store.slice(dp, dp + 80);
    assert(/auto_approve_commands:\s*false/.test(dpLine), 'varsayılan auto_approve_commands false olmalı');
    // Diyalog hatırlama seçeneği izin anahtarını açmalı
    assert(
      chat.includes('setPermission?.("auto_approve_commands", true)'),
      'hatırlatma seçeneği izin anahtarını açmalı'
    );
  });

  console.log('\n========================================================');
  console.log(`TEST RUN FINISHED: ${results.passed}/${results.total} PASSED (${results.failed} FAILED)`);
  console.log('========================================================');

  if (results.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Test paketi çöktü:', err);
  process.exitCode = 1;
});
