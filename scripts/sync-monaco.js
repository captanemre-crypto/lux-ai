#!/usr/bin/env node
/**
 * Monaco vendor köprüsü (src/vendor/monaco)
 *
 * Neden? ideMode.js daha önce Monaco'yu "../node_modules/monaco-editor/min/vs"
 * yolundan yüklüyordu. Bu yol:
 *   1) Temiz klonda (npm install yapılmadan) yok,
 *   2) electron-builder/asar paketinde node_modules dışarıda kaldığı için kırılır.
 *
 * Bu script, `npm install` sonrası (postinstall) Monaco'nun SADECE gerekli
 * parçalarını src/vendor/monaco altına kopyalar:
 *   - loader.js (AMD yükleyici)
 *   - editor/ (editor.main.js, editor.main.css, editor.worker.js)
 *   - language/{json,css,html,typescript}/ (monarch + worker'lar)
 *   - basic-languages/ (yerel dil tanımları)
 *   - nls.messages-loader.js (yerelleştirme yükleyicisi)
 *
 * Kullanım:
 *   node scripts/sync-monaco.js            (zaten varsa atlar)
 *   node scripts/sync-monaco.js --force    (yeniden kopyalar)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', 'monaco-editor', 'min', 'vs');
const DEST_ROOT = path.join(ROOT, 'src', 'vendor', 'monaco');
const DEST = path.join(DEST_ROOT, 'vs');
const STAMP = path.join(DEST_ROOT, '.version');
const force = process.argv.includes('--force');

// Kopyalanacak seçili parçalar (tam liste 25 MB tutuyor; bu seçki ~5 MB)
const FILES = ['loader.js', 'nls.messages-loader.js'];
const DIRS = [
  'editor',
  'basic-languages',
  path.join('language', 'json'),
  path.join('language', 'css'),
  path.join('language', 'html'),
  path.join('language', 'typescript')
];

function readMonacoVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'monaco-editor', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch (_) {
    return null;
  }
}

function copyOptionalDir(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(DEST, rel);
  if (!fs.existsSync(from)) {
    console.warn(`[sync-monaco] atlandı (yok): ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
    else n += 1;
  }
  return n;
}

function totalBytes(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) n += totalBytes(p);
    else n += fs.statSync(p).size;
  }
  return n;
}

function main() {
  const version = readMonacoVersion();

  if (!fs.existsSync(SRC)) {
    // Sessizce geçmek yerine net bilgi ver: uygulama yine açılır, IDE basit
    // textarea moduna düşer (ideMode.js bunu kullanıcıya bildirir).
    console.warn('[sync-monaco] node_modules/monaco-editor bulunamadı. "npm install" sonrası tekrar deneyin.');
    console.warn('[sync-monaco] IDE, Monaco olmadan basit metin düzenleyici ile çalışacak.');
    process.exit(0);
  }

  const current = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : '';
  if (!force && current === version && fs.existsSync(path.join(DEST, 'loader.js'))) {
    console.log(`[sync-monaco] Zaten hazır (v${version}) -> ${path.relative(ROOT, DEST)}`);
    return;
  }

  fs.rmSync(DEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  for (const f of FILES) {
    const from = path.join(SRC, f);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(DEST, f));
    else console.warn(`[sync-monaco] atlandı (yok): ${f}`);
  }
  for (const d of DIRS) copyOptionalDir(d);

  fs.writeFileSync(STAMP, `${version}\n`, 'utf8');
  const mb = (totalBytes(DEST_ROOT) / (1024 * 1024)).toFixed(1);
  console.log(
    `[sync-monaco] Monaco v${version} hazır: ${countFiles(DEST)} dosya, ${mb} MB -> ${path.relative(ROOT, DEST)}`
  );
}

main();
