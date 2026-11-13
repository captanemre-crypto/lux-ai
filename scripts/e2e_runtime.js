// LUX AI — Gerçek çalışma zamanı yaşam döngüsü testi (headless).
//
// Duman testinden (smoke_harness.js) farkı: pencerenin sadece açıldığını
// değil, IPC köprüsünün uçtan uca gerçekten çalıştığını doğrular:
//   getAppInfo -> state save/load (debounce'lu atomik yazma) -> secrets
//   set/get/status/clear -> terminal-execute(runId) -> git-diff(temp repo)
//   -> fs yazar/okur/sil (güvenlik kalkanı dahil) -> voice-status/cancel
//   -> temiz kapanış.
//
// userData, mkdtemp ile izole edilir; gerçek kullanıcı profili dokunulmaz.
//
// Kullanım:
//   xvfb-run -a node node_modules/electron/cli.js scripts/e2e_runtime.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { app, BrowserWindow } = require('electron');

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-e2e-userdata-'));
app.setPath('userData', tmpUserData);
// Geliştirme (electron <dosya.js>) modunda app.getVersion() Electron'un kendi
// sürümünü döner; üretimde (`electron .`) package.json sürümü döner. Handler'ın
// app.getVersion() çağrısını doğrulamak için testi deterministik hale getiriyoruz.
const appPkg = require('../package.json');
app.getVersion = () => appPkg.version;

const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_WORK = path.join(ROOT_DIR, '.e2e-tmp');
try {
  fs.rmSync(TMP_WORK, { recursive: true, force: true, maxRetries: 3 });
} catch (_) {}
fs.mkdirSync(path.join(TMP_WORK, 'gitrepo'), { recursive: true });

// Temp git deposu (git-diff IPC'si için)
execSync(
  'git init -q && git config user.email e2e@lux.ai && git config user.name "Lux E2E" && echo merhaba > not.txt && git add -A && git commit -qm init && echo degisiklik >> not.txt',
  { cwd: path.join(TMP_WORK, 'gitrepo') }
);

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
  console.log('E2E_RESULT ' + JSON.stringify({ ok: false, reason: 'main.js yüklenemedi: ' + err.message }));
  app.exit(1);
}

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve({ __timeout: true, label }), ms))]);
}

app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('E2E_RESULT ' + JSON.stringify({ ok: false, reason: 'Pencere açılmadı' }));
      app.exit(1);
      return;
    }

    let inPage = null;
    try {
      inPage = await withTimeout(
        win.webContents.executeJavaScript(`(async () => {
        const out = {};
        const H = ${JSON.stringify(TMP_WORK)};
        const HOME = ${JSON.stringify(os.homedir())};
        const q = (id) => document.getElementById(id);

        // 1) getAppInfo — gerçek sürüm
        try {
          const info = await window.luxAPI.getAppInfo();
          out.appInfo = { name: info.name, version: info.version, platform: info.platform, workspace: info.currentWorkspace };
        } catch (e) { out.appInfo = { error: String(e) }; }

        // 2) Kalıcı state round-trip (yazar -> debounce'u bekle -> oku)
        try {
          const marker = 'e2e-' + Date.now();
          await window.luxAPI.state.saveDurable({ state: { e2eMarker: marker }, savedAt: Date.now() });
          await new Promise(r => setTimeout(r, 800));
          const res = await window.luxAPI.state.loadDurable();
          out.durableState = { wrote: marker, readBack: res?.data?.state?.e2eMarker || null, ok: res?.data?.state?.e2eMarker === marker };
        } catch (e) { out.durableState = { error: String(e) }; }

        // 2b) saveState: localStorage'a HAM anahtar sızmamalı
        try {
          const st = window.appStore.state;
          if (Array.isArray(st.models) && st.models.length > 0) {
            st.models[0].apiKey = 'sk-RAW-LEAK-abcdef123456';
            window.appStore.saveState();
            const ls = localStorage.getItem('lux_ai_state_v2') || '';
            out.saveStateMask = { leaked: ls.includes('sk-RAW-LEAK-abcdef123456'), masked: ls.includes('••••') };
            st.models[0].apiKey = '';
            window.appStore.saveState();
          } else {
            out.saveStateMask = { skipped: true };
          }
        } catch (e) { out.saveStateMask = { error: String(e) }; }

        // 3) secrets round-trip (set -> get -> status -> set '' ile temizle)
        try {
          await window.luxAPI.secrets.set('e2e-test-key', 'sk-e2e-1234567890');
          const got = await window.luxAPI.secrets.get('e2e-test-key');
          const st = await window.luxAPI.secrets.status();
          await window.luxAPI.secrets.set('e2e-test-key', ''); // tek anahtarı temizle
          const after = await window.luxAPI.secrets.get('e2e-test-key');
          out.secrets = {
            roundTrip: got?.value === 'sk-e2e-1234567890',
            statusCountAfterSet: st?.count,
            scheme: st?.scheme,
            clearedValue: after?.value || '',
            cleared: !after?.success
          };
        } catch (e) { out.secrets = { error: String(e) }; }

        // 3b) secrets-rotate: yeniden şifreleme sonrası değer korunur (izole kasa)
        try {
          await window.luxAPI.secrets.set('e2e-rotate-key', 'sk-rotate-0987654321');
          const rot = await window.luxAPI.secrets.rotate();
          const gotAfterRotate = await window.luxAPI.secrets.get('e2e-rotate-key');
          const stAfter = await window.luxAPI.secrets.status();
          await window.luxAPI.secrets.set('e2e-rotate-key', ''); // temizle
          out.secrets = out.secrets || {};
          out.secrets.rotate = {
            success: rot?.success === true,
            rotated: rot?.rotated,
            valuePreserved: gotAfterRotate?.value === 'sk-rotate-0987654321',
            vaultVersion: stAfter?.vaultVersion
          };
        } catch (e) { out.secrets = out.secrets || {}; out.secrets.rotate = { error: String(e) }; }

        // 3c) voice-model-status: yalnız diski okur; indirme TETİKLEMEZ
        try {
          const ms = await window.luxAPI.voice.modelStatus();
          out.voiceModelStatus = {
            success: ms?.success === true,
            modelsRoot: ms?.modelsRoot || null,
            whisperCached: ms?.whisperCached === true,
            whisperModel: ms?.whisperModel || ''
          };
        } catch (e) { out.voiceModelStatus = { error: String(e) }; }

        // 3d) Ayarlar → İzinler: Anahtar Kasası kartı gerçekten render ediliyor
        //     (bu UI bu turda eklendi; burada gerçek renderer'da açılıp sınanır)
        try {
          window.openSettingsModal("permissions");
          await new Promise((r) => setTimeout(r, 400)); // async kasa durumu yüklemesi
          const rotateBtn = document.getElementById("btn-vault-rotate");
          const statusEl = document.getElementById("vault-status-text");
          const statusBefore = statusEl ? statusEl.textContent : "";
          if (rotateBtn) rotateBtn.click();
          await new Promise((r) => setTimeout(r, 900)); // rotate IPC + durum tazeleme
          const statusAfter = statusEl ? statusEl.textContent : "";
          const detailEl = document.getElementById("vault-detail-text");
          out.vaultCard = {
            rendered: Boolean(rotateBtn),
            statusPopulated: !/yükleniyor/.test(statusBefore) && statusBefore.length > 8,
            statusBefore,
            statusAfter,
            rotateClicked: Boolean(rotateBtn),
            detailText: detailEl ? detailEl.textContent.slice(0, 160) : ""
          };
          window.closeSettingsModal();
        } catch (e) { out.vaultCard = { error: String(e) }; }

        // 4) Terminal: runId ile echo + zaman aşımı korumalı yürütme
        try {
          const t = await window.luxAPI.terminal.execute('echo lux-e2e-ok', ${JSON.stringify(ROOT_DIR)}, 10000);
          out.terminal = { runId: t?.runId || null, code: t?.code, output: String(t?.output || '').trim(), ok: String(t?.output || '').includes('lux-e2e-ok') };
        } catch (e) { out.terminal = { error: String(e) }; }

        // 5) git-diff: taze temp repo, not.txt untracked
        try {
          const d = await window.luxAPI.git.getDiff(${JSON.stringify(path.join(TMP_WORK, 'gitrepo'))});
          out.gitDiff = { isGitRepo: d?.isGitRepo, branch: d?.branch, files: (d?.files || []).map(f => f.path) };
        } catch (e) { out.gitDiff = { error: String(e) }; }

        // 6) fs yaz/oku/sil döngüsü + güvenlik kalkanı (HOME silinememeli)
        try {
          await window.luxAPI.fs.writeFile('probe.txt', 'merhaba-e2e', { workspaceDir: H });
          const rd = await window.luxAPI.fs.readFile('probe.txt', { workspaceDir: H });
          const del = await window.luxAPI.fs.deletePath('probe.txt', { workspaceDir: H, permanent: true });
          const guard = await window.luxAPI.fs.deletePath(HOME, { workspaceDir: H, permanent: true });
          out.fs = {
            readBack: rd?.content,
            deleted: del?.success === true,
            homeDeleteBlocked: guard?.blocked === true || guard?.success === false
          };
        } catch (e) { out.fs = { error: String(e) }; }

        // 6b) renderChat parçalı render: değişmeyen satır düğümü KORUNUR
        try {
          const conv = window.appStore.getActiveConversation();
          const originalLen = conv.messages.length;
          const mUser = { id: 'e2e-user-inc-1', role: 'user', content: 'artimsal render testi', isStreaming: false, timestamp: 'şimdi' };
          const mAsst = { id: 'e2e-asst-inc-1', role: 'assistant', content: '**yanit bir**', isStreaming: false, timestamp: 'şimdi' };
          conv.messages.push(mUser, mAsst);
          window.renderApp ? null : null;
          (function renderNow() {
            // renderChat global fonksiyon; doğrudan çağrılabilir
            if (typeof renderChat === 'function') return renderChat();
            window.appStore.notify();
          })();
          const feed1 = document.querySelector('#chat-feed');
          const rowUser1 = feed1?.querySelector('[data-chat-row-id="e2e-user-inc-1"]');
          const rowAsst1 = feed1?.querySelector('[data-chat-row-id="e2e-asst-inc-1"]');
          mAsst.content = '**yanit iki (degisti)**';
          if (typeof renderChat === 'function') renderChat();
          const feed2 = document.querySelector('#chat-feed');
          const rowUser2 = feed2?.querySelector('[data-chat-row-id="e2e-user-inc-1"]');
          const rowAsst2 = feed2?.querySelector('[data-chat-row-id="e2e-asst-inc-1"]');
          out.incrementalRender = {
            feedExists: Boolean(feed1 && feed2),
            userRowPreserved: Boolean(rowUser1 && rowUser1 === rowUser2),
            assistantRowReplaced: Boolean(rowAsst1 && rowAsst1 !== rowAsst2),
            contentUpdated: String(rowAsst2?.innerHTML || '').includes('yanit iki')
          };
          conv.messages.length = originalLen; // orijinal konuşmayı geri yükle
          if (typeof renderChat === 'function') renderChat();
        } catch (e) { out.incrementalRender = { error: String(e) }; }

        // 6d) Canlı akış işaretleme temizleyici — ayrıştırmada düşmesi durumunda
        //     sesli akış üretimi ReferenceError verirdi (bu yüzden önce burada doğrulanır)
        try {
          const probe = 'düşün<think>gizli plan</think>SON';
          const stripped = (typeof stripMarkupForLiveStream === 'function') ? stripMarkupForLiveStream(probe) : null;
          out.liveStreamMarkup = {
            defined: typeof stripMarkupForLiveStream === 'function',
            stripsThink: Boolean(stripped && !stripped.includes('gizli plan') && stripped.includes('SON'))
          };
        } catch (e) { out.liveStreamMarkup = { error: String(e) }; }

        // 6c) AudioBuffer önbelleği gerçekten çalışıyor mu (decode + çal)
        try {
          if (!window.luxAudioCache) {
            out.audioCache = { error: 'luxAudioCache yok' };
          } else {
            const t0 = performance.now();
            const h1 = await window.luxAudioCache.play('assets/sounds/save.mp3', { volume: 0.0 });
            const firstMs = Math.round(performance.now() - t0);
            const t1 = performance.now();
            const h2 = await window.luxAudioCache.play('assets/sounds/save.mp3', { volume: 0.0 });
            const secondMs = Math.round(performance.now() - t1);
            out.audioCache = {
              played: Boolean(h1 && h2),
              cachedEntries: window.luxAudioCache.size(),
              firstMs,
              secondMs,
              decodeReused: secondMs <= firstMs
            };
            try { h1?.stop(); h2?.stop(); } catch (_) {}
          }
        } catch (e) { out.audioCache = { error: String(e) }; }

        // 6e) Dahili Tarayıcı — konum (koordinat) seçici ucu uca
        try {
          const opened = window.openAuxBrowserUrl ? window.openAuxBrowserUrl('http://localhost:8000/#positions') : false;
          await new Promise((r) => setTimeout(r, 400)); // IDE paneli render edilsin
          const pickBtn = document.getElementById('aux-browser-pick');
          const viewport = document.getElementById('aux-browser-viewport');
          if (!pickBtn || !viewport) {
            out.locationPicker = { error: 'pick butonu/kapsayıcı yok (opened=' + opened + ')' };
          } else {
            pickBtn.click();
            const overlayShown = Boolean(document.getElementById('aux-browser-pick-overlay'));
            // ESC iptal yolu
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            const escCancel = !document.getElementById('aux-browser-pick-overlay');
            // Tekrar aç ve gerçek tıklama gönder
            pickBtn.click();
            const overlay2 = document.getElementById('aux-browser-pick-overlay');
            const rect = overlay2.getBoundingClientRect();
            const cx = Math.round(rect.left + 120);
            const cy = Math.round(rect.top + 90);
            overlay2.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
            await new Promise((r) => setTimeout(r, 60));
            const tray = document.getElementById('composer-attachment-tray');
            const chip = tray?.querySelector('.lux-location-chip');
            const chipAdded = Boolean(chip);
            const ta = document.getElementById('composer-textarea');
            // Yeni davranış: koordinat textarea'ya YAZILMAZ
            const tokenInTextarea = Boolean(ta && ta.value.includes('@konum'));
            // Gönderim anında gizli bağlam olarak tüketilir
            const suffix = window.consumePendingLocationPrompt ? window.consumePendingLocationPrompt() : '';
            const suffixOk = Boolean(suffix && suffix.includes('localhost:8000/#positions') && /x:\\d+px, y:\\d+px/.test(suffix));
            const chipRemoved = !tray?.querySelector('.lux-location-chip');
            const trayHidden = Boolean(tray?.classList.contains('hidden'));
            out.locationPicker = { opened, overlayShown, escCancel, chipAdded, tokenInTextarea, suffixOk, chipRemoved, trayHidden };
          }
        } catch (e) { out.locationPicker = { error: String(e) }; }

        // 6f) Ajan görselleri kompakt chip olarak çizilir (ad gösterilir), × sohbetten kaldırır
        try {
          const conv = window.appStore.getActiveConversation();
          const probeMsg = {
            id: 'e2e-media-chip-1',
            role: 'assistant',
            content: 'görsel deneme',
            isStreaming: false,
            timestamp: 'şimdi',
            media: [{ fileUrl: 'file:///nonexistent/nonexistent-e2e-img.png', localPath: '/nonexistent/nonexistent-e2e-img.png', title: '' }]
          };
          const probeIdx = conv.messages.push(probeMsg) - 1;
          if (typeof renderChat === 'function') renderChat();
          const row = document.querySelector('[data-chat-row-id="e2e-media-chip-1"]');
          const chipEl = row?.querySelector('.lux-media-chip');
          const feedHasChip = Boolean(chipEl);
          const nameShown = Boolean(chipEl && (chipEl.querySelector('.lux-media-chip-title')?.textContent || '').includes('nonexistent-e2e-img.png'));
          const thumbAction = Boolean(chipEl?.querySelector('[data-action="lightbox-img"]'));
          chipEl?.querySelector('[data-action="remove-media"]')?.click();
          await new Promise((r) => setTimeout(r, 60));
          const chipGone = !document.querySelector('[data-chat-row-id="e2e-media-chip-1"] .lux-media-chip');
          const msgAfter = conv.messages.find((m) => m.id === 'e2e-media-chip-1');
          const removedFromStore = msgAfter ? !Array.isArray(msgAfter.media) || msgAfter.media.length === 0 : false;
          const idxAfter = conv.messages.indexOf(msgAfter || probeMsg);
          if (idxAfter !== -1) conv.messages.splice(idxAfter, 1);
          if (typeof renderChat === 'function') renderChat();
          out.mediaChip = { feedHasChip, nameShown, thumbAction, chipGone, removedFromStore };
        } catch (e) { out.mediaChip = { error: String(e) }; }

        // 7) voice iptal: servis kapalıyken SÜREÇ AÇMAMALI
        try {
          const c = await window.luxAPI.voice.cancel(987654);
          out.voiceCancel = { success: c?.success === true, serviceRunning: c?.serviceRunning === true };
        } catch (e) { out.voiceCancel = { error: String(e) }; }

        // 8) voice-status python yoksa hata döner ama ASLA asılı kalmamalı
        try {
          const s = await window.luxAPI.voice.getStatus();
          out.voiceStatus = { resolved: true, success: s?.success === true, error: s?.error || null };
        } catch (e) { out.voiceStatus = { error: String(e) }; }

        return out;
      })()`),
        25000,
        'inPage'
      );
    } catch (err) {
      inPage = { error: err.message };
    }

    const ok = Boolean(
      inPage &&
      !inPage.error &&
      inPage.appInfo?.version === appPkg.version &&
      inPage.durableState?.ok === true &&
      (inPage.saveStateMask?.masked === true || inPage.saveStateMask?.leaked === false) &&
      inPage.secrets?.roundTrip === true &&
      inPage.secrets?.cleared === true &&
      inPage.secrets?.rotate?.success === true &&
      inPage.secrets?.rotate?.valuePreserved === true &&
      inPage.voiceModelStatus?.success === true &&
      inPage.vaultCard?.rendered === true &&
      inPage.vaultCard?.statusPopulated === true &&
      inPage.terminal?.ok === true &&
      inPage.terminal?.runId &&
      inPage.gitDiff?.isGitRepo === true &&
      inPage.fs?.readBack === 'merhaba-e2e' &&
      inPage.fs?.deleted === true &&
      inPage.fs?.homeDeleteBlocked === true &&
      inPage.voiceCancel?.success === true &&
      inPage.voiceCancel?.serviceRunning === false &&
      inPage.incrementalRender?.userRowPreserved === true &&
      inPage.incrementalRender?.assistantRowReplaced === true &&
      inPage.incrementalRender?.contentUpdated === true &&
      inPage.liveStreamMarkup?.stripsThink === true &&
      inPage.audioCache?.played === true &&
      inPage.voiceStatus?.resolved === true &&
      inPage.locationPicker?.chipAdded === true &&
      inPage.locationPicker?.tokenInTextarea === false &&
      inPage.locationPicker?.suffixOk === true &&
      inPage.locationPicker?.escCancel === true &&
      inPage.locationPicker?.chipRemoved === true &&
      inPage.locationPicker?.trayHidden === true &&
      inPage.mediaChip?.feedHasChip === true &&
      inPage.mediaChip?.nameShown === true &&
      inPage.mediaChip?.thumbAction === true &&
      inPage.mediaChip?.chipGone === true &&
      inPage.mediaChip?.removedFromStore === true &&
      consoleErrors.length === 0
    );

    const payload = { ok, inPage, consoleErrors: consoleErrors.slice(0, 10) };
    console.log('E2E_RESULT ' + JSON.stringify(payload, null, 2));
    try {
      fs.rmSync(TMP_WORK, { recursive: true, force: true, maxRetries: 3 });
    } catch (_) {}
    try {
      fs.rmSync(tmpUserData, { recursive: true, force: true, maxRetries: 3 });
    } catch (_) {}
    app.exit(ok ? 0 : 1);
  }, 6000);
});
