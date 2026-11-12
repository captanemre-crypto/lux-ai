// Ağ & komut enjeksiyonu korumaları (saf yardımcı modül — Electron bağımlılığı yok)
//
// - assertPublicUrl / fetchPublicUrl: ajanın dış URL erişiminde SSRF'i engeller.
//   Yalnız http(s)'e izin verilir; loopback / özel / link-local / multicast /
//   CGNAT adresler, dahili host adları ve bunlara çözümlenen DNS kayıtları reddedilir.
//   Yönlendirmeler elle izlenir ve her sıçrama yeniden doğrulanır.
// - clampInt: sayısal parametreleri güvenli aralığa sıkıştırır.
// - sanitizePsDoubleQuoted: PowerShell çift tırnaklı dizgisine gömülecek
//   serbest metindeki tehlikeli karakterleri ayıklar ($, ", ` ve satır sonları).
// - escapePsSingleQuoted: PowerShell tek tırnaklı dizgisi için ' → '' kaçışı.
'use strict';

const net = require('net');
const dns = require('dns').promises;

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata', 'instance-data']);

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.corp'];

function parseIPv4(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  const nums = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    nums.push(n);
  }
  return nums;
}

function isPrivateIPv4(ip) {
  const p = parseIPv4(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // this-net / RFC1918 / loopback
  if (a === 169 && b === 254) return true; // link-local (metadata dahil)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && p[2] === 0) return true; // IETF proto atama 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18.0.0/15
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

function normalizeIPv6(host) {
  // URL.hostname zaten parantezsiz döner; IPv4-eşlemeli ::ffff:a.b.c.d biçimini ayıkla
  let h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return { mappedV4: mapped };
    const m = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (m) {
      const hi = parseInt(m[1], 16),
        lo = parseInt(m[2], 16);
      return { mappedV4: `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}` };
    }
  }
  return { bare: h };
}

function isPrivateIPv6(host) {
  const { bare, mappedV4 } = normalizeIPv6(host);
  if (mappedV4) return isPrivateIPv4(mappedV4);
  if (!bare) return false;
  if (bare === '::1' || bare === '::') return true; // loopback / unspecified
  const first = parseInt(bare.split(':')[0] || '0', 16);
  if (Number.isFinite(first)) {
    if (first >= 0xfe80 && first <= 0xfebf) return true; // link-local fe80::/10
    if (first >= 0xff00) return true; // multicast ff00::/8
    if ((first & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  }
  if (bare.startsWith('64:ff9b:')) return true; // NAT64 — tutucu davran
  if (bare.startsWith('2001:db8:')) return true; // dokümantasyon aralığı
  return false;
}

function isPrivateIpLiteral(host) {
  const h = String(host || '')
    .trim()
    .replace(/^\[|\]$/g, '');
  if (net.isIPv4(h)) return isPrivateIPv4(h);
  if (net.isIPv6(h)) return isPrivateIPv6(h);
  return false;
}

function isBlockedHostname(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => h.endsWith(s))) return true;
  return false;
}

async function assertPublicUrl(urlStr, options = {}) {
  const { resolveDns = true } = options;
  let u;
  try {
    u = new URL(String(urlStr || '').trim());
  } catch (_) {
    return { ok: false, error: 'Geçersiz URL.' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Yalnız http/https URL şemalarına izin verilir.' };
  }
  if (u.username || u.password) {
    return { ok: false, error: 'Kimlik bilgisi içeren URL’ler reddedildi.' };
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) return { ok: false, error: 'URL’de host bulunmuyor.' };
  if (isBlockedHostname(host)) {
    return { ok: false, error: `Dahili host adı reddedildi: ${host}`, blocked: true };
  }
  if (isPrivateIpLiteral(host)) {
    return { ok: false, error: `Özel/iç IP adresi reddedildi: ${host}`, blocked: true };
  }
  if (net.isIP(host)) return { ok: true, url: u.href };
  if (resolveDns) {
    try {
      const addrs = await dns.lookup(host, { all: true, verbatim: true });
      if (!addrs || addrs.length === 0) {
        return { ok: false, error: `DNS kaydı bulunamadı: ${host}`, blocked: true };
      }
      for (const a of addrs) {
        if (isPrivateIpLiteral(a.address)) {
          return { ok: false, error: `DNS dahili adrese çözümlendi (${a.address}) — SSRF engellendi.`, blocked: true };
        }
      }
    } catch (err) {
      return { ok: false, error: `DNS çözümlenemedi: ${err && err.code ? err.code : err.message}`, blocked: true };
    }
  }
  return { ok: true, url: u.href };
}

// Elle yönlendirme izleyen, her sıçramada SSRF doğrulaması yapan fetch sarmalayıcısı.
async function fetchPublicUrl(urlStr, init = {}, maxRedirects = 4) {
  let current = String(urlStr || '').trim();
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertPublicUrl(current);
    if (!check.ok) {
      const err = new Error(check.error || 'URL reddedildi.');
      err.code = 'ERR_SSRF_BLOCKED';
      throw err;
    }
    const res = await fetch(check.url, { ...init, redirect: 'manual' });
    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: check.url };
      let next;
      try {
        next = new URL(loc, check.url).href;
      } catch (_) {
        const err = new Error('Yönlendirme hedefi geçersiz.');
        err.code = 'ERR_SSRF_BLOCKED';
        throw err;
      }
      current = next;
      continue;
    }
    return { res, finalUrl: check.url };
  }
  const err = new Error('Çok fazla yönlendirme — istek iptal edildi (SSRF koruması).');
  err.code = 'ERR_SSRF_REDIRECTS';
  throw err;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function sanitizePsDoubleQuoted(value) {
  // Çift tırnaklı PS dizgisinde $( ), ", ` ve satır sonları tehlikeli
  return String(value == null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/["$`]/g, '')
    .slice(0, 300);
}

function sanitizePsSingleQuoted(value) {
  // Tek tırnaklı PS dizgisinde yalnız ' kaçışı yeterlidir; satır sonları da ayıklanır
  return String(value == null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/'/g, "''")
    .slice(0, 2000);
}

module.exports = {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIpLiteral,
  isBlockedHostname,
  assertPublicUrl,
  fetchPublicUrl,
  clampInt,
  sanitizePsDoubleQuoted,
  sanitizePsSingleQuoted
};
