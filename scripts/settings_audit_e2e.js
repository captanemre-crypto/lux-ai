// LUX AI — AYARLAR DENETİMİ (headless e2e)
//
// Her ayarlar sekmesinin gerçekten render edildiğini, her kontrolün
// LUX store'una etkili olduğunu ve kaydet/yükle döngüsünün
// localStorage + kalıcı JSON dosyası üzerinden uçtan uca çalıştığını doğrular.
//
// Kapsam: 12 çekirdek sekme, tüm toggle/select/slider/automation akışları,
// "Tümünü Etkinleştir/Varsayılana Sıfırla", kalıcı state dosyası (lux_ai_data.json),
// reload sonrası değer korunumu, vault durumu, models kartları, buton varlığı.
//
// Kasıtlı TIKLANMAYANLAR (yıkıcı/etkileşimli): btn-wipe-memory,
// btn-backup-export/import, btn-app-browse-workspace, btn-logs-clear,
// btn-logs-open-folder, btn-vault-rotate, btn-test-chime, btn-check-update,
// model test/kaydet butonları (ağ çağrısı).
//
// Kullanım:
//   xvfb-run -a node node_modules/electron/cli.js scripts/settings_audit_e2e.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-settings-audit-'));
app.setPath('userData', tmpUserData);

const consoleErrors = [];
const seenTabErrors = {};
let currentTab = 'boot';
app.on('web-contents-created', (event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level !== 'error') return;
    // DevTools frontend'inin kendi protokol gürültüsü (app-kodu değil):
    // "Autofill.enable wasn't found" gibi zararsız Electron-iç hatalar.
    if (String(details.sourceId || '').startsWith('devtools://')) return;
    consoleErrors.push(`[${currentTab}] ${details.sourceId}:${details.lineNumber} ${details.message}`);
  });
  contents.on('render-process-gone', (e, details) => {
    consoleErrors.push(`RENDER-PROCESS-GONE ${JSON.stringify(details)}`);
  });
});

try {
  require('../main.js');
} catch (err) {
  console.log('SETTINGS_AUDIT ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: Boolean(cond), ...(detail ? { detail } : {}) });
};

app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('SETTINGS_AUDIT ' + JSON.stringify({ ok: false, reason: 'Pencere açılmadı' }));
      app.exit(1);
      return;
    }
    const execJS = (code) => win.webContents.executeJavaScript(code, true);

    const TABS = [
      'general',
      'application',
      'appearance',
      'permissions',
      'notifications',
      'models',
      'otomasyonlar',
      'ozellestirmeler',
      'shortcuts',
      'conversations',
      'show_all'
    ];

    // ---------- FAZ A: Sekmeler render oluyor mu? ----------
    for (const tab of TABS) {
      currentTab = tab;
      try {
        await execJS(`window.openSettingsModal && window.openSettingsModal(${JSON.stringify(tab)})`);
        await sleep(750);
        const probe = await execJS(`(() => {
          const body = document.getElementById('settings-tab-body');
          const title = document.getElementById('settings-tab-title');
          const desc = document.getElementById('settings-tab-desc');
          const activeBtn = document.querySelector('.settings-nav-btn.active');
          return {
            htmlLen: body ? body.innerHTML.length : -1,
            title: title ? title.textContent.trim() : '',
            desc: desc ? desc.textContent.trim() : '',
            activeTab: activeBtn ? activeBtn.getAttribute('data-tab') : null,
            bodyChildCount: body ? body.children.length : 0
          };
        })()`);
        check(`tab:${tab} render`, probe.htmlLen > 300 && probe.bodyChildCount >= 1, JSON.stringify(probe));
        check(`tab:${tab} nav-aktif`, probe.activeTab === tab, `active=${probe.activeTab}`);
        check(`tab:${tab} placeholder-değil`, !/tasarlanacaktır/i.test(probe.desc), probe.desc.slice(0, 60));
      } catch (err) {
        check(`tab:${tab} render`, false, String(err && err.message ? err.message : err));
      }
    }

    // ---------- FAZ B: Toggle/select/slider → store roundtrip ----------
    currentTab = 'phase-b';
    const flipChecks = [
      { id: 'general-auto-heal-toggle', path: 'state.general.autoHeal' },
      { id: 'app-hardware-accel-toggle', path: 'state.application.hardwareAccel' },
      { id: 'app-auto-devtools-toggle', path: 'state.application.autoDevTools' },
      { id: 'notif-agent-toggle', path: 'state.notifications.agentNotifications' },
      { id: 'notif-sound-toggle', path: 'state.notifications.agentSounds' }
    ];
    for (const tabGroup of ['general', 'application', 'notifications']) {
      await execJS(`window.openSettingsModal(${JSON.stringify(tabGroup)})`);
      await sleep(600);
      for (const { id, path } of flipChecks) {
        const before = await execJS(
          `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return { found: false }; return { found: true, checked: el.checked, store: Boolean(${pathOf('window.appStore.' + path)}) }; })()`
        );
        if (!before.found) continue; // bu sekmede olmayan kontrol
        await execJS(`document.getElementById(${JSON.stringify(id)}).click()`);
        await sleep(150);
        const after = await execJS(`Boolean(${pathOf('window.appStore.' + path)})`);
        check(`toggle:${id} flip`, after !== before.store, `store ${before.store} → ${after}`);
        await execJS(`document.getElementById(${JSON.stringify(id)}).click()`);
        await sleep(150);
        const restored = await execJS(`Boolean(${pathOf('window.appStore.' + path)})`);
        check(`toggle:${id} restore`, restored === before.store, `store geri döndü: ${restored}`);
      }
    }
    function pathOf(p) {
      return p;
    }

    // Permissions: tek izin anahtarı + enable-all/reset
    await execJS(`window.openSettingsModal('permissions')`);
    await sleep(750);
    const permBefore = await execJS(`Boolean(window.appStore.getPermissions()['pc_control'])`);
    await execJS(
      `(() => { const el = document.querySelector('.perm-checkbox[data-perm-key="pc_control"]'); if (el) el.click(); })()`
    );
    await sleep(150);
    const permAfter = await execJS(`Boolean(window.appStore.getPermissions()['pc_control'])`);
    check('perm:pc_control flip', permAfter === !permBefore, `${permBefore} → ${permAfter}`);
    await execJS(
      `(() => { const el = document.querySelector('.perm-checkbox[data-perm-key="pc_control"]'); if (el) el.click(); })()`
    );
    await sleep(150);
    const permRestored = await execJS(`Boolean(window.appStore.getPermissions()['pc_control'])`);
    check('perm:pc_control restore', permRestored === permBefore);

    const permsSnapshot = await execJS(`JSON.stringify(window.appStore.getPermissions())`);
    await execJS(`(() => { const el = document.getElementById('btn-perm-enable-all'); if (el) el.click(); })()`);
    await sleep(400);
    const permsAllOn = await execJS(`(() => {
      const p = window.appStore.getPermissions();
      const keys = Object.keys(p).filter(k => k !== 'env_secrets_protection');
      return keys.every(k => Boolean(p[k]));
    })()`);
    check('perm:enable-all hepsini açar', permsAllOn === true);
    await execJS(`(() => { const el = document.getElementById('btn-perm-reset'); if (el) el.click(); })()`);
    await sleep(400);
    const permsAfterReset = await execJS(`JSON.stringify(window.appStore.getPermissions())`);
    check("perm:reset snapshot'a döner", permsAfterReset === permsSnapshot, 'reset sonrası fark var');

    // Appearance: accent swatch değiştir → store güncellenir
    await execJS(`window.openSettingsModal('appearance')`);
    await sleep(600);
    const accentInfo = await execJS(`(() => {
      const btns = [...document.querySelectorAll('.accent-swatch-btn')];
      const current = window.appStore.state.appearance?.accentColor || null;
      const target = btns.map(b => b.getAttribute('data-accent')).find(h => h && h !== current);
      return { count: btns.length, current, target };
    })()`);
    check('accent:swatch sayısı', accentInfo.count >= 3, `adet=${accentInfo.count}`);
    if (accentInfo.target) {
      await execJS(
        `(() => { const el = document.querySelector('.accent-swatch-btn[data-accent="${accentInfo.target}"]'); if (el) el.click(); })()`
      );
      await sleep(200);
      const nowAccent = await execJS(`window.appStore.state.appearance?.accentColor`);
      check('accent:store güncellendi', nowAccent === accentInfo.target, `${accentInfo.current} → ${nowAccent}`);
      if (accentInfo.current) {
        await execJS(
          `(() => { const el = document.querySelector('.accent-swatch-btn[data-accent="${accentInfo.current}"]'); if (el) el.click(); })()`
        );
        await sleep(200);
      }
    }

    // Notifications: volume slider → state + localStorage
    await execJS(`window.openSettingsModal('notifications')`);
    await sleep(600);
    await execJS(`(() => {
      const el = document.getElementById('notif-volume-slider');
      if (!el) return false;
      el.value = '42';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    const vol = await execJS(`window.appStore.state.notifications?.soundVolume`);
    check('notif:slider 42 → store', Number(vol) === 42, `vol=${vol}`);

    // ---------- FAZ C: Automations ekle/aç/kapa/sil ----------
    currentTab = 'otomasyonlar';
    await execJS(`window.openSettingsModal('otomasyonlar')`);
    await sleep(700);
    await execJS(`document.getElementById('btn-toggle-new-automation')?.click()`);
    await sleep(150);
    await execJS(`(() => {
      document.getElementById('new-auto-title').value = 'AUDIT_TEST_AUTOMATION';
      document.getElementById('new-auto-schedule').value = 'Her Gün 09:00';
      const d = document.getElementById('new-auto-desc');
      if (d) d.value = 'settings audit probe';
    })()`);
    await execJS(`document.getElementById('btn-save-new-automation')?.click()`);
    await sleep(300);
    const autoAdded = await execJS(
      `(window.appStore.state.automations || []).some(a => a.title === 'AUDIT_TEST_AUTOMATION')`
    );
    check('automation:ekle', autoAdded === true);
    const autoToggleOk = await execJS(`(() => {
      const chk = [...document.querySelectorAll('.automation-enabled-toggle')].find(c => {
        let node = c;
        for (let i = 0; i < 6 && node; i++) {
          node = node.parentElement;
          if (node && node.textContent.includes('AUDIT_TEST_AUTOMATION')) return true;
        }
        return false;
      });
      if (!chk) return null;
      chk.click();
      return { clicked: true, nowChecked: chk.checked };
    })()`);
    check('automation:toggle bulundu', Boolean(autoToggleOk && autoToggleOk.clicked), JSON.stringify(autoToggleOk));
    await sleep(150);
    const autoDisabled = await execJS(
      `(window.appStore.state.automations || []).find(a => a.title === 'AUDIT_TEST_AUTOMATION')?.enabled`
    );
    check('automation:toggle kapatır', autoDisabled === false, `enabled=${autoDisabled}`);
    await execJS(`(() => {
      const btn = [...document.querySelectorAll('.btn-delete-automation')].find(b => (b.getAttribute('data-auto-id') || '') && true);
      const match = (window.appStore.state.automations || []).find(a => a.title === 'AUDIT_TEST_AUTOMATION');
      const target = [...document.querySelectorAll('.btn-delete-automation')].find(b => b.getAttribute('data-auto-id') === (match && match.id));
      (target || btn)?.click();
    })()`);
    await sleep(300);
    const autoDeleted = await execJS(
      `!(window.appStore.state.automations || []).some(a => a.title === 'AUDIT_TEST_AUTOMATION')`
    );
    check('automation:sil', autoDeleted === true);

    // ---------- FAZ D: Kaydet/yükle kalıcılığı ----------
    currentTab = 'persist';
    await execJS(`window.appStore.saveState()`);
    await sleep(1000); // 400ms debounce + atomik rename payı
    const durablePath = path.join(tmpUserData, 'lux_ai_data.json');
    let durableOk = false;
    let durableVol = null;
    try {
      const durableRaw = fs.readFileSync(durablePath, 'utf-8');
      const durable = JSON.parse(durableRaw);
      durableVol = durable?.state?.notifications?.soundVolume ?? durable?.notifications?.soundVolume ?? null;
      durableOk = Number(durableVol) === 42;
    } catch (err) {
      durableOk = false;
      durableVol = 'ERR:' + err.message;
    }
    check('kalıcı-dosya:yazıldı (lux_ai_data.json)', fs.existsSync(durablePath), durablePath);
    check('kalıcı-dosya:soundVolume=42', durableOk, `vol=${durableVol}`);
    const lsVol = await execJS(`(() => {
      try { return JSON.parse(localStorage.getItem('lux_ai_state_v2') || '{}')?.notifications?.soundVolume; } catch { return 'ERR'; }
    })()`);
    check('localStorage:soundVolume=42', Number(lsVol) === 42, `vol=${lsVol}`);

    // Reload → state geri yüklenir
    await win.webContents.reload();
    await sleep(4000);
    currentTab = 'reload';
    const volAfterReload = await execJS(`window.appStore?.state?.notifications?.soundVolume`);
    check('reload:soundVolume korunur', Number(volAfterReload) === 42, `vol=${volAfterReload}`);
    // Temizle: 42 → 100 ve kaydet (geçici profil zaten silinecek)
    await execJS(
      `(() => { if (window.appStore?.state?.notifications) window.appStore.state.notifications.soundVolume = 100; window.appStore?.saveState?.(); })()`
    );

    // ---------- FAZ E: Models sekmesi & vault ----------
    currentTab = 'models';
    await execJS(`window.openSettingsModal('models')`);
    await sleep(900);
    const modelCardCount = await execJS(`document.querySelectorAll('.model-card-item[data-model-id]').length`);
    check('models:kartlar render', modelCardCount >= 1, `kart=${modelCardCount}`);
    const vault = await execJS(
      `window.luxAPI?.secrets?.status?.().then(r => ({ success: r?.success, error: r?.error || null, scheme: r?.scheme || null, count: r?.count ?? null })).catch(e => ({ success: false, error: String(e && e.message || e) }))`
    );
    check('vault:status IPC', vault && vault.success === true, JSON.stringify(vault));

    // ---------- FAZ F: Kritik butonlar var mı? ----------
    const requiredButtons = {
      application: [
        'btn-app-browse-workspace',
        'btn-check-update',
        'btn-backup-export',
        'btn-backup-import',
        'btn-logs-refresh',
        'btn-logs-clear',
        'btn-logs-open-folder'
      ],
      general: ['btn-wipe-memory', 'general-auto-heal-toggle'],
      permissions: ['btn-perm-enable-all', 'btn-perm-reset', 'btn-vault-rotate'],
      notifications: ['notif-volume-slider', 'btn-test-chime'],
      otomasyonlar: ['btn-toggle-new-automation']
    };
    for (const [tab, ids] of Object.entries(requiredButtons)) {
      currentTab = tab;
      await execJS(`window.openSettingsModal(${JSON.stringify(tab)})`);
      await sleep(650);
      for (const id of ids) {
        const exists = await execJS(`Boolean(document.getElementById(${JSON.stringify(id)}))`);
        check(`btn:${id}`, exists === true);
      }
    }

    // Bildirim izni: renderer Notification.permission main whitelist'i ile tutarlı mı?
    currentTab = 'notifications';
    const notifPerm = await execJS(`("Notification" in window) ? Notification.permission : "unsupported"`);
    check('notifications:Electron beyaz liste izni', notifPerm !== 'denied', `Notification.permission=${notifPerm}`);

    currentTab = 'done';
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);
    const report = {
      ok: failed.length === 0 && consoleErrors.length === 0,
      passed,
      total: results.length,
      failed,
      consoleErrors
    };
    console.log('SETTINGS_AUDIT ' + JSON.stringify(report, null, 2));
    app.exit(report.ok ? 0 : 1);
  }, 6000);
});
