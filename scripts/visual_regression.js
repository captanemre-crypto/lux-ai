// LUX AI — Görsel regresyon kapısı (Linux/xvfb)
//
// Uygulamayı gerçekten açar, deterministik 4 kareyi yakalar ve
// tests/visual/baselines/ altındaki referanslarla piksel düzeyinde karşılaştırır.
// Baseline üretmek/yenilemek için:
//   UPDATE_BASELINES=1 npm run test:visual
//
// Notlar:
//   - Referanslar Linux (DejaVu/freetype) üzerinde üretildi; Windows/macOS'ta
//     yalnız bilgi amaçlı koşar (platforma özgü alt piksel farklarından dolayı
//     karşılaştırma Linux dışında BAŞARISIZ saymaz — yalnız raporlar).
//   - Fark eşiği: %1.0 piksel (VISUAL_MAX_DIFF ile özelleştirilebilir).
//   - tests/visual/output/ klasörü .gitignore'dadır.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-visual-userdata-'));
app.setPath('userData', tmpUserData);
const pkg = require('../package.json');
app.getVersion = () => pkg.version; // dev'de Electron sürümü yerine ürün sürümü

const BASE_DIR = path.resolve(__dirname, '..', 'tests', 'visual', 'baselines');
const OUT_DIR = path.resolve(__dirname, '..', 'tests', 'visual', 'output');
const UPDATE = process.env.UPDATE_BASELINES === '1';
const MAX_DIFF = Number(process.env.VISUAL_MAX_DIFF || '0.010');
const IS_LINUX = process.platform === 'linux';
const STRICT = IS_LINUX; // Linux dışında yalnız raporla, kırıcı olma

fs.mkdirSync(BASE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const consoleErrors = [];
app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 3) consoleErrors.push(`${sourceId}:${line} ${message}`);
  });
});

try {
  require('../main.js');
} catch (err) {
  console.log('VISUAL_RESULT ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

const SHOTS = [];
async function capture(win, name) {
  const img = await win.webContents.capturePage();
  const png = img.toPNG();
  SHOTS.push({ name, png });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), png);
}

function compare({ name, png }) {
  const basePath = path.join(BASE_DIR, `${name}.png`);
  if (UPDATE) {
    fs.writeFileSync(basePath, png);
    return { name, status: 'baseline-yazildi' };
  }
  if (!fs.existsSync(basePath)) {
    return { name, status: 'baseline-yok', fail: STRICT };
  }
  const { PNG } = require('pngjs');
  const pixelmatchMod = require('pixelmatch');
  const pixelmatch = typeof pixelmatchMod === 'function' ? pixelmatchMod : pixelmatchMod.default;
  const base = PNG.sync.read(fs.readFileSync(basePath));
  const cur = PNG.sync.read(png);
  if (base.width !== cur.width || base.height !== cur.height) {
    return {
      name,
      status: `boyut farkı: baseline ${base.width}x${base.height} vs şimdi ${cur.width}x${cur.height}`,
      fail: STRICT
    };
  }
  const diff = new PNG({ width: base.width, height: base.height });
  const mismatch = pixelmatch(base.data, cur.data, diff.data, base.width, base.height, { threshold: 0.22 });
  const ratio = mismatch / (base.width * base.height);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.diff.png`), PNG.sync.write(diff));
  const fail = ratio > MAX_DIFF;
  return { name, status: `%${(ratio * 100).toFixed(2)} piksel farklı (${mismatch} px)`, fail };
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
      // 1) Boş sohbet (açılış durumu)
      await capture(win, 'main-empty');

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
      await capture(win, 'chat-media-chips');

      // 3) Ayarlar > Uygulama (yeni: Güncelleme / Veri & Yedek / Günlükler)
      await run(`window.openSettingsModal && window.openSettingsModal('application')`);
      await wait(500);
      // aşağı kaydır: "Veri & Yedek" + "Günlükler" bölümleri görünsün
      await run(
        `(() => { const body = document.querySelector('#settings-tab-body') || document.querySelector('#settings-tab-title')?.parentElement; if (body) body.scrollTop = body.scrollHeight; })()`
      );
      await wait(250);
      await capture(win, 'settings-data-logs');
      // başa sar: standart görünüm
      await run(
        `(() => { const body = document.querySelector('#settings-tab-body'); if (body) body.scrollTop = 0; })()`
      );
      await wait(250);
      await capture(win, 'settings-application');
      await run(`window.closeSettingsModal && window.closeSettingsModal()`);
      await wait(200);

      // 4) Yüksek riskli araç onay diyaloğu
      await run(
        `(() => { window.requestToolExecutionApproval && window.requestToolExecutionApproval('run_command', { command: 'npm run build -- --production' }); return 'ok'; })()`
      );
      await wait(400);
      await capture(win, 'tool-approval-dialog');
      await run(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

      const results = SHOTS.map(compare);
      const failures = results.filter((r) => r.fail);
      console.log(
        'VISUAL_RESULT ' +
          JSON.stringify(
            {
              ok: failures.length === 0,
              strict: STRICT,
              updateMode: UPDATE,
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
