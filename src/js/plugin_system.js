// LUX AI - Modular Plugin & Auto-Dependency Execution System
// Manages dynamic slots (Sidebar tabs, composer actions, auxiliary panels)
// and handles automated package installations safely without touching core code.

(function () {
  const activePlugins = new Map();
  const registeredSlots = {
    sidebarTabs: new Map(),
    auxViews: new Map(),
    composerActions: new Map()
  };

  const STORAGE_KEY = "lux_active_plugins";

  function loadStoredPlugins() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((p) => {
            if (p && p.id) registerPlugin(p, false);
          });
        }
      }
    } catch (_) {}
  }

  function saveStoredPlugins() {
    try {
      const list = Array.from(activePlugins.values()).map((p) => ({
        id: p.id,
        name: p.name,
        slot: p.slot || "sidebar",
        title: p.title || p.name,
        icon: p.icon || "puzzle",
        contentHtml: p.contentHtml || "",
        dependencies: p.dependencies || []
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  // Ensure slot container exists in sidebar
  function ensureSidebarSlotContainer() {
    let container = document.getElementById("sidebar-plugins-container");
    if (!container) {
      // Sidebar kökü: sidebar.js tarafından render edilen gerçek kapsayıcılar.
      // ("sidebar-content-projects" index.html'de yok; eski bir isimdi.)
      const sidebarContent =
        document.getElementById("sidebar-plugins-anchor") ||
        document.getElementById("sidebar-container") ||
        document.getElementById("sidebar-wrapper");
      if (sidebarContent) {
        container = document.createElement("div");
        container.id = "sidebar-plugins-container";
        container.className = "flex flex-col gap-1 px-3 py-2 border-t border-border/40 my-2";
        container.innerHTML = `
          <div class="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
            <span>Eklentiler & Sekmeler</span>
            <span id="plugins-count-badge" class="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-mono">0</span>
          </div>
          <div id="sidebar-plugins-list" class="flex flex-col gap-0.5"></div>
        `;
        sidebarContent.appendChild(container);
      }
    }
    return document.getElementById("sidebar-plugins-list");
  }

  function renderSidebarTabItem(plugin) {
    const listEl = ensureSidebarSlotContainer();
    if (!listEl) return;

    let existing = document.getElementById(`plugin-tab-${plugin.id}`);
    if (!existing) {
      existing = document.createElement("div");
      existing.id = `plugin-tab-${plugin.id}`;
      listEl.appendChild(existing);
    }

    const iconSvg =
      plugin.iconSvg ||
      `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    `;

    existing.className =
      "group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors";
    existing.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        ${iconSvg}
        <span class="truncate">${escapeHtml(plugin.title || plugin.name)}</span>
      </div>
      <button type="button" class="btn-remove-plugin opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-destructive cursor-pointer transition-opacity" title="Sekmeyi Kaldır">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    existing.onclick = (e) => {
      if (e.target.closest(".btn-remove-plugin")) {
        e.stopPropagation();
        removePlugin(plugin.id);
        return;
      }
      openPluginView(plugin);
    };

    updatePluginBadgeCount();
  }

  function updatePluginBadgeCount() {
    const badge = document.getElementById("plugins-count-badge");
    if (badge) {
      badge.textContent = String(activePlugins.size);
    }
  }

  function openPluginView(plugin) {
    if (!plugin) return;
    // Open in Auxiliary View (Right Panel) as dynamic custom content
    if (typeof window.openAuxBrowserUrl === "function") {
      // Create HTML blob or local view for custom plugin
      if (plugin.contentHtml) {
        const fullDoc = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>${escapeHtml(plugin.title || plugin.name)}</title>
              <link rel="stylesheet" href="../css/app.css" />
              <style>
                body { background-color: #0b0b0e; color: #f3f4f6; font-family: system-ui, -apple-system, sans-serif; padding: 1.5rem; margin: 0; }
              </style>
            </head>
            <body>
              <div class="plugin-root">
                <div class="flex items-center gap-2 pb-3 mb-4 border-b border-white/10">
                  <h2 class="text-lg font-semibold text-foreground m-0">${escapeHtml(plugin.title || plugin.name)}</h2>
                  <span class="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono">Canlı Eklenti</span>
                </div>
                <div>${plugin.contentHtml}</div>
              </div>
            </body>
          </html>
        `;
        const blob = new Blob([fullDoc], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);
        window.openAuxBrowserUrl(blobUrl, { sandbox: true });
        return;
      }
    }
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
    });
  }

  function registerPlugin(pluginDef, save = true) {
    if (!pluginDef || !pluginDef.id) return false;
    const cleanId = String(pluginDef.id)
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .toLowerCase();
    const plugin = { ...pluginDef, id: cleanId };
    activePlugins.set(cleanId, plugin);

    // If sidebar tab slot, render in sidebar
    if (!plugin.slot || plugin.slot === "sidebar") {
      renderSidebarTabItem(plugin);
    }

    if (save) saveStoredPlugins();
    return true;
  }

  function removePlugin(pluginId) {
    const cleanId = String(pluginId || "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .toLowerCase();
    activePlugins.delete(cleanId);
    document.getElementById(`plugin-tab-${cleanId}`)?.remove();
    updatePluginBadgeCount();
    saveStoredPlugins();
    try {
      window.luxAPI?.plugins?.remove?.(cleanId);
    } catch (_) {}
    return true;
  }

  async function ensureDependency(packageName) {
    if (!packageName) return { success: false, error: "Paket adı eksik" };
    if (!window.luxAPI?.plugins?.checkDependency) {
      return { success: false, error: "Plugin API hazır değil" };
    }
    const chk = await window.luxAPI.plugins.checkDependency(packageName);
    if (chk?.installed) {
      return { success: true, alreadyInstalled: true, message: `${packageName} zaten kurulu` };
    }
    const inst = await window.luxAPI.plugins.installDependency(packageName);
    return inst;
  }

  // Public API
  window.luxPlugins = {
    register: registerPlugin,
    remove: removePlugin,
    ensureDependency,
    list: () => Array.from(activePlugins.values()),
    get: (id) => activePlugins.get(id),
    openView: openPluginView
  };

  // Auto initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(loadStoredPlugins, 300);
    });
  } else {
    setTimeout(loadStoredPlugins, 300);
  }
})();
