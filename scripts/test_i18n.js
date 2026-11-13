#!/usr/bin/env node
/**
 * i18n anahtar kapsamı testi
 *
 * 1) TR ve EN sözlük anahtarları bire bir aynı mı (parity)
 * 2) Kodda "alan.anahtar" biçiminde geçen her literal key, TR sözlükte var mı
 * 3) TR/EN sözlüklerinde hiç referans almayan anahtarlar (rapor; kırıcı değil)
 *
 * Çıkış: 0 = temiz · 1 = en az bir kırıcı kontrol başarısız
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I18N_FILE = path.join(ROOT, 'src', 'js', 'i18n.js');
const SCAN_DIRS = [path.join(ROOT, 'src', 'js')];
const SCAN_FILES = [path.join(ROOT, 'src', 'index.html')];
const SKIP_FILES = new Set(['marked.umd.js', 'compiled_tailwind.css', 'i18n.js', 'i18n_en_map.js']);

function extractDict(src, locale) {
  // tr: { düğümünü bul, sonra dengeli parantez sayacı ile objenin sonunu bul
  const startMatch = src.match(new RegExp('\\b' + locale + '\\s*:\\s*{'));
  if (!startMatch) throw new Error(locale + ' sözlüğü bulunamadı (i18n.js)');
  let i = src.indexOf('{', startMatch.index);
  let depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(start, i + 1);
  const keys = new Set();
  for (const m of body.matchAll(/"([a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)+)"\s*:/g)) {
    keys.add(m[1]);
  }
  return keys;
}

function scanSources(dicts) {
  const prefixes = new Set([...dicts.tr, ...dicts.en].map((k) => k.split('.')[0]));
  const keyRe = new RegExp('"(' + [...prefixes].join('|') + ')\\.[a-zA-Z][\\w-]*(?:\\.[a-zA-Z][\\w-]*)*"', 'g');
  const used = new Map(); // key -> [file]
  const addUsage = (key, file) => {
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(path.relative(ROOT, file));
  };
  const handle = (file) => {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(keyRe)) {
      addUsage(m[0].slice(1, -1), file);
    }
  };
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_FILES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(entry.name)) handle(full);
    }
  };
  SCAN_DIRS.forEach(walk);
  SCAN_FILES.forEach((f) => fs.existsSync(f) && handle(f));
  return used;
}

const i18nSrc = fs.readFileSync(I18N_FILE, 'utf8');
const tr = extractDict(i18nSrc, 'tr');
const en = extractDict(i18nSrc, 'en');
console.log(`TR ${tr.size} anahtar · EN ${en.size} anahtar`);

let failed = 0;

// 1) Parity
const onlyTr = [...tr].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !tr.has(k));
if (onlyTr.length || onlyEn.length) {
  failed = 1;
  console.error('PARITY HATASI:');
  onlyTr.forEach((k) => console.error('  yalnız TR:', k));
  onlyEn.forEach((k) => console.error('  yalnız EN:', k));
} else {
  console.log('PARITY: TR/EN anahtarları bire bir aynı ✔');
}

// 2) Kodda geçen her bilinen-önek literal'ı sözlükte var mı
const used = scanSources({ tr, en });
const missing = [...used.keys()].filter((k) => !tr.has(k) || !en.has(k));
if (missing.length) {
  failed = 1;
  console.error('SÖZLÜKTE OLMAYAN KULLANIMLAR:');
  missing.forEach((k) => console.error(`  ${k}  (${used.get(k).join(', ')})`));
} else {
  console.log(`KULLANILAN ANAHTARLAR: kodda geçen ${used.size} anahtar da sözlükte mevcut ✔`);
}

// 3) Kullanılmayan anahtarlar (kırıcı değil — rapor)
const unused = [...new Set([...tr, ...en])].filter((k) => !used.has(k));
if (unused.length) {
  console.log(`KULLANILMAYAN ${unused.length} anahtar (bilgi): ${unused.join(', ')}`);
}

if (failed) {
  console.error('\nI18N TESTİ BAŞARISIZ');
  process.exit(1);
}
console.log('\nI18N TESTİ GEÇTİ');
