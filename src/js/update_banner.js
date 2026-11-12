// LUX AI — Güncelleme bandı
// Üretim paketinde main süreç electron-updater ile çalışır ve 'update-status'
// olayları gönderir; bu modül sağ alt köşede küçük bir bant gösterir.
// Geliştirme sürümünde (isPackaged=false) main hiçbir olay göndermez → bant hiç görünmez.
(function registerUpdateBanner() {
  const banner = document.getElementById("update-banner");
  if (!banner) return;
  const textEl = banner.querySelector("#update-banner-text");
  const actionBtn = banner.querySelector("#update-banner-action");
  const dismissBtn = banner.querySelector("#update-banner-dismiss");
  const updates = window.luxAPI?.updates;
  if (!updates) return;

  let autoHideTimer = null;

  function scheduleAutoHide(ms) {
    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => hide(), ms);
  }
  function show() {
    banner.classList.remove("hidden");
    banner.classList.add("flex");
  }
  function hide() {
    banner.classList.add("hidden");
    banner.classList.remove("flex");
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }
  const t = (k, params) => (window.LuxI18n ? window.LuxI18n.t(k, params) : k);

  dismissBtn?.addEventListener("click", hide);
  actionBtn?.addEventListener("click", () => {
    updates.quitAndInstall?.();
  });

  updates.onStatus?.((p) => {
    if (!p || !p.status) return;
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
    switch (p.status) {
      case "available":
        if (textEl) textEl.textContent = t("update.available", { version: p.version || "" });
        if (actionBtn) actionBtn.classList.add("hidden");
        show();
        break;
      case "downloading":
        if (textEl) textEl.textContent = t("update.downloading", { percent: Number.isFinite(p.percent) ? p.percent : 0 });
        if (actionBtn) actionBtn.classList.add("hidden");
        show();
        break;
      case "downloaded":
        if (textEl) textEl.textContent = t("update.downloaded", { version: p.version || "" });
        if (actionBtn) {
          actionBtn.textContent = t("update.restartNow");
          actionBtn.classList.remove("hidden");
        }
        show();
        break;
      case "up-to-date":
        if (textEl) textEl.textContent = t("update.upToDate");
        if (actionBtn) actionBtn.classList.add("hidden");
        show();
        scheduleAutoHide(6000);
        break;
      case "error":
        // Hata durumunda kullanıcıyı rahatsız etme; sessizce log.
        console.info("[updater] kontrol hatası:", p.message || "");
        hide();
        break;
      default:
        break; // checking vb. — bant gösterme
    }
  });
})();
