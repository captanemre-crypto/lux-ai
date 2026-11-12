// Eklenti bağımlılıkları (plugin_system.js -> luxAPI.plugins) — main.js'ten ayrıştırıldı.
// Sadece geçerli npm paket adları kabul edilir; kabuk kullanılmaz (execFile).
const { execFile } = require('child_process');

function registerPluginsIpc({ app, ipcMain }) {
  // ----------------------------------------------------
  // Eklenti bağımlılıkları (plugin_system.js -> luxAPI.plugins)
  // Sadece geçerli npm paket adları kabul edilir; kabuk kullanılmaz (execFile).
  // ----------------------------------------------------
  const NPM_PKG_RE = /^(?:@[a-z0-9][a-z0-9._-]{0,213}\/)?[a-z0-9][a-z0-9._-]{0,213}(?:@[a-z0-9][a-z0-9._+-]{0,99})?$/i;
  function isValidNpmPackageName(name) {
    const s = String(name || '').trim();
    if (!s || s.length > 214 || s.includes('..')) return false;
    return NPM_PKG_RE.test(s) && !s.startsWith('-');
  }

  ipcMain.handle('plugins-check-dependency', (event, packageName) => {
    const pkg = String(packageName || '').trim();
    if (!isValidNpmPackageName(pkg)) {
      return { success: false, installed: false, error: 'Geçersiz paket adı' };
    }
    const baseName = pkg.startsWith('@') ? pkg.split('@').slice(0, 2).join('@') : pkg.split('@')[0];
    try {
      require.resolve(baseName, { paths: [app.getAppPath()] });
      return { success: true, installed: true };
    } catch (_) {
      return { success: true, installed: false };
    }
  });

  ipcMain.handle('plugins-install-dependency', async (event, packageName) => {
    const pkg = String(packageName || '').trim();
    if (!isValidNpmPackageName(pkg)) {
      return { success: false, error: 'Geçersiz paket adı' };
    }
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return await new Promise((resolve) => {
      execFile(
        npmCmd,
        ['install', '--no-save', '--no-audit', '--no-fund', '--loglevel=error', '--', pkg],
        {
          cwd: app.getAppPath(),
          timeout: 180000,
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
          env: { ...process.env, npm_config_save: 'false' }
        },
        (err, stdout, stderr) => {
          if (err) {
            const tail = String(stderr || stdout || err.message || '')
              .trim()
              .split(/\r?\n/)
              .slice(-6)
              .join('\n');
            resolve({ success: false, error: tail || err.message });
            return;
          }
          resolve({ success: true, message: `${pkg} kuruldu` });
        }
      );
    });
  });
}

module.exports = { registerPluginsIpc };
