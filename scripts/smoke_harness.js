// Başsız (headless) duman testi: uygulamayı gerçekten açar, renderer konsol
// hatalarını ve temel DOM/API durumunu raporlar.
//
// Kullanım:
//   xvfb-run -a node node_modules/electron/cli.js scripts/smoke_harness.js
//
// CI'da ekran olmayan ortam için xvfb gerekir; Windows'ta doğrudan çalışır.
const { app, BrowserWindow } = require('electron');

const consoleErrors = [];
const consoleWarns = [];

app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (details) => {
    const entry = `${details.sourceId}:${details.lineNumber} ${details.message}`;
    if (details.level === 'error') consoleErrors.push(entry);
    else if (details.level === 'warning') consoleWarns.push(entry);
  });
  contents.on('render-process-gone', (e, details) => {
    consoleErrors.push(`RENDER-PROCESS-GONE ${JSON.stringify(details)}`);
  });
  contents.on('did-fail-load', (e, code, desc, url) => {
    consoleErrors.push(`DID-FAIL-LOAD ${code} ${desc} ${url}`);
  });
});

// Uygulamanın kendi main dosyasını yükle. NOT: electron-builder/asar içinde
// main.js zaten app entry olduğu için bu harness yalnızca geliştirme/CI içindir.
try {
  require('../main.js');
} catch (err) {
  console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, reason: 'Pencere açılmadı' }));
      app.exit(1);
      return;
    }

    let result;
    try {
      result = await win.webContents.executeJavaScript(`(() => {
        const q = (sel) => document.querySelector(sel);
        return {
          title: document.title,
          luxAPI: typeof window.luxAPI,
          secretsApi: typeof window.luxAPI?.secrets?.set,
          stateApi: typeof window.luxAPI?.state?.saveDurable,
          store: typeof window.appStore,
          composer: !!q('#composer-input, textarea'),
          sidebar: !!q('#sidebar-container'),
          overviewPanel: !!q('[data-testid="overview-panel-customize-trigger"]'),
          monacoVendorPresent: true,
          chatHtmlLength: (q('#chat-container') || q('#chat-messages') || q('main') || document.body).innerHTML.length,
          bodyTextSample: document.body.innerText.slice(0, 120).replace(/\\s+/g, ' ')
        };
      })()`);
    } catch (err) {
      result = { error: err.message };
    }

    // Monaco vendor dosyası gerçekten HTTP/file üzerinden erişilebilir mi?
    let monacoOk = false;
    try {
      monacoOk = await win.webContents.executeJavaScript(
        `fetch('vendor/monaco/vs/loader.js').then(r => r.ok).catch(() => false)`
      );
    } catch (_) {}

    const payload = {
      ok: consoleErrors.length === 0 && result && !result.error,
      result,
      monacoVendorFetchable: monacoOk,
      consoleErrors: consoleErrors.slice(0, 15),
      consoleWarnCount: consoleWarns.length,
      consoleWarnSample: consoleWarns.slice(0, 5)
    };
    console.log('SMOKE_RESULT ' + JSON.stringify(payload, null, 2));
    app.exit(payload.ok ? 0 : 1);
  }, 7000);
});
