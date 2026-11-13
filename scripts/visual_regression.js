// LUX AI — Görsel regresyon kapısı (Linux/xvfb)
//
// Uygulamayı gerçekten açar, deterministik kareleri yakalar ve
// tests/visual/baselines/ (TR) ve tests/visual/baselines/en/ (EN) altındaki
// referanslarla piksel düzeyinde karşılaştırır.
//
// Kullanım:
//   node scripts/visual_regression.js          # yalnız TR (varsayılan)
//   node scripts/visual_regression.js --en     # yalnız EN
//   node scripts/visual_regression.js --all    # TR + EN (verify 9. kapı)
//   UPDATE_BASELINES=1 node scripts/visual_regression.js [--en|--all]
//   Baseline üretmek/yenilemek için:
//     UPDATE_BASELINES=1 npm run test:visual
//     UPDATE_BASELINES=1 node scripts/visual_regression.js --en
//
// Notlar:
//   - Referanslar Linux (DejaVu/freetype) üzerinde üretildi; Windows/macOS'ta
//     yalnız bilgi amaçlı koşar (platforma özgü alt piksel farklarından dolayı
//     karşılaştırma Linux dışında BAŞARISIZ saymaz — yalnız raporlar).
//   - Fark eşiği: %1.0 piksel (VISUAL_MAX_DIFF ile özelleştirilebilir).
//   - tests/visual/output/ klasörü .gitignore'dadır.
//   - EN pasosu, TR pasından sonra çift katmanlı sıfırlama ile başlar:
//     localStorage.clear() + luxAPI.storage.wipe() (debounce artıklarını da temizler).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-visual-userdata-'));
app.setPath('userData', tmpUserData);
const pkg = require('../package.json');
app.getVersion = () => pkg.version; // dev'de Electron sürümü yerine ürün sürümü

const BASE_DIR = path.resolve(__dirname, '..', 'tests', 'visual', 'baselines');
const EN_BASE_DIR = path.join(BASE_DIR, 'en');
const OUT_DIR = path.resolve(__dirname, '..', 'tests', 'visual', 'output');
const UPDATE = process.env.UPDATE_BASELINES === '1';
const MAX_DIFF = Number(process.env.VISUAL_MAX_DIFF || '0.010');
const IS_LINUX = process.platform === 'linux';
const STRICT = IS_LINUX; // Linux dışında yalnız raporla, kırıcı olma

const PASSES = process.argv.includes('--all') ? ['tr', 'en'] : process.argv.includes('--en') ? ['en'] : ['tr'];

fs.mkdirSync(BASE_DIR, { recursive: true });
fs.mkdirSync(EN_BASE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const consoleErrors = [];
app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level !== 'error') return;
    consoleErrors.push(`${details.sourceId}:${details.lineNumber} ${details.message}`);
  });
});

try {
  require('../main.js');
} catch (err) {
  console.log('VISUAL_RESULT ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

const SHOTS = [];
async function capture(win, name, locale) {
  const img = await win.webContents.capturePage();
  const png = img.toPNG();
  SHOTS.push({ name, png, locale });
  const outName = locale === 'en' ? `en-${name}.png` : `${name}.png`;
  fs.writeFileSync(path.join(OUT_DIR, outName), png);
}

function compare({ name, png, locale }) {
  const baseDir = locale === 'en' ? EN_BASE_DIR : BASE_DIR;
  const basePath = path.join(baseDir, `${name}.png`);
  const displayName = locale === 'en' ? `en/${name}` : name;
  if (UPDATE) {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(basePath, png);
    return { name: displayName, status: 'baseline-yazildi' };
  }
  if (!fs.existsSync(basePath)) {
    return { name: displayName, status: 'baseline-yok', fail: STRICT };
  }
  const { PNG } = require('pngjs');
  const pixelmatchMod = require('pixelmatch');
  const pixelmatch = typeof pixelmatchMod === 'function' ? pixelmatchMod : pixelmatchMod.default;
  const base = PNG.sync.read(fs.readFileSync(basePath));
  const cur = PNG.sync.read(png);
  if (base.width !== cur.width || base.height !== cur.height) {
    return {
      name: displayName,
      status: `boyut farkı: baseline ${base.width}x${base.height} vs şimdi ${cur.width}x${cur.height}`,
      fail: STRICT
    };
  }
  const outName = locale === 'en' ? `en-${name}.diff.png` : `${name}.diff.png`;
  const diff = new PNG({ width: base.width, height: base.height });
  const mismatch = pixelmatch(base.data, cur.data, diff.data, base.width, base.height, { threshold: 0.22 });
  const ratio = mismatch / (base.width * base.height);
  fs.writeFileSync(path.join(OUT_DIR, outName), PNG.sync.write(diff));
  const fail = ratio > MAX_DIFF;
  return { name: displayName, status: `%${(ratio * 100).toFixed(2)} piksel farklı (${mismatch} px)`, fail };
}

// Deterministik kare akışı — TR/EN arasında ortak. `locale` yalnızca
// karşılaştırma dizini ve çıktı dosya adını belirler; akan js kimlik tabanlıdır.
async function captureShots(win, wait, run, locale) {
  // 1) Boş sohbet (açılış durumu)
  await capture(win, 'main-empty', locale);

  // 2) Sohbet: kullanıcı mesajı + medya çip'li asistan mesajı
  await run(`(() => {
    const conv = window.appStore.getActiveConversation();
    conv.messages.push(
      { id: 'visual-u1', role: 'user', content: 'Şu görseli bul: "lux ai logo"', isStreaming: false, timestamp: 'şimdi' },
      {
        id: 'visual-a1', role: 'assistant', content: 'Bulduğum görseller:', isStreaming: false, timestamp: 'şimdi',
        media: [
          { fileUrl: 'file:///nonexistent/lux-ai-logo-dark.png', localPath: '/nonexistent/lux-ai-logo-dark.png', title: 'lux-ai-logo-dark.png' },
          { fileUrl: 'file:///nonexistent/lux-ai-banner.png', localPath: '/nonexistent/lux-ai-banner.png', title: '' }
        ]
      }
    );
    if (typeof renderChat === 'function') renderChat();
  })()`);
  await wait(400);
  await capture(win, 'chat-media-chips', locale);

  // 3) Ayarlar > Uygulama (yeni: Güncelleme / Veri & Yedek / Günlükler)
  await run(`window.openSettingsModal && window.openSettingsModal('application')`);
  await wait(500);
  // aşağı kaydır: "Veri & Yedek" + "Günlükler" bölümleri görünsün
  await run(
    `(() => { const body = document.querySelector('#settings-tab-body') || document.querySelector('#settings-tab-title')?.parentElement; if (body) body.scrollTop = body.scrollHeight; })()`
  );
  await wait(250);
  await capture(win, 'settings-data-logs', locale);
  // başa sar: standart görünüm
  await run(`(() => { const body = document.querySelector('#settings-tab-body'); if (body) body.scrollTop = 0; })()`);
  await wait(250);
  await capture(win, 'settings-application', locale);
  await run(`window.closeSettingsModal && window.closeSettingsModal()`);
  await wait(200);

  // 4) Yüksek riskli araç onay diyaloğu
  await run(
    `(() => { window.requestToolExecutionApproval && window.requestToolExecutionApproval('run_command', { command: 'npm run build -- --production' }); return 'ok'; })()`
  );
  await wait(400);
  await capture(win, 'tool-approval-dialog', locale);
  await run(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
}

app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('VISUAL_RESULT ' + JSON.stringify({ ok: false, reason: 'Pencere açılmadı' }));
      app.exit(1);
      return;
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = (js) => win.webContents.executeJavaScript(js, true);

    try {
      for (const locale of PASSES) {
        if (locale === 'en') {
          // Çift katmanlı sıfırlama: localStorage + kalıcı kasa/durum dosyası
          // (debounce artıklarının bir sonraki açılışa sızmasını önler)
          await run(`(() => {
            try { localStorage.clear(); } catch (_) {}
            return 'cleared';
          })()`);
          await run(`window.luxAPI?.storage?.wipe ? window.luxAPI.storage.wipe().then(() => 'wiped') : 'no-wipe'`);
          await wait(600);
          await run(`window.luxAPI?.storage?.wipe ? window.luxAPI.storage.wipe().then(() => 're-wiped') : 'no-wipe'`);
          await run(`(() => { try { localStorage.setItem('lux-locale', 'en'); } catch (_) {} return 'locale-en'; })()`);
          // executeJavaScript'ten location.reload() yerine native reload — boot yolu
          // (lux-locale → current=en) yalnız gerçek yeniden yüklemede derlenir.
          win.webContents.reload();
          // uygulama EN locale ile yeniden açılana kadar bekle
          await wait(2600);
        }
        await captureShots(win, wait, run, locale);
      }

      const results = SHOTS.map(compare);
      const failures = results.filter((r) => r.fail);
      console.log(
        'VISUAL_RESULT ' +
          JSON.stringify(
            {
              ok: failures.length === 0,
              strict: STRICT,
              updateMode: UPDATE,
              passes: PASSES,
              consoleErrors,
              results: results.map((r) => ({ name: r.name, status: r.status, fail: Boolean(r.fail) }))
            },
            null,
            2
          )
      );
      app.exit(failures.length === 0 ? 0 : 1);
    } catch (err) {
      console.log('VISUAL_RESULT ' + JSON.stringify({ ok: false, error: String(err.stack || err) }));
      app.exit(1);
    }
  }, 2500);
});
