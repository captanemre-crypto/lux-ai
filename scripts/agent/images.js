// Görsel arama/indirme, AI ile görsel üretimi ve Studio tasarım HTML'i
const fs = require('fs');
const path = require('path');
const os = require('os');
const { BROWSER_UA, decodeHtmlEntities, stripHtmlTags } = require('./web');
const { fetchPublicUrl } = require('./net_guard');

function detectImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'webp';
  return null;
}

async function downloadVerifiedImage(url, baseDestPath) {
  try {
    const { res } = await fetchPublicUrl(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        Referer: 'https://www.bing.com/'
      },
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
      if (
        /^https?:\/\//i.test(imgUrl) &&
        !/doubleclick|facebook|shutterstock|alamy|gettyimages|istockphoto/i.test(imgUrl)
      ) {
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
          title: String(p.title || query)
            .replace(/^File:/i, '')
            .replace(/\.[^.]+$/, '')
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
  const slug =
    q
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'gorsel';
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
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const c1 = isWarm ? '#F59E0B' : isEmerald ? '#10B981' : '#3B82F6';
  const c2 = isWarm ? '#EF4444' : isEmerald ? '#06B6D4' : '#8B5CF6';
  const c3 = isWarm ? '#FDE047' : isEmerald ? '#6EE7B7' : '#EC4899';
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

module.exports = {
  detectImageFormat,
  downloadVerifiedImage,
  searchAndDownloadImages,
  escapeXmlText,
  buildCreativeStudioHtml,
  generateAiImageViaPollinations
};
