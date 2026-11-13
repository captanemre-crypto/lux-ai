// 1:1 Lux Auxiliary Split Panel & Monaco Code / Git Review / Browser / Terminal Hub

let auxViewMode = "home"; // 'home' | 'review' | 'editor' | 'terminal' | 'browser'
let auxBrowserUrl = "http://127.0.0.1:8000/#positions";
// Aux Browser iframe'i için sandbox: normal gezinme="" (kısıt yok),
// eklenti blob: belgeleri="allow-scripts" (same-origin erişim yok).
let auxFrameSandbox = "";
let auxIsMaximized = false;

let activeEditorFile = {
  name: "main.js",
  path: "main.js",
  content: `// Lux AI Main Engine Core\nconst { app, BrowserWindow, ipcMain } = require('electron');\n\napp.whenReady().then(() => {\n  console.log('Lux AI Engine running in native agentic mode.');\n});`,
  dirty: false,
  loaded: false
};

let workspaceFilesCache = [];
const unsavedEditorDrafts = new Map();
let monacoEditorInstance = null;
let monacoResizeObserver = null;
let monacoLoadPromise = null;
let editorToastTimer = null;

function normalizeEditorKey(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();
}

window.invalidateWorkspaceFilesCache = function () {
  workspaceFilesCache = [];
};

let auxTerminalLines = ["Lux AI Auxiliary Terminal (PowerShell 7)", "Hazır. Komut girmek için yazıp Enter'a basın."];

function disposeMonacoEditor() {
  if (monacoResizeObserver) {
    try {
      monacoResizeObserver.disconnect();
    } catch (e) {
      window.luxDebug?.("ideMode.js:42", e);
    }
    monacoResizeObserver = null;
  }
  if (monacoEditorInstance) {
    try {
      const model = monacoEditorInstance.getModel?.();
      monacoEditorInstance.dispose();
      if (model && !model.isDisposed?.()) {
        model.dispose();
      }
    } catch (e) {
      window.luxDebug?.("ideMode.js:52", e);
    }
    monacoEditorInstance = null;
  }
}

function getLanguageFromPath(filePath) {
  const lower = (filePath || "").toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".scss")) return "scss";
  if (lower.endsWith(".less")) return "less";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".ps1")) return "powershell";
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "shell";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".xml") || lower.endsWith(".svg")) return "xml";
  return "plaintext";
}

function getLanguageDisplayLabel(lang) {
  const labels = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    less: "LESS",
    python: "Python",
    markdown: "Markdown",
    powershell: "PowerShell",
    shell: "Shell",
    yaml: "YAML",
    sql: "SQL",
    xml: "XML",
    plaintext: "Düz Metin"
  };
  return labels[lang] || lang || "Düz Metin";
}

function flattenWorkspaceFiles(nodes, acc = [], prefix = "") {
  if (!Array.isArray(nodes)) return acc;
  for (const node of nodes) {
    const relPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.isDirectory) {
      if (Array.isArray(node.children)) {
        flattenWorkspaceFiles(node.children, acc, relPath);
      }
    } else {
      acc.push({
        name: node.name,
        path: node.path,
        relPath: relPath
      });
    }
  }
  return acc;
}

function showEditorStatusToast(message, isSuccess = true) {
  const toastEl = document.getElementById("editor-save-toast");
  if (!toastEl) return;
  if (editorToastTimer) clearTimeout(editorToastTimer);
  toastEl.textContent = message;
  toastEl.className = `text-[11px] font-medium px-2 py-0.5 rounded-md border transition-opacity ${
    isSuccess ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border-rose-500/30"
  }`;
  toastEl.style.opacity = "1";
  editorToastTimer = setTimeout(() => {
    if (toastEl.isConnected) {
      toastEl.style.opacity = "0";
    }
  }, 2400);
}

function updateEditorDirtyUI() {
  const dirtyDot = document.getElementById("editor-dirty-indicator");
  if (dirtyDot) {
    dirtyDot.classList.toggle("hidden", !activeEditorFile.dirty);
  }
  const saveBtn = document.getElementById("btn-save-code-file");
  if (saveBtn) {
    saveBtn.textContent = activeEditorFile.dirty ? "Kaydet *" : "Kaydet";
  }
}

async function saveCurrentEditorFile() {
  const textarea = document.getElementById("aux-editor-textarea");
  if (monacoEditorInstance) {
    activeEditorFile.content = monacoEditorInstance.getValue();
  } else if (textarea) {
    activeEditorFile.content = textarea.value;
  }

  if (!window.luxAPI?.fs?.writeFile || !activeEditorFile.path) {
    showEditorStatusToast("Dosya sistemi erişilemedi", false);
    return;
  }

  const res = await window.luxAPI.fs.writeFile(activeEditorFile.path, activeEditorFile.content);
  if (res?.success) {
    unsavedEditorDrafts.delete(normalizeEditorKey(activeEditorFile.path));
    if (res.path) {
      unsavedEditorDrafts.delete(normalizeEditorKey(res.path));
      activeEditorFile.path = res.path;
      activeEditorFile.name = res.path.split(/[/\\]/).pop() || activeEditorFile.name;
    }
    activeEditorFile.dirty = false;
    activeEditorFile.loaded = true;
    updateEditorDirtyUI();
    window.invalidateWorkspaceFilesCache?.();
    showEditorStatusToast("✓ Kaydedildi", true);
    window.playLuxSound?.("codeActionApplied");
    window.refreshDiffViews?.();
  } else {
    showEditorStatusToast(res?.error || "Kaydedilemedi", false);
  }
}

window.saveCurrentEditorFile = saveCurrentEditorFile;
window.getAuxViewMode = () => auxViewMode;

let monacoLoaderScriptPromise = null;

// Monaco, `scripts/sync-monaco.js` (postinstall) tarafından src/vendor/monaco/vs
// altına kopyalanır. Böylece ne node_modules ne de CDN gerekir; asar paketinde de
// (src/** paket içinde olduğu için) çalışır.
const MONACO_VENDOR_AMD_DIR = "vendor/monaco/vs";

function ensureMonacoAmdLoader() {
  if (typeof window.require === "function") {
    return Promise.resolve();
  }
  if (monacoLoaderScriptPromise) return monacoLoaderScriptPromise;
  monacoLoaderScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MONACO_VENDOR_AMD_DIR}/loader.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      monacoLoaderScriptPromise = null;
      reject(new Error("Monaco yükleyicisi bulunamadı (src/vendor/monaco/vs/loader.js). " + "Kurulumu tamamlayın: npm run vendor:monaco"));
    };
    document.head.appendChild(script);
  });
  return monacoLoaderScriptPromise;
}

function ensureMonaco() {
  if (window.monaco && window.monaco.editor) {
    return Promise.resolve(window.monaco);
  }
  if (monacoLoadPromise) return monacoLoadPromise;

  monacoLoadPromise = ensureMonacoAmdLoader()
    .then(
      () =>
        new Promise((resolve, reject) => {
          if (typeof window.require !== "function") {
            reject(new Error("Monaco AMD yükleyici bulunamadı"));
            return;
          }

          const vsBase = new URL(MONACO_VENDOR_AMD_DIR, window.location.href).href;
          window.require.config({
            paths: { vs: vsBase }
          });

          window.require(
            ["vs/editor/editor.main"],
            () => {
              if (window.monaco?.editor) {
                try {
                  window.monaco.editor.defineTheme("lux-onyx", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [
                      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
                      { token: "keyword", foreground: "60a5fa" },
                      { token: "string", foreground: "34d399" },
                      { token: "number", foreground: "fbbf24" }
                    ],
                    colors: {
                      "editor.background": "#070709",
                      "editor.foreground": "#e4e4e7",
                      "editor.lineHighlightBackground": "#121218",
                      "editorLineNumber.foreground": "#52525b",
                      "editorLineNumber.activeForeground": "#a1a1aa",
                      "editorGutter.background": "#070709",
                      "editor.selectionBackground": "#2563eb44",
                      "editorWidget.background": "#121216",
                      "editorWidget.border": "#27272a",
                      "editorSuggestWidget.background": "#121216",
                      "editorSuggestWidget.border": "#27272a",
                      "input.background": "#16161b",
                      "scrollbarSlider.background": "#27272a80",
                      "scrollbarSlider.hoverBackground": "#3f3f46aa"
                    }
                  });
                } catch (e) {
                  window.luxDebug?.("ideMode.js:257", e);
                }
                resolve(window.monaco);
              } else {
                reject(new Error("Monaco çekirdeği yüklenemedi"));
              }
            },
            (err) => {
              reject(err || new Error("Monaco yükleme hatası"));
            }
          );
        })
    )
    .catch((err) => {
      monacoLoadPromise = null;
      throw err;
    });

  return monacoLoadPromise;
}

function renderIdePanel() {
  const container = document.getElementById("ide-split-container");
  if (!container) return;

  disposeMonacoEditor();

  const isActive = window.appStore.state.ideSplitActive;
  if (!isActive) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  if (auxIsMaximized) {
    container.style.width = "100%";
    container.className = "w-full shrink-0 h-full z-20 border-l border-border relative transition-none";
  } else {
    const curWidth = window.appStore.state.splitPaneWidth || Math.round(window.innerWidth * 0.45);
    container.style.width = curWidth + "px";
    container.className = "shrink-0 h-full z-20 border-l border-border relative transition-none";
  }

  container.innerHTML = `
    <div class="h-full w-full flex flex-col bg-[#070709] select-none text-foreground relative overflow-hidden" data-testid="auxiliary-split-panel">
      
      <!-- Left Draggable Sash Resizer Handle (orta çizgi sürükleyici) -->
      ${
        !auxIsMaximized
          ? `
        <div id="split-sash-handle" data-testid="split-sash" class="absolute z-50 bg-transparent flex items-center justify-center touch-none top-0 left-0 w-3 -translate-x-1.5 h-full cursor-col-resize shrink-0 group select-none" title="Genişliği Ayarlamak İçin Sürükleyin">
          <div class="split-sash-line transition-all w-[3px] h-full bg-transparent group-hover:bg-primary group-active:bg-primary pointer-events-none"></div>
        </div>
      `
          : ""
      }

      <!-- Top Action Toolbar (Height 40px) -->
      <div class="h-10 px-3 bg-sidebar/50 border-b border-border/40 flex items-center justify-between shrink-0">
        <!-- Left: Back Button (if not on home) or Status -->
        <div class="flex items-center gap-2 min-w-0">
          ${
            auxViewMode !== "home"
              ? `
            <button id="aux-btn-back" class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" title="Geri Dön">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M294.92-450L522.77-222.15L480-180L180-480L480-780l42.77,42.15L294.92-510H780v60H294.92Z"/>
              </svg>
            </button>
            <span class="text-xs font-medium text-foreground uppercase tracking-wide truncate">${escapeHtml(getAuxTitle(auxViewMode))}</span>
          `
              : `
            <span class="text-xs font-medium text-muted-foreground">Yardımcı Görünüm</span>
          `
          }
        </div>

        <!-- Quick Mode Pills when inside subview + Window Buttons -->
        <div class="flex items-center gap-1 shrink-0">
          <button id="aux-tab-review" class="h-7 px-2 rounded-md text-[11px] font-medium ${auxViewMode === "review" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"} cursor-pointer transition-colors" title="Değişiklik İncelemesi">
            İnceleme
          </button>
          <button id="aux-tab-editor" class="h-7 px-2 rounded-md text-[11px] font-medium ${auxViewMode === "editor" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"} cursor-pointer transition-colors" title="Monaco Kod Düzenleyici">
            Editör
          </button>
          <button id="aux-tab-terminal" class="h-7 px-2 rounded-md text-[11px] font-medium ${auxViewMode === "terminal" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"} cursor-pointer transition-colors" title="Terminal">
            Terminal
          </button>

          <!-- Maximize / Restore Toggle -->
          <button id="aux-btn-maximize" class="h-7 w-7 rounded-lg flex items-center justify-center text-secondary-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors ml-1" title="${auxIsMaximized ? "Görünümü Daralt" : "Tam Ekrana Genişlet"}">
            ${ICONS.fullscreen}
          </button>

          <!-- Close Pane Toggle -->
          <button id="aux-btn-close" class="h-7 w-7 rounded-lg flex items-center justify-center text-secondary-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" title="Bölmeyi Kapat">
            ${ICONS.closePane}
          </button>
        </div>
      </div>

      <!-- Main Body Area -->
      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col relative" id="aux-main-content">
        ${renderAuxBody()}
      </div>

    </div>
  `;

  // Quick view tabs
  document.getElementById("aux-tab-review")?.addEventListener("click", () => {
    auxViewMode = "review";
    renderIdePanel();
  });
  document.getElementById("aux-tab-editor")?.addEventListener("click", () => {
    openWorkspaceEditor();
  });
  document.getElementById("aux-tab-terminal")?.addEventListener("click", () => {
    auxViewMode = "terminal";
    renderIdePanel();
  });

  // Toolbar listeners
  document.getElementById("aux-btn-maximize")?.addEventListener("click", () => {
    auxIsMaximized = !auxIsMaximized;
    renderIdePanel();
  });

  document.getElementById("aux-btn-close")?.addEventListener("click", () => {
    window.appStore.state.ideSplitActive = false;
    window.appStore.saveState();
    window.renderApp();
  });

  document.getElementById("aux-btn-back")?.addEventListener("click", () => {
    auxViewMode = "home";
    renderIdePanel();
  });

  // Attach sash dragging resizer
  setupSplitResize(container);

  // Attach view-specific listeners
  attachAuxViewEvents();
}

function setupSplitResize(container) {
  const sash = document.getElementById("split-sash-handle");
  if (!sash) return;

  sash.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (auxIsMaximized) return;

    const startX = e.clientX;
    const startWidth = container.offsetWidth;
    document.body.classList.add("resizing-col");

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = startX - moveEvent.clientX; // Left drag increases split width
      let newWidth = startWidth + deltaX;

      const minWidth = 280;
      const maxWidth = window.innerWidth - 300; // Leave space for chat
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      container.style.width = newWidth + "px";
      window.appStore.state.splitPaneWidth = newWidth;
      if (monacoEditorInstance) {
        try {
          monacoEditorInstance.layout();
        } catch (e) {
          window.luxDebug?.("ideMode.js:430", e);
        }
      }
    };

    const onMouseUp = () => {
      document.body.classList.remove("resizing-col");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.appStore.saveState();
      if (monacoEditorInstance) {
        try {
          monacoEditorInstance.layout();
        } catch (e) {
          window.luxDebug?.("ideMode.js:442", e);
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function getAuxTitle(mode) {
  switch (mode) {
    case "review":
      return "İnceleme (Git Diff)";
    case "editor":
      return activeEditorFile.name || "Kod Düzenleyici";
    case "terminal":
      return "Entegre Terminal";
    case "browser":
      return "Dahili Tarayıcı";
    default:
      return "Görünüm";
  }
}

function renderAuxBody() {
  switch (auxViewMode) {
    case "home":
      return renderAuxHome();
    case "review":
      return renderAuxReview();
    case "editor":
      return renderAuxEditor();
    case "terminal":
      return renderAuxTerminal();
    case "browser":
      return renderAuxBrowser();
    default:
      return renderAuxHome();
  }
}

// 1. Home Landing Screen
function renderAuxHome() {
  const state = window.appStore.state;
  return `
    <div class="w-full max-w-lg mx-auto pt-8 px-6 flex flex-col gap-6">
      
      <!-- Search or enter a URL Input Bar -->
      <div class="w-full">
        <div class="aux-search-bar flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-blue-500/40 bg-[#0a0a0f] text-foreground">
          <span class="text-muted-foreground shrink-0 flex items-center">${ICONS.search}</span>
          <input id="aux-url-input" type="text" placeholder="URL girin veya arama yapın..." class="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-sans" />
        </div>
      </div>

      <!-- 4 Quick Action Rows -->
      <div class="flex flex-col gap-1 w-full pl-1">
        <button id="aux-action-review" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors text-left w-full">
          <span class="text-muted-foreground shrink-0">${ICONS.review}</span>
          <span class="font-normal text-[13px]">İnceleme (Git Diff)</span>
        </button>

        <button id="aux-action-open-file" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors text-left w-full">
          <span class="text-muted-foreground shrink-0">${ICONS.files}</span>
          <span class="font-normal text-[13px]">Dosya Düzenleyici (Monaco IDE)</span>
        </button>

        <button id="aux-action-terminal" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors text-left w-full">
          <span class="text-muted-foreground shrink-0">${ICONS.terminal}</span>
          <span class="font-normal text-[13px]">Entegre Terminal</span>
        </button>

        <button id="aux-action-browser" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors text-left w-full">
          <span class="text-muted-foreground shrink-0">${ICONS.browser}</span>
          <span class="font-normal text-[13px]">Dahili Tarayıcı</span>
        </button>
      </div>

      <!-- Background Tasks Section -->
      <div class="flex flex-col gap-1.5 pt-2 pl-1">
        <div class="flex items-center gap-2 px-3">
          <span class="text-xs font-semibold text-secondary-foreground select-none">Arka Plan Görevleri</span>
          ${state.backgroundTasksCount > 0 ? `<span class="bg-secondary px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground font-medium">${state.backgroundTasksCount}</span>` : ""}
        </div>

        <div id="aux-task-row" class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-secondary-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer transition-colors">
          <span class="text-primary font-mono font-bold">&gt;_</span>
          <span class="truncate flex-1 font-medium ${state.backgroundTasksCount > 0 ? "" : "text-muted-foreground"}">${escapeHtml(state.backgroundTasksCount > 0 ? state.backgroundTaskName || "Çalışan görev" : "Görev yok")}</span>
        </div>

        ${
          state.backgroundTasksCount > 0
            ? `<button id="aux-see-all-tasks" class="text-xs text-muted-foreground hover:text-secondary-foreground px-3 pt-0.5 text-left cursor-pointer transition-colors">
          Tümünü gör
        </button>`
            : ""
        }
      </div>

    </div>
  `;
}

// 2. Live Review Diff Screen
function renderAuxReview() {
  return `
    <div id="aux-review-container" class="p-4 flex flex-col gap-3">
      <div class="text-xs text-muted-foreground py-4 text-center">Değişiklikler ve Git farkları yükleniyor...</div>
    </div>
  `;
}

window.loadAuxReviewDiffs = async function () {
  const container = document.getElementById("aux-review-container");
  if (!container) return;

  if (!window.luxAPI?.git?.getDiff) {
    container.innerHTML = `<div class="text-xs text-muted-foreground p-3">Git/Diff köprüsü kullanılamıyor.</div>`;
    return;
  }

  try {
    const diffState = await window.luxAPI.git.getDiff();
    if (typeof window.renderDiffReviewContainerHtml === "function") {
      container.innerHTML = window.renderDiffReviewContainerHtml(diffState, false);
      window.attachDiffReviewEvents(container, window.loadAuxReviewDiffs);
    }
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400 p-3">Diff okunamadı: ${escapeHtml(err.message)}</div>`;
  }
};

// 3. Monaco Code Editor Screen
function renderAuxEditor() {
  const lang = getLanguageFromPath(activeEditorFile.path);
  const langLabel = getLanguageDisplayLabel(lang);

  return `
    <div class="h-full w-full flex flex-col min-h-0 overflow-hidden">
      <!-- Editor Toolbar -->
      <div class="h-9 px-3 bg-card/80 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span id="editor-dirty-indicator" class="w-2 h-2 rounded-full bg-amber-400 shrink-0 ${activeEditorFile.dirty ? "" : "hidden"}" title="Kaydedilmemiş değişiklikler var"></span>
          <select id="aux-editor-file-select" class="max-w-[260px] bg-[#141418] text-foreground border border-border/70 rounded-md px-2 py-1 text-xs font-mono outline-none cursor-pointer truncate" style="color-scheme: dark;">
            <option value="${escapeHtml(activeEditorFile.path)}">${escapeHtml(activeEditorFile.path)}</option>
          </select>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span id="editor-save-toast" class="text-[11px] font-medium px-2 py-0.5 rounded-md border opacity-0 pointer-events-none transition-opacity"></span>
          <button id="btn-save-code-file" type="button" class="lux-btn px-2.5 py-1 text-xs bg-primary text-white hover:bg-primary/90 rounded-md cursor-pointer transition-colors font-medium" title="Kaydet (Ctrl+S)">
            ${activeEditorFile.dirty ? "Kaydet *" : "Kaydet"}
          </button>
        </div>
      </div>

      <!-- Monaco Mount Container -->
      <div class="flex-1 min-h-0 relative overflow-hidden bg-[#070709]" id="monaco-editor-wrapper">
        <div id="monaco-editor-mount" class="w-full h-full"></div>
        <textarea id="aux-editor-textarea" class="hidden w-full h-full bg-[#070709] text-foreground p-3 font-mono text-xs leading-relaxed outline-none resize-none border-none select-text" spellcheck="false">${escapeHtml(activeEditorFile.content)}</textarea>
      </div>

      <!-- Status Footer -->
      <div class="h-6 px-3 bg-sidebar border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono shrink-0">
        <span class="truncate max-w-[60%]" title="${escapeHtml(activeEditorFile.path)}">${escapeHtml(activeEditorFile.path)}</span>
        <div class="flex items-center gap-3 shrink-0">
          <span id="editor-cursor-pos">Sat 1, Süt 1</span>
          <span>UTF-8</span>
          <span id="editor-lang-label" class="text-primary">${escapeHtml(langLabel)}</span>
        </div>
      </div>
    </div>
  `;
}

async function mountMonacoEditor() {
  const mountEl = document.getElementById("monaco-editor-mount");
  const fallbackTextarea = document.getElementById("aux-editor-textarea");
  if (!mountEl) return;

  // Populate quick file selector in toolbar
  populateEditorFileSelector();

  const lang = getLanguageFromPath(activeEditorFile.path);
  const langLabelEl = document.getElementById("editor-lang-label");
  if (langLabelEl) langLabelEl.textContent = getLanguageDisplayLabel(lang);

  try {
    const monaco = await ensureMonaco();
    if (!mountEl.isConnected) return; // View changed while loading

    const editor = monaco.editor.create(mountEl, {
      value: activeEditorFile.content || "",
      language: lang,
      theme: "lux-onyx",
      automaticLayout: false,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "'Google Sans Code', 'JetBrains Mono', Consolas, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      tabSize: 2,
      wordWrap: "on",
      padding: { top: 10, bottom: 10 },
      renderLineHighlight: "line"
    });

    monacoEditorInstance = editor;

    // Bind Ctrl+S inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentEditorFile();
    });

    // Track dirty flag on content edits
    editor.onDidChangeModelContent(() => {
      activeEditorFile.content = editor.getValue();
      if (!activeEditorFile.dirty) {
        activeEditorFile.dirty = true;
        updateEditorDirtyUI();
      }
    });

    // Live cursor position footer
    editor.onDidChangeCursorPosition((ev) => {
      const posEl = document.getElementById("editor-cursor-pos");
      if (posEl && ev?.position) {
        posEl.textContent = `Sat ${ev.position.lineNumber}, Süt ${ev.position.column}`;
      }
    });

    // Responsive resize observer
    monacoResizeObserver = new ResizeObserver(() => {
      if (monacoEditorInstance) {
        try {
          monacoEditorInstance.layout();
        } catch (e) {
          window.luxDebug?.("ideMode.js:680", e);
        }
      }
    });
    monacoResizeObserver.observe(mountEl);

    requestAnimationFrame(() => {
      if (monacoEditorInstance) {
        try {
          monacoEditorInstance.layout();
        } catch (e) {
          window.luxDebug?.("ideMode.js:689", e);
        }
      }
    });
  } catch (err) {
    console.warn("Monaco Editor başlatılamadı, yedek düz metin editörüne geçiliyor:", err);
    showEditorStatusToast("Monaco yüklenemedi — basit editör", false);
    if (mountEl) mountEl.classList.add("hidden");
    if (fallbackTextarea) {
      fallbackTextarea.classList.remove("hidden");
      fallbackTextarea.addEventListener("input", () => {
        activeEditorFile.content = fallbackTextarea.value;
        activeEditorFile.dirty = true;
        updateEditorDirtyUI();
      });
      fallbackTextarea.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveCurrentEditorFile();
        }
      });
    }
  }
}

async function populateEditorFileSelector() {
  const selectEl = document.getElementById("aux-editor-file-select");
  if (!selectEl || !window.luxAPI?.fs?.listFiles) return;

  try {
    if (workspaceFilesCache.length === 0) {
      const tree = await window.luxAPI.fs.listFiles();
      workspaceFilesCache = flattenWorkspaceFiles(tree);
    }
    const items = workspaceFilesCache.slice(0, 120);
    const curPath = (activeEditorFile.path || "").replace(/\\/g, "/").toLowerCase();
    const hasCurrent = items.some((f) => {
      const fp = (f.path || "").replace(/\\/g, "/").toLowerCase();
      const rp = (f.relPath || "").replace(/\\/g, "/").toLowerCase();
      return fp === curPath || rp === curPath;
    });
    if (!hasCurrent && activeEditorFile.path) {
      items.unshift({ name: activeEditorFile.name, path: activeEditorFile.path, relPath: activeEditorFile.name });
    }

    selectEl.innerHTML = items
      .map((f) => {
        const fp = (f.path || "").replace(/\\/g, "/").toLowerCase();
        const rp = (f.relPath || "").replace(/\\/g, "/").toLowerCase();
        const isSelected = fp === curPath || rp === curPath;
        return `<option value="${escapeHtml(f.path)}" ${isSelected ? "selected" : ""}>${escapeHtml(f.relPath || f.name)}</option>`;
      })
      .join("");

    selectEl.onchange = () => {
      const chosen = selectEl.value;
      if (chosen && chosen !== activeEditorFile.path) {
        window.loadEditorFile(chosen);
      }
    };
  } catch (e) {
    window.luxDebug?.("ideMode.js:748", e);
  }
}

async function openWorkspaceEditor() {
  if (!activeEditorFile.loaded && window.luxAPI?.fs?.readFile) {
    const res = await window.luxAPI.fs.readFile(activeEditorFile.path || "main.js");
    if (res?.success) {
      activeEditorFile.path = res.path || activeEditorFile.path;
      activeEditorFile.content = res.content;
      activeEditorFile.loaded = true;
      activeEditorFile.dirty = false;
    }
  }
  auxViewMode = "editor";
  renderIdePanel();
}

// 4. Terminal Screen
function renderAuxTerminal() {
  return `
    <div class="h-full flex flex-col p-4 bg-[#050508] font-mono text-xs">
      <div id="aux-terminal-logs" class="flex-1 overflow-y-auto space-y-1 mb-2 text-muted-foreground">
        ${auxTerminalLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("")}
      </div>
      <div class="flex items-center gap-2 pt-2 border-t border-border/40 shrink-0">
        <span class="text-primary font-bold">PS &gt;</span>
        <input id="aux-terminal-input" type="text" class="flex-1 bg-transparent text-foreground outline-none border-none" placeholder="komut çalıştır..." autofocus />
      </div>
    </div>
  `;
}

// 5. Embedded Browser Screen
function renderAuxBrowser() {
  return `
    <div class="h-full flex flex-col bg-background">
      <div class="h-8 px-2 bg-sidebar border-b border-border flex items-center gap-2 shrink-0">
        <input id="aux-browser-url-bar" type="text" value="${escapeHtml(auxBrowserUrl)}" class="flex-1 px-2 py-0.5 rounded bg-background border border-border text-xs text-foreground outline-none" />
        <button id="aux-browser-pick" class="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer" title="Konum işaretle — sayfada tıklayarak koordinat seç">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>
        </button>
        <button id="aux-browser-reload" class="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer" title="Yenile">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h60v220H560v-60h116q-46-52-108.5-81T480-750q-109 0-184.5 75.5T220-490q0 109 75.5 184.5T480-230q88 0 154-52t82-138h64q-17 114-100 182t-200 68Z"/>
          </svg>
        </button>
      </div>
      <div class="flex-1 relative overflow-hidden bg-white" id="aux-browser-viewport">
        <iframe src="${escapeHtml(auxBrowserUrl)}" ${auxFrameSandbox ? `sandbox="${auxFrameSandbox}"` : ""} class="w-full h-full border-none" id="aux-browser-iframe" referrerpolicy="no-referrer"></iframe>
      </div>
    </div>
  `;
}

function normalizeBrowserUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^(javascript|data|vbscript):/i.test(v)) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^file:\/\//i.test(v)) return v;
  if (/^[a-zA-Z]:[\\/]/.test(v)) {
    return "file:///" + v.replace(/\\/g, "/");
  }
  return "http://" + v;
}

window.openAuxBrowserUrl = function (rawUrl, opts) {
  const normalized = normalizeBrowserUrl(rawUrl);
  if (!normalized) return false;
  auxBrowserUrl = normalized;
  auxFrameSandbox = opts && opts.sandbox === true ? "allow-scripts" : "";
  auxViewMode = "browser";
  if (!window.appStore.state.ideSplitActive) {
    window.appStore.state.ideSplitActive = true;
    window.appStore.saveState();
    window.renderApp();
  } else {
    renderIdePanel();
  }
  return true;
};

function attachAuxViewEvents() {
  // URL Input Enter key
  const urlInput = document.getElementById("aux-url-input");
  urlInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const normalized = normalizeBrowserUrl(urlInput.value);
      if (normalized) {
        auxBrowserUrl = normalized;
        auxFrameSandbox = "";
        auxViewMode = "browser";
        renderIdePanel();
      }
    }
  });

  // Home Action Buttons
  document.getElementById("aux-action-review")?.addEventListener("click", () => {
    auxViewMode = "review";
    renderIdePanel();
  });

  document.getElementById("aux-action-open-file")?.addEventListener("click", () => {
    openWorkspaceEditor();
  });

  document.getElementById("aux-action-terminal")?.addEventListener("click", () => {
    auxViewMode = "terminal";
    renderIdePanel();
  });

  document.getElementById("aux-action-browser")?.addEventListener("click", () => {
    auxViewMode = "browser";
    renderIdePanel();
  });

  document.getElementById("aux-task-row")?.addEventListener("click", () => {
    auxViewMode = "terminal";
    renderIdePanel();
  });

  document.getElementById("aux-see-all-tasks")?.addEventListener("click", () => {
    auxViewMode = "terminal";
    renderIdePanel();
  });

  if (auxViewMode === "review") {
    window.loadAuxReviewDiffs();
  }

  if (auxViewMode === "editor") {
    document.getElementById("btn-save-code-file")?.addEventListener("click", saveCurrentEditorFile);
    mountMonacoEditor();
  }

  // Terminal Input
  const termInput = document.getElementById("aux-terminal-input");
  const termLogs = document.getElementById("aux-terminal-logs");
  termInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const cmd = termInput.value.trim();
      if (!cmd) return;
      termInput.value = "";
      auxTerminalLines.push(`PS > ${cmd}`);
      if (termLogs) {
        termLogs.innerHTML += `<div class="text-primary leading-relaxed">PS &gt; ${escapeHtml(cmd)}</div>`;
        if (window.luxAPI?.terminal) {
          const res = await window.luxAPI.terminal.execute(cmd);
          const out = res.output || res.error || "Tamamlandı.";
          auxTerminalLines.push(out);
          window.luxLastTerminalOutput = `PS > ${cmd}\n${out}`;
          termLogs.innerHTML += `<div class="text-foreground whitespace-pre-wrap leading-relaxed">${escapeHtml(out)}</div>`;
        }
        termLogs.scrollTop = termLogs.scrollHeight;
      }
    }
  });

  // Browser URL bar Enter & reload
  const browserBar = document.getElementById("aux-browser-url-bar");
  browserBar?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const normalized = normalizeBrowserUrl(browserBar.value);
      if (normalized) {
        auxBrowserUrl = normalized;
        auxFrameSandbox = "";
        const iframe = document.getElementById("aux-browser-iframe");
        iframe?.removeAttribute("sandbox");
        if (iframe) iframe.src = auxBrowserUrl;
      }
    }
  });

  document.getElementById("aux-browser-reload")?.addEventListener("click", () => {
    const iframe = document.getElementById("aux-browser-iframe");
    if (iframe) iframe.src = auxBrowserUrl;
  });

  document.getElementById("aux-browser-pick")?.addEventListener("click", () => {
    toggleBrowserPickMode();
  });
}

window.activeEditorPath = function () {
  return activeEditorFile?.path || "";
};

window.loadEditorFile = async function (filePath) {
  if (!window.luxAPI?.fs?.readFile) return;
  if (activeEditorFile?.path && activeEditorFile.dirty) {
    unsavedEditorDrafts.set(normalizeEditorKey(activeEditorFile.path), activeEditorFile.content);
  }
  const res = await window.luxAPI.fs.readFile(filePath);
  if (res?.success) {
    const normalized = res.path || filePath;
    const normKey = normalizeEditorKey(normalized);
    const rawKey = normalizeEditorKey(filePath);
    const hasDraft = unsavedEditorDrafts.has(normKey) || unsavedEditorDrafts.has(rawKey);
    const draftContent = unsavedEditorDrafts.has(normKey) ? unsavedEditorDrafts.get(normKey) : unsavedEditorDrafts.get(rawKey);
    activeEditorFile = {
      name: normalized.split(/[/\\]/).pop(),
      path: normalized,
      content: hasDraft ? draftContent : res.content,
      dirty: hasDraft,
      loaded: true
    };
    auxViewMode = "editor";
    if (!window.appStore.state.ideSplitActive) {
      window.appStore.state.ideSplitActive = true;
      window.appStore.saveState();
      window.renderApp();
    } else {
      renderIdePanel();
    }
  }
};

// ===== Dahili Tarayıcı — Koordinat (Konum) Seçici =====
// Sayfa cross-origin iframe içinde olabilir; sayfanın DOM'una dokunmadan,
// iframe'in üstüne geçici şeffaf bir katman koyarak tıklanan noktayı
// iframe viewport pikseli (ve yüzdesi) olarak kaydederiz.
// İşaret YAZI OLARAK MESAJA YAZILMAZ; yalnız örnek görselindeki gibi küçük
// bir kutucuk (chip) olarak gösterilir. Gönderim anında koordinatlar
// modele gizli bağlam ([KONUM REFERANSLARI]) olarak eklenir.
let auxPickActive = false;
let auxPickOverlay = null;
let auxPickKeyHandler = null;

function auxPickCurrentUrl() {
  const iframe = document.getElementById("aux-browser-iframe");
  return (iframe && (iframe.getAttribute("src") || iframe.src)) || auxBrowserUrl || "";
}

function syncComposerAttachmentTray() {
  const tray = document.getElementById("composer-attachment-tray");
  if (!tray) return;
  const hasChips = tray.childElementCount > 0;
  tray.classList.toggle("hidden", !hasChips);
  tray.classList.toggle("flex", hasChips);
}

function auxPendingLocations() {
  if (!Array.isArray(window.__luxPendingLocations)) window.__luxPendingLocations = [];
  return window.__luxPendingLocations;
}

// Bekleyen konumları VE çip kutusunu temizler; modele eklenecek gizli bağlam
// metnini döndürür (konum yoksa boş string).
window.consumePendingLocationPrompt = function () {
  const pending = auxPendingLocations().splice(0, auxPendingLocations().length);
  const tray = document.getElementById("composer-attachment-tray");
  if (tray) tray.innerHTML = "";
  syncComposerAttachmentTray();
  if (pending.length === 0) return "";
  const lines = pending.map(
    (l) => `- ${l.url} @ x:${l.x}px, y:${l.y}px (%${l.px}, %${l.py}) — kullanıcı sayfada bu noktayı işaretledi (olası tıklama hedefi)`
  );
  return `\n\n[KONUM REFERANSLARI]\n${lines.join("\n")}`;
};

window.hasPendingLocationAttachments = function () {
  return auxPendingLocations().length > 0;
};

window.clearComposerAttachmentTray = function () {
  const tray = document.getElementById("composer-attachment-tray");
  if (tray) tray.innerHTML = "";
  syncComposerAttachmentTray();
};

function auxPickPercent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function addLocationAttachmentChip(url, x, y, viewportW, viewportH) {
  const tray = document.getElementById("composer-attachment-tray");
  if (!tray) return;

  const px = auxPickPercent(x, viewportW);
  const py = auxPickPercent(y, viewportH);
  let host = url;
  try {
    host = new URL(url).host || url;
  } catch (_) {
    host = String(url).split(/[/?#]/)[0];
  }

  const entry = { url, x, y, px, py };
  auxPendingLocations().push(entry);

  const chip = document.createElement("span");
  chip.className = "lux-location-chip";
  chip.title = `${url}\nKonum: x ${x}px, y ${y}px (%${px}, %${py})`;
  chip.innerHTML =
    '<span class="lux-location-chip-pin">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
    "</span>" +
    '<span class="lux-location-chip-body">' +
    `<span class="lux-location-chip-title">${escapeHtml(host)}</span>` +
    `<span class="lux-location-chip-meta">x:${x} · y:${y} · %${px}/%${py}</span>` +
    "</span>" +
    '<button type="button" class="lux-location-chip-remove" aria-label="Konum işaretini kaldır" title="Konum işaretini kaldır">✕</button>';

  chip.querySelector(".lux-location-chip-remove")?.addEventListener("click", () => {
    const list = auxPendingLocations();
    const idx = list.indexOf(entry);
    if (idx !== -1) list.splice(idx, 1);
    chip.remove();
    syncComposerAttachmentTray();
    document.getElementById("composer-textarea")?.focus();
  });

  tray.appendChild(chip);
  syncComposerAttachmentTray();
  document.getElementById("composer-textarea")?.focus();
}

function onAuxPickMouseMove(e) {
  const overlay = auxPickOverlay;
  if (!overlay) return;
  const reticle = overlay.querySelector(".aux-browser-pick-reticle");
  if (!reticle) return;
  const rect = overlay.getBoundingClientRect();
  reticle.style.display = "block";
  reticle.style.left = `${e.clientX - rect.left}px`;
  reticle.style.top = `${e.clientY - rect.top}px`;
}

function onAuxPickClick(e) {
  const overlay = auxPickOverlay;
  if (!overlay) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = overlay.getBoundingClientRect();
  const x = Math.round(Math.max(0, Math.min(rect.width, e.clientX - rect.left)));
  const y = Math.round(Math.max(0, Math.min(rect.height, e.clientY - rect.top)));
  const url = auxPickCurrentUrl();
  const vw = Math.round(rect.width);
  const vh = Math.round(rect.height);
  exitBrowserPickMode();
  addLocationAttachmentChip(url, x, y, vw, vh);
}

function exitBrowserPickMode() {
  if (auxPickOverlay) {
    auxPickOverlay.removeEventListener("mousemove", onAuxPickMouseMove);
    auxPickOverlay.removeEventListener("click", onAuxPickClick);
    auxPickOverlay.remove();
    auxPickOverlay = null;
  }
  auxPickActive = false;
  if (auxPickKeyHandler) {
    window.removeEventListener("keydown", auxPickKeyHandler, true);
    auxPickKeyHandler = null;
  }
  const btn = document.getElementById("aux-browser-pick");
  btn?.classList.remove("text-primary", "bg-secondary/70");
}

function toggleBrowserPickMode(force) {
  const next = typeof force === "boolean" ? force : !auxPickActive;
  if (next === auxPickActive) return;
  if (!next) {
    exitBrowserPickMode();
    return;
  }
  const viewport = document.getElementById("aux-browser-viewport");
  if (!viewport) return;

  auxPickActive = true;
  const overlay = document.createElement("div");
  overlay.id = "aux-browser-pick-overlay";
  overlay.className = "aux-browser-pick-overlay";
  overlay.innerHTML =
    '<div class="aux-browser-pick-hint">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#93c5fd"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
    "Konumu işaretlemek için sayfaya tıklayın <kbd>ESC</kbd> iptal" +
    "</div>" +
    '<div class="aux-browser-pick-reticle" style="display:none"></div>';

  overlay.addEventListener("mousemove", onAuxPickMouseMove);
  overlay.addEventListener("click", onAuxPickClick);
  viewport.appendChild(overlay);
  auxPickOverlay = overlay;

  // Yakalama fazında dinle: ESC seçici açıkken global handler'ı tetiklemesin
  auxPickKeyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      exitBrowserPickMode();
    }
  };
  window.addEventListener("keydown", auxPickKeyHandler, true);

  const btn = document.getElementById("aux-browser-pick");
  btn?.classList.add("text-primary", "bg-secondary/70");
}
