// LUX AI — Model çıktısı ayrıştırma & doğallaştırma
//
// Güvenli JSON/XML tool-çağrısı çözümü, lux_tool/think etiket temizliği ve
// Türkçe samimi dil doğallaştırma. chat.js'ten ayrıştırıldı; klasik script
// globalinde tanım kazanır, chat.js'ten ÖNCE yüklenir.

function safeParseToolJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1. Direct standard JSON
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:14", e);
  }

  // 2. Fix unescaped Windows backslashes in paths (e.g. C:\Users -> C:\\Users)
  // In JSON strings, valid escapes are \", \\, \/, \b, \f, \n, \r, \t, and \uXXXX.
  try {
    const fixedBackslashes = trimmed.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
    return JSON.parse(fixedBackslashes);
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:21", e);
  }

  // 3. Relax trailing commas + fix backslashes
  try {
    const relaxed = trimmed.replace(/,\s*([}\]])/g, "$1").replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
    return JSON.parse(relaxed);
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:27", e);
  }

  // 4. Single quotes to double quotes + trailing comma + backslashes
  try {
    const singleToDouble = trimmed
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/\\(?!["'\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(singleToDouble);
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:36", e);
  }

  // 5. Unescaped raw newlines inside string values
  try {
    const fixedNewlines = trimmed
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\r\n]+/g, "\\n");
    return JSON.parse(fixedNewlines);
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:45", e);
  }

  // 6. Regex fallback for {"name":"run_command","args":{...}}
  try {
    const nameMatch = trimmed.match(/["']?name["']?\s*:\s*["']([^"']+)["']/i);
    if (nameMatch) {
      const toolName = nameMatch[1].trim();
      const argsMatch = trimmed.match(/["']?args["']?\s*:\s*(\{[\s\S]*\})/i);
      let args = {};
      if (argsMatch) {
        args = safeParseToolJson(argsMatch[1]) || {};
      }
      return { name: toolName, args };
    }
  } catch (e) {
    window.luxDebug?.("model_output_parse.js:59", e);
  }

  return null;
}

function parseXmlToolCalls(text) {
  if (!text || typeof text !== "string") return [];
  const calls = [];
  const regex = /<lux_tool>\s*([\s\S]*?)\s*<\/lux_tool>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = safeParseToolJson(match[1]);
      if (parsed && parsed.name) {
        const cleanName = String(parsed.name).trim();
        if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
          calls.push({ name: cleanName, args: parsed.args || parsed.arguments || {} });
        }
      }
    } catch (e) {
      window.luxDebug?.("model_output_parse.js:78", e);
    }
  }
  if (calls.length === 0) {
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let jm;
    while ((jm = jsonBlockRegex.exec(text)) !== null) {
      try {
        const parsed = safeParseToolJson(jm[1]);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && item.name) {
            const cleanName = String(item.name).trim();
            if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
              calls.push({ name: cleanName, args: item.args || item.arguments || {} });
            }
          }
        }
      } catch (e) {
        window.luxDebug?.("model_output_parse.js:95", e);
      }
    }
  }
  // Tolerant fallback for unclosed <lux_tool> tag
  if (calls.length === 0 && /<lux_tool/i.test(text)) {
    const unclosedMatch = text.match(/<lux_tool>\s*([\s\S]*?)(?:<\/lux_tool>|$)/i);
    if (unclosedMatch && unclosedMatch[1]) {
      const parsed = safeParseToolJson(unclosedMatch[1]);
      if (parsed && parsed.name) {
        const cleanName = String(parsed.name).trim();
        if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
          calls.push({ name: cleanName, args: parsed.args || parsed.arguments || {} });
        }
      }
    }
  }
  return calls;
}

function cleanAssistantFinalText(text) {
  if (!text) return "";
  const cleaned = String(text)
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/<lux_tool[\s\S]*$/gi, "");
  const withoutThink = cleaned
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think[\s\S]*$/gi, "")
    .trim();
  return (withoutThink || cleaned).trim();
}

function naturalizeConversationalTurkish(rawReply, userPrompt = "", history = [], opts = {}) {
  let reply = String(rawReply || "").trim();
  if (!reply) return reply;

  const recentUserText = [
    ...(Array.isArray(history)
      ? history
          .slice(-8)
          .filter((m) => m.role === "user")
          .map((m) => m.content || "")
      : []),
    String(userPrompt || "")
  ]
    .join("\n")
    .toLowerCase();
  const strictlyAvoidFormal = /(?:^|\s)size\b.*?(kullanma|deme|söyleme|yasak|istemiyorum)|resmi\s*(konuşma|olma)/i.test(recentUserText);

  // Preserve code blocks, inline code, and URLs verbatim
  const slots = [];
  const stash = (match) => {
    const token = `__LUX_CODE_SLOT_${slots.length}__`;
    slots.push(match);
    return token;
  };
  let text = reply
    .replace(/```[\s\S]*?```/g, stash)
    .replace(
      /(?:(?:Anlad[ıi]m|Tamam|Tamamd[ıi]r|Anla[şs][ıi]ld[ıi]|Peki)[,!.]?\s*)?(?:o\s+kelimeyi|["'`‘’“”]?size["'`‘’“”]?\s+kelimesini)\s+(?:artık\s+|bir\s+daha\s+)?(?:kullanmayacağım|kullanmam|kullanmamaya\s+çalışacağım|demeyeceğim)[^.!?\n]*[.!]?\s*/gi,
      "Anlaştık, bundan sonra sadece samimi 'sen' modundayız! "
    )
    .replace(/(?:sadece|artık)\s+["'`‘’“”]?size["'`‘’“”]?\s+modu(nda|nday[ıi]z|nday[ıi]m|na)/gi, "sadece 'sen' modu$1")
    .replace(/`[^`\n]+`/g, stash)
    .replace(/(?:https?|file):\/\/[^\s)\]]+/gi, stash);

  // Strip canned customer-support boilerplate
  text = text
    .replace(/Ben\s+bir\s+yapay\s+zeka\s+(?:asistanıyım|modeliyim)[^.!?\n]*[.!?]?\s*/gi, "")
    .replace(/(?:Başka\s+bir\s+(?:konuda|şeyde)\s+yardım(?:cı\s+olabileceğim|a\s+ihtiyacınız)[\s\S]{0,60}?[.?!]\s*)/gi, "")
    .replace(/(?:Başka\s+)?(?:Bugün|Şimdi|Hemen)\s+(?:sana|size)\s+nasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(/(?:Başka\s+)?(?:Sana|Size)\s+nasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(/(?:Başka\s+)?\bNasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(
      /(?:Samimiyetle(?:[,:]\s*|\s+)(?:(?:sana|size|bunları|bu\s+bilgileri)\s+){0,3}(?:aktardım|paylaştım|anlattım|ilettim)|(?:Bu|Bunları)\s+bilgileri\s+aktardım)[.!]?\s*/gi,
      ""
    )
    .replace(/\s*(?:Başka\s+(?:bir\s+)?(?:konu|soru|şey)\s+var\s+mı)\??\s*$/gi, "")
    .replace(/^(?:Elbette|Tabii\s+ki|Memnuniyetle)[,!.:\s]+(?:size|sana)\s+/i, "Tabii, ")
    .replace(/^(?:Elbette|Memnuniyetle)[,!.:\s]+/i, "Tabii, ")
    .replace(/^\s*Anladın([,!.\s]+(?:bundan\s+sonra|artık|sadece))/gi, "Anladım$1")
    .replace(/Hangi\s+projeye[^.?\n]*\??\s*Lütfen\s+projenin\s+adını\s+paylaşın[.!]?/gi, "")
    .replace(/Lütfen\s+([^\n.!?]+?)\s+paylaşın[.!]?/gi, "$1 yazabilirsin.");

  const hasAbsenceCue =
    /(?:düne\s+ait|kayıt(?:tan)?|sohbet(?:ten)?)\s*(?:[^.!?\n]{0,40})(?:çıkmadı|yok|bulunamad|emin\s+olamad|göremiyorum|rastlamadım)/i.test(
      text
    );
  if (/\bhatırlıyorum\b/i.test(text) && (opts?.noYesterdayMemory || hasAbsenceCue)) {
    text = text
      .replace(/^[^.!?\n]*\bhatırlıyorum\b[^.!?\n]*[.!?]\s*/gi, "")
      .replace(/^[^.!?\n]*\bhatırlıyorum\b[,;:\s]*(?:ama|fakat|ancak)?\s*/gi, "")
      .trim();
    if (!text || /\bhatırlıyorum\b/i.test(text)) {
      text = "Hafıza çekmecesine baktım ama düne ait bir sohbet kaydı çıkmadı valla! Sıfırdan devam edelim mi?";
    }
  }

  // Systematic 2nd-person plural Turkish verb/pronoun conversion -> warm singular "sen"
  const replacements = [
    [/\bsizlerle\b/gi, (m) => (m[0] === "S" ? "Seninle" : "seninle")],
    [/\bsizinle\b/gi, (m) => (m[0] === "S" ? "Seninle" : "seninle")],
    [/\bsizlere\b/gi, (m) => (m[0] === "S" ? "Sana" : "sana")],
    [/\bsizlerin\b/gi, (m) => (m[0] === "S" ? "Senin" : "senin")],
    [/\bsizden\b/gi, (m) => (m[0] === "S" ? "Senden" : "senden")],
    [/\bsizde\b/gi, (m) => (m[0] === "S" ? "Sende" : "sende")],
    [/\bsizin\b/gi, (m) => (m[0] === "S" ? "Senin" : "senin")],
    [/\bsizce\b/gi, (m) => (m[0] === "S" ? "Sence" : "sence")],
    [/\bsizi\b/gi, (m) => (m[0] === "S" ? "Seni" : "seni")],
    [/\bsiz\b/gi, (m) => (m[0] === "S" ? "Sen" : "sen")],
    [/\bkonuşmanızı\b/gi, (m) => (m[0] === "K" ? "Konuşmanı" : "konuşmanı")],
    [/\bkonuşmanız\b/gi, (m) => (m[0] === "K" ? "Konuşman" : "konuşman")],
    [/\bprojenizi\b/gi, (m) => (m[0] === "P" ? "Projeni" : "projeni")],
    [/\bprojeniz\b/gi, (m) => (m[0] === "P" ? "Projen" : "projen")],
    [/\bihtiyacınız\b/gi, (m) => (m[0] === "İ" ? "İhtiyacın" : "ihtiyacın")],
    [/\bisteğiniz\b/gi, (m) => (m[0] === "İ" ? "İsteğin" : "isteğin")],
    [/\bnasılsınız\b/gi, (m) => (m[0] === "N" ? "Nasılsın" : "nasılsın")],
    [/\bmisiniz\b/gi, (m) => (m[0] === "M" ? "Misin" : "misin")],
    [/\bmısınız\b/gi, (m) => (m[0] === "M" ? "Mısın" : "mısın")],
    [/\bmusunuz\b/gi, (m) => (m[0] === "M" ? "Musun" : "musun")],
    [/\bmüsünüz\b/gi, (m) => (m[0] === "M" ? "Müsün" : "müsün")],
    [/\bisterseniz\b/gi, (m) => (m[0] === "İ" ? "İstersen" : "istersen")],
    [/\bbelirtir\s+misin\b/gi, (m) => (m[0] === "B" ? "Söyler misin" : "söyler misin")],
    [/\bpaylaşın\b/gi, (m) => (m[0] === "P" ? "Paylaş" : "paylaş")],
    [/\bbelirtin\b/gi, (m) => (m[0] === "B" ? "Söyle" : "söyle")],
    [/([a-zçğıöşü]+(?:ebil|abil)ecek)siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:ebil|abil)ir)siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:ecek|icek|ücek))siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:acak|ıcak|ucak))sınız\b/gi, "$1sın"],
    [/([a-zçğıöşü]+[ıiuü]yor)sunuz\b/gi, "$1sun"],
    [/([a-zçğıöşü]+[ıiuü]yor)sanız\b/gi, "$1san"],
    [/\b([aA])lanınız(da|dan|a|ı)?\b/g, "$1lanın$2"],
    [/\b([dD])osyalarınız(da|dan|a|ı)?\b/g, "$1osyaların$2"],
    [/\b([çÇ])alışmalarınız(da|dan|a|ı)?\b/g, "$1alışmaların$2"],
    [/\b([kK])aydınız(da|dan|a|ı|e)?\b/g, "$1aydın$2"],
    [/\b([sS])ohbetiniz(de|den|e|i)?\b/g, "$1ohbetin$2"],
    [/\b([mM])esajınız(da|dan|a|ı)?\b/g, "$1esajın$2"],
    [/\bteyit\s+edebilirim\b/gi, "net görebiliyorum"],
    [/\bbulunmaktaydı\b/gi, "var"],
    [/\bbulunmaktadır\b/gi, "var"],
    [/\bgöstermektedir\b/gi, "gösteriyor"],
    [/\biçermektedir\b/gi, "içeriyor"],
    [/\bsahiptir\b/gi, "sahip"]
  ];
  for (const [rx, rep] of replacements) {
    text = text.replace(rx, rep);
  }

  // Convert standalone Turkish "size" (avoid hyphenated/English "file size", "font-size", etc.)
  text = text.replace(/(^|[\s([{"'“‘—–])(size)(?=[,;:.!?)\]"'”’\s]|$)/gi, (full, pre, word, offset) => {
    const prevSlice = text.slice(Math.max(0, offset - 12), offset).toLowerCase();
    if (/(?:file|font|max|min|page|step|chunk|batch|byte|pixel|screen|buffer)\s*$/i.test(prevSlice) && !strictlyAvoidFormal) {
      return full;
    }
    return pre + (word[0] === "S" ? "Sana" : "sana");
  });

  // Fix awkward pronoun combos and leaked instruction phrases
  text = text
    .replace(
      /^\s*(?:Sen|Sana)\s+(?:şu\s+)?(?:klasör(?:leri|ler)|dosyaları|bilgileri)[^\n:.]{0,60}(?:listele|aktar|özetle|paylaş)[:：]?\s*/i,
      ""
    )
    .replace(/\b[Ss]ana\s+ile\b/g, (m) => (m[0] === "S" ? "Seninle" : "seninle"))
    .replace(/\n*Bu\s+(?:dosyaların\s+isimlerini|bilgileri)[^\n.]*?'sen'\s+diliyle[^\n.]*[.!]?/gi, "");

  // Clean stray multiple spaces, robotic "Sen, " openings, or orphan prefixes after stripping filler
  text = text
    .replace(/^\s*(?:Sen|Siz),\s+/gi, "")
    .replace(/([.!?\n]\s+)(?:Sen|Siz),\s+/gi, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(?:Tabii(?:\s+ki)?|Elbette|Memnuniyetle|Tamam)[,!.:\s]*$/i, "")
    .replace(/^\s*[,;:.!?]+\s*/, "")
    .trim();

  if (text && /^[a-zçğıöşü]/.test(text)) {
    text = text[0].toLocaleUpperCase("tr-TR") + text.slice(1);
  }

  if (!text) {
    if (opts?.hasMedia) {
      return "İstediğin görseli hazırlayıp hemen aşağıya bıraktım, üzerine tıklayıp büyütebilirsin 🎨";
    }
    if (opts?.hasCreatedFiles) {
      return "Dosyalarını oluşturup diske kaydettim! Aşağıdaki butonlardan tarayıcıda önizleyebilir ya da editörde açabilirsin 🚀";
    }
    if (opts?.hasLullaby) {
      return "Mışıl mışıl tatlı rüyalar, ninni müziğini başlattım 🌙";
    }
    text = "Buradayım! Ne kurcalıyoruz, dökül bakalım 😄";
  }

  return text.replace(/__LUX_CODE_SLOT_(\d+)__/g, (_, i) => slots[Number(i)] || "");
}
