// Left Sidebar Component (100% Exact Lux Markup & Context Menus)
let sidebarFilterOpen = false;
let sidebarFilterQuery = "";
let sidebarAddProjectOpen = false;
let sidebarAddProjectPath = "";

function basenameFromAnyPath(p) {
  const parts = String(p || "")
    .split(/[\\/]/)
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(p || "");
}

function safeText(str) {
  return typeof escapeHtml === "function"
    ? escapeHtml(str)
    : String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const state = window.appStore.state;
  const q = (sidebarFilterQuery || "").trim().toLowerCase();
  const filteredProjects = (state.projects || [])
    .map((proj) => {
      if (!q) return { proj, convs: proj.conversations || [] };
      const projMatches = (proj.name || "").toLowerCase().includes(q);
      const matchingConvs = (proj.conversations || []).filter((c) => (c.title || "").toLowerCase().includes(q));
      if (projMatches) return { proj, convs: proj.conversations || [] };
      if (matchingConvs.length > 0) return { proj, convs: matchingConvs, forceExpand: true };
      return null;
    })
    .filter(Boolean);

  container.innerHTML = `
    <div role="navigation" aria-label="Sidebar" class="h-full w-full flex flex-col pb-2 bg-sidebar select-none" style="background-color: var(--sidebar);">
      
      <!-- Top Action Links -->
      <div class="px-2 pt-2.5">
        <div class="flex flex-col gap-1.5" data-testid="sidebar-navigation-items">
          <!-- New Conversation -->
          <button id="btn-new-conversation" class="agy-button agy-button-custom inline-flex items-center font-medium transition-colors select-none outline-none cursor-pointer flex-grow w-full justify-start font-normal h-8 min-w-0 gap-1.5 px-2 py-1 rounded-lg border border-border text-foreground bg-sidebar-muted hover:bg-sidebar-secondary" data-testid="new-conversation-button">
            <span class="shrink-0 flex items-center">${ICONS.plus}</span>
            <span class="truncate text-sm">Yeni Sohbet</span>
          </button>

          <!-- Automations -->
          <button id="btn-automations" class="agy-button agy-button-custom inline-flex items-center font-medium transition-colors select-none outline-none cursor-pointer flex-grow w-full justify-start font-normal h-8 min-w-0 gap-1.5 px-2 py-1 rounded-lg bg-transparent text-secondary-foreground hover:bg-sidebar-muted hover:text-foreground" data-testid="automations-button">
            <span class="shrink-0 flex items-center">${ICONS.automations}</span>
            <span class="truncate text-sm">Otomasyonlar</span>
          </button>

          <!-- Customizations -->
          <button id="btn-customizations" class="agy-button agy-button-custom inline-flex items-center font-medium transition-colors select-none outline-none cursor-pointer flex-grow w-full justify-start font-normal h-8 min-w-0 gap-1.5 px-2 py-1 rounded-lg bg-transparent text-secondary-foreground hover:bg-sidebar-muted hover:text-foreground" data-testid="customizations-button">
            <span class="shrink-0 flex items-center">${ICONS.customizations}</span>
            <span class="truncate text-sm">Özelleştirmeler</span>
          </button>
        </div>
      </div>

      <!-- Projects Section -->
      <div class="flex flex-col flex-1 min-h-0 mt-3 px-2 overflow-y-auto custom-scrollbar">
        <!-- Projects Section Header -->
        <div class="flex items-center justify-between px-2 py-1 text-xs font-semibold text-secondary-foreground uppercase tracking-wider">
          <span>Projeler</span>
          <div class="flex items-center gap-1">
            <button id="btn-filter-projects" class="p-1 rounded hover:bg-secondary ${sidebarFilterOpen ? "text-primary bg-secondary/70" : "text-secondary-foreground hover:text-foreground"} transition-colors cursor-pointer" title="Filtrele">
              ${ICONS.filter}
            </button>
            <button id="btn-add-project" class="p-1 rounded hover:bg-secondary ${sidebarAddProjectOpen ? "text-primary bg-secondary/70" : "text-secondary-foreground hover:text-foreground"} transition-colors cursor-pointer" title="Yeni Proje (klasör yoluyla)">
              ${ICONS.newFolder}
            </button>
          </div>
        </div>

        ${
          sidebarFilterOpen
            ? `
          <div id="sidebar-filter-box" class="px-1 py-1">
            <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 border border-border/80">
              <input id="sidebar-filter-input" type="text" value="${safeText(sidebarFilterQuery)}" placeholder="Proje veya sohbet ara..." class="flex-1 bg-transparent text-xs text-foreground outline-none min-w-0" />
              ${sidebarFilterQuery ? `<button id="btn-clear-sidebar-filter" type="button" class="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer" title="Temizle">✕</button>` : ""}
            </div>
          </div>
        `
            : ""
        }

        ${
          sidebarAddProjectOpen
            ? `
          <div id="sidebar-add-project-box" class="px-1 py-1">
            <div class="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card border border-primary/50 shadow-sm">
              <input id="input-new-project-name" type="text" placeholder="Proje adı..." class="flex-1 bg-transparent text-xs text-foreground outline-none min-w-0" />
              <button id="btn-browse-project-path" type="button" class="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors" title="Klasör seç — proje dosya yolunu bağla">${ICONS.folder}</button>
              <button id="btn-confirm-add-project" type="button" class="text-[11px] px-1.5 py-0.5 rounded bg-primary text-white hover:bg-primary/90 cursor-pointer shrink-0">Ekle</button>
              <button id="btn-cancel-add-project" type="button" class="text-[11px] px-1 py-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0">✕</button>
            </div>
            ${
              sidebarAddProjectPath
                ? `<div id="new-project-path-hint" class="px-2 pt-1 text-[10px] text-muted-foreground truncate" title="${safeText(sidebarAddProjectPath)}">${safeText(sidebarAddProjectPath)}</div>`
                : ""
            }
          </div>
        `
            : ""
        }

        <!-- Project Folders & Conversations List -->
        <div class="flex flex-col gap-0.5 mt-1" id="projects-tree">
          ${
            filteredProjects.length === 0
              ? `
            <div class="px-3 py-4 text-center text-[11px] text-muted-foreground/70 italic">Eşleşen proje veya sohbet bulunamadı</div>
          `
              : filteredProjects
                  .map(({ proj, convs, forceExpand }) => {
                    const isExpanded = forceExpand || proj.expanded !== false;
                    return `
              <div class="project-group relative w-full group/header flex flex-col mb-0.5" data-project-id="${safeText(proj.id)}">
                <!-- Project Row (Exact Lux Layout with ⋮ and + actions on hover) -->
                <div class="project-header relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-secondary-foreground hover:bg-secondary/60 hover:text-foreground cursor-pointer transition-colors" data-project-id="${safeText(proj.id)}">
                  <div class="flex items-center gap-1.5 truncate pr-14 min-w-0">
                    <span class="shrink-0 transform transition-transform ${isExpanded ? "rotate-90" : ""} text-muted-foreground text-[10px]">
                      ${ICONS.chevronRight}
                    </span>
                    <span class="shrink-0 text-muted-foreground">${ICONS.folder}</span>
                    <span class="truncate project-name-span">${safeText(proj.name)}</span>
                  </div>

                  <!-- Right actions on hover: Options (⋮) & New Chat (+) -->
                  <div class="absolute right-1 top-0 bottom-0 flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
                    <button type="button" class="btn-project-options p-1 rounded hover:bg-sidebar-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors flex items-center justify-center h-6 w-6" data-project-id="${safeText(proj.id)}" title="Proje Seçenekleri">
                      ${ICONS.kebab}
                    </button>
                    <button type="button" class="btn-project-add-conv p-1 rounded hover:bg-sidebar-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors flex items-center justify-center h-6 w-6" data-project-id="${safeText(proj.id)}" title="Projede Yeni Sohbet">
                      ${ICONS.plus}
                    </button>
                  </div>
                </div>

                <!-- Conversations under this project -->
                ${
                  isExpanded
                    ? `
                  <div class="conversations-list flex flex-col gap-0.5 pl-4 pr-1 py-0.5">
                    ${
                      convs && convs.length > 0
                        ? convs
                            .map((conv) => {
                              const isActive = conv.id === state.activeConversationId;
                              return `
                        <div class="conversation-item relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer group transition-all ${isActive ? "bg-[#1a1b20] text-foreground font-medium border border-white/10 shadow-sm" : "text-secondary-foreground hover:bg-secondary/60 hover:text-foreground"}" data-conversation-id="${safeText(conv.id)}" data-project-id="${safeText(proj.id)}">
                          <div class="flex items-center gap-1.5 truncate mr-2 min-w-0 title-container">
                            ${conv.pinned ? `<span class="text-[11px] text-amber-400 shrink-0" title="Sabitlendi">📌</span>` : ""}
                            <span class="truncate conv-title-span">${safeText(conv.title)}</span>
                          </div>
                          <div class="flex items-center gap-1 shrink-0">
                            ${
                              conv.isDot
                                ? `
                              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-1 shrink-0" title="Okunmadı"></span>
                            `
                                : `
                              <span class="text-[11px] text-muted-foreground shrink-0">${safeText(conv.timestamp || "")}</span>
                            `
                            }
                            <button type="button" class="conv-options-btn opacity-0 group-hover:opacity-100 ${isActive ? "opacity-100" : ""} p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer transition-opacity flex items-center justify-center shrink-0" title="Seçenekler">
                              ${ICONS.dragHandle}
                            </button>
                          </div>
                        </div>
                      `;
                            })
                            .join("")
                        : `
                      <div class="px-2 py-1 text-[11px] text-muted-foreground/60 italic">Henüz sohbet yok</div>
                    `
                    }
                  </div>
                `
                    : ""
                }
              </div>
            `;
                  })
                  .join("")
          }
        </div>
      </div>

      <!-- Bottom Settings Row -->
      <div class="px-2 pt-2 border-t border-border mt-auto">
        <button id="btn-settings" class="agy-button agy-button-custom inline-flex items-center font-medium transition-colors select-none outline-none cursor-pointer flex-grow w-full justify-start font-normal h-8 min-w-0 gap-1.5 px-2 py-1 rounded-lg bg-transparent text-secondary-foreground hover:bg-sidebar-muted hover:text-foreground" data-testid="settings-button">
          <span class="shrink-0 flex items-center">${ICONS.settings}</span>
          <span class="truncate text-sm">Ayarlar</span>
        </button>
      </div>

    </div>
  `;

  // Attach Event Listeners
  setupSidebarEvents();
}

function setupSidebarEvents() {
  document.getElementById("btn-new-conversation")?.addEventListener("click", () => {
    window.appStore.createConversation("Yeni Sohbet");
    window.renderApp();
  });

  document.getElementById("btn-automations")?.addEventListener("click", () => {
    window.openSettingsModal("otomasyonlar");
  });

  document.getElementById("btn-customizations")?.addEventListener("click", () => {
    window.openSettingsModal("ozellestirmeler");
  });

  document.getElementById("btn-filter-projects")?.addEventListener("click", () => {
    sidebarFilterOpen = !sidebarFilterOpen;
    if (!sidebarFilterOpen) sidebarFilterQuery = "";
    renderSidebar();
    if (sidebarFilterOpen) {
      setTimeout(() => document.getElementById("sidebar-filter-input")?.focus(), 20);
    }
  });

  const filterInput = document.getElementById("sidebar-filter-input");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      sidebarFilterQuery = e.target.value;
      const selStart = e.target.selectionStart;
      renderSidebar();
      const restored = document.getElementById("sidebar-filter-input");
      if (restored) {
        restored.focus();
        try {
          restored.setSelectionRange(selStart, selStart);
        } catch (_) {}
      }
    });
    filterInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        sidebarFilterOpen = false;
        sidebarFilterQuery = "";
        renderSidebar();
      }
    });
  }

  document.getElementById("btn-clear-sidebar-filter")?.addEventListener("click", () => {
    sidebarFilterQuery = "";
    renderSidebar();
    document.getElementById("sidebar-filter-input")?.focus();
  });

  // btn-add-project: önce yerel klasör seçiciyle gerçek dosya yolunu BUL;
  // klasör seçilirse proje adı klasör adından türetilir ve path'e bağlanır.
  // Seçici iptal edilirse (veya ortamda pickFolder yoksa) eski ad-only inline akışa düş.
  document.getElementById("btn-add-project")?.addEventListener("click", async () => {
    if (window.luxAPI?.pickFolder) {
      const res = await window.luxAPI.pickFolder().catch(() => null);
      if (res && !res.canceled && res.path) {
        window.appStore.addProject(basenameFromAnyPath(res.path), res.path);
        sidebarAddProjectOpen = false;
        sidebarAddProjectPath = "";
        window.renderApp();
        return;
      }
    }
    sidebarAddProjectPath = "";
    sidebarAddProjectOpen = !sidebarAddProjectOpen;
    renderSidebar();
    if (sidebarAddProjectOpen) {
      setTimeout(() => document.getElementById("input-new-project-name")?.focus(), 20);
    }
  });

  const commitAddProject = () => {
    const input = document.getElementById("input-new-project-name");
    const name = input?.value?.trim();
    const projPath = sidebarAddProjectPath || "";
    if (name) {
      window.appStore.addProject(name, projPath);
      sidebarAddProjectOpen = false;
      sidebarAddProjectPath = "";
      window.renderApp();
    } else {
      sidebarAddProjectOpen = false;
      sidebarAddProjectPath = "";
      renderSidebar();
    }
  };

  document.getElementById("btn-browse-project-path")?.addEventListener("click", async () => {
    const res = await window.luxAPI?.pickFolder?.().catch(() => null);
    if (!res || res.canceled || !res.path) return;
    sidebarAddProjectPath = res.path;
    const input = document.getElementById("input-new-project-name");
    if (input && !input.value.trim()) {
      input.value = basenameFromAnyPath(res.path);
    }
    renderSidebar();
    setTimeout(() => document.getElementById("input-new-project-name")?.focus(), 20);
  });

  document.getElementById("btn-confirm-add-project")?.addEventListener("click", commitAddProject);
  document.getElementById("btn-cancel-add-project")?.addEventListener("click", () => {
    sidebarAddProjectOpen = false;
    sidebarAddProjectPath = "";
    renderSidebar();
  });
  document.getElementById("input-new-project-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAddProject();
    } else if (e.key === "Escape") {
      sidebarAddProjectOpen = false;
      sidebarAddProjectPath = "";
      renderSidebar();
    }
  });

  // Project Header Handlers (Collapse, Options, Add Conversation)
  document.querySelectorAll(".project-header").forEach((el) => {
    // Click on header toggles collapse (unless clicking on action buttons)
    el.addEventListener("click", (e) => {
      if (e.target.closest(".btn-project-options") || e.target.closest(".btn-project-add-conv")) return;
      const projId = el.getAttribute("data-project-id");
      const proj = window.appStore.state.projects.find((p) => p.id === projId);
      if (proj) {
        proj.expanded = !(proj.expanded !== false);
        window.appStore.saveState();
        window.renderApp();
      }
    });

    // Right-click on project header opens Project Context Menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const projId = el.getAttribute("data-project-id");
      window.openProjectContextMenu(e.clientX, e.clientY, projId);
    });

    // Project Options button (⋮) click
    el.querySelector(".btn-project-options")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const projId = el.getAttribute("data-project-id");
      const rect = e.currentTarget.getBoundingClientRect();
      window.openProjectContextMenu(rect.right + 4, rect.top, projId);
    });

    // Project Add Conversation (+) button click
    el.querySelector(".btn-project-add-conv")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const projId = el.getAttribute("data-project-id");
      window.appStore.createConversationInProject(projId);
      window.renderApp();
    });
  });

  // Conversation Selection & Context Menu Handlers
  document.querySelectorAll(".conversation-item").forEach((el) => {
    // Left click to select conversation
    el.addEventListener("click", (e) => {
      if (e.target.closest(".conv-options-btn") || e.target.tagName === "INPUT") return;
      const convId = el.getAttribute("data-conversation-id");
      if (convId) {
        window.appStore.selectConversation(convId);
        window.renderApp();
      }
    });

    // Right click (contextmenu) opens conversation options menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const convId = el.getAttribute("data-conversation-id");
      const projId = el.getAttribute("data-project-id");
      window.openConversationContextMenu(e.clientX, e.clientY, projId, convId);
    });

    // Options button (dragHandle icon ::) click
    el.querySelector(".conv-options-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const convId = el.getAttribute("data-conversation-id");
      const projId = el.getAttribute("data-project-id");
      const rect = e.currentTarget.getBoundingClientRect();
      window.openConversationContextMenu(rect.right + 6, rect.top, projId, convId);
    });
  });

  document.getElementById("btn-settings")?.addEventListener("click", () => {
    window.openSettingsModal();
  });
}

// Inline Rename conversation row (1:1 Lux inline-edit-input)
function startInlineRename(projId, convId) {
  const row = document.querySelector(`.conversation-item[data-conversation-id="${convId}"]`);
  if (!row) return;

  const proj = window.appStore.state.projects.find((p) => p.id === projId);
  const conv = proj?.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const titleContainer = row.querySelector(".title-container");
  const span = row.querySelector(".conv-title-span");
  if (!titleContainer || !span) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = conv.title;
  input.maxLength = 70;
  input.className =
    "bg-transparent outline-none border-none ring-0 shadow-none p-0 no-focus-ring focus:ring-0 focus:shadow-none focus:border-transparent truncate text-left w-full text-xs text-foreground font-medium";
  input.setAttribute("data-testid", "inline-edit-input");

  span.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    if (val && val !== conv.title) {
      conv.title = val;
      window.appStore.saveState();
    }
    window.renderApp();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      committed = true;
      window.renderApp();
    }
  });

  input.addEventListener("blur", () => {
    commit();
  });
}

// Project Context Menu (1:1 Exact Lux media_1794225971499_824c48fa.png)
window.openProjectContextMenu = function (x, y, projId) {
  window.closeProjectContextMenu();
  window.closeConversationContextMenu();

  const proj = window.appStore.state.projects.find((p) => p.id === projId);
  if (!proj) return;

  const menu = document.createElement("div");
  menu.id = "proj-context-menu-popup";
  menu.className = "conv-context-menu";

  menu.innerHTML = `
    <!-- Copy Project Name / Proje Adını Kopyala -->
    <div class="conv-context-item" id="pmi-copy-name">
      <span>Proje Adını Kopyala</span>
    </div>

    <!-- Project Settings / Proje Ayarları -->
    <div class="conv-context-item" id="pmi-settings">
      <span>Proje Ayarları</span>
    </div>

    <!-- Show in File Explorer / Dosya Gezgininde Göster -->
    <div class="conv-context-item" id="pmi-explorer">
      <span>Dosya Gezgininde Göster</span>
    </div>

    <div class="conv-context-divider"></div>

    <!-- Delete Project / Projeyi Sil -->
    <div class="conv-context-item danger" id="pmi-delete">
      <span>Projeyi Sil</span>
    </div>
  `;

  document.body.appendChild(menu);

  // Position within viewport bounds
  const menuWidth = 180;
  const menuHeight = 170;
  let posX = x;
  let posY = y;

  if (posX + menuWidth > window.innerWidth) {
    posX = window.innerWidth - menuWidth - 10;
  }
  if (posY + menuHeight > window.innerHeight) {
    posY = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;

  // Attach Menu Event Listeners
  menu.querySelector("#pmi-copy-name")?.addEventListener("click", () => {
    window.closeProjectContextMenu();
    navigator.clipboard.writeText(proj.name);
  });

  menu.querySelector("#pmi-settings")?.addEventListener("click", () => {
    window.closeProjectContextMenu();
    window.openSettingsModal(`project:${proj.id}`);
  });

  menu.querySelector("#pmi-explorer")?.addEventListener("click", async () => {
    window.closeProjectContextMenu();
    if (window.luxAPI?.openDirectory) {
      await window.luxAPI.openDirectory(proj.path || "");
    }
  });

  // Delete Project / Projeyi Sil (inline double-click confirmation without native confirm())
  menu.querySelector("#pmi-delete")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.currentTarget;
    if (!item.dataset.armed) {
      item.dataset.armed = "1";
      const count = proj.conversations?.length || 0;
      item.innerHTML = `<span class="font-semibold text-red-600">${count > 0 ? `Onayla (${count} sohbet silinir)` : "Silmeyi Onayla ✕"}</span>`;
      return;
    }
    window.closeProjectContextMenu();
    window.appStore.deleteProject(projId);
    window.renderApp();
  });
};

window.closeProjectContextMenu = function () {
  const existing = document.getElementById("proj-context-menu-popup");
  if (existing) existing.remove();
};

// Conversation Context Menu (1:1 Lux Replica - Image Exact)
window.openConversationContextMenu = function (x, y, projId, convId) {
  window.closeConversationContextMenu();
  window.closeProjectContextMenu();

  const proj = window.appStore.state.projects.find((p) => p.id === projId);
  const conv = proj?.conversations.find((c) => c.id === convId);
  if (!conv) return;

  const menu = document.createElement("div");
  menu.id = "conv-context-menu-popup";
  menu.className = "conv-context-menu";

  menu.innerHTML = `
    <!-- Rename / Yeniden Adlandır -->
    <div class="conv-context-item" id="cmi-rename">
      <span>Yeniden Adlandır</span>
    </div>

    <!-- Pin / Sabitle -->
    <div class="conv-context-item" id="cmi-pin">
      <span>${conv.pinned ? "Sabitlemeyi Kaldır" : "Sabitle"}</span>
    </div>

    <!-- Mark Unread / Okunmadı Olarak İşaretle -->
    <div class="conv-context-item" id="cmi-unread">
      <span>${conv.isDot ? "Okundu İşaretle" : "Okunmadı Olarak İşaretle"}</span>
    </div>

    <div class="conv-context-divider"></div>

    <!-- Copy > / Kopyala -->
    <div class="conv-context-item has-submenu" id="cmi-copy">
      <span>Kopyala</span>
      <svg class="w-3.5 h-3.5 text-gray-400 stroke-current shrink-0" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      <div class="conv-submenu">
        <div class="conv-context-item" id="cmi-copy-title">
          <span>Başlığı Kopyala</span>
        </div>
        <div class="conv-context-item" id="cmi-copy-md">
          <span>Markdown Olarak Kopyala</span>
        </div>
        <div class="conv-context-item" id="cmi-copy-json">
          <span>JSON Olarak Kopyala</span>
        </div>
      </div>
    </div>

    <!-- Split > / Böl -->
    <div class="conv-context-item has-submenu" id="cmi-split">
      <span>Böl</span>
      <svg class="w-3.5 h-3.5 text-gray-400 stroke-current shrink-0" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      <div class="conv-submenu">
        <div class="conv-context-item" id="cmi-split-right">
          <span>Sağda Aç (Bölünmüş Görünüm)</span>
        </div>
      </div>
    </div>

    <div class="conv-context-divider"></div>

    <!-- Stop / Durdur -->
    <div class="conv-context-item" id="cmi-stop">
      <span>Durdur</span>
    </div>

    <!-- Delete / Sil -->
    <div class="conv-context-item danger" id="cmi-delete">
      <span>Sil</span>
    </div>
  `;

  document.body.appendChild(menu);

  // Position within viewport bounds
  const menuWidth = 175;
  const menuHeight = 250;
  let posX = x;
  let posY = y;

  if (posX + menuWidth > window.innerWidth) {
    posX = window.innerWidth - menuWidth - 10;
  }
  if (posY + menuHeight > window.innerHeight) {
    posY = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;

  // Attach Menu Event Listeners
  menu.querySelector("#cmi-rename")?.addEventListener("click", () => {
    window.closeConversationContextMenu();
    startInlineRename(projId, convId);
  });

  menu.querySelector("#cmi-pin")?.addEventListener("click", () => {
    window.closeConversationContextMenu();
    conv.pinned = !conv.pinned;
    if (proj) {
      proj.conversations.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    }
    window.appStore.saveState();
    window.renderApp();
  });

  menu.querySelector("#cmi-unread")?.addEventListener("click", () => {
    window.closeConversationContextMenu();
    conv.isDot = !conv.isDot;
    window.appStore.saveState();
    window.renderApp();
  });

  menu.querySelector("#cmi-copy-title")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.closeConversationContextMenu();
    navigator.clipboard.writeText(conv.title);
  });

  menu.querySelector("#cmi-copy-md")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.closeConversationContextMenu();
    const md = (conv.messages || []).map((m) => `**${m.role === "user" ? "Kullanıcı" : "Lux AI"}:**\n${m.content}\n`).join("\n---\n\n");
    navigator.clipboard.writeText(md || conv.title);
  });

  menu.querySelector("#cmi-copy-json")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.closeConversationContextMenu();
    navigator.clipboard.writeText(JSON.stringify(conv, null, 2));
  });

  menu.querySelector("#cmi-split-right")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.closeConversationContextMenu();
    if (!window.appStore.state.ideSplitActive) {
      window.appStore.toggleIdeSplit();
      window.renderApp();
    }
  });

  menu.querySelector("#cmi-stop")?.addEventListener("click", () => {
    window.closeConversationContextMenu();
    if (window.isGenerating) {
      window.abortGeneration();
    }
  });

  menu.querySelector("#cmi-delete")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.currentTarget;
    if (!item.dataset.armed) {
      item.dataset.armed = "1";
      item.innerHTML = `<span class="font-semibold text-red-600">Silmeyi Onayla ✕</span>`;
      return;
    }
    window.closeConversationContextMenu();
    proj.conversations = proj.conversations.filter((c) => c.id !== convId);
    if (window.appStore.state.activeConversationId === convId) {
      window.appStore.state.activeConversationId = proj.conversations[0]?.id || null;
    }
    window.appStore.saveState();
    window.renderApp();
  });
};

window.closeConversationContextMenu = function () {
  const existing = document.getElementById("conv-context-menu-popup");
  if (existing) existing.remove();
};

window.addEventListener("click", (e) => {
  if (!e.target.closest("#conv-context-menu-popup") && !e.target.closest("#proj-context-menu-popup")) {
    window.closeConversationContextMenu();
    window.closeProjectContextMenu();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeConversationContextMenu();
    window.closeProjectContextMenu();
  }
});
