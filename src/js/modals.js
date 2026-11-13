// 1:1 Lux Settings Modal & Command Palette Component (Türkçe Arayüz)

let currentSettingsTab = "general";

const SETTINGS_TABS_CONFIG = {
  general: {
    title: "Genel",
    desc: "Ajan yürütme, kuyruktaki mesaj iletimi ve izinleri yapılandırın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q82 0 155.5 35T760-708v-92h60v200H620v-60h102q-41-61-104-95.5T480-780q-125 0-212.5 87.5T180-480q0 125 87.5 212.5T480-180q111 0 193-70t97-176h62q-15 131-114.5 218.5T480-120Z"/></svg>`
  },
  application: {
    title: "Uygulama",
    desc: "Uygulama genel davranışlarını, çalışma alanlarını ve sistem tercihlerini yapılandırın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm0-460h640v-20H160v20Z"/></svg>`
  },
  appearance: {
    title: "Görünüm",
    desc: "Tema renklerini, koyu mod paletini, yazı tipini ve arayüz ölçeğini yapılandırın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm40-83q119-15 199.5-104.5T800-480q0-123-80.5-212.5T520-797v634Z"/></svg>`
  },
  permissions: {
    title: "İzinler",
    desc: "Yapay zeka modellerinin ve ajanların sistem, dosya, internet ve terminal erişim yetkilerini yapılandırın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-140-35-230-162.5T160-520v-240l320-120 320 120v240q0 149-90 276.5T480-80Zm0-84q104-33 172-132t68-224v-189l-240-90-240 90v189q0 125 68 224t172 132Zm0-316Z"/></svg>`
  },
  shortcuts: {
    title: "Klavye Kısayolları",
    desc: "Uygulama genelinde hızlı işlem ve navigasyon sağlayan tuş kombinasyonları.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm80-80h480v-60H240v60Zm-40-100h80v-60h-80v60Zm120 0h80v-60h-80v60Zm120 0h80v-60h-80v60Zm120 0h80v-60h-80v60ZM200-500h80v-60h-80v60Zm120 0h80v-60h-80v60Zm120 0h80v-60h-80v60Zm120 0h80v-60h-80v60Z"/></svg>`
  },
  otomasyonlar: {
    title: "Otomasyonlar",
    desc: "Zamanlanmış arka plan görevleri, periyodik kontroller ve otomatik iş akışları.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="m382-240-154-154 57-57 97 97 227-227 57 57-284 284Zm-182 80q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm0 0v-480 480Z"/></svg>`
  },
  ozellestirmeler: {
    title: "Özelleştirmeler",
    desc: "Ajan kuralları (.rules), beceriler (skills), MCP sunucuları ve yüklü eklentiler.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Z"/></svg>`
  },
  notifications: {
    title: "Bildirimler",
    desc: "Bildirim tercihlerinizi yönetin.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320-360Zm0 480q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z"/></svg>`
  },
  models: {
    title: "Modeller",
    desc: "Yapay zeka modellerini, API sağlayıcılarını ve özel token anahtarlarını yapılandırın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`
  },
  "project:LUX_ai": {
    title: "LUX_ai",
    isProject: true,
    desc: "Proje klasörlerini, çalışma alanını ve özel eklenti yetkilerini yönetin.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z"/></svg>`
  },
  show_all: {
    title: "Tüm Projeler",
    desc: "Tüm çalışma alanı projelerini listeleyin, klasör ekleyin veya arşivleyin.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>`
  },
  conversations: {
    title: "Sohbetler",
    desc: "Projeye dahil olmayan bağımsız sohbet geçmişlerini yönetin ve dışa aktarın.",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M240-400h320v-60H240v60Zm0-120h480v-60H240v60Zm0-120h480v-60H240v60ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Z"/></svg>`
  }
};

function setupModals() {
  const container = document.getElementById("modals-root");
  if (!container) return;

  container.innerHTML = `
    <!-- 1:1 Lux Settings Modal Backdrop -->
    <div id="settings-modal" class="lux-modal-backdrop">
      <div class="settings-dialog-container">
        
        <!-- Left Sidebar: Settings Navigation (Width 220px) -->
        <div class="w-[220px] shrink-0 h-full flex flex-col bg-sidebar border-r border-border select-none" data-testid="settings-sidebar">
          
          <div class="flex-1 flex flex-col gap-1 py-3 overflow-y-auto">
            <!-- Header -->
            <div class="px-4 pb-2">
              <h1 class="m-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">Ayarlar</h1>
            </div>

            <!-- Core Settings Section -->
            <div class="flex flex-col gap-0.5 px-2" id="settings-core-nav">
              <button class="settings-nav-btn active" data-tab="general">Genel</button>
              <button class="settings-nav-btn" data-tab="application">Uygulama</button>
              <button class="settings-nav-btn" data-tab="appearance">Görünüm</button>
              <button class="settings-nav-btn" data-tab="permissions">İzinler</button>
              <button class="settings-nav-btn" data-tab="notifications">Bildirimler</button>
              <button class="settings-nav-btn" data-tab="models">Modeller</button>
              <button class="settings-nav-btn" data-tab="otomasyonlar">Otomasyonlar</button>
              <button class="settings-nav-btn" data-tab="ozellestirmeler">Özelleştirmeler</button>
              <button class="settings-nav-btn" data-tab="shortcuts">Klavye Kısayolları</button>
            </div>

            <!-- Projects Section Header -->
            <div class="px-4 pt-4 pb-1">
              <h2 class="m-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">Projeler</h2>
            </div>

            <!-- Projects Navigation List (Dynamically synced with homepage projects) -->
            <div class="flex flex-col gap-0.5 px-2" id="settings-projects-nav">
            </div>

            <!-- Not in Project Section -->
            <div class="px-4 pt-4 pb-1">
              <h2 class="m-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">Projeye Dahil Olmayanlar</h2>
            </div>

            <!-- Not in Project Navigation List -->
            <div class="flex flex-col gap-0.5 px-2">
              <button class="settings-nav-btn" data-tab="conversations">Sohbetler</button>
            </div>
          </div>

        </div>

        <!-- Right Content Area (Active Tab Content) -->
        <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background relative" id="settings-content-wrapper">
          
          <!-- Top Tab Header with Close Button -->
          <div class="px-8 pt-6 pb-4 border-b border-border/40 flex items-start justify-between shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-semibold text-foreground m-0" id="settings-tab-title">Genel</h2>
                <button id="settings-tab-edit-btn" class="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer hidden" title="Projeyi Yeniden Adlandır">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                  </svg>
                </button>
              </div>
              <p class="text-xs text-muted-foreground mt-1 mb-0" id="settings-tab-desc">Ajan yürütme, kuyruktaki mesaj iletimi ve izinleri yapılandırın.</p>
            </div>

            <!-- Close 'X' Button -->
            <button class="agy-button h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" data-action="closeSettingsModal" aria-label="Ayarları Kapat" title="Kapat (Esc)">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
              </svg>
            </button>
          </div>

          <!-- Page Body: "sayfa içleri boş olsun ayrı tasarlayalım" -->
          <div class="flex-1 flex flex-col p-8 overflow-y-auto" id="settings-tab-body">
            <!-- Boş İçerik Alanı Placeholder'ı -->
            <div class="flex-1 w-full border border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center p-8 text-center bg-card/20 select-none">
              <div class="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center text-primary mb-3.5 shadow-sm" id="settings-tab-icon-box">
                ${SETTINGS_TABS_CONFIG.general.icon}
              </div>
              <h3 class="text-sm font-medium text-foreground mb-1.5" id="settings-tab-placeholder-title">Genel Sayfa Tasarımı</h3>
              <p class="text-xs text-muted-foreground max-w-md leading-relaxed">
                Bu sekmenin iç kontrolleri ve parametreleri ayrılmıştır. İstediğiniz özel ayar veya arayüz elemanlarını buraya ekleyebiliriz.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- Command Palette Backdrop -->
    <div id="palette-modal" class="lux-modal-backdrop">
      <div class="lux-modal max-w-xl" id="palette-dialog">
        <div class="p-3 border-b border-border flex items-center gap-2">
          <span class="text-muted-foreground">${ICONS.search}</span>
          <input type="text" id="palette-input" placeholder="Komut, proje, sohbet veya model arayın (örn. 'Terminal', 'IDE', 'Modeller')..." class="w-full bg-transparent text-sm text-foreground outline-none font-sans" />
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">ESC</span>
        </div>
        <div class="p-2 flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar" id="palette-results"></div>
      </div>
    </div>
  `;

  // Attach Settings Navigation Event Listeners for core items
  document.querySelectorAll("#settings-core-nav .settings-nav-btn, [data-tab='conversations']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) {
        switchSettingsTab(tabId);
      }
    });
  });

  // Backdrop click closes Settings / Palette
  document.getElementById("settings-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "settings-modal") window.closeSettingsModal();
  });
  document.getElementById("palette-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "palette-modal") window.closePalette();
  });

  setupCommandPaletteEvents();

  // Render Projects List in settings sidebar to match homepage projects
  renderSettingsProjectsNav();
}

let paletteSelectedIdx = 0;

function getPaletteEntries(query = "") {
  const q = (query || "").trim().toLowerCase();
  const state = window.appStore?.state || {};
  const items = [
    {
      title: "Yeni Sohbet Başlat",
      category: "Sohbet",
      icon: ICONS.plus,
      run: () => {
        window.appStore.createConversation("Yeni Sohbet");
        window.renderApp();
      }
    },
    {
      title: "Bölünmüş IDE Modunu Aç/Kapat",
      category: "Görünüm",
      icon: ICONS.ide,
      run: () => {
        window.appStore.toggleIdeSplit();
        window.renderApp();
      }
    },
    {
      title: "Entegre Terminali Aç",
      category: "Terminal",
      icon: ICONS.terminal,
      run: () => {
        window.openRightPanelTerminal?.();
      }
    },
    {
      title: "Sağ Paneli (Overview) Aç/Gizle",
      category: "Görünüm",
      icon: ICONS.extensions,
      run: () => {
        window.appStore.toggleRightPanel();
        window.renderApp();
      }
    },
    {
      title: "Kenar Çubuğunu Aç/Gizle",
      category: "Görünüm",
      icon: ICONS.sidebarLeft || ICONS.folder,
      run: () => {
        window.appStore.toggleSidebar();
        window.renderApp();
      }
    },
    {
      title: "Sesli Sohbet Modunu Başlat/Durdur",
      category: "Ses",
      icon: ICONS.mic || ICONS.plus,
      run: () => {
        window.toggleVoiceMode?.();
      }
    },
    {
      title: "Ayarlar: Modeller ve API Yönetimi",
      category: "Ayarlar",
      icon: ICONS.settings,
      run: () => {
        window.openSettingsModal("models");
      }
    },
    {
      title: "Ayarlar: İzinler ve Güvenlik",
      category: "Ayarlar",
      icon: ICONS.settings,
      run: () => {
        window.openSettingsModal("permissions");
      }
    },
    {
      title: `Ayarlar: Sesli Asistan Kütüphanesi (${window.luxVoiceLibrary?.catalog?.length || 28} Ses)`,
      category: "Ses",
      icon: ICONS.settings,
      run: () => {
        window.luxVoiceLibrary?.openModal?.();
      }
    }
  ];

  // Dynamic Projects & Conversations
  (state.projects || []).forEach((proj) => {
    items.push({
      title: `Projeye Geç: ${proj.name}`,
      category: "Proje",
      icon: ICONS.folder,
      run: () => {
        window.appStore.state.activeProjectId = proj.id;
        if (proj.conversations?.[0]) {
          window.appStore.selectConversation(proj.conversations[0].id);
        } else {
          window.appStore.saveState();
        }
        window.renderApp();
      }
    });
    (proj.conversations || []).forEach((conv) => {
      items.push({
        title: `${conv.title}`,
        category: `Sohbet · ${proj.name}`,
        icon: ICONS.plus,
        run: () => {
          window.appStore.selectConversation(conv.id);
          window.renderApp();
        }
      });
    });
  });

  // Dynamic Models
  (window.appStore?.getModels?.() || []).forEach((m) => {
    items.push({
      title: `Model Kullan: ${m.name} (${m.modelId})`,
      category: "Model",
      icon: ICONS.settings,
      run: () => {
        window.appStore.setModel(m.name);
        window.renderApp();
      }
    });
  });

  if (!q) return items.slice(0, 14);
  return items.filter((it) => it.title.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)).slice(0, 20);
}

function renderPaletteResults() {
  const input = document.getElementById("palette-input");
  const container = document.getElementById("palette-results");
  if (!container) return;

  const entries = getPaletteEntries(input?.value || "");
  if (paletteSelectedIdx >= entries.length) paletteSelectedIdx = 0;

  if (entries.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-muted-foreground italic">Eşleşen komut veya kayıt bulunamadı.</div>`;
    return;
  }

  container.innerHTML = entries
    .map(
      (item, idx) => `
    <div class="palette-item flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${idx === paletteSelectedIdx ? "bg-primary/20 text-foreground border border-primary/40" : "hover:bg-secondary text-secondary-foreground"}" data-palette-idx="${idx}">
      <div class="flex items-center gap-2 min-w-0 truncate">
        <span class="shrink-0 opacity-80">${item.icon || ""}</span>
        <span class="truncate">${escapeHtml(item.title)}</span>
      </div>
      <span class="text-[10px] text-muted-foreground shrink-0 ml-2">${escapeHtml(item.category)}</span>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".palette-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-palette-idx"));
      const picked = entries[idx];
      window.closePalette();
      if (picked?.run) picked.run();
    });
  });
}

function setupCommandPaletteEvents() {
  const input = document.getElementById("palette-input");
  if (!input) return;

  input.addEventListener("input", () => {
    paletteSelectedIdx = 0;
    renderPaletteResults();
  });

  input.addEventListener("keydown", (e) => {
    const entries = getPaletteEntries(input.value || "");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (entries.length > 0) {
        paletteSelectedIdx = (paletteSelectedIdx + 1) % entries.length;
        renderPaletteResults();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (entries.length > 0) {
        paletteSelectedIdx = (paletteSelectedIdx - 1 + entries.length) % entries.length;
        renderPaletteResults();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = entries[paletteSelectedIdx] || entries[0];
      if (picked?.run) {
        window.closePalette();
        picked.run();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      window.closePalette();
    }
  });
}

// Dynamically render the projects in settings sidebar matching homepage projects
function renderSettingsProjectsNav() {
  const navContainer = document.getElementById("settings-projects-nav");
  if (!navContainer) return;

  const projects = window.appStore?.state?.projects || [];

  navContainer.innerHTML = `
    ${projects
      .map((p) => {
        const convCount = (p.conversations || []).length;
        return `
        <button class="settings-nav-btn truncate text-left flex items-center justify-between group py-1.5 px-3 rounded-lg text-xs" data-tab="project:${p.id}" data-project-id="${p.id}" title="${escapeHtml(p.name)}">
          <span class="truncate">${escapeHtml(p.name)}</span>
          ${convCount > 0 ? `<span class="text-[10px] text-muted-foreground/60 font-mono shrink-0">${convCount}</span>` : ""}
        </button>
      `;
      })
      .join("")}
    <button class="settings-nav-btn text-muted-foreground text-left py-1.5 px-3 rounded-lg text-xs hover:text-foreground mt-0.5" data-tab="show_all">
      Tümünü Göster
    </button>
  `;

  // Attach event listeners to project buttons
  navContainer.querySelectorAll(".settings-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) switchSettingsTab(tab);
    });
  });

  // Highlight active tab
  navContainer.querySelectorAll(".settings-nav-btn").forEach((btn) => {
    if (btn.getAttribute("data-tab") === currentSettingsTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function switchSettingsTab(tabId) {
  currentSettingsTab = tabId;

  // Update active button style across all nav buttons
  document.querySelectorAll(".settings-nav-btn").forEach((btn) => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  let config = SETTINGS_TABS_CONFIG[tabId];
  let isProject = false;
  let currentProject = null;

  if (tabId.startsWith("project:")) {
    const projId = tabId.replace("project:", "");
    const projects = window.appStore?.state?.projects || [];
    currentProject = projects.find((p) => p.id === projId || p.name === projId);
    if (currentProject) {
      isProject = true;
      config = {
        title: currentProject.name,
        desc: `Çalışma alanı klasörü, dahili sohbetler (${(currentProject.conversations || []).length}) ve proje ayarları.`,
        isProject: true,
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z"/></svg>`
      };
    }
  }

  if (!config) {
    config = {
      title: tabId,
      desc: "Bu bölüm şu anda kullanılamıyor.",
      icon: ICONS.gear
    };
  }

  const titleEl = document.getElementById("settings-tab-title");
  const descEl = document.getElementById("settings-tab-desc");
  const editBtn = document.getElementById("settings-tab-edit-btn");
  const tabBody = document.getElementById("settings-tab-body");

  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc;
  if (editBtn) {
    if (isProject) {
      editBtn.classList.remove("hidden");
      editBtn.onclick = () => {
        const input = document.getElementById("prj-rename-input");
        if (input) {
          input.focus();
          input.select();
        }
      };
    } else {
      editBtn.classList.add("hidden");
    }
  }

  if (tabBody) {
    tabBody.scrollTop = 0;
    if (tabId === "models") {
      renderModelsSettingsView(tabBody);
    } else if (tabId === "permissions") {
      renderPermissionsSettingsView(tabBody);
    } else if (tabId === "notifications") {
      renderNotificationsSettingsView(tabBody);
    } else if (tabId === "general") {
      renderGeneralSettingsView(tabBody);
    } else if (tabId === "application") {
      renderApplicationSettingsView(tabBody);
    } else if (tabId === "appearance") {
      renderAppearanceSettingsView(tabBody);
    } else if (tabId === "otomasyonlar") {
      renderAutomationsSettingsView(tabBody);
    } else if (tabId === "ozellestirmeler") {
      renderCustomizationsSettingsView(tabBody);
    } else if (tabId === "shortcuts") {
      renderShortcutsSettingsView(tabBody);
    } else if (tabId === "show_all") {
      renderAllProjectsView(tabBody);
    } else if (tabId === "conversations") {
      renderConversationsSettingsView(tabBody);
    } else if (isProject && currentProject) {
      renderProjectSettingsView(tabBody, currentProject);
    } else {
      renderPlaceholderTab(tabBody, config);
    }
  }
}

// 1:1 Project Settings View Component
function renderProjectSettingsView(container, project) {
  const convCount = (project.conversations || []).length;
  const isGlobalActive = project.id === window.appStore?.state?.activeProjectId;

  container.innerHTML = `
    <div class="flex flex-col gap-5 w-full max-w-3xl mx-auto pb-6">
      
      <!-- 1. Proje Genel Bilgileri Kartı -->
      <div class="bg-card/40 border border-border/80 rounded-xl p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center text-primary border border-border/60">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-foreground m-0" id="prj-display-name">${escapeHtml(project.name)}</h3>
              <span class="text-[11px] text-muted-foreground font-mono">ID: ${escapeHtml(project.id)}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${
              isGlobalActive
                ? `
              <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                ● Aktif Çalışma Alanı
              </span>
            `
                : `
              <span class="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/60 font-medium">
                Kayıtlı Proje
              </span>
            `
            }
          </div>
        </div>

        <!-- Ad Değiştirme Alanı -->
        <div class="flex flex-col gap-1.5 pt-3 border-t border-border/40">
          <label class="text-xs font-medium text-foreground">Proje Adı</label>
          <div class="flex items-center gap-2">
            <input type="text" id="prj-rename-input" value="${escapeHtml(project.name)}" class="model-input-field flex-1" />
            <button type="button" id="btn-save-project-name" class="agy-button px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors cursor-pointer shrink-0">
              Kaydet
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Çalışma Alanı Hızlı Eylemleri -->
      <div class="bg-card/40 border border-border/80 rounded-xl p-5 flex flex-col gap-3">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider m-0">Çalışma Alanı Eylemleri</h4>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button type="button" id="btn-open-in-main" class="agy-button p-3 rounded-xl border border-border/70 hover:bg-secondary/70 flex flex-col gap-2 text-left transition-colors cursor-pointer">
            <div class="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </div>
            <div>
              <div class="text-xs font-medium text-foreground">Ana Ekranda Aç</div>
              <div class="text-[11px] text-muted-foreground truncate">Bu projeye geç</div>
            </div>
          </button>

          <button type="button" id="btn-open-explorer" class="agy-button p-3 rounded-xl border border-border/70 hover:bg-secondary/70 flex flex-col gap-2 text-left transition-colors cursor-pointer">
            <div class="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <div class="text-xs font-medium text-foreground">Dosya Gezgini</div>
              <div class="text-[11px] text-muted-foreground truncate">Dizini göster</div>
            </div>
          </button>

          <button type="button" id="btn-add-chat-in-proj" class="agy-button p-3 rounded-xl border border-border/70 hover:bg-secondary/70 flex flex-col gap-2 text-left transition-colors cursor-pointer">
            <div class="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div>
              <div class="text-xs font-medium text-foreground">Yeni Sohbet</div>
              <div class="text-[11px] text-muted-foreground truncate">Konuşma ekle</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 3. Proje Sohbetleri Listesi -->
      <div class="bg-card/40 border border-border/80 rounded-xl p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider m-0">Projedeki Sohbetler (${convCount})</h4>
          <span class="text-xs text-muted-foreground">Tıklayarak sohbete geçebilirsiniz</span>
        </div>
        <div class="flex flex-col gap-1.5 pt-1">
          ${
            !project.conversations || project.conversations.length === 0
              ? `
            <div class="p-4 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-lg">
              Bu projede henüz bir sohbet başlatılmadı.
            </div>
          `
              : project.conversations
                  .map(
                    (c) => `
            <div class="p-2.5 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/50 flex items-center justify-between cursor-pointer transition-colors prj-conv-row" data-conv-id="${escapeHtml(c.id)}">
              <div class="flex items-center gap-2 truncate">
                <span class="text-muted-foreground text-xs">💬</span>
                <span class="text-xs font-medium text-foreground truncate">${escapeHtml(c.title)}</span>
              </div>
              <span class="text-[11px] text-muted-foreground shrink-0">${escapeHtml(c.timestamp || "Şimdi")}</span>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>

      <!-- 4. Tehlikeli Bölge (Danger Zone) -->
      <div class="bg-red-500/5 border border-red-500/20 rounded-xl p-5 flex flex-col gap-3">
        <h4 class="text-xs font-semibold text-red-400 uppercase tracking-wider m-0">Tehlikeli Bölge</h4>
        <div class="flex items-center justify-between pt-1">
          <div>
            <div class="text-xs font-medium text-foreground">Bu Projeyi Sil</div>
            <div class="text-[11px] text-muted-foreground">Projeyi ve içerisindeki ${convCount} sohbeti kalıcı olarak siler.</div>
          </div>
          <button type="button" id="btn-delete-this-project" class="agy-button px-3.5 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-medium transition-colors cursor-pointer shrink-0">
            Projeyi Sil
          </button>
        </div>
      </div>

    </div>
  `;

  // Save Name
  const btnSaveName = container.querySelector("#btn-save-project-name");
  const inputName = container.querySelector("#prj-rename-input");
  btnSaveName?.addEventListener("click", () => {
    const val = inputName?.value?.trim();
    if (val) {
      project.name = val;
      window.appStore.saveState();
      window.renderApp();
      renderSettingsProjectsNav();
      switchSettingsTab(`project:${project.id}`);
    }
  });

  // Open in Main
  container.querySelector("#btn-open-in-main")?.addEventListener("click", () => {
    window.appStore.state.activeProjectId = project.id;
    if (project.conversations && project.conversations.length > 0) {
      window.appStore.state.activeConversationId = project.conversations[0].id;
    }
    window.appStore.saveState();
    window.closeSettingsModal();
    window.renderApp();
  });

  // Open Explorer
  container.querySelector("#btn-open-explorer")?.addEventListener("click", async () => {
    if (window.luxAPI?.openDirectory) {
      await window.luxAPI.openDirectory(project.path || "");
    }
  });

  // Add Chat in Project
  container.querySelector("#btn-add-chat-in-proj")?.addEventListener("click", () => {
    window.appStore.createConversationInProject(project.id, "Yeni Sohbet");
    window.closeSettingsModal();
    window.renderApp();
  });

  // Click on existing conversation row
  container.querySelectorAll(".prj-conv-row").forEach((row) => {
    row.addEventListener("click", () => {
      const convId = row.getAttribute("data-conv-id");
      if (convId) window.appStore.selectConversation(convId);
      window.closeSettingsModal();
      window.renderApp();
    });
  });

  // Delete this project (inline two-click confirm)
  container.querySelector("#btn-delete-this-project")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!btn.dataset.armed) {
      btn.dataset.armed = "1";
      btn.textContent = "Silmeyi Onayla ✕";
      btn.classList.add("bg-red-500", "text-white");
      setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed) {
          delete btn.dataset.armed;
          btn.textContent = "Projeyi Sil";
          btn.classList.remove("bg-red-500", "text-white");
        }
      }, 4000);
      return;
    }
    window.appStore.deleteProject(project.id);
    window.renderApp();
    renderSettingsProjectsNav();
    switchSettingsTab("show_all");
  });
}

// 1:1 All Projects ("Tümünü Göster") Grid View Component
function renderAllProjectsView(container) {
  const projects = window.appStore?.state?.projects || [];

  container.innerHTML = `
    <div class="flex flex-col gap-5 w-full max-w-4xl mx-auto pb-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-foreground m-0">Tüm Projeler (${projects.length})</h3>
          <span class="text-xs text-muted-foreground">Masaüstü çalışma alanınızdaki tüm projeleri buradan yönetebilirsiniz.</span>
        </div>
        <button type="button" id="btn-modal-add-project" class="agy-button px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Yeni Proje</span>
        </button>
      </div>

      <!-- Inline Add Project Bar -->
      <div id="modal-inline-add-project-bar" class="hidden p-3 rounded-xl border border-primary/40 bg-card/70 flex items-center gap-2">
        <input id="modal-inline-project-input" type="text" placeholder="Yeni proje adını girin (örn. Analytics Engine)..." class="model-input-field flex-1 text-xs" />
        <button type="button" id="btn-modal-inline-save-project" class="agy-button px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer shrink-0">Oluştur</button>
        <button type="button" id="btn-modal-inline-cancel-project" class="agy-button px-2.5 py-1.5 rounded-lg border border-border/70 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0">İptal</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${projects
          .map((p) => {
            const isAct = p.id === window.appStore?.state?.activeProjectId;
            return `
            <div class="p-4 rounded-xl border ${isAct ? "border-primary/50 bg-secondary/30" : "border-border/80 bg-card/40"} hover:border-border transition-colors flex flex-col justify-between gap-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5 truncate">
                  <div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-primary shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-foreground truncate">${escapeHtml(p.name)}</div>
                    <div class="text-[11px] text-muted-foreground">${(p.conversations || []).length} Sohbet</div>
                  </div>
                </div>
                ${
                  isAct
                    ? `
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium shrink-0">Aktif</span>
                `
                    : ""
                }
              </div>

              <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-border/30">
                <button type="button" class="btn-all-open text-xs px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors cursor-pointer" data-id="${escapeHtml(p.id)}">
                  Aç
                </button>
                <button type="button" class="btn-all-settings text-xs px-2.5 py-1 rounded-md border border-border/70 hover:bg-secondary text-secondary-foreground hover:text-foreground transition-colors cursor-pointer" data-id="${escapeHtml(p.id)}">
                  Ayarlar
                </button>
                <button type="button" class="btn-all-delete text-xs px-2 py-1 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1" data-id="${escapeHtml(p.id)}" title="Projeyi Sil">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                </button>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;

  // Inline Add Project Flow
  const inlineBar = container.querySelector("#modal-inline-add-project-bar");
  const inlineInput = container.querySelector("#modal-inline-project-input");
  const doCreateProject = () => {
    const name = inlineInput?.value?.trim();
    if (name) {
      window.appStore.addProject(name);
      window.renderApp();
      renderSettingsProjectsNav();
      renderAllProjectsView(container);
    }
  };

  container.querySelector("#btn-modal-add-project")?.addEventListener("click", () => {
    inlineBar?.classList.toggle("hidden");
    if (!inlineBar?.classList.contains("hidden")) {
      setTimeout(() => inlineInput?.focus(), 20);
    }
  });
  container.querySelector("#btn-modal-inline-save-project")?.addEventListener("click", doCreateProject);
  container.querySelector("#btn-modal-inline-cancel-project")?.addEventListener("click", () => {
    inlineBar?.classList.add("hidden");
  });
  inlineInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doCreateProject();
    } else if (e.key === "Escape") {
      e.preventDefault();
      inlineBar?.classList.add("hidden");
    }
  });

  // Action buttons
  container.querySelectorAll(".btn-all-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      window.appStore.state.activeProjectId = id;
      const proj = window.appStore.state.projects.find((p) => p.id === id);
      if (proj && proj.conversations && proj.conversations.length > 0) {
        window.appStore.selectConversation(proj.conversations[0].id);
      } else {
        window.appStore.saveState();
      }
      window.closeSettingsModal();
      window.renderApp();
    });
  });

  container.querySelectorAll(".btn-all-settings").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      switchSettingsTab(`project:${id}`);
    });
  });

  container.querySelectorAll(".btn-all-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const el = e.currentTarget;
      const id = el.getAttribute("data-id");
      if (!el.dataset.armed) {
        el.dataset.armed = "1";
        el.innerHTML = `<span class="text-[10px] font-semibold text-red-400">Onayla?</span>`;
        setTimeout(() => {
          if (el.isConnected && el.dataset.armed) {
            renderAllProjectsView(container);
          }
        }, 3500);
        return;
      }
      window.appStore.deleteProject(id);
      window.renderApp();
      renderSettingsProjectsNav();
      renderAllProjectsView(container);
    });
  });
}

// 1:1 Lux Permissions & Security Settings Component
function renderPermissionsSettingsView(container) {
  const perms = window.appStore?.getPermissions() || {};
  const isUnlimited = window.appStore?.isUnlimitedMode?.() ?? false;

  const PERMISSION_GROUPS = [
    {
      id: "system",
      title: "Sistem, Terminal ve PC Kontrolü",
      desc: "Bilgisayar kabuğu (PowerShell), uygulama başlatma, pencere/fare/klavye otomasyonu ve ekran yakalama yetkileri",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
      items: [
        {
          key: "pc_control",
          title: "Tam Bilgisayar Kontrolü ve Ekran Yakalama",
          desc: "Uygulama ve web sitesi açma, pencere odaklama, ekran görüntüsü alma, pano, klavye/fare otomasyonu ve ses kontrolü yetkisi.",
          badge: "Sınırsız",
          badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
        },
        {
          key: "terminal_execute",
          title: "Terminal Komutları Çalıştırma",
          desc: "Ajanın sistem kabuğunda terminal komutları (derleme, kurulum, git, PowerShell, Python) yürütmesine izin verir.",
          badge: "Önemli",
          badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="8" y2="8"/><line x1="10" y1="8" x2="14" y2="8"/></svg>`
        },
        {
          key: "auto_approve_commands",
          title: "Otomatik Komut Onayı (Auto-Approve)",
          desc: "Ajanın tüm araçları ve sistem komutlarını tek tek onay beklemeden Lux hızında otonom çalıştırmasını sağlar.",
          badge: "Otonom",
          badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
        },
        {
          key: "system_env_read",
          title: "Sistem ve Ortam Değişkenleri Erişimi",
          desc: "Sistem bilgilerini, Masaüstü/Belgeler yollarını ve yüklü araç konumlarını inceleme yetkisi.",
          badge: "Okuma",
          badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
        }
      ]
    },
    {
      id: "filesystem",
      title: "Dosya Sistemi, Masaüstü ve Kod Erişimi",
      desc: "Çalışma alanı ve Masaüstü klasörlerini okuma, yeni proje/web tasarımı üretme, taşıma ve silme yetkileri",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
      items: [
        {
          key: "file_read",
          title: "Dosya Okuma ve Tüm Proje İnceleme",
          desc: "Çalışma alanındaki, Masaüstündeki ve bağlı klasörlerdeki dosyaları okuma ve listeleme yetkisi.",
          badge: "Temel",
          badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
        },
        {
          key: "file_write",
          title: "Dosya & Masaüstü Klasörü Oluşturma",
          desc: "Masaüstüne veya çalışma alanına yeni klasörler, web projeleri ve kod dosyaları üretme ve güncelleme yetkisi.",
          badge: "Yazma",
          badgeClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
        },
        {
          key: "file_delete",
          title: "Dosya ve Klasör Silme / Taşıma Yetkisi",
          desc: "Ajanın proje dizinlerinde veya Masaüstünde gereksiz dosya/klasörleri silebilmesi ve yeniden düzenleyebilmesi.",
          badge: "Tam Kontrol",
          badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
        },
        {
          key: "env_secrets_protection",
          title: "Hassas Dosya Koruması (Açıkken .env/Anahtarları Engeller)",
          desc: "Varsayılan olarak AÇIKTIR: .env, *.pem, id_rsa ve secrets.json gibi dosyalar ajan tarafından okunamaz. Kapatmanız önerilmez.",
          badge: "Önerilen",
          badgeClass: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
        }
      ]
    },
    {
      id: "network",
      title: "İnternet Araştırma, Görsel ve Ağ Erişimi",
      desc: "Canlı web araması, web sayfası okuma, internetten görsel bulup getirme ve AI görsel tasarımı yetkileri",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      items: [
        {
          key: "web_search",
          title: "Canlı Web Araması ve Sayfa Okuma",
          desc: "İnternetten hava durumu, güncel haber, ürün, dokümantasyon ve her türlü bilgiyi canlı çekip özetleme yetkisi.",
          badge: "Canlı Web",
          badgeClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
        },
        {
          key: "image_generation",
          title: "Görsel Arama, İndirme ve Tasarım Üretimi",
          desc: "İnternetten marka/model araç ve fotoğraf bulup getirme, sıfırdan AI görsel veya stüdyo tasarımı çizme yetkisi.",
          badge: "Görsel Stüdyo",
          badgeClass: "text-pink-400 bg-pink-500/10 border-pink-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
        },
        {
          key: "network_internet",
          title: "İnternet ve Dış Web API Erişimi",
          desc: "Dış REST API servisleri, paket yöneticileri ve çevrimiçi kaynaklarla serbest iletişim izni.",
          badge: "Web",
          badgeClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`
        },
        {
          key: "network_localhost",
          title: "Yerel Ağ ve Servis Erişimi (Localhost)",
          desc: "Yerel portlarda çalışan AI sağlayıcılarına (Ollama:11434, 9Router:20128) ve yerel web sunucularına bağlanma yetkisi.",
          badge: "Yerel",
          badgeClass: "text-purple-400 bg-purple-500/10 border-purple-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`
        }
      ]
    },
    {
      id: "agent",
      title: "Ajan ve Tarayıcı Otomasyon Yetkileri",
      desc: "Arka plan işlemleri, alt ajan delegasyonu ve otonom tarayıcı önizleme kontrolleri",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
      items: [
        {
          key: "agent_background_tasks",
          title: "Arka Plan Görevleri (Background Tasks)",
          desc: "Ajanın dev sunucuları, derleme süreçleri ve zamanlanmış otomasyonları arka planda canlı tutmasına izin verir.",
          badge: "Asenkron",
          badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
        },
        {
          key: "agent_subagents",
          title: "Alt Ajan (Subagent) Yönetimi",
          desc: "Büyük ve karmaşık görevleri parçalara bölerek araştırmacı veya kod üretici akışları koordine etme yetkisi.",
          badge: "Çoklu Ajan",
          badgeClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
        },
        {
          key: "browser_automation",
          title: "Tarayıcı ve Web Önizleme Otomasyonu",
          desc: "Oluşturulan web sitelerini veya web sayfalarını tarayıcıda / bölünmüş Webview içinde açma ve denetleme yetkisi.",
          badge: "Görsel",
          badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
        }
      ]
    }
  ];

  // Calculate active capability permissions count (excluding optional restriction switch)
  const capabilityKeys = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)).filter((k) => k !== "env_secrets_protection");
  const activeCount = capabilityKeys.filter((k) => Boolean(perms[k])).length;

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-8 select-none">

      <!-- Master Lux Unlimited Mode Card -->
      <div class="rounded-2xl p-4 border ${isUnlimited ? "bg-emerald-500/10 border-emerald-500/35" : "bg-card/40 border-border/70"} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isUnlimited ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-primary/10 text-primary border-primary/20"} border flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-semibold text-foreground m-0">Lux Sınırsız Yetki Modu</h3>
              <span id="perm-active-badge" class="text-xs px-2.5 py-0.5 rounded-full ${isUnlimited ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-blue-500/15 text-blue-400 border-blue-500/30"} border font-medium">
                ${isUnlimited ? "⚡ Sınırsız Aktif" : `${activeCount} / ${capabilityKeys.length} İzin Aktif`}
              </span>
            </div>
            <p class="text-xs text-muted-foreground m-0 mt-0.5">
              İnternet araması, görsel bulma/tasarlama, Masaüstü proje kurulumu, PC kontrolü ve tam dosya erişimi varsayılan olarak açıktır.
            </p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button type="button" id="btn-perm-enable-all" class="agy-button px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs text-emerald-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Sınırsız Yetki (Tümü)</span>
          </button>
          <button type="button" id="btn-perm-reset" class="agy-button px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Varsayılana Sıfırla</span>
          </button>
        </div>
      </div>

      <!-- Toast / Status message (Hidden by default) -->
      <div id="perm-status-msg" class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-lg hidden flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span id="perm-status-text">İzin ayarı başarıyla kaydedildi.</span>
      </div>

      <!-- Categorized Permission Groups -->
      <div class="flex flex-col gap-6" id="perm-groups-container">
        ${PERMISSION_GROUPS.map(
          (group) => `
          <div class="bg-card/30 border border-border/80 rounded-xl p-5 flex flex-col gap-3.5">
            
            <!-- Category Title & Header -->
            <div class="flex items-center justify-between pb-2 border-b border-border/40">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
                  ${group.icon}
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-foreground uppercase tracking-wider m-0">${escapeHtml(group.title)}</h4>
                  <p class="text-[11px] text-muted-foreground m-0">${escapeHtml(group.desc)}</p>
                </div>
              </div>
            </div>

            <!-- List of Horizontal Permission Rows -->
            <div class="flex flex-col gap-2 pt-1">
              ${group.items
                .map((item) => {
                  const isChecked = Boolean(perms[item.key]);
                  return `
                  <div class="perm-row flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-background/50 hover:bg-card/70 hover:border-border transition-colors group">
                    <div class="flex items-start gap-3.5 pr-4 flex-1 min-w-0">
                      <div class="w-8 h-8 rounded-lg bg-secondary/80 border border-border/40 text-muted-foreground group-hover:text-foreground flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                        ${item.icon}
                      </div>
                      <div class="flex flex-col gap-1 min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-xs font-medium text-foreground tracking-tight">${escapeHtml(item.title)}</span>
                          ${
                            item.badge
                              ? `
                            <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium border ${item.badgeClass}">
                              ${escapeHtml(item.badge)}
                            </span>
                          `
                              : ""
                          }
                        </div>
                        <p class="text-[11px] text-muted-foreground leading-relaxed m-0">
                          ${escapeHtml(item.desc)}
                        </p>
                      </div>
                    </div>
                    
                    <!-- Toggle Switch -->
                    <label class="lux-toggle shrink-0" title="${escapeHtml(item.title)} iznini değiştir">
                      <input type="checkbox" class="perm-checkbox" data-perm-key="${item.key}" ${isChecked ? "checked" : ""} />
                      <span class="slider"></span>
                    </label>
                  </div>
                `;
                })
                .join("")}
            </div>

          </div>
        `
        ).join("")}
      </div>

      <!-- Key Vault (Şifreli Anahtar Kasası) -->
      <div class="bg-card/30 border border-border/80 rounded-xl p-5 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3 flex-wrap pb-2 border-b border-border/40">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h4 class="text-xs font-semibold text-foreground uppercase tracking-wider m-0">${(window.LuxI18n && LuxI18n.t("vault.title")) || "Anahtar Kasası (Şifreli)"}</h4>
              <p class="text-[11px] text-muted-foreground m-0">${(window.LuxI18n && LuxI18n.t("vault.subtitle")) || "Gemini / OpenRouter / OpenAI / Anthropic API anahtarları yalnızca bu cihazda şifreli saklanır; arayüze asla düz metin dönülmez."}</p>
            </div>
          </div>
          <button type="button" id="btn-vault-rotate" class="agy-button px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0" title="Tüm kasayı güncel şema/anahtarla yeniden şifreler; çözülemeyen kayıt varsa kasa değiştirilmez">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>${(window.LuxI18n && LuxI18n.t("vault.rotate")) || "Kasayı Yeniden Şifrele"}</span>
          </button>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-[11px] text-muted-foreground m-0" id="vault-status-text">${(window.LuxI18n && LuxI18n.t("vault.loading")) || "Kasa durumu yükleniyor…"}</p>
          <p class="text-[10px] text-muted-foreground/70 m-0 break-words" id="vault-detail-text"></p>
        </div>
      </div>

    </div>
  `;

  // Attach Toggle Change Handlers
  container.querySelectorAll(".perm-checkbox").forEach((input) => {
    input.addEventListener("change", (e) => {
      const key = input.getAttribute("data-perm-key");
      const isChecked = input.checked;
      window.appStore.setPermission(key, isChecked);

      // Update active count badge
      const currentPerms = window.appStore.getPermissions();
      const newActive = capabilityKeys.filter((k) => Boolean(currentPerms[k])).length;
      const nowUnlimited = window.appStore?.isUnlimitedMode?.() ?? false;
      const badge = container.querySelector("#perm-active-badge");
      if (badge) {
        badge.textContent = nowUnlimited ? "⚡ Sınırsız Aktif" : `${newActive} / ${capabilityKeys.length} İzin Aktif`;
      }

      // Show temporary status notice
      const statusBox = container.querySelector("#perm-status-msg");
      const statusText = container.querySelector("#perm-status-text");
      if (statusBox && statusText) {
        const itemInfo = PERMISSION_GROUPS.flatMap((g) => g.items).find((i) => i.key === key);
        statusText.textContent = `"${itemInfo?.title || key}" izni ${isChecked ? "etkinleştirildi" : "kapatıldı"}.`;
        statusBox.classList.remove("hidden");
        clearTimeout(statusBox._timer);
        statusBox._timer = setTimeout(() => {
          statusBox.classList.add("hidden");
        }, 2200);
      }
    });
  });

  // Enable All
  container.querySelector("#btn-perm-enable-all")?.addEventListener("click", () => {
    window.appStore.setAllPermissions(true);
    renderPermissionsSettingsView(container);
  });

  // Reset to Defaults
  container.querySelector("#btn-perm-reset")?.addEventListener("click", () => {
    window.appStore.resetPermissions();
    renderPermissionsSettingsView(container);
  });

  // --- Key Vault: durum satırı + yeniden şifreleme ---
  const vi18n = (key, params) => (window.LuxI18n && LuxI18n.t(key, params)) || null;
  const vaultStatusText = container.querySelector("#vault-status-text");
  const vaultDetailText = container.querySelector("#vault-detail-text");
  const vaultRotateBtn = container.querySelector("#btn-vault-rotate");
  const schemeLabel = (scheme) =>
    scheme === "safeStorage"
      ? vi18n("vault.schemeSafeStorage") || "İşletim sistemi anahtar zinciri (safeStorage)"
      : vi18n("vault.schemeAesGcm") || "AES-256-GCM (dosya tabanlı, makineye özgü)";
  const fmtDate = (iso) => {
    try {
      return iso ? new Date(iso).toLocaleString("tr-TR") : null;
    } catch (_) {
      return iso;
    }
  };
  const showVaultToast = (msg) => {
    const statusBox = container.querySelector("#perm-status-msg");
    const statusText = container.querySelector("#perm-status-text");
    if (statusBox && statusText) {
      statusText.textContent = msg;
      statusBox.classList.remove("hidden");
      clearTimeout(statusBox._timer);
      statusBox._timer = setTimeout(() => statusBox.classList.add("hidden"), 3000);
    }
  };
  const loadVaultStatus = async () => {
    if (!vaultStatusText) return;
    try {
      const res = await window.luxAPI?.secrets?.status?.();
      if (!res?.success) {
        vaultStatusText.textContent = `Kasa durumu alınamadı: ${res?.error || "bilinmeyen hata"}`;
        return;
      }
      const migration = res.needsMigration
        ? ` · v${res.vaultVersion} → güncel şemaya göç bekliyor (Kasayı Yeniden Şifrele)`
        : " · şema güncel";
      vaultStatusText.textContent = `Şema v${res.vaultVersion}${migration} · ${res.count} kayıtlı anahtar · ${schemeLabel(res.scheme)}`;
      const created = fmtDate(res.createdAt);
      const rotated = fmtDate(res.rotatedAt);
      const parts = [];
      if (created) parts.push(`Oluşturuldu: ${created}`);
      if (rotated) parts.push(`Son yeniden şifreleme: ${rotated}`);
      if (Array.isArray(res.ids) && res.ids.length) parts.push(`Kayıtlar: ${res.ids.join(", ")}`);
      if (vaultDetailText) vaultDetailText.textContent = parts.join(" · ");
    } catch (e) {
      vaultStatusText.textContent = `Kasa durumu alınamadı: ${e?.message || e}`;
    }
  };
  vaultRotateBtn?.addEventListener("click", async () => {
    if (!vaultRotateBtn) return;
    const prevLabel = vaultRotateBtn.innerHTML;
    vaultRotateBtn.disabled = true;
    vaultRotateBtn.innerHTML = "<span>" + (vi18n("vault.rotating") || "Yeniden şifreleniyor…") + "</span>";
    try {
      const res = await window.luxAPI?.secrets?.rotate?.();
      if (res?.success) {
        showVaultToast(vi18n("vault.rotateDone", { count: res.rotated }) || `Kasa yeniden şifrelendi (${res.rotated} anahtar).`);
      } else if (vaultDetailText) {
        vaultDetailText.textContent = `HATA: ${res?.error || "Kasa yeniden şifrelenemedi."}`;
      }
      await loadVaultStatus();
    } catch (e) {
      if (vaultDetailText) vaultDetailText.textContent = `HATA: ${e?.message || e}`;
    } finally {
      vaultRotateBtn.disabled = false;
      vaultRotateBtn.innerHTML = prevLabel;
    }
  });
  loadVaultStatus();
}

// 1:1 Lux Notifications & Sound Settings Component
function renderNotificationsSettingsView(container) {
  const notifs = window.appStore?.getNotifications() || {
    agentNotifications: true,
    agentSounds: true,
    soundVolume: 100
  };
  const volume = typeof notifs.soundVolume === "number" ? notifs.soundVolume : 100;

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      
      <!-- General Section -->
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Genel</h3>
        
        <!-- General Card -->
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex items-center justify-between hover:border-border transition-colors">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Ajan Bildirimlerini Etkinleştir</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              İşlem yapmanız gerektiğinde veya ajan tamamlandığında sistem bildirimlerini göster.
            </p>
          </div>
          <label class="lux-toggle shrink-0" title="Ajan bildirimlerini aç / kapat">
            <input type="checkbox" id="notif-agent-toggle" ${notifs.agentNotifications ? "checked" : ""} />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <!-- Sound Section -->
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Ses</h3>
        
        <!-- Sound Card (Multi-Row Container matching 1:1 Lux) -->
        <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors">
          
          <!-- Row 1: Enable Sounds for Agent -->
          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Ajan Seslerini Etkinleştir</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                İşlem yapmanız gerektiğinde veya ajan tamamlandığında ses çal.
              </p>
            </div>
            <label class="lux-toggle shrink-0" title="Ajan seslerini aç / kapat">
              <input type="checkbox" id="notif-sound-toggle" ${notifs.agentSounds ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>

          <!-- Divider -->
          <div class="border-t border-border/60"></div>

          <!-- Row 2: Volume -->
          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Ses Seviyesi</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Ajan bildirim seslerinin düzeyini ayarlayın.
              </p>
            </div>
            
            <div class="flex items-center gap-4 shrink-0">
              <!-- Test Chime Speaker Button -->
              <button type="button" id="btn-test-chime" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors ${!notifs.agentSounds ? "opacity-40 pointer-events-none" : ""}" title="Sesi Çal ve Test Et">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              </button>

              <!-- Range slider with dynamic fill -->
              <input type="range" id="notif-volume-slider" min="0" max="100" value="${volume}" style="background: linear-gradient(to right, ${notifs.agentSounds ? "#2F71E3" : "#4b5563"} 0%, ${notifs.agentSounds ? "#2F71E3" : "#4b5563"} ${volume}%, #23242c ${volume}%, #23242c 100%);" class="lux-range-slider" ${!notifs.agentSounds ? "disabled" : ""} />
              
              <!-- Volume Percentage text -->
              <span id="notif-volume-text" class="text-xs font-semibold text-foreground w-11 text-right font-mono">%${volume}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Live Toast / Status Notification -->
      <div id="notif-status-msg" class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-lg hidden flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span id="notif-status-text">Bildirim ayarları kaydedildi.</span>
      </div>

    </div>
  `;

  const agentToggle = container.querySelector("#notif-agent-toggle");
  const soundToggle = container.querySelector("#notif-sound-toggle");
  const volumeSlider = container.querySelector("#notif-volume-slider");
  const volumeText = container.querySelector("#notif-volume-text");
  const testChimeBtn = container.querySelector("#btn-test-chime");
  const statusBox = container.querySelector("#notif-status-msg");
  const statusText = container.querySelector("#notif-status-text");

  function showStatus(text) {
    if (statusBox && statusText) {
      statusText.textContent = text;
      statusBox.classList.remove("hidden");
      clearTimeout(statusBox._timer);
      statusBox._timer = setTimeout(() => {
        statusBox.classList.add("hidden");
      }, 2200);
    }
  }

  // Toggle Notifications
  agentToggle?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    window.appStore.setNotificationSetting("agentNotifications", isChecked);
    if (isChecked && "Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    showStatus(`Ajan bildirimleri ${isChecked ? "etkinleştirildi" : "kapatıldı"}.`);
  });

  function updateSliderFill(val, enabled) {
    if (volumeSlider) {
      const color = enabled ? "#2F71E3" : "#4b5563";
      volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${val}%, #23242c ${val}%, #23242c 100%)`;
    }
  }

  // Toggle Sounds
  soundToggle?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    window.appStore.setNotificationSetting("agentSounds", isChecked);

    if (volumeSlider) {
      volumeSlider.disabled = !isChecked;
      updateSliderFill(Number(volumeSlider.value), isChecked);
    }
    if (testChimeBtn) {
      if (isChecked) {
        testChimeBtn.classList.remove("opacity-40", "pointer-events-none");
      } else {
        testChimeBtn.classList.add("opacity-40", "pointer-events-none");
      }
    }

    if (isChecked) {
      window.appStore.playNotificationSound();
    }
    showStatus(`Ajan sesleri ${isChecked ? "etkinleştirildi" : "kapatıldı"}.`);
  });

  // Volume Slider Live Update & Save
  volumeSlider?.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if (volumeText) volumeText.textContent = `%${val}`;
    const isEnabled = soundToggle ? soundToggle.checked : true;
    updateSliderFill(val, isEnabled);
    window.appStore.setNotificationSetting("soundVolume", val);
  });

  volumeSlider?.addEventListener("change", (e) => {
    window.appStore.playNotificationSound();
  });

  // Test Chime Button
  testChimeBtn?.addEventListener("click", () => {
    window.appStore.playNotificationSound();
  });
}

// 1:1 Lux General Settings View (Includes Voice mode section - Image 2)
function renderGeneralSettingsView(container) {
  const voiceSectionHtml = window.renderVoiceModeSettingsSection ? window.renderVoiceModeSettingsSection() : "";

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      
      <!-- Voice mode Section (1:1 Lux media_1794235540942_e9ae1001.png) -->
      ${voiceSectionHtml}

      <!-- Agent Behavior Section -->
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Ajan Yürütme ve Kurtarma</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex items-center justify-between hover:border-border transition-colors">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Otomatik Hata Kurtarma (Auto-Heal)</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Uzak sağlayıcı yanıt vermediğinde veya zaman aşımı yaşandığında otomatik çalışan yedek modele aktar.
            </p>
          </div>
          <label class="lux-toggle shrink-0">
            <input type="checkbox" id="general-auto-heal-toggle" ${window.appStore?.state?.general?.autoHeal !== false ? "checked" : ""} />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <!-- Memory & Clean Slate Section -->
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Hafıza ve Sıfırlama</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-border transition-colors">
          <div class="flex flex-col gap-1 pr-4 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Hafızayı Sıfırdan Sil</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Kayıtlı tüm eski sohbet geçmişini, örnek projeleri, otomasyonları ve geçici belleği temizler. API anahtarların ve ses tercihlerin korunur.
            </p>
            <span id="wipe-memory-status" class="text-[11px] text-emerald-400 hidden mt-0.5"></span>
          </div>
          <button type="button" id="btn-wipe-memory" class="agy-button bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 text-xs font-medium px-3.5 py-2 rounded-full cursor-pointer transition-colors shrink-0">
            Hafızayı Sıfırdan Sil
          </button>
        </div>
      </div>

    </div>
  `;

  if (window.attachVoiceModeSettingsEvents) {
    window.attachVoiceModeSettingsEvents(container);
  }

  container.querySelector("#general-auto-heal-toggle")?.addEventListener("change", (e) => {
    if (!window.appStore.state.general) window.appStore.state.general = {};
    window.appStore.state.general.autoHeal = Boolean(e.target.checked);
    window.appStore.saveState();
  });

  const wipeBtn = container.querySelector("#btn-wipe-memory");
  const wipeStatus = container.querySelector("#wipe-memory-status");
  wipeBtn?.addEventListener("click", () => {
    if (wipeBtn.dataset.confirmPending !== "true") {
      wipeBtn.dataset.confirmPending = "true";
      wipeBtn.textContent = "Emin misin? Onayla";
      wipeBtn.classList.add("bg-rose-600/35", "border-rose-400");
      setTimeout(() => {
        if (wipeBtn.isConnected && wipeBtn.dataset.confirmPending === "true") {
          wipeBtn.dataset.confirmPending = "false";
          wipeBtn.textContent = "Hafızayı Sıfırdan Sil";
          wipeBtn.classList.remove("bg-rose-600/35", "border-rose-400");
        }
      }, 3500);
      return;
    }

    wipeBtn.dataset.confirmPending = "false";
    wipeBtn.textContent = "Hafızayı Sıfırdan Sil";
    wipeBtn.classList.remove("bg-rose-600/35", "border-rose-400");
    window.stopAllAssistantOutput?.(false);
    window.appStore?.wipeMemory?.({ preserveSettings: true });
    window.renderApp?.();
    if (wipeStatus) {
      wipeStatus.textContent = "✓ Tüm sohbet ve proje hafızası sıfırlandı.";
      wipeStatus.classList.remove("hidden");
    }
  });
}

window.applyAccentTheme = function (hex) {
  if (!hex) return;
  document.documentElement.style.setProperty("--primary", hex);
  const styleId = "lux-dynamic-accent-style";
  let st = document.getElementById(styleId);
  if (!st) {
    st = document.createElement("style");
    st.id = styleId;
    document.head.appendChild(st);
  }
  st.textContent = `.bg-primary { background-color: ${hex} !important; } .text-primary { color: ${hex} !important; } .border-primary { border-color: ${hex} !important; }`;
};

function renderApplicationSettingsView(container) {
  const appConf = window.appStore?.state?.application || {};
  const wsDir = appConf.workspaceDir || window.luxAppInfo?.currentWorkspace || "";
  const T = (key) => (window.LuxI18n ? window.LuxI18n.t(key) : key);

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Sistem & Çalışma Alanı</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors divide-y divide-border/60">
          
          <div class="p-5 flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1 pr-4 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Varsayılan Çalışma Dizini</span>
              <p id="app-settings-workspace-path" class="text-xs text-muted-foreground leading-relaxed m-0 font-mono text-[11px] text-primary/80 truncate">
                ${escapeHtml(wsDir) || '<span class="text-muted-foreground/60">(ayarlanmadı — main süreçten çözülür)</span>'}
              </p>
            </div>
            <button type="button" id="btn-app-browse-workspace" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium px-3.5 py-1.5 rounded-full border border-border/60 cursor-pointer transition-colors shrink-0">
              Gözat
            </button>
          </div>

          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Donanım Hızlandırma (GPU)</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Arayüz render ve ses dalgası animasyonlarında GPU donanım hızlandırmasını kullanır.
              </p>
            </div>
            <label class="lux-toggle shrink-0">
              <input type="checkbox" id="app-hardware-accel-toggle" ${appConf.hardwareAccel !== false ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>

          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Açılışta DevTools</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Geliştirici konsolu ve uzaktan hata ayıklama portunu hazır tutar.
              </p>
            </div>
            <label class="lux-toggle shrink-0">
              <input type="checkbox" id="app-auto-devtools-toggle" ${appConf.autoDevTools ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>

        </div>
      </div>

      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Uygulama Bilgileri</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-foreground">Lux AI Desktop IDE</span>
            <span id="app-settings-version-line" class="text-xs text-muted-foreground">Sürüm: 1.0.0 · Electron Native Engine · Node.js</span>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
            Güncel
          </span>
        </div>

      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Güncelleme</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex flex-col gap-2">
          <p class="text-xs text-muted-foreground leading-relaxed m-0">
            Üretim paketinde uygulama açılışta Release'i denetler, yeni sürüm varsa arka planda indirir;
            indirme bitince sağ altta "Yeniden Başlat ve Yükle" bandı gösterilir.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" id="btn-check-update" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium px-3.5 py-1.5 rounded-full border border-border/60 cursor-pointer transition-colors">
              Güncellemeleri Denetle
            </button>
            <span id="update-check-status-line" class="text-[11px] text-muted-foreground"></span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Veri & Yedek</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex flex-col gap-3">
          <p class="text-xs text-muted-foreground leading-relaxed m-0">
            Sohbetler, ayarlar ve çalışma-alanı haritası tek bir <span class="font-mono">.luxbackup</span> dosyasına aktarılır.
            API anahtarları yedeğe <strong>dahil değildir</strong> (şifreli kasa ayrıdır). Parola girerseniz dosya
            AES-256-GCM ile şifrelenir; parolasız yedek düz JSON'dur.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <input id="backup-password-input" type="password" autocomplete="new-password" class="model-input-field text-xs flex-1 min-w-[180px]" placeholder="${T("backup.password")}" />
            <button type="button" id="btn-backup-export" class="agy-button bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3.5 py-1.5 rounded-full cursor-pointer transition-colors">
              ${T("backup.export")}
            </button>
            <button type="button" id="btn-backup-import" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium px-3.5 py-1.5 rounded-full border border-border/60 cursor-pointer transition-colors">
              ${T("backup.import")}
            </button>
          </div>
          <p id="backup-status-line" class="text-[11px] text-muted-foreground min-h-[16px] m-0"></p>
        </div>
      </div>

      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">${T("logs.title")}</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl p-5 flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span id="logs-path-line" class="text-[10.5px] text-muted-foreground font-mono truncate"></span>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" id="btn-logs-refresh" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer transition-colors">${T("logs.refresh")}</button>
              <button type="button" id="btn-logs-copy" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer transition-colors">${T("logs.copy")}</button>
              <button type="button" id="btn-logs-open-folder" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer transition-colors">${T("logs.openFolder")}</button>
              <button type="button" id="btn-logs-clear" class="agy-button bg-danger/10 hover:bg-danger/20 text-red-400 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-red-500/30 cursor-pointer transition-colors">${T("logs.clear")}</button>
            </div>
          </div>
          <pre id="logs-pre-output" class="text-[10.5px] leading-relaxed font-mono bg-[#0a0a0c] border border-border/60 rounded-xl p-3 max-h-64 overflow-auto text-muted-foreground whitespace-pre-wrap break-words m-0 select-text">Yükleniyor…</pre>
        </div>
      </div>
    </div>
  `;

  window.luxAPI
    ?.getAppInfo?.()
    .then((info) => {
      if (!container.isConnected || !info) return;
      const wsEl = container.querySelector("#app-settings-workspace-path");
      if (wsEl && !appConf.workspaceDir && info.currentWorkspace) {
        wsEl.textContent = info.currentWorkspace;
      }
      const verEl = container.querySelector("#app-settings-version-line");
      if (verEl) {
        verEl.textContent = `Sürüm: ${info.version || "1.0.0"} · Electron Native Engine (${info.platform || "win32"})`;
      }
    })
    .catch(() => {});

  container.querySelector("#btn-app-browse-workspace")?.addEventListener("click", async () => {
    const picked = await window.luxAPI?.pickFolder?.();
    if (picked && !picked.canceled && picked.path) {
      if (!window.appStore.state.application) window.appStore.state.application = {};
      window.appStore.state.application.workspaceDir = picked.path;
      window.appStore.saveState();
      window.luxAPI?.setWorkspaceDir?.(picked.path).catch?.(() => {});
      const wsEl = container.querySelector("#app-settings-workspace-path");
      if (wsEl) wsEl.textContent = picked.path;
    }
  });

  container.querySelector("#app-hardware-accel-toggle")?.addEventListener("change", (e) => {
    if (!window.appStore.state.application) window.appStore.state.application = {};
    window.appStore.state.application.hardwareAccel = Boolean(e.target.checked);
    window.appStore.saveState();
  });

  container.querySelector("#app-auto-devtools-toggle")?.addEventListener("change", (e) => {
    if (!window.appStore.state.application) window.appStore.state.application = {};
    window.appStore.state.application.autoDevTools = Boolean(e.target.checked);
    window.appStore.saveState();
    if (e.target.checked) window.luxAPI?.window?.devtools?.();
  });

  // --- Yedek / Güncelleme / Günlük bağlantıları (v1.5.0) ---
  const statusLine = container.querySelector("#backup-status-line");
  const setStatus = (msg, isError) => {
    if (!statusLine) return;
    statusLine.textContent = msg || "";
    statusLine.classList.toggle("text-red-400", Boolean(isError));
  };
  const logsPre = container.querySelector("#logs-pre-output");
  const logsPath = container.querySelector("#logs-path-line");
  const loadLogs = async () => {
    if (logsPre) logsPre.textContent = "Yükleniyor…";
    try {
      const res = await window.luxAPI?.logs?.read?.(64 * 1024);
      if (!container.isConnected) return;
      if (logsPre) logsPre.textContent = res?.success ? (res.text ?? "(boş)") : `Okunamadı: ${res?.error || "bilinmeyen hata"}`;
      if (logsPath) logsPath.textContent = res?.path || "";
    } catch (e) {
      if (logsPre) logsPre.textContent = "Okunamadı: " + String(e);
    }
  };
  container.querySelector("#btn-logs-refresh")?.addEventListener("click", loadLogs);
  const copyBtn = container.querySelector("#btn-logs-copy");
  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(logsPre?.textContent || "");
      copyBtn.textContent = "✓";
      setTimeout(() => {
        copyBtn.textContent = T("logs.copy");
      }, 1200);
    } catch (e) {
      window.luxDebug?.("modals.js:1769", e);
    }
  });
  container.querySelector("#btn-logs-open-folder")?.addEventListener("click", () => {
    window.luxAPI?.logs?.openFolder?.();
  });
  container.querySelector("#btn-logs-clear")?.addEventListener("click", async () => {
    if (!confirm("Günlükler (app.log ve app.log.1) silinecek. Emin misiniz?")) return;
    await window.luxAPI?.logs?.clear?.();
    loadLogs();
  });
  loadLogs();

  container.querySelector("#btn-backup-export")?.addEventListener("click", async () => {
    const pwInput = container.querySelector("#backup-password-input");
    const pw = pwInput && pwInput.value ? pwInput.value : "";
    setStatus("Dışa aktarılıyor…");
    try {
      const res = await window.luxAPI?.backup?.export?.(pw || undefined);
      if (!res?.success) {
        setStatus("Hata: " + (res?.error || "bilinmeyen"), true);
        return;
      }
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.suggestedFilename || "lux-yedek.luxbackup";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Kaydedildi: ${a.download}${pw ? " (parolalı)" : ""}`);
    } catch (e) {
      setStatus("Hata: " + String(e), true);
    }
  });
  container.querySelector("#btn-backup-import")?.addEventListener("click", async () => {
    const pwInput = container.querySelector("#backup-password-input");
    const pw = pwInput && pwInput.value ? pwInput.value : "";
    if (
      !confirm(
        "Yedek içe aktarılacak: mevcut sohbetler/ayarlar .luxbackup içeriğiyle DEĞİŞTİRİLİR. " +
          "Önce mevcut dosyanın .bak kopyası alınır. Devam?"
      )
    )
      return;
    setStatus("İçe aktarılıyor…");
    try {
      const res = await window.luxAPI?.backup?.import?.(pw || undefined);
      if (res?.canceled) {
        setStatus("İçe aktarma iptal edildi.");
        return;
      }
      if (!res?.success) {
        setStatus("Hata: " + (res?.error || "bilinmeyen"), true);
        return;
      }
      setStatus("Yedek geri alındı. Uygulama yeniden yükleniyor…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setStatus("Hata: " + String(e), true);
    }
  });

  container.querySelector("#btn-check-update")?.addEventListener("click", async () => {
    const line = container.querySelector("#update-check-status-line");
    if (line) line.textContent = "Denetleniyor…";
    try {
      const res = await window.luxAPI?.updates?.checkNow?.();
      if (!line) return;
      if (res?.packaged === false) {
        line.textContent = "Geliştirme sürümü — güncelleme yalnız üretim paketinde etkin.";
      } else if (res?.success) {
        line.textContent = res.version ? `Güncelleme bulundu: v${res.version} (arka planda inecek)` : "Güncel görünüyor.";
      } else {
        line.textContent = "Kontrol başarısız: " + (res?.error || "bilinmeyen hata");
      }
    } catch (e) {
      if (line) line.textContent = "Kontrol başarısız: " + String(e);
    }
  });
}

function renderAppearanceSettingsView(container) {
  const activeAccent = (window.appStore?.state?.appearance?.accentColor || "#2F71E3").toUpperCase();
  const accents = [
    { hex: "#2F71E3", title: "Lux Blue" },
    { hex: "#10B981", title: "Cyber Emerald" },
    { hex: "#8B5CF6", title: "Cosmic Purple" },
    { hex: "#F59E0B", title: "Solar Amber" }
  ];

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Renk Paleti & Tema</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors divide-y divide-border/60">
          
          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Karanlık Tema Modu</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Google Lux IDE (#070709) koyu tema renk standardı.
              </p>
            </div>
            <span class="text-xs text-primary font-medium px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              Onyx Lux (Varsayılan)
            </span>
          </div>

          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Vurgu Rengi (Accent)</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Butonlar, imleçler ve seçim alanları için ana sistem rengi.
              </p>
            </div>
            <div class="flex items-center gap-2">
              ${accents
                .map((a) => {
                  const isActive = a.hex === activeAccent;
                  return `<button type="button" class="accent-swatch-btn w-6 h-6 rounded-full cursor-pointer transition-transform ${isActive ? "border-2 border-white scale-110 shadow-sm" : "border border-white/20 hover:scale-105"}" style="background-color: ${a.hex};" data-accent="${a.hex}" title="${a.title}"></button>`;
                })
                .join("")}
            </div>
          </div>

          <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Kod Yazı Tipi</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Terminal ve kod bloklarında kullanılan sabit genişlikli font.
              </p>
            </div>
            <span class="text-xs text-muted-foreground font-mono bg-secondary/80 px-2.5 py-1 rounded border border-border/60">
              Google Sans Code, Consolas
            </span>
          </div>

        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".accent-swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hex = btn.getAttribute("data-accent");
      if (!hex) return;
      if (!window.appStore.state.appearance) window.appStore.state.appearance = {};
      window.appStore.state.appearance.accentColor = hex;
      window.appStore.saveState();
      window.applyAccentTheme(hex);
      renderAppearanceSettingsView(container);
    });
  });
}

function renderAutomationsSettingsView(container) {
  const list = window.appStore?.state?.automations || [];

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="flex flex-col gap-3 pt-1">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Aktif Otomasyonlar (${list.length})</h3>
          <button type="button" id="btn-toggle-new-automation" class="agy-button bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer">
            <span>+ Yeni Otomasyon</span>
          </button>
        </div>

        <div id="new-automation-form" class="hidden p-4 rounded-2xl border border-primary/40 bg-card/60 flex flex-col gap-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input type="text" id="new-auto-title" placeholder="Otomasyon adı (örn. Test Koşusu)" class="model-input-field text-xs" />
            <input type="text" id="new-auto-schedule" list="auto-schedule-suggestions" placeholder="Zamanlama (örn. Her Saat / Her 30 dakika / Her Gün 09:00)" class="model-input-field text-xs font-mono" />
            <datalist id="auto-schedule-suggestions">
              <option value="Her Saat"></option>
              <option value="Her 15 dakika"></option>
              <option value="Her 30 dakika"></option>
              <option value="Her 2 saat"></option>
              <option value="Her Gün 09:00"></option>
              <option value="Manuel"></option>
            </datalist>
          </div>
          <input type="text" id="new-auto-desc" placeholder="Görev komutu (sohbete kullanıcı mesajı olarak gönderilir)..." class="model-input-field text-xs" />
          <p class="text-[10px] text-muted-foreground leading-relaxed m-0">
            Desteklenen kalıplar: “Her Saat”, “Her 30 dakika”, “Her 2 saat”, “Her 3 gün”, “Her Gün 09:00”. Zamanı gelen etkin otomasyonlar görevi sohbete gönderir (araç onayları yine sizden ister). “Manuel” veya anlaşılmayan metinler yalnızca “Şimdi çalıştır” ile çalışır.
          </p>
          <div class="flex items-center justify-end gap-2">
            <button type="button" id="btn-cancel-new-automation" class="agy-button px-3 py-1 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground cursor-pointer">İptal</button>
            <button type="button" id="btn-save-new-automation" class="agy-button px-3.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer">Kaydet</button>
          </div>
        </div>

        <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors divide-y divide-border/60">
          ${
            list.length === 0
              ? `
            <div class="p-6 text-center text-xs text-muted-foreground">Henüz kayıtlı otomasyon bulunmuyor.</div>
          `
              : list
                  .map(
                    (item) => `
            <div class="p-5 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3.5 flex-1 min-w-0">
                <div class="w-9 h-9 rounded-xl ${item.color === "purple" ? "bg-purple-500/15 text-purple-400 border-purple-500/25" : "bg-blue-500/15 text-blue-400 border-blue-500/25"} border flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-foreground">${escapeHtml(item.title)}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">${escapeHtml(item.schedule)}</span>
                  </div>
                  <p class="text-xs text-muted-foreground m-0 truncate">${escapeHtml(item.desc)}</p>
                  <div class="auto-lastrun text-[10px] text-muted-foreground/80 font-mono mt-0.5">${escapeHtml(window.luxAutomations?.metaLine ? window.luxAutomations.metaLine(item) : "")}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" class="btn-run-automation p-1 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer" data-auto-id="${escapeHtml(item.id)}" title="Şimdi çalıştır" aria-label="Otomasyonu şimdi çalıştır"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
                <button type="button" class="btn-delete-automation p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" data-auto-id="${escapeHtml(item.id)}" title="Sil">✕</button>
                <label class="lux-toggle shrink-0">
                  <input type="checkbox" class="automation-enabled-toggle" data-auto-id="${escapeHtml(item.id)}" ${item.enabled ? "checked" : ""} />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>
    </div>
  `;

  const formEl = container.querySelector("#new-automation-form");
  container.querySelector("#btn-toggle-new-automation")?.addEventListener("click", () => {
    formEl?.classList.toggle("hidden");
    if (!formEl?.classList.contains("hidden")) {
      container.querySelector("#new-auto-title")?.focus();
    }
  });
  container.querySelector("#btn-cancel-new-automation")?.addEventListener("click", () => {
    formEl?.classList.add("hidden");
  });
  container.querySelector("#btn-save-new-automation")?.addEventListener("click", () => {
    const title = container.querySelector("#new-auto-title")?.value?.trim();
    const schedule = container.querySelector("#new-auto-schedule")?.value?.trim() || "Manuel / Günlük";
    const desc = container.querySelector("#new-auto-desc")?.value?.trim() || "Özel otomasyon görevi";
    if (!title) return;
    if (!Array.isArray(window.appStore.state.automations)) window.appStore.state.automations = [];
    window.appStore.state.automations.unshift({
      id: "auto-" + Date.now(),
      title,
      schedule,
      desc,
      enabled: true,
      color: "blue",
      createdAt: Date.now()
    });
    window.appStore.saveState();
    renderAutomationsSettingsView(container);
  });

  container.querySelectorAll(".btn-run-automation").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-auto-id");
      window.luxAutomations?.runNow(id);
      renderAutomationsSettingsView(container);
    });
  });

  container.querySelectorAll(".automation-enabled-toggle").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-auto-id");
      const found = (window.appStore.state.automations || []).find((a) => a.id === id);
      if (found) {
        found.enabled = Boolean(e.target.checked);
        window.appStore.saveState();
      }
    });
  });

  container.querySelectorAll(".btn-delete-automation").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-auto-id");
      window.appStore.state.automations = (window.appStore.state.automations || []).filter((a) => a.id !== id);
      window.appStore.saveState();
      renderAutomationsSettingsView(container);
    });
  });

  // Zamanlayıcı tetiklediğinde açık sekmenin damgalarını tazele
  if (container.__luxAutomationRanHandler) {
    window.removeEventListener("lux-automation-ran", container.__luxAutomationRanHandler);
  }
  container.__luxAutomationRanHandler = () => {
    if (document.getElementById("settings-modal")?.classList.contains("show")) {
      renderAutomationsSettingsView(container);
    }
  };
  window.addEventListener("lux-automation-ran", container.__luxAutomationRanHandler);
}

function renderCustomizationsSettingsView(container) {
  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="flex flex-col gap-2 pt-1">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Ajan Kuralları & Beceriler</h3>
        <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors divide-y divide-border/60">
          
            <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Lux Kuralları (.rules)</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Çalışma alanında .rules dosyası varsa ajan yönergelerine otomatik uygulanır.
              </p>
            </div>
            <span id="rules-status-pill" class="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded border border-border/60 shrink-0">
              Denetleniyor…
            </span>
          </div>

            <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">Yerleşik Beceriler (Skills)</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Araç döngüsü, ses motoru ve eklenti altyapısı uygulamayla birlikte gelir; ayrı kurulum gerektirmez.
              </p>
            </div>
            <span class="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              Yerleşik
            </span>
          </div>

            <div class="p-5 flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
              <span class="text-sm font-medium text-foreground tracking-tight">MCP Sunucuları & Eklentiler</span>
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Model Context Protocol araçları, dahili araç döngüsü ve kurulu eklenti durumu.
              </p>
            </div>
            <button type="button" id="btn-open-plugin-drawer" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium px-3.5 py-1.5 rounded-full border border-border/60 cursor-pointer transition-colors">
              Yüklü Eklentiler
            </button>
          </div>

          <div id="plugin-marketplace-drawer" class="hidden p-4 bg-background/60 flex flex-col gap-2">
            <div class="text-xs font-semibold text-foreground">Yüklü Eklentiler</div>
            <div id="installed-plugins-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="p-2.5 rounded-lg border border-border/60 bg-card/50 text-muted-foreground">Yükleniyor…</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  container.querySelector("#btn-open-plugin-drawer")?.addEventListener("click", () => {
    container.querySelector("#plugin-marketplace-drawer")?.classList.toggle("hidden");
  });

  // Gerçek durum denetimleri: .rules dosyası çalışma alanında var mı?
  (async () => {
    const pill = container.querySelector("#rules-status-pill");
    if (!pill) return;
    const baseOk = "text-xs font-mono px-2.5 py-1 rounded border shrink-0 ";
    try {
      const ws = (window.appStore?.state?.application?.workspaceDir || "").trim();
      const res = await window.luxAPI?.fs?.readFile?.(".rules", ws ? { workspaceDir: ws } : undefined);
      if (res?.success && String(res.content || "").trim().length > 0) {
        pill.textContent = "Aktif (.rules bulundu)";
        pill.className = baseOk + "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else {
        pill.textContent = ".rules yok";
        pill.className = baseOk + "text-muted-foreground bg-secondary border-border/60";
      }
    } catch (_) {
      pill.textContent = ".rules okunamadı";
      pill.className = baseOk + "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  })();

  // Kurulu eklentileri gerçek kayıt defterinden (luxPlugins) listele
  (() => {
    const listEl = container.querySelector("#installed-plugins-list");
    if (!listEl) return;
    const plugins = window.luxPlugins?.list?.() || [];
    if (plugins.length === 0) {
      listEl.innerHTML =
        '<div class="p-2.5 rounded-lg border border-border/60 bg-card/50 text-muted-foreground sm:col-span-2">Yüklü eklenti bulunmuyor.</div>';
      return;
    }
    listEl.innerHTML = plugins
      .map(
        (p) => `
      <div class="p-2.5 rounded-lg border border-border/60 bg-card/50 flex items-center justify-between gap-2"><span class="truncate">${escapeHtml(p.name || p.id || "Eklenti")}</span><span class="text-emerald-400 font-mono text-[10px] shrink-0">Aktif</span></div>`
      )
      .join("");
  })();
}

function renderShortcutsSettingsView(container) {
  const shortcuts = [
    { key: "Ctrl + B", desc: "Kenar Çubuğunu Aç / Gizle", cat: "Arayüz" },
    { key: "Ctrl + N", desc: "Yeni Sohbet Oluştur", cat: "Sohbet" },
    { key: "Ctrl + K / P / Shift+P", desc: "Komut Paletini Aç (Hızlı Komutlar)", cat: "Arama" },
    { key: "Ctrl + I / Ctrl + \\", desc: "Bölünmüş IDE & Düzenleyici Görünümünü Aç/Kapat", cat: "Görünüm" },
    { key: "Ctrl + J / Ctrl + `", desc: "Sağ Paneli ve Entegre Terminali Aç", cat: "Terminal" },
    { key: "Ctrl + ,", desc: "Ayarlar Penceresini Aç", cat: "Ayarlar" },
    { key: "Ctrl + S", desc: "IDE Düzenleyicide Aktif Dosyayı Kaydet", cat: "Düzenleyici" },
    { key: "Ctrl + + / -", desc: "Arayüz Ölçeğini Büyüt / Küçült", cat: "Görünüm" },
    { key: "Ctrl + 0", desc: "Arayüz Ölçeğini Sıfırla (%100)", cat: "Görünüm" },
    { key: "Enter", desc: "Mesajı Gönder (Yapay Zeka Yanıtlar)", cat: "Sohbet" },
    { key: "Shift + Enter", desc: "Mesaj Alanında Yeni Satıra Geç", cat: "Sohbet" },
    { key: "Esc", desc: "Modalleri Kapat / Devam Eden Seslendirmeyi Durdur", cat: "Genel" }
  ];

  container.innerHTML = `
    <div class="flex flex-col gap-3 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="bg-card/40 border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
        ${shortcuts
          .map(
            (s) => `
          <div class="px-5 py-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
            <div class="flex items-center gap-3">
              <span class="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground font-medium">${escapeHtml(s.cat)}</span>
              <span class="text-xs text-foreground">${escapeHtml(s.desc)}</span>
            </div>
            <kbd class="px-2 py-1 rounded bg-background border border-border text-[11px] font-mono text-primary">${escapeHtml(s.key)}</kbd>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderConversationsSettingsView(container) {
  const projects = window.appStore?.state?.projects || [];
  const allConvs = [];
  projects.forEach((p) => {
    (p.conversations || []).forEach((c) => {
      allConvs.push({ project: p, conv: c });
    });
  });

  container.innerHTML = `
    <div class="flex flex-col gap-4 w-full max-w-3xl mx-auto pb-8 select-none">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-foreground m-0">Tüm Sohbet Geçmişi (${allConvs.length})</h3>
          <p class="text-xs text-muted-foreground m-0 mt-0.5">Herhangi bir sohbete geçiş yapabilir veya Markdown olarak dışa aktarabilirsiniz.</p>
        </div>
        <button type="button" id="btn-conv-tab-new" class="agy-button px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer">+ Yeni Sohbet</button>
      </div>
      <div class="bg-card/40 border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
        ${
          allConvs.length === 0
            ? `
          <div class="p-6 text-center text-xs text-muted-foreground">Henüz kayıtlı sohbet yok.</div>
        `
            : allConvs
                .map(
                  ({ project, conv }) => `
          <div class="p-3.5 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors">
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium text-foreground truncate">${escapeHtml(conv.title)}</div>
              <div class="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>${escapeHtml(project.name)}</span>
                <span>·</span>
                <span>${(conv.messages || []).length} mesaj</span>
                <span>·</span>
                <span>${escapeHtml(conv.timestamp || "Şimdi")}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" class="btn-conv-jump px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-xs text-foreground cursor-pointer" data-conv-id="${escapeHtml(conv.id)}">Aç</button>
              <button type="button" class="btn-conv-export px-2.5 py-1 rounded-lg border border-border/70 hover:bg-secondary text-xs text-secondary-foreground cursor-pointer" data-conv-id="${escapeHtml(conv.id)}">.md</button>
            </div>
          </div>
        `
                )
                .join("")
        }
      </div>
    </div>
  `;

  container.querySelector("#btn-conv-tab-new")?.addEventListener("click", () => {
    window.appStore.createConversation("Yeni Sohbet");
    window.closeSettingsModal();
    window.renderApp();
  });

  container.querySelectorAll(".btn-conv-jump").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-conv-id");
      if (id) window.appStore.selectConversation(id);
      window.closeSettingsModal();
      window.renderApp();
    });
  });

  container.querySelectorAll(".btn-conv-export").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-conv-id");
      const entry = allConvs.find((item) => item.conv.id === id);
      if (!entry) return;
      const md = (entry.conv.messages || [])
        .map((m) => `### ${m.role === "user" ? "Kullanıcı" : "Lux AI"}\n\n${m.content}\n`)
        .join("\n---\n\n");
      const blob = new Blob([md], { type: "text/markdown" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${entry.conv.title || "lux_ai_chat"}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  });
}

function renderPlaceholderTab(container, config) {
  container.innerHTML = `
    <div class="flex-1 w-full border border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center p-8 text-center bg-card/20 select-none">
      <div class="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center text-primary mb-3.5 shadow-sm" id="settings-tab-icon-box">
        ${config.icon}
      </div>
      <h3 class="text-sm font-medium text-foreground mb-1.5" id="settings-tab-placeholder-title">${escapeHtml(config.title)} Sayfa İçeriği</h3>
      <p class="text-xs text-muted-foreground max-w-md leading-relaxed">
        Bu sekmenin iç kontrolleri ve parametreleri ayrılmıştır. İstediğiniz özel ayar veya arayüz elemanlarını buraya ekleyebiliriz.
      </p>
    </div>
  `;
}

// Model Management Component
let editingModelId = null;

const PROVIDERS_DATA = {
  "Google Gemini": {
    endpoint: "https://generativelanguage.googleapis.com",
    placeholderModel: "gemini-3.5-flash-lite",
    badgeClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    color: "#3B82F6",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>`
  },
  Anthropic: {
    endpoint: "https://api.anthropic.com/v1",
    placeholderModel: "claude-3-5-sonnet-20241022",
    badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    color: "#F59E0B",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12" stroke="#000" stroke-width="2"/></svg>`
  },
  OpenAI: {
    endpoint: "https://api.openai.com/v1",
    placeholderModel: "gpt-4o",
    badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    color: "#10B981",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>`
  },
  DeepSeek: {
    endpoint: "https://api.deepseek.com/v1",
    placeholderModel: "deepseek-chat",
    badgeClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    color: "#6366F1",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3L2 12h5v9h10v-9h5L12 3z"/></svg>`
  },
  OpenRouter: {
    endpoint: "https://openrouter.ai/api/v1",
    placeholderModel: "openrouter/free",
    badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    color: "#0EA5E9",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h4l3-7 4 14 3-7h2"/></svg>`
  },
  "Ollama / Yerel": {
    endpoint: "http://localhost:11434/v1",
    placeholderModel: "llama3:latest",
    badgeClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    color: "#06B6D4",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>`
  },
  "Özel / OpenAI Uyumlu": {
    endpoint: "https://api.your-endpoint.com/v1",
    placeholderModel: "custom-model",
    badgeClass: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    color: "#A855F7",
    icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M12 19h8"/></svg>`
  }
};

function renderStatusBadge(model) {
  if (model.status === "testing") {
    return `
      <span class="inline-flex items-center gap-1.5 text-amber-400 font-medium">
        <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
        <span>Test Ediliyor...</span>
      </span>
    `;
  } else if (model.status === "success") {
    return `
      <span class="inline-flex items-center gap-1 text-emerald-400 font-medium">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <span>${escapeHtml(model.lastTested || "Bağlantı Başarılı")}</span>
      </span>
    `;
  } else if (model.status === "error") {
    return `
      <span class="inline-flex items-center gap-1 text-rose-400 font-medium">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(model.lastTested || "Bağlantı Hatası")}</span>
      </span>
    `;
  } else {
    return `
      <span class="inline-flex items-center gap-1 text-muted-foreground/70">
        <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
        <span>${escapeHtml(model.lastTested || "Henüz test edilmedi")}</span>
      </span>
    `;
  }
}

function renderLocalDiscoveryBanner() {
  const ds = window.luxLocalDiscoveryState || {};
  const runtimes = Array.isArray(ds.runtimes) ? ds.runtimes : [];
  const models = window.appStore?.getModels?.() || [];
  const missingOnline = runtimes.filter((rt) => {
    if (!rt.online) return false;
    if (rt.id === "ollama")
      return !models.some((m) => m.name === "Ollama (Yerel)" || m.provider === "Ollama / Yerel" || m.endpoint?.includes("11434"));
    if (rt.id === "lmstudio") return !models.some((m) => m.endpoint?.includes("1234") || /lm\s*studio/i.test(m.name || ""));
    if (rt.id === "9router") return !models.some((m) => m.endpoint?.includes("20128") || m.name === "9Router");
    return false;
  });

  return `
    <div id="local-ai-discovery-banner" class="bg-card/40 border border-border/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex flex-col gap-1.5 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-foreground">Yerel AI Durumu</span>
          ${
            ds.skipped
              ? `
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Yerel ağ izni kapalı</span>
          `
              : runtimes.length > 0
                ? runtimes
                    .map(
                      (rt) => `
            <span class="text-[10px] px-2 py-0.5 rounded-full font-mono border ${rt.online ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-secondary/60 text-muted-foreground border-border/40"}">
              ${rt.online ? "●" : "○"} ${rt.label} · ${rt.port}${rt.online ? ` (${rt.modelsCount})` : ""}
            </span>
          `
                    )
                    .join("")
                : `
            <span class="text-[10px] text-muted-foreground">Henüz taranmadı</span>
          `
          }
        </div>
        <span class="text-[11px] text-muted-foreground">
          ${ds.skipped ? escapeHtml(ds.reason) : "Ollama (11434), LM Studio (1234) ve 9Router (20128) portlarını algılar; silinen modelleri zorla geri eklemez. Ses seçiminizden tamamen bağımsızdır."}
        </span>
        ${
          missingOnline.length > 0
            ? `
          <div class="flex items-center gap-1.5 flex-wrap pt-1">
            ${missingOnline
              .map(
                (rt) => `
              <button type="button" class="btn-add-discovered-runtime agy-button text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors" data-runtime-id="${escapeHtml(rt.id)}">
                + ${escapeHtml(rt.label)} Ekle (İsteğe Bağlı)
              </button>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
      <button type="button" id="btn-scan-local-ai" class="agy-button text-xs h-8 px-3 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>⚡ Yerel Ajanları Tara</span>
      </button>
    </div>
  `;
}

function renderModelsSettingsView(container) {
  if (!container) return;
  const models = window.appStore.getModels();
  const editingModel = editingModelId ? models.find((m) => m.id === editingModelId) : null;
  const activeProvider = editingModel ? editingModel.provider : "Google Gemini";
  const provConfig = PROVIDERS_DATA[activeProvider] || PROVIDERS_DATA["Özel / OpenAI Uyumlu"];
  const editingIsOpenRouter = Boolean(
    editingModel && (editingModel.provider === "OpenRouter" || /openrouter\.ai/i.test(editingModel.endpoint || ""))
  );
  const editingEffectiveKey = editingModel
    ? (editingModel.apiKey || "").trim() || (editingIsOpenRouter ? window.appStore?.getOpenRouterApiKey?.() || "" : "")
    : "";

  container.innerHTML = `
    <div class="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-6">

      <!-- 0. Yerel AI Durumu -->
      ${renderLocalDiscoveryBanner()}
      
      <!-- 1. Üst Kısım: Model Ekleme & Yapılandırma Kartı (API, Model, Endpoint) -->
      <div class="bg-card/40 border border-border/80 rounded-xl p-5 shadow-sm" id="model-form-container">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-border/40">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg ${editingModel ? "bg-amber-500/20 text-amber-400" : "bg-primary/15 text-primary"} flex items-center justify-center">
              ${
                editingModel
                  ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`
                  : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor"><path d="M450-450H250q-12.75,0-21.37-8.63T220-480.01t8.62-21.37T250-510H450V-710q0-12.75 8.63-21.37T480.01-740t21.37,8.62T510-710v200H710q12.75,0 21.37,8.63T740-479.99t-8.62,21.37T710-450H510v200q0,12.75-8.63,21.37T479.99-220t-21.37-8.62T450-250V-450Z"/></svg>`
              }
            </div>
            <div>
              <h3 class="text-sm font-semibold text-foreground m-0">
                ${editingModel ? `Modeli Düzenle: <span class="text-amber-400 font-mono">${escapeHtml(editingModel.name)}</span>` : "Yeni Model Ekle"}
              </h3>
              <p class="text-xs text-muted-foreground m-0 mt-0.5">Yapay zeka sağlayıcınızı, API kimlik bilgilerinizi ve endpoint adresini yapılandırın.</p>
            </div>
          </div>
          ${
            editingModel
              ? `
            <button id="btn-cancel-edit-mode" class="agy-button text-xs h-7 px-2.5 rounded-lg border border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              ✕ Vazgeç / Yeni Ekle
            </button>
          `
              : ""
          }
        </div>

        <!-- Form Alanları (2 Sütunlu Izgara) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Model Adı -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground flex items-center gap-1">
              <span>Model Adı (Etiket)</span>
              <span class="text-red-400">*</span>
            </label>
            <input type="text" id="mf-name" value="${escapeHtml(editingModel ? editingModel.name : "")}" placeholder="örn: Gemini 1.5 Pro, Claude 3.5 Sonnet, Llama 3 70B" class="model-input-field" />
          </div>

          <!-- Sağlayıcı / API Tipi -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground flex items-center gap-1">
              <span>Sağlayıcı / Protokol</span>
              <span class="text-red-400">*</span>
            </label>
            <select id="mf-provider" class="model-input-field cursor-pointer" style="background-color: #141418; color: #FAFAFA; color-scheme: dark;">
              ${Object.keys(PROVIDERS_DATA)
                .map(
                  (p) => `
                <option value="${escapeHtml(p)}" ${p === activeProvider ? "selected" : ""} class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">${escapeHtml(p)}</option>
              `
                )
                .join("")}
            </select>
          </div>

          <!-- Model Kimliği (ID) & Hızlı Model Seçimi -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground flex items-center gap-1">
                <span>Model ID (API Kodu)</span>
                <span class="text-red-400">*</span>
              </label>
              <button type="button" id="btn-fetch-live-models" class="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer" title="Sağlayıcı endpoint'inden modelleri otomatik çek">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>⚡ Modelleri Getir</span>
              </button>
            </div>
            <div class="flex flex-col sm:flex-row items-center gap-2">
              <select id="mf-model-preset-select" class="model-input-field cursor-pointer flex-1 text-xs" style="background-color: #141418; color: #FAFAFA; color-scheme: dark;">
                <option value="" class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">-- Listeden Model Seçin --</option>
              </select>
              <input type="text" id="mf-model-id" value="${escapeHtml(editingModel ? editingModel.modelId : provConfig.placeholderModel || "")}" placeholder="${escapeHtml(provConfig.placeholderModel)}" class="model-input-field font-mono flex-1 text-xs" />
            </div>
          </div>

          <!-- API Endpoint / Base URL -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">
              <span>API Endpoint / Base URL (Opsiyonel)</span>
            </label>
            <input type="text" id="mf-endpoint" value="${escapeHtml(editingModel ? editingModel.endpoint : provConfig.endpoint || "")}" placeholder="https://api.openai.com/v1 veya http://localhost:11434/v1" class="model-input-field font-mono" />
          </div>

          <!-- API Key / Token (Tam Genişlik) -->
          <div class="flex flex-col gap-1.5 md:col-span-2">
            <label class="text-xs font-medium text-foreground flex items-center justify-between">
              <span>API Anahtarı / Token</span>
              <span class="text-[11px] text-muted-foreground font-normal">OpenRouter için tek anahtar hem ücretsiz LLM hem Fish/HeyGen TTS'i açar; Ollama boştur</span>
            </label>
            <div class="relative flex items-center">
              <input type="password" id="mf-api-key" value="${escapeHtml(editingEffectiveKey)}" placeholder="sk-or-v1-..., sk-ant-..., AIzaSy... veya özel API anahtarı" class="model-input-field pr-10 font-mono" />
              <button type="button" id="btn-toggle-key-visibility" class="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground cursor-pointer outline-none" title="Anahtarı Göster/Gizle">
                <svg id="icon-eye-open" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z"/>
                </svg>
                <svg id="icon-eye-closed" class="hidden" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m644-428-58-58q9-47-27-88t-87-32l-58-58q17-5 34-7.5t36-2.5q75 0 127.5 52.5T660-500q0 19-2.5 36T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t88-8.5q146 0 266 81.5T920-500q-32 78-86 142.5T772-302ZM200-80l-56-56 122-122q-58-36-104-89.5T90-500q54-137 174-218.5T480-800q42 0 83 6t81 18l116-116 56 56L200-80Zm182-354ZM480-320q-75 0-127.5-52.5T300-500q0-11 2-21t6-21l234 234q-10 4-21 6t-21 2Zm-14-160Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Form Alt Kontrolleri: Varsayılan Yap + Ön Test + Kaydet -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-border/40">
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-secondary-foreground hover:text-foreground">
              <input type="checkbox" id="mf-is-default" ${editingModel?.isDefault ? "checked" : ""} class="w-4 h-4 rounded bg-secondary border-border text-primary cursor-pointer" />
              <span>Bu modeli varsayılan yap</span>
            </label>
            <div id="mf-test-status" class="text-xs transition-all"></div>
          </div>

          <div class="flex items-center gap-2 justify-end">
            <!-- Ön Test Butonu -->
            <button type="button" id="btn-mf-pretest" class="agy-button text-xs h-8 px-3 rounded-lg border border-border/70 hover:bg-secondary text-secondary-foreground hover:text-foreground cursor-pointer transition-colors flex items-center gap-1.5" title="Kaydetmeden önce API bağlantısını sına">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
              </svg>
              <span>Ön Test Et</span>
            </button>

            <!-- Kaydet Butonu -->
            <button type="button" id="btn-mf-save" class="agy-button text-xs h-8 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/>
              </svg>
              <span>${editingModel ? "Değişiklikleri Güncelle" : "+ Modeli Kaydet"}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Alt Kısım: Eklenen Modeller (Alt alta yatay kart listesi) -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-foreground m-0">Kayıtlı Modeller</h3>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-secondary font-medium text-secondary-foreground border border-border/40">
              ${models.length} Model
            </span>
          </div>
          <span class="text-xs text-muted-foreground">Sohbet ve IDE modunda doğrudan kullanılabilir</span>
        </div>

        <!-- Modeller Listesi (Alt alta yatay liste) -->
        <div class="flex flex-col gap-2.5" id="models-cards-list">
          ${
            models.length === 0
              ? `
            <div class="border border-dashed border-border/60 rounded-xl p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-3">
              <span>Kayıtlı model bulunmuyor. Yukarıdaki formdan dilediğin LLM modelini ekleyebilirsin.</span>
              <button type="button" id="btn-restore-default-models" class="agy-button text-xs h-7 px-3 rounded-lg border border-border/70 hover:bg-secondary text-secondary-foreground hover:text-foreground cursor-pointer transition-colors">
                Örnek Modelleri Yükle
              </button>
            </div>
          `
              : models
                  .map((m) => {
                    const pConf = PROVIDERS_DATA[m.provider] || PROVIDERS_DATA["Özel / OpenAI Uyumlu"];
                    const isOpenRouterCard = m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "");
                    const effectiveKey =
                      (m.apiKey || "").trim() || (isOpenRouterCard ? window.appStore?.getOpenRouterApiKey?.() || "" : "");
                    const isLocalCard = m.provider?.includes("Yerel") || /localhost|127\.0\.0\.1/.test(m.endpoint || "");
                    const maskedKey = effectiveKey
                      ? effectiveKey.length > 8
                        ? `${effectiveKey.slice(0, 4)}••••••••${effectiveKey.slice(-4)}`
                        : "••••••••"
                      : isLocalCard
                        ? "Anahtarsız (Yerel)"
                        : "API Anahtarı Gerekli";
                    return `
              <div class="model-card-item bg-card/30 border ${m.id === editingModelId ? "border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]" : "border-border/70"} rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none" data-model-id="${escapeHtml(m.id)}">
                
                <!-- Sol Taraf: Model Bilgileri & Rozetler -->
                <div class="flex items-start gap-3.5 min-w-0">
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/5" style="background-color: ${pConf.color}15; color: ${pConf.color};">
                    ${pConf.icon}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-foreground">${escapeHtml(m.name)}</span>
                      ${
                        m.isDefault
                          ? `
                        <span class="bg-primary/20 text-primary border border-primary/40 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          ★ Varsayılan
                        </span>
                      `
                          : ""
                      }
                      <span class="text-[10px] px-2 py-0.5 rounded border ${pConf.badgeClass} font-medium">
                        ${escapeHtml(m.provider)}
                      </span>
                      <!-- Tıklanabilir Model Seçici Rozeti -->
                      <button type="button" class="btn-card-choose-submodel text-[11px] font-mono px-2.5 py-0.5 rounded bg-primary/10 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs group/smbtn" data-id="${escapeHtml(m.id)}" title="Bu sağlayıcı içerisindeki modeli seç veya değiştir">
                        <span class="text-primary/70 font-sans font-medium text-[10px]">Model:</span>
                        <span class="font-semibold text-foreground group-hover/smbtn:text-primary font-mono">${escapeHtml(m.modelId || "Model Seç")}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>

                    <!-- Alt Detaylar (Endpoint, Key, Test Durumu) -->
                    <div class="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span class="font-mono text-[11px] text-muted-foreground/80 flex items-center gap-1">
                        🔑 ${maskedKey}
                      </span>
                      ${
                        m.endpoint
                          ? `
                        <span class="font-mono text-[11px] text-muted-foreground/60 truncate max-w-xs" title="${escapeHtml(m.endpoint)}">
                          🌐 ${escapeHtml(m.endpoint.replace(/^https?:\/\//, ""))}
                        </span>
                      `
                          : ""
                      }
                      <!-- Status Badge -->
                      <span class="flex items-center gap-1.5 text-[11px]" id="status-badge-${m.id}">
                        ${renderStatusBadge(m)}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Sağ Taraf: Eylem Butonları (Model Seç, Test, Düzelt, Varsayılan Yap, Sil) -->
                <div class="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  <!-- MODEL SEÇ BUTONU -->
                  <button type="button" class="btn-action-pick-submodel agy-button text-xs h-7 px-2.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 flex items-center gap-1.5 text-primary hover:text-primary-foreground cursor-pointer transition-colors font-medium" data-id="${escapeHtml(m.id)}" title="Bu sağlayıcının modellerini listele ve seç">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span>Model Seç</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  <!-- TEST BUTONU -->
                  <button type="button" class="btn-action-test agy-button text-xs h-7 px-2.5 rounded-lg border border-border/70 hover:bg-secondary flex items-center gap-1.5 text-secondary-foreground hover:text-foreground cursor-pointer transition-colors" data-id="${escapeHtml(m.id)}" title="Model bağlantısını test et">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                    </svg>
                    <span>Test Et</span>
                  </button>

                  <!-- DÜZELT BUTONU -->
                  <button type="button" class="btn-action-edit agy-button text-xs h-7 px-2.5 rounded-lg border border-border/70 hover:bg-secondary flex items-center gap-1.5 text-secondary-foreground hover:text-foreground cursor-pointer transition-colors" data-id="${escapeHtml(m.id)}" title="Modeli düzenle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                    </svg>
                    <span>Düzelt</span>
                  </button>

                  <!-- VARSAYILAN YAP BUTONU (Eğer zaten varsayılan değilse) -->
                  ${
                    !m.isDefault
                      ? `
                    <button type="button" class="btn-action-default agy-button text-xs h-7 px-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors" data-id="${escapeHtml(m.id)}" title="Bu modeli aktif ve varsayılan yap">
                      ★ Seç
                    </button>
                  `
                      : ""
                  }

                  <!-- SİL BUTONU -->
                  <button type="button" class="btn-action-delete agy-button text-xs h-7 w-7 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors" data-id="${escapeHtml(m.id)}" title="Modeli Sil">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                    </svg>
                  </button>
                </div>

              </div>
            `;
                  })
                  .join("")
          }
        </div>
      </div>

    </div>
  `;

  attachModelViewEvents(container);
}

function attachModelViewEvents(container) {
  const providerSelect = container.querySelector("#mf-provider");
  const modelIdInput = container.querySelector("#mf-model-id");
  const endpointInput = container.querySelector("#mf-endpoint");
  const apiKeyInput = container.querySelector("#mf-api-key");
  const nameInput = container.querySelector("#mf-name");
  const isDefaultCheck = container.querySelector("#mf-is-default");
  const testStatusEl = container.querySelector("#mf-test-status");
  const presetSelect = container.querySelector("#mf-model-preset-select");
  const btnFetchLive = container.querySelector("#btn-fetch-live-models");
  const btnScanLocal = container.querySelector("#btn-scan-local-ai");

  btnScanLocal?.addEventListener("click", async () => {
    btnScanLocal.disabled = true;
    btnScanLocal.innerHTML = `<span class="animate-pulse">⏳ Taranıyor...</span>`;
    if (window.discoverLocalAIModels) {
      await window.discoverLocalAIModels({ silent: false });
    }
    renderModelsSettingsView(container);
  });

  container.querySelectorAll(".btn-add-discovered-runtime[data-runtime-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rtId = btn.getAttribute("data-runtime-id");
      const ds = window.luxLocalDiscoveryState || {};
      const rt = (ds.runtimes || []).find((r) => r.id === rtId);
      if (!rt || !window.appStore?.addModel) return;
      if (rtId === "ollama") {
        const fastOllamaPick =
          (rt.models || []).find((id) => id === "qwen3.5:4b") ||
          (rt.models || []).find((id) => id === "qwen2.5:3b") ||
          rt.models?.[0] ||
          "qwen2.5:3b";
        window.appStore.addModel({
          name: "Ollama (Yerel)",
          provider: "Ollama / Yerel",
          modelId: fastOllamaPick,
          endpoint: "http://localhost:11434/v1",
          apiKey: "",
          isDefault: false
        });
      } else if (rtId === "lmstudio") {
        window.appStore.addModel({
          name: "LM Studio (Yerel)",
          provider: "Özel / OpenAI Uyumlu",
          modelId: rt.models?.[0] || "local-model",
          endpoint: "http://localhost:1234/v1",
          apiKey: "",
          isDefault: false
        });
      } else if (rtId === "9router") {
        window.appStore.addModel({
          name: "9Router",
          provider: "Özel / OpenAI Uyumlu",
          modelId: rt.models?.[0] || "oc/beam-free",
          endpoint: "http://localhost:20128/v1",
          apiKey: "",
          isDefault: false
        });
      }
      window.renderApp();
      renderModelsSettingsView(container);
    });
  });

  container.querySelector("#btn-restore-default-models")?.addEventListener("click", () => {
    window.appStore?.restoreDefaultModels?.();
    window.renderApp();
    renderModelsSettingsView(container);
  });

  // Hızlı Ön Tanımlı Model Listesini Doldur
  function populatePresetSelect(providerName) {
    if (!presetSelect) return;
    const submodels = (window.KNOWN_PROVIDER_SUBMODELS?.[providerName] || []).slice();
    presetSelect.innerHTML = `
      <option value="" class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">-- Listeden Model Seçin (${submodels.length} model) --</option>
      ${submodels
        .map(
          (sm) => `
        <option value="${escapeHtml(sm.id)}" class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">${escapeHtml(sm.name)} (${escapeHtml(sm.id)}) ${sm.badge ? `[${escapeHtml(sm.badge)}]` : ""}</option>
      `
        )
        .join("")}
      <option value="__custom__" class="bg-[#16161b] text-primary" style="background-color: #16161b; color: #3B82F6;">+ Özel Model ID Gir</option>
    `;
    presetSelect._customSelectRefresh?.();
  }
  if (providerSelect) populatePresetSelect(providerSelect.value);

  // Initialize Lux Custom Dropdowns
  if (window.makeLuxCustomSelect) {
    if (providerSelect) window.makeLuxCustomSelect(providerSelect);
    if (presetSelect) window.makeLuxCustomSelect(presetSelect);
  }

  // Model Listesinden Seçilince ID Kutusunu Otomatik Doldur
  presetSelect?.addEventListener("change", () => {
    if (presetSelect.value && presetSelect.value !== "__custom__") {
      modelIdInput.value = presetSelect.value;
    } else if (presetSelect.value === "__custom__") {
      modelIdInput.focus();
      modelIdInput.select();
    }
  });

  // Sunucudan Canlı Modelleri Çek Butonu
  btnFetchLive?.addEventListener("click", async () => {
    let ep = endpointInput.value.trim() || "";
    if (!ep) {
      if (providerSelect.value.includes("Yerel")) ep = "http://127.0.0.1:11434/v1";
      else ep = "http://127.0.0.1:20128/v1";
    }
    const perms = window.appStore?.getPermissions?.() || {};
    const isLocalHost = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(ep);
    if (isLocalHost && perms.network_localhost === false) {
      btnFetchLive.innerHTML = `<span class="text-rose-400">Yerel ağ izni kapalı</span>`;
      setTimeout(() => {
        btnFetchLive.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>⚡ Modelleri Getir</span>`;
      }, 2500);
      return;
    }
    if (!isLocalHost && perms.network_internet === false) {
      btnFetchLive.innerHTML = `<span class="text-rose-400">İnternet izni kapalı</span>`;
      setTimeout(() => {
        btnFetchLive.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>⚡ Modelleri Getir</span>`;
      }, 2500);
      return;
    }
    const base = ep.replace(/\/+$/, "");
    const url = base.endsWith("/models") ? base : `${base}/models`;
    btnFetchLive.innerHTML = "<span>⏳ Çekiliyor...</span>";
    try {
      const headers = {};
      const isOpenRouterReq = providerSelect.value === "OpenRouter" || /openrouter\.ai/i.test(ep);
      const effKey = apiKeyInput.value.trim() || (isOpenRouterReq ? window.appStore?.getOpenRouterApiKey?.() || "" : "");
      if (effKey) headers["Authorization"] = `Bearer ${effKey}`;
      if (isOpenRouterReq) {
        headers["X-Title"] = "Lux AI";
      }
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
      });
      const data = await res.json();
      if (data?.data && Array.isArray(data.data)) {
        let list = data.data.slice();
        let freeCount = 0;
        if (isOpenRouterReq) {
          const freeSet = new Set(list.filter((m) => window.isOpenRouterFreeChatModel?.(m)).map((m) => m.id));
          freeCount = freeSet.size;
          list = list
            .filter((m) => !/^(?:google\/lyria-|fish-audio\/|heygen\/)/i.test(m.id || ""))
            .sort((a, b) => {
              if (a.id === "openrouter/free") return -1;
              if (b.id === "openrouter/free") return 1;
              const aFree = freeSet.has(a.id) ? 0 : 1;
              const bFree = freeSet.has(b.id) ? 0 : 1;
              return aFree - bFree;
            });
          presetSelect.innerHTML = `
            <option value="">-- Canlı OpenRouter (${freeCount} Ücretsiz · ${list.length} Toplam) --</option>
            ${list.map((m) => `<option value="${escapeHtml(m.id)}">${freeSet.has(m.id) ? "★ [Ücretsiz] " : ""}${escapeHtml(m.id)}</option>`).join("")}
          `;
          btnFetchLive.innerHTML = `<span class="text-emerald-400">✓ ${freeCount} Ücretsiz / ${list.length}</span>`;
        } else {
          presetSelect.innerHTML = `
            <option value="">-- Canlı Modeller (${list.length} adet) --</option>
            ${list.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)}</option>`).join("")}
          `;
          btnFetchLive.innerHTML = `<span class="text-emerald-400">✓ ${list.length} Model Geldi</span>`;
        }
        presetSelect._customSelectRefresh?.();
      } else {
        btnFetchLive.innerHTML = `<span class="text-rose-400">Model listesi alınamadı</span>`;
      }
    } catch (e) {
      btnFetchLive.innerHTML = `<span class="text-rose-400">Erişim hatası</span>`;
    }
    setTimeout(() => {
      btnFetchLive.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>⚡ Modelleri Getir</span>`;
    }, 2500);
  });

  // Provider changed -> Auto-suggest endpoint & model id if user hasn't typed custom
  providerSelect?.addEventListener("change", () => {
    const prov = PROVIDERS_DATA[providerSelect.value];
    populatePresetSelect(providerSelect.value);
    if (prov && !editingModelId) {
      if (endpointInput) endpointInput.value = prov.endpoint;
      if (modelIdInput) {
        modelIdInput.placeholder = prov.placeholderModel;
        modelIdInput.value = prov.placeholderModel;
      }
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = providerSelect.value;
      }
      if (providerSelect.value === "OpenRouter" && apiKeyInput && !apiKeyInput.value.trim()) {
        const sharedOrKey = window.appStore?.getOpenRouterApiKey?.() || "";
        if (sharedOrKey) apiKeyInput.value = sharedOrKey;
      }
    }
  });

  // Password Visibility Toggle
  const btnToggleKey = container.querySelector("#btn-toggle-key-visibility");
  const iconEyeOpen = container.querySelector("#icon-eye-open");
  const iconEyeClosed = container.querySelector("#icon-eye-closed");
  btnToggleKey?.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      iconEyeOpen.classList.add("hidden");
      iconEyeClosed.classList.remove("hidden");
    } else {
      apiKeyInput.type = "password";
      iconEyeOpen.classList.remove("hidden");
      iconEyeClosed.classList.add("hidden");
    }
  });

  // Form Pre-test button
  const btnPretest = container.querySelector("#btn-mf-pretest");
  btnPretest?.addEventListener("click", async () => {
    if (!nameInput.value.trim() && !modelIdInput.value.trim()) {
      testStatusEl.innerHTML = '<span class="text-rose-400 font-medium">Lütfen model adını veya ID girin!</span>';
      return;
    }

    testStatusEl.innerHTML = `
      <span class="text-amber-400 flex items-center gap-1.5 font-medium">
        <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
        <span>Bağlantı sınanıyor...</span>
      </span>
    `;

    const isLocal =
      providerSelect.value.includes("Yerel") ||
      (endpointInput.value && (endpointInput.value.includes("localhost") || endpointInput.value.includes("127.0.0.1")));
    const isOrProvider = providerSelect.value === "OpenRouter" || /openrouter\.ai/i.test(endpointInput.value || "");
    let rawKey = apiKeyInput.value.trim();
    if (rawKey.includes("••••") && editingModelId) {
      const existing = window.appStore.getModels().find((m) => m.id === editingModelId);
      if (existing) {
        rawKey = await window.appStore.resolveModelApiKey(existing);
      }
    }
    if (!rawKey && isOrProvider) {
      rawKey = await window.appStore.resolveOpenRouterApiKey();
    }
    if (!rawKey && !isLocal) {
      testStatusEl.innerHTML = '<span class="text-rose-400 font-medium">⚠ API Anahtarı eksik!</span>';
    } else if (isOrProvider && rawKey) {
      const t0 = Date.now();
      try {
        const baseEp = (endpointInput.value.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
        const res = await fetch(`${baseEp}/key`, {
          headers: { Authorization: `Bearer ${rawKey}`, "X-Title": "Lux AI" },
          signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
        });
        const elapsed = Date.now() - t0;
        if (res.ok) {
          const kjson = await res.json().catch(() => ({}));
          const fq = kjson?.data?.free_model_daily_requests;
          const qInfo = fq && typeof fq.remaining === "number" ? ` · Kalan: ${fq.remaining}/${fq.limit}` : "";
          testStatusEl.innerHTML = `<span class="text-emerald-400 font-medium flex items-center gap-1">✓ Başarılı (200 OK${qInfo} - ${elapsed}ms)</span>`;
        } else {
          const errJson = await res.json().catch(() => ({}));
          testStatusEl.innerHTML = `<span class="text-rose-400 font-medium">✗ Hata (${res.status}): ${escapeHtml(errJson?.error?.message || "Geçersiz anahtar")}</span>`;
        }
      } catch (e) {
        testStatusEl.innerHTML = `<span class="text-rose-400 font-medium">✗ Bağlantı hatası: ${escapeHtml(e.message || "Zaman aşımı")}</span>`;
      }
    } else {
      const t0 = Date.now();
      try {
        const timeoutSig = AbortSignal.timeout ? AbortSignal.timeout(isLocal ? 12000 : 12000) : undefined;
        let res;
        if (providerSelect.value === "Google Gemini") {
          let mId = modelIdInput.value.trim() || "gemini-3.5-flash-lite";
          if (mId === "gemini/auto-router") mId = "gemini-2.5-flash";
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mId}:generateContent?key=${rawKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }),
            signal: timeoutSig
          });
        } else if (providerSelect.value === "Anthropic") {
          res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": rawKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: modelIdInput.value.trim() || "claude-3-5-sonnet-20241022",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }]
            }),
            signal: timeoutSig
          });
        } else {
          if (isLocal && /11434/.test(endpointInput.value || "")) {
            await window.luxAPI?.ensureOllama?.().catch(() => {});
          }
          const base = (endpointInput.value.trim() || (isLocal ? "http://127.0.0.1:11434/v1" : "https://api.openai.com/v1")).replace(
            /\/+$/,
            ""
          );
          const headers = { "Content-Type": "application/json" };
          if (rawKey) headers["Authorization"] = `Bearer ${rawKey}`;
          if (isLocal && /11434/.test(base)) {
            const root = base.replace(/\/v1$/i, "");
            res = await fetch(`${root}/api/tags`, { signal: timeoutSig });
          } else {
            const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
            res = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: modelIdInput.value.trim() || "gpt-4o",
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 1
              }),
              signal: timeoutSig
            });
          }
        }
        const elapsed = Date.now() - t0;
        if (res && res.ok) {
          testStatusEl.innerHTML = `<span class="text-emerald-400 font-medium flex items-center gap-1">✓ Başarılı (200 OK - ${elapsed}ms)</span>`;
        } else {
          const errJson = res ? await res.json().catch(() => ({})) : {};
          testStatusEl.innerHTML = `<span class="text-rose-400 font-medium">✗ Hata (${res ? res.status : "Bağlantı"}): ${escapeHtml(errJson?.error?.message || errJson?.error || "Sunucu yanıt vermedi")}</span>`;
        }
      } catch (e) {
        testStatusEl.innerHTML = `<span class="text-rose-400 font-medium">✗ Bağlantı hatası: ${escapeHtml(e.message || "Ulaşılamadı")}</span>`;
      }
    }
  });

  // Save / Update button
  const btnSave = container.querySelector("#btn-mf-save");
  btnSave?.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const modelId = modelIdInput.value.trim();
    if (!name) {
      if (testStatusEl) {
        testStatusEl.innerHTML = '<span class="text-rose-400 font-medium">Lütfen bir model adı (etiket) belirleyin.</span>';
      }
      nameInput.focus();
      return;
    }
    if (!modelId) {
      if (testStatusEl) {
        testStatusEl.innerHTML = '<span class="text-rose-400 font-medium">Lütfen bir Model ID (API Kodu) girin.</span>';
      }
      modelIdInput.focus();
      return;
    }

    const inputKey = apiKeyInput.value.trim();
    const existingModel = editingModelId ? window.appStore.getModels().find((m) => m.id === editingModelId) : null;
    const finalKey = (inputKey.includes("••••") && existingModel) ? existingModel.apiKey : inputKey;

    const modelData = {
      name: name,
      provider: providerSelect.value,
      modelId: modelId,
      endpoint: endpointInput.value.trim(),
      apiKey: finalKey,
      isDefault: isDefaultCheck.checked
    };

    if (editingModelId) {
      window.appStore.updateModel(editingModelId, modelData);
      editingModelId = null;
    } else {
      window.appStore.addModel(modelData);
    }

    window.renderApp();
    renderModelsSettingsView(container);
  });

  // Cancel Edit Mode Button
  const btnCancelEdit = container.querySelector("#btn-cancel-edit-mode");
  btnCancelEdit?.addEventListener("click", () => {
    editingModelId = null;
    renderModelsSettingsView(container);
  });

  // List Item Buttons: Test, Edit, Default, Delete
  container.querySelectorAll(".btn-action-test").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
        <span>Test...</span>
      `;

      await window.appStore.testModel(id);
      btn.disabled = false;
      btn.innerHTML = originalHTML;

      // Update badge in place
      const badge = container.querySelector(`#status-badge-${id}`);
      const updatedModel = window.appStore.getModels().find((m) => m.id === id);
      if (badge && updatedModel) {
        badge.innerHTML = renderStatusBadge(updatedModel);
      }
    });
  });

  container.querySelectorAll(".btn-action-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      editingModelId = id;
      renderModelsSettingsView(container);
      container.scrollTop = 0;
      setTimeout(() => {
        container.querySelector("#mf-name")?.focus();
      }, 50);
    });
  });

  container.querySelectorAll(".btn-action-default").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      window.appStore.setDefaultModel(id);
      window.renderApp();
      renderModelsSettingsView(container);
    });
  });

  container.querySelectorAll(".btn-action-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.confirmPending !== "true") {
        btn.dataset.confirmPending = "true";
        const origHtml = btn.innerHTML;
        btn.classList.remove("w-7");
        btn.classList.add("px-2", "bg-red-500/20", "text-red-400", "border", "border-red-500/30");
        btn.textContent = "Sil?";
        setTimeout(() => {
          if (btn.isConnected && btn.dataset.confirmPending === "true") {
            btn.dataset.confirmPending = "false";
            btn.classList.remove("px-2", "bg-red-500/20", "text-red-400", "border", "border-red-500/30");
            btn.classList.add("w-7");
            btn.innerHTML = origHtml;
          }
        }, 3000);
        return;
      }

      const id = btn.getAttribute("data-id");
      if (editingModelId === id) editingModelId = null;
      window.appStore.deleteModel(id);
      window.renderApp();
      renderModelsSettingsView(container);
    });
  });

  // MODEL SEÇME TIKLAMA OLAYLARI (Hem rozet hem de 'Model Seç' butonu)
  container.querySelectorAll(".btn-action-pick-submodel, .btn-card-choose-submodel").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const model = window.appStore.getModels().find((m) => m.id === id);
      if (model) {
        openCardModelSelectionModal(model, container);
      }
    });
  });
}

// 1:1 Lux Card Model Selection Modal Component
function openCardModelSelectionModal(model, parentContainer) {
  document.getElementById("card-model-picker-modal")?.remove();

  const providerName = model.name;
  let submodels = (window.KNOWN_PROVIDER_SUBMODELS?.[providerName] || window.KNOWN_PROVIDER_SUBMODELS?.[model.provider] || []).slice();

  if (submodels.length === 0) {
    if (model.endpoint?.includes("1234") || model.name.includes("LM Studio")) {
      submodels = (window.KNOWN_PROVIDER_SUBMODELS?.["LM Studio (Yerel)"] || []).slice();
    } else if (model.provider.includes("Yerel") || model.endpoint?.includes("11434")) {
      submodels = (window.KNOWN_PROVIDER_SUBMODELS?.["Ollama (Yerel)"] || []).slice();
    } else if (model.endpoint?.includes("20128") || model.name.includes("9Router")) {
      submodels = (window.KNOWN_PROVIDER_SUBMODELS?.["9Router"] || []).slice();
    } else if (model.endpoint?.includes("openrouter.ai") || model.provider === "OpenRouter") {
      submodels = (window.KNOWN_PROVIDER_SUBMODELS?.["OpenRouter"] || []).slice();
    } else {
      submodels = [{ id: model.modelId || "default", name: model.name, tag: "Mevcut Model", badge: "Aktif" }];
    }
  }

  // Ensure current active modelId is in the list
  if (model.modelId && !submodels.some((sm) => sm.id === model.modelId)) {
    submodels.unshift({
      id: model.modelId,
      name: model.modelId,
      tag: "Özel Model",
      badge: "Kullanıcı"
    });
  }

  const modalEl = document.createElement("div");
  modalEl.id = "card-model-picker-modal";
  modalEl.className = "lux-modal-backdrop show";
  modalEl.style.zIndex = "1300";

  const renderModalContent = (filterText = "") => {
    const q = filterText.toLowerCase().trim();
    const filtered = q
      ? submodels.filter((sm) => (sm.name && sm.name.toLowerCase().includes(q)) || (sm.id && sm.id.toLowerCase().includes(q)))
      : submodels;

    return `
      <div class="lux-modal max-w-xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        
        <!-- Header -->
        <div class="p-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-sidebar/50">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="truncate">
              <h3 class="text-sm font-semibold text-foreground m-0 flex items-center gap-2 truncate">
                <span>${escapeHtml(model.name)} - Model Seçimi</span>
              </h3>
              <p class="text-[11px] text-muted-foreground m-0 mt-0.5 font-mono truncate">
                Aktif: <span class="text-primary font-semibold">${escapeHtml(model.modelId)}</span> · ${escapeHtml(model.endpoint || model.provider)}
              </p>
            </div>
          </div>
          <button type="button" id="btn-close-card-picker" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" title="Kapat (Esc)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
        </div>

        <!-- Search Bar & Live Fetch -->
        <div class="p-3 border-b border-border/40 bg-background/50 flex items-center gap-2 shrink-0">
          <div class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 focus-within:border-primary/60 transition-colors">
            <svg class="text-muted-foreground shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="card-picker-search-input" value="${escapeHtml(filterText)}" placeholder="Model ara (örn: beam, free, qwen, llama, gpt)..." class="w-full bg-transparent text-xs text-foreground outline-none font-sans" autofocus />
          </div>
          <button type="button" id="btn-card-picker-fetch-live" class="agy-button text-xs h-8 px-3 rounded-lg border border-border/70 hover:bg-secondary text-secondary-foreground hover:text-foreground cursor-pointer transition-colors flex items-center gap-1.5 shrink-0" title="Sunucudan canlı modelleri güncelle">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Canlı Çek</span>
          </button>
        </div>

        <!-- Info / Subtitle -->
        <div class="px-4 py-1.5 bg-secondary/20 border-b border-border/30 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span>Toplam <strong>${submodels.length}</strong> model bulundu (${filtered.length} listeleniyor)</span>
          <span class="text-[10px] text-primary">Kullanmak istediğiniz modele tıklayın</span>
        </div>

        <!-- Models List -->
        <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 max-h-[380px] custom-scrollbar" id="card-picker-models-list">
          ${
            filtered.length === 0
              ? `
            <div class="p-6 text-center text-xs text-muted-foreground">
              Arama kriterine uygun model bulunamadı. Aşağıdan özel model ID girebilirsiniz.
            </div>
          `
              : filtered
                  .map((sm) => {
                    const isSelected = sm.id === model.modelId;
                    return `
              <div class="card-submodel-row p-2.5 rounded-xl border ${isSelected ? "border-primary/50 bg-primary/10 shadow-sm" : "border-border/50 bg-background/40 hover:bg-secondary/60 hover:border-border"} flex items-center justify-between gap-3 cursor-pointer transition-all" data-submodel-id="${escapeHtml(sm.id)}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-4 h-4 rounded-full border ${isSelected ? "border-primary bg-primary flex items-center justify-center text-primary-foreground" : "border-border/80"} shrink-0">
                    ${isSelected ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ""}
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-semibold font-mono text-foreground tracking-tight">${escapeHtml(sm.id)}</span>
                      ${sm.badge ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full ${sm.badge === "Önerilen" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-secondary text-muted-foreground border border-border/40"} font-medium shrink-0">${escapeHtml(sm.badge)}</span>` : ""}
                    </div>
                    ${sm.desc || sm.tag ? `<p class="text-[11px] text-muted-foreground m-0 mt-0.5 truncate">${escapeHtml(sm.desc || sm.tag)}</p>` : ""}
                  </div>
                </div>

                <button type="button" class="agy-button text-xs px-2.5 py-1 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "border border-border/70 hover:bg-secondary text-secondary-foreground"} font-medium shrink-0 pointer-events-none">
                  ${isSelected ? "✓ Aktif Model" : "Seç"}
                </button>
              </div>
            `;
                  })
                  .join("")
          }
        </div>

        <!-- Custom Model Input Bottom Bar -->
        <div class="p-3 border-t border-border/50 bg-sidebar/40 flex items-center gap-2 shrink-0">
          <input type="text" id="card-custom-submodel-input" placeholder="Listede olmayan özel bir model ID yazın (örn: gpt-4o, claude-3-5-sonnet)..." class="model-input-field flex-1 font-mono text-xs" />
          <button type="button" id="btn-apply-card-custom-submodel" class="agy-button px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors cursor-pointer shrink-0">
            Seç ve Uygula
          </button>
        </div>

      </div>
    `;
  };

  const attachPickerEvents = () => {
    // Close
    modalEl.querySelector("#btn-close-card-picker")?.addEventListener("click", () => modalEl.remove());
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) modalEl.remove();
    });

    // Search filter
    const searchInput = modalEl.querySelector("#card-picker-search-input");
    searchInput?.addEventListener("input", (e) => {
      const q = e.target.value;
      modalEl.innerHTML = renderModalContent(q);
      attachPickerEvents();
      const newSearch = modalEl.querySelector("#card-picker-search-input");
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(q.length, q.length);
      }
    });

    // Select row click
    modalEl.querySelectorAll(".card-submodel-row").forEach((row) => {
      row.addEventListener("click", () => {
        const subId = row.getAttribute("data-submodel-id");
        if (subId) {
          selectAndSave(subId);
        }
      });
    });

    // Custom model apply
    const customInput = modalEl.querySelector("#card-custom-submodel-input");
    const btnApplyCustom = modalEl.querySelector("#btn-apply-card-custom-submodel");
    const doApply = () => {
      const val = customInput?.value?.trim();
      if (val) selectAndSave(val);
    };
    btnApplyCustom?.addEventListener("click", doApply);
    customInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doApply();
      }
    });

    // Live fetch button
    modalEl.querySelector("#btn-card-picker-fetch-live")?.addEventListener("click", async () => {
      await fetchLiveModels();
    });
  };

  const selectAndSave = (selectedSubId) => {
    model.modelId = selectedSubId;
    window.appStore.updateModel(model.id, { modelId: selectedSubId });
    if (model.isDefault) {
      window.appStore.state.selectedModel = model.name;
    }
    window.appStore.saveState();
    modalEl.remove();
    renderModelsSettingsView(parentContainer);
    window.renderApp();
  };

  const fetchLiveModels = async () => {
    const fetchBtn = modalEl.querySelector("#btn-card-picker-fetch-live");
    if (fetchBtn) fetchBtn.innerHTML = "<span>⏳ Çekiliyor...</span>";

    let endpoint = model.endpoint || "";
    if (!endpoint) {
      if (model.name.includes("9Router")) endpoint = "http://127.0.0.1:20128/v1";
      else if (model.name.includes("Ollama")) endpoint = "http://127.0.0.1:11434/v1";
    }

    const perms = window.appStore?.getPermissions?.() || {};
    const isLocalHost = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(endpoint);
    if (endpoint && ((isLocalHost && perms.network_localhost === false) || (!isLocalHost && perms.network_internet === false))) {
      if (fetchBtn) fetchBtn.innerHTML = `<span class="text-rose-400">İzin Kapalı</span>`;
      return;
    }

    if (endpoint) {
      const base = endpoint.replace(/\/+$/, "");
      const url = base.endsWith("/models") ? base : `${base}/models`;
      try {
        const isOr = model.provider === "OpenRouter" || /openrouter\.ai/i.test(endpoint);
        const effKey = (model.apiKey || "").trim() || (isOr ? window.appStore?.getOpenRouterApiKey?.() || "" : "");
        const headers = {};
        if (effKey) headers["Authorization"] = `Bearer ${effKey}`;
        if (isOr) headers["X-Title"] = "Lux AI";
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
        });
        const data = await res.json();
        if (data?.data && Array.isArray(data.data)) {
          let list = data.data.slice();
          if (isOr) {
            const freeSet = new Set(list.filter((m) => window.isOpenRouterFreeChatModel?.(m)).map((m) => m.id));
            list = list
              .filter((m) => !/^(?:google\/lyria-|fish-audio\/|heygen\/)/i.test(m.id || ""))
              .sort((a, b) => {
                if (a.id === "openrouter/free") return -1;
                if (b.id === "openrouter/free") return 1;
                return (freeSet.has(a.id) ? 0 : 1) - (freeSet.has(b.id) ? 0 : 1);
              });
            list.forEach((m) => {
              if (!submodels.some((sm) => sm.id === m.id)) {
                const isFree = freeSet.has(m.id);
                const ctxK = m.context_length ? `${Math.round(m.context_length / 1000)}K` : "";
                submodels.push({
                  id: m.id,
                  name: m.name || m.id,
                  tag: isFree ? `${ctxK ? ctxK + " · " : ""}Canlı OpenRouter ($0)` : `${ctxK ? ctxK + " · " : ""}OpenRouter Ücretli`,
                  badge: isFree ? "Ücretsiz" : "OpenRouter"
                });
              }
            });
          } else {
            list.forEach((m) => {
              if (!submodels.some((sm) => sm.id === m.id)) {
                submodels.push({
                  id: m.id,
                  name: m.id,
                  tag: "Sunucu Modeli",
                  badge: m.id.includes("free") || m.id.startsWith("oc/") ? "Ücretsiz" : "Canlı"
                });
              }
            });
          }
          modalEl.innerHTML = renderModalContent(modalEl.querySelector("#card-picker-search-input")?.value || "");
          attachPickerEvents();
        }
      } catch (e) {
        console.warn("Live models fetch error:", e);
      }
    }
    if (fetchBtn) fetchBtn.innerHTML = `<span>✓ Güncellendi</span>`;
  };

  document.body.appendChild(modalEl);
  modalEl.innerHTML = renderModalContent();
  attachPickerEvents();

  // Auto-fetch in background if 9Router, Ollama or OpenRouter to get complete live models list
  if (
    model.endpoint?.includes("20128") ||
    model.endpoint?.includes("11434") ||
    model.endpoint?.includes("openrouter.ai") ||
    model.provider === "OpenRouter" ||
    model.name.includes("9Router") ||
    model.name.includes("Ollama")
  ) {
    fetchLiveModels();
  }
}

window.openSettingsModal = function (tab = "general") {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.classList.add("show");
    renderSettingsProjectsNav();
    switchSettingsTab(tab);
  }
};

window.closeSettingsModal = function () {
  editingModelId = null;
  document.getElementById("settings-modal")?.classList.remove("show");
};

window.openPalette = function () {
  const modal = document.getElementById("palette-modal");
  const input = document.getElementById("palette-input");
  if (modal) {
    paletteSelectedIdx = 0;
    if (input) input.value = "";
    renderPaletteResults();
    modal.classList.add("show");
    setTimeout(() => input?.focus(), 50);
  }
};

window.closePalette = function () {
  document.getElementById("palette-modal")?.classList.remove("show");
};

window.switchSettingsTab = switchSettingsTab;
window.renderPermissionsSettingsView = renderPermissionsSettingsView;
window.renderNotificationsSettingsView = renderNotificationsSettingsView;
