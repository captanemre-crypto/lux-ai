// Web arama, hava durumu ve sayfa getirme (saf ağ katmanı)
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const { fetchPublicUrl } = require('./net_guard');

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
  return decodeHtmlEntities(
    String(str || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
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
  let m = q.match(
    /(?:^|\s)([A-ZÇĞİÖŞÜa-zçğıöşü]{3,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{3,})?)(?:'(?:te|ta|de|da|daki|deki|in|ın))?\s+(?:için\s+)?(?:bugün\s+|yarın\s+)?(?:hava\s+durumu|hava\s+nasıl|hava\s+raporu|sıcaklık|weather)/i
  );
  if (m && m[1]) {
    const stop = new Set([
      'bugün',
      'yarın',
      'internetten',
      'dostum',
      'bana',
      'lütfen',
      'şimdi',
      'şu',
      'an',
      'için',
      'yerel',
      'uluslararası',
      'hava',
      'güncel'
    ]);
    const parts = m[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !stop.has(w.toLowerCase()));
    if (parts.length > 0) return parts[parts.length - 1].replace(/['’](?:te|ta|de|da|daki|deki|in|ın)$/i, '');
  }
  m = q.match(/(?:hava\s+durumu|hava\s+raporu|weather(?:\s+in|\s+for)?)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]{3,})/i);
  if (m && m[1]) {
    const candidate = m[1].replace(/['’](?:te|ta|de|da|daki|deki|in|ın|u|ü)$/i, '');
    if (!/^(?:nedir|nasıl|tahmin|tahmini|raporu|bugün|yarın)$/i.test(candidate)) {
      return candidate;
    }
  }
  const tokens = q
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/);
  const stopWords = new Set([
    'dostum',
    'bana',
    'internetten',
    'internet',
    'üzerinden',
    'bugün',
    'yarın',
    'hava',
    'durumu',
    'durumunu',
    'tahmin',
    'tahminlerini',
    'rapor',
    'raporlarını',
    'nedir',
    'nasıl',
    'bul',
    'getir',
    'bulur',
    'musun',
    'öğren',
    'öğrenir',
    'misin',
    'için',
    've',
    'ile',
    'bir',
    'olan',
    'güncel'
  ]);
  const meaningful = tokens.filter((t) => t.length >= 3 && !stopWords.has(t.toLowerCase()));
  return meaningful[0] || '';
}

async function fetchOpenMeteoWeather(city) {
  if (!city) return null;
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`,
      {
        headers: { 'User-Agent': 'LuxAI/1.0' },
        signal: AbortSignal.timeout(7000)
      }
    );
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
      Accept: 'text/html,application/xhtml+xml',
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
    const snipMatch = block.match(
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
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
    return (data?.query?.search || []).map((item) => ({
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

  let res, finalUrl;
  try {
    ({ res, finalUrl } = await fetchPublicUrl(targetUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*'
      },
      signal: AbortSignal.timeout(12000)
    }));
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : 'İstek engellendi.' };
  }

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const rawBody = await res.text();

  if (ctype.includes('application/json')) {
    return {
      success: res.ok,
      status: res.status,
      url: finalUrl,
      title: 'JSON Veri',
      text: rawBody.slice(0, 12000),
      images: []
    };
  }

  const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtmlTags(titleMatch[1]) : finalUrl;

  const imgs = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let im;
  while ((im = imgRegex.exec(rawBody)) !== null && imgs.length < 12) {
    try {
      const abs = new URL(decodeHtmlEntities(im[1]), finalUrl).href;
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
    url: finalUrl,
    title,
    text: cleanedText.slice(0, 12000),
    images: imgs
  };
}

module.exports = {
  BROWSER_UA,
  decodeHtmlEntities,
  stripHtmlTags,
  fetchWebpage,
  webSearch
};
