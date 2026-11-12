// LUX_ai Loglama ve Hata Yönetim Modülü (asenkron, dosya döndürmeli)
//
// Önceki sürüm her log satırında senkron `appendFileSync` yapıyordu ve hiçbir
// yerden `require` edilmiyordu. Bu sürüm:
//   - dosyayı tembel açar, yazmayı tamponlar ve periyodik olarak boşaltır,
//   - boyut sınırı aşıldığında tek yedekle döndürür (app.log -> app.log.1),
//   - `console` çıktısını da korur ki mevcut davranış bozulmasın.
const fs = require('fs');
const path = require('path');

// Paketlenmiş (asar, salt-okunur) uygulamada __dirname'e yazmak mümkün
// olmayabilir; önce userData/logs'u dene, olmazsa proje köküne düş.
function resolveLogDir() {
  try {
    const electron = require('electron');
    const appRef = electron && electron.app;
    if (appRef && typeof appRef.getPath === 'function') {
      return path.join(appRef.getPath('userData'), 'logs');
    }
  } catch (_) {}
  return path.join(__dirname, '..', 'logs');
}

const LOG_DIR = resolveLogDir();
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FLUSH_MS = 1500;

let buffer = [];
let flushTimer = null;
let fileSize = 0;

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    fileSize = fs.statSync(LOG_FILE).size;
    if (fileSize > MAX_BYTES) {
      const backup = `${LOG_FILE}.1`;
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(LOG_FILE, backup);
      fileSize = 0;
    }
  } catch (_) {}
}

function flush() {
  flushTimer = null;
  if (buffer.length === 0) return;
  const chunk = buffer.join('');
  buffer = [];
  try {
    ensureDir();
    rotateIfNeeded();
    // SENKRON yaz: before-quit sırasında appendFile'ın tamamlanması garantilenir.
    fs.appendFileSync(LOG_FILE, chunk);
    fileSize += Buffer.byteLength(chunk);
  } catch (_) {}
}

function log(level, scope, message, extra) {
  const timestamp = new Date().toISOString();
  const scopePart = scope ? ` [${scope}]` : '';
  let payload = message;
  if (extra !== undefined) {
    try {
      payload = `${message} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
    } catch (_) {
      payload = `${message} [unserializable]`;
    }
  }
  const line = `[${timestamp}] [${level.toUpperCase()}]${scopePart}: ${payload}\n`;

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(line.trim());

  buffer.push(line);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_MS);
    // Zamanlayıcı süreç kapanışını asla bekletmesin.
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }
}

module.exports = {
  info: (msg, extra, scope) => log('info', scope, msg, extra),
  warn: (msg, extra, scope) => log('warn', scope, msg, extra),
  error: (msg, extra, scope) => log('error', scope, msg, extra),
  /** Ajan/araç hatalarını tek yerden, yığın iziyle kaydeder. */
  exception: (scope, err) => log('error', scope, err?.message || String(err), err?.stack || ''),
  /** Bekleyen tamponu hemen diske yazar (before-quit için). */
  flush,
  LOG_FILE
};
