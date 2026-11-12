// LUX AI — Delege edilmiş tıklama aksiyonları (CSP uyumu)
//
// Neden var: CSP'nin script-src 'self' politikası satır-içi (inline) onclick'leri
// çalıştırmaz; bu yüzden tüm menü/buton aksiyonları tek bir document-level click
// dinleyicisine taşındı. Elemanlar `data-action="ad"` (+ isteğe bağlı
// `data-arg="..."`) özniteliği taşır; dinamik olarak üretilen şablonlar da
// aynı kanaldan çalışır (event delegation).
//
// Not: Fonksiyonlar global (window.*) olarak mevcuttur; eksik olanlar sessizce
// atlanır ve konsola uyarı yazılır.

(function registerDelegatedActions() {
  const actions = {
    openSettingsModal: () => window.openSettingsModal?.(),
    closeSettingsModal: () => window.closeSettingsModal?.(),
    openAboutModal: () => window.openAboutModal?.(),
    openModelParamsModal: () => window.openModelParamsModal?.(),
    clearActiveChat: () => window.clearActiveChat?.(),
    exportChatMarkdown: () => window.exportChatMarkdown?.(),
    exportChatJson: () => window.exportChatJson?.(),
    scrollToBottom: () => window.scrollToBottom?.(),
    zoomIn: () => window.zoomIn?.(),
    zoomOut: () => window.zoomOut?.(),
    resetZoom: () => window.resetZoom?.(),
    pickFileContext: () => window.pickFileContext?.(),
    pickFolderContext: () => window.pickFolderContext?.(),
    captureScreenshotContext: () => window.captureScreenshotContext?.(),
    addTerminalContext: () => window.addTerminalContext?.(),
    // Pencere kontrolleri (luxAPI.window.*)
    windowMinimize: () => window.luxAPI?.window?.minimize?.(),
    windowMaximize: () => window.luxAPI?.window?.maximize?.(),
    windowClose: () => window.luxAPI?.window?.close?.(),
    devtoolsToggle: () => window.luxAPI?.window?.devtools?.(),
    reloadWindow: () => window.location.reload(),
    // Menü çubuğu aksiyonları (birden fazla appStore çağrısı tek aksiyonda)
    newConversation: () => {
      window.appStore?.createConversation?.("Yeni Sohbet");
      window.renderApp?.();
    },
    toggleSidebarAndRender: () => {
      window.appStore?.toggleSidebar?.();
      window.renderApp?.();
    },
    toggleRightPanelAndRender: () => {
      window.appStore?.toggleRightPanel?.();
      window.renderApp?.();
    },
    // Hakkında modalını kapat (app.js'te dinamik üretilir)
    closeAboutModal: () => document.getElementById("about-modal-dialog")?.remove(),
    // Panelden gelen aksiyonlar (rightPanel.js global fonksiyonları)
    openRunningTaskTerminal: () => window.openRunningTaskTerminal?.(),
    cancelBackgroundTask: (el, ev) => {
      ev.stopPropagation();
      window.cancelBackgroundTask?.();
    },
    openAllTasksModal: () => window.openAllTasksModal?.(),
    openOverviewCustomizeModal: () => window.openOverviewCustomizeModal?.(),
    openWebviewModal: () => window.openWebviewModal?.(),
    toggleIdeSplitAndRender: () => {
      window.appStore?.toggleIdeSplit?.();
      window.renderApp?.();
    },
    // Chat öneri kartları: data-arg ile hızlı prompt metni taşınır
    quickPrompt: (el) => window.quickPrompt?.(el.dataset.arg || "")
  };

  document.addEventListener("click", (event) => {
    const el = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
    if (!el || el.disabled) return;
    const handler = actions[el.dataset.action];
    if (typeof handler === "function") {
      handler(el, event);
    }
    // Bilinmeyen aksiyonlar (copy-msg, lightbox-img, remove-media vb.)
    // chat.js'in kendi document-level dinleyicisi tarafından ele alınır;
    // burada sessizce atlanır.
  });
})();
