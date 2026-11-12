// Dosya listeleme / arama / masaüstü projeleri
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getKnownDirs, resolveSmartPath } = require('./paths');

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build']);

function prioritizeSampleFiles(names) {
  if (!Array.isArray(names) || names.length === 0) return [];
  const rank = (n) => {
    const low = String(n || '').toLowerCase();
    if (/^(package\.json|main\.js|index\.html|app\.py|server\.js|readme\.md|preload\.js)$/.test(low)) return 0;
    if (/\.(js|mjs|ts|tsx|py|html|css|json|md|bat|ps1)$/i.test(low)) return 1;
    if (/\.(png|jpe?g|gif|webp|mp3|wav)$/i.test(low)) return 3;
    return 2;
  };
  return names
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, 6);
}

function listDesktopProjects(workspaceDir, knownOverrides = {}) {
  const dirs = getKnownDirs({ ...knownOverrides, workspaceDir });
  const projects = [];
  const seenPaths = new Set();

  const scanRoot = (rootDir, sourceLabel) => {
    if (!rootDir || !fs.existsSync(rootDir)) return;
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(rootDir, entry.name);
        const key = full.toLowerCase();
        if (seenPaths.has(key)) continue;
        seenPaths.add(key);

        let allTopFiles = [];
        let fileCount = 0;
        let dirCount = 0;
        try {
          const children = fs.readdirSync(full, { withFileTypes: true });
          for (const ch of children) {
            if (ch.name.startsWith('.') || SKIP_DIRS.has(ch.name)) continue;
            if (ch.isDirectory()) {
              dirCount++;
            } else {
              fileCount++;
              allTopFiles.push(ch.name);
            }
          }
        } catch (_) {}

        projects.push({
          name: entry.name,
          path: full,
          source: sourceLabel,
          isActiveWorkspace: full.toLowerCase() === dirs.workspace.toLowerCase(),
          topLevelFileCount: fileCount,
          topLevelDirCount: dirCount,
          sampleFiles: prioritizeSampleFiles(allTopFiles)
        });
      }
    } catch (_) {}
  };

  if (dirs.workspace && fs.existsSync(dirs.workspace)) {
    const wsKey = dirs.workspace.toLowerCase();
    seenPaths.add(wsKey);
    let allTopFiles = [];
    let fileCount = 0;
    let dirCount = 0;
    try {
      for (const ch of fs.readdirSync(dirs.workspace, { withFileTypes: true })) {
        if (ch.name.startsWith('.') || SKIP_DIRS.has(ch.name)) continue;
        if (ch.isDirectory()) dirCount++;
        else {
          fileCount++;
          allTopFiles.push(ch.name);
        }
      }
    } catch (_) {}
    projects.push({
      name: path.basename(dirs.workspace),
      path: dirs.workspace,
      source: 'Aktif Çalışma Alanı',
      isActiveWorkspace: true,
      topLevelFileCount: fileCount,
      topLevelDirCount: dirCount,
      sampleFiles: prioritizeSampleFiles(allTopFiles)
    });
  }

  scanRoot(dirs.desktop, 'Masaüstü');
  return {
    desktopPath: dirs.desktop,
    workspaceDir: dirs.workspace,
    projects
  };
}

function listFilesSmart(dirPath, workspaceDir, options = {}, knownOverrides = {}) {
  const maxDepth = typeof options.maxDepth === 'number' ? options.maxDepth : 3;
  const includeHidden = options.includeHidden !== false;
  const targetDir = resolveSmartPath(dirPath, workspaceDir, knownOverrides);

  const listEntries = (dir, depth = 0) => {
    if (depth > maxDepth) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') continue;
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const isDirectory = entry.isDirectory();
      results.push({
        name: entry.name,
        path: fullPath,
        isDirectory,
        children: isDirectory ? listEntries(fullPath, depth + 1) : null
      });
    }
    return results;
  };

  return { targetDir, tree: listEntries(targetDir, 0) };
}

function searchFilesSmart(query, dirPath, workspaceDir, knownOverrides = {}) {
  const q = String(query || '').trim();
  if (!q) return { success: true, matches: [] };
  const targetDir = resolveSmartPath(dirPath, workspaceDir, knownOverrides);
  const qLower = q.toLowerCase();
  const matches = [];
  const skipSearch = new Set(['node_modules', '.git', 'dist', 'build', 'voices', '__pycache__', '.venv']);
  const binaryExts = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.mp3',
    '.wav',
    '.onnx',
    '.exe',
    '.dll',
    '.zip',
    '.woff2',
    '.pdf'
  ]);

  function walk(dir, depth = 0) {
    if (depth > 4 || matches.length >= 60) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (matches.length >= 60) break;
      if (skipSearch.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (binaryExts.has(ext)) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 400000) continue;
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const lines = raw.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(qLower)) {
              matches.push({
                filePath: fullPath,
                relPath: path.relative(targetDir, fullPath).replace(/\\/g, '/'),
                line: i + 1,
                text: lines[i].trim().slice(0, 180)
              });
              if (matches.length >= 60) break;
            }
          }
        } catch (_) {}
      }
    }
  }

  walk(targetDir);
  return { success: true, targetDir, matches };
}

module.exports = {
  SKIP_DIRS,
  prioritizeSampleFiles,
  listDesktopProjects,
  listFilesSmart,
  searchFilesSmart
};
