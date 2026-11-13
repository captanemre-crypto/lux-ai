// Şifreli anahtar kasası (Electron safeStorage + AES-256-GCM yedek) — main.js'ten ayrıştırıldı.
// Makine anahtar zinciri varsa safeStorage kullanılır; yoksa userData'ya özgü
// türetilmiş anahtarla AES-256-GCM. Kayıtlar v2 sürümlü belgede tutulur
// (bkz. VAULT_VERSION); v1 düz dosya yükseltme okumada sessizce yapılır.
const logger = require('../logger');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { asId, asString, MAX_SECRET_VALUE } = require('./validate');

function createSecretsVault({ userDataDir, safeStorage, ipcMain }) {
  // ----------------------------------------------------
  // Güvenli anahtar kasası (Electron safeStorage + AES-256-GCM yedek)
  // ----------------------------------------------------
  // API anahtarları artık renderer/localStorage'da düz metin tutulmaz.
  // OS anahtar zinciri (Windows DPAPI / macOS Keychain / libsecret) varsa
  // safeStorage kullanılır; yoksa (Linux'ta keyring yoksa) AES-256-GCM ile
  // makineye özgü türetilmiş anahtarla şifrelenir.
  const SECRETS_FILE = path.join(userDataDir, 'lux_secrets.json');
  const VAULT_VERSION = 2; // v1: düz { id: record }; v2: { __vaultVersion, createdAt, rotatedAt, entries }

  function getSecretsFallbackKey() {
    const seed = [
      process.env.USERNAME || process.env.USER || '',
      process.env.COMPUTERNAME || require('os').hostname(),
      userDataDir
    ].join('|');
    return crypto.createHash('sha256').update(`lux-ai-${seed}`).digest();
  }

  function readVaultDoc() {
    try {
      if (!fs.existsSync(SECRETS_FILE))
        return { version: VAULT_VERSION, entries: {}, createdAt: null, rotatedAt: null };
      const raw = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) || {};
      if (raw && typeof raw === 'object' && raw.__vaultVersion) {
        return {
          version: Number(raw.__vaultVersion) || 1,
          entries: raw.entries && typeof raw.entries === 'object' ? raw.entries : {},
          createdAt: raw.createdAt || null,
          rotatedAt: raw.rotatedAt || null
        };
      }
      // v1 (eski) biçim: doğrudan { id: record } haritası — sessizce okunur, bir sonraki yazmada v2'ye taşınır
      return { version: 1, entries: raw && typeof raw === 'object' ? raw : {}, createdAt: null, rotatedAt: null };
    } catch (_) {
      logger.debug('kasa okunamadı, boş kasa dönülüyor', undefined, 'secrets');
      return { version: VAULT_VERSION, entries: {}, createdAt: null, rotatedAt: null };
    }
  }

  function writeSecretsDoc(doc) {
    try {
      fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
      const tmp = `${SECRETS_FILE}.tmp`;
      const payload = {
        __vaultVersion: VAULT_VERSION,
        createdAt: doc.createdAt || new Date().toISOString(),
        rotatedAt: doc.rotatedAt || null,
        entries: doc.entries || {}
      };
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmp, SECRETS_FILE); // atomik yazma: yarım kalan kasa dosyası olmaz
      return true;
    } catch (err) {
      console.error('[secrets] yazılamadı:', err.message);
      return false;
    }
  }

  function readSecretsFile() {
    return readVaultDoc().entries;
  }

  function writeSecretsFile(entries, meta = {}) {
    const prev = readVaultDoc();
    return writeSecretsDoc({
      entries,
      createdAt: prev.createdAt,
      rotatedAt: meta.rotatedAt !== undefined ? meta.rotatedAt : prev.rotatedAt || null
    });
  }

  function encryptSecret(plain) {
    const text = String(plain || '');
    if (!text) return '';
    if (safeStorage.isEncryptionAvailable()) {
      return { scheme: 'safeStorage', data: safeStorage.encryptString(text).toString('base64') };
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getSecretsFallbackKey(), iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return {
      scheme: 'aes-256-gcm',
      data: `${iv.toString('base64')}.${enc.toString('base64')}.${cipher.getAuthTag().toString('base64')}`
    };
  }

  function decryptSecret(record) {
    if (!record || !record.data) return '';
    try {
      if (record.scheme === 'safeStorage') {
        if (!safeStorage.isEncryptionAvailable()) return '';
        return safeStorage.decryptString(Buffer.from(record.data, 'base64'));
      }
      if (record.scheme === 'aes-256-gcm') {
        const [ivB64, dataB64, tagB64] = String(record.data).split('.');
        const decipher = crypto.createDecipheriv('aes-256-gcm', getSecretsFallbackKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
      }
    } catch (err) {
      console.error('[secrets] çözülemedi:', err.message);
    }
    return '';
  }

  ipcMain.handle('secrets-set', (event, id, plainKey) => {
    try {
      id = asId(id, 'id');
    } catch (e) {
      return { success: false, error: e.message };
    }
    const store = readSecretsFile();
    const trimmed = (plainKey === undefined || plainKey === null ? '' : String(plainKey)).trim();
    if (trimmed.length > MAX_SECRET_VALUE) return { success: false, error: 'Anahtar değeri 8 KB sınırını aşıyor' };
    if (!trimmed) {
      delete store[id];
      writeSecretsFile(store);
      return { success: true, cleared: true };
    }
    store[id] = encryptSecret(trimmed);
    const ok = writeSecretsFile(store);
    return { success: ok, scheme: store[id]?.scheme || null };
  });

  ipcMain.handle('secrets-get', (event, id) => {
    try {
      id = asId(id, 'id');
    } catch (e) {
      return { success: false, error: e.message };
    }
    const store = readSecretsFile();
    const value = decryptSecret(store[id]);
    return { success: Boolean(value), value };
  });

  ipcMain.handle('secrets-status', () => {
    const doc = readVaultDoc();
    const ids = Object.keys(doc.entries);
    return {
      success: true,
      scheme: safeStorage.isEncryptionAvailable() ? 'safeStorage' : 'aes-256-gcm',
      count: ids.length,
      ids,
      vaultVersion: doc.version,
      needsMigration: doc.version < VAULT_VERSION,
      createdAt: doc.createdAt,
      rotatedAt: doc.rotatedAt
    };
  });

  // Kasayı yeniden şifrele: tüm kayıtlar çözülüp güncel şema/anahtarla tekrar yazılır.
  // Herhangi bir kayıt çözülemezse kasa DEĞİŞTİRİLMEZ (veri kaybı yok).
  ipcMain.handle('secrets-rotate', () => {
    const doc = readVaultDoc();
    const ids = Object.keys(doc.entries);
    const next = {};
    const failed = [];
    for (const id of ids) {
      const plain = decryptSecret(doc.entries[id]);
      if (!plain) {
        failed.push(id);
        continue;
      }
      next[id] = encryptSecret(plain);
    }
    if (failed.length) {
      return { success: false, error: `Çözülemeyen anahtar(lar): ${failed.join(', ')}. Kasa değiştirilmedi.`, failed };
    }
    const rotatedAt = new Date().toISOString();
    const ok = writeSecretsDoc({ entries: next, createdAt: doc.createdAt, rotatedAt });
    return { success: ok, rotated: ids.length, rotatedAt: ok ? rotatedAt : null };
  });

  ipcMain.handle('secrets-clear', () => {
    try {
      if (fs.existsSync(SECRETS_FILE)) fs.unlinkSync(SECRETS_FILE);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  return { readSecretsFile, decryptSecret, encryptSecret, readVaultDoc, writeSecretsFile, VAULT_VERSION };
}

module.exports = { createSecretsVault };
