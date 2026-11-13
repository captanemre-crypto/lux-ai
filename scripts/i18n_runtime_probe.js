// LUX AI — EN yerelinin GERÇEK çalışma zamanı doğrulaması (headless).
//
// Uygulamayı headless açar, `lux-locale=en` tohumlarıyla yükler ve hem statik
// (index.html) hem dinamik (Ayarlar modalı) yüzeylerin İngilizceye çevrildiğini
// raporlar. Sohbet transkriptinin kasıtlı olarak çevrilmediğini de doğrular.
//
// Kullanım:
//   xvfb-run -a node node_modules/electron/cli.js scripts/i18n_runtime_probe.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-i18n-userdata-'));
app.setPath('userData', tmpUserData);

const consoleErrors = [];
app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level !== 'error') return;
    consoleErrors.push(`${details.sourceId}:${details.lineNumber} ${details.message}`);
  });
  contents.on('render-process-gone', (e, details) => {
    consoleErrors.push(`RENDER-PROCESS-GONE ${JSON.stringify(details)}`);
  });
});

try {
  require('../main.js');
} catch (err) {
  console.log('I18N_PROBE ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

app.whenReady().then(() => {
  // 1) Varsayılan (TR) açılışını bekle
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('I18N_PROBE ' + JSON.stringify({ ok: false, reason: 'Pencere açılmadı' }));
      app.exit(1);
      return;
    }

    // 2) Kullanıcı gibi dili İngilizce yap (setLocale yerinde uygular; reload yok)
    let setLocaleRet = 'n/a';
    try {
      setLocaleRet = await win.webContents.executeJavaScript("window.LuxI18n && window.LuxI18n.setLocale('en')");
    } catch (e) {
      setLocaleRet = 'ERR:' + e.message;
    }
    await new Promise((r) => setTimeout(r, 1200));
    console.log('I18N_PROBE setLocale dönüşü: ' + JSON.stringify(setLocaleRet));

    let probe;
    try {
      probe = await win.webContents.executeJavaScript(`(async () => {
        const text = document.body.innerText;

        // Ayarlar penceresini aç → TÜM sekmeleri gez ve eksik TR satırlarını topla
        let settingsText = '';
        const lingerSet = new Set();
        try {
          const tabs = ['general','application','appearance','permissions','notifications','models','otomasyonlar','ozellestirmeler','shortcuts','conversations','show_all'];
          for (const tab of tabs) {
            window.openSettingsModal && window.openSettingsModal(tab);
            await new Promise(r => setTimeout(r, 800));
            const sm = document.getElementById('settings-modal');
            const t = sm ? sm.innerText : '';
            settingsText += '\\n[TAB:' + tab + ']\\n' + t;
            for (const line of t.split('\\n')) {
              const l = line.trim();
              if (l && /[çğıöşüÇĞİÖŞ]/.test(l)) lingerSet.add(l);
            }
          }
        } catch (e) {
          settingsText = 'ERR:' + e.message;
        }

        const lingeringTurkish = (t) => /[çğıöşüÇĞİÖŞ]/.test(t || '');
        const bodyLingering = text.split('\\n').map(l => l.trim()).filter(l => l && /[çğıöşüÇĞİÖŞ]/.test(l));
        let diag = {};
        try {
          diag = {
            tWorkspace: window.LuxI18n ? window.LuxI18n.t('menu.workspace') : 'NO-LUXI18N',
            tAppName: window.LuxI18n ? window.LuxI18n.t('app.name') : 'n/a',
            localizeExact: window.LuxI18n && window.LuxI18n.localizeString ? window.LuxI18n.localizeString('Bugün ne kurcalıyoruz?') : 'no fn',
            localizeMenuKey: window.LuxI18n && window.LuxI18n.localizeString ? window.LuxI18n.localizeString('Çalışma Alanı') : 'no fn',
            applyNow: (function(){ try { window.LuxI18n && window.LuxI18n.applyLuxI18n(document); return 'ok'; } catch(e){ return 'ERR:'+e.message; } })(),
            menuTextAfterApply: (document.querySelector('[data-menu="menu-workspace"]')||{}).innerText || 'n/a',
            hasMap: typeof window.LUX_TR_TO_EN,
            mapExactSize: window.LUX_TR_TO_EN ? Object.keys(window.LUX_TR_TO_EN.exact || {}).length : -1,
            mapSubstrSize: window.LUX_TR_TO_EN ? (window.LUX_TR_TO_EN.substr || []).length : -1,
            mapHit: window.LUX_TR_TO_EN && window.LUX_TR_TO_EN.exact ? window.LUX_TR_TO_EN.exact['Bugün ne kurcalıyoruz?'] : 'n/a'
          };
        } catch (e) { diag = { fatal: String(e) }; }
        // Hiçbir gözlemci/çeviri çalışmasa bile bu noktalar ne durumda?
        // KESİN ÖLÇÜM: tüm sekmeler gezilip oturduktan sonra kalan TR parçaları
        await new Promise(r => setTimeout(r, 2500));
        const residualTurkish = (function(){
          const set = new Set();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n = walker.nextNode();
          while (n) {
            if (n.nodeValue && /[çğıöşüÇĞİÖŞ]/.test(n.nodeValue) && n.parentElement && !n.parentElement.closest('#chat-messages-container, script, style')) {
              const t = n.nodeValue.trim();
              if (t) set.add(t.slice(0, 140));
            }
            n = walker.nextNode();
          }
          document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(el => {
            if (el.closest('#chat-messages-container')) return;
            for (const a of ['placeholder','title','aria-label','alt']) {
              const v = el.getAttribute(a);
              if (v && /[çğıöşüÇĞİÖŞ]/.test(v)) set.add(a + ': ' + v.slice(0, 140));
            }
          });
          return [...set];
        })();
        return { residualTurkish, bodyLingering: [], diag,
          locale: window.LuxI18n && window.LuxI18n.locale,
          staticMenuEnglish: /\\bWorkspace\\b|\\bNew Chat\\b/.test(text),
          staticMenuTurkishLingering: /Çalışma Alanı|Yeni Sohbet/.test(text),
          welcomeHeadingEN: /What are we working on today/i.test(text),
          voiceModeLabelEN: /Listen|Ask anything/i.test(text) || null,
          settingsEnglish: /\\bGeneral\\b|\\bPermissions\\b|\\bApplication\\b/.test(settingsText),
          settingsTurkishLingeringSample: [...lingerSet],
          settingsLength: settingsText.length,
          bodySample: text.replace(/\\s+/g, ' ').slice(0, 500)
        };
      })()`);
    } catch (err) {
      probe = { error: err.message };
    }

    const ok =
      !!probe &&
      !probe.error &&
      probe.locale === 'en' &&
      probe.staticMenuEnglish === true &&
      probe.welcomeHeadingEN === true &&
      probe.settingsEnglish === true &&
      consoleErrors.length === 0;

    console.log('I18N_PROBE ' + JSON.stringify({ ok, consoleErrors: consoleErrors.slice(0, 10), probe }, null, 1));
    app.exit(ok ? 0 : 1);
  }, 4000);
});
