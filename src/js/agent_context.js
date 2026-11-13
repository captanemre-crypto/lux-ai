// LUX AI — Sistem promptu & çalışma bağlamı derleme katmanı (chat.js'ten ayrıştırıldı)
// Hafıza girdileri, çalışma alanı envanteri, stil kuralları ve araç seçimi burada toplanır.
// tool_schemas.js (LUX_OPENAI_TOOLS) gerekir; chat.js'ten ÖNCE yüklenir.

function luxIsEnLocale() {
  try {
    return typeof window !== "undefined" && Boolean(window.LuxI18n) && window.LuxI18n.locale === "en";
  } catch (_) {
    return false;
  }
}

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
        if (dayDiff === 0) dateTag = luxIsEnLocale() ? "Today" : "Bugün";
        else if (dayDiff === 1) dateTag = luxIsEnLocale() ? "Yesterday" : "Dün";
        else dateTag = d.toLocaleDateString(luxIsEnLocale() ? "en-US" : "tr-TR");
      } else if (/^(?:dün|yesterday)$/i.test(dateTag)) {
        dateTag = luxIsEnLocale() ? "Yesterday" : "Dün";
      } else if (/^(?:şimdi|bugün|now|today)$/i.test(dateTag)) {
        dateTag = luxIsEnLocale() ? "Today" : "Bugün";
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
        isYesterday: /^(?:dün|yesterday)$/i.test(dateTag),
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

  const en = luxIsEnLocale();
  const lines = [];
  lines.push(
    en
      ? `- Active Workspace Folder: ${wsDir} | Active Project: ${activeProj ? activeProj.name : "LUX_ai"}`
      : `- Aktif Çalışma Klasörü: ${wsDir} | Aktif Proje: ${activeProj ? activeProj.name : "LUX_ai"}`
  );
  lines.push(
    en
      ? `- Desktop Path: ${desktopDir} (you can use 'Desktop/...' style paths in file paths)`
      : `- Masaüstü Yolu: ${desktopDir} (Dosya yollarında 'Desktop/...' veya 'Masaüstü/...' kullanabilirsin)`
  );
  if (realProjects.length > 0) {
    const shownProj = realProjects
      .slice(0, 6)
      .map((p) => `${p.name}(${p.topLevelFileCount}f)`)
      .join(", ");
    const extraProj = realProjects.length > 6 ? `, +${realProjects.length - 6} ${en ? "more" : "diğer"}` : "";
    lines.push(
      en
        ? `- On-Disk Projects (${realProjects.length}): ${shownProj}${extraProj}`
        : `- Diskteki Projeler (${realProjects.length}): ${shownProj}${extraProj}`
    );
  } else if (projects.length > 0) {
    lines.push(
      `- ${en ? "Projects" : "Projeler"} (${projects.length}): ${projects
        .slice(0, 6)
        .map((p) => p.name)
        .join(", ")}`
    );
  }

  if (entries.length > 0) {
    lines.push(
      `- ${en ? "Saved Chat Summaries" : "Kayıtlı Sohbet Özetleri"} (${entries.length}): ${entries
        .slice(0, 4)
        .map((e) => `[${e.dateTag}] "${e.title}"`)
        .join(", ")}`
    );
  } else {
    lines.push(en ? "- Saved Other Chats: no other chats contain messages." : "- Kayıtlı Diğer Sohbetler: Mesaj içeren başka sohbet yok.");
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

  const en = luxIsEnLocale();
  const rules = [];
  const bannedByEn =
    /(formal|formality|honorifics?|respectful(?:\s*tone)?)/.test(curLower) &&
    /(don't|do not|stop|never|no\b|skip|avoid|quit|enough|not)/.test(curLower);
  const directBan =
    /(?:^|\s)size\b|siz\s*(diye|kelime|hitap)|resmi/.test(curLower) && /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(curLower);
  if (directBan || bannedByEn) {
    rules.push(
      en
        ? "URGENT RULE: The user now wants only the casual, informal singular 'you' — drop all formal address. Confirm in one short, warm, natural sentence."
        : "ACİL KURAL: Kullanıcı artık sadece samimi 'sen' hitabıyla konuşmanı istiyor. Kısa, sıcak ve doğal tek cümleyle onayla."
    );
  } else if (
    (/size|siz\s*(diye|kelime|hitap)|resmi/.test(combined) && /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(combined)) ||
    (/(formal|formality|honorifics?|respectful(?:\s*tone)?)/.test(combined) &&
      /(don't|do not|stop|never|no\b|skip|avoid|quit|enough|not)/.test(combined))
  ) {
    rules.push(
      en
        ? "RULE: Never use formal/plural address; use only the casual, informal singular 'you'."
        : "ÖZEL KURAL: İkinci çoğul hitap kullanma; yalnız samimi 'sen / sana / senin' kullan."
    );
  }
  if (/espiri|espri|samimi|doğal|dogal|insan\s*gibi|mekanik|funny|witty|humou?r|natural|robotic|casual|warm|friendly/i.test(combined)) {
    rules.push(
      en
        ? "TONE RULE: Speak like a warm, natural, slightly witty friend."
        : "TON KURALI: Sıcak, doğal ve hafif esprili bir arkadaş gibi konuş."
    );
  }
  if (window.voiceSessionActive && !/dosya|listele|kaç\s*tane|kod\s*yaz/i.test(curLower)) {
    rules.push(
      en
        ? "VOICE MODE: Keep the reply to 1-3 short sentences in fluent, spoken-style language."
        : "SESLİ MOD: Cevabı akıcı konuşma dilinde 1-3 kısa cümlede tut."
    );
  }
  return rules.length > 0 ? `\n\n${rules.join("\n")}` : "";
}

function buildAgentSystemParts(rawPrompt = "", history = [], opts = {}) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const memContext = buildWorkspaceAndMemoryContext();
  const styleReminder = buildStylePreferenceReminder(rawPrompt, history);

  const enStaticPersona = [
    "You are Lux AI, an unlimited-authority assistant powered by Lux — the sharp, warm and friendly close companion the user works side by side with.",
    "Core Rules:",
    "- Speak natural, everyday English; keep a casual, warm tone, never formal or corporate.",
    "- Focus only on the user's latest request.",
    "- When asked about past conversations, rely only on the [Hafıza Kontrol Sonucu] data.",
    "",
    "Unlimited Authority & Action Rules:",
    "- Live web search and weather (web_search, fetch_url), finding images on the web (image_search), AI image generation (image_generate), creating and editing files/folders on the Desktop and across projects (list_projects, list_files, read_file, write_file, mkdir, move_path, delete_path), the PowerShell terminal (run_command), screenshots and full PC control (capture_screen, pc_control), and lullabies/audio (play_lullaby) are all live and working.",
    "- NEVER say 'I have no internet access', 'I cannot access that', 'I can't find/create images', 'I can't sing a lullaby', 'I can't control the computer' or 'I can't do that'. When a task is requested, call the relevant tool directly and deliver the result.",
    "- When asked to create a folder on the Desktop or the computer (e.g. 'create a folder called BB on the desktop'), call mkdir({dirPath:'Desktop/BB'}) DIRECTLY; NEVER search with web_search instead.",
    "- For file creation/writing use write_file, for moving or renaming use move_path, for deleting use delete_path, for opening apps/folders use pc_control(open_app or open_folder) — call the tool directly.",
    "- NEVER open YouTube or unrelated websites unless the user explicitly asks for YouTube or a video/song.",
    "- For images or designs from the internet use image_search or image_generate; the tool downloads the image to disk and adds it to the chat — never invent fake URLs.",
    "- When asked to build a website or a multi-file project, don't just paste code into the chat: actually create the files on the Desktop or in the workspace with mkdir and write_file, and open them with pc_control(open_url) if needed."
  ].join("\n");

  const staticPersona = luxIsEnLocale()
    ? enStaticPersona
    : [
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
      ? luxIsEnLocale()
        ? '\n\nIf needed, use the <lux_tool>{"name":"tool_name","args":{...}}</lux_tool> format for tool calls. Use forward slashes (/) or double backslashes (\\\\) in file and folder paths. Call tools directly instead of prefacing with text that closes the conversation; when the tool result reaches you, present the final answer to the user.'
        : '\n\nAraç çağrısı için gerekirse <lux_tool>{"name":"arac_adi","args":{...}}</lux_tool> biçimini kullan. Dosya ve klasör yollarında düz eğik çizgi (/) veya çift ters eğik çizgi (\\\\) kullan. Araç çalıştırırken sohbeti kapatacak ön metin yazmak yerine doğrudan aracı çağır; araç sonucu sana iletildiğinde kullanıcıya nihai yanıtı sun.'
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
  const isTinyGreetingEn =
    userPart.length < 56 &&
    /^(?:hi|hello|hey|yo|hiya|good\s*(?:morning|afternoon|evening|night)|thanks?|thx|ty|ok(?:ay)?|yep|nope|sure|lol|haha|bro|dude)(?:[\s,!?.]+(?:hi|hello|hey|yo|thanks?|ok(?:ay)?|how|are|you|going|doing|bro|dude|and|today|good|morning|evening))*[!?. ]*$/i.test(
      userPart
    );
  if (isTinyGreeting || isTinyGreetingEn) return false;
  return true;
}

function selectToolsForPrompt(prompt = "", isLocalCpu = false, history = []) {
  const userPart = String(prompt || "")
    .split(/\n---\n\[/)[0]
    .toLowerCase();
  const pickNames = new Set();

  if (
    /(hava\s*(nasıl|durumu|kaç)|hava\s*durumu|derece|sıcaklık|internet|web(?:\s*ara|den|'den|te)?|araştır|arastir|haber|kur|dolar|altın|euro|döviz|borsa|kripto|bitcoin|btc|fiyat|maç|skor|saat\s*kaç|kimdir|nedir|ne\s*zaman|güncel|siteye|url|http|vikipedi|wikipedia|weather|forecast|temperature|news|search|find|price|exchange|stock|market|crypto|current|latest|who is|who was|what is|when is|how much|website)/i.test(
      userPart
    )
  ) {
    pickNames.add("web_search");
    pickNames.add("fetch_url");
  }
  if (
    /(resim|fotoğraf|fotograf|görsel|gorsel|araba|logo|afiş|poster|çiz|ciz|tasarla|wallpaper|duvar kağıdı|illustration|illüstrasyon|banner|image|picture|photo|draw|drawing|sketch|design|icon)/i.test(
      userPart
    )
  ) {
    if (
      /(tasarla|çiz|ciz|üret|uret|yarat|logo|afiş|poster|ikon|wallpaper|illüstrasyon|design|draw|generate|create|icon|poster|banner)/i.test(
        userPart
      )
    ) {
      pickNames.add("image_generate");
    }
    if (
      /(bul|getir|göster|goster|fotoğraf|fotograf|araba|marka|resmi|resmini|find|get|show|look for|picture|photo|image)/i.test(userPart)
    ) {
      pickNames.add("image_search");
    }
    pickNames.add("image_search");
    pickNames.add("image_generate");
  }
  if (
    /(dosya|klasör|klasor|dizin|proje|masaüstü|masaustu|desktop|belge|indirilen|oku|yaz|kaydet|oluştur|olustur|yarat|kur|düzenle|duzenle|güncelle|guncelle|incele|tara|listele|web\s*tasar|web\s*site|html|css|js|python|kod|sayfa|sil|kaldır|taşı|tasi|adını\s*değiştir|yeniden\s*adlandır|file|folder|directory|project|document|download|read|write|save|create|make|edit|update|rename|delete|remove|list|search|code|page|website|build)/i.test(
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
    /(?:^|[\s.,!?'"()\-])(?:aç(?:ar\s*mısın|sana|abilir)?|başlat|baslat|çalıştır|calistir|kapat|open|launch|start|close|run|execute)(?=$|[\s.,!?'"()\-])/i.test(
      userPart
    );
  if (
    hasExplicitOpenWord ||
    /(komut|terminal|powershell|script|pip|npm|node|ekran|screenshot|pencere|uygulama|hesap\s*makine|not\s*defteri|chrome|vscode|explorer|tarayıcı|kontrol|sesi|pano|clipboard|tıkla|tikla|yazdır|tuş|bilgisayar|sistem|command|window|application|calculator|notepad|browser|control|volume|click|type|keyb|mouse|computer)/i.test(
      userPart
    )
  ) {
    pickNames.add("pc_control");
    pickNames.add("capture_screen");
    pickNames.add("run_command");
    pickNames.add("write_file");
  }
  if (/(ninni|uyut|uyku|melodi|müzik|şarkı|sarki|lullaby|lullabies|sleep|melody|music|song)/i.test(userPart)) {
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
