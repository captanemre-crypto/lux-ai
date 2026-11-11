const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, session, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execFile, spawnSync } = require('child_process');
const agentCaps = require('./scripts/agent_capabilities');

// Enforce dark mode for OS native popups, menus and system controls
nativeTheme.themeSource = 'dark';

let mainWindow = null;
let configuredWorkspaceDir = process.cwd();
let managedOllamaProcess = null;
const DATA_FILE = path.join(app.getPath('userData'), 'lux_ai_data.json');
const MEDIA_CACHE_DIR = path.join(app.getPath('userData'), 'lux_media');
const DEFAULT_LUX_MODELS_DIR = 'D:\\LuxAI_Models';

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
      try { req.destroy(); } catch (_) {}
      resolve({ listening: false, modelsCount: 0, models: [] });
    });
  });
}

function resolveOllamaExecutable() {
  const localApp = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localApp, 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
    'ollama'
  ];
  for (const c of candidates) {
    if (c === 'ollama' || fs.existsSync(c)) return c;
  }
  return null;
}

async function ensureOllamaRunning() {
  const env = buildLuxModelEnv();
  const initial = await checkOllamaListening();
  if (initial.listening) {
    const manifestsDir = env.OLLAMA_MODELS ? path.join(env.OLLAMA_MODELS, 'manifests') : '';
    const hasLocalManifests = Boolean(manifestsDir && fs.existsSync(manifestsDir));
    if (initial.modelsCount === 0 && hasLocalManifests && managedOllamaProcess && !managedOllamaProcess.killed) {
      if (process.platform === 'win32' && managedOllamaProcess.pid) {
        try { spawnSync('taskkill', ['/pid', String(managedOllamaProcess.pid), '/T', '/F'], { windowsHide: true, timeout: 1500 }); } catch (_) {}
      }
      try { managedOllamaProcess.kill(); } catch (_) {}
      managedOllamaProcess = null;
      await new Promise((r) => setTimeout(r, 300));
    } else {
      return { running: true, startedByLux: false, modelsCount: initial.modelsCount, modelsDir: env.OLLAMA_MODELS || '' };
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
    }
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const status = await checkOllamaListening();
      if (status.listening) {
        return { running: true, startedByLux: true, modelsCount: status.modelsCount, modelsDir: env.OLLAMA_MODELS || '' };
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
    titleBarOverlay: isWin ? {
      color: '#111114',
      symbolColor: '#FFFFFF',
      height: 35
    } : false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Grant microphone and audio media permissions for voice mode
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
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
    const appIndexUrl = new URL('file:///' + path.join(__dirname, 'src', 'index.html').replace(/\\/g, '/')).href.toLowerCase();
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
    version: '1.0.0',
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
  if (dirPath && typeof dirPath === 'string' && fs.existsSync(dirPath)) {
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
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
    fileEditSnapshots.clear();
    if (fs.existsSync(MEDIA_CACHE_DIR)) {
      fs.rmSync(MEDIA_CACHE_DIR, { recursive: true, force: true });
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to wipe storage:', err);
    return { success: false, error: err.message };
  }
});

// Session-scoped edit snapshots for code review diffs even when .git is not initialized
const fileEditSnapshots = new Map();

function buildUnifiedLineDiff(relPath, oldText, newText) {
  const oldLines = (oldText || '').replace(/\r\n/g, '\n').split('\n');
  const newLines = (newText || '').replace(/\r\n/g, '\n').split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  // Guard size for very large files
  if (n * m > 250000) {
    let additions = Math.max(0, m - n);
    let deletions = Math.max(0, n - m);
    const preview = [
      `--- a/${relPath}`,
      `+++ b/${relPath}`,
      `@@ -1,${Math.min(n, 20)} +1,${Math.min(m, 20)} @@`,
      ...newLines.slice(0, 30).map(l => `+${l}`)
    ].join('\n');
    return { additions, deletions, diffText: preview };
  }

  // Standard Myers-style DP LCS table for exact line diffs
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const ops = [];
  let i = 0, j = 0;
  let additions = 0, deletions = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: ' ', text: oldLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: '-', text: oldLines[i] });
      deletions++;
      i++;
    } else {
      ops.push({ type: '+', text: newLines[j] });
      additions++;
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: '-', text: oldLines[i++] });
    deletions++;
  }
  while (j < m) {
    ops.push({ type: '+', text: newLines[j++] });
    additions++;
  }

  // Keep changed regions + up to 2 context lines
  const linesOut = [`--- a/${relPath}`, `+++ b/${relPath}`, `@@ -1,${n} +1,${m} @@`];
  const keepIdx = new Set();
  ops.forEach((op, idx) => {
    if (op.type !== ' ') {
      for (let k = Math.max(0, idx - 2); k <= Math.min(ops.length - 1, idx + 2); k++) {
        keepIdx.add(k);
      }
    }
  });

  if (keepIdx.size === 0) {
    return { additions: 0, deletions: 0, diffText: '' };
  }

  let prevKept = -1;
  Array.from(keepIdx).sort((a, b) => a - b).forEach((idx) => {
    if (prevKept !== -1 && idx > prevKept + 1) {
      linesOut.push('@@ ... @@');
    }
    const op = ops[idx];
    linesOut.push(`${op.type}${op.text}`);
    prevKept = idx;
  });

  return { additions, deletions, diffText: linesOut.join('\n') };
}

function runExecFile(cmd, args, cwd) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: cwd || process.cwd(), maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        code: err ? (err.code || 1) : 0,
        stdout: stdout || '',
        stderr: stderr || '',
        error: err ? err.message : null
      });
    });
  });
}

// File System & OS Dialog operations for Editor, Explorer & Settings
ipcMain.handle('shell-open-path', async (event, targetPath) => {
  try {
    const resolved = targetPath
      ? agentCaps.resolveSmartPath(targetPath, configuredWorkspaceDir, getKnownPathOverrides())
      : (configuredWorkspaceDir || process.cwd());
    const fallback = fs.existsSync(resolved) ? resolved : (configuredWorkspaceDir || process.cwd());
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
    const absPath = agentCaps.resolveSmartPath(
      filePath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    const existed = fs.existsSync(absPath);
    if (!fileEditSnapshots.has(absPath)) {
      let orig = '';
      if (existed) {
        try { orig = fs.readFileSync(absPath, 'utf-8'); } catch (_) {}
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
    const absPath = agentCaps.resolveSmartPath(
      targetPath,
      options?.workspaceDir || configuredWorkspaceDir,
      getKnownPathOverrides(options || {})
    );
    if (!fs.existsSync(absPath)) {
      return { success: false, error: `Silinecek hedef bulunamadı: ${absPath}` };
    }
    fs.rmSync(absPath, { recursive: true, force: true });
    return { success: true, path: absPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-move-path', async (event, srcPath, destPath, options = {}) => {
  try {
    const ov = getKnownPathOverrides(options || {});
    const ws = options?.workspaceDir || configuredWorkspaceDir;
    const absSrc = agentCaps.resolveSmartPath(srcPath, ws, ov);
    const absDest = agentCaps.resolveSmartPath(destPath, ws, ov);
    if (!fs.existsSync(absSrc)) {
      return { success: false, error: `Kaynak bulunamadı: ${absSrc}` };
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

// Git Diff & Code Review IPCs (Supports both real Git repos and fallback edit snapshots)
ipcMain.handle('git-diff', async (event, cwd) => {
  const targetCwd = cwd ? (path.isAbsolute(cwd) ? cwd : path.resolve(process.cwd(), cwd)) : process.cwd();
  const inside = await runExecFile('git', ['rev-parse', '--is-inside-work-tree'], targetCwd);

  if (inside.code === 0 && inside.stdout.trim() === 'true') {
    const branchRes = await runExecFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], targetCwd);
    const branch = branchRes.code === 0 ? branchRes.stdout.trim() : 'HEAD';
    const statusRes = await runExecFile('git', ['status', '--porcelain=v1', '-uall'], targetCwd);
    const lines = statusRes.stdout.split(/\r?\n/).filter(Boolean);
    const files = [];

    for (const rawLine of lines.slice(0, 40)) {
      const xy = rawLine.slice(0, 2);
      let relPath = rawLine.slice(3).trim();
      if (relPath.includes(' -> ')) relPath = relPath.split(' -> ').pop();
      relPath = relPath.replace(/^"|"$/g, '');
      const fullPath = path.resolve(targetCwd, relPath);
      const isUntracked = xy === '??';
      const staged = xy[0] !== ' ' && xy[0] !== '?';
      let statusLabel = 'Değiştirildi';
      if (isUntracked || xy[0] === 'A' || xy[1] === 'A') statusLabel = 'Yeni';
      else if (xy[0] === 'D' || xy[1] === 'D') statusLabel = 'Silindi';

      let diffText = '';
      let additions = 0;
      let deletions = 0;

      if (isUntracked) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size < 250000) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const fLines = content.split(/\r?\n/);
            additions = fLines.length;
            diffText = [`--- /dev/null`, `+++ b/${relPath}`, `@@ -0,0 +1,${fLines.length} @@`, ...fLines.slice(0, 120).map(l => `+${l}`)].join('\n');
          }
        } catch (_) {}
      } else {
        const diffRes = await runExecFile('git', ['diff', '--no-color', '--', relPath], targetCwd);
        let dText = diffRes.stdout;
        if (!dText.trim()) {
          const stagedDiff = await runExecFile('git', ['diff', '--cached', '--no-color', '--', relPath], targetCwd);
          dText = stagedDiff.stdout;
        }
        diffText = dText;
        dText.split(/\r?\n/).forEach(l => {
          if (l.startsWith('+') && !l.startsWith('+++')) additions++;
          else if (l.startsWith('-') && !l.startsWith('---')) deletions++;
        });
      }

      files.push({
        path: relPath.replace(/\\/g, '/'),
        fullPath,
        status: statusLabel,
        staged,
        isUntracked,
        additions,
        deletions,
        diffText
      });
    }

    return { isGitRepo: true, branch, cwd: targetCwd, files };
  }

  // Fallback: session file edit snapshots when .git is not initialized
  const files = [];
  for (const [absPath, snap] of fileEditSnapshots.entries()) {
    const relPath = path.relative(targetCwd, absPath).replace(/\\/g, '/');
    let curContent = '';
    const existsNow = fs.existsSync(absPath);
    if (existsNow) {
      try { curContent = fs.readFileSync(absPath, 'utf-8'); } catch (_) {}
    }
    const { additions, deletions, diffText } = buildUnifiedLineDiff(relPath, snap.originalContent, curContent);
    if (additions > 0 || deletions > 0) {
      files.push({
        path: relPath,
        fullPath: absPath,
        status: snap.existsBefore ? (existsNow ? 'Değiştirildi' : 'Silindi') : 'Yeni',
        staged: false,
        isSnapshot: true,
        additions,
        deletions,
        diffText
      });
    }
  }

  return { isGitRepo: false, branch: null, cwd: targetCwd, files };
});

ipcMain.handle('git-action', async (event, payload = {}) => {
  const { action, filePath, cwd } = payload;
  const targetCwd = cwd ? (path.isAbsolute(cwd) ? cwd : path.resolve(process.cwd(), cwd)) : process.cwd();

  if (action === 'init') {
    const res = await runExecFile('git', ['init'], targetCwd);
    return { success: res.code === 0, output: res.stdout || res.stderr };
  }

  const absPath = filePath ? (path.isAbsolute(filePath) ? filePath : path.resolve(targetCwd, filePath)) : '';
  const relPath = absPath ? path.relative(targetCwd, absPath).replace(/\\/g, '/') : '';
  const inside = await runExecFile('git', ['rev-parse', '--is-inside-work-tree'], targetCwd);
  const isGitRepo = inside.code === 0 && inside.stdout.trim() === 'true';

  if (action === 'stage') {
    if (isGitRepo && relPath) {
      const res = await runExecFile('git', ['add', '--', relPath], targetCwd);
      fileEditSnapshots.delete(absPath);
      return { success: res.code === 0, error: res.stderr };
    }
    if (absPath) fileEditSnapshots.delete(absPath);
    return { success: true };
  }

  if (action === 'discard') {
    if (fileEditSnapshots.has(absPath)) {
      const snap = fileEditSnapshots.get(absPath);
      if (snap.existsBefore) {
        fs.writeFileSync(absPath, snap.originalContent, 'utf-8');
      } else if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
      fileEditSnapshots.delete(absPath);
      return { success: true };
    }
    if (isGitRepo && relPath) {
      const res = await runExecFile('git', ['checkout', '--', relPath], targetCwd);
      return { success: res.code === 0, error: res.stderr };
    }
    return { success: false, error: 'Geri alınacak değişiklik bulunamadı' };
  }

  if (action === 'clear-snapshots') {
    fileEditSnapshots.clear();
    return { success: true };
  }

  return { success: false, error: 'Bilinmeyen işlem' };
});

// Terminal execution (with UTF-8 support, smart cwd resolution & 90s default timeout guard)
ipcMain.handle('terminal-execute', (event, command, cwd, timeoutMs = 90000) => {
  return new Promise((resolve) => {
    const resolvedCwd = cwd
      ? agentCaps.resolveSmartPath(cwd, configuredWorkspaceDir, getKnownPathOverrides())
      : (configuredWorkspaceDir || process.cwd());
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

    let output = '';
    let errorOutput = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch (_) {}
      resolve({
        code: 124,
        output,
        error: `${errorOutput}\n[Zaman aşımı: Komut ${Math.round(timeoutMs / 1000)}sn içinde tamamlanmadı]`.trim()
      });
    }, Math.max(2000, Math.min(300000, Number(timeoutMs) || 90000)));

    child.stdout.on('data', (data) => {
      const text = data.toString('utf-8');
      output += text;
      mainWindow?.webContents.send('terminal-data', text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString('utf-8');
      errorOutput += text;
      mainWindow?.webContents.send('terminal-data', text);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        output,
        error: errorOutput
      });
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: 1,
        output,
        error: err.message
      });
    });
  });
});

// ----------------------------------------------------
// Antigravity Unlimited Agent IPCs (Web, Image Search/Gen, Screen, PC Control)
// ----------------------------------------------------
async function renderStudioDesignPng(htmlContent, outPath, width = 1024, height = 768) {
  let offWin = null;
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    offWin = new BrowserWindow({
      width,
      height,
      show: false,
      backgroundColor: '#070709',
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    await offWin.loadURL(dataUrl);
    await new Promise((r) => setTimeout(r, 220));
    const nativeImg = await offWin.webContents.capturePage();
    const pngBuf = nativeImg.toPNG();
    fs.writeFileSync(outPath, pngBuf);
    return {
      success: pngBuf.length > 0,
      localPath: outPath,
      fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
      format: 'png',
      sizeBytes: pngBuf.length,
      engine: 'lux-studio-canvas'
    };
  } finally {
    if (offWin && !offWin.isDestroyed()) {
      try { offWin.destroy(); } catch (_) {}
    }
  }
}

ipcMain.handle('agent-web-search', async (event, query, options = {}) => {
  try {
    return await agentCaps.webSearch(query, options);
  } catch (err) {
    return { success: false, error: err.message, results: [] };
  }
});

ipcMain.handle('agent-web-fetch', async (event, url, options = {}) => {
  try {
    return await agentCaps.fetchWebpage(url, options);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('agent-image-search', async (event, query, options = {}) => {
  try {
    const saveDir = options?.saveDir
      ? agentCaps.resolveSmartPath(options.saveDir, configuredWorkspaceDir, getKnownPathOverrides())
      : MEDIA_CACHE_DIR;
    return await agentCaps.searchAndDownloadImages(query, {
      count: options?.count || 2,
      saveDir
    });
  } catch (err) {
    return { success: false, error: err.message, images: [] };
  }
});

ipcMain.handle('agent-image-generate', async (event, payload = {}) => {
  try {
    const prompt = String(payload.prompt || payload.title || 'Lux AI Visual Design').trim();
    const width = Math.max(320, Math.min(1600, Number(payload.width) || 1024));
    const height = Math.max(240, Math.min(1200, Number(payload.height) || 768));
    const slug = prompt.toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'tasarim';
    const baseOut = payload.outputPath
      ? agentCaps.resolveSmartPath(payload.outputPath, configuredWorkspaceDir, getKnownPathOverrides())
      : path.join(MEDIA_CACHE_DIR, `${slug}_${Date.now()}`);

    const wantsStudioOnly = Boolean(payload.htmlOrSvg) || payload.engine === 'studio' || /\b(diyagram|şema|tablo|kart|sunum|ui|arayüz|poster\s*yazı)\b/i.test(prompt);
    if (!wantsStudioOnly) {
      const aiRes = await agentCaps.generateAiImageViaPollinations(prompt, baseOut, {
        width,
        height,
        style: payload.style || ''
      });
      if (aiRes) {
        return { success: true, prompt, ...aiRes };
      }
    }

    const html = agentCaps.buildCreativeStudioHtml(prompt, {
      width,
      height,
      title: payload.title || prompt,
      htmlOrSvg: payload.htmlOrSvg || ''
    });
    const parsedOut = path.parse(baseOut);
    const pngOut = parsedOut.ext ? path.join(parsedOut.dir, `${parsedOut.name}.png`) : `${baseOut}.png`;
    const studioRes = await renderStudioDesignPng(html, pngOut, width, height);
    return { success: studioRes.success, prompt, ...studioRes };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('agent-capture-screen', async (event, payload = {}) => {
  try {
    const rawOut = payload?.outputPath;
    const outPath = rawOut
      ? agentCaps.resolveSmartPath(rawOut, configuredWorkspaceDir, getKnownPathOverrides())
      : path.join(MEDIA_CACHE_DIR, `ekran_${Date.now()}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      if (sources && sources.length > 0 && sources[0].thumbnail && !sources[0].thumbnail.isEmpty()) {
        const pngBuf = sources[0].thumbnail.toPNG();
        if (pngBuf.length > 1000) {
          fs.writeFileSync(outPath, pngBuf);
          return {
            success: true,
            localPath: outPath,
            fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
            sizeBytes: pngBuf.length,
            engine: 'electron-desktop-capturer'
          };
        }
      }
    } catch (_) {}

    const psRes = await agentCaps.captureScreenWithPowershell(outPath);
    if (psRes.success && fs.existsSync(outPath)) {
      const sizeBytes = fs.statSync(outPath).size;
      return {
        success: true,
        localPath: outPath,
        fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
        sizeBytes,
        resolution: psRes.output,
        engine: 'powershell-screen-capture'
      };
    }
    return { success: false, error: psRes.error || 'Ekran görüntüsü alınamadı.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('agent-pc-control', async (event, payload = {}) => {
  try {
    return await agentCaps.pcControl(payload, {
      ...getKnownPathOverrides(),
      clipboard,
      shell
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ----------------------------------------------------
// Antigravity Voice Service Subprocess & IPC Handlers
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
  const winPy312 = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
  if (winPy312 && fs.existsSync(winPy312)) {
    cachedVoicePython = { cmd: winPy312, prefixArgs: [] };
    return cachedVoicePython;
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

      vp.stdin.write(JSON.stringify({
        action: 'status',
        id: reqId
      }) + '\n');
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('voice-warmup', async (event, options = {}) => {
  return new Promise((resolve) => {
    try {
      const reqId = ++voiceReqId;
      const isHeavyWarmup = /xtts|large/i.test(`${options?.voice || ''} ${options?.sttModel || ''}`);
      const vp = getVoiceProcess();
      const timeout = setTimeout(() => {
        voiceCallbacks.delete(reqId);
        resolve({ success: false, error: 'Warmup timed out' });
      }, isHeavyWarmup ? 180000 : 60000);

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      vp.stdin.write(JSON.stringify({
        action: 'warmup',
        id: reqId,
        sttModel: options?.sttModel || '',
        voice: options?.voice || '',
        mode: options?.mode || 'auto'
      }) + '\n');
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('voice-transcribe', async (event, audioBase64, language = 'tr-TR', mode = 'auto', sttModel = '') => {
  return new Promise((resolve) => {
    try {
      const reqId = ++voiceReqId;
      const cleanBase64 = String(audioBase64 || '').replace(/^data:[^;]+;base64,/, '');
      const useInMemory = cleanBase64.length > 0 && cleanBase64.length < 6000000;
      const tempWav = useInMemory ? null : path.join(app.getPath('temp'), `lux_input_${Date.now()}_${reqId}.wav`);
      if (tempWav) {
        fs.writeFileSync(tempWav, Buffer.from(cleanBase64, 'base64'));
      }

      const vp = getVoiceProcess();
      const timeout = setTimeout(() => {
        voiceCallbacks.delete(reqId);
        if (tempWav) {
          try { if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav); } catch (e) {}
        }
        resolve({ success: false, error: 'Transcription timed out' });
      }, 60000);

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        if (tempWav) {
          try { if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav); } catch (e) {}
        }
        resolve(response);
      });

      vp.stdin.write(JSON.stringify({
        action: 'transcribe',
        id: reqId,
        ...(useInMemory ? { wavBase64: cleanBase64 } : { wavPath: tempWav }),
        lang: language || 'tr-TR',
        mode: mode || 'auto',
        sttModel: sttModel || ''
      }) + '\n');
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('voice-synthesize', async (event, text, voice = 'Arlo', speed = 1.0, mode = 'auto', cloneRefPath = '', options = {}) => {
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
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
      }
    };
    try {
      const reqId = ++voiceReqId;
      const voiceStr = String(voice || '');
      const isXtts = /xtts/i.test(voiceStr);
      const isOpenRouterVoice = /^OpenRouter-/i.test(voiceStr);
      const tempMp3 = isXtts ? path.join(app.getPath('temp'), `lux_tts_${Date.now()}_${reqId}.mp3`) : null;
      const derivedWav = tempMp3 ? tempMp3.replace(/\.mp3$/i, '.wav') : null;
      const derivedOgg = tempMp3 ? tempMp3.replace(/\.mp3$/i, '.ogg') : null;
      const timeoutMs = isXtts ? 200000 : 60000;

      let resolvedApiKey = String(options?.openrouterApiKey || options?.apiKey || process.env.OPENROUTER_API_KEY || '').trim();
      if (!resolvedApiKey && isOpenRouterVoice) {
        try {
          if (fs.existsSync(DATA_FILE)) {
            const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            resolvedApiKey = String(saved?.voiceMode?.openrouterApiKey || '').trim();
            if (!resolvedApiKey && Array.isArray(saved?.models)) {
              const orModel = saved.models.find(m => m.provider === 'OpenRouter' || /openrouter\.ai/i.test(m.endpoint || ''));
              resolvedApiKey = String(orModel?.apiKey || '').trim();
            }
          }
        } catch (_) {}
      }

      const vp = getVoiceProcess();
      const timeout = setTimeout(() => {
        voiceCallbacks.delete(reqId);
        cleanupAudioFiles(tempMp3, derivedWav, derivedOgg);
        finish({ success: false, error: isXtts ? 'XTTS-v2 sentezleme zaman aşımına uğradı.' : 'Ses sentezleme zaman aşımına uğradı.' });
      }, timeoutMs);

      voiceCallbacks.set(reqId, (response) => {
        clearTimeout(timeout);
        if (response?.success && response?.audioBase64) {
          cleanupAudioFiles(response?.file, tempMp3, derivedWav, derivedOgg);
          finish({
            success: true,
            audioBase64: response.audioBase64,
            voice: response.voice,
            engine: response.engine,
            fallbackFrom: response.fallbackFrom,
            cloneApplied: response.cloneApplied
          });
          return;
        }

        const outPath = (response?.file && fs.existsSync(response.file))
          ? response.file
          : (derivedWav && fs.existsSync(derivedWav) ? derivedWav : (tempMp3 && fs.existsSync(tempMp3) ? tempMp3 : null));

        if (response?.success && outPath) {
          try {
            const rawBuf = fs.readFileSync(outPath);
            if (!rawBuf || rawBuf.length < 32) {
              finish({ success: false, error: 'Oluşturulan ses dosyası boş görünüyor.' });
            } else {
              const audioData = rawBuf.toString('base64');
              const mime = response.mimeType || (outPath.toLowerCase().endsWith('.wav') ? 'audio/wav' : (outPath.toLowerCase().endsWith('.ogg') ? 'audio/ogg' : 'audio/mp3'));
              finish({
                success: true,
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

      vp.stdin.write(JSON.stringify({
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
      }) + '\n');
    } catch (err) {
      finish({ success: false, error: err.message });
    }
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (voiceProcess && !voiceProcess.killed) {
    try { voiceProcess.stdin.write(JSON.stringify({ action: 'shutdown', id: 0 }) + '\n'); } catch (_) {}
    if (process.platform === 'win32' && voiceProcess.pid) {
      try { spawnSync('taskkill', ['/pid', String(voiceProcess.pid), '/T', '/F'], { windowsHide: true, timeout: 1500 }); } catch (_) {}
    }
    try { voiceProcess.kill(); } catch (e) {}
    voiceProcess = null;
  }
  if (managedOllamaProcess && !managedOllamaProcess.killed) {
    if (process.platform === 'win32' && managedOllamaProcess.pid) {
      try { spawnSync('taskkill', ['/pid', String(managedOllamaProcess.pid), '/T', '/F'], { windowsHide: true, timeout: 1500 }); } catch (_) {}
    }
    try { managedOllamaProcess.kill(); } catch (e) {}
    managedOllamaProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
