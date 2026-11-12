#!/usr/bin/env node
/**
 * CANLI API duman testi — yalnızca elle çalıştırılır (npm run test:live).
 *
 * npm test bu betiği ÇALIŞTIRMAZ; CI ona dokunmaz. Amaç: gerçek
 * Gemini / OpenAI-uyumlu / Anthropic uç noktalarıyla asgari bir istek
 * atarak yerel yapılandırmayı (anahtar, ağ, model adı) doğrulamak.
 *
 * Anahtarlar yalnızca ortam değişkenlerinden okunur; hiçbir yere
 * yazılmaz, loglanmaz veya saklanmaz:
 *   GEMINI_API_KEY veya GOOGLE_API_KEY   (Gemini)
 *   OPENAI_API_KEY                       (OpenAI-uyumlu; LUX_OPENAI_BASE, LUX_OPENAI_MODEL ile özelleştirilebilir)
 *   ANTHROPIC_API_KEY                    (Anthropic;   LUX_ANTHROPIC_MODEL ile özelleştirilebilir)
 *
 * Çıkış kodu: 0 = yapılandırılan sağlayıcıların tümü geçti (veya hiç anahtar yok — atlandı),
 *             1 = yapılandırılan en az bir sağlayıcı başarısız oldu.
 */
const TIMEOUT_MS = 20000;

async function withTimeout(fn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

const PROBES = [
  {
    name: 'Gemini',
    configured: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    run: async () => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const model = process.env.LUX_GEMINI_MODEL || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      return withTimeout(async (signal) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
            generationConfig: { maxOutputTokens: 8, temperature: 0 }
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || '';
        if (!text.trim()) throw new Error('boş yanıt (candidates/parts yok)');
        return text.trim();
      });
    }
  },
  {
    name: 'OpenAI-uyumlu',
    configured: () => Boolean(process.env.OPENAI_API_KEY),
    run: async () => {
      const key = process.env.OPENAI_API_KEY;
      const base = (process.env.LUX_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const model = process.env.LUX_OPENAI_MODEL || 'gpt-4o-mini';
      const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
      return withTimeout(async (signal) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
            max_tokens: 8,
            temperature: 0
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (!String(text).trim()) throw new Error('boş yanıt (choices/message yok)');
        return String(text).trim();
      });
    }
  },
  {
    name: 'Anthropic',
    configured: () => Boolean(process.env.ANTHROPIC_API_KEY),
    run: async () => {
      const key = process.env.ANTHROPIC_API_KEY;
      const base = (process.env.LUX_ANTHROPIC_BASE || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
      const model = process.env.LUX_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
      return withTimeout(async (signal) => {
        const res = await fetch(`${base}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          signal,
          body: JSON.stringify({
            model,
            max_tokens: 8,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }]
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = (data?.content || []).map((b) => b?.text || '').join('');
        if (!text.trim()) throw new Error('boş yanıt (content blokları yok)');
        return text.trim();
      });
    }
  }
];

(async () => {
  const configured = PROBES.filter((p) => p.configured());
  if (configured.length === 0) {
    console.log('CANLI API TESTİ ATLANDI — hiçbir API anahtarı yapılandırılmadı.');
    console.log(
      'Anahtar vermek için: GEMINI_API_KEY=... / OPENAI_API_KEY=... / ANTHROPIC_API_KEY=... npm run test:live'
    );
    process.exit(0);
  }
  let failures = 0;
  for (const probe of configured) {
    process.stdout.write(`[${probe.name}] istek atılıyor… `);
    try {
      const text = await probe.run();
      console.log(`GEÇTİ (yanıt: "${text.slice(0, 40)}")`);
    } catch (err) {
      failures += 1;
      const msg = err?.name === 'AbortError' ? `zaman aşımı (>${TIMEOUT_MS}ms)` : err?.message || String(err);
      console.log(`BAŞARISIZ — ${msg}`);
    }
  }
  if (failures > 0) {
    console.error(`\nCANLI API TESTİ BAŞARISIZ: ${failures}/${configured.length} sağlayıcı hata verdi.`);
    process.exit(1);
  }
  console.log(`\nCANLI API TESTİ GEÇTİ: ${configured.length} sağlayıcının tümü yanıt verdi.`);
})();
