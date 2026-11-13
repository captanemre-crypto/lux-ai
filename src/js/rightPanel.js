// 1:1 Lux Overview Floating Panel & Live Git Diff Review Component (Türkçe Arayüz)

let activeOverviewSubView = null; // null | 'review' | 'files' | 'terminal' | 'extensions'

const terminalShellLabel = (navigator.platform || "").startsWith("Win") ? "PowerShell" : "/bin/bash";
let terminalHistory = [`Lux AI Terminal Motoru v1.2.0 (${terminalShellLabel})`, "Komutlar için hazır. Bir komut yazıp Enter tuşuna basın."];

// Global unified diff renderer shared between RightPanel and IDE Split Panel
window.renderDiffLinesHtml = function (diffText) {
  if (!diffText || !diffText.trim()) {
    return `<div class="p-2 text-[11px] text-muted-foreground font-mono">Satır düzeyinde fark bulunamadı.</div>`;
  }
  const lines = diffText.replace(/\r\n/g, "\n").split("\n").slice(0, 180);
  return lines
    .map((line) => {
      const safe = escapeHtml(line) || "&nbsp;";
      if (line.startsWith("+++") || line.startsWith("---")) {
        return `<div class="px-2 py-0.5 text-[10px] font-mono text-muted-foreground/70 bg-white/[0.02] truncate">${safe}</div>`;
      }
      if (line.startsWith("@@")) {
        return `<div class="px-2 py-0.5 text-[10px] font-mono text-blue-400/90 bg-blue-500/10 border-y border-blue-500/10">${safe}</div>`;
      }
      if (line.startsWith("+")) {
        return `<div class="px-2 py-0.5 text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500 whitespace-pre overflow-x-auto">${safe}</div>`;
      }
      if (line.startsWith("-")) {
        return `<div class="px-2 py-0.5 text-[11px] font-mono bg-rose-500/15 text-rose-300 border-l-2 border-rose-500 whitespace-pre overflow-x-auto">${safe}</div>`;
      }
      return `<div class="px-2 py-0.5 text-[11px] font-mono text-secondary-foreground/75 whitespace-pre overflow-x-auto">${safe}</div>`;
    })
    .join("");
};

window.renderDiffReviewContainerHtml = function (diffState, compact = false) {
  const files = diffState?.files || [];
  const isGitRepo = Boolean(diffState?.isGitRepo);
  const branch = diffState?.branch || "main";

  return `
    <div class="flex flex-col gap-2.5">
      <!-- Top Repo/Snapshot Header -->
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
        <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
          ${
            isGitRepo
              ? `
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono truncate">
              ⎇ ${escapeHtml(branch)}
            </span>
          `
              : `
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
              Canlı İzleme
            </span>
            <button type="button" class="btn-git-init text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 cursor-pointer transition-colors" title="Bu klasörde Git deposu başlat">
              + Git Başlat
            </button>
          `
          }
          <span class="text-[10px] text-muted-foreground font-mono">
            ${files.length} dosya
          </span>
        </div>
        <button type="button" class="btn-diff-refresh p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-xs flex items-center gap-1" title="Değişiklikleri Yenile">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ${!compact ? "<span>Yenile</span>" : ""}
        </button>
      </div>

      <div id="diff-action-feedback" class="hidden text-[11px] px-2.5 py-1.5 rounded-lg border"></div>

      <!-- Diff Files List -->
      ${
        files.length === 0
          ? `
        <div class="p-4 rounded-xl border border-dashed border-border/60 bg-background/40 text-center flex flex-col gap-1.5">
          <span class="text-xs font-medium text-foreground">Bekleyen değişiklik yok</span>
          <span class="text-[11px] text-muted-foreground leading-relaxed">
            Düzenleyicide bir dosyayı kaydettiğinizde veya yapay zeka ajanları kod güncellediğinde canlı satır farkları burada görünecektir.
          </span>
        </div>
      `
          : files
              .map((f, idx) => {
                const statusClass =
                  f.status === "Yeni"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : f.status === "Silindi"
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30";
                const expanded = idx === 0;
                const targetPath = f.fullPath || f.path;
                return `
          <div class="lux-diff-card rounded-xl bg-background/80 border border-border/80 overflow-hidden flex flex-col">
            <!-- File Header -->
            <div class="p-2.5 flex flex-col gap-2 bg-card/30">
              <div class="flex items-center justify-between gap-2 min-w-0">
                <button type="button" class="btn-diff-toggle flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer text-xs text-foreground hover:text-primary transition-colors">
                  <svg class="diff-chevron w-3 h-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  <span class="font-mono text-[11px] truncate text-primary" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
                </button>
                <div class="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                  <span class="px-1.5 py-0.5 rounded border ${statusClass}">${escapeHtml(f.status)}</span>
                  ${f.staged ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">Onaylı</span>` : ""}
                  <span class="text-emerald-400">+${f.additions || 0}</span>
                  <span class="text-rose-400">-${f.deletions || 0}</span>
                </div>
              </div>

              <!-- Quick Review Actions -->
              <div class="flex items-center justify-end gap-1.5 flex-wrap">
                <button type="button" class="btn-diff-open text-[10px] px-2 py-1 rounded-md border border-border/70 hover:bg-secondary text-secondary-foreground hover:text-foreground cursor-pointer transition-colors" data-file-path="${escapeHtml(targetPath)}">
                  Düzenle
                </button>
                <button type="button" class="btn-diff-stage text-[10px] px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 cursor-pointer transition-colors" data-file-path="${escapeHtml(targetPath)}">
                  ✓ Onayla
                </button>
                <button type="button" class="btn-diff-discard text-[10px] px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer transition-colors" data-file-path="${escapeHtml(targetPath)}">
                  ✕ Geri Al
                </button>
              </div>
            </div>

            <!-- Collapsible Diff Hunks -->
            <div class="lux-diff-body ${expanded ? "" : "hidden"} border-t border-border/50 bg-[#050507] max-h-60 overflow-y-auto custom-scrollbar">
              ${window.renderDiffLinesHtml(f.diffText)}
            </div>
          </div>
        `;
              })
              .join("")
      }
    </div>
  `;
};

window.attachDiffReviewEvents = function (container, reloadFn) {
  if (!container) return;

  const showFeedback = (msg, ok = true) => {
    const el = container.querySelector("#diff-action-feedback");
    if (!el) return;
    el.className = `text-[11px] px-2.5 py-1.5 rounded-lg border ${ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`;
    el.textContent = msg;
    el.classList.remove("hidden");
  };

  container.querySelector(".btn-diff-refresh")?.addEventListener("click", () => {
    reloadFn();
  });

  container.querySelector(".btn-git-init")?.addEventListener("click", async () => {
    const res = await window.luxAPI?.git?.action({ action: "init" });
    if (res?.success) {
      window.playLuxSound?.("codeActionApplied");
      reloadFn();
    } else {
      showFeedback(res?.output || "Git başlatılamadı (git kurulu olmayabilir).", false);
    }
  });

  container.querySelectorAll(".btn-diff-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".lux-diff-card");
      const body = card?.querySelector(".lux-diff-body");
      const chev = card?.querySelector(".diff-chevron");
      if (body) body.classList.toggle("hidden");
      if (chev) chev.classList.toggle("rotate-90");
    });
  });

  container.querySelectorAll(".btn-diff-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fp = btn.getAttribute("data-file-path");
      if (fp) handleFileClick(fp);
    });
  });

  container.querySelectorAll(".btn-diff-stage").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fp = btn.getAttribute("data-file-path");
      const res = await window.luxAPI?.git?.action({ action: "stage", filePath: fp });
      if (res?.success) {
        window.playLuxSound?.("codeActionApplied");
        window.refreshDiffViews?.();
      } else {
        showFeedback(res?.error || "Onaylama başarısız oldu.", false);
      }
    });
  });

  container.querySelectorAll(".btn-diff-discard").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.confirmPending !== "true") {
        btn.dataset.confirmPending = "true";
        btn.textContent = "Emin misin?";
        btn.classList.add("bg-rose-500/30");
        setTimeout(() => {
          if (btn.isConnected && btn.dataset.confirmPending === "true") {
            btn.dataset.confirmPending = "false";
            btn.textContent = "✕ Geri Al";
            btn.classList.remove("bg-rose-500/30");
          }
        }, 3000);
        return;
      }

      const fp = btn.getAttribute("data-file-path");
      const res = await window.luxAPI?.git?.action({ action: "discard", filePath: fp });
      if (res?.success) {
        window.playLuxSound?.("diffLineDeleted");
        window.invalidateWorkspaceFilesCache?.();
        if (window.activeEditorPath && fp && window.activeEditorPath().toLowerCase() === fp.toLowerCase()) {
          window.loadEditorFile?.(fp);
        }
        window.refreshDiffViews?.();
      } else {
        showFeedback(res?.error || "Geri alma işlemi başarısız.", false);
      }
    });
  });
};

window.refreshDiffViews = function () {
  if (activeOverviewSubView === "review") {
    loadOverviewReview();
  }
  if (typeof window.loadAuxReviewDiffs === "function") {
    window.loadAuxReviewDiffs();
  }
};

function renderRightPanel() {
  const container = document.getElementById("right-panel-container");
  if (!container) return;

  const state = window.appStore.state;
  if (!state.rightPanelOpen) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";

  // Ana genel bakış kartı veya alt görünüm kontrolü
  if (!activeOverviewSubView) {
    container.innerHTML = `
      <div data-testid="overview-panel" class="flex flex-auto w-full min-h-0 flex-col select-none">
        
        <!-- Üst Bölüm: Başlık & 4 Ana Menü Satırı -->
        <div class="flex shrink-0 flex-col gap-px p-1 border-b border-border">
          
          <!-- Başlık: Genel Bakış etiketi + 3 nokta butonu -->
          <div class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none bg-transparent h-6 pl-2 pr-1.5">
            <span class="agy-hover-label text-xs opacity-50 font-medium select-none text-foreground">Genel Bakış</span>
            <span class="ml-auto flex items-center">
              <button type="button" aria-label="Bölümleri Özelleştir" data-testid="overview-panel-customize-trigger" class="group flex h-5 w-5 items-center justify-center outline-none rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Bölümleri Özelleştir" data-action="openOverviewCustomizeModal">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" class="outline-none">
                  <path d="M480-189.23q-24.75,0-42.37-17.62T420-249.23t17.62-42.37T480-309.23t42.37,17.62T540-249.23t-17.62,42.37T480-189.23ZM480-420q-24.75,0-42.37-17.62T420-480t17.62-42.37T480-540t42.37,17.62T540-480t-17.62,42.37T480-420Zm0-230.77q-24.75,0-42.37-17.62T420-710.77t17.62-42.37T480-770.77t42.37,17.62T540-710.77t-17.62,42.37T480-650.77Z"/>
                </svg>
              </button>
            </span>
          </div>

          <!-- Satır 1: İnceleme (Review) -->
          <button id="overview-row-review" data-testid="overview-panel-row-review" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none h-8 text-sm group relative px-2 select-none bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0 text-muted-foreground group-hover:text-foreground">
              <path d="M510-530h60v-80h80v-60H570v-80H510v80H430v60h80v80ZM430-370H650v-60H430v60ZM332.31-220Q302-220 281-241t-21-51.31V-827.69Q260-858 281-879t51.31-21H610L820-690v397.69Q820-262 799-241t-51.31,21H332.31Zm0-60H747.69q4.62,0 8.46-3.85t3.85-8.46V-660L580-840H332.31q-4.62,0-8.46,3.85T320-827.69v535.38q0,4.62 3.85,8.46t8.46,3.85Zm-160,220Q142-60 121-81t-21-51.31V-660h60v527.69q0,4.62 3.85,8.46t8.46,3.85H580v60H172.31ZM320-280q0,0 0-3.85t0-8.46V-827.69q0-4.62 0-8.46t0-3.85v180v367.69q0,4.62 0,8.46t0,3.85Z"/>
            </svg>
            <span class="agy-hover-label min-w-0 truncate">İnceleme</span>
            <div class="ml-auto shrink-0 flex items-center gap-1" id="overview-review-badge"></div>
          </button>

          <!-- Satır 2: Dosyalar (Files) -->
          <button id="overview-row-files" data-testid="overview-panel-row-files" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none h-8 text-sm group relative px-2 select-none bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0 text-muted-foreground group-hover:text-foreground">
              <path d="M252.31-100Q222-100 201-121t-21-51.31V-787.69Q180-818 201-839t51.31-21H570L780-650v477.69Q780-142 759-121t-51.31,21H252.31ZM540-620V-800H252.31q-4.62,0-8.46,3.85T240-787.69v615.38q0,4.62 3.85,8.46t8.46,3.85H707.69q4.62,0 8.46-3.85t3.85-8.46V-620H540ZM240-800v180V-800v180v447.69q0,4.62 0,8.46t0,3.85q0,0 0-3.85t0-8.46V-787.69q0-4.62 0-8.46t0-3.85Z"/>
            </svg>
            <span class="agy-hover-label min-w-0 truncate flex-1">Dosyalar</span>
          </button>

          <!-- Satır 3: Terminal -->
          <button id="overview-row-terminal" data-testid="overview-panel-row-terminal" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none h-8 text-sm group relative px-2 select-none bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0 text-muted-foreground group-hover:text-foreground">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M4.02975 19.9703C4.38308 20.3234 4.80908 20.5 5.30775 20.5H18.6923C19.1909 20.5 19.6169 20.3234 19.9703 19.9703C20.3234 19.6169 20.5 19.1909 20.5 18.6923V5.30775C20.5 4.80908 20.3234 4.38308 19.9703 4.02975C19.6169 3.67658 19.1909 3.5 18.6923 3.5H5.30775C4.80908 3.5 4.38308 3.67658 4.02975 4.02975C3.67658 4.38308 3.5 4.80908 3.5 5.30775V18.6923C3.5 19.1909 3.67658 19.6169 4.02975 19.9703ZM5.09625 5.09625C5.16025 5.03208 5.23075 5 5.30775 5H18.6923C18.7693 5 18.8398 5.03208 18.9038 5.09625C18.9679 5.16025 19 5.23075 19 5.30775V18.6923C19 18.7693 18.9679 18.8398 18.9038 18.9038C18.8398 18.9679 18.7693 19 18.6923 19H5.30775C5.23075 19 5.16025 18.9679 5.09625 18.9038C5.03208 18.8398 5 18.7693 5 18.6923V5.30775C5 5.23075 5.03208 5.16025 5.09625 5.09625Z" fill="currentColor"/>
              <path d="M11.25 15.8122C11.0375 15.8122 10.8594 15.7403 10.7158 15.5965C10.5719 15.4526 10.5 15.2745 10.5 15.062C10.5 14.8493 10.5719 14.6712 10.7158 14.5277C10.8594 14.384 11.0375 14.3122 11.25 14.3122H15.25C15.4625 14.3122 15.6406 14.3841 15.7842 14.528C15.9281 14.6718 16 14.85 16 15.0625C16 15.2751 15.9281 15.4532 15.7842 15.5967C15.6406 15.7404 15.4625 15.8122 15.25 15.8122H11.25Z" fill="currentColor"/>
              <path d="M7.223 8.49222L8.72689 9.99995L7.22795 11.4915C7.07928 11.6401 7.00495 11.8167 7.00495 12.0212C7.00495 12.2257 7.07928 12.4023 7.22795 12.551C7.37661 12.6996 7.5517 12.774 7.7532 12.774C7.95453 12.774 8.1307 12.6996 8.2817 12.551L10.2076 10.6327C10.3883 10.4519 10.4786 10.2409 10.4786 9.99995C10.4786 9.75895 10.3883 9.54803 10.2076 9.3672L8.27675 7.43272C8.12575 7.28405 7.94959 7.20972 7.74825 7.20972C7.54675 7.20972 7.37166 7.28405 7.223 7.43272C7.07433 7.58138 7 7.75797 7 7.96247C7 8.16697 7.07433 8.34355 7.223 8.49222Z" fill="currentColor"/>
            </svg>
            <span class="agy-hover-label min-w-0 truncate flex-1">Terminal</span>
          </button>

          <!-- Satır 4: Eklentiler (Extensions) -->
          <button id="overview-row-extensions" data-testid="overview-panel-row-plugins" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none h-8 text-sm group relative px-2 select-none bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0 text-muted-foreground group-hover:text-foreground">
              <path d="M208.85-197.69H713.46q3.85,0 6.35-2.69t2.5-6.54V-383.23l36.92-15.85q18.31-6.85 29.54-23.54T800-461.15q0-21.62-11.23-38.42t-29.54-24.04l-36.92-15.23V-715.38q0-4.23-2.5-6.73t-6.35-2.5H534.92l-7.31-51.08q-3.77-25.85-22.38-43.92t-44.08-18.08q-26.08,0-44.69,18.08t-22.38,43.92l-7.31,51.08H208.46q-3.46,0-5.96,2.5t-2.5,6.73V-624q51.77,17.15 84.15,62.04t32.38,100.81q0,57.31-32.19,102.19T200-297.69v90.77q0,3.85 2.5,6.54t6.35,2.69Zm0,60q-29,0-48.92-20.12T140-206.92V-347q48-1.54 82.27-33.58t34.27-80.58q0-45.62-34.46-78.12T140-575.69V-715.38q0-28.77 20.04-49t48.42-20.23H334.69q6.62-47.92 42.15-80.5t84.31-32.58q48.15,0 83.69,32.58t42.77,80.5H713.46q28.38,0 48.61,20.23t20.23,49v136.69q34.85,14.15 56.27,46.23T860-461.15q0,39.08-21.42,70.96t-56.27,46.58v136.69q0,29-20.23,49.11t-48.61,20.12H208.85ZM500-461.15Z"/>
            </svg>
            <span class="agy-hover-label min-w-0 truncate">Eklentiler</span>
            <div class="ml-auto shrink-0 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0 text-muted-foreground group-hover:text-foreground">
                <path d="M517.85-480l-184-184L376-706.15L602.15-480L376-253.85L333.85-296l184-184Z"/>
              </svg>
            </div>
          </button>
        </div>

        <!-- Alt Bölüm: Arka Plan Görevleri (Background Tasks) -->
        <div class="flex flex-col overflow-y-auto scrollbar-none w-full flex-grow min-h-0 divide-y divide-border empty:hidden">
          <div class="p-1">
            <!-- Arka Plan Görevleri Başlığı -->
            <button type="button" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none bg-transparent h-6 pl-2 pr-1.5 group cursor-pointer hover:bg-secondary transition-colors">
              <span class="agy-hover-label text-xs opacity-50 font-medium select-none group-hover:opacity-100 transition-opacity">Arka Plan Görevleri</span>
              ${state.backgroundTasksCount > 0 ? `<span class="text-[10px] font-medium opacity-50 bg-border rounded-full px-1.5 py-0.5 leading-none group-hover:opacity-100 transition-opacity">${state.backgroundTasksCount}</span>` : ""}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="text-muted-foreground group-hover:text-secondary-foreground transition-all duration-150 opacity-0 group-hover:opacity-100 rotate-90 ml-auto">
                <path d="M517.85-480l-184-184L376-706.15L602.15-480L376-253.85L333.85-296l184-184Z"/>
              </svg>
            </button>

            <!-- Animasyonlu İmleçli Görev Satırı -->
            <div class="flex flex-col gap-px mt-0.5">
              <div data-testid="background-task-row" class="flex w-full items-center gap-1.5 rounded-lg border-none text-left outline-none h-8 text-sm group relative px-2 select-none bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors" data-action="openRunningTaskTerminal">
                <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-70 text-primary" data-testid="status-task-running">
                  <path d="M3.7 5.2L6.7 8L3.7 10.8"></path>
                  <path data-agent-state-caret="" d="M8.3 10.8H12.3" style="animation: 2s ease-in-out infinite alternate running pulse;"></path>
                </svg>
                <span class="agy-hover-label min-w-0 truncate flex-1 text-xs ${state.backgroundTasksCount > 0 ? "" : "text-muted-foreground"}">${escapeHtml(state.backgroundTasksCount > 0 ? state.backgroundTaskName || "Çalışan görev" : "Görev yok")}</span>
                ${
                  state.backgroundTasksCount > 0
                    ? `<div class="can-hover:opacity-0 group-hover:opacity-100 flex items-center pr-1">
                  <button type="button" aria-label="Görevi İptal Et" class="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-border/50 transition-colors" title="Görevi İptal Et" data-action="cancelBackgroundTask">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M330-330H630V-630H330v300ZM480.07-100q-78.84,0-148.2-29.92T211.18-211.13T129.93-331.76T100-479.93t29.92-148.2t81.21-120.68t120.63-81.25T479.93-860t148.2,29.92t120.68,81.21t81.25,120.63T860-480.07t-29.92,148.2T748.87-211.18T628.24-129.93T480.07-100ZM480-160q134,0 227-93t93-227T707-707T480-800T253-707T160-480t93,227t227,93Zm0-320Z"/>
                    </svg>
                  </button>
                </div>`
                    : ""
                }
              </div>
            </div>

            <!-- Tümünü Gör Bağlantısı (görev yokken gizli) -->
            ${
              state.backgroundTasksCount > 0
                ? `<button class="text-xs text-muted-foreground hover:text-secondary-foreground cursor-pointer select-none pl-2 pt-1 text-left transition-colors" data-action="openAllTasksModal">Tümünü gör</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    // Satır tıklama dinleyicileri
    document.getElementById("overview-row-review")?.addEventListener("click", () => {
      activeOverviewSubView = "review";
      renderRightPanel();
    });
    document.getElementById("overview-row-files")?.addEventListener("click", () => {
      activeOverviewSubView = "files";
      renderRightPanel();
    });
    document.getElementById("overview-row-terminal")?.addEventListener("click", () => {
      activeOverviewSubView = "terminal";
      renderRightPanel();
    });
    document.getElementById("overview-row-extensions")?.addEventListener("click", () => {
      activeOverviewSubView = "extensions";
      renderRightPanel();
    });

    // Quick badge update for pending diff count
    window.luxAPI?.git
      ?.getDiff?.()
      .then((diffState) => {
        const badgeHost = document.getElementById("overview-review-badge");
        if (badgeHost && diffState?.files?.length > 0) {
          badgeHost.innerHTML = `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-mono">${diffState.files.length}</span>`;
        }
      })
      .catch(() => {});
  } else {
    // Alt görünüm başlığı ve gövdesi
    const titleMap = {
      review: "İnceleme",
      files: "Dosyalar",
      terminal: "Terminal",
      extensions: "Eklentiler"
    };

    container.innerHTML = `
      <div class="flex flex-col w-full h-full min-h-0 select-none bg-card">
        <!-- Geri Butonlu Alt Görünüm Başlığı -->
        <div class="flex items-center gap-2 p-2 border-b border-border shrink-0">
          <button id="overview-btn-back" class="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Genel Bakışa Geri Dön">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M294.92-450L522.77-222.15L480-180L180-480L480-780l42.77,42.15L294.92-510H780v60H294.92Z"/>
            </svg>
          </button>
          <span class="text-xs font-semibold text-foreground uppercase tracking-wide">
            ${titleMap[activeOverviewSubView] || activeOverviewSubView}
          </span>
          <button class="ml-auto p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Bölünmüş Görünümde Aç" data-action="toggleIdeSplitAndRender">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm240-80v-560H200v560h240Zm80 0h240v-560H520v560Z"/>
            </svg>
          </button>
        </div>

        <!-- Alt Görünüm İçeriği -->
        <div class="flex-1 min-h-0 overflow-y-auto p-2" id="overview-subview-content">
          ${renderSubViewContent(activeOverviewSubView)}
        </div>
      </div>
    `;

    document.getElementById("overview-btn-back")?.addEventListener("click", () => {
      activeOverviewSubView = null;
      renderRightPanel();
    });

    if (activeOverviewSubView === "files") {
      loadFilesList();
    } else if (activeOverviewSubView === "terminal") {
      setupTerminalInput();
    } else if (activeOverviewSubView === "review") {
      loadOverviewReview();
    }
  }
}

function renderSubViewContent(view) {
  switch (view) {
    case "review":
      return `
        <div id="overview-review-container" class="flex flex-col gap-2">
          <div class="text-xs text-muted-foreground py-4 text-center">Değişiklikler taranıyor...</div>
        </div>
      `;

    case "files":
      return `
        <div class="flex flex-col gap-1 text-xs font-mono" id="files-tree-list">
          <div class="text-muted-foreground py-2 text-center">Dosyalar yükleniyor...</div>
        </div>
      `;

    case "terminal":
      return `
        <div class="flex flex-col h-full min-h-[260px] font-mono text-xs bg-background rounded-lg p-2 border border-border">
          <div id="terminal-output-box" class="flex-1 overflow-y-auto space-y-1 mb-2 text-muted-foreground">
            ${terminalHistory.map((line) => `<div class="leading-relaxed whitespace-pre-wrap">${escapeHtml(line)}</div>`).join("")}
          </div>
          <div class="flex items-center gap-1.5 pt-1.5 border-t border-border/40 shrink-0">
            <span class="text-primary font-bold">PS &gt;</span>
            <input id="terminal-input" type="text" class="flex-1 bg-transparent text-foreground outline-none border-none p-0" placeholder="komut çalıştır..." autofocus />
          </div>
        </div>
      `;

    case "extensions":
      return `
        <div class="flex flex-col gap-2">
          <div class="text-xs font-medium text-foreground py-1">Yüklü Eklentiler ve Servisler</div>
          <div class="flex flex-col gap-1.5">
            <div class="p-2.5 rounded-lg bg-background border border-border hover:border-white/20 cursor-pointer transition-colors" data-action="openWebviewModal">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium text-foreground">LUX Futures XL</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Canlı</span>
              </div>
              <div class="text-[11px] text-muted-foreground">http://127.0.0.1:8000/#positions</div>
            </div>
            <div class="p-2.5 rounded-lg bg-background border border-border opacity-70">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium text-foreground">Chrome DevTools MCP</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Bağlı</span>
              </div>
              <div class="text-[11px] text-muted-foreground">Tarayıcı otomasyonu, CDP portu 49500</div>
            </div>
          </div>
        </div>
      `;

    default:
      return "";
  }
}

async function loadOverviewReview() {
  const container = document.getElementById("overview-review-container");
  if (!container) return;

  if (!window.luxAPI?.git?.getDiff) {
    container.innerHTML = `<div class="text-xs text-muted-foreground p-3">Git/Diff API kullanılamıyor.</div>`;
    return;
  }

  try {
    const diffState = await window.luxAPI.git.getDiff();
    container.innerHTML = window.renderDiffReviewContainerHtml(diffState, true);
    window.attachDiffReviewEvents(container, loadOverviewReview);
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400 p-3">Diff okunamadı: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadFilesList() {
  const container = document.getElementById("files-tree-list");
  if (!container) return;

  if (window.luxAPI?.fs) {
    const files = await window.luxAPI.fs.listFiles();
    if (Array.isArray(files)) {
      const renderTreeNodes = (nodes, depth = 0) => {
        return nodes
          .map((f) => {
            const pad = 6 + depth * 12;
            if (f.isDirectory) {
              return `
              <div class="lux-tree-dir-group">
                <div class="lux-tree-dir flex items-center gap-1.5 py-1 pr-1.5 rounded hover:bg-secondary cursor-pointer" style="padding-left: ${pad}px;">
                  <span class="text-muted-foreground">${ICONS.folder}</span>
                  <span class="truncate font-medium text-foreground">${escapeHtml(f.name)}</span>
                </div>
                <div class="lux-tree-children hidden">
                  ${Array.isArray(f.children) ? renderTreeNodes(f.children, depth + 1) : ""}
                </div>
              </div>
            `;
            }
            return `
            <div class="lux-tree-file flex items-center gap-1.5 py-1 pr-1.5 rounded hover:bg-secondary cursor-pointer" style="padding-left: ${pad}px;" data-file-path="${escapeHtml(f.path)}">
              <span class="text-muted-foreground">${ICONS.files}</span>
              <span class="truncate text-secondary-foreground">${escapeHtml(f.name)}</span>
            </div>
          `;
          })
          .join("");
      };

      container.innerHTML = renderTreeNodes(files);

      container.querySelectorAll(".lux-tree-dir").forEach((dirEl) => {
        dirEl.addEventListener("click", () => {
          dirEl.nextElementSibling?.classList.toggle("hidden");
        });
      });

      container.querySelectorAll(".lux-tree-file").forEach((fileEl) => {
        fileEl.addEventListener("click", () => {
          const fp = fileEl.getAttribute("data-file-path");
          if (fp) handleFileClick(fp);
        });
      });
      return;
    }
  }

  container.innerHTML = `
    <div class="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-secondary cursor-pointer">
      <span class="text-muted-foreground">${ICONS.folder}</span>
      <span class="font-medium text-foreground">src</span>
    </div>
    <div class="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-secondary cursor-pointer">
      <span class="text-muted-foreground">${ICONS.files}</span>
      <span>main.js</span>
    </div>
    <div class="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-secondary cursor-pointer">
      <span class="text-muted-foreground">${ICONS.files}</span>
      <span>package.json</span>
    </div>
  `;
}

function setupTerminalInput() {
  const input = document.getElementById("terminal-input");
  const outputBox = document.getElementById("terminal-output-box");
  if (!input || !outputBox) return;

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const cmd = input.value.trim();
      if (!cmd) return;

      input.value = "";
      terminalHistory.push(`> ${cmd}`);
      outputBox.innerHTML += `<div class="text-primary leading-relaxed">&gt; ${escapeHtml(cmd)}</div>`;

      if (window.luxAPI?.terminal) {
        const res = await window.luxAPI.terminal.execute(cmd);
        const resultText = res.output || res.error || "Tamamlandı.";
        terminalHistory.push(resultText);
        window.luxLastTerminalOutput = `PS > ${cmd}\n${resultText}`;
        outputBox.innerHTML += `<div class="text-foreground whitespace-pre-wrap leading-relaxed">${escapeHtml(resultText)}</div>`;
      } else {
        outputBox.innerHTML += `<div class="text-muted-foreground">Çalıştırıldı: ${escapeHtml(cmd)}</div>`;
      }

      outputBox.scrollTop = outputBox.scrollHeight;
    }
  });
}

function handleFileClick(filePath) {
  window.appStore.state.ideSplitActive = true;
  window.appStore.saveState();
  window.renderApp();
  if (window.loadEditorFile) {
    window.loadEditorFile(filePath);
  }
}

function openWebviewModal() {
  window.appStore.state.ideSplitActive = true;
  window.appStore.saveState();
  window.renderApp();
}

function openRunningTaskTerminal() {
  activeOverviewSubView = "terminal";
  renderRightPanel();
}

function cancelBackgroundTask() {
  window.appStore.state.backgroundTasksCount = 0;
  window.appStore.state.backgroundTaskName = "Boşta";
  window.appStore.saveState();
  renderRightPanel();
}

function openAllTasksModal() {
  activeOverviewSubView = "terminal";
  renderRightPanel();
}

function openOverviewCustomizeModal() {
  window.openSettingsModal();
}

window.openRightPanelTerminal = function () {
  window.appStore.state.rightPanelOpen = true;
  activeOverviewSubView = "terminal";
  window.appStore.saveState();
  window.renderApp();
};
