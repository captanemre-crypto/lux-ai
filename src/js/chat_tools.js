// LUX AI — Ajan araç yürütme katmanı
//
// chat.js'ten ayrıldı: executeAgentTool + toplu araç çağrıları + model
// bağlamı önhazırlıkları (workspace envanteri, prompt-mention çözümleme,
// eksik-eylem kurtarma). window.* globalleri üzerinden çalışır.

async function executeAgentTool(name, rawArgs, turnContext = null) {
  if (turnContext?.__aborted || (turnContext?.__turnId && turnContext.__turnId !== window.__luxActiveTurnId)) {
    return { status: "error", summary: "İptal edildi", detail: "İşlem durduruldu.", resultText: "İPTAL: İşlem durduruldu." };
  }

  let args = rawArgs || {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch (_) {
      args = {};
    }
  }

  const normalizeToolPath = (p) =>
    String(p || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^@(file|folder|dir|path):/i, "")
      .trim();

  const userPrompt = String(turnContext?.userPrompt || "").toLowerCase();
  const userExplicitlyAskedYouTube = /\b(youtube|youtu\.be|şarkı|sarki|müzik|muzik|video|klip|fragman|izle|dinle)\b/i.test(userPrompt);
  const userExplicitlyAskedWebOpen =
    /(?:site|sitesi|sitesini|link|url|web\s*sayfa|web\s*site|tarayıcı|tarayici|chrome|edge|internet(?:te|ten)?\s*aç|browser|youtube|\.com|\.org|\.net|https?:\/\/)/i.test(
      userPrompt
    );

  const perms = window.appStore?.getPermissions?.() || {};
  const toolName = (name || "").trim();
  if (turnContext) {
    if (!Array.isArray(turnContext.executedTools)) turnContext.executedTools = [];
    turnContext.executedTools.push(toolName);
  }

  const approvalDenial = await requestToolExecutionDecision(toolName, args);
  if (approvalDenial) return approvalDenial;

  if (toolName === "web_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return {
        status: "error",
        summary: "(sorgu eksik)",
        detail: "query gerekli.",
        resultText: "HATA: web_search için query parametresi boş."
      };
    }
    if (perms.web_search === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: query,
        detail: "İzin reddedildi: İnternet arama izni (web_search / network_internet) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: İnternet arama izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.webSearch?.(query, { limit: args.limit || 6 });
    if (res?.success) {
      const blocks = [];
      if (res.weather) {
        const w = res.weather;
        blocks.push(
          `[CANLI HAVA DURUMU — Open-Meteo]\n` +
            `Konum: ${w.city}\n` +
            `Sıcaklık: ${w.temperature}°C (Hissedilen: ${w.apparentTemperature}°C) | Durum: ${w.condition}\n` +
            `Nem: %${w.humidity} | Rüzgar: ${w.windSpeed} km/sa | Gözlem Saati: ${w.observedAt}\n` +
            (Array.isArray(w.forecast) && w.forecast.length > 0
              ? `3 Günlük Tahmin:\n${w.forecast.map((f) => `- ${f}`).join("\n")}\n`
              : "") +
            `Kaynak: ${w.sourceUrl}`
        );
      }
      if (Array.isArray(res.results) && res.results.length > 0) {
        blocks.push(
          `[WEB ARAMA SONUÇLARI]\n` +
            res.results
              .map((r, i) => `${i + 1}. ${r.title} [${r.source}]\n   URL: ${r.url}${r.snippet ? `\n   Özet: ${r.snippet}` : ""}`)
              .join("\n")
        );
      }
      const txt = blocks.join("\n\n") || "Arama sonucu bulunamadı.";
      const sum = res.weather
        ? `${res.weather.city}: ${res.weather.temperature}°C, ${res.weather.condition}`
        : `"${query}" (${res.results?.length || 0} sonuç)`;
      return { status: "done", summary: sum, detail: txt, resultText: txt, data: res };
    }
    const errMsg = res?.error || "Web araması sonuç döndürmedi.";
    return { status: "error", summary: query, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "fetch_url") {
    const url = String(args.url || "").trim();
    if (!url) {
      return { status: "error", summary: "(URL eksik)", detail: "url parametresi gerekli.", resultText: "HATA: url boş." };
    }
    if (perms.web_search === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: url,
        detail: "İnternet erişim izni kapatılmış.",
        resultText: "HATA: web_search/network_internet izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.fetchUrl?.(url);
    if (res?.success) {
      const clipped = String(res.text || "").slice(0, 7500);
      const resultText = `Başlık: ${res.title}\nURL: ${res.url}\n\nİçerik:\n${clipped}`;
      return { status: "done", summary: res.title || url, detail: resultText.slice(0, 1500), resultText };
    }
    return {
      status: "error",
      summary: url,
      detail: res?.error || "Sayfa okunamadı",
      resultText: `HATA: ${res?.error || "Sayfa okunamadı."}`
    };
  }

  if (toolName === "image_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return { status: "error", summary: "(sorgu eksik)", detail: "query gerekli.", resultText: "HATA: Görsel arama sorgusu boş." };
    }
    if (perms.image_generation === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: query,
        detail: "Görsel veya internet erişim izni kapalı.",
        resultText: "HATA: image_generation/network_internet izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.imageSearch?.(query, {
      count: args.count || 2,
      saveDir: normalizeToolPath(args.saveDir || "")
    });
    if (res?.success && Array.isArray(res.images) && res.images.length > 0) {
      res.images.forEach((img) => {
        addMediaToTurnContext(turnContext, {
          type: "image",
          title: img.title || query,
          localPath: img.localPath,
          fileUrl: img.fileUrl,
          format: img.format,
          engine: "Web Görsel Arama"
        });
      });
      const listTxt = res.images
        .map((im, i) => `${i + 1}. ${im.title || query}\n   Yerel Dosya: ${im.localPath}\n   URL: ${im.fileUrl}`)
        .join("\n");
      return {
        status: "done",
        summary: `"${query}" (${res.images.length} görsel indirildi)`,
        detail: listTxt,
        resultText: `BAŞARILI: ${res.images.length} doğrulanmış görsel yerel diske indirildi ve sohbet galerisine otomatik eklendi:\n${listTxt}\nNot: Yanıtta görseli kullanıcıya sun; sahte harici URL uydurma.`,
        data: res
      };
    }
    return {
      status: "error",
      summary: query,
      detail: res?.error || "Görsel bulunamadı",
      resultText: `HATA: ${res?.error || "Doğrulanmış görsel bulunamadı."}`
    };
  }

  if (toolName === "image_generate") {
    const prompt = String(args.prompt || args.description || args.title || "").trim();
    if (!prompt) {
      return { status: "error", summary: "(tarif eksik)", detail: "prompt gerekli.", resultText: "HATA: Görsel tasarımı için prompt boş." };
    }
    if (perms.image_generation === false) {
      return {
        status: "denied",
        summary: prompt,
        detail: "Görsel üretme izni (image_generation) kapatılmış.",
        resultText: "HATA: image_generation izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.imageGenerate?.({
      prompt,
      title: args.title || prompt,
      style: args.style || "",
      width: args.width || 1024,
      height: args.height || 768,
      outputPath: normalizeToolPath(args.outputPath || ""),
      htmlOrSvg: args.htmlOrSvg || ""
    });
    if (res?.success && res.fileUrl) {
      addMediaToTurnContext(turnContext, {
        type: "image",
        title: args.title || prompt,
        localPath: res.localPath,
        fileUrl: res.fileUrl,
        format: res.format || "png",
        engine: res.engine || "lux-ai-studio"
      });
      if (args.outputPath && res.localPath) {
        addCreatedFileToTurnContext(turnContext, res.localPath);
      }
      return {
        status: "done",
        summary: `${args.title || prompt.slice(0, 40)} (${res.engine})`,
        detail: `Kaydedildi: ${res.localPath} (${Math.round((res.sizeBytes || 0) / 1024)} KB)`,
        resultText: `BAŞARILI: Görsel tasarlandı ve kaydedildi (${res.engine}).\nYerel Dosya: ${res.localPath}\nURL: ${res.fileUrl}\nNot: Görsel sohbet galerisine otomatik eklendi; metinde sahte URL uydurma.`,
        data: res
      };
    }
    return {
      status: "error",
      summary: prompt.slice(0, 40),
      detail: res?.error || "Tasarım oluşturulamadı",
      resultText: `HATA: ${res?.error || "Görsel oluşturulamadı."}`
    };
  }

  if (toolName === "list_projects") {
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: "projeler",
        detail: "Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.listDesktopProjects?.(window.appStore?.state?.application?.workspaceDir);
    if (res?.success && Array.isArray(res.projects)) {
      window.luxDesktopProjectsCache = res.projects;
      const lines = [`Aktif Çalışma Klasörü: ${res.workspaceDir}`, `Masaüstü: ${res.desktopPath} (${res.projects.length} proje/klasör):`];
      for (const p of res.projects) {
        const tag = p.isActiveWorkspace ? "[AKTİF]" : `[${p.source}]`;
        const sample = (p.sampleFiles || []).slice(0, 4).join(", ");
        lines.push(`- ${p.name} ${tag}: ${p.topLevelFileCount} dosya, ${p.topLevelDirCount} klasör${sample ? ` (${sample})` : ""}`);
      }
      const txt = lines.join("\n");
      return { status: "done", summary: `${res.projects.length} proje klasörü bulundu`, detail: txt, resultText: txt, data: res };
    }
    return {
      status: "error",
      summary: "projeler",
      detail: res?.error || "Projeler listelenemedi",
      resultText: `HATA: ${res?.error || "Projeler listelenemedi."}`
    };
  }

  if (toolName === "list_files") {
    const dirArg = normalizeToolPath(args.dirPath || args.path || "");
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: dirArg || ".",
        detail: "İzin reddedildi: Dosya okuma izni (file_read) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için dosyalar listelenemedi."
      };
    }
    const resolved = resolveProjectOrWorkspaceDir(dirArg);
    let res = await window.luxAPI?.fs?.listFiles?.(resolved.target);
    let finalLabel = resolved.label;
    if (!Array.isArray(res) && resolved.target) {
      const rootTarget = (window.appStore?.state?.application?.workspaceDir || "").trim() || undefined;
      const rootRes = await window.luxAPI?.fs?.listFiles?.(rootTarget);
      if (Array.isArray(rootRes)) {
        res = rootRes;
        finalLabel = `Çalışma Alanı Kök Dizini ('${dirArg}' yerine kök tarandı)`;
      }
    }
    if (Array.isArray(res)) {
      const inv = formatWorkspaceInventory(res, finalLabel);
      return {
        status: "done",
        summary: inv.shortSummary,
        detail: inv.text,
        resultText: inv.text
      };
    }
    const errMsg = res?.error || "Dizin listelenemedi.";
    return { status: "error", summary: dirArg || ".", detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "read_file") {
    const filePath = normalizeToolPath(args.filePath || args.path || "");
    if (!filePath) {
      return { status: "error", summary: "(yol eksik)", detail: "filePath gerekli.", resultText: "HATA: filePath parametresi boş." };
    }
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: filePath,
        detail: "İzin reddedildi: Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için dosya okunamadı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      return {
        status: "denied",
        summary: filePath,
        detail: "Güvenlik koruması (env_secrets_protection) nedeniyle .env / anahtar dosyalarına erişim engellendi.",
        resultText: "HATA: env_secrets_protection nedeniyle hassas dosyaya erişim reddedildi."
      };
    }
    const res = await window.luxAPI?.fs?.readFile?.(filePath);
    if (res?.success) {
      const content = res.content || "";
      const clipped = content.length > 8000 ? content.slice(0, 8000) + "\n... [içerik kırpıldı]" : content;
      return {
        status: "done",
        summary: `${res.path || filePath} (${content.length} karakter)`,
        detail: clipped.slice(0, 1200) + (clipped.length > 1200 ? "\n..." : ""),
        resultText: clipped
      };
    }
    const errMsg = res?.error || "Dosya okunamadı.";
    return { status: "error", summary: filePath, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "search_files") {
    const query = args.query || "";
    const dirArg = normalizeToolPath(args.dirPath || "");
    if (!query) {
      return {
        status: "error",
        summary: "(sorgu eksik)",
        detail: "query parametresi gerekli.",
        resultText: "HATA: query parametresi boş."
      };
    }
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: query,
        detail: "İzin reddedildi: Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için arama yapılamadı."
      };
    }
    const res = await window.luxAPI?.fs?.search?.(query, dirArg || undefined);
    if (res?.success) {
      const matches = res.matches || [];
      const text =
        matches.length > 0
          ? matches.map((m) => `${m.relPath || m.filePath || m.file || "?"}:${m.line}: ${m.text}`).join("\n")
          : "Eşleşme bulunamadı.";
      return {
        status: "done",
        summary: `"${query}" (${matches.length} eşleşme)`,
        detail: text,
        resultText: text
      };
    }
    const errMsg = res?.error || "Arama başarısız.";
    return { status: "error", summary: query, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "write_file") {
    const filePath = normalizeToolPath(args.filePath || args.path || "");
    const content = typeof args.content === "string" ? args.content : "";
    if (!filePath) {
      return { status: "error", summary: "(yol eksik)", detail: "filePath gerekli.", resultText: "HATA: filePath parametresi boş." };
    }
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: filePath,
        detail: "İzin reddedildi: Dosya yazma izni (file_write) kapatılmış.",
        resultText: "HATA: file_write izni kapalı olduğu için dosyaya yazılamadı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      return {
        status: "denied",
        summary: filePath,
        detail: "Güvenlik koruması (env_secrets_protection) nedeniyle hassas dosyaya yazılamaz.",
        resultText: "HATA: env_secrets_protection nedeniyle hassas dosyaya yazma reddedildi."
      };
    }
    const res = await window.luxAPI?.fs?.writeFile?.(filePath, content);
    if (res?.success) {
      window.playLuxSound?.("codeActionApplied");
      window.invalidateWorkspaceFilesCache?.();
      window.refreshDiffViews?.();
      addCreatedFileToTurnContext(turnContext, res.path || filePath);
      if (typeof window.activeEditorPath === "function" && res.path && window.activeEditorPath().toLowerCase() === res.path.toLowerCase()) {
        window.loadEditorFile?.(res.path);
      }
      return {
        status: "done",
        summary: `${res.path || filePath} (${content.length} karakter yazıldı)`,
        detail: `Başarıyla kaydedildi: ${res.path || filePath}`,
        resultText: `BAŞARILI: ${res.path || filePath} kaydedildi (${content.length} karakter).`
      };
    }
    const errMsg = res?.error || "Dosya yazılamadı.";
    return { status: "error", summary: filePath, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "mkdir") {
    const dirPath = normalizeToolPath(args.dirPath || args.path || "");
    if (!dirPath) return { status: "error", summary: "(yol eksik)", detail: "dirPath gerekli.", resultText: "HATA: dirPath boş." };
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: dirPath,
        detail: "Dosya yazma izni (file_write) kapalı.",
        resultText: "HATA: file_write izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.mkdir?.(dirPath);
    if (res?.success) {
      refreshDesktopProjectsCache(true);
      return {
        status: "done",
        summary: `Klasör oluşturuldu: ${res.path}`,
        detail: res.path,
        resultText: `BAŞARILI: Klasör hazır: ${res.path}`
      };
    }
    return {
      status: "error",
      summary: dirPath,
      detail: res?.error || "Klasör oluşturulamadı",
      resultText: `HATA: ${res?.error || "Klasör oluşturulamadı."}`
    };
  }

  if (toolName === "move_path") {
    const srcPath = normalizeToolPath(args.srcPath || args.from || "");
    const destPath = normalizeToolPath(args.destPath || args.to || "");
    if (!srcPath || !destPath)
      return { status: "error", summary: "(yol eksik)", detail: "srcPath ve destPath gerekli.", resultText: "HATA: Yol eksik." };
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: srcPath,
        detail: "Dosya yazma izni (file_write) kapalı.",
        resultText: "HATA: file_write izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.movePath?.(srcPath, destPath);
    if (res?.success) {
      return {
        status: "done",
        summary: `${res.from} -> ${res.to}`,
        detail: "Taşıma tamamlandı",
        resultText: `BAŞARILI: ${res.from} -> ${res.to}`
      };
    }
    return { status: "error", summary: srcPath, detail: res?.error || "Taşınamadı", resultText: `HATA: ${res?.error || "Taşınamadı."}` };
  }

  if (toolName === "delete_path") {
    const targetPath = normalizeToolPath(args.targetPath || args.path || "");
    if (!targetPath) return { status: "error", summary: "(yol eksik)", detail: "targetPath gerekli.", resultText: "HATA: targetPath boş." };
    if (perms.file_delete === false) {
      return {
        status: "denied",
        summary: targetPath,
        detail: "Dosya silme izni (file_delete) kapalı.",
        resultText: "HATA: file_delete izni kapalı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(targetPath)) {
      return {
        status: "denied",
        summary: targetPath,
        detail: "Hassas dosya koruması aktif.",
        resultText: "HATA: Hassas dosya silinemedi."
      };
    }
    const res = await window.luxAPI?.fs?.deletePath?.(targetPath);
    if (res?.success) {
      window.invalidateWorkspaceFilesCache?.();
      return { status: "done", summary: `Silindi: ${res.path}`, detail: res.path, resultText: `BAŞARILI: Silindi -> ${res.path}` };
    }
    return { status: "error", summary: targetPath, detail: res?.error || "Silinemedi", resultText: `HATA: ${res?.error || "Silinemedi."}` };
  }

  if (toolName === "run_command") {
    const command = args.command || args.cmd || "";
    const cwdArg = normalizeToolPath(args.cwd || "");
    if (!command) {
      return {
        status: "error",
        summary: "(komut eksik)",
        detail: "command parametresi gerekli.",
        resultText: "HATA: command parametresi boş."
      };
    }
    if (userPrompt && /(?:youtube\.com|youtu\.be)/i.test(command) && !userExplicitlyAskedYouTube) {
      return {
        status: "denied",
        summary: command,
        detail: "Kullanıcı YouTube açılmasını istemediği için komut engellendi.",
        resultText: "HATA: Kullanıcı YouTube açılmasını istemedi."
      };
    }
    if (perms.terminal_execute === false) {
      return {
        status: "denied",
        summary: command,
        detail: "İzin reddedildi: Terminal çalıştırma izni (terminal_execute) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: terminal_execute izni kapalı olduğu için komut çalıştırılamadı."
      };
    }
    const res = await window.luxAPI?.terminal?.execute?.(command, cwdArg || undefined);
    const output = (res?.output || res?.error || "Tamamlandı.").slice(0, 6000);
    window.luxLastTerminalOutput = `PS > ${command}\n${output}`;
    return {
      status: res?.code && res.code !== 0 ? "error" : "done",
      summary: command,
      detail: output,
      resultText: output
    };
  }

  if (toolName === "capture_screen") {
    if (perms.pc_control === false) {
      return {
        status: "denied",
        summary: "ekran görüntüsü",
        detail: "Bilgisayar kontrol izni (pc_control) kapalı.",
        resultText: "HATA: pc_control izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.captureScreen?.({ outputPath: normalizeToolPath(args.outputPath || "") });
    if (res?.success && res.fileUrl) {
      addMediaToTurnContext(turnContext, {
        type: "image",
        title: "Masaüstü Ekran Görüntüsü",
        localPath: res.localPath,
        fileUrl: res.fileUrl,
        format: "png",
        engine: res.engine || "screen-capture"
      });
      return {
        status: "done",
        summary: `Ekran görüntüsü alındı (${Math.round((res.sizeBytes || 0) / 1024)} KB)`,
        detail: `Kaydedildi: ${res.localPath}`,
        resultText: `BAŞARILI: Ekran görüntüsü alındı ve sohbette görüntülendi.\nDosya: ${res.localPath}\nURL: ${res.fileUrl}`
      };
    }
    return {
      status: "error",
      summary: "ekran",
      detail: res?.error || "Alınamadı",
      resultText: `HATA: ${res?.error || "Ekran görüntüsü alınamadı."}`
    };
  }

  if (toolName === "pc_control") {
    const action = String(args.action || "")
      .trim()
      .toLowerCase();
    if (!action)
      return {
        status: "error",
        summary: "(eylem eksik)",
        detail: "action gerekli.",
        resultText: "HATA: pc_control action parametresi boş."
      };
    const isBrowserAction = action === "open_url" || action === "open_website";
    if (isBrowserAction && perms.pc_control === false && perms.browser_automation === false) {
      return {
        status: "denied",
        summary: action,
        detail: "Tarayıcı ve bilgisayar kontrol izinleri kapalı.",
        resultText: "HATA: Tarayıcı kontrol izni kapalı."
      };
    }
    if (!isBrowserAction && perms.pc_control === false) {
      return {
        status: "denied",
        summary: action,
        detail: "Bilgisayar kontrol izni (pc_control) kapatılmış.",
        resultText: "HATA: pc_control izni kapalı."
      };
    }
    const rawTarget = String(args.target || args.value || "").trim();
    if (isBrowserAction && userPrompt) {
      if (/(?:youtube\.com|youtu\.be)/i.test(rawTarget) && !userExplicitlyAskedYouTube) {
        return {
          status: "denied",
          summary: rawTarget,
          detail: "Kullanıcı YouTube açılmasını istemediği için engellendi.",
          resultText: "HATA: Kullanıcı YouTube açılmasını istemedi; istenen yerel dosya veya klasör aracını kullan."
        };
      }
      const looksExternalHttp =
        /^https?:\/\//i.test(rawTarget) ||
        (rawTarget.includes(".") &&
          !/\.(?:html?|txt|md|json|js|py|css)$/i.test(rawTarget) &&
          !/^[a-zA-Z]:[\\/]|^desktop|^masaüstü|^masaustu/i.test(rawTarget));
      if (looksExternalHttp && !userExplicitlyAskedWebOpen) {
        return {
          status: "denied",
          summary: rawTarget,
          detail: "Kullanıcı web sitesi açılmasını istemediği için engellendi.",
          resultText: "HATA: Kullanıcı tarayıcıda web sitesi açılmasını istemedi."
        };
      }
    }
    const res = await window.luxAPI?.agent?.pcControl?.({
      action,
      target: args.target || "",
      value: args.value || "",
      x: args.x,
      y: args.y,
      steps: args.steps,
      blockYouTube: userPrompt ? !userExplicitlyAskedYouTube : false
    });
    if (res?.success) {
      const out = res.output || `${action} tamamlandı.`;
      return { status: "done", summary: `${action}: ${args.target || out.slice(0, 40)}`, detail: out, resultText: `BAŞARILI: ${out}` };
    }
    return {
      status: "error",
      summary: action,
      detail: res?.error || "Uygulanamadı",
      resultText: `HATA: ${res?.error || "PC komutu başarısız."}`
    };
  }

  if (toolName === "play_lullaby") {
    const title = String(args.title || "Yumuşak Uyku Ninnisi").trim();
    const lyrics = String(args.lyrics || "Dandini dandini dastana, tatlı rüyalar sana...").trim();
    if (turnContext) {
      turnContext.lullaby = { title, lyrics };
      turnContext.lullabyTriggered = true;
    }
    const isVoice = Boolean(turnContext?.isVoiceTurn || window.voiceSessionActive);
    window.playLullabyExperience?.(lyrics, { skipVoice: isVoice, loops: 2 });
    return {
      status: "done",
      summary: `🌙 ${title}`,
      detail: lyrics,
      resultText: `BAŞARILI: "${title}" ninnisi ve yumuşak müzik kutusu melodisi çalınmaya başlandı. Sohbet ekranında ninni kartı gösteriliyor.`
    };
  }

  return {
    status: "error",
    summary: toolName,
    detail: `Bilinmeyen araç: ${toolName}`,
    resultText: `HATA: '${toolName}' adında tanımlı bir araç yok.`
  };
}

window.executeLuxAgentTool = executeAgentTool;

function recordToolStepUI(assistantMsg, name, args, execRes, opts = {}) {
  if (!assistantMsg || assistantMsg.__aborted) return;
  if (assistantMsg.__turnId && assistantMsg.__turnId !== window.__luxActiveTurnId) return;
  if (!Array.isArray(assistantMsg.toolSteps)) assistantMsg.toolSteps = [];
  const stepId = `step-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const argPreview = args?.filePath || args?.query || args?.target || args?.action || args?.command || args?.dirPath || args?.prompt || "";
  assistantMsg.toolSteps.push({
    id: stepId,
    name,
    summary: execRes.summary || argPreview,
    status: execRes.status,
    detail: execRes.detail,
    expanded: false
  });
  assistantMsg.stepLabel = `✓ ${name}: ${execRes.summary || argPreview}`;
  if (!opts.deferRender) {
    renderChat();
    window.scrollToBottom?.();
  }
}

async function executeToolCallsBatch(rawCalls, assistantMsg, parseFn) {
  const items = (rawCalls || []).map((raw, idx) => {
    const parsed = parseFn ? parseFn(raw) : raw;
    return {
      idx,
      raw,
      name: String(parsed?.name || "").trim(),
      args: parsed?.args || {}
    };
  });
  if (items.length === 0) return [];

  if (items.length === 1) {
    const it = items[0];
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    const argPreview =
      it.args?.filePath ||
      it.args?.query ||
      it.args?.target ||
      it.args?.action ||
      it.args?.command ||
      it.args?.dirPath ||
      it.args?.prompt ||
      "";
    assistantMsg.stepLabel = `⚡ ${it.name} çalıştırılıyor: ${argPreview}`.slice(0, 80);
    renderChat();
    const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    recordToolStepUI(assistantMsg, it.name, it.args, execRes);
    return [{ ...it, execRes }];
  }

  const hasOrderSensitive = items.some((it) => /^(?:delete_path|move_path|run_command|pc_control)$/i.test(it.name));
  const results = new Array(items.length);

  if (hasOrderSensitive) {
    for (const it of items) {
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      const argPreview =
        it.args?.filePath ||
        it.args?.query ||
        it.args?.target ||
        it.args?.action ||
        it.args?.command ||
        it.args?.dirPath ||
        it.args?.prompt ||
        "";
      assistantMsg.stepLabel = `⚡ ${it.name} çalıştırılıyor: ${argPreview}`.slice(0, 80);
      renderChat();
      const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      recordToolStepUI(assistantMsg, it.name, it.args, execRes, { deferRender: true });
      results[it.idx] = { ...it, execRes };
    }
    renderChat();
    return results;
  }

  // Run mkdir calls first if paired with write_file, then parallelize read/search/web/image/write batch
  const mkdirItems = items.filter((it) => it.name === "mkdir");
  const parallelItems = items.filter((it) => it.name !== "mkdir");

  for (const it of mkdirItems) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg.stepLabel = `⚡ mkdir çalıştırılıyor...`;
    renderChat();
    const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    results[it.idx] = { ...it, execRes };
  }

  if (parallelItems.length > 0) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg.stepLabel = `⚡ ${parallelItems.map((it) => it.name).join(", ")} çalıştırılıyor...`;
    renderChat();
    const batchRes = await Promise.all(
      parallelItems.map(async (it) => ({
        it,
        execRes: await executeAgentTool(it.name, it.args, assistantMsg)
      }))
    );
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    for (const { it, execRes } of batchRes) {
      results[it.idx] = { ...it, execRes };
    }
  }

  for (const entry of results) {
    if (entry) {
      recordToolStepUI(assistantMsg, entry.name, entry.args, entry.execRes, { deferRender: true });
    }
  }
  renderChat();
  return results;
}

async function maybePreloadWorkspaceContextForPrompt(text, assistantMsg) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const perms = window.appStore?.getPermissions?.() || {};
  if (!hasFs || perms.file_read === false) return null;

  const lower = String(text || "").toLowerCase();
  const hasBuildOrWriteIntent =
    /(?:oluştur|olustur|kur|yarat|tasarla|web\s*tasar|html|css|js|yaz|düzenle|duzenle|ekle|sil|taşı|tasi|yeniden\s*adlandır|adını\s*değiştir)/i.test(
      lower
    );
  const realProjects = await refreshDesktopProjectsCache();

  // Check if user explicitly mentions a known Desktop project by name (e.g. "lux_al", "lux_futures_xl", "al tasarım")
  const mentionedProj =
    !hasBuildOrWriteIntent &&
    (realProjects || []).find((p) => {
      const pLow = (p.name || "").toLowerCase();
      return pLow.length >= 3 && !p.isActiveWorkspace && lower.includes(pLow);
    });

  if (mentionedProj) {
    const execRes = await executeAgentTool("list_files", { dirPath: mentionedProj.path }, assistantMsg);
    recordToolStepUI(assistantMsg, "list_files", { dirPath: mentionedProj.name }, execRes);
    if (execRes.status === "done") {
      return `[GÜNCEL PROJE TARAMASI — ${mentionedProj.name}]\n${execRes.resultText}\n\nKullanıcı "${mentionedProj.name}" projesini sordu. Yukarıdaki gerçek dosya ve klasör listesini samimi 'sen' diliyle netçe aktar.`;
    }
  }

  const asksProjectsList =
    !hasBuildOrWriteIntent &&
    /(projeler|projelerim|masaüstü|masaustu|desktop).*(neler|list|hangi|kaç|kac|göster|goster|klasör|klasor|dosya|var\s*mı)/i.test(lower);
  const asksFileListing =
    !hasBuildOrWriteIntent &&
    /(dosya|klasör|klasor|dizin).*(kaç|kac|say|list|neler|isim|adları|adlari|hepsi|tümü|tumu|içer|icer)|(kaç|kac).*(dosya|klasör|klasor)|(listele|listesini\s*çık|listesini\s*cik).*(dosya|proje|klasör)/i.test(
      lower
    );

  if (!asksProjectsList && !asksFileListing) return null;

  const parts = [];
  if (asksProjectsList) {
    const projRes = await executeAgentTool("list_projects", {}, assistantMsg);
    recordToolStepUI(assistantMsg, "list_projects", {}, projRes);
    if (projRes.status === "done") {
      parts.push(`[MASAÜSTÜ & ÇALIŞMA ALANI PROJELERİ]\n${projRes.resultText}`);
    }
  }

  if (asksFileListing) {
    const execRes = await executeAgentTool("list_files", { dirPath: "" }, assistantMsg);
    recordToolStepUI(assistantMsg, "list_files", { dirPath: "" }, execRes);
    if (execRes.status === "done") {
      parts.push(`[GÜNCEL ÇALIŞMA ALANI TARAMASI]\n${execRes.resultText}`);
    }
  }

  if (parts.length === 0) return null;
  return `${parts.join("\n\n")}\n\n[BİLGİ NOTU: Sadece yukarıdaki gerçek proje ve dosya isimlerini doğal arkadaşça Türkçe ile özetle (180 kelimeyi geçme). Uydurma isim ekleme.]`;
}

function maybePreloadConversationMemoryForPrompt(text) {
  const lower = String(text || "").toLowerCase();
  const asksMemory = /(dün|dun|önceki|onceki|geçmiş|gecmis|eski\s*sohbet|daha\s*önce|hatırl|hatirl|ne\s*konuşt|konuşmuşt|konusmust)/i.test(
    lower
  );
  if (!asksMemory) return null;

  const { entries, yesterdayEntries } = collectSavedConversationMemory();
  const specificallyYesterday = /\bdün\b|\bdünkü\b|\bdünü\b|\bdünün\b/i.test(lower);

  if (specificallyYesterday) {
    if (yesterdayEntries.length > 0) {
      const list = yesterdayEntries.map((e) => `- [${e.dateTag} · ${e.projName}] "${e.title}": ${e.snippet}`).join("\n");
      return `[Hafıza Kontrol Sonucu — Dünkü Kayıtlı Sohbet]\nDün konuşulanlar:\n${list}\nYukarıdaki konuyu ve içeriği akıcı, kısa bir sohbet cümlesiyle dostça anlat.`;
    }
    return `[Hafıza Kontrol Sonucu: Düne ait kayıtlı sohbet YOK (0 kayıt).]\nKullanıcıya düne ait kayıtlı bir sohbet bulunmadığını tek kısa, samimi ve dürüst bir cümleyle söyle (ör. 'Hafıza çekmecesine baktım ama düne ait bir sohbet kaydı yok valla!').`;
  }

  if (entries.length === 0) {
    return `[Hafıza Kontrol Sonucu: Geçmişe ait mesaj içeren başka sohbet kaydı YOK.]\nYönerge: Dürüst ve sıcak 'sen' diliyle kayıt olmadığını söyle.`;
  }

  const list = entries
    .slice(0, 4)
    .map((e) => `- [${e.dateTag} · ${e.projName}] Konu: "${e.title}" | Konuşulanlar: ${e.snippet}`)
    .join("\n");
  return `[Hafıza Kontrol Sonucu — Kayıtlı Sohbetler]\n${list}\nYönerge: Bu gerçek kayıtlara göre samimi 'sen' diliyle yanıt ver.`;
}

async function resolvePromptContextMentions(rawText, assistantMsg = null) {
  if (!rawText || typeof rawText !== "string") return rawText;
  const perms = window.appStore?.getPermissions?.() || {};
  const extraSections = [];

  const fileMatches = Array.from(rawText.matchAll(/@file:([^\s]+)/g));
  for (const match of fileMatches.slice(0, 4)) {
    const filePath = match[1];
    if (perms.file_read === false) {
      extraSections.push(`[Bağlam @file:${filePath}: Dosya okuma izni (file_read) kapalı]`);
      continue;
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      extraSections.push(`[Bağlam @file:${filePath}: Güvenlik koruması nedeniyle okunmadı]`);
      continue;
    }
    const res = await window.luxAPI?.fs?.readFile?.(filePath);
    if (res?.success) {
      const clipped = (res.content || "").slice(0, 6000);
      extraSections.push(`[Dosya Bağlamı: ${filePath}]\n\`\`\`\n${clipped}\n\`\`\``);
    } else {
      extraSections.push(`[Bağlam @file:${filePath}: Okunamadı (${res?.error || "bulunamadı"})]`);
    }
  }

  const folderMatches = Array.from(rawText.matchAll(/@folder:([^\s]+)/g));
  for (const match of folderMatches.slice(0, 3)) {
    const dirPath = match[1];
    if (perms.file_read === false) {
      extraSections.push(`[Bağlam @folder:${dirPath}: Dosya okuma izni kapalı]`);
      continue;
    }
    const res = await window.luxAPI?.fs?.listFiles?.(dirPath === "." ? "" : dirPath);
    if (Array.isArray(res)) {
      const listing = summarizeTreeText(res).join("\n");
      extraSections.push(`[Klasör İçeriği: ${dirPath}]\n${listing}`);
    }
  }

  if (/@screen:[^\s]+/i.test(rawText)) {
    if (perms.pc_control === false) {
      extraSections.push("[Bağlam @screen: Bilgisayar kontrol izni (pc_control) kapalı olduğu için ekran görüntüsü alınamadı]");
    } else if (window.luxAPI?.agent?.captureScreen) {
      const scrRes = await executeAgentTool("capture_screen", {}, assistantMsg);
      recordToolStepUI(assistantMsg, "capture_screen", {}, scrRes);
      if (scrRes.status === "done") {
        extraSections.push(`[Ekran Görüntüsü Alındı]\n${scrRes.resultText}`);
      }
    }
  }

  if (rawText.includes("@terminal:last_output")) {
    const termOut = window.luxLastTerminalOutput || "Henüz kayıtlı terminal çıktısı yok.";
    extraSections.push(`[Son Terminal Çıktısı]\n\`\`\`\n${String(termOut).slice(0, 4000)}\n\`\`\``);
  }

  if (extraSections.length === 0) return rawText;
  return `${rawText}\n\n---\nEklenen Çalışma Alanı Bağlamları:\n${extraSections.join("\n\n")}`;
}

async function maybeRecoverMissingActionOrRefusal(userText, rawReply, model, priorHistory, assistantMsg) {
  let reply = String(rawReply || "").trim();
  if (isTurnCanceled(assistantMsg) || assistantMsg?.__apiError) return reply;

  const perms = window.appStore?.getPermissions?.() || {};
  const steps = Array.isArray(assistantMsg?.toolSteps) ? assistantMsg.toolSteps : [];
  if (steps.some((s) => s.status === "denied")) {
    return reply;
  }

  const executed = new Set(assistantMsg?.executedTools || []);
  const lower = String(userText || "").toLowerCase();
  const refusalRx =
    /(?:internet\s*bağlantım\s*yok|erişimim\s*yok|internete\s*erişemiyorum|belirli\s*bir\s*kaynağa\s*erişimim\s*yok|özel\s*bir\s*servis(?:\s*veya\s*uygulama)?\s*kullanmanız\s*gerekebilir|yapamam|edemem|bulamam|tasarlayamam|oluşturamam|söyleyemem|kontrol\s*edemem|gerçek\s*zamanlı\s*(?:bilgiye|hava\s*durumuna)\s*(?:erişimim|ulaşımım)\s*yok|yetkim\s*yok|mümkün\s*değil|maalesef[^.!?\n]*(?:internet|eriş|görsel|resim|hava\s*durumu|ninni|kontrol))/i;
  const isTimeoutFallback = /model\s*tarafına\s*şu\s*an\s*ulaşılamadı/i.test(reply);
  const isRefusal = isTimeoutFallback || refusalRx.test(reply);

  const asksLullaby = /\b(?:ninni|uyut|uyku\s*şarkısı)\b/i.test(lower);
  const asksScreen = /(ekran\s*görüntüsü|ekran\s*goruntusu|screenshot|ekranı\s*çek|ekrani\s*cek|ekran\s*resmi)/i.test(lower);
  const asksSysInfo = /(sistem\s*bilg|donanım\s*bilg|ram\s*durumu|cpu\s*bilg|bilgisayar\s*bilg)/i.test(lower);
  const isWebBuildPrompt =
    /(?:web\s*(?:tasar[ıi]m[ıi]?|sitesi|sayfas[ıi]|projesi)|açılış\s*sayfası|landing\s*page|(?:html|css|js).*(?:site|sayfa|proje|tasarla|kur|oluştur)).*(?:tasarla|kur|oluştur|yap|yaz)|(?:masaüstü|masaustu|desktop|klasör|klasor).*(?:web|html|sayfa|site|tasar)/i.test(
      lower
    );

  const folderReq = !isWebBuildPrompt ? extractFolderCreationRequest(userText) : null;
  const fileWriteReq = !isWebBuildPrompt && !folderReq ? extractFileWriteRequest(userText) : null;
  const moveReq = extractMoveOrRenameRequest(userText);
  const deleteReq = extractDeleteRequest(userText);
  const openReq = !folderReq && !fileWriteReq ? extractAppOrFolderOpenRequest(userText) : null;

  const asksImageSearch =
    /(?:resim|resmi|fotoğraf|fotograf|görsel|gorsel).*(?:bul|getir|göster|ara)|(?:bul\s*getir|göster).*(?:resim|fotoğraf|görsel)/i.test(
      lower
    );
  const asksImageDesign =
    !isWebBuildPrompt &&
    !folderReq &&
    /(?:resim|logo|afiş|poster|ikon|wallpaper|illüstrasyon|kapak|görsel|art|desen).*(?:tasarla|çiz|ciz|üret|uret|oluştur|hazırla)|(?:tasarla|çiz|ciz).*(?:resim|logo|afiş|poster|görsel)/i.test(
      lower
    );
  const asksWeatherOrInternet =
    /(hava\s*durumu|sıcaklık|kaç\s*derece|internetten|webden|web'den|araştır|haberler|dolar\s*kuru|euro\s*kuru|altın\s*fiyat|borsa|güncel)/i.test(
      lower
    );
  const asksFileList = /(dosya|klasör|klasor|projeler).*(?:listele|kaç|kac|neler|hangi|isim)/i.test(lower);

  const hasAnyLocalAction = Boolean(
    asksLullaby ||
    asksScreen ||
    asksSysInfo ||
    asksImageSearch ||
    asksImageDesign ||
    isWebBuildPrompt ||
    asksFileList ||
    folderReq ||
    fileWriteReq ||
    moveReq ||
    deleteReq ||
    openReq ||
    executed.size > 0
  );

  // 1. Lullaby recovery
  if (!isTurnCanceled(assistantMsg) && asksLullaby && !executed.has("play_lullaby")) {
    const cleanLyrics =
      !isRefusal && reply.length >= 30
        ? reply
        : "Eee eee eee uyusun da büyüsün, yıldızlar üstünü örtsün...\nGözlerin tatlı rüyalara dalsın, ay ışığı yastığına konsun.\nMışıl mışıl uyu, sabaha gülümseyerek uyan.";
    const res = await executeAgentTool("play_lullaby", { title: "Tatlı Rüyalar Ninnisi", lyrics: cleanLyrics }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "play_lullaby", { title: "Tatlı Rüyalar Ninnisi" }, res);
    if (isRefusal || reply.length < 25) {
      reply = `${cleanLyrics}\n\n🌙 *Senin için yumuşak müzik kutusu ninnisini başlattım, karttan istediğin zaman açıp kapatabilirsin.*`;
    }
  }

  // 2. Folder creation recovery (e.g., "masaüstüne BB diye bir klasör oluştur")
  if (!isTurnCanceled(assistantMsg) && folderReq && !executed.has("mkdir") && perms.file_write !== false && window.luxAPI?.fs?.mkdir) {
    const res = await executeAgentTool("mkdir", { dirPath: folderReq.dirPath }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "mkdir", { dirPath: folderReq.dirPath }, res);
    if (res.status === "done") {
      if (isRefusal || !reply || reply.length < 25 || !reply.toLowerCase().includes(folderReq.folderName.toLowerCase())) {
        reply = `${folderReq.displayLocation} **${folderReq.folderName}** klasörünü hemen oluşturdum! 📁`;
      }
    } else if (res.status === "error") {
      reply = `**${folderReq.folderName}** klasörünü oluştururken bir sorun çıktı: ${res.detail || res.resultText}`;
    }
  }

  // 2b. Single File write recovery (e.g., "masaüstüne not.txt diye bir dosya oluştur")
  if (
    !isTurnCanceled(assistantMsg) &&
    fileWriteReq &&
    !executed.has("write_file") &&
    perms.file_write !== false &&
    window.luxAPI?.fs?.writeFile
  ) {
    if (fileWriteReq.baseDir && fileWriteReq.baseDir.includes("/") && window.luxAPI?.fs?.mkdir) {
      await executeAgentTool("mkdir", { dirPath: fileWriteReq.baseDir }, assistantMsg);
      if (isTurnCanceled(assistantMsg)) return reply;
    }
    const res = await executeAgentTool(
      "write_file",
      {
        filePath: fileWriteReq.filePath,
        content: fileWriteReq.content
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "write_file", { filePath: fileWriteReq.filePath }, res);
    if (res.status === "done") {
      if (isRefusal || !reply || reply.length < 25 || !reply.toLowerCase().includes(fileWriteReq.fileName.toLowerCase())) {
        reply = `**${fileWriteReq.fileName}** dosyasını \`${fileWriteReq.filePath}\` konumuna hemen oluşturdum! 📄`;
      }
    }
  }

  // 2c. Move / Rename recovery
  if (!isTurnCanceled(assistantMsg) && moveReq && !executed.has("move_path") && perms.file_write !== false && window.luxAPI?.fs?.movePath) {
    const res = await executeAgentTool(
      "move_path",
      {
        sourcePath: moveReq.sourcePath,
        destPath: moveReq.destPath
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "move_path", { sourcePath: moveReq.sourcePath, destPath: moveReq.destPath }, res);
    if (res.status === "done") {
      reply = moveReq.isRename
        ? `Adını **${moveReq.destPath.split("/").pop()}** olarak değiştirdim!`
        : `**${moveReq.sourcePath}** konumunu **${moveReq.destPath}** hedefine taşıdım!`;
    } else if (isRefusal) {
      reply = `Taşıma / yeniden adlandırma işlemi yapılamadı: ${res.detail || res.resultText}`;
    }
  }

  // 2d. Explicit file/folder Delete recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    deleteReq &&
    !executed.has("delete_path") &&
    perms.file_delete !== false &&
    window.luxAPI?.fs?.deletePath
  ) {
    const res = await executeAgentTool("delete_path", { targetPath: deleteReq.targetPath }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "delete_path", { targetPath: deleteReq.targetPath }, res);
    if (res.status === "done") {
      reply = `**${deleteReq.targetName}** diskten kalıcı olarak silindi.`;
    } else if (isRefusal) {
      reply = `Silme işlemi gerçekleştirilemedi: ${res.detail || res.resultText}`;
    }
  }

  // 2e. Open App / Open Folder recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    openReq &&
    !executed.has("pc_control") &&
    perms.pc_control !== false &&
    window.luxAPI?.agent?.pcControl
  ) {
    const res = await executeAgentTool("pc_control", { action: openReq.mode, target: openReq.target }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "pc_control", { action: openReq.mode, target: openReq.target }, res);
    if (res.status === "done" && (isRefusal || !reply || reply.length < 25)) {
      reply =
        openReq.mode === "open_app" ? `**${openReq.target}** uygulamasını hemen açtım!` : `**${openReq.target}** klasörünü hemen açtım!`;
    }
  }

  // 3. Screen capture recovery
  if (!isTurnCanceled(assistantMsg) && asksScreen && !executed.has("capture_screen") && perms.pc_control !== false) {
    const res = await executeAgentTool("capture_screen", {}, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "capture_screen", {}, res);
    if (res.status === "done" && isRefusal) {
      reply = `Ekran görüntünü hemen yakaladım! Aşağıdaki karttan tam boy büyütebilir veya dosyayı açabilirsin 📸`;
    }
  }

  // 4. System info recovery
  if (!isTurnCanceled(assistantMsg) && asksSysInfo && !executed.has("pc_control") && perms.pc_control !== false) {
    const res = await executeAgentTool("pc_control", { action: "system_info" }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "pc_control", { action: "system_info" }, res);
    if (res.status === "done" && (isRefusal || !/\b(?:GB|CPU|Windows|DESKTOP)\b/i.test(reply))) {
      reply = `${reply && !isRefusal ? reply + "\n\n" : ""}**Sistem Bilgilerin:**\n\`\`\`\n${res.detail}\n\`\`\``;
    }
  }

  // 5. Web Image Search recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    asksImageSearch &&
    !executed.has("image_search") &&
    perms.image_generation !== false &&
    perms.network_internet !== false
  ) {
    const imgQuery = extractCleanMediaQuery(userText, "search");
    const res = await executeAgentTool("image_search", { query: imgQuery, count: 2 }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "image_search", { query: imgQuery }, res);
    if (res.status === "done" && (isRefusal || /example\.com|placehold|unsplash\.com|bulamadım|resim\s*gösteremiyorum/i.test(reply))) {
      reply = `İnternetten **${imgQuery}** görsellerini bulup senin için getirdim! Aşağıdaki görsellere tıklayıp büyütebilirsin 🚗✨`;
    }
  }

  // 6. AI Image Design recovery
  if (!isTurnCanceled(assistantMsg) && asksImageDesign && !executed.has("image_generate") && perms.image_generation !== false) {
    const designPrompt = extractCleanMediaQuery(userText, "design");
    const res = await executeAgentTool("image_generate", { prompt: designPrompt, title: designPrompt }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "image_generate", { prompt: designPrompt }, res);
    if (
      res.status === "done" &&
      (isRefusal || /example\.com|placehold|unsplash\.com|tasarlayam|çizemem/i.test(reply) || !assistantMsg?.media?.length)
    ) {
      reply =
        reply && !isRefusal ? reply : `**${designPrompt}** tasarımını hazırlayıp aşağıya bıraktım! Beğendiysen diske de kaydedebiliriz 🎨`;
    }
  }

  // 7. Desktop / Workspace Web Project write_file recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    isWebBuildPrompt &&
    !executed.has("write_file") &&
    perms.file_write !== false &&
    window.luxAPI?.fs?.writeFile
  ) {
    const folderName = extractExplicitDesktopFolderName(userText);
    const webBase = detectRequestedBaseDir(userText) || "Desktop";
    const targetDir = `${webBase}/${folderName}`;
    const mkRes = await executeAgentTool("mkdir", { dirPath: targetDir }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "mkdir", { dirPath: targetDir }, mkRes);

    const blocks = extractCodeBlocksFromReply(reply);
    let htmlCode = blocks.html;
    let cssCode = blocks.css;
    let jsCode = blocks.js;

    if (!htmlCode || htmlCode.length < 80) {
      const starter = buildStarterWebFiles(userText, folderName);
      htmlCode = starter.html;
      if (!cssCode) cssCode = starter.css;
    } else if (cssCode && !/style\.css/i.test(htmlCode) && /<\/head>/i.test(htmlCode)) {
      htmlCode = htmlCode.replace(/<\/head>/i, '  <link rel="stylesheet" href="style.css" />\n</head>');
    }

    const htmlRes = await executeAgentTool(
      "write_file",
      {
        filePath: `${targetDir}/index.html`,
        content: htmlCode
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/index.html` }, htmlRes);

    if (cssCode) {
      const cssRes = await executeAgentTool(
        "write_file",
        {
          filePath: `${targetDir}/style.css`,
          content: cssCode
        },
        assistantMsg
      );
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/style.css` }, cssRes);
    }
    if (jsCode) {
      const jsRes = await executeAgentTool(
        "write_file",
        {
          filePath: `${targetDir}/script.js`,
          content: jsCode
        },
        assistantMsg
      );
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/script.js` }, jsRes);
    }

    if (isRefusal || !reply || reply.length < 40) {
      reply = `Masaüstünde **${folderName}** klasörünü oluşturup projeni gerçek dosyalarla kurdum! Aşağıdaki **Önizle** veya **Tarayıcıda Aç** butonlarıyla tasarımı hemen canlı görebilirsin 🚀`;
    } else if (!/masaüstü|desktop|kaydet|oluştur/i.test(reply)) {
      reply =
        `Masaüstündeki **${folderName}** klasörüne dosyaları kaydettim! Aşağıdaki butonlardan doğrudan tarayıcıda önizleyebilirsin 🚀\n\n` +
        reply.replace(/```[\s\S]*?```/g, "").trim();
    }
  }

  // 8. Live Internet / Weather recovery — STRICTLY blocked for local OS/file/folder requests, stop words, or LLM timeouts
  const asksLiveWebQuery =
    !hasAnyLocalAction &&
    !parseLuxVoiceStopCommand(userText) &&
    !isWipeMemoryPrompt(userText) &&
    !/(?:nasılsın|naber|selam|merhaba|teşekkür|sağ\s*ol|adın\s*ne|kimsin|seni\s*kim|dün\s*ne|sohbet|hafıza|hatırl)/i.test(lower);
  const allowWebRecovery = (asksWeatherOrInternet && !hasAnyLocalAction) || (isRefusal && !isTimeoutFallback && asksLiveWebQuery);

  if (
    !isTurnCanceled(assistantMsg) &&
    allowWebRecovery &&
    !executed.has("web_search") &&
    perms.web_search !== false &&
    perms.network_internet !== false
  ) {
    const res = await executeAgentTool("web_search", { query: userText }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "web_search", { query: userText }, res);
    if (res.status === "done" && res.data) {
      const w = res.data.weather;
      if (w) {
        const fc = Array.isArray(w.forecast) && w.forecast.length > 0 ? `\n\n**3 Günlük Tahmin:**\n- ${w.forecast.join("\n- ")}` : "";
        reply = `Hemen internetten canlı veriyi çektim! **${w.city}** şu an **${w.temperature}°C** (hissedilen ${w.apparentTemperature}°C) ve hava **${w.condition}**. Nem %${w.humidity}, rüzgar ${w.windSpeed} km/saat.${fc}`;
      } else if (Array.isArray(res.data.results) && res.data.results.length > 0) {
        const bullets = res.data.results
          .slice(0, 4)
          .map((r) => `- **${r.title}** (${r.source})\n  ${r.snippet || ""}\n  [Kaynağı Aç](${r.url})`)
          .join("\n");
        reply = `İnternetten canlı arama yaptım, öne çıkan sonuçlar şunlar:\n\n${bullets}`;
      }
    }
  }

  return reply;
}
