'use strict';
// IPC payload doğrulama — savunma amaçlı, şema motoru değil.
// Hedef: tip karışıklığı ve aşırı boyutlu girdilerin handler içine girmesini
// imkânsız hale getirmek. Tüm doğrulamalar Error fırlatır; handler'lar
// bunları yakalayıp kendi hata şekillerine ({ success: false, error }) çevirir.

const MAX_PATH = 4096;
const MAX_QUERY = 2048;
const MAX_COMMAND = 20000;
const MAX_TEXT = 100000; // TTS metni vb. serbest metin
const MAX_FILE_CONTENT = 64 * 1024 * 1024; // 64 MB dosya içeriği
const MAX_AUDIO_B64 = 64 * 1024 * 1024; // base64 ses (~48 MB ham)
const MAX_SECRET_VALUE = 8192; // API anahtarları kısa dizgilerdir
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function asString(value, name, { max = MAX_PATH, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${name} gerekli (string bekleniyor)`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`${name} string olmalı (verilen tip: ${typeof value})`);
  }
  if (value.length > max) {
    throw new Error(`${name} çok uzun (${value.length} > ${max} karakter)`);
  }
  return value;
}

function asId(value, name = 'id') {
  const s = asString(value, name, { max: 128 });
  if (!ID_RE.test(s)) {
    throw new Error(`${name} geçersiz: harf/rakam/._:- ve en çok 128 karakter olmalı`);
  }
  return s;
}

function asIntInRange(value, name, { min, max, fallback } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} sayı olmalı`);
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function asOptions(value, name = 'options') {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error(`${name} nesne olmalı`);
  return value;
}

module.exports = {
  MAX_PATH,
  MAX_QUERY,
  MAX_COMMAND,
  MAX_TEXT,
  MAX_FILE_CONTENT,
  MAX_AUDIO_B64,
  MAX_SECRET_VALUE,
  ID_RE,
  asString,
  asId,
  asIntInRange,
  isPlainObject,
  asOptions
};
