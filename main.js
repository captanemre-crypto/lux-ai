const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  nativeTheme,
  session,
  desktopCapturer,
  clipboard,
  safeStorage,
  crashReporter
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const agentCaps = require('./scripts/agent_capabilities');
const { buildUnifiedLineDiff } = require('./scripts/unified_diff');
const logger = require('./src/logger');

// Enforce dark mode for OS native popups, menus and system controls
nativeTheme.themeSource = 'dark';

// Kilitlenme (crash) raporları: varsayılan olarak HİÇBİR veri makineden çıkmaz.
// Dağıtımcı LUX_CRASH_URL ortam değişkeniyle bir crash toplama ucu verirse dump'lar
// oraya yüklenir (örn. Sentry/bugsnag/kendi endpoint'i); yoksa yalnızca yerel
// crashDumps dizini tutulur ve logger'a yazılır.
try {
  const crashUrl = String(process.env.LUX_CRASH_URL || '').trim();
  const crashOpts = { compress: true, uploadToServer: Boolean(crashUrl) };
  if (crashUrl) crashOpts.submitURL = crashUrl;
  crashReporter.start(crashOpts);
  logger.info(
    `[crash] crashReporter hazır (yükleme: ${crashUrl ? 'açık' : 'kapalı'}) — dump dizini: ${app.getPath('crashDumps')}`,
    undefined,
    'crash'
  );
} catch (err) {
  logger.warn(`[crash] crashReporter başlatılamadı: ${err && err.message ? err.message : err}`, undefined, 'crash');
}

let mainWindow = null;
let configuredWorkspaceDir = process.cwd();
let managedOllamaProcess = null;
const DATA_FILE = path.join(app.getPath('userData'), 'lux_ai_data.json');
const MEDIA_CACHE_DIR = path.join(app.getPath('userData'), 'lux_media');
// Model kökü artık sabit "D:\LuxAI_Models" değil: önce LUX_MODELS_DIR ortam
// değişkeni, sonra platforma göre bilinen konumlar, en son userData/models.
// Böylece proje başka bir makinede/kullanıcıda da çalışır.
function resolveModelsRoot() {
  if (process.env.LUX_MODELS_DIR) return process.env.LUX_MODELS_DIR;
  const candidates =
    process.platform === 'win32'
      ? ['D:\\LuxAI_Models', 'C:\\LuxAI_Models']
      : [path.join(app.getPath('home'), 'LuxAI_Models'), '/opt/LuxAI_Models'];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return path.join(app.getPath('userData'), 'models');
}
let DEFAULT_LUX_MODELS_DIR = resolveModelsRoot();

function buildLuxModelEnv(extra = {}) {
  const root = process.env.LUX_MODELS_DIR || (fs.existsSync(DEFAULT_LUX_MODELS_DIR) ? DEFAULT_LUX_MODELS_DIR : '');
  const baseEnv = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', COQUI_TOS_AGREED: '1' };
  if (root) {
    baseEnv.LUX_MODELS_DIR = root;
    baseEnv.OLLAMA_MODELS = process.env.OLLAMA_MODELS || path.join(root, 'ollama');
    baseEnv.HF_HOME = process.env.HF_HOME || path.join(root, 'huggingface');
    baseEnv.TTS_HOME = process.env.TTS_HOME || path.join(root, 'coqui');
    baseEnv.TORCH_HOME = process.env.TORCH_HOME || path.join(root, 'torch');
  }
  return { ...baseEnv, ...extra };
}

function checkOllamaListening() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 1400 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 262144) body += chunk;
      });
      res.on('end', () => {
        const listening = res.statusCode >= 200 && res.statusCode < 500;
        let models = [];
        try {
          const parsed = JSON.parse(body || '{}');
          if (Array.isArray(parsed.models)) {
            models = parsed.models.map((m) => m.name || m.model).filter(Boolean);
          }
        } catch (_) {}
        resolve({ listening, modelsCount: models.length, models });
      });
    });
    req.on('error', () => resolve({ listening: false, modelsCount: 0, models: [] }));
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch (_) {}
      resolve({ listening: false, modelsCount: 0, models: [] });
    });
  });
}

function resolveOllamaExecutable() {
  const localApp = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localApp, 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
    '/usr/local/bin/ollama',
    '/usr/bin/ollama'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  // PATH üzerinde 'ollama' araması — spawn edip 6+ saniye bekletmek yerine
  // hızlıca 'which'/'where' ile çözüyoruz.
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(probe, ['ollama'], { encoding: 'utf-8', timeout: 3000, windowsHide: true });
    if (res && res.status === 0) {
      const first = String(res.stdout || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (first) return first;
    }
  } catch (_) {}
  return null;
}

let ollamaEnsureInFlight = null;
async function ensureOllamaRunning() {
  // Aynı anda gelen istekler tek bir denemeye birleşir; aksi halde her
  // çağrı yeni bir `ollama serve` süreci başlatmayı deniyordu.
  if (ollamaEnsureInFlight) return ollamaEnsureInFlight;
  ollamaEnsureInFlight = ensureOllamaRunningInner().finally(() => {
    ollamaEnsureInFlight = null;
  });
  return ollamaEnsureInFlight;
}

async function ensureOllamaRunningInner() {
  const env = buildLuxModelEnv();
  const initial = await checkOllamaListening();
  if (initial.listening) {
    const manifestsDir = env.OLLAMA_MODELS ? path.join(env.OLLAMA_MODELS, 'manifests') : '';
    const hasLocalManifests = Boolean(manifestsDir && fs.existsSync(manifestsDir));
    if (initial.modelsCount === 0 && hasLocalManifests && managedOllamaProcess && !managedOllamaProcess.killed) {
      if (process.platform === 'win32' && managedOllamaProcess.pid) {
        try {
          spawnSync('taskkill', ['/pid', String(managedOllamaProcess.pid), '/T', '/F'], {
            windowsHide: true,
            timeout: 1500
          });
        } catch (_) {}
      }
      try {
        managedOllamaProcess.kill();
      } catch (_) {}
      managedOllamaProcess = null;
      await new Promise((r) => setTimeout(r, 300));
    } else {
      return {
        running: true,
        startedByLux: false,
        modelsCount: initial.modelsCount,
        modelsDir: env.OLLAMA_MODELS || ''
      };
    }
  }
  const exe = resolveOllamaExecutable();
  if (!exe) {
    return { running: false, error: 'ollama.exe bulunamadı' };
  }
  try {
    if (!managedOllamaProcess || managedOllamaProcess.killed) {
      managedOllamaProcess = spawn(exe, ['serve'], {
        stdio: 'ignore',
        windowsHide: true,
        env
      });
      managedOllamaProcess.on('exit', () => {
        managedOllamaProcess = null;
      });
      managedOllamaProcess.on('error', (spawnErr) => {
        // Ollama kurulu değil / çalıştırılamıyor: uygulamayı düşürmeyiz.
        console.warn('[ollama] başlatılamadı:', spawnErr.message);
        managedOllamaProcess = null;
      });
    }
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const status = await checkOllamaListening();
      if (status.listening) {
        return {
          running: true,
          startedByLux: true,
          modelsCount: status.modelsCount,
          modelsDir: env.OLLAMA_MODELS || ''
        };
      }
    }
  } catch (err) {
    return { running: false, error: err.message };
  }
  return { running: false, error: 'Ollama başlatılamadı (11434)' };
}

function getKnownPathOverrides(extra = {}) {
  return {
    homePath: app.getPath('home'),
    desktopPath: app.getPath('desktop'),
    documentsPath: app.getPath('documents'),
    downloadsPath: app.getPath('downloads'),
    picturesPath: app.getPath('pictures'),
    workspaceDir: extra.workspaceDir || configuredWorkspaceDir || process.cwd()
  };
}

function createWindow() {
  const isWin = process.platform === 'win32';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 620,
    title: 'Lux AI',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#070709',
    titleBarStyle: 'hidden',
    titleBarOverlay: isWin
      ? {
          color: '#111114',
          symbolColor: '#FFFFFF',
          height: 35
        }
      : false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Lux, <webview> kullanmıyor; gereksiz yetkiyi kapatıyoruz.
      webviewTag: false,
      // preload yalnızca electron'un contextBridge/ipcRenderer'ını kullanır;
      // bu yüzden tam sandbox güvenli.
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // İzinler artık BEYAZ LİSTE ile veriliyor: yalnızca sesli mod için gereken
  // mikrofon/kamera (media), tam ekran ve pano okuma. Geri kalan her şey (USB,
  // HID, seri port, geolocation, bildirim, MIDI, açık harici protokol, ...) RED.
  const ALLOWED_PERMISSIONS = new Set(['media', 'audioCapture', 'videoCapture', 'fullscreen', 'clipboard-read']);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const granted = ALLOWED_PERMISSIONS.has(permission);
    if (!granted) console.warn(`[permission] reddedildi: ${permission}`);
    callback(granted);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return ALLOWED_PERMISSIONS.has(permission);
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    } else if (url && url.startsWith('file://')) {
      try {
        const localP = decodeURIComponent(new URL(url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
        shell.openPath(localP);
      } catch (_) {}
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appIndexUrl = new URL(
      'file:///' + path.join(__dirname, 'src', 'index.html').replace(/\\/g, '/')
    ).href.toLowerCase();
    if (url && url.toLowerCase().split('#')[0] !== appIndexUrl.split('#')[0]) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      } else if (url.startsWith('file://')) {
        try {
          const localP = decodeURIComponent(new URL(url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
          shell.openPath(localP);
        } catch (_) {}
      }
    }
  });
}

// ----------------------------------------------------
// Tek örnek kilidi (single instance)
// ----------------------------------------------------
// start_lux_ai.bat çift tıklandığında iki Electron + iki Python voice servisi
// açılmasını engeller. İkinci örnek pencereyi öne getirip kapanır.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });
}

const { createSecretsVault } = require('./src/main/secrets_vault');
const {
  asString,
  asIntInRange,
  isPlainObject,
  asOptions,
  MAX_PATH,
  MAX_QUERY,
  MAX_COMMAND,
  MAX_TEXT,
  MAX_FILE_CONTENT,
  MAX_AUDIO_B64
} = require('./src/main/validate');
const secretsVault = createSecretsVault({ userDataDir: app.getPath('userData'), safeStorage, ipcMain });
const { readSecretsFile, decryptSecret } = secretsVault;
// ----------------------------------------------------
// Kalıcı state köprüsü (localStorage -> main process JSON + atomik yazma)
// ----------------------------------------------------
// Renderer hâlâ localStorage kullanabilir (yedek), ama asıl kalıcı kopya artık
// userData/lux_ai_data.json. Anahtarlar diske yazılmadan önce çıkarılır.
let stateWriteTimer = null;
let pendingStatePayload = null;

function stripSecretsFromState(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = JSON.parse(JSON.stringify(data));
  if (clone.state && typeof clone.state === 'object') {
    if (clone.state.voiceMode) clone.state.voiceMode.openrouterApiKey = '';
    if (Array.isArray(clone.state.models)) {
      clone.state.models.forEach((m) => {
        if (m && typeof m === 'object') m.apiKey = '';
      });
    }
  }
  return clone;
}

function flushStateWrite() {
  stateWriteTimer = null;
  if (!pendingStatePayload) return;
  const payload = pendingStatePayload;
  pendingStatePayload = null;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE); // atomik yazma: yarım kalan dosya olmaz
  } catch (err) {
    console.error('[state] yazılamadı:', err.message);
  }
}

ipcMain.handle('state-save-durable', (event, payload) => {
  if (!isPlainObject(payload)) return { success: false, error: 'Geçersiz state yükü (düz nesne bekleniyor)' };
  pendingStatePayload = stripSecretsFromState(payload);
  if (stateWriteTimer) clearTimeout(stateWriteTimer);
  stateWriteTimer = setTimeout(flushStateWrite, 400); // debounce
  return { success: true, queued: true };
});

ipcMain.handle('state-load-durable', () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { success: true, data: null };
    return { success: true, data: JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) };
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
});

// Window control IPCs
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
  return mainWindow?.isMaximized();
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-devtools', () => {
  mainWindow?.webContents.toggleDevTools();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized();
});

// App Info & Workspace Sync
ipcMain.handle('get-app-info', () => {
  return {
    name: 'Lux AI',
    version: app.getVersion(),
    platform: process.platform,
    homePath: app.getPath('home'),
    desktopPath: app.getPath('desktop'),
    documentsPath: app.getPath('documents'),
    downloadsPath: app.getPath('downloads'),
    picturesPath: app.getPath('pictures'),
    userDataPath: app.getPath('userData'),
    mediaCacheDir: MEDIA_CACHE_DIR,
    currentWorkspace: configuredWorkspaceDir || process.cwd()
  };
});

ipcMain.handle('set-workspace-dir', (event, dirPath) => {
  if (dirPath && typeof dirPath === 'string' && dirPath.length <= MAX_PATH && fs.existsSync(dirPath)) {
    configuredWorkspaceDir = path.resolve(dirPath);
    return { success: true, workspaceDir: configuredWorkspaceDir };
  }
  return { success: false, workspaceDir: configuredWorkspaceDir };
});

// Persistent Storage
ipcMain.handle('storage-load', () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to load data:', err);
  }
  return null;
});

ipcMain.handle('storage-save', (event, data) => {
  try {
    if (data === undefined || data === null) return false;
    const json = JSON.stringify(data, null, 2);
    if (json.length > 32 * 1024 * 1024) {
      console.error('storage-save: veri 32 MB sınırını aşıyor, yazılmadı');
      return false;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, json, 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save data:', err);
    return false;
  }
});

ipcMain.handle('storage-wipe', () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    // fileEditSnapshots bu satırın altında tanımlı (const) — TDZ hatasını önlemek
    // için varlık kontrolü ile temizliyoruz.
    if (typeof fileEditSnapshots !== 'undefined' && fileEditSnapshots) fileEditSnapshots.clear();
    if (fs.existsSync(MEDIA_CACHE_DIR)) {
      fs.rmSync(MEDIA_CACHE_DIR, { recursive: true, force: true });
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to wipe storage:', err);
    return { success: false, error: err.message };
  }
});

require('./src/main/plugins_ipc').registerPluginsIpc({ app, ipcMain });
const { fileEditSnapshots, runExecFile } = require('./src/main/edit_snapshots');
// File System & OS Dialog operations for Editor, Explorer & Settings
ipcMain.handle('shell-open-path', async (event, targetPath) => {
  try {
    const safeTarget = asString(targetPath, 'targetPath', { required: false, max: MAX_PATH });
    const resolved = safeTarget
      ? agentCaps.resolveSmartPath(safeTarget, configuredWorkspaceDir, getKnownPathOverrides())
      : configuredWorkspaceDir || process.cwd();
    const fallback = fs.existsSync(resolved) ? resolved : configuredWorkspaceDir || process.cwd();
    const errMsg = await shell.openPath(fallback);
    if (errMsg) return { success: false, error: errMsg, path: fallback };
    return { success: true, path: fallback };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog-open-folder', async () => {
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Çalışma Klasörü Seçin',
      defaultPath: configuredWorkspaceDir || process.cwd(),
      properties: ['openDirectory']
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: res.filePaths[0] };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('dialog-open-file', async () => {
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Bağlam İçin Dosya Seçin',
      defaultPath: configuredWorkspaceDir || process.cwd(),
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const fullPath = res.filePaths[0];
    const relPath = path.relative(configuredWorkspaceDir || process.cwd(), fullPath).replace(/\\/g, '/');
    return { canceled: false, path: fullPath, relPath: relPath && !relPath.startsWith('..') ? relPath : fullPath };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('dialog-open-audio', async () => {
  try {
    const defaultVoicesDir = path.join(DEFAULT_LUX_MODELS_DIR, 'coqui', 'voices');
    const defaultDir = fs.existsSync(defaultVoicesDir) ? defaultVoicesDir : app.getPath('desktop');
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Ses Klonlama İçin Referans Ses Dosyası Seçin (XTTS-v2)',
      defaultPath: defaultDir,
      filters: [
        { name: 'Ses Dosyaları', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a'] },
        { name: 'Tüm Dosyalar', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const fullPath = res.filePaths[0];
    return { canceled: false, path: fullPath, name: path.basename(fullPath) };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('ollama-ensure', async () => {
  return await ensureOllamaRunning();
});

ipcMain.handle('fs-list-files', async (event, dirPath, options = {}) => {
  try {
    dirPath = asString(dirPath, 'dirPath', { max: MAX_PATH });
    options = asOptions(options);
    const res = agentCaps.listFilesSmart(
      dirPath,
      options?.workspaceDir || configuredWorkspaceDir,
      options || {},
      getKnownPathOverrides(options || {})
    );
    return res.tree;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs-list-desktop-projects', async (event, workspaceDir) => {
  try {
    if (workspaceDir !== undefined && workspaceDir !== null)
      workspaceDir = asString(workspaceDir, 'workspaceDir', { max: MAX_PATH });
    return {
      success: true,
      ...agentCaps.listDesktopProjects(workspaceDir || configuredWorkspaceDir, getKnownPathOverrides({ workspaceDir }))
    };
  } catch (err) {
    return { success: false, error: err.message, projects: [] };
  }
});

ipcMain.handle('fs-read-file', async (event, filePath, options = {}) => {
  try {
    filePath = asString(filePath, 'filePath', { max: MAX_PATH });
    options = asOptions(options);
    const absPath = agentCaps.resolveSmartPath(
      filePath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    const content = fs.readFileSync(absPath, 'utf-8');
    return { success: true, content, path: absPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-write-file', async (event, filePath, content, options = {}) => {
  try {
    filePath = asString(filePath, 'filePath', { max: MAX_PATH });
    content = asString(content, 'content', { max: MAX_FILE_CONTENT });
    options = asOptions(options);
    const absPath = agentCaps.resolveSmartPath(
      filePath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    const existed = fs.existsSync(absPath);
    if (!fileEditSnapshots.has(absPath)) {
      let orig = '';
      if (existed) {
        try {
          orig = fs.readFileSync(absPath, 'utf-8');
        } catch (_) {}
      }
      fileEditSnapshots.set(absPath, {
        originalContent: orig,
        existsBefore: existed,
        updatedAt: Date.now()
      });
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    return { success: true, path: absPath, fileUrl: 'file:///' + absPath.replace(/\\/g, '/') };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-delete-path', async (event, targetPath, options = {}) => {
  try {
    targetPath = asString(targetPath, 'targetPath', { max: MAX_PATH });
    options = asOptions(options);
    const absPath = agentCaps.resolveSmartPath(
      targetPath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    if (!fs.existsSync(absPath)) {
      return { success: false, error: `Silinecek hedef bulunamadı: ${absPath}` };
    }
    // Güvenlik kalkanı: kök dizin, sistem klasörleri, ev dizini, sır dosyaları
    // ve (varsayılan olarak) çalışma alanı dışındaki yollar silinemez.
    const guard = agentCaps.assertSafeDestructiveTarget(absPath, options?.workspaceDir || configuredWorkspaceDir, {
      ...getKnownPathOverrides(options || {}),
      allowOutsideWorkspace: options?.allowOutsideWorkspace === true
    });
    if (!guard.allowed) {
      return { success: false, error: `Güvenlik: ${guard.reason}`, blocked: true, path: absPath };
    }
    // Varsayılan davranış: geri dönüşüm kutusuna taşı (geri alınabilir).
    // Kalıcı silme yalnızca açıkça istenirse (options.permanent === true).
    if (options?.permanent !== true) {
      try {
        await shell.trashItem(absPath);
        return { success: true, path: absPath, trashed: true };
      } catch (trashErr) {
        console.warn('[fs-delete] geri dönüşüm kutusu kullanılamadı, kalıcı siliniyor:', trashErr.message);
      }
    }
    fs.rmSync(absPath, { recursive: true, force: true });
    return { success: true, path: absPath, trashed: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-move-path', async (event, srcPath, destPath, options = {}) => {
  try {
    srcPath = asString(srcPath, 'srcPath', { max: MAX_PATH });
    destPath = asString(destPath, 'destPath', { max: MAX_PATH });
    options = asOptions(options);
    const ov = getKnownPathOverrides(options || {});
    const ws = options?.workspaceDir || configuredWorkspaceDir;
    const absSrc = agentCaps.resolveSmartPath(srcPath, ws, ov);
    const absDest = agentCaps.resolveSmartPath(destPath, ws, ov);
    if (!fs.existsSync(absSrc)) {
      return { success: false, error: `Kaynak bulunamadı: ${absSrc}` };
    }
    for (const [label, target] of [
      ['kaynak', absSrc],
      ['hedef', absDest]
    ]) {
      const guard = agentCaps.assertSafeDestructiveTarget(target, ws, {
        ...ov,
        allowOutsideWorkspace: options?.allowOutsideWorkspace === true
      });
      if (!guard.allowed) {
        return { success: false, error: `Güvenlik (${label}): ${guard.reason}`, blocked: true };
      }
    }
    fs.mkdirSync(path.dirname(absDest), { recursive: true });
    try {
      fs.renameSync(absSrc, absDest);
    } catch (_) {
      fs.cpSync(absSrc, absDest, { recursive: true });
      fs.rmSync(absSrc, { recursive: true, force: true });
    }
    return { success: true, from: absSrc, to: absDest };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-mkdir', async (event, dirPath, options = {}) => {
  try {
    dirPath = asString(dirPath, 'dirPath', { max: MAX_PATH });
    options = asOptions(options);
    const absDir = agentCaps.resolveSmartPath(
      dirPath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    fs.mkdirSync(absDir, { recursive: true });
    return { success: true, path: absDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-search', async (event, query, dirPath, options = {}) => {
  try {
    query = asString(query, 'query', { max: MAX_QUERY });
    if (dirPath !== undefined && dirPath !== null) dirPath = asString(dirPath, 'dirPath', { max: MAX_PATH });
    options = asOptions(options);
    return agentCaps.searchFilesSmart(
      query,
      dirPath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
  } catch (err) {
    return { success: false, error: err.message, matches: [] };
  }
});

require('./src/main/git_ipc').registerGitIpc({
  ipcMain,
  getWorkspaceDir: () => configuredWorkspaceDir,
  buildUnifiedLineDiff,
  fileEditSnapshots,
  runExecFile
});
// Terminal execution (with UTF-8 support, smart cwd resolution & 90s default timeout guard)
let terminalRunSeq = 0;
const activeTerminalChildren = new Set();
ipcMain.handle('terminal-execute', (event, command, cwd, timeoutMs = 90000) => {
  try {
    command = asString(command, 'command', { max: MAX_COMMAND });
    if (!command.trim()) throw new Error('command boş olamaz');
    if (cwd !== undefined && cwd !== null) cwd = asString(cwd, 'cwd', { max: MAX_PATH });
    timeoutMs = asIntInRange(timeoutMs, 'timeoutMs', { min: 1000, max: 300000, fallback: 90000 });
  } catch (err) {
    return { runId: null, success: false, code: -1, error: err.message, output: '' };
  }
  const runId = `term-${++terminalRunSeq}-${Date.now()}`;
  const emitChunk = (stream, text) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // runId sayesinde aynı anda çalışan iki komutun çıktısı karışmaz.
    mainWindow.webContents.send('terminal-data', { runId, stream, text });
  };
  return new Promise((resolve) => {
    const resolvedCwd = cwd
      ? agentCaps.resolveSmartPath(cwd, configuredWorkspaceDir, getKnownPathOverrides())
      : configuredWorkspaceDir || process.cwd();
    const safeCwd = fs.existsSync(resolvedCwd) ? resolvedCwd : process.cwd();
    let shellCmd = '/bin/bash';
    let shellArgs = ['-c', command];
    if (process.platform === 'win32') {
      const wrapped = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n${command}`;
      const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
      shellCmd = 'powershell.exe';
      shellArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded];
    }

    const child = spawn(shellCmd, shellArgs, {
      cwd: safeCwd,
      env: buildLuxModelEnv(),
      windowsHide: true
    });
    activeTerminalChildren.add(child);
    const releaseChild = () => {
      try {
        activeTerminalChildren.delete(child);
      } catch (_) {}
    };

    let output = '';
    let errorOutput = '';
    let settled = false;

    const timer = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        releaseChild();
        try {
          child.kill();
        } catch (_) {}
        resolve({
          runId,
          code: 124,
          output,
          error: `${errorOutput}\n[Zaman aşımı: Komut ${Math.round(timeoutMs / 1000)}sn içinde tamamlanmadı]`.trim()
        });
      },
      Math.max(2000, Math.min(300000, Number(timeoutMs) || 90000))
    );

    child.stdout.on('data', (data) => {
      const text = data.toString('utf-8');
      output += text;
      emitChunk('stdout', text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString('utf-8');
      errorOutput += text;
      emitChunk('stderr', text);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      releaseChild();
      clearTimeout(timer);
      resolve({
        runId,
        code,
        output,
        error: errorOutput
      });
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      releaseChild();
      clearTimeout(timer);
      resolve({
        runId,
        code: 1,
        output,
        error: err.message
      });
    });
  });
});

require('./src/main/agent_ipc').registerAgentIpc({
  ipcMain,
  BrowserWindow,
  desktopCapturer,
  clipboard,
  shell,
  agentCaps,
  mediaCacheDir: MEDIA_CACHE_DIR,
  getWorkspaceDir: () => configuredWorkspaceDir,
  getKnownPathOverrides
});
// ----------------------------------------------------
// Lux Voice Service Subprocess & IPC Handlers
// ----------------------------------------------------
let voiceProcess = null;
let voiceReqId = 0;
const voiceCallbacks = new Map();
let cachedVoicePython = null;
let voiceStderrTail = [];

function resolveVoicePython() {
  if (cachedVoicePython) return cachedVoicePython;
  if (process.env.LUX_PYTHON && fs.existsSync(process.env.LUX_PYTHON)) {
    cachedVoicePython = { cmd: process.env.LUX_PYTHON, prefixArgs: [] };
    return cachedVoicePython;
  }
  // 1) Proje içi sanal ortam (scripts/requirements-voice.txt ile kurulan)
  const projectVenv =
    process.platform === 'win32'
      ? path.join(__dirname, '.venv-voice', 'Scripts', 'python.exe')
      : path.join(__dirname, '.venv-voice', 'bin', 'python');
  if (fs.existsSync(projectVenv)) {
    cachedVoicePython = { cmd: projectVenv, prefixArgs: [] };
    return cachedVoicePython;
  }
  // 2) Windows'ta kullanıcı kurulumu (3.12 önerilir; 3.13 de denenir)
  for (const ver of ['Python312', 'Python313']) {
    const cand = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', ver, 'python.exe');
    if (fs.existsSync(cand)) {
      cachedVoicePython = { cmd: cand, prefixArgs: [] };
      return cachedVoicePython;
    }
  }
  if (process.platform === 'win32') {
    try {
      const probe = spawnSync('py', ['-3.12', '-c', 'import sys; print(sys.executable)'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 4000
      });
      if (probe.status === 0 && probe.stdout && fs.existsSync(probe.stdout.trim())) {
        cachedVoicePython = { cmd: probe.stdout.trim(), prefixArgs: [] };
        return cachedVoicePython;
      }
    } catch (_) {}
  }
  // 3) PATH üzerindeki yorumlayıcılar (Linux/macOS dahil)
  for (const cmd of ['python3.12', 'python3', 'python']) {
    try {
      const probe = spawnSync(cmd, ['-c', 'import sys; print(sys.version_info[0])'], {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 3000
      });
      if (probe.status === 0) {
        cachedVoicePython = { cmd, prefixArgs: [] };
        return cachedVoicePython;
      }
    } catch (_) {}
  }
  console.warn(
    '[voice] Python yorumlayıcısı bulunamadı. scripts/requirements-voice.txt ve LUX_PYTHON değişkenine bakın.'
  );
  cachedVoicePython = { cmd: 'python', prefixArgs: [] };
  return cachedVoicePython;
}

function getVoiceProcess() {
  if (voiceProcess && !voiceProcess.killed && voiceProcess.stdin && !voiceProcess.stdin.destroyed) {
    return voiceProcess;
  }
  voiceProcess = null;
  voiceStderrTail = [];

  const scriptPath = path.join(__dirname, 'scripts', 'voice_service.py');
  const py = resolveVoicePython();
  const proc = spawn(py.cmd, [...py.prefixArgs, scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: buildLuxModelEnv()
  });
  voiceProcess = proc;

  let buffer = '';
  proc.stdout.on('data', (data) => {
    buffer += data.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && voiceCallbacks.has(msg.id)) {
          const cb = voiceCallbacks.get(msg.id);
          voiceCallbacks.delete(msg.id);
          cb(msg);
        }
      } catch (err) {
        console.error('Voice service parse error:', err, trimmed);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const txt = data.toString('utf-8').trim();
    if (txt) {
      for (const ln of txt.split(/\r?\n/)) {
        if (ln.trim()) voiceStderrTail.push(ln.trim());
      }
      if (voiceStderrTail.length > 15) {
        voiceStderrTail = voiceStderrTail.slice(-15);
      }
    }
    console.warn('Voice service stderr:', data.toString());
  });

  proc.on('error', (procErr) => {
    if (voiceProcess === proc) voiceProcess = null;
    for (const [id, cb] of voiceCallbacks.entries()) {
      voiceCallbacks.delete(id);
      cb({ success: false, error: `Voice service process error: ${procErr.message}` });
    }
  });

  proc.on('exit', (code) => {
    if (voiceProcess === proc) voiceProcess = null;
    const tail = voiceStderrTail.slice(-3).join(' | ');
    const errMsg = tail
      ? `Voice service exited unexpectedly (${code}): ${tail}`
      : `Voice service exited unexpectedly (${code})`;
    for (const [id, cb] of voiceCallbacks.entries()) {
      voiceCallbacks.delete(id);
      cb({ success: false, error: errMsg });
    }
  });

  return proc;
}

/**
 * Çalışan bir ses isteğini Python tarafında iptal eder.
 * Kullanıcı yanıtı durdurduğunda çağrılmalı; aksi halde CPU boşa yanar.
 */
ipcMain.handle('voice-cancel', async (event, targetId) => {
  try {
    const idToCancel = Number(targetId) || null;
    // Bekleyen JS callback'lerini de temizle (yanıt gelmeyecek).
    if (idToCancel && voiceCallbacks.has(idToCancel)) {
      const cb = voiceCallbacks.get(idToCancel);
      voiceCallbacks.delete(idToCancel);
      try {
        cb({ success: false, cancelled: true, error: 'İptal edildi' });
      } catch (_) {}
    }
    // Servis çalışmıyorsa SAKIN başlatma — iptal isteği için Python açmak anlamsız.
    if (!voiceProcess || voiceProcess.killed) {
      return { success: true, cancelled: idToCancel, serviceRunning: false };
    }
    const reqId = ++voiceReqId;
    voiceProcess.stdin.write(JSON.stringify({ action: 'cancel', id: reqId, target: idToCancel }) + '\n');
    return { success: true, cancelled: idToCancel, serviceRunning: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('voice-status', async () => {
  return new Promise((resolve) => {
    try {
      const reqId = ++voiceReqId;
      const vp = getVoiceProcess();
      const timeout = setTimeout(() => {
        voiceCallbacks.delete(reqId);
        resolve({ success: false, error: 'Status timed out' });
      }, 10000);

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      vp.stdin.write(
        JSON.stringify({
          action: 'status',
          id: reqId
        }) + '\n'
      );
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// Ses modeli durumu: disk kontrolü (indirme TETİKLEMEZ) — ses düğmeleri öncesi bilgilendirme için
ipcMain.handle('voice-model-status', async () => {
  try {
    const modelsRoot = process.env.LUX_MODELS_DIR || resolveModelsRoot();
    const hfHome = process.env.HF_HOME || path.join(modelsRoot, 'huggingface');
    const hubRoots = [path.join(hfHome, 'hub'), hfHome];
    const whisperRe = /^models--(?:Systran|guillaumekln)--faster-whisper-/;
    let whisperCached = false;
    let whisperModel = '';
    for (const root of hubRoots) {
      try {
        if (!fs.existsSync(root)) continue;
        for (const entry of fs.readdirSync(root)) {
          if (!whisperRe.test(entry)) continue;
          const snapsRoot = path.join(root, entry, 'snapshots');
          try {
            if (fs.existsSync(snapsRoot) && fs.readdirSync(snapsRoot).length > 0) {
              whisperCached = true;
              whisperModel = entry.split('--').pop() || entry;
              break;
            }
          } catch (_) {
            /* bozuk cache girdisi — yok say */
          }
        }
        if (whisperCached) break;
      } catch (_) {
        /* hub kökü okunamadı — diğerine bak */
      }
    }
    let piperVoices = 0;
    try {
      piperVoices = fs.readdirSync(path.join(modelsRoot, 'piper')).filter((f) => /\.onnx$/i.test(f)).length;
    } catch (_) {}
    const kokoroDir = path.join(modelsRoot, 'kokoro');
    const kokoroPresent =
      fs.existsSync(path.join(kokoroDir, 'kokoro-v1.0.onnx')) && fs.existsSync(path.join(kokoroDir, 'voices-v1.0.bin'));
    return { success: true, modelsRoot, whisperCached, whisperModel, piperVoices, kokoroPresent };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('voice-warmup', async (event, options = {}) => {
  return new Promise((resolve) => {
    try {
      const reqId = ++voiceReqId;
      const isHeavyWarmup = /xtts|large/i.test(`${options?.voice || ''} ${options?.sttModel || ''}`);
      const vp = getVoiceProcess();
      const timeout = setTimeout(
        () => {
          voiceCallbacks.delete(reqId);
          resolve({ success: false, error: 'Warmup timed out' });
        },
        isHeavyWarmup ? 180000 : 60000
      );

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      vp.stdin.write(
        JSON.stringify({
          action: 'warmup',
          id: reqId,
          sttModel: options?.sttModel || '',
          voice: options?.voice || '',
          mode: options?.mode || 'auto'
        }) + '\n'
      );
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('voice-transcribe', async (event, audioBase64, language = 'tr-TR', mode = 'auto', sttModel = '') => {
  return new Promise((resolve) => {
    try {
      const reqId = ++voiceReqId;
      const safeAudio = asString(audioBase64, 'audioBase64', { max: MAX_AUDIO_B64 });
      language = asString(language, 'language', { required: false, max: 32 }) || 'tr-TR';
      mode = asString(mode, 'mode', { required: false, max: 32 }) || 'auto';
      sttModel = asString(sttModel, 'sttModel', { required: false, max: 64 });
      const cleanBase64 = safeAudio.replace(/^data:[^;]+;base64,/, '');
      const useInMemory = cleanBase64.length > 0 && cleanBase64.length < 6000000;
      const tempWav = useInMemory ? null : path.join(app.getPath('temp'), `lux_input_${Date.now()}_${reqId}.wav`);
      if (tempWav) {
        fs.writeFileSync(tempWav, Buffer.from(cleanBase64, 'base64'));
      }

      const vp = getVoiceProcess();
      const timeout = setTimeout(() => {
        voiceCallbacks.delete(reqId);
        if (tempWav) {
          try {
            if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
          } catch (e) {}
        }
        resolve({ success: false, error: 'Transcription timed out' });
      }, 60000);

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        if (tempWav) {
          try {
            if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
          } catch (e) {}
        }
        resolve(response);
      });

      vp.stdin.write(
        JSON.stringify({
          action: 'transcribe',
          id: reqId,
          ...(useInMemory ? { wavBase64: cleanBase64 } : { wavPath: tempWav }),
          lang: language || 'tr-TR',
          mode: mode || 'auto',
          sttModel: sttModel || ''
        }) + '\n'
      );
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle(
  'voice-synthesize',
  async (event, text, voice = 'Arlo', speed = 1.0, mode = 'auto', cloneRefPath = '', options = {}) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };
      const cleanupAudioFiles = (...paths) => {
        for (const p of paths) {
          if (!p) continue;
          try {
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch (_) {}
        }
      };
      try {
        const reqId = ++voiceReqId;
        text = asString(text, 'text', { max: MAX_TEXT });
        if (!text.trim()) throw new Error('text boş olamaz');
        voice = asString(voice, 'voice', { required: false, max: 128 }) || 'Arlo';
        cloneRefPath = asString(cloneRefPath, 'cloneRefPath', { required: false, max: MAX_PATH });
        options = asOptions(options);
        speed = asIntInRange(Math.round(Number(speed) * 100), 'speed', { min: 25, max: 400, fallback: 100 }) / 100;
        const voiceStr = String(voice || '');
        const isXtts = /xtts/i.test(voiceStr);
        const isOpenRouterVoice = /^OpenRouter-/i.test(voiceStr);
        const tempMp3 = isXtts ? path.join(app.getPath('temp'), `lux_tts_${Date.now()}_${reqId}.mp3`) : null;
        const derivedWav = tempMp3 ? tempMp3.replace(/\.mp3$/i, '.wav') : null;
        const derivedOgg = tempMp3 ? tempMp3.replace(/\.mp3$/i, '.ogg') : null;
        const timeoutMs = isXtts ? 200000 : 60000;

        let resolvedApiKey = String(
          options?.openrouterApiKey || options?.apiKey || process.env.OPENROUTER_API_KEY || ''
        ).trim();
        if (!resolvedApiKey && isOpenRouterVoice) {
          // 1) Şifreli anahtar kasası (safeStorage) — her durumda dene
          try {
            const secretStore = readSecretsFile();
            resolvedApiKey = String(decryptSecret(secretStore['voice-openrouter']) || '').trim();
          } catch (_) {}
          // 2) Kalıcı durum dosyası — { state, updatedAt } veya düz şekil dene
          if (!resolvedApiKey && fs.existsSync(DATA_FILE)) {
            try {
              const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
              const persisted = saved?.state || saved;
              resolvedApiKey = String(persisted?.voiceMode?.openrouterApiKey || '').trim();
              if (!resolvedApiKey && Array.isArray(persisted?.models)) {
                const orModel = persisted.models.find(
                  (m) => m.provider === 'OpenRouter' || /openrouter\.ai/i.test(m.endpoint || '')
                );
                resolvedApiKey = String(orModel?.apiKey || '').trim();
              }
            } catch (_) {}
          }
        }

        const vp = getVoiceProcess();
        const timeout = setTimeout(() => {
          voiceCallbacks.delete(reqId);
          cleanupAudioFiles(tempMp3, derivedWav, derivedOgg);
          finish({
            success: false,
            error: isXtts ? 'XTTS-v2 sentezleme zaman aşımına uğradı.' : 'Ses sentezleme zaman aşımına uğradı.'
          });
        }, timeoutMs);

        voiceCallbacks.set(reqId, (response) => {
          clearTimeout(timeout);
          if (response?.success && response?.audioBase64) {
            cleanupAudioFiles(response?.file, tempMp3, derivedWav, derivedOgg);
            finish({
              success: true,
              requestId: reqId,
              audioBase64: response.audioBase64,
              voice: response.voice,
              engine: response.engine,
              fallbackFrom: response.fallbackFrom,
              cloneApplied: response.cloneApplied
            });
            return;
          }

          const outPath =
            response?.file && fs.existsSync(response.file)
              ? response.file
              : derivedWav && fs.existsSync(derivedWav)
                ? derivedWav
                : tempMp3 && fs.existsSync(tempMp3)
                  ? tempMp3
                  : null;

          if (response?.success && outPath) {
            try {
              const rawBuf = fs.readFileSync(outPath);
              if (!rawBuf || rawBuf.length < 32) {
                finish({ success: false, error: 'Oluşturulan ses dosyası boş görünüyor.' });
              } else {
                const audioData = rawBuf.toString('base64');
                const mime =
                  response.mimeType ||
                  (outPath.toLowerCase().endsWith('.wav')
                    ? 'audio/wav'
                    : outPath.toLowerCase().endsWith('.ogg')
                      ? 'audio/ogg'
                      : 'audio/mp3');
                finish({
                  success: true,
                  requestId: reqId,
                  audioBase64: `data:${mime};base64,${audioData}`,
                  voice: response.voice,
                  engine: response.engine,
                  fallbackFrom: response.fallbackFrom,
                  cloneApplied: response.cloneApplied
                });
              }
            } catch (readErr) {
              finish({ success: false, error: readErr.message });
            } finally {
              cleanupAudioFiles(outPath, tempMp3, derivedWav, derivedOgg);
            }
          } else {
            cleanupAudioFiles(response?.file, tempMp3, derivedWav, derivedOgg);
            if (response?.success) {
              finish({ success: false, error: 'Ses dosyası diskte bulunamadı.' });
            } else {
              finish(response || { success: false, error: 'Ses sentezleme yanıtı boş.' });
            }
          }
        });

        vp.stdin.write(
          JSON.stringify({
            action: 'synthesize',
            id: reqId,
            text,
            voice: voice || 'Arlo',
            rate: speed || 1.0,
            outPath: tempMp3,
            mode: mode || 'auto',
            cloneRefPath: cloneRefPath || '',
            apiKey: resolvedApiKey,
            returnBase64: true
          }) + '\n'
        );
      } catch (err) {
        finish({ success: false, error: err.message });
      }
    });
  }
);

app.whenReady().then(() => {
  // İkinci kopya: app.quit() zaten çağrıldı, pencere açma.
  if (!gotSingleInstanceLock) return;
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  try {
    logger.flush();
  } catch (_) {}
  if (stateWriteTimer) {
    clearTimeout(stateWriteTimer);
    flushStateWrite();
  }
  if (voiceProcess && !voiceProcess.killed) {
    try {
      voiceProcess.stdin.write(JSON.stringify({ action: 'shutdown', id: 0 }) + '\n');
    } catch (_) {}
    if (process.platform === 'win32' && voiceProcess.pid) {
      try {
        spawnSync('taskkill', ['/pid', String(voiceProcess.pid), '/T', '/F'], { windowsHide: true, timeout: 1500 });
      } catch (_) {}
    }
    try {
      voiceProcess.kill();
    } catch (e) {}
    voiceProcess = null;
  }
  for (const child of Array.from(activeTerminalChildren)) {
    try {
      child.kill();
    } catch (_) {}
  }
  activeTerminalChildren.clear();
  if (managedOllamaProcess && !managedOllamaProcess.killed) {
    if (process.platform === 'win32' && managedOllamaProcess.pid) {
      try {
        spawnSync('taskkill', ['/pid', String(managedOllamaProcess.pid), '/T', '/F'], {
          windowsHide: true,
          timeout: 1500
        });
      } catch (_) {}
    }
    try {
      managedOllamaProcess.kill();
    } catch (e) {}
    managedOllamaProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
