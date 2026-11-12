// Oturum içi düzenleme anlık görüntüleri + promisified execFile — main.js'ten ayrıştırıldı.
// fs-write-file (anlık görüntü alma), git handler'ları ve storage-wipe temizliği paylaşır.
const { execFile } = require('child_process');

// Session-scoped edit snapshots for code review diffs even when .git is not initialized
const fileEditSnapshots = new Map();

function runExecFile(cmd, args, cwd) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: cwd || process.cwd(), maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({
          code: err ? err.code || 1 : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null
        });
      }
    );
  });
}

module.exports = { fileEditSnapshots, runExecFile };
