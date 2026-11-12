const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('luxAPI', {
  // Window management
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    devtools: () => ipcRenderer.invoke('window-devtools'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onWindowStateChanged: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('window-state-changed', listener);
      return () => ipcRenderer.removeListener('window-state-changed', listener);
    }
  },

  // App details
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  setWorkspaceDir: (dirPath) => ipcRenderer.invoke('set-workspace-dir', dirPath),
  openDirectory: (dirPath) => ipcRenderer.invoke('shell-open-path', dirPath),
  pickFolder: () => ipcRenderer.invoke('dialog-open-folder'),
  pickFile: () => ipcRenderer.invoke('dialog-open-file'),
  ensureOllama: () => ipcRenderer.invoke('ollama-ensure'),

  // Storage
  storage: {
    load: () => ipcRenderer.invoke('storage-load'),
    save: (data) => ipcRenderer.invoke('storage-save', data),
    wipe: () => ipcRenderer.invoke('storage-wipe')
  },

  // Durable state (main process JSON + atomik yazma; localStorage'a ek güvence)
  state: {
    loadDurable: () => ipcRenderer.invoke('state-load-durable'),
    saveDurable: (payload) => ipcRenderer.invoke('state-save-durable', payload)
  },

  // Güvenli anahtar kasası (safeStorage / AES-256-GCM). Anahtarlar renderer'a
  // yalnızca gerektiğinde (istek anında) döner, diske düz metin yazılmaz.
  secrets: {
    set: (id, plainKey) => ipcRenderer.invoke('secrets-set', id, plainKey),
    get: (id) => ipcRenderer.invoke('secrets-get', id),
    status: () => ipcRenderer.invoke('secrets-status'),
    rotate: () => ipcRenderer.invoke('secrets-rotate'),
    clear: () => ipcRenderer.invoke('secrets-clear')
  },

  // Filesystem (supports workspace, Desktop/Masaüstü, ~, project aliases)
  fs: {
    listFiles: (dirPath, options) => ipcRenderer.invoke('fs-list-files', dirPath, options),
    listDesktopProjects: (workspaceDir) => ipcRenderer.invoke('fs-list-desktop-projects', workspaceDir),
    readFile: (filePath, options) => ipcRenderer.invoke('fs-read-file', filePath, options),
    writeFile: (filePath, content, options) => ipcRenderer.invoke('fs-write-file', filePath, content, options),
    deletePath: (targetPath, options) => ipcRenderer.invoke('fs-delete-path', targetPath, options),
    movePath: (srcPath, destPath, options) => ipcRenderer.invoke('fs-move-path', srcPath, destPath, options),
    mkdir: (dirPath, options) => ipcRenderer.invoke('fs-mkdir', dirPath, options),
    search: (query, dirPath, options) => ipcRenderer.invoke('fs-search', query, dirPath, options)
  },

  // Autonomous Unlimited Agent Capabilities (Internet, Images, Screen, PC Control)
  agent: {
    webSearch: (query, options) => ipcRenderer.invoke('agent-web-search', query, options),
    fetchUrl: (url, options) => ipcRenderer.invoke('agent-web-fetch', url, options),
    imageSearch: (query, options) => ipcRenderer.invoke('agent-image-search', query, options),
    imageGenerate: (payload) => ipcRenderer.invoke('agent-image-generate', payload),
    captureScreen: (payload) => ipcRenderer.invoke('agent-capture-screen', payload),
    pcControl: (payload) => ipcRenderer.invoke('agent-pc-control', payload)
  },

  // Git & Code Review Diff Engine
  git: {
    getDiff: (cwd) => ipcRenderer.invoke('git-diff', cwd),
    action: (payload) => ipcRenderer.invoke('git-action', payload)
  },

  // Terminal
  terminal: {
    execute: (command, cwd, timeoutMs) => ipcRenderer.invoke('terminal-execute', command, cwd, timeoutMs),
    /**
     * Canlı çıktı dinleyicisi. Geriye abonelikten çıkma fonksiyonu döner —
     * panel her açıldığında yeni dinleyici birikmesini (bellek sızıntısı)
     * engellemek için mutlaka çağırın:
     *   const off = luxAPI.terminal.onData(({runId, stream, text}) => {...});
     *   // panel kapanırken
     *   off();
     */
    onData: (callback) => {
      const listener = (event, payload) => callback(payload);
      ipcRenderer.on('terminal-data', listener);
      return () => ipcRenderer.removeListener('terminal-data', listener);
    }
  },

  // Eklenti bağımlılıkları (plugin_system.js)
  plugins: {
    checkDependency: (packageName) => ipcRenderer.invoke('plugins-check-dependency', packageName),
    installDependency: (packageName) => ipcRenderer.invoke('plugins-install-dependency', packageName)
  },

  // Günlükler (main süreçteki app.log dosyası)
  logs: {
    read: (maxBytes) => ipcRenderer.invoke('logs-read', maxBytes),
    clear: () => ipcRenderer.invoke('logs-clear'),
    openFolder: () => ipcRenderer.invoke('logs-open-folder')
  },

  // Yedekleme (.luxbackup dışa/içe aktarma)
  backup: {
    export: (password) => ipcRenderer.invoke('backup-export', password),
    import: (password) => ipcRenderer.invoke('backup-import', password)
  },

  // Otomatik güncelleme (üretim paketinde electron-updater)
  updates: {
    checkNow: () => ipcRenderer.invoke('update-check-now'),
    quitAndInstall: () => ipcRenderer.invoke('update-quit-and-install'),
    onStatus: (callback) => {
      const listener = (event, payload) => callback(payload);
      ipcRenderer.on('update-status', listener);
      return () => ipcRenderer.removeListener('update-status', listener);
    }
  },

  // Lux Neural Voice & Transcription API (Online + Offline Neural + Local D: Suites)
  voice: {
    transcribe: (audioBase64, language, mode, sttModel) =>
      ipcRenderer.invoke('voice-transcribe', audioBase64, language, mode, sttModel),
    cancel: (requestId) => ipcRenderer.invoke('voice-cancel', requestId),
    synthesize: (text, voice, speed, mode, cloneRefPath, options) =>
      ipcRenderer.invoke('voice-synthesize', text, voice, speed, mode, cloneRefPath, options),
    pickCloneAudio: () => ipcRenderer.invoke('dialog-open-audio'),
    getStatus: () => ipcRenderer.invoke('voice-status'),
    modelStatus: () => ipcRenderer.invoke('voice-model-status'),
    warmup: (options) => ipcRenderer.invoke('voice-warmup', options)
  }
});
