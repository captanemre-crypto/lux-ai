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
      ipcRenderer.on('window-state-changed', (event, data) => callback(data));
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
    onData: (callback) => {
      ipcRenderer.on('terminal-data', (event, data) => callback(data));
    }
  },

  // Antigravity Neural Voice & Transcription API (Online + Offline Neural + Local D: Suites)
  voice: {
    transcribe: (audioBase64, language, mode, sttModel) => ipcRenderer.invoke('voice-transcribe', audioBase64, language, mode, sttModel),
    synthesize: (text, voice, speed, mode, cloneRefPath, options) => ipcRenderer.invoke('voice-synthesize', text, voice, speed, mode, cloneRefPath, options),
    pickCloneAudio: () => ipcRenderer.invoke('dialog-open-audio'),
    getStatus: () => ipcRenderer.invoke('voice-status'),
    warmup: (options) => ipcRenderer.invoke('voice-warmup', options)
  }
});
