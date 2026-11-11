const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build']);
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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

function resolveSmartPath(rawPath, workspaceDir, knownOverrides = {}) {
  const dirs = getKnownDirs({ ...knownOverrides, workspaceDir });
  let clean = String(rawPath || '').trim().replace(/^['"]|['"]$/g, '').replace(/^@(?:file|folder|dir|path):/i, '').trim();
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
        'masaüstü', 'masaustu', 'masaüstüm', 'masaustum',
        'masaüstüne', 'masaustune', 'masaüstünde', 'masaustunde',
        'masaüstüme', 'masaustume', 'masaüstünden', 'masaustunden',
        'desktop'
      ],
      base: dirs.desktop
    },
    { prefixes: ['belgelerim', 'belgeler', 'belgelere', 'belgelerde', 'belgelerime', 'belgelerimde', 'documents'], base: dirs.documents },
    { prefixes: ['indirilenler', 'indirmeler', 'indirilenlere', 'indirilenlerde', 'indirmelere', 'downloads'], base: dirs.downloads },
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
      const exactFolder = desktopEntries.find(e => e.isDirectory() && e.name.toLowerCase() === firstLower);
      if (exactFolder) {
        return path.join(dirs.desktop, exactFolder.name, ...parts.slice(1));
      }
      // Also match relaxed underscore/space names (e.g. "lux_futures" vs "Lux_futures")
      const normalizedKey = firstLower.replace(/[\s_-]+/g, '');
      const fuzzyFolder = desktopEntries.find(e => e.isDirectory() && e.name.toLowerCase().replace(/[\s_-]+/g, '') === normalizedKey);
      if (fuzzyFolder) {
        return path.join(dirs.desktop, fuzzyFolder.name, ...parts.slice(1));
      }
    } catch (_) {}
  }

  return wsCandidate;
}

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
  const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.wav', '.onnx', '.exe', '.dll', '.zip', '.woff2', '.pdf']);

  function walk(dir, depth = 0) {
    if (depth > 4 || matches.length >= 60) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
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

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtmlTags(str) {
  return decodeHtmlEntities(String(str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

const WMO_TR = {
  0: 'Açık güneşli',
  1: 'Çoğunlukla açık',
  2: 'Parçalı bulutlu',
  3: 'Kapalı / çok bulutlu',
  45: 'Sisli',
  48: 'Kırağılı sis',
  51: 'Hafif çiseleme',
  53: 'Orta çiseleme',
  55: 'Yoğun çiseleme',
  61: 'Hafif yağmurlu',
  63: 'Orta şiddette yağmurlu',
  65: 'Şiddetli yağmurlu',
  71: 'Hafif kar yağışlı',
  73: 'Kar yağışlı',
  75: 'Yoğun kar yağışlı',
  80: 'Sağanak yağışlı',
  81: 'Orta sağanak yağışlı',
  82: 'Şiddetli sağanak',
  95: 'Gök gürültülü fırtına',
  96: 'Dolu ihtimalli fırtına',
  99: 'Şiddetli gök gürültülü dolu'
};

function extractWeatherCity(query) {
  const q = String(query || '').trim();
  // Match common Turkish/English patterns: "Gaziantep hava durumu", "Gaziantep'te bugün hava", "weather in Istanbul"
  let m = q.match(/(?:^|\s)([A-ZÇĞİÖŞÜa-zçğıöşü]{3,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{3,})?)(?:'(?:te|ta|de|da|daki|deki|in|ın))?\s+(?:için\s+)?(?:bugün\s+|yarın\s+)?(?:hava\s+durumu|hava\s+nasıl|hava\s+raporu|sıcaklık|weather)/i);
  if (m && m[1]) {
    const stop = new Set(['bugün', 'yarın', 'internetten', 'dostum', 'bana', 'lütfen', 'şimdi', 'şu', 'an', 'için', 'yerel', 'uluslararası', 'hava', 'güncel']);
    const parts = m[1].trim().split(/\s+/).filter(w => !stop.has(w.toLowerCase()));
    if (parts.length > 0) return parts[parts.length - 1].replace(/['’](?:te|ta|de|da|daki|deki|in|ın)$/i, '');
  }
  m = q.match(/(?:hava\s+durumu|hava\s+raporu|weather(?:\s+in|\s+for)?)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]{3,})/i);
  if (m && m[1]) {
    const candidate = m[1].replace(/['’](?:te|ta|de|da|daki|deki|in|ın|u|ü)$/i, '');
    if (!/^(?:nedir|nasıl|tahmin|tahmini|raporu|bugün|yarın)$/i.test(candidate)) {
      return candidate;
    }
  }
  const tokens = q.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/);
  const stopWords = new Set(['dostum', 'bana', 'internetten', 'internet', 'üzerinden', 'bugün', 'yarın', 'hava', 'durumu', 'durumunu', 'tahmin', 'tahminlerini', 'rapor', 'raporlarını', 'nedir', 'nasıl', 'bul', 'getir', 'bulur', 'musun', 'öğren', 'öğrenir', 'misin', 'için', 've', 'ile', 'bir', 'olan', 'güncel']);
  const meaningful = tokens.filter(t => t.length >= 3 && !stopWords.has(t.toLowerCase()));
  return meaningful[0] || '';
}

async function fetchOpenMeteoWeather(city) {
  if (!city) return null;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`, {
      headers: { 'User-Agent': 'LuxAI/1.0' },
      signal: AbortSignal.timeout(7000)
    });
    if (!geoRes.ok) return null;
    const geoJson = await geoRes.json();
    const loc = geoJson?.results?.[0];
    if (!loc) return null;

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`,
      { headers: { 'User-Agent': 'LuxAI/1.0' }, signal: AbortSignal.timeout(7000) }
    );
    if (!wxRes.ok) return null;
    const wx = await wxRes.json();
    const cur = wx.current || {};
    const daily = wx.daily || {};
    const cond = WMO_TR[cur.weather_code] || `Kod ${cur.weather_code}`;
    const dailyLines = (daily.time || []).map((day, idx) => {
      const dCond = WMO_TR[daily.weather_code?.[idx]] || '';
      const tMax = daily.temperature_2m_max?.[idx];
      const tMin = daily.temperature_2m_min?.[idx];
      const pProb = daily.precipitation_probability_max?.[idx];
      return `${day}: ${tMin}°C / ${tMax}°C, ${dCond}${typeof pProb === 'number' ? ` (yağış ihtimali %${pProb})` : ''}`;
    });

    return {
      city: `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}${loc.country ? ' (' + loc.country + ')' : ''}`,
      temperature: cur.temperature_2m,
      apparentTemperature: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      windSpeed: cur.wind_speed_10m,
      condition: cond,
      observedAt: cur.time,
      forecast: dailyLines,
      sourceUrl: `https://open-meteo.com/en/docs#latitude=${loc.latitude}&longitude=${loc.longitude}`
    };
  } catch (_) {
    return null;
  }
}

async function searchDuckDuckGoHtml(query, limit = 8) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results = [];
  const blockRegex = /<div[^>]*class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match;
  while ((match = blockRegex.exec(html)) !== null && results.length < limit) {
    const block = match[1];
    const linkMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    let href = decodeHtmlEntities(linkMatch[1]);
    if (href.includes('uddg=')) {
      try {
        const parsed = new URL(href.startsWith('//') ? 'https:' + href : href);
        href = parsed.searchParams.get('uddg') || href;
      } catch (_) {}
    }
    const title = stripHtmlTags(linkMatch[2]);
    const snipMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = snipMatch ? stripHtmlTags(snipMatch[1] || snipMatch[2] || '') : '';
    if (title && !href.includes('duckduckgo.com/y.js')) {
      results.push({ title, url: href, snippet, source: 'DuckDuckGo' });
    }
  }
  return results;
}

async function searchWikipedia(query, lang = 'tr', limit = 3) {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LuxAI/1.0 (https://localhost)' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.query?.search || []).map(item => ({
      title: item.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      snippet: stripHtmlTags(item.snippet),
      source: `Wikipedia (${lang.toUpperCase()})`
    }));
  } catch (_) {
    return [];
  }
}

async function searchBingWeb(query, limit = 6) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=tr`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(9000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results = [];
    const itemRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = itemRegex.exec(html)) !== null && results.length < limit) {
      const b = m[1];
      const a = b.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!a) continue;
      const snip = b.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      results.push({
        title: stripHtmlTags(a[2]),
        url: decodeHtmlEntities(a[1]),
        snippet: snip ? stripHtmlTags(snip[1]) : '',
        source: 'Bing'
      });
    }
    return results;
  } catch (_) {
    return [];
  }
}

async function webSearch(query, options = {}) {
  const q = String(query || '').trim();
  if (!q) return { success: false, error: 'Arama sorgusu boş.', results: [] };
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 7));

  let weather = null;
  if (/hava\s*durumu|hava\s*nasıl|hava\s*raporu|sıcaklık|weather|forecast/i.test(q)) {
    const city = extractWeatherCity(q);
    if (city) {
      weather = await fetchOpenMeteoWeather(city);
    }
  }

  let results = [];
  try {
    results = await searchDuckDuckGoHtml(q, limit);
  } catch (_) {}

  if (results.length < 2) {
    const bingRes = await searchBingWeb(q, limit);
    results = [...results, ...bingRes];
  }

  if (results.length < 3) {
    const wikiTr = await searchWikipedia(q, 'tr', 3);
    results = [...results, ...wikiTr];
  }

  // Deduplicate by URL
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const key = (r.url || r.title || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
    if (deduped.length >= limit) break;
  }

  return {
    success: Boolean(weather || deduped.length > 0),
    query: q,
    weather,
    results: deduped
  };
}

async function fetchWebpage(rawUrl) {
  let targetUrl = String(rawUrl || '').trim();
  if (!targetUrl) return { success: false, error: 'URL boş.' };
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000)
  });

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const rawBody = await res.text();

  if (ctype.includes('application/json')) {
    return {
      success: res.ok,
      status: res.status,
      url: res.url || targetUrl,
      title: 'JSON Veri',
      text: rawBody.slice(0, 12000),
      images: []
    };
  }

  const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtmlTags(titleMatch[1]) : res.url || targetUrl;

  const imgs = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let im;
  while ((im = imgRegex.exec(rawBody)) !== null && imgs.length < 12) {
    try {
      const abs = new URL(decodeHtmlEntities(im[1]), res.url || targetUrl).href;
      if (/^https?:\/\//i.test(abs) && !/\.(svg|ico)(\?|$)/i.test(abs)) {
        imgs.push(abs);
      }
    } catch (_) {}
  }

  const cleanedText = decodeHtmlEntities(
    rawBody
      .replace(/<(script|style|noscript|svg|head|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
  );

  return {
    success: res.ok,
    status: res.status,
    url: res.url || targetUrl,
    title,
    text: cleanedText.slice(0, 12000),
    images: imgs
  };
}

function detectImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function downloadVerifiedImage(url, baseDestPath) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        'Referer': 'https://www.bing.com/'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const arrBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    if (buf.length < 1024) return null;
    const fmt = detectImageFormat(buf);
    if (!fmt) return null;

    const ext = `.${fmt}`;
    const parsed = path.parse(baseDestPath);
    const finalPath = parsed.ext ? path.join(parsed.dir, `${parsed.name}${ext}`) : `${baseDestPath}${ext}`;
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, buf);
    return {
      localPath: finalPath,
      fileUrl: 'file:///' + finalPath.replace(/\\/g, '/'),
      format: fmt,
      sizeBytes: buf.length
    };
  } catch (_) {
    return null;
  }
}

async function searchBingImageUrls(query, limit = 10) {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const candidates = [];
    const regex = /murl&quot;:&quot;(https?:[^&]+?)&quot;[\s\S]{0,400}?t&quot;:&quot;([^&]*?)&quot;/g;
    let m;
    while ((m = regex.exec(html)) !== null && candidates.length < limit) {
      const imgUrl = decodeHtmlEntities(m[1]).replace(/\\u002f/gi, '/');
      const title = decodeHtmlEntities(m[2] || query);
      if (/^https?:\/\//i.test(imgUrl) && !/doubleclick|facebook|shutterstock|alamy|gettyimages|istockphoto/i.test(imgUrl)) {
        candidates.push({ url: imgUrl, title });
      }
    }
    if (candidates.length === 0) {
      const simpleMatches = html.match(/murl&quot;:&quot;(https?:[^&]+?)&quot;/g) || [];
      for (const sm of simpleMatches.slice(0, limit)) {
        const u = sm.replace(/^murl&quot;:&quot;|&quot;$/g, '');
        if (/^https?:\/\//i.test(u)) candidates.push({ url: u, title: query });
      }
    }
    return candidates;
  } catch (_) {
    return [];
  }
}

async function searchWikimediaImageUrls(query, limit = 6) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1200&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LuxAI/1.0 (https://localhost)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    const out = [];
    for (const p of pages) {
      const info = p?.imageinfo?.[0];
      const imgUrl = info?.thumburl || info?.url;
      if (imgUrl && !/\.svg($|\?)/i.test(imgUrl)) {
        out.push({
          url: imgUrl,
          title: String(p.title || query).replace(/^File:/i, '').replace(/\.[^.]+$/, '')
        });
      }
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function searchAndDownloadImages(query, options = {}) {
  const q = String(query || '').trim();
  if (!q) return { success: false, error: 'Görsel arama sorgusu boş.', images: [] };

  const count = Math.max(1, Math.min(6, Number(options.count) || 2));
  const mediaDir = options.saveDir || path.join(os.tmpdir(), 'lux_ai_media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const bingCandidates = await searchBingImageUrls(q, 14);
  const wikiCandidates = bingCandidates.length < 4 ? await searchWikimediaImageUrls(q, 6) : [];
  const allCandidates = [...bingCandidates, ...wikiCandidates];

  const saved = [];
  const slug = q.toLowerCase().replace(/[^a-z0-9çğıöşü]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'gorsel';
  const stamp = Date.now();

  for (let i = 0; i < allCandidates.length && saved.length < count; i++) {
    const cand = allCandidates[i];
    const baseOut = path.join(mediaDir, `${slug}_${stamp}_${saved.length + 1}`);
    const dl = await downloadVerifiedImage(cand.url, baseOut);
    if (dl) {
      saved.push({
        title: cand.title || q,
        sourceUrl: cand.url,
        localPath: dl.localPath,
        fileUrl: dl.fileUrl,
        format: dl.format,
        sizeBytes: dl.sizeBytes
      });
    }
  }

  return {
    success: saved.length > 0,
    query: q,
    images: saved,
    error: saved.length === 0 ? 'Doğrulanmış görsel indirilemedi.' : null
  };
}

function escapeXmlText(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCreativeStudioHtml(prompt, options = {}) {
  const width = Math.max(320, Math.min(1920, Number(options.width) || 1024));
  const height = Math.max(240, Math.min(1440, Number(options.height) || 768));
  const title = String(options.title || prompt || 'Lux AI Tasarım').slice(0, 72);
  const rawHtml = options.htmlOrSvg ? String(options.htmlOrSvg).trim() : '';

  if (rawHtml) {
    if (/^\s*<svg/i.test(rawHtml)) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;}body{width:${width}px;height:${height}px;background:#070709;display:flex;align-items:center;justify-content:center;overflow:hidden;}svg{width:100%;height:100%;}</style></head><body>${rawHtml}</body></html>`;
    }
    if (/<!DOCTYPE|<html/i.test(rawHtml)) return rawHtml;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;}body{width:${width}px;height:${height}px;background:#070709;color:#fafafa;font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;}</style></head><body>${rawHtml}</body></html>`;
  }

  const pLower = title.toLowerCase();
  const isWarm = /güneş|gunes|sunset|altın|gold|kırmızı|red|turuncu|ateş|kahve/i.test(pLower);
  const isEmerald = /doğa|orman|yeşil|green|emerald|para|finans|borsa|crypto/i.test(pLower);
  const c1 = isWarm ? '#F59E0B' : (isEmerald ? '#10B981' : '#3B82F6');
  const c2 = isWarm ? '#EF4444' : (isEmerald ? '#06B6D4' : '#8B5CF6');
  const c3 = isWarm ? '#FDE047' : (isEmerald ? '#6EE7B7' : '#EC4899');
  const safeTitle = escapeXmlText(title);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: radial-gradient(circle at 20% 20%, ${c1}33 0%, transparent 45%),
                radial-gradient(circle at 80% 75%, ${c2}33 0%, transparent 50%),
                linear-gradient(135deg, #07070B 0%, #0D0F18 55%, #07070B 100%);
    color: #F8FAFC;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(48px);
    opacity: 0.6;
  }
  .card {
    position: relative;
    z-index: 2;
    width: 78%;
    padding: 46px 54px;
    border-radius: 28px;
    background: rgba(15, 17, 26, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .badge {
    align-self: flex-start;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-weight: 700;
    background: linear-gradient(90deg, ${c1}33, ${c2}33);
    border: 1px solid ${c1}66;
    color: #E2E8F0;
  }
  h1 {
    font-size: 44px;
    line-height: 1.18;
    font-weight: 800;
    background: linear-gradient(120deg, #FFFFFF 0%, #CBD5E1 60%, ${c1} 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .art {
    width: 100%;
    height: 220px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: #94A3B8;
  }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="orb" style="width:360px;height:360px;top:-60px;left:10%;background:${c1};"></div>
  <div class="orb" style="width:420px;height:420px;bottom:-80px;right:8%;background:${c2};"></div>
  <div class="card">
    <div class="badge">LUX AI STUDIO DESIGN</div>
    <h1>${safeTitle}</h1>
    <div class="art">
      <svg viewBox="0 0 800 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${c1}" />
            <stop offset="50%" stop-color="${c2}" />
            <stop offset="100%" stop-color="${c3}" />
          </linearGradient>
        </defs>
        <path d="M0 165 Q 160 75 320 135 T 640 105 T 800 130 L 800 220 L 0 220 Z" fill="url(#g1)" opacity="0.28"/>
        <path d="M0 140 Q 200 60 400 135 T 800 95" fill="none" stroke="url(#g1)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="400" cy="110" r="64" fill="url(#g1)" opacity="0.2"/>
        <circle cx="400" cy="110" r="38" fill="none" stroke="url(#g1)" stroke-width="3"/>
        <polygon points="400,56 446,136 354,136" fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity="0.88"/>
      </svg>
    </div>
    <div class="footer">
      <span>Generated by Lux AI Autonomous Studio</span>
      <span>${width} x ${height} PNG</span>
    </div>
  </div>
</body>
</html>`;
}

async function generateAiImageViaPollinations(prompt, destBasePath, options = {}) {
  const width = Math.max(256, Math.min(1280, Number(options.width) || 1024));
  const height = Math.max(256, Math.min(1280, Number(options.height) || 768));
  const fullPrompt = options.style ? `${prompt}, ${options.style}` : prompt;
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(22000)
    });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    const fmt = detectImageFormat(buf);
    if (!fmt || buf.length < 4096) return null;
    const ext = `.${fmt}`;
    const parsed = path.parse(destBasePath);
    const finalPath = parsed.ext ? path.join(parsed.dir, `${parsed.name}${ext}`) : `${destBasePath}${ext}`;
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, buf);
    return {
      localPath: finalPath,
      fileUrl: 'file:///' + finalPath.replace(/\\/g, '/'),
      format: fmt,
      sizeBytes: buf.length,
      engine: 'pollinations-ai'
    };
  } catch (_) {
    return null;
  }
}

function runPsScript(psScript, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const wrapped = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n${psScript}`;
    const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          success: !err,
          output: (stdout || '').trim(),
          error: err ? ((stderr || err.message || '').trim()) : ''
        });
      }
    );
  });
}

function captureScreenWithPowershell(destPath) {
  const safePath = destPath.replace(/'/g, "''");
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$dir = Split-Path -Parent '${safePath}'
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bmp.Save('${safePath}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "$($bounds.Width)x$($bounds.Height)"
`;
  return runPsScript(script, 15000);
}

async function pcControl(payload = {}, helpers = {}) {
  const action = String(payload.action || '').trim().toLowerCase();
  const target = String(payload.target || '').trim();
  const value = payload.value !== undefined ? String(payload.value) : '';
  const workspaceDir = payload.workspaceDir || helpers.workspaceDir || process.cwd();

  if (action === 'system_info') {
    const memTotalGb = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const memFreeGb = (os.freemem() / (1024 ** 3)).toFixed(1);
    const cpus = os.cpus() || [];
    return {
      success: true,
      action,
      output: [
        `Bilgisayar: ${os.hostname()} (${os.platform()} ${os.release()} ${os.arch()})`,
        `Kullanıcı: ${os.userInfo().username} | Masaüstü: ${getKnownDirs(helpers).desktop}`,
        `CPU: ${cpus[0]?.model || 'Bilinmiyor'} (${cpus.length} çekirdek)`,
        `RAM: ${memFreeGb} GB boş / ${memTotalGb} GB toplam`,
        `Aktif Çalışma Klasörü: ${workspaceDir}`
      ].join('\n')
    };
  }

  if (action === 'clipboard_get') {
    const text = helpers.clipboard?.readText?.() || '';
    return { success: true, action, text, output: text || '(pano boş)' };
  }

  if (action === 'clipboard_set') {
    const content = value || target;
    helpers.clipboard?.writeText?.(content);
    return { success: true, action, output: `Panoya kopyalandı (${content.length} karakter).` };
  }

  if (action === 'open_url' || action === 'open_website') {
    let url = target || value;
    if (!url) return { success: false, error: 'URL parametresi gerekli.' };
    if (payload.blockYouTube === true && /(?:youtube\.com|youtu\.be)/i.test(url)) {
      return { success: false, error: 'Kullanıcı YouTube açılmasını istemedi.' };
    }
    if (/^[a-zA-Z]:[\\/]|^desktop|^masaüstü|^masaustu|^~/i.test(url) || (!/^https?:\/\//i.test(url) && !url.includes('.'))) {
      const resolved = resolveSmartPath(url, workspaceDir, helpers);
      if (fs.existsSync(resolved)) {
        const errMsg = await helpers.shell?.openPath?.(resolved);
        return { success: !errMsg, action, path: resolved, output: errMsg || `Açıldı: ${resolved}` };
      }
    }
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) {
      if (/\s/.test(url) || !url.includes('.')) {
        return { success: false, error: `Geçerli bir URL veya mevcut yerel yol değil: ${url}` };
      }
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      if (payload.blockYouTube === true && /(?:youtube\.com|youtu\.be)/i.test(parsed.hostname)) {
        return { success: false, error: 'Kullanıcı YouTube açılmasını istemedi.' };
      }
    } catch (_) {
      return { success: false, error: `Geçersiz URL: ${url}` };
    }
    await helpers.shell?.openExternal?.(url);
    return { success: true, action, url, output: `Tarayıcıda açıldı: ${url}` };
  }

  if (action === 'open_folder' || action === 'open_path') {
    const resolved = resolveSmartPath(target || value || workspaceDir, workspaceDir, helpers);
    if (!fs.existsSync(resolved)) {
      return { success: false, error: `Konum bulunamadı: ${resolved}` };
    }
    const errMsg = await helpers.shell?.openPath?.(resolved);
    return { success: !errMsg, action, path: resolved, output: errMsg || `Açıldı: ${resolved}` };
  }

  if (action === 'open_app' || action === 'launch_app') {
    const appAlias = {
      'not defteri': 'notepad.exe',
      'not defterini': 'notepad.exe',
      'not': 'notepad.exe',
      'notepad': 'notepad.exe',
      'hesap makinesi': 'calc.exe',
      'hesap makinesini': 'calc.exe',
      'hesap makinası': 'calc.exe',
      'hesap makinasi': 'calc.exe',
      'hesap': 'calc.exe',
      'calculator': 'calc.exe',
      'calc': 'calc.exe',
      'chrome': 'chrome.exe',
      'google chrome': 'chrome.exe',
      'edge': 'msedge.exe',
      'microsoft edge': 'msedge.exe',
      'tarayıcı': 'msedge.exe',
      'tarayici': 'msedge.exe',
      'vscode': 'code',
      'vs code': 'code',
      'explorer': 'explorer.exe',
      'dosya gezgini': 'explorer.exe',
      'dosya yöneticisi': 'explorer.exe',
      'dosya yoneticisi': 'explorer.exe',
      'paint': 'mspaint.exe',
      'painti': 'mspaint.exe',
      'çizim': 'mspaint.exe',
      'görev yöneticisi': 'taskmgr.exe',
      'gorev yoneticisi': 'taskmgr.exe',
      'ayarlar': 'ms-settings:',
      'windows ayarları': 'ms-settings:',
      'powershell': 'powershell.exe',
      'terminal': 'powershell.exe',
      'terminali': 'powershell.exe',
      'cmd': 'cmd.exe',
      'komut istemi': 'cmd.exe'
    };
    const appCmd = appAlias[target.toLowerCase()] || target;
    if (!appCmd) return { success: false, error: 'Açılacak uygulama belirtilmedi.' };
    const safeApp = appCmd.replace(/'/g, "''");
    const safeArgs = value ? value.replace(/'/g, "''") : '';
    const ps = safeArgs
      ? `Start-Process -FilePath '${safeApp}' -ArgumentList '${safeArgs}'`
      : `Start-Process -FilePath '${safeApp}'`;
    const r = await runPsScript(ps, 10000);
    return {
      success: r.success,
      action,
      output: r.success ? `Uygulama başlatıldı: ${appCmd}` : (r.error || 'Başlatılamadı'),
      error: r.error
    };
  }

  if (action === 'list_windows') {
    const r = await runPsScript(
      `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object ProcessName, Id, MainWindowTitle | ConvertTo-Json -Compress`,
      10000
    );
    return { success: r.success, action, output: r.output || '[]', error: r.error };
  }

  if (action === 'focus_window') {
    const safeTarget = target.replace(/'/g, "''");
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeTarget}*' -or $_.ProcessName -like '*${safeTarget}*' } | Select-Object -First 1
if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
  [LuxWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [LuxWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Write-Output ("Odaklandı: " + $p.ProcessName + " - " + $p.MainWindowTitle)
} else {
  Write-Error "Pencere bulunamadı"
}
`;
    const r = await runPsScript(ps, 10000);
    return { success: r.success, action, output: r.output || r.error, error: r.error };
  }

  if (action === 'type_text') {
    const txt = value || target;
    if (!txt) return { success: false, error: 'Yazılacak metin boş.' };
    if (helpers.clipboard?.writeText) {
      helpers.clipboard.writeText(txt);
      const r = await runPsScript(`Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 120; [System.Windows.Forms.SendKeys]::SendWait('^v')`, 8000);
      return { success: r.success, action, output: r.success ? `Metin yazıldı (${txt.length} karakter).` : r.error };
    }
    return { success: false, error: 'Pano erişimi yok.' };
  }

  if (action === 'send_keys' || action === 'hotkey') {
    const keys = value || target;
    if (!keys) return { success: false, error: 'Tuş dizisi boş.' };
    const safeKeys = keys.replace(/'/g, "''");
    const r = await runPsScript(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`, 8000);
    return { success: r.success, action, output: r.success ? `Tuşlar gönderildi: ${keys}` : r.error };
  }

  if (action === 'mouse_click' || action === 'mouse_move') {
    const x = Math.round(Number(payload.x) || 0);
    const y = Math.round(Number(payload.y) || 0);
    const doClick = action === 'mouse_click';
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
}
"@
[LuxMouse]::SetCursorPos(${x}, ${y}) | Out-Null
${doClick ? '[LuxMouse]::mouse_event(0x0002, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; [LuxMouse]::mouse_event(0x0004, 0, 0, 0, 0);' : ''}
Write-Output "${doClick ? 'Tıklandı' : 'Konumlandı'}: (${x}, ${y})"
`;
    const r = await runPsScript(ps, 8000);
    return { success: r.success, action, output: r.output || r.error };
  }

  if (action === 'volume') {
    const mode = (value || target).toLowerCase();
    const vk = (mode.includes('mute') || mode.includes('sessiz'))
      ? '0xAD'
      : (mode.includes('down') || mode.includes('azalt') || mode.includes('kıs') ? '0xAE' : '0xAF');
    const steps = mode.includes('mute') || mode.includes('sessiz') ? 1 : Math.max(1, Math.min(20, Number(payload.steps) || 3));
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxAudioKey {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
for ($i = 0; $i -lt ${steps}; $i++) {
  [LuxAudioKey]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
  [LuxAudioKey]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
}
Write-Output "Ses komutu uygulandı: ${mode || 'up'}"
`;
    const r = await runPsScript(ps, 8000);
    return { success: r.success, action, output: r.output || r.error };
  }

  return { success: false, error: `Bilinmeyen pc_control eylemi: ${action}` };
}

module.exports = {
  getKnownDirs,
  resolveSmartPath,
  listDesktopProjects,
  listFilesSmart,
  searchFilesSmart,
  webSearch,
  fetchWebpage,
  searchAndDownloadImages,
  buildCreativeStudioHtml,
  generateAiImageViaPollinations,
  captureScreenWithPowershell,
  pcControl,
  detectImageFormat
};
