// LUX AI — i18n iskeleti (varsayılan: Türkçe, English hazır)
//
// Neden gömülü katalog: uygulama file:// origin'den paketli çalışır; dış JSON
// fetch'i bu bağlamda güvenilir değildir. Katalog büyüdüğünde build adımıyla
// src/locales/*.json'a taşınabilir. Anahtar biçimi: "alan.alt_alan".
// Yer tutucular: "{name}" biçiminde; LuxI18n.t('key', { name: '...' }) ile doldurulur.
// Kullanıcı dili localStorage "lux-locale" üzerinden kalıcıdır (setLocale ile).
(function () {
  const LOCALES = Object.freeze({
    tr: {
      "app.name": "Lux AI",
      "common.save": "Kaydet",
      "common.cancel": "Vazgeç",
      "common.close": "Kapat",
      "common.delete": "Sil",
      "common.settings": "Ayarlar",
      "common.approve": "Onayla",
      "common.deny": "Reddet",
      "approval.title": "Yüksek Riskli İşlem Onayı",
      "approval.subtitle": "Lux şu işlemi çalıştırmak istiyor: {label}",
      "approval.run": "Çalıştır",
      "approval.deny": "Reddet",
      "approval.remember": "Bir daha sorma — Otomatik Komut Onayı'nı aç (Ayarlar > İzinler)",
      "approval.emptyDetail": "(ayrıntı yok)",
      "vault.title": "Anahtar Kasası (Şifreli)",
      "vault.subtitle":
        "Gemini / OpenRouter / OpenAI / Anthropic API anahtarları yalnızca bu cihazda şifreli saklanır; arayüze asla düz metin dönülmez.",
      "vault.rotate": "Kasayı Yeniden Şifrele",
      "vault.rotating": "Yeniden şifreleniyor…",
      "vault.loading": "Kasa durumu yükleniyor…",
      "vault.rotateDone": "Kasa yeniden şifrelendi ({count} anahtar).",
      "vault.schemeSafeStorage": "İşletim sistemi anahtar zinciri (safeStorage)",
      "vault.schemeAesGcm": "AES-256-GCM (dosya tabanlı, makineye özgü)",
      "voice.consentTitle": "Ses tanıma modeli ilk kullanımda indirilecek.",
      "voice.consentBody": "faster-whisper (small, int8) bir kez iner (~244 MB), sonra tamamen çevrimdışı çalışır.",
      "voice.consentNo": "Şimdi Değil",
      "voice.consentYes": "İndir ve Hazırla",
      "menu.workspace": "Çalışma Alanı",
      "menu.view": "Görünüm",
      "menu.window": "Pencere",
      "menu.preferences": "Tercihler...",
      "menu.devtools": "Geliştirici Araçları",
      "menu.reload": "Pencereyi Yenile",
      "menu.about": "Lux AI Hakkında",
      "menu.quit": "Lux AI'dan Çıkış",
      "menu.newConversation": "Yeni Sohbet",
      "menu.openFolder": "Proje Klasörü Aç...",
      "menu.clearCurrentChat": "Geçerli Sohbeti Temizle",
      "menu.toggleSidebar": "Kenar Çubuğunu Aç/Kapat",
      "menu.toggleOverview": "Genel Bakış Panelini Aç/Kapat",
      "menu.splitMode": "Bölünmüş IDE Modu",
      "menu.zoomIn": "Yakınlaştır",
      "menu.zoomOut": "Uzaklaştır",
      "menu.zoomReset": "Yakınlaştırmayı Sıfırla",
      "menu.minimize": "Simge Durumuna Küçült",
      "menu.maximize": "Ekranı Kapla",
      "menu.closeWindow": "Pencereyi Kapat",
      "menu.modelParams": "Model Parametreleri",
      "menu.modelParamsHint": "Yapılandır",
      "menu.exportMd": "Markdown Olarak Dışa Aktar",
      "menu.exportJson": "JSON Olarak Dışa Aktar",
      "menu.clearChat": "Sohbeti Temizle",
      "toolbar.newConversationTooltip": "Yeni Sohbet Başlat",
      "toolbar.sidebarTooltip": "Kenar Çubuğunu Aç/Kapat (Ctrl+B)",
      "toolbar.back": "Geri Git",
      "toolbar.forward": "İleri Git",
      "toolbar.search": "Sohbetlerde Ara",
      "toolbar.searchHint": "Sohbetlerde Ara (Ctrl+P)",
      "toolbar.moreActions": "Diğer İşlemler",
      "toolbar.overviewTooltip": "Genel Bakış Panelini Aç/Kapat",
      "toolbar.splitTooltip": "Bölünmüş Pencereyi Aç/Kapat",
      "toolbar.scrollBottom": "Aşağı Kaydır",
      "toolbar.attachFile": "Dosya Ekle...",
      "toolbar.attachContext": "Bağlam ekle",
      "toolbar.attachContextHint": "Bağlam ekle (+)",
      "toolbar.screenshot": "Ekran Görüntüsü Al",
      "toolbar.attachTerminal": "Terminal Çıktısını Ekle",
      "toolbar.attachFolder": "Klasör Ekle...",
      "toolbar.modelSelect": "Yapay zeka modelini seçin",
      "toolbar.modeSelect": "Çalışma modunu seçin",
      "composer.placeholder": "Herhangi bir şey sorun, @ ile bahsedin, / ile işlem seçin",
      "composer.dictate": "Sesle Yaz (Dikte)",
      "composer.dictateAria": "Ses kaydı al",
      "composer.voiceMode": "Sesli Canlı Sohbet (Voice Mode)",
      "composer.startVoice": "Sesli modu başlat",
      "composer.send": "Gönder",
      "composer.sendTitle": "Gönder (Enter)",
      "voice.changeCharacter": "Ses Karakterini Değiştir",
      "voice.micToggle": "Mikrofon (Aç/Kapat)",
      "voice.speakerToggle": "Hoparlör (Aç/Kapat)",
      "voice.speed": "Ses Hızı",
      "voice.toggleCollapse": "Küçült / Genişlet",
      "voice.endSession": "Sesli Oturumu Kapat",
      "voice.listening": "Dinliyor. Herhangi bir şey sorun.",
      "suggestion.weather.title": "Canlı İnternet & Hava Durumu",
      "suggestion.weather.desc": "Gerçek zamanlı web araştırması ve hava durumu raporu",
      "suggestion.images.title": "Görsel Bul & Tasarla",
      "suggestion.images.desc": "Web'den fotoğraf getir veya yapay zeka ile sıfırdan çiz",
      "suggestion.project.title": "Masaüstünde Web & Kod Kur",
      "suggestion.project.desc": "Otonom dosya üretimi, tarayıcı önizleme ve PC entegrasyonu",
      "suggestion.projects.title": "Projeler & Dosya Analizi",
      "suggestion.projects.desc": "Çalışma alanı ve Masaüstü projelerini tam tara",
      "sidebar.automations": "Otomasyonlar",
      "sidebar.customizations": "Özelleştirmeler",
      "sidebar.projects": "Projeler",
      "sidebar.newConversation": "Yeni Sohbet",
      "sidebar.confirmDelete": "Silmeyi Onayla ✕",
      "sidebar.delete": "Sil",
      "sidebar.rename": "Yeniden Adlandır",
      "sidebar.deleteProject": "Projeyi Sil",
      "sidebar.projectSettings": "Proje Ayarları",
      "sidebar.copyProjectName": "Proje Adını Kopyala",
      "sidebar.openSplit": "Sağda Aç (Bölünmüş Görünüm)",
      "sidebar.copyMd": "Markdown Olarak Kopyala",
      "sidebar.copyJson": "JSON Olarak Kopyala",
      "sidebar.copyTitle": "Başlığı Kopyala",
      "sidebar.copy": "Kopyala",
      "sidebar.noConversations": "Henüz sohbet yok",
      "sidebar.noMatches": "Eşleşen proje veya sohbet bulunamadı",
      "sidebar.add": "Ekle",
      "sidebar.stop": "Durdur",
      "sidebar.showInExplorer": "Dosya Gezgininde Göster",
      "sidebar.split": "Böl",
      "panel.overview": "Genel Bakış",
      "panel.insights": "İnceleme",
      "panel.files": "Dosyalar",
      "panel.terminal": "Terminal",
      "panel.plugins": "Eklentiler",
      "panel.backgroundTasks": "Arka Plan Görevleri",
      "panel.seeAll": "Tümünü gör",
      "panel.pluginsInstalled": "Yüklü Eklentiler ve Servisler",
      "panel.live": "Canlı",
      "panel.gitUnavailable": "Git/Diff API kullanılamıyor.",
      "panel.noPendingChanges": "Bekleyen değişiklik yok",
      "panel.scanningChanges": "Değişiklikler taranıyor...",
      "panel.loadingFiles": "Dosyalar yükleniyor...",
      "panel.refresh": "Yenile",
      "panel.noDiff": "Satır düzeyinde fark bulunamadı.",
      "panel.connected": "Bağlı",
      "settings.navGeneral": "Genel",
      "settings.navApplication": "Uygulama",
      "settings.navAppearance": "Görünüm",
      "settings.navPermissions": "İzinler",
      "settings.navNotifications": "Bildirimler",
      "settings.navModels": "Modeller",
      "settings.navAutomations": "Otomasyonlar",
      "settings.navCustomizations": "Özelleştirmeler",
      "settings.navShortcuts": "Klavye Kısayolları",
      "settings.navConversations": "Sohbetler",
      "update.available": "Lux {version} mevcut — arka planda indiriliyor.",
      "update.downloading": "Güncelleme indiriliyor… %{percent}",
      "update.downloaded": "Lux {version} hazır — yeniden başlatın, kurulsun.",
      "update.restartNow": "Yeniden Başlat ve Yükle",
      "update.upToDate": "Lux zaten güncel.",
      "backup.export": "Yedeği Dışa Aktar",
      "backup.import": "Yedeği İçe Aktar",
      "backup.password": "Parola (opsiyonel — AES-256-GCM ile şifreler)",
      "logs.title": "Günlükler",
      "logs.refresh": "Yenile",
      "logs.copy": "Kopyala",
      "logs.openFolder": "Klasörü Aç",
      "logs.clear": "Temizle"
    },
    en: {
      "app.name": "Lux AI",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.delete": "Delete",
      "common.settings": "Settings",
      "common.approve": "Approve",
      "common.deny": "Deny",
      "approval.title": "High-Risk Action Approval",
      "approval.subtitle": "Lux wants to run the following: {label}",
      "approval.run": "Run",
      "approval.deny": "Deny",
      "approval.remember": "Do not ask again — enable Auto-Approve (Settings > Permissions)",
      "approval.emptyDetail": "(no details)",
      "vault.title": "Key Vault (Encrypted)",
      "vault.subtitle":
        "Gemini / OpenRouter / OpenAI / Anthropic API keys are stored encrypted on this device only; they are never returned in plaintext.",
      "vault.rotate": "Re-encrypt Vault",
      "vault.rotating": "Re-encrypting…",
      "vault.loading": "Loading vault status…",
      "vault.rotateDone": "Vault re-encrypted ({count} keys).",
      "vault.schemeSafeStorage": "OS key chain (safeStorage)",
      "vault.schemeAesGcm": "AES-256-GCM (file-based, machine-bound)",
      "voice.consentTitle": "The speech model will be downloaded on first use.",
      "voice.consentBody": "faster-whisper (small, int8) downloads once (~244 MB), then runs fully offline.",
      "voice.consentNo": "Not Now",
      "voice.consentYes": "Download & Prepare",
      "menu.workspace": "Workspace",
      "menu.view": "View",
      "menu.window": "Window",
      "menu.preferences": "Preferences…",
      "menu.devtools": "Developer Tools",
      "menu.reload": "Reload Window",
      "menu.about": "About Lux AI",
      "menu.quit": "Quit Lux AI",
      "menu.newConversation": "New Chat",
      "menu.openFolder": "Open Project Folder…",
      "menu.clearCurrentChat": "Clear Current Chat",
      "menu.toggleSidebar": "Toggle Sidebar",
      "menu.toggleOverview": "Toggle Overview Panel",
      "menu.splitMode": "Split IDE Mode",
      "menu.zoomIn": "Zoom In",
      "menu.zoomOut": "Zoom Out",
      "menu.zoomReset": "Reset Zoom",
      "menu.minimize": "Minimize",
      "menu.maximize": "Maximize",
      "menu.closeWindow": "Close Window",
      "menu.modelParams": "Model Parameters",
      "menu.modelParamsHint": "Configure",
      "menu.exportMd": "Export as Markdown",
      "menu.exportJson": "Export as JSON",
      "menu.clearChat": "Clear Chat",
      "toolbar.newConversationTooltip": "Start New Chat",
      "toolbar.sidebarTooltip": "Toggle Sidebar (Ctrl+B)",
      "toolbar.back": "Back",
      "toolbar.forward": "Forward",
      "toolbar.search": "Search Chats",
      "toolbar.searchHint": "Search Chats (Ctrl+P)",
      "toolbar.moreActions": "More Actions",
      "toolbar.overviewTooltip": "Toggle Overview Panel",
      "toolbar.splitTooltip": "Toggle Split Window",
      "toolbar.scrollBottom": "Scroll to Bottom",
      "toolbar.attachFile": "Attach File…",
      "toolbar.attachContext": "Add context",
      "toolbar.attachContextHint": "Add context (+)",
      "toolbar.screenshot": "Take Screenshot",
      "toolbar.attachTerminal": "Add Terminal Output",
      "toolbar.attachFolder": "Add Folder…",
      "toolbar.modelSelect": "Choose AI model",
      "toolbar.modeSelect": "Choose working mode",
      "composer.placeholder": "Ask anything, @ to mention, / for actions",
      "composer.dictate": "Dictate",
      "composer.dictateAria": "Record audio",
      "composer.voiceMode": "Voice Mode",
      "composer.startVoice": "Start voice mode",
      "composer.send": "Send",
      "composer.sendTitle": "Send (Enter)",
      "voice.changeCharacter": "Change Voice Character",
      "voice.micToggle": "Microphone (On/Off)",
      "voice.speakerToggle": "Speaker (On/Off)",
      "voice.speed": "Speech Speed",
      "voice.toggleCollapse": "Collapse / Expand",
      "voice.endSession": "End Voice Session",
      "voice.listening": "Listening. Ask anything.",
      "suggestion.weather.title": "Live Web & Weather",
      "suggestion.weather.desc": "Real-time web research and weather report",
      "suggestion.images.title": "Find & Design Images",
      "suggestion.images.desc": "Fetch photos from the web or generate from scratch with AI",
      "suggestion.project.title": "Build Web & Code on Desktop",
      "suggestion.project.desc": "Autonomous file generation, browser preview and PC integration",
      "suggestion.projects.title": "Projects & File Analysis",
      "suggestion.projects.desc": "Full scan of workspace and Desktop projects",
      "sidebar.automations": "Automations",
      "sidebar.customizations": "Customizations",
      "sidebar.projects": "Projects",
      "sidebar.newConversation": "New Chat",
      "sidebar.confirmDelete": "Confirm Delete ✕",
      "sidebar.delete": "Delete",
      "sidebar.rename": "Rename",
      "sidebar.deleteProject": "Delete Project",
      "sidebar.projectSettings": "Project Settings",
      "sidebar.copyProjectName": "Copy Project Name",
      "sidebar.openSplit": "Open Right (Split View)",
      "sidebar.copyMd": "Copy as Markdown",
      "sidebar.copyJson": "Copy as JSON",
      "sidebar.copyTitle": "Copy Title",
      "sidebar.copy": "Copy",
      "sidebar.noConversations": "No chats yet",
      "sidebar.noMatches": "No matching project or chat",
      "sidebar.add": "Add",
      "sidebar.stop": "Stop",
      "sidebar.showInExplorer": "Show in File Explorer",
      "sidebar.split": "Split",
      "panel.overview": "Overview",
      "panel.insights": "Insights",
      "panel.files": "Files",
      "panel.terminal": "Terminal",
      "panel.plugins": "Plugins",
      "panel.backgroundTasks": "Background Tasks",
      "panel.seeAll": "See all",
      "panel.pluginsInstalled": "Installed Plugins & Services",
      "panel.live": "Live",
      "panel.gitUnavailable": "Git/Diff API unavailable.",
      "panel.noPendingChanges": "No pending changes",
      "panel.scanningChanges": "Scanning changes…",
      "panel.loadingFiles": "Loading files…",
      "panel.refresh": "Refresh",
      "panel.noDiff": "No line-level diff found.",
      "panel.connected": "Connected",
      "settings.navGeneral": "General",
      "settings.navApplication": "Application",
      "settings.navAppearance": "Appearance",
      "settings.navPermissions": "Permissions",
      "settings.navNotifications": "Notifications",
      "settings.navModels": "Models",
      "settings.navAutomations": "Automations",
      "settings.navCustomizations": "Customizations",
      "settings.navShortcuts": "Keyboard Shortcuts",
      "settings.navConversations": "Chats",
      "update.available": "Lux {version} is available — downloading in background.",
      "update.downloading": "Downloading update… {percent}%",
      "update.downloaded": "Lux {version} is ready — restart to install.",
      "update.restartNow": "Restart & Install",
      "update.upToDate": "Lux is up to date.",
      "backup.export": "Export Backup",
      "backup.import": "Import Backup",
      "backup.password": "Password (optional — encrypts with AES-256-GCM)",
      "logs.title": "Logs",
      "logs.refresh": "Refresh",
      "logs.copy": "Copy",
      "logs.openFolder": "Open Folder",
      "logs.clear": "Clear"
    }
  });

  const DEFAULT_LOCALE = "tr";
  let current = DEFAULT_LOCALE;
  try {
    const saved = window.localStorage ? window.localStorage.getItem("lux-locale") : null;
    if (saved && Object.prototype.hasOwnProperty.call(LOCALES, saved)) current = saved;
    try {
      if (typeof document !== "undefined") document.documentElement.lang = current;
    } catch (_) {
      /* lang atama kritik değil */
    }
  } catch (e) {
    /* private mode vb. — varsayılanla devam */
    window.luxDebug?.("i18n.js:325", e);
  }

  function t(key, params) {
    const dict = LOCALES[current] || LOCALES[DEFAULT_LOCALE];
    let str = (dict && dict[key]) || LOCALES[DEFAULT_LOCALE][key] || LOCALES.en[key] || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        str = String(str).split(`{${k}}`).join(String(v));
      }
    }
    return str;
  }

  function setLocale(next) {
    if (!Object.prototype.hasOwnProperty.call(LOCALES, next)) return false;
    current = next;
    try {
      window.localStorage?.setItem("lux-locale", next);
    } catch (e) {
      window.luxDebug?.("i18n.js:345", e);
    }
    try {
      document.documentElement.lang = next;
    } catch (e) {
      window.luxDebug?.("i18n.js:348", e);
    }
    try {
      applyLuxI18n(document);
    } catch (e) {
      window.luxDebug?.("i18n.js:351", e);
    }
    try {
      if (next === "en") localizeElementTree(document.documentElement);
      else restoreOriginals(document.documentElement);
    } catch (e) {
      window.luxDebug?.("i18n.js:355", e);
    }
    ensureObserver();
    return true;
  }

  function applyLuxI18n(root) {
    const scope = root || document;
    const map = [
      ["data-i18n", "textContent"],
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-title", "title"],
      ["data-i18n-aria-label", "aria-label"]
    ];
    for (const [attr, prop] of map) {
      scope.querySelectorAll("[" + attr + "]").forEach((el) => {
        const key = el.getAttribute(attr);
        if (!key) return;
        const value = t(key);
        if (prop === "textContent") el.textContent = value;
        else el.setAttribute(prop, value);
      });
    }
  }

  try {
    applyLuxI18n(document);
  } catch (e) {
    window.luxDebug?.("i18n.js:381", e);
  }

  // ---- Retrofit TR→EN (çalışma zamanı) ----
  // Statik data-i18n kapsamı dışındaki TÜM kullanıcıya dönük metinler (JS şablonlarıyla
  // üretilen ayarlar, yan panel, kenar çubuğu, arama, sesler vb.) burada ele alınır.
  // Sohbet transkripti kabı (#chat-messages-container) kasıtlı olarak DIŞARIDA tutulur:
  // kullanıcı ve model mesajları yazıldığı dilde kalır.
  const MAP = (typeof window !== "undefined" && window.LUX_TR_TO_EN) || { exact: {}, substr: [] };
  const SUBSTR = Array.isArray(MAP.substr) ? [...MAP.substr].sort((a, b) => String(b[0]).length - String(a[0]).length) : [];
  const SKIP_SELECTOR = '.lux-msg-markdown, [data-testid="user-message-content"], script, style, code, pre, kbd, samp, [data-i18n-ignore]';
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];

  function localizeString(input) {
    if (typeof input !== "string" || !input || current !== "en") return input;
    const hit = MAP.exact && MAP.exact[input];
    if (hit) return hit;
    const trimmed = input.trim();
    if (trimmed && MAP.exact && MAP.exact[trimmed]) {
      return input.slice(0, input.indexOf(trimmed)) + MAP.exact[trimmed] + input.slice(input.indexOf(trimmed) + trimmed.length);
    }
    let out = input;
    for (const pair of SUBSTR) {
      const from = pair[0];
      const to = pair[1];
      if (from && out.indexOf(from) !== -1) out = out.split(from).join(to);
    }
    return out;
  }

  function isSkipped(el) {
    return !!(el && el.closest && el.closest(SKIP_SELECTOR));
  }

  function localizeAttribute(el, attr) {
    if (!el || isSkipped(el)) return;
    const v = el.getAttribute(attr);
    if (!v) return;
    const next = localizeString(v);
    if (next !== v) {
      let rec = originalAttrs.get(el);
      if (!rec) {
        rec = {};
        originalAttrs.set(el, rec);
      }
      if (!Object.prototype.hasOwnProperty.call(rec, attr)) rec[attr] = v;
      el.setAttribute(attr, next);
    }
  }

  // EN'ye çevrilen düğümlerin özgün (TR) değerleri; TR'ye geri dönüşte geri yazılır.
  const originalTextNodes = new WeakMap();
  const originalAttrs = new WeakMap();

  function localizeTextNode(node) {
    if (!node || !node.parentElement || isSkipped(node.parentElement)) return;
    const v = node.nodeValue;
    if (!v || !v.trim()) return;
    const next = localizeString(v);
    if (next !== v) {
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, v);
      node.nodeValue = next;
    }
  }

  function restoreOriginals(root) {
    if (!root) return;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        if (originalTextNodes.has(n)) {
          n.nodeValue = originalTextNodes.get(n);
          originalTextNodes.delete(n);
        }
        n = walker.nextNode();
      }
      const scope = root.nodeType === 1 ? [root, ...root.querySelectorAll("[placeholder],[title],[aria-label],[alt]")] : [];
      for (const el of scope) {
        const rec = originalAttrs.get(el);
        if (!rec) continue;
        for (const attr of Object.keys(rec)) el.setAttribute(attr, rec[attr]);
        originalAttrs.delete(el);
      }
    } catch (e) {
      window.luxDebug?.("i18n.js:464", e);
    }
  }

  function localizeElementTree(root) {
    if (!root) return;
    try {
      if (root.nodeType === 3) {
        localizeTextNode(root);
        return;
      }
      if (root.nodeType !== 1 || isSkipped(root)) return;
      for (const attr of ATTRS) localizeAttribute(root, attr);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        localizeTextNode(n);
        n = walker.nextNode();
      }
      for (const attr of ATTRS) {
        const els = root.querySelectorAll("[" + attr + "]");
        els.forEach((el) => localizeAttribute(el, attr));
      }
    } catch (e) {
      window.luxDebug?.("i18n.js:486", e);
    }
  }

  let observer = null;
  function ensureObserver() {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    try {
      observer = new MutationObserver((mutations) => {
        if (current !== "en") return;
        for (const m of mutations) {
          if (m.type === "attributes") {
            localizeAttribute(m.target, m.attributeName);
            continue;
          }
          m.addedNodes.forEach((node) => localizeElementTree(node));
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    } catch (e) {
      window.luxDebug?.("i18n.js:504", e);
    }
  }

  if (current === "en" && typeof document !== "undefined") {
    try {
      localizeElementTree(document.documentElement);
    } catch (e) {
      window.luxDebug?.("i18n.js:510", e);
    }
    ensureObserver();
  }

  window.LuxI18n = {
    t,
    setLocale,
    applyLuxI18n,
    localizeString,
    availableLocales: Object.keys(LOCALES),
    get locale() {
      return current;
    }
  };
})();
