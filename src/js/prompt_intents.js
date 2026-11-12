// LUX AI — Kullanıcı metni niyet/intent ayrıştırma
//
// Türkçe komut kalıplarını (klasör oluştur, dosya yaz, sil, taşı/yeniden adlandır,
// uygulama/klasör aç, cevap metninden kod blokları çıkar) saf metin kurallarıyla
// çözer. chat.js'ten ayrıştırıldı; klasik script globalinde tanım kazanır,
// chat.js'ten ÖNCE yüklenir.

function extractCleanMediaQuery(text, mode = "search") {
  let q = String(text || "").trim();
  if (!q) return "modern aesthetic design";

  if (q.includes(" ve ")) {
    const clauses = q.split(/\s+ve\s+/i);
    if (mode === "design") {
      const hit = clauses.find((c) => /(tasarla|çiz|ciz|üret|uret|logo|afiş|poster|ikon|wallpaper|illüstrasyon|kapak)/i.test(c));
      if (hit) q = hit;
    } else {
      const hit = clauses.find((c) => /(bul|getir|göster|ara|fotoğraf|fotograf|araba|marka|resim|resmi)/i.test(c));
      if (hit) q = hit;
    }
  }

  q = q
    .replace(
      /\b(?:bana|dostum|lütfen|lutfen|hadi|şimdi|hemen|internetten|internet'ten|webden|web'den|bul|getir|göster|goster|ara|tasarla|çiz|ciz|üret|uret|oluştur|olustur|hazırla|hazirla|yapar mısın|yap|marka|bir|bi|şu|su|resmini|resmi|resimler|resim|fotoğrafını|fotoğrafı|fotoğraf|fotograf|görselini|görseli|görsel|gorsel|tarzda|tarzında|stilde)\b/gi,
      " "
    )
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return q.length >= 3
    ? q
    : String(text || "")
        .trim()
        .slice(0, 120);
}

function isWipeMemoryPrompt(userText) {
  const lower = String(userText || "")
    .trim()
    .toLowerCase();
  if (!lower || lower.length > 160) return false;
  if (/(?:klasör|klasor|dosya)\s*(?:oluştur|olustur|aç|ac)/i.test(lower)) return false;
  if (
    /(?:dosya|klasör|klasor|masaüstü|masaustu|desktop|\.[a-z0-9]{1,5}\b)/i.test(lower) &&
    !/(?:hafıza|hafiza|geçmiş|gecmis|bellek)/i.test(lower)
  ) {
    return false;
  }
  return /(?:haf[ıi]za(?:n[ıi]|s[ıi]n[ıi]|y[ıi])?|belle[gğ]i(?:n[ıi])?|sohbet\s*ge[çc]mi[şs]i(?:ni)?|(?:tan[ıi]ml[ıi]|eski|t[üu]m)\s*verileri(?:ni)?)\s*(?:s[ıi]f[ıi]rdan\s*)?(?:sil|temizle|s[ıi]f[ıi]rla|yok\s*et)|s[ıi]f[ıi]rdan\s*(?:haf[ıi]za(?:n[ıi]|s[ıi]n[ıi]|y[ıi])?)\s*(?:sil|temizle|s[ıi]f[ıi]rla)/i.test(
    lower
  );
}

function detectRequestedBaseDir(userText) {
  const lower = String(userText || "").toLowerCase();
  if (
    /(?:masaüstü(?:nü|ne|nde|m|me|mde|ndeki|deki)?|masaustu(?:ne|nde|m|me|mde|ndeki)?|desktop(?:['’]?(?:a|e|ta|te|da|de|taki|deki))?)/i.test(
      lower
    )
  ) {
    return "Desktop";
  }
  if (/(?:belgeler(?:ime|imde|e|de|deki|i)?|documents)/i.test(lower)) {
    return "Documents";
  }
  if (/(?:indirilenler(?:e|de|deki|i)?|downloads)/i.test(lower)) {
    return "Downloads";
  }
  if (/(?:resimler(?:e|de|deki|im|ime|imde|i)?|pictures)/i.test(lower)) {
    return "Pictures";
  }
  return "";
}

function stripLeadingLocationAndFillers(text) {
  let out = String(text || "").trim();
  const rx =
    /^(?:(?:lütfen|lutfen|dostum|hemen|şimdi|simdilik|bana|hadi|lütfen\s+bana|bi|bir|yeni|ve|ile|da|de)\s+|(?:masaüstü(?:nü|ne|nde|m|me|mde|ndeki)?|masaustu(?:ne|nde|m|me|mde|ndeki)?|desktop(?:['’]?(?:a|e|ta|te|da|de))?|belgeler(?:ime|imde|e|de)?|documents|indirilenler(?:e|de)?|downloads|resimler(?:e|de|im)?|pictures|çalışma\s*alan[ıi]na)\s+)+/i;
  let prev;
  do {
    prev = out;
    out = out.replace(rx, "").trim();
  } while (out !== prev);
  return out.replace(/^(?:ve|ile|de|da|bir|yeni|diye)\s+/i, "").trim();
}

function sanitizeLocalEntryName(rawName) {
  return String(rawName || "")
    .trim()
    .replace(/^["'`‘’“”]+|["'`‘’“”]+$/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^(?:bir|yeni)\s+/i, "")
    .replace(/\s+(?:olsun|olarak)$/i, "")
    .trim();
}

function extractFolderCreationRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (!/(?:klasör|klasor|dizin)/i.test(lower)) return null;
  if (
    /(?:listele|say|kaç|kac|neler|hangi|sil|kaldır|kaldir|taşı|tasi|adını\s*değiştir|adini\s*degistir|yeniden\s*adlandır|yeniden\s*adlandir)/i.test(
      lower
    )
  ) {
    return null;
  }

  const hasExplicitOpenExisting =
    /(?:klasör(?:ü|ünü|unu|ini)|dizini)\s*(?:aç|ac|göster|goster)(?:\s|$|[.!?])/i.test(lower) &&
    !/(?:oluştur|olustur|yarat|kur|ekle|diye|adlı|adli|adında|adinda|isminde)/i.test(lower);
  if (hasExplicitOpenExisting) return null;

  const hasCreateVerb =
    /(?:oluştur|olustur|yarat|kur|ekle)/i.test(lower) ||
    /(?:diye|adlı|adli|adında|adinda|isminde)\s+(?:bir\s+|yeni\s+)?klasör(?:ü)?\s*(?:aç|ac)/i.test(lower) ||
    /(?:masaüstü(?:ne|me)|masaustu(?:ne|me)|belgelere|indirilenlere|desktop['’]?a|[a-zA-Z]:[\\/]).*\bklasör(?:ü)?\s*aç/i.test(lower);
  if (!hasCreateVerb) return null;

  if (/\bdosya(?:sı|sını|sini|yı|yi)?\b/i.test(lower) && /\.[a-z0-9]{1,8}\b/i.test(lower)) {
    return null;
  }

  const stopwords = new Set([
    "bir",
    "yeni",
    "güzel",
    "guzel",
    "modern",
    "basit",
    "küçük",
    "kucuk",
    "harika",
    "özel",
    "ozel",
    "boş",
    "bos",
    "isimli",
    "adlı",
    "adli",
    "adında",
    "adinda",
    "isminde",
    "diye",
    "klasör",
    "klasor",
    "klasörü",
    "klasoru",
    "dizin",
    "dizini",
    "masaüstü",
    "masaüstüne",
    "masaüstünde",
    "masaustune",
    "masaustunde",
    "desktop",
    "belgelere",
    "indirilenlere",
    "olsun"
  ]);

  const explicitAbs = raw.match(
    /([a-zA-Z]:[\\/][^\n"'*?<>|]{1,120}?)(?=\s+(?:diye|adlı|adli|adında|adinda|isminde|klasör|klasor|oluştur|olustur|kur|yarat|aç|ac)|$)/i
  );
  if (explicitAbs && explicitAbs[1]) {
    const absPath = explicitAbs[1].trim().replace(/[.,!?]+$/, "");
    const folderName = absPath.split(/[\\/]/).filter(Boolean).pop() || absPath;
    return {
      baseDir: "",
      folderName,
      dirPath: absPath,
      displayLocation: absPath
    };
  }

  const baseDir = detectRequestedBaseDir(raw);
  const locationLabel =
    baseDir === "Desktop"
      ? "Masaüstüne"
      : baseDir === "Documents"
        ? "Belgelerim klasörüne"
        : baseDir === "Downloads"
          ? "İndirilenler klasörüne"
          : baseDir === "Pictures"
            ? "Resimlerim klasörüne"
            : "Çalışma alanına";

  let folderName = "";

  const quotedRx =
    /["'`]([^"'`\\/:*?"<>|\n]{1,60})["'`]\s*(?:diye|adlı|adli|isminde|adında|adinda)?\s*(?:bir\s+|yeni\s+)?(?:klasör|klasor|dizin)/i;
  const qm = raw.match(quotedRx);
  if (qm && qm[1]) {
    const candidate = sanitizeLocalEntryName(qm[1]);
    if (candidate && !stopwords.has(candidate.toLowerCase())) {
      folderName = candidate;
    }
  }

  if (!folderName) {
    const namedSuffixRx =
      /([\wçğıöşüÇĞIİÖŞÜ._-]+(?:\s+[\wçğıöşüÇĞIİÖŞÜ._-]+){0,3})\s+(?:diye|adlı|adli|adında|adinda|isminde)\s+(?:bir\s+|yeni\s+)?(?:klasör|klasor|dizin)/i;
    const nm = raw.match(namedSuffixRx);
    if (nm && nm[1]) {
      const stripped = sanitizeLocalEntryName(stripLeadingLocationAndFillers(nm[1]));
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    const beforeFolderRx =
      /([\wçğıöşüÇĞIİÖŞÜ._-]+(?:\s+[\wçğıöşüÇĞIİÖŞÜ._-]+){0,2})\s+(?:klasör(?:ü|ünü|unu|ini|u)?|dizini)\s*(?:oluştur|olustur|yarat|kur|aç|ac)/i;
    const bm = raw.match(beforeFolderRx);
    if (bm && bm[1]) {
      const stripped = sanitizeLocalEntryName(stripLeadingLocationAndFillers(bm[1]));
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    const afterNameRx =
      /(?:klasör(?:ün)?|dizinin)\s*(?:adı|adi|ismi)\s*[:=]?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+(?:\s+[a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+){0,2})["'`]?/i;
    const am = raw.match(afterNameRx);
    if (am && am[1]) {
      const stripped = sanitizeLocalEntryName(am[1]);
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    if (/(?:oluştur|olustur|yarat|kur)/i.test(lower) && (baseDir || /\byeni\s+(?:bir\s+)?klasör\b/i.test(lower))) {
      folderName = "Yeni Klasör";
    } else {
      return null;
    }
  }

  const dirPath = baseDir ? `${baseDir}/${folderName}` : folderName;
  return {
    baseDir,
    folderName,
    dirPath,
    displayLocation: locationLabel
  };
}

function extractFileWriteRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (!/(?:dosya|dosyası|dosyasını|dosyayı|\.txt|\.md|\.json|\.csv|\.py|\.js|\.html|\.css)/i.test(lower)) return null;
  if (
    /(?:sil|kaldır|taşı|tasi|oku|aç|ac\b|listele|adını\s*değiştir|yeniden\s*adlandır)/i.test(lower) &&
    !/(?:oluştur|olustur|yaz|kaydet|ekle|yarat|kur)/i.test(lower)
  ) {
    return null;
  }
  if (!/(?:oluştur|olustur|yaz|kaydet|yarat|kur|ekle)/i.test(lower)) return null;

  const baseDir = detectRequestedBaseDir(raw);
  let fileName = "";
  const extMatch = raw.match(
    /["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+\.(?:txt|md|json|csv|log|py|js|ts|html|css|xml|yaml|yml|ini|bat|ps1|sh))["'`]?/i
  );
  if (extMatch && extMatch[1]) {
    fileName = extMatch[1].replace(/[\\/:*?"<>|]/g, "-");
  } else {
    const quotedFile = raw.match(/["'`]([^"'`\\/:*?"<>|\n]{1,60})["'`]\s*(?:diye|adlı|adında|isminde)?\s*(?:bir\s+)?dosya/i);
    if (quotedFile && quotedFile[1]) {
      fileName = sanitizeLocalEntryName(quotedFile[1]);
    } else {
      const namedFile = raw.match(/([\wçğıöşüÇĞIİÖŞÜ._-]+)\s+(?:diye|adlı|adında|isminde)\s+(?:bir\s+)?dosya/i);
      if (namedFile && namedFile[1]) {
        const cleaned = sanitizeLocalEntryName(stripLeadingLocationAndFillers(namedFile[1]));
        if (cleaned) fileName = cleaned;
      }
    }
    if (fileName && !/\.[a-z0-9]{1,8}$/i.test(fileName)) {
      fileName += ".txt";
    }
  }
  if (!fileName) return null;

  let fileContent = "";
  const contentMatch =
    raw.match(/(?:içeriği|icerigi|içine|icine|metni)\s*[:=]?\s*["'`]([\s\S]+?)["'`](?:\s*(?:olsun|yaz)|$)/i) ||
    raw.match(/(?:yaz|ekle)\s*[:=]\s*["'`]?([^\n"'`]+)["'`]?$/i);
  if (contentMatch && contentMatch[1]) {
    fileContent = contentMatch[1].trim();
  }

  let parentFolder = "";
  const parentMatch = raw.match(
    /(?:masaüstü(?:ne|nde)?|desktop)?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,50})["'`]?\s+klasör(?:üne|ünde|ünün\s*içine)\b/i
  );
  if (parentMatch && parentMatch[1] && !/^(?:masaüstü|masaustu|desktop|belgeler|indirilenler|yeni|bir)$/i.test(parentMatch[1])) {
    parentFolder = sanitizeLocalEntryName(parentMatch[1]);
  }

  const relDir = [baseDir, parentFolder].filter(Boolean).join("/");
  const filePath = relDir ? `${relDir}/${fileName}` : fileName;
  return {
    baseDir: relDir,
    fileName,
    filePath,
    content: fileContent
  };
}

function extractMoveOrRenameRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  const hasRenameVerb =
    /(?:adını\s*değiştir|adini\s*degistir|yeniden\s*adlandır|yeniden\s*adlandir|ismini\s*değiştir|adını\s+[^\n]+\s*yap)/i.test(lower);
  const hasMoveVerb = /(?:taşı|tasi)\b/i.test(lower);
  if (!hasRenameVerb && !hasMoveVerb) return null;

  const baseDir = detectRequestedBaseDir(raw);

  const renameMatch = raw.match(
    /["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör(?:ünün|ünü|u)?|dosya(?:sının|sını|yı)?)\s*(?:adını|adini|ismini|isim)?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:olarak\s*(?:değiştir|yeniden\s*adlandır)|yap|değiştir|degistir)/i
  );
  if (renameMatch && renameMatch[1] && renameMatch[2]) {
    const srcName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(renameMatch[1]));
    const dstName = sanitizeLocalEntryName(renameMatch[2]);
    if (srcName && dstName) {
      const prefix = baseDir ? `${baseDir}/` : "";
      return { sourcePath: `${prefix}${srcName}`, destPath: `${prefix}${dstName}`, isRename: true };
    }
  }

  const moveMatch = raw.match(
    /["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._/\\-]+)["'`]?\s*(?:klasörünü|dosyasını|klasörü|dosyayı)?\s*(masaüstü(?:ne)?|masaustu(?:ne)?|desktop['’]?a|belgelere|documents|indirilenlere|downloads)\s*(?:taşı|tasi)/i
  );
  if (moveMatch && moveMatch[1]) {
    const srcName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(moveMatch[1]));
    const dstBase = detectRequestedBaseDir(moveMatch[2]) || "Desktop";
    const srcBase =
      srcName.includes("/") || srcName.includes("\\") || /^[a-zA-Z]:/.test(srcName) ? "" : baseDir === dstBase ? "" : baseDir || "Desktop";
    const sourcePath = srcBase ? `${srcBase}/${srcName}` : srcName;
    const baseName = srcName.split(/[\\/]/).pop();
    return { sourcePath, destPath: `${dstBase}/${baseName}`, isRename: false };
  }

  return null;
}

function extractDeleteRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (isWipeMemoryPrompt(raw)) return null;
  if (!/(?:\bsil\b|kaldır|kaldir|çöpe\s*at)/i.test(lower)) return null;
  if (!/(?:klasör|klasor|dosya|\.[a-z0-9]{1,8}\b)/i.test(lower)) return null;

  const baseDir = detectRequestedBaseDir(raw);
  const m =
    raw.match(
      /["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör(?:ü|ünü|unu)?|dosya(?:sı|sını|yı)?)\s*(?:sil|kaldır|kaldir|çöpe\s*at)/i
    ) || raw.match(/["'`]([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]\s*(?:sil|kaldır)/i);
  if (m && m[1]) {
    const targetName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(m[1]));
    if (targetName && !/^(?:bir|bu|şu|tüm|hepsi|hafıza|hafızayı|sohbet)$/i.test(targetName)) {
      const targetPath = baseDir ? `${baseDir}/${targetName}` : targetName;
      return { targetPath, targetName };
    }
  }
  return null;
}

function extractAppOrFolderOpenRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (
    !/(?:^|[\s.,!?'"()\-])(?:aç(?:ar\s*mısın|sana|abilir\s*misin|alım)?|başlat|baslat|çalıştır|calistir|göster)(?=$|[\s.,!?'"()\-])/i.test(
      lower
    )
  ) {
    return null;
  }
  // If prompt explicitly intends creating a new folder, don't treat as open_folder
  if (/(?:oluştur|olustur|yarat|kur|ekle)/i.test(lower) || /(?:diye|adlı|adında|isminde)\s+(?:bir\s+)?klasör/i.test(lower)) {
    return null;
  }

  const appRules = [
    [/hesap\s*makin(?:e|a)s?[ıiuü]?n?[ıiuü]?|\bcalc(?:ulator)?\b/i, "hesap makinesi"],
    [/not\s*defter(?:i|ini)?|\bnotepad\b/i, "not defteri"],
    [/görev\s*yöneticisi(?:ni)?|\btask\s*mgr\b|\btaskmgr\b/i, "görev yöneticisi"],
    [/windows\s*ayarlar[ıi]?|ayarlar[ıi]?(?:\s*aç|\s*başlat)/i, "ayarlar"],
    [/dosya\s*(?:gezgini|yöneticisi)(?:ni)?|\bexplorer\b/i, "explorer"],
    [/\bpaint(?:i|'i)?\b|\bmspaint\b/i, "paint"],
    [/\bpowershell(?:i|'i)?\b|\bterminal(?:i|'i)?\b/i, "powershell"],
    [/\bcmd(?:yi|'yi)?\b|komut\s*istemi(?:ni)?/i, "cmd"],
    [/google\s*chrome|\bchrome(?:u|'u)?\b/i, "chrome"],
    [/microsoft\s*edge|\bedge(?:'yi|yi)?\b|tarayıcı(?:yı|yi)?/i, "edge"],
    [/\bvs\s*code\b|\bvscode\b/i, "vscode"]
  ];
  for (const [rx, canonical] of appRules) {
    if (rx.test(lower)) {
      return { mode: "open_app", target: canonical };
    }
  }

  // Named folder on Desktop/Documents/Downloads/Pictures: "masaüstündeki BB klasörünü aç"
  const folderOpen = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*klasör(?:ü|ünü|unu|ini)?\s*(?:aç|ac|göster)/i);
  if (folderOpen && folderOpen[1]) {
    const cleanName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(folderOpen[1]));
    const baseDir = detectRequestedBaseDir(raw);
    if (cleanName && !/^(?:bir|yeni)$/i.test(cleanName)) {
      return { mode: "open_folder", target: baseDir ? `${baseDir}/${cleanName}` : cleanName };
    }
  }

  // Direct known folder open: "masaüstünü aç", "belgeleri aç", "indirilenleri aç"
  if (/masaüstü(?:nü|ne|mü)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Desktop" };
  if (/belgeler(?:im)?(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Documents" };
  if (/indirilenler(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Downloads" };
  if (/resimler(?:im)?(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Pictures" };

  return null;
}

function extractExplicitDesktopFolderName(userText) {
  const raw = String(userText || "");
  const stopwords = new Set([
    "bir",
    "yeni",
    "güzel",
    "guzel",
    "modern",
    "basit",
    "küçük",
    "kucuk",
    "harika",
    "özel",
    "ozel",
    "web",
    "site",
    "sitesi",
    "proje",
    "projesi",
    "içine",
    "icine",
    "diye",
    "klasör",
    "klasoru",
    "klasörü"
  ]);

  const patterns = [
    /(?:masaüstü(?:nde|ne)?|masaustu(?:nde|ne)?|desktop['’]?(?:ta|da|te|de)?)\s+["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör|adlı|isminde|adında|diye)/i,
    /klasör(?:ü|ün|ünde|üne)?\s*(?:adı|ismi)?\s*[:=]?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?/i,
    /["'`]([a-zA-Z0-9_-]{1,50})["'`]\s*(?:klasör|projesi|dizini)/i
  ];
  for (const rx of patterns) {
    const m = raw.match(rx);
    if (m && m[1] && !stopwords.has(m[1].toLowerCase())) {
      return m[1].replace(/[\\/:*?"<>|]/g, "-");
    }
  }

  // Fallback topic slug from prompt words
  const topicWords = raw
    .toLowerCase()
    .replace(
      /masaüstü(?:nde|ne)?|masaustu(?:nde|ne)?|desktop|klasör(?:ü|ünü|ünde)?|oluşturup|oluştur|olustur|kur|yap|tasarla|içine|icine|modern|bir|ve|index\.html|style\.css|web|sitesi|tasarımı|sayfası/gi,
      " "
    )
    .replace(/[^a-z0-9çğıöşü\s-]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 3)
    .join("-")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");

  return topicWords ? `lux-${topicWords}-web` : "lux-web-projesi";
}

function buildStarterWebFiles(userText, folderName) {
  const topic =
    String(userText || "")
      .replace(/masaüstü(?:nde|ne)?|desktop|klasör(?:ü|ünü|ünde)?|oluşturup|oluştur|içine|kur|yap|tasarla/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || folderName;
  const titleText = escapeHtml(topic.slice(0, 64));

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleText} · Lux AI Studio</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">⚡ Lux Studio</div>
    <nav>
      <a href="#ozellikler">Özellikler</a>
      <a href="#galeri">Deneyim</a>
      <a href="#iletisim" class="cta-sm">Bize Ulaş</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <span class="badge">✨ Özel Tasarım</span>
      <h1>${titleText}</h1>
      <p>Lux gücündeki Lux AI tarafından sıfırdan tasarlanan modern, hızlı ve duyarlı web deneyimi.</p>
      <div class="actions">
        <a href="#ozellikler" class="btn-primary">Keşfetmeye Başla</a>
        <button id="theme-pulse-btn" class="btn-ghost" type="button">Atmosferi Değiştir</button>
      </div>
    </section>

    <section id="ozellikler" class="grid">
      <article class="card">
        <h3>Modern Arayüz</h3>
        <p>Cam efektli kartlar, akıcı geçişler ve göz yormayan koyu/sıcak renk dengesi.</p>
      </article>
      <article class="card">
        <h3>Duyarlı Tasarım</h3>
        <p>Masaüstü, tablet ve mobil ekranlara otomatik uyum sağlayan grid mimarisi.</p>
      </article>
      <article class="card">
        <h3>Anında Hazır</h3>
        <p>Temiz HTML5 ve CSS3 katmanı sayesinde hiçbir ek kurulum gerektirmeden çalışır.</p>
      </article>
    </section>

    <section id="galeri" class="showcase">
      <div class="showcase-box">
        <h2>Öne Çıkan Detaylar</h2>
        <p id="status-banner">Sayfa aktif — butonlara tıklayarak canlı etkileşimi test edebilirsin.</p>
      </div>
    </section>
  </main>

  <footer id="iletisim">
    <small>${escapeHtml(folderName)} · Lux AI ile oluşturuldu</small>
  </footer>

  <script>
    const btn = document.getElementById("theme-pulse-btn");
    const banner = document.getElementById("status-banner");
    let alt = false;
    btn?.addEventListener("click", () => {
      alt = !alt;
      document.body.classList.toggle("alt-accent", alt);
      if (banner) {
        banner.textContent = alt
          ? "Altın kehribar atmosfer modu etkinleştirildi!"
          : "Safir gece atmosfer moduna dönüldü.";
      }
    });
  </script>
</body>
</html>
`;

  const css = `:root {
  --bg: #0b0d14;
  --surface: #141824;
  --text: #f3f5f9;
  --muted: #98a2b8;
  --accent: #60a5fa;
  --accent-2: #a78bfa;
}
body.alt-accent {
  --accent: #f59e0b;
  --accent-2: #fb7185;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 40%), var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
.topbar {
  max-width: 1120px;
  margin: 0 auto;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand { font-weight: 700; font-size: 1.1rem; letter-spacing: 0.02em; }
nav { display: flex; gap: 20px; align-items: center; }
nav a { color: var(--muted); text-decoration: none; font-size: 0.92rem; transition: color .2s; }
nav a:hover { color: var(--text); }
.cta-sm {
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: var(--text);
}
main { max-width: 1120px; margin: 0 auto; padding: 48px 24px; }
.hero { max-width: 720px; padding: 36px 0 56px; }
.badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.35);
  color: var(--accent);
  font-size: 0.82rem;
  margin-bottom: 18px;
}
.hero h1 {
  font-size: clamp(2.1rem, 4.5vw, 3.4rem);
  line-height: 1.15;
  margin-bottom: 16px;
  background: linear-gradient(120deg, #fff, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  color: transparent;
}
.hero p { color: var(--muted); font-size: 1.05rem; margin-bottom: 28px; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
.btn-primary, .btn-ghost {
  padding: 12px 22px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  text-decoration: none;
  border: none;
  transition: transform .15s, opacity .2s;
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #090b10;
}
.btn-ghost {
  background: rgba(255,255,255,0.06);
  color: var(--text);
  border: 1px solid rgba(255,255,255,0.14);
}
.btn-primary:hover, .btn-ghost:hover { transform: translateY(-2px); }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
  margin-bottom: 42px;
}
.card, .showcase-box {
  background: rgba(20, 24, 36, 0.85);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  padding: 24px;
}
.card h3 { margin-bottom: 8px; font-size: 1.08rem; color: var(--text); }
.card p, .showcase-box p { color: var(--muted); font-size: 0.94rem; }
footer {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  color: var(--muted);
  border-top: 1px solid rgba(255,255,255,0.07);
}
`;

  return { html, css };
}

function extractCodeBlocksFromReply(replyText) {
  const blocks = { html: "", css: "", js: "" };
  const rx = /```(html|css|javascript|js)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = rx.exec(String(replyText || ""))) !== null) {
    const lang = (m[1] || "").toLowerCase();
    const code = (m[2] || "").trim();
    if (!code || code.length < 25) continue;
    if (lang === "html" || (!lang && /<!doctype|<html|<body/i.test(code))) {
      if (code.length > blocks.html.length) blocks.html = code;
    } else if (lang === "css") {
      if (code.length > blocks.css.length) blocks.css = code;
    } else if (lang === "js" || lang === "javascript") {
      if (code.length > blocks.js.length) blocks.js = code;
    }
  }
  return blocks;
}

function sanitizePostToolMediaReply(rawReply, assistantMsg) {
  let out = String(rawReply || "").trim();
  const mediaList = Array.isArray(assistantMsg?.media) ? assistantMsg.media : [];
  const allowedUrls = new Set(mediaList.map((m) => String(m.fileUrl || m.url || "").trim()).filter(Boolean));

  // If media gallery is attached, strip broken/hallucinated external placeholder markdown images
  if (mediaList.length > 0) {
    out = out.replace(/!\[[^\]]*\]\(([^)]+)\)/gi, (full, url) => {
      const cleanUrl = String(url || "")
        .trim()
        .replace(/^<|>$/g, "");
      if (allowedUrls.has(cleanUrl)) return ""; // Rendered cleanly in lux-media-chips already
      if (/^file:\/\/\//i.test(cleanUrl)) return full;
      return "";
    });
  }

  // Strip leftover robotic disclaimers if tools actually ran and succeeded
  const hasSuccessfulTool = Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.some((s) => s.status === "done");
  if (hasSuccessfulTool) {
    out = out
      .replace(
        /(?:Üzgünüm|Maalesef)[^.!?\n]*(?:internet\s*bağlantım\s*yok|erişimim\s*yok|kaynağa\s*erişimim\s*yok|yapamam|edemem)[^.!?\n]*[.!?]?\s*/gi,
        ""
      )
      .replace(/İnternet\s+üzerinden\s+(?:yerel|uluslararası)[^.!?\n]*özel\s+bir\s+servis[^.!?\n]*[.!?]?\s*/gi, "")
      .trim();
  }

  return out;
}

function parseLuxVoiceStopCommand(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^[.,!?;:"'‘’“”\-–—\s]+/, "")
    .replace(/[.,!?;:"'‘’“”\-–—\s]+$/, "")
    .trim();
  if (!cleaned) return null;
  const lower = cleaned.toLocaleLowerCase("tr-TR");

  const exactStops = new Set([
    "dur",
    "durdur",
    "dur artık",
    "lütfen dur",
    "lutfen dur",
    "tamam dur",
    "hadi dur",
    "yeter dur",
    "sus",
    "sus artık",
    "kes",
    "kes şunu",
    "kes sesini",
    "yeter",
    "yeter artık",
    "iptal",
    "iptal et",
    "bekle",
    "stop",
    "cancel",
    "dur lütfen",
    "durdur şunu",
    "dur bi",
    "bi dur",
    "bir dur"
  ]);
  if (exactStops.has(lower)) {
    return { type: "stop", keyword: lower, remainder: "" };
  }

  const prefixMatch = cleaned.match(
    /^(dur(?:dur)?|sus|kes|iptal(?:\s+et)?|bekle|stop|cancel)(?:\s*(?:art[ıi]k|l[üu]tfen|lutfen|hadi|tamam|[şs]imdi|simdilik|ve|bi|bir))?\s*[,;:.!?-]*\s+(.+)$/i
  );
  if (prefixMatch && prefixMatch[2]) {
    const kw = prefixMatch[1].toLocaleLowerCase("tr-TR");
    const rem = prefixMatch[2].replace(/^[,;:.!?\-\s]+/, "").trim();
    const remLow = rem.toLocaleLowerCase("tr-TR");
    if (exactStops.has(remLow) || /^(?:ya|yahu|bir\s*saniye|bi\s*dakika|bir\s*dakika|lütfen|lutfen|artık|tamam)$/i.test(remLow)) {
      return { type: "stop", keyword: kw, remainder: "" };
    }
    if (rem.length >= 2) {
      return { type: "stop_and_continue", keyword: kw, remainder: rem };
    }
  }
  return null;
}
window.parseLuxVoiceStopCommand = parseLuxVoiceStopCommand;
