// LUX AI — Konuşma metni yardımcıları
//
// chat.js'ten ayrıştırıldı. Bu fonksiyonlar saf metin işleme yapar;
// index.html'de chat.js'ten ÖNCE yüklenir ve klasik script globalinde tanım kazanır.

function cleanTextForSpeech(text) {
  if (!text) return "";
  let clean = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/```[\s\S]*?```/g, "kod bloğu")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove keycap emojis, flag sequences, Unicode emojis, pictographs, dingbats, arrows & decorative symbols
    .replace(/[0-9#*]\uFE0F?\u20E3/g, " ")
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, " ")
    .replace(/[\p{Extended_Pictographic}\u2600-\u27BF\u{1F000}-\u{1FAFF}\u231A-\u23FA\u25A0-\u25FF\u2B00-\u2BFF\u2190-\u21FF]/gu, " ")
    // eslint-disable-next-line no-misleading-character-class -- sınıfın amacı ZWJ/variation selector/skin-tone ayıklamak; tekli eşleşme kasıtlı
    .replace(/[\u200D\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}©®™•●▪▫▸▹◆◇★☆✓✔✕✖✗✘\u26A0\u26A1]/gu, " ")
    // Remove ASCII emoticons & text smileys (without touching timestamps like 21:17 or URLs)
    .replace(
      /(^|[\s([{"'“‘])(?:[:;=8]['’`]?[-o*^]?[)(DPpOo3\\/|*><]+|[xX][-o*']?[DPp)(]+|<\/?3|\^\^|>_<|\^_+\^|-_+-|[Tt]_[Tt]|[Oo]_[Oo])(?=$|[\s.,!?)\]}"'”’])/g,
      "$1"
    )
    .replace(/\s*(?:<-+|-+>|=+>|<=+)\s*/g, " ")
    .replace(/[*#_~>]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/([.!?])\1{2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[.!?,;:\s-]+/, "")
    .trim();

  if (text.includes("FreeUsageLimitError") || text.includes("API Yanıtı / Hata")) {
    return "Seçili model bağlantısında kota sınırı veya erişim hatası oluştu. Lütfen sol alttan farklı bir model seç.";
  }

  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (sentences.length > 7) {
    clean = sentences.slice(0, 7).join(" ").trim();
  }
  if (clean.length > 440) {
    clean = clean.slice(0, 440).trim() + "...";
  }
  return clean;
}
window.cleanTextForSpeech = cleanTextForSpeech;

function splitSpeechSentencesForStreaming(text) {
  const clean = cleanTextForSpeech(text);
  if (!clean) return [];
  const rawSentences = clean
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawSentences.length <= 1) return [clean];

  const chunks = [];
  let buf = "";
  for (const sent of rawSentences) {
    const combined = buf ? `${buf} ${sent}` : sent;
    if (!buf) {
      buf = sent;
    } else if (buf.length < 48 || combined.length <= 135) {
      buf = combined;
    } else {
      chunks.push(buf);
      buf = sent;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length > 0 ? chunks : [clean];
}
window.splitSpeechSentencesForStreaming = splitSpeechSentencesForStreaming;

// Canlı akış (stream) sırasında <think>/<lux_tool> işaretlemelerini temizler —
// konuşma balonu çiğ etiketi göstermemesi için render öncesi kullanılır.
function stripMarkupForLiveStream(rawText) {
  return String(rawText || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/<lux_tool[\s\S]*$/i, "");
}
