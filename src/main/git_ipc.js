// Git Diff & Code Review IPCs — main.js'ten ayrıştırıldı.
// Gerçek git depolarında git, yoksa oturum içi anlık görüntüler üzerinde diff üretir.
const path = require('path');
const fs = require('fs');
const { asString, asOptions, MAX_PATH, MAX_QUERY } = require('./validate');

function registerGitIpc({ ipcMain, getWorkspaceDir, buildUnifiedLineDiff, fileEditSnapshots, runExecFile }) {
  // Git Diff & Code Review IPCs (Supports both real Git repos and fallback edit snapshots)
  ipcMain.handle('git-diff', async (event, cwd) => {
    if (cwd !== undefined && cwd !== null) {
      try {
        cwd = asString(cwd, 'cwd', { max: MAX_PATH });
      } catch (e) {
        return { isGitRepo: false, branch: null, cwd: null, files: [], error: e.message };
      }
    }
    const baseDir = getWorkspaceDir() || process.cwd();
    const targetCwd = cwd ? (path.isAbsolute(cwd) ? cwd : path.resolve(baseDir, cwd)) : baseDir;
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
              diffText = [
                `--- /dev/null`,
                `+++ b/${relPath}`,
                `@@ -0,0 +1,${fLines.length} @@`,
                ...fLines.slice(0, 120).map((l) => `+${l}`)
              ].join('\n');
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
          dText.split(/\r?\n/).forEach((l) => {
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
        try {
          curContent = fs.readFileSync(absPath, 'utf-8');
        } catch (_) {}
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
    try {
      payload = asOptions(payload, 'payload');
      if (payload.action !== undefined) payload.action = asString(payload.action, 'action', { max: 32 });
      if (payload.filePath !== undefined && payload.filePath !== null)
        payload.filePath = asString(payload.filePath, 'filePath', { max: MAX_PATH });
      if (payload.cwd !== undefined && payload.cwd !== null)
        payload.cwd = asString(payload.cwd, 'cwd', { max: MAX_PATH });
    } catch (e) {
      return { success: false, error: e.message };
    }
    const { action, filePath, cwd } = payload;
    const GIT_ACTIONS = new Set(['init', 'stage', 'discard', 'clear-snapshots']); // handler'ın desteklediği eylemler
    if (typeof action !== 'string' || !GIT_ACTIONS.has(action)) {
      return { success: false, error: `Bilinmeyen git eylemi: ${String(action)}` };
    }
    const baseDir = getWorkspaceDir() || process.cwd();
    const targetCwd = cwd ? (path.isAbsolute(cwd) ? cwd : path.resolve(baseDir, cwd)) : baseDir;

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
}

module.exports = { registerGitIpc };
