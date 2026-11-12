// Yıkıcı işlem güvenliği ve yol çözümleme — agent_capabilities bölümü
const fs = require('fs');
const path = require('path');
const os = require('os');

function getKnownDirs(overrides = {}) {
  const home = overrides.homePath || os.homedir();
  return {
    home,
    desktop: overrides.desktopPath || path.join(home, 'Desktop'),
    documents: overrides.documentsPath || path.join(home, 'Documents'),
    downloads: overrides.downloadsPath || path.join(home, 'Downloads'),
    pictures: overrides.picturesPath || path.join(home, 'Pictures'),
    workspace: overrides.workspaceDir || process.cwd()
  };
}

// ----------------------------------------------------
// Yıkıcı dosya işlemleri için güvenlik kalkanı
// ----------------------------------------------------
// Ajan (LLM) tarafından üretilen yollar doğrudan silme/taşıma işlemine
// dönüşebildiği için, kritik konumları ve sır dosyalarını koruyoruz.
const PROTECTED_SEGMENTS = [
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'system32',
  'syswow64',
  'appdata',
  'etc',
  'usr/bin',
  'usr/lib',
  'bin',
  'sbin',
  'library',
  'system',
  'private/etc',
  '.ssh',
  '.gnupg',
  '.aws',
  '.config/gcloud',
  'node_modules',
  '.git'
];

const SECRET_FILE_PATTERN =
  /(^|[\\/])(\.env(\.[^\\/]*)?|id_rsa|id_ed25519|id_ecdsa|\.npmrc|\.netrc|credentials(\.[^\\/]*)?|secrets?\.json|.*\.(pem|key|pfx|p12|keystore))$/i;

/**
 * Yıkıcı bir işlemin (silme/taşıma) güvenli olup olmadığını denetler.
 * @returns {{allowed: boolean, reason?: string}}
 */
function assertSafeDestructiveTarget(targetPath, workspaceDir, options = {}) {
  const raw = String(targetPath || '').trim();
  if (!raw) return { allowed: false, reason: 'Boş yol' };

  const abs = path.resolve(targetPath);
  const norm = abs.replace(/\\/g, '/');
  const lower = norm.toLowerCase();

  // 1) Kök ve sürücü kökleri asla silinemez
  if (path.parse(abs).root === abs) {
    return { allowed: false, reason: 'Sürücü/kök dizini silinemez' };
  }

  // 2) Ev dizini ve doğrudan altındaki kritik klasörler
  const home = (options.homePath || os.homedir()).replace(/\\/g, '/').toLowerCase();
  const homeChildren = ['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos', 'appdata'];
  if (lower === home) return { allowed: false, reason: 'Ev dizini silinemez' };
  for (const child of homeChildren) {
    if (lower === `${home}/${child}`) {
      return { allowed: false, reason: `Korumalı klasör: ${child}` };
    }
  }

  // 3) Sistem dizinleri
  const segments = lower.split('/').filter(Boolean);
  for (const protectedSeg of PROTECTED_SEGMENTS) {
    const needle = protectedSeg.replace('\\', '/');
    if (lower.includes(`/${needle}/`) || lower.endsWith(`/${needle}`)) {
      // node_modules/.git hariç: çalışma alanı içindeyse silinebilsin
      const inWorkspace = workspaceDir
        ? lower.startsWith(path.resolve(workspaceDir).replace(/\\/g, '/').toLowerCase())
        : false;
      if (!(inWorkspace && (needle === 'node_modules' || needle === '.git'))) {
        return { allowed: false, reason: `Korumalı sistem yolu içeriyor: ${protectedSeg}` };
      }
    }
  }

  // 4) Sır dosyaları
  if (SECRET_FILE_PATTERN.test(norm)) {
    return { allowed: false, reason: 'Sır/anahtar dosyası silinemez veya taşınamaz' };
  }

  // 5) Çalışma alanı dışı: ajan için varsayılan olarak izin verilmez
  const allowOutside = options.allowOutsideWorkspace === true;
  if (workspaceDir && !allowOutside) {
    const ws = path.resolve(workspaceDir).replace(/\\/g, '/').toLowerCase();
    const insideWorkspace = lower === ws || lower.startsWith(`${ws}/`);
    const insideDesktopChild = new RegExp(`^${home}/(desktop|onedrive/desktop|masaüstü)/[^/]+`).test(lower);
    if (!insideWorkspace && !insideDesktopChild) {
      return { allowed: false, reason: 'Çalışma alanı dışındaki yolları silmek için açık onay gerekir' };
    }
  }

  return { allowed: true };
}

function resolveSmartPath(rawPath, workspaceDir, knownOverrides = {}) {
  const dirs = getKnownDirs({ ...knownOverrides, workspaceDir });
  let clean = String(rawPath || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^@(?:file|folder|dir|path):/i, '')
    .trim();
  if (!clean) return dirs.workspace;

  if (clean.startsWith('file://')) {
    try {
      const u = new URL(clean);
      clean = decodeURIComponent(u.pathname).replace(/^\/([a-zA-Z]:)/, '$1');
    } catch (_) {}
  }

  // Expand environment variables like %USERPROFILE%
  clean = clean.replace(/%([^%]+)%/g, (_, varName) => process.env[varName] || `%${varName}%`);

  const normSlash = clean.replace(/\\/g, '/');
  const lower = normSlash.replace(/\u0130/g, 'i').toLowerCase();

  if (normSlash === '~' || lower === 'home' || lower === 'kullanıcı') {
    return dirs.home;
  }
  if (normSlash.startsWith('~/')) {
    return path.join(dirs.home, normSlash.slice(2));
  }

  const aliasMap = [
    {
      prefixes: [
        'masaüstü',
        'masaustu',
        'masaüstüm',
        'masaustum',
        'masaüstüne',
        'masaustune',
        'masaüstünde',
        'masaustunde',
        'masaüstüme',
        'masaustume',
        'masaüstünden',
        'masaustunden',
        'desktop'
      ],
      base: dirs.desktop
    },
    {
      prefixes: ['belgelerim', 'belgeler', 'belgelere', 'belgelerde', 'belgelerime', 'belgelerimde', 'documents'],
      base: dirs.documents
    },
    {
      prefixes: ['indirilenler', 'indirmeler', 'indirilenlere', 'indirilenlerde', 'indirmelere', 'downloads'],
      base: dirs.downloads
    },
    { prefixes: ['resimlerim', 'resimler', 'resimlere', 'resimlerde', 'resimlerime', 'pictures'], base: dirs.pictures }
  ];

  for (const entry of aliasMap) {
    for (const prefix of entry.prefixes) {
      if (lower === prefix) return entry.base;
      if (lower.startsWith(prefix + '/')) {
        return path.join(entry.base, normSlash.slice(prefix.length + 1));
      }
    }
  }

  if (path.isAbsolute(clean)) {
    return path.normalize(clean);
  }

  // Direct workspace resolution first
  const wsCandidate = path.resolve(dirs.workspace, clean);
  if (fs.existsSync(wsCandidate)) {
    return wsCandidate;
  }

  // Check if the first path segment matches a real folder on Desktop (e.g. "lux_al", "lux_futures_xl/app.py", "al tasarım")
  const parts = normSlash.split('/').filter(Boolean);
  if (parts.length > 0 && fs.existsSync(dirs.desktop)) {
    const firstLower = parts[0].toLowerCase();
    try {
      const desktopEntries = fs.readdirSync(dirs.desktop, { withFileTypes: true });
      const exactFolder = desktopEntries.find((e) => e.isDirectory() && e.name.toLowerCase() === firstLower);
      if (exactFolder) {
        return path.join(dirs.desktop, exactFolder.name, ...parts.slice(1));
      }
      // Also match relaxed underscore/space names (e.g. "lux_futures" vs "Lux_futures")
      const normalizedKey = firstLower.replace(/[\s_-]+/g, '');
      const fuzzyFolder = desktopEntries.find(
        (e) => e.isDirectory() && e.name.toLowerCase().replace(/[\s_-]+/g, '') === normalizedKey
      );
      if (fuzzyFolder) {
        return path.join(dirs.desktop, fuzzyFolder.name, ...parts.slice(1));
      }
    } catch (_) {}
  }

  return wsCandidate;
}

module.exports = {
  getKnownDirs,
  assertSafeDestructiveTarget,
  resolveSmartPath
};
