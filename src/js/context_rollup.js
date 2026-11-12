// Bağlam rollover/özetleme — deterministik, çevrimdışı, ağ çağrısı YOK.
// Uzun sohbetlerde önceki turlar modelle paylaşılan istekten sessizce düşürülüyordu
// (slice(-12)). Bu modül düşen turları silmek yerine tek satırlık bir özete
// sıkıştırır ve istemci isteğine [ÖNCEKİ KONUŞMANIN ÖZETİ] bloğu olarak ekler.
// Son `keepRecent` mesaj her zaman birebir korunur; özet yalnızca BİLGİ amaçlıdır
// ve araç/seçim mantığının girdisi DEĞİLDİR (o yollar özgün prompt ile çalışır).
(function (global) {
  "use strict";

  const DEFAULTS = {
    keepRecent: 12, // yerel CPU modellerinde çağıran 4 verir
    summaryItemChars: 110, // her özet satırının tavanı
    maxSummaryItems: 36, // özete yazılacak en fazla satır
    maxSummaryChars: 3200 // özet bloğunun toplam tavanı
  };

  function clip(text, max) {
    const flat = String(text == null ? "" : text)
      .replace(/\s+/g, " ")
      .trim();
    if (flat.length <= max) return flat;
    return flat.slice(0, Math.max(0, max - 1)) + "…";
  }

  function msgText(m) {
    if (!m) return "";
    const c = m.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      return c.map((p) => (p && (p.text || p.content)) || "").join(" ");
    }
    return String(c || "");
  }

  function isConversational(m) {
    return Boolean(m) && (m.role === "user" || m.role === "assistant" || m.role === "model") && msgText(m).trim().length > 0;
  }

  /**
   * history'yi rollover'a tabi tutar.
   * @returns {{ kept: Array, dropped: number, summary: string }}
   *   kept    — korunacak birebir mesajlar (boş içerikliler elenmiş)
   *   dropped — özete taşınan tur sayısı
   *   summary — özet metni ('\n' satırları); dropped===0 ise ''
   */
  function buildContextRollup(history, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    const msgs = Array.isArray(history) ? history.filter(isConversational) : [];
    const keep = Math.max(1, Number(opts.keepRecent) || DEFAULTS.keepRecent);
    if (msgs.length <= keep) {
      return { kept: msgs, dropped: 0, summary: "" };
    }
    const kept = msgs.slice(msgs.length - keep);
    const dropped = msgs.slice(0, msgs.length - keep);
    const seen = new Set();
    const lines = [];
    for (const m of dropped) {
      const text = clip(msgText(m), opts.summaryItemChars);
      if (!text) continue;
      const role = m.role === "user" ? "Kullanıcı" : "Asistan";
      const line = `- ${role}: ${text}`;
      if (seen.has(line)) continue; // tekrarları ele (deterministik tekilleştirme)
      seen.add(line);
      lines.push(line);
      if (lines.length >= opts.maxSummaryItems) break;
    }
    let summary = lines.join("\n");
    if (summary.length > opts.maxSummaryChars) {
      summary = summary.slice(0, opts.maxSummaryChars - 62) + "\n- (…daha eski turlar bu özetin sınırına takıldı)";
    }
    return { kept, dropped: dropped.length, summary };
  }

  /**
   * Prompt'a özet bloğu ekler ve korunan mesajları döndürür.
   * Özet yoksa prompt değişmeden döner.
   */
  function withRollupContext(prompt, history, options) {
    const rolled = buildContextRollup(history, options);
    if (!rolled.summary) {
      return { prompt, kept: rolled.kept, dropped: 0, rolled: false };
    }
    const prefix = `[ÖNCEKİ KONUŞMANIN ÖZETİ — ${rolled.dropped} eski tur]\n${rolled.summary}\n\n(son ${rolled.kept.length} mesaj birebir aynen ektedir)\n\n---\n\n`;
    return { prompt: prefix + String(prompt), kept: rolled.kept, dropped: rolled.dropped, rolled: true };
  }

  const api = { buildContextRollup, withRollupContext };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.LuxContextRollup = api;
  else if (typeof globalThis !== "undefined") globalThis.LuxContextRollup = api;
})(typeof window !== "undefined" ? window : globalThis);
