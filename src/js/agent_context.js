// LUX AI — Sistem promptu & çalışma bağlamı derleme katmanı (chat.js'ten ayrıştırıldı)
// Hafıza girdileri, çalışma alanı envanteri, stil kuralları ve araç seçimi burada toplanır.
// tool_schemas.js (LUX_OPENAI_TOOLS) gerekir; chat.js'ten ÖNCE yüklenir.

function collectSavedConversationMemory() {
  const state = window.appStore?.state || {};
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const activeConvId = state.activeConversationId;
  const entries = [];

  for (const proj of projects) {
    for (const conv of proj.conversations || []) {
      if (conv.id === activeConvId) continue;
      const msgs = Array.isArray(conv.messages) ? conv.messages : [];
      if (msgs.length === 0) continue;

      let dateTag = String(conv.timestamp || "tarih yok").trim();
      if (conv.updatedAt) {
        const d = new Date(conv.updatedAt);
        const now = new Date();
        const dayDiff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
        if (dayDiff === 0) dateTag = "Bugün";
        else if (dayDiff === 1) dateTag = "Dün";
        else dateTag = d.toLocaleDateString("tr-TR");
      } else if (/^dün$/i.test(dateTag)) {
        dateTag = "Dün";
      } else if (/^(?:şimdi|bugün)$/i.test(dateTag)) {
        dateTag = "Bugün";
      }

      const snippet = msgs
        .slice(-2)
        .map((m) =>
          String(m.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 110)
        )
        .filter(Boolean)
        .join(" — ");

      entries.push({
        id: conv.id,
        projName: proj.name || "LUX_ai",
        title: conv.title || "Sohbet",
        dateTag,
        isYesterday: dateTag === "Dün",
        msgCount: msgs.length,
        snippet,
        updatedAt: conv.updatedAt || 0
      });
    }
  }

  entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return {
    entries,
    yesterdayEntries: entries.filter((e) => e.isYesterday)
  };
}

function buildWorkspaceAndMemoryContext() {
  const state = window.appStore?.state || {};
  const appInfo = window.luxAppInfo || {};
  const wsDir = state.application?.workspaceDir || appInfo.currentWorkspace || "";
  const desktopDir = appInfo.desktopPath || (wsDir ? wsDir.replace(/[\\/][^\\/]+$/, "") : "");
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const activeProj = projects.find((p) => p.id === state.activeProjectId) || projects[0];
  const { entries } = collectSavedConversationMemory();
  const realProjects = Array.isArray(window.luxDesktopProjectsCache) ? window.luxDesktopProjectsCache : [];

  const lines = [];
  lines.push(`- Aktif Çalışma Klasörü: ${wsDir} | Aktif Proje: ${activeProj ? activeProj.name : "LUX_ai"}`);
  lines.push(`- Masaüstü Yolu: ${desktopDir} (Dosya yollarında 'Desktop/...' veya 'Masaüstü/...' kullanabilirsin)`);
  if (realProjects.length > 0) {
    const shownProj = realProjects
      .slice(0, 6)
      .map((p) => `${p.name}(${p.topLevelFileCount}f)`)
      .join(", ");
    const extraProj = realProjects.length > 6 ? `, +${realProjects.length - 6} diğer` : "";
    lines.push(`- Diskteki Projeler (${realProjects.length}): ${shownProj}${extraProj}`);
  } else if (projects.length > 0) {
    lines.push(
      `- Projeler (${projects.length}): ${projects
        .slice(0, 6)
        .map((p) => p.name)
        .join(", ")}`
    );
  }

  if (entries.length > 0) {
    lines.push(
      `- Kayıtlı Sohbet Özetleri (${entries.length}): ${entries
        .slice(0, 4)
        .map((e) => `[${e.dateTag}] "${e.title}"`)
        .join(", ")}`
    );
  } else {
    lines.push("- Kayıtlı Diğer Sohbetler: Mesaj içeren başka sohbet yok.");
  }

  return lines.join("\n");
}

function buildStylePreferenceReminder(rawPrompt = "", history = []) {
  const curLower = String(rawPrompt || "")
    .split(/\n---\n\[/)[0]
    .toLowerCase();
  const combined = [
    ...(Array.isArray(history)
      ? history
          .slice(-10)
          .filter((m) => m.role === "user")
          .map((m) => m.content || "")
      : []),
    curLower
  ]
    .join("\n")
    .toLowerCase();

  const rules = [];
  const directBan =
    /(?:^|\s)size\b|siz\s*(diye|kelime|hitap)|resmi/.test(curLower) && /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(curLower);
  if (directBan) {
    rules.push("ACİL KURAL: Kullanıcı artık sadece samimi 'sen' hitabıyla konuşmanı istiyor. Kısa, sıcak ve doğal tek cümleyle onayla.");
  } else if (
    /size|siz\s*(diye|kelime|hitap)|resmi/.test(combined) &&
    /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(combined)
  ) {
    rules.push("ÖZEL KURAL: İkinci çoğul hitap kullanma; yalnız samimi 'sen / sana / senin' kullan.");
  }
  if (/espiri|espri|samimi|doğal|dogal|insan\s*gibi|mekanik/.test(combined)) {
    rules.push("TON KURALI: Sıcak, doğal ve hafif esprili bir arkadaş gibi konuş.");
  }
  if (window.voiceSessionActive && !/dosya|listele|kaç\s*tane|kod\s*yaz/i.test(curLower)) {
    rules.push("SESLİ MOD: Cevabı akıcı konuşma dilinde 1-3 kısa cümlede tut.");
  }
  return rules.length > 0 ? `\n\n${rules.join("\n")}` : "";
}

function buildAgentSystemParts(rawPrompt = "", history = [], opts = {}) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const memContext = buildWorkspaceAndMemoryContext();
  const styleReminder = buildStylePreferenceReminder(rawPrompt, history);

  const staticPersona = [
    "Sen Lux gücünde sınırsız yetkiye sahip Lux AI'sın; kullanıcının yan yana çalıştığı zeki, sıcak ve samimi yakın dostusun.",
    "Temel Kurallar:",
    "- Doğal günlük Türkçe konuş; samimi 'sen / sana' çekimi kullan, resmi/kurumsal dil kullanma.",
    "- Sadece kullanıcının son isteğine odaklan.",
    "- Geçmiş sohbetler sorulduğunda sadece [Hafıza Kontrol Sonucu] verisine dayan.",
    "",
    "Sınırsız Yetki & Aksiyon Kuralları:",
    "- Canlı internet araması ve hava durumu (web_search, fetch_url), web'den görsel bulma (image_search), yapay zekayla görsel tasarlama (image_generate), Masaüstü ve tüm projelerde dosya/klasör oluşturma ve düzenleme (list_projects, list_files, read_file, write_file, mkdir, move_path, delete_path), PowerShell terminal (run_command), ekran görüntüsü ve tam PC kontrolü (capture_screen, pc_control) ve ninni/ses (play_lullaby) doğrudan çalışır durumda.",
    "- ASLA 'İnternet bağlantım yok', 'Erişimim yok', 'Resim bulamam/tasarlayamam', 'Ninni söyleyemem', 'Bilgisayarı kontrol edemem' veya 'Yapamam/edemem' deme. Bir iş istendiğinde doğrudan ilgili aracı çağır ve sonucu teslim et.",
    "- Masaüstü veya bilgisayarda klasör oluşturma dendiğinde (örn: 'masaüstüne BB diye bir klasör oluştur') DOĞRUDAN mkdir({dirPath:'Desktop/BB'}) aracını çağır; ASLA web_search ile arama yapma.",
    "- Dosya oluştur/yaz dendiğinde write_file, dosya/klasör taşı veya ad değiştir dendiğinde move_path, dosya/klasör sil dendiğinde delete_path, uygulama/klasör aç dendiğinde pc_control(open_app veya open_folder) aracını doğrudan çağır.",
    "- Kullanıcı açıkça YouTube veya video/şarkı istemediği sürece ASLA YouTube veya alakasız web sitesi açma.",
    "- İnternetten görsel veya tasarım istediğinde image_search veya image_generate aracını çalıştır; araç görseli diske indirip sohbete ekler, sahte URL uydurma.",
    "- Web sitesi veya çok dosyalı proje tasarla dendiğinde sadece sohbete kod yapıştırmakla kalma; mkdir ve write_file ile dosyaları gerçekten Masaüstü'ne veya çalışma alanına oluştur, gerekiyorsa pc_control(open_url) ile aç."
  ].join("\n");

  const xmlNote =
    hasFs && opts.includeXmlInstruction
      ? '\n\nAraç çağrısı için gerekirse <lux_tool>{"name":"arac_adi","args":{...}}</lux_tool> biçimini kullan. Dosya ve klasör yollarında düz eğik çizgi (/) veya çift ters eğik çizgi (\\\\) kullan. Araç çalıştırırken sohbeti kapatacak ön metin yazmak yerine doğrudan aracı çağır; araç sonucu sana iletildiğinde kullanıcıya nihai yanıtı sun.'
      : "";

  const dynamicSuffix = `Ortam:\n${memContext}${xmlNote}${styleReminder}`;
  return {
    staticPersona,
    dynamicSuffix,
    full: `${staticPersona}\n\n${dynamicSuffix}`
  };
}

function buildAgentSystemPrompt(rawPrompt = "", history = [], opts = {}) {
  return buildAgentSystemParts(rawPrompt, history, opts).full;
}

function shouldAttachToolsForPrompt(prompt = "", history = []) {
  const full = String(prompt || "");
  if (/\[Hafıza Kontrol Sonucu|\[Hafıza Durumu/i.test(full)) return false;
  const userPart = full
    .split(/\n---\n\[/)[0]
    .trim()
    .toLowerCase();
  const isTinyGreeting =
    userPart.length < 56 &&
    /^(?:selam(?:lar)?|merhaba|slm|hey|naber|nasılsın|nasilsin|ne\s*haber|iyiyim|günaydın|gunaydin|iyi\s*(?:akşamlar|geceler|günler)|teşekkür(?:ler|\s*ederim)?|sağ\s*ol(?:un)?|eyvallah|tamam(?:dır)?|olur|evet|hayır|peki|dostum|kanka|arkadaşım|ya)(?:[\s,!?.]+(?:selam(?:lar)?|merhaba|slm|hey|naber|nasılsın|nasilsin|ne\s*haber|iyiyim|sen\s*nasılsın|senden\s*naber|teşekkür(?:ler|\s*ederim)?|sağ\s*ol|eyvallah|dostum|kanka|arkadaşım|bugün|nasıl\s*gidiyor))*[!?. ]*$/i.test(
      userPart
    );
  if (isTinyGreeting) return false;
  return true;
}

function selectToolsForPrompt(prompt = "", isLocalCpu = false, history = []) {
  const userPart = String(prompt || "")
    .split(/\n---\n\[/)[0]
    .toLowerCase();
  const pickNames = new Set();

  if (
    /(hava\s*durumu|derece|sıcaklık|internet|web(?:\s*ara|den|'den|te)?|araştır|arastir|haber|kur|dolar|altın|euro|döviz|borsa|kripto|bitcoin|btc|fiyat|maç|skor|saat\s*kaç|kimdir|nedir|ne\s*zaman|güncel|siteye|url|http|vikipedi|wikipedia)/i.test(
      userPart
    )
  ) {
    pickNames.add("web_search");
    pickNames.add("fetch_url");
  }
  if (
    /(resim|fotoğraf|fotograf|görsel|gorsel|araba|logo|afiş|poster|çiz|ciz|tasarla|wallpaper|duvar kağıdı|illustration|illüstrasyon|banner)/i.test(
      userPart
    )
  ) {
    if (/(tasarla|çiz|ciz|üret|uret|yarat|logo|afiş|poster|ikon|wallpaper|illüstrasyon)/i.test(userPart)) {
      pickNames.add("image_generate");
    }
    if (/(bul|getir|göster|goster|fotoğraf|fotograf|araba|marka|resmi|resmini)/i.test(userPart)) {
      pickNames.add("image_search");
    }
    pickNames.add("image_search");
    pickNames.add("image_generate");
  }
  if (
    /(dosya|klasör|klasor|dizin|proje|masaüstü|masaustu|desktop|belge|indirilen|oku|yaz|kaydet|oluştur|olustur|yarat|kur|düzenle|duzenle|güncelle|guncelle|incele|tara|listele|web\s*tasar|web\s*site|html|css|js|python|kod|sayfa|sil|kaldır|taşı|tasi|adını\s*değiştir|yeniden\s*adlandır)/i.test(
      userPart
    )
  ) {
    pickNames.add("mkdir");
    pickNames.add("write_file");
    pickNames.add("list_files");
    pickNames.add("read_file");
    pickNames.add("move_path");
    pickNames.add("delete_path");
    pickNames.add("search_files");
    pickNames.add("list_projects");
  }
  const hasExplicitOpenWord =
    /(?:^|[\s.,!?'"()\-])(?:aç(?:ar\s*mısın|sana|abilir)?|başlat|baslat|çalıştır|calistir|kapat)(?=$|[\s.,!?'"()\-])/i.test(userPart);
  if (
    hasExplicitOpenWord ||
    /(komut|terminal|powershell|script|pip|npm|node|ekran|screenshot|pencere|uygulama|hesap\s*makine|not\s*defteri|chrome|vscode|explorer|tarayıcı|kontrol|sesi|pano|clipboard|tıkla|tikla|yazdır|tuş|bilgisayar|sistem)/i.test(
      userPart
    )
  ) {
    pickNames.add("pc_control");
    pickNames.add("capture_screen");
    pickNames.add("run_command");
    pickNames.add("write_file");
  }
  if (/(ninni|uyut|uyku|melodi|müzik|şarkı|sarki)/i.test(userPart)) {
    pickNames.add("play_lullaby");
  }

  // On ambiguous open-ended prompts: preserve full tool schemas for Cloud APIs,
  // but skip heavy native JSON schemas on local CPU to keep KV prefix warm & avoid 20-90s prompt evals (XML fallback remains active)
  if (pickNames.size === 0) {
    if (isLocalCpu) return [];
    return LUX_OPENAI_TOOLS;
  }

  const priorityOrder = [
    "mkdir",
    "write_file",
    "move_path",
    "delete_path",
    "pc_control",
    "read_file",
    "list_files",
    "search_files",
    "run_command",
    "capture_screen",
    "play_lullaby",
    "image_generate",
    "image_search",
    "list_projects",
    "web_search",
    "fetch_url"
  ];
  const limit = isLocalCpu ? 8 : 11;
  const selectedSet = new Set(priorityOrder.filter((n) => pickNames.has(n)).slice(0, limit));
  return LUX_OPENAI_TOOLS.filter((t) => selectedSet.has(t.function.name));
}
