// Chat Area & Floating Composer with Real AI Engine & Agentic Tool Loop (Exact Lux Replica)

window.isGenerating = false;
window.__luxActiveTurnId = 0;
let currentAbortController = null;
let currentStreamingTimer = null;

function isTurnCanceled(assistantMsg = null) {
  if (!window.isGenerating) return true;
  if (!assistantMsg) return false;
  if (assistantMsg.__aborted) return true;
  if (assistantMsg.__turnId && assistantMsg.__turnId !== window.__luxActiveTurnId) return true;
  return false;
}

window.stopAllAssistantOutput = function (interrupted = false) {
  try {
    window.stopSpeaking?.();
  } catch (_) {}
  try {
    window.stopLullabyAudio?.();
  } catch (_) {}
  try {
    window.abortGeneration?.(Boolean(interrupted));
  } catch (_) {}
};

// djb2 tabanlı, hızlı ve çakışması ihmal edilebilir satır imzası
function chatMessageSignature(msg) {
  const s = JSON.stringify([
    msg.id,
    msg.role,
    msg.content,
    msg.stepLabel,
    Boolean(msg.isStreaming),
    msg.toolSteps || null,
    msg.media || null,
    msg.lullaby || null,
    msg.createdFiles || null,
    msg.modelName || null,
    msg.tableData || null
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36) + ":" + s.length;
}

// Ajan görselinin görünen adı: açık başlık yoksa dosya adına, o da yoksa sıraya düşer
function mediaItemName(m, index) {
  const explicit = String(m?.title || "").trim();
  if (explicit) return explicit;
  const src = String(m?.localPath || m?.fileUrl || m?.url || "").trim();
  let base = src.split(/[\\/]/).filter(Boolean).pop() || "";
  try {
    base = decodeURIComponent(base);
  } catch (_) {}
  return base || `Görsel ${index + 1}`;
}

function buildMessageRowHtml(msg) {
  if (msg.role === "user") {
    return `
            <div data-chat-row-id="${escapeHtml(msg.id)}" data-testid="user-input-step" class="flex flex-col w-full group/user-input-step items-end gap-1 pt-2">
              <div class="flex items-center justify-end gap-1.5 w-full">
                <!-- Action buttons (Copy) -->
                <div class="opacity-0 group-hover/user-input-step:opacity-100 flex items-center gap-1 transition-opacity">
                  <button role="button" aria-label="Kopyala" class="text-muted-foreground hover:text-secondary-foreground p-1 cursor-pointer transition-colors" title="Mesajı Kopyala" data-action="copy-msg" data-msg-id="${escapeHtml(msg.id)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M362.31-260Q332-260 311-281t-21-51.31V-787.69Q290-818 311-839t51.31-21H697.69Q728-860 749-839t21,51.31v455.38Q770-302 749-281t-51.31,21H362.31Zm0-60H697.69q4.62,0 8.46-3.85t3.85-8.46V-787.69q0-4.62-3.85-8.46T697.69-800H362.31q-4.62,0-8.46,3.85T350-787.69v455.38q0,4.62 3.85,8.46t8.46,3.85Zm-140,200Q192-120 171-141t-21-51.31V-677.69q0-12.77 8.62-21.38T180-707.69t21.38,8.62T210-677.69v485.38q0,4.62 3.85,8.46t8.46,3.85H587.69q12.77,0 21.38,8.62T617.69-150t-8.62,21.38T587.69-120H222.31ZM350-320q0,0 0-3.85t0-8.46V-787.69q0-4.62 0-8.46t0-3.85q0,0 0,3.85t0,8.46v455.38q0,4.62 0,8.46t0,3.85Z"/>
                    </svg>
                  </button>
                </div>

                <!-- User Message Bubble (Double border Lux design) -->
                <div class="flex flex-col items-end gap-1 min-w-0 max-w-[85%]">
                  <div class="agy-user-bubble-frame relative p-px rounded-xl bg-card-border min-w-0 max-w-full">
                    <div data-testid="user-message-bubble" class="agy-user-bubble relative flex flex-col gap-2 p-2.5 rounded-[calc(theme(borderRadius.xl)-1px)] bg-card overflow-hidden">
                      <div data-testid="user-message-content" class="relative p-0.5 overflow-hidden">
                        <div class="whitespace-pre-wrap text-sm leading-relaxed text-foreground select-text" style="word-break: break-word;">${escapeHtml(msg.content)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
  } else {
    return `
            <div data-chat-row-id="${escapeHtml(msg.id)}" class="flex flex-col gap-2 w-full group/assistant-turn" data-turn-msg-id="${escapeHtml(msg.id)}" data-msg-id="${escapeHtml(msg.id)}">
              <!-- Tool Step / Reasoning Pill -->
              <div class="lux-msg-step-wrap flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground select-none py-0.5 ${msg.stepLabel ? "" : "hidden"}">
                ${
                  msg.stepLabel
                    ? msg.isStreaming
                      ? `
                  <svg class="animate-spin text-primary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <span class="text-primary font-medium">${escapeHtml(msg.stepLabel)}</span>
                `
                      : `
                  <span>${escapeHtml(msg.stepLabel)}</span>
                  <span class="text-muted-foreground">›</span>
                `
                    : ""
                }
              </div>

              <!-- Collapsible Agent Tool Execution Cards -->
              ${
                Array.isArray(msg.toolSteps) && msg.toolSteps.length > 0
                  ? `
                <div class="flex flex-col gap-1.5 my-1">
                  ${msg.toolSteps
                    .map((step) => {
                      const badgeClass =
                        step.status === "done"
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                          : step.status === "denied" || step.status === "error"
                            ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                            : "text-amber-400 border-amber-500/30 bg-amber-500/10";
                      const statusLabel =
                        step.status === "done"
                          ? "Tamamlandı"
                          : step.status === "denied"
                            ? "İzin Reddedildi"
                            : step.status === "error"
                              ? "Hata"
                              : "Çalışıyor...";
                      return `
                      <div class="lux-tool-step-card rounded-lg border border-border/70 bg-card/40 overflow-hidden text-xs">
                        <button type="button" class="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-secondary/50 cursor-pointer transition-colors text-left" data-action="toggle-tool-step" data-msg-id="${escapeHtml(msg.id)}" data-step-id="${escapeHtml(step.id)}">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-primary border border-border/50 shrink-0">${escapeHtml(step.name)}</span>
                            <span class="text-secondary-foreground truncate font-mono text-[11px]">${escapeHtml(step.summary || "")}</span>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}">${statusLabel}</span>
                            <svg class="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </button>
                        <div id="tool-detail-${escapeHtml(step.id)}" class="${step.expanded ? "" : "hidden"} px-2.5 py-2 border-t border-border/40 bg-[#050508] font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar select-text">${escapeHtml(step.detail || "")}</div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              `
                  : ""
              }

              <!-- Comparison Table (if present in historical turns) -->
              ${
                msg.tableData
                  ? `
                <div class="my-2 rounded-lg overflow-x-auto border border-border">
                  <table class="md-table-el min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th>Özellik</th>
                        <th>❌ Önceki</th>
                        <th>✅ Güncellenen</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${msg.tableData
                        .map(
                          (row) => `
                        <tr>
                          <td><strong>${escapeHtml(row.feature)}</strong></td>
                          <td>${escapeHtml(row.oldCode)}</td>
                          <td>${escapeHtml(row.newCode)}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `
                  : ""
              }

              <!-- Assistant Markdown Text Content -->
              <div class="lux-msg-markdown text-sm text-foreground leading-relaxed select-text font-sans prose prose-invert max-w-none" aria-live="polite" aria-atomic="false" aria-busy="${msg.isStreaming ? "true" : "false"}">
                ${renderMarkdown(msg.content)}
                ${msg.isStreaming ? '<span class="streaming-cursor"></span>' : ""}
              </div>

              <!-- Rich Verified Visual Media (compact chips — referans tasarımla aynı boyut) -->
              ${
                Array.isArray(msg.media) && msg.media.length > 0
                  ? `
                <div class="lux-media-chips my-2" data-testid="assistant-media-grid">
                  ${msg.media
                    .map((m, i) => {
                      const mediaKey = (m.fileUrl || m.url || m.localPath || "").toLowerCase();
                      const mediaName = mediaItemName(m, i);
                      const thumb = m.fileUrl || m.url || m.localPath || "";
                      return `
                    <span class="lux-media-chip" data-testid="media-chip">
                      <button type="button" class="lux-media-chip-thumb" data-action="lightbox-img" data-img-src="${escapeHtml(thumb)}" title="Tam boy önizle">
                        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(mediaName)}" loading="lazy" />
                      </button>
                      <span class="lux-media-chip-body">
                        <span class="lux-media-chip-title" title="${escapeHtml(mediaName)}">${escapeHtml(mediaName)}</span>
                        <span class="lux-media-chip-meta">${escapeHtml(m.engine || m.format || "Görsel")}</span>
                      </span>
                      ${
                        m.localPath
                          ? `<button type="button" class="lux-artifact-pill" data-action="open-path" data-path="${escapeHtml(m.localPath)}" title="Dosyayı / Klasörü Aç">Aç</button>`
                          : ""
                      }
                      <button type="button" class="lux-media-chip-remove" data-action="remove-media" data-msg-id="${escapeHtml(msg.id)}" data-media-key="${escapeHtml(mediaKey)}" aria-label="Sohbetten kaldır" title="Sohbetten kaldır">✕</button>
                    </span>
                  `;
                    })
                    .join("")}
                </div>
              `
                  : ""
              }

              <!-- Interactive Lullaby / Music-Box Card -->
              ${
                msg.lullaby
                  ? `
                <div class="lux-lullaby-card my-2" data-testid="lullaby-player-card">
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-semibold text-indigo-200 truncate">🌙 ${escapeHtml(msg.lullaby.title || "Yumuşak Uyku Ninnisi")}</span>
                    <span class="text-[11px] text-indigo-200/70 truncate">Müzik kutusu melodisi ve yumuşak sesli eşlik hazır</span>
                  </div>
                  <button type="button" class="lux-lullaby-btn shrink-0 ${window.isLullabyPlaying?.() ? "is-playing" : ""}" data-action="toggle-lullaby" data-msg-id="${escapeHtml(msg.id)}">
                    <span>🎵</span>
                    <span data-lullaby-label>${window.isLullabyPlaying?.() ? "Ninniyi Durdur" : "Ninniyi Sesli Dinle"}</span>
                  </button>
                </div>
              `
                  : ""
              }

              <!-- Created Files & Web Preview Action Bar -->
              ${
                Array.isArray(msg.createdFiles) && msg.createdFiles.length > 0
                  ? `
                <div class="lux-artifact-bar my-1" data-testid="created-files-bar">
                  ${msg.createdFiles
                    .slice(0, 6)
                    .map((fp) => {
                      const fileName = String(fp).split(/[/\\]/).pop() || fp;
                      const isHtml = /\.(html|htm)$/i.test(fileName);
                      return `
                      ${
                        isHtml
                          ? `
                        <button type="button" class="lux-artifact-pill" data-action="preview-html" data-path="${escapeHtml(fp)}" title="Lux AI Dahili Tarayıcıda Önizle">
                          <span>🌐 Önizle: ${escapeHtml(fileName)}</span>
                        </button>
                        <button type="button" class="lux-artifact-pill" data-action="open-external-url" data-path="${escapeHtml(fp)}" title="Varsayılan Tarayıcıda Aç">
                          <span>↗ Tarayıcıda Aç</span>
                        </button>
                      `
                          : ""
                      }
                      <button type="button" class="lux-artifact-pill" data-action="open-editor-file" data-path="${escapeHtml(fp)}" title="IDE Editörde Aç">
                        <span>📝 ${escapeHtml(fileName)}</span>
                      </button>
                    `;
                    })
                    .join("")}
                  <button type="button" class="lux-artifact-pill" data-action="open-parent-folder" data-path="${escapeHtml(msg.createdFiles[0])}" title="Klasörü Aç">
                    <span>📁 Klasörü Aç</span>
                  </button>
                </div>
              `
                  : ""
              }

              <!-- Assistant Bottom Action Bar (Copy message & Listen) -->
              ${
                !msg.isStreaming
                  ? `
                <div class="opacity-0 group-hover/assistant-turn:opacity-100 flex items-center gap-2 pt-1 transition-opacity select-none">
                  <button role="button" aria-label="Yanıtı Kopyala" class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-1 rounded hover:bg-secondary cursor-pointer transition-colors" title="Yanıtı Kopyala" data-action="copy-msg" data-msg-id="${escapeHtml(msg.id)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M362.31-260Q332-260 311-281t-21-51.31V-787.69Q290-818 311-839t51.31-21H697.69Q728-860 749-839t21,51.31v455.38Q770-302 749-281t-51.31,21H362.31Zm0-60H697.69q4.62,0 8.46-3.85t3.85-8.46V-787.69q0-4.62-3.85-8.46T697.69-800H362.31q-4.62,0-8.46,3.85T350-787.69v455.38q0,4.62 3.85,8.46t8.46,3.85Zm-140,200Q192-120 171-141t-21-51.31V-677.69q0-12.77 8.62-21.38T180-707.69t21.38,8.62T210-677.69v485.38q0,4.62 3.85,8.46t8.46,3.85H587.69q12.77,0 21.38,8.62T617.69-150t-8.62,21.38T587.69-120H222.31ZM350-320q0,0 0-3.85t0-8.46V-787.69q0-4.62 0-8.46t0-3.85q0,0 0,3.85t0,8.46v455.38q0,4.62 0,8.46t0,3.85Z"/>
                    </svg>
                    <span>Kopyala</span>
                  </button>
                  <button role="button" aria-label="Sesli Dinle" class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-1 rounded hover:bg-secondary cursor-pointer transition-colors" title="Seslendir" data-action="speak-msg" data-msg-id="${escapeHtml(msg.id)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                    <span>Seslendir</span>
                  </button>
                  ${
                    msg.modelName
                      ? `
                    <span class="text-[10px] text-muted-foreground/60 border border-border/40 px-1.5 py-0.5 rounded font-mono">
                      ${escapeHtml(msg.modelName)}
                    </span>
                  `
                      : ""
                  }
                </div>
              `
                  : ""
              }
            </div>
          `;
  }
}

// Uzun konuşmalarda tek seferde render edilen mesaj sayısı (öncesi "Önceki mesajları yükle" ile açılır)
const CHAT_RENDER_WINDOW = 40;

function expandLuxRenderWindow() {
  const st = window.__luxRenderWindow;
  if (!st) return;
  st.limit += CHAT_RENDER_WINDOW;
  renderChat();
}
window.expandLuxRenderWindow = expandLuxRenderWindow;

function renderChat() {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  const conv = window.appStore.getActiveConversation();
  if (!conv || conv.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-6 text-center select-none max-w-2xl mx-auto my-auto">
        <div class="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-4 shadow-sm border border-border/50">
          <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
            <path d="M26 32C26 24.27 32.27 18 40 18H68C75.73 18 82 24.27 82 32V92C82 99.73 88.27 106 96 106H140C147.73 106 154 112.27 154 120V148C154 155.73 147.73 162 140 162H40C32.27 162 26 155.73 26 148V32Z" fill="currentColor"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-foreground mb-1.5">Bugün ne kurcalıyoruz?</h2>
        <p class="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          Lux Sınırsız Yetki aktif: internette araştır, görsel bul veya tasarla, masaüstünde proje kur, bilgisayarını yönet ya da sesli sohbet et.
        </p>

        <!-- Quick Prompt Chips -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" data-action="quickPrompt" data-arg="Gaziantep'te bugün hava durumu nedir? İnternetten kontrol et.">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🌐 Canlı İnternet & Hava Durumu</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Gerçek zamanlı web araştırması ve hava durumu raporu</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" data-action="quickPrompt" data-arg="Bana Porsche 911 araba resmi bul getir ve neon tarzda bir logo tasarla">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🎨 Görsel Bul & Tasarla</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Web\'den fotoğraf getir veya yapay zeka ile sıfırdan çiz</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" data-action="quickPrompt" data-arg="Masaüstünde web projesi klasörü oluşturup modern bir açılış sayfası tasarla">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🚀 Masaüstünde Web & Kod Kur</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Otonom dosya üretimi, tarayıcı önizleme ve PC entegrasyonu</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" data-action="quickPrompt" data-arg="Tüm projelerimi ve çalışma alanı dosyalarını listele">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🤖 Projeler & Dosya Analizi</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Çalışma alanı ve Masaüstü projelerini tam tara</span>
          </button>
        </div>
      </div>
    `;
    window.__luxChatConvKey = null;
    if (window.__luxRenderWindow) window.__luxRenderWindow.convKey = null;
    if (window.__luxChatRenderCache) window.__luxChatRenderCache.clear();
    return;
  }

  // Parçalı (incremental) render: değişmeyen mesaj satırlarına hiç dokunma.
  const convKey = conv.id || "__anon__";
  if (!window.__luxRenderWindow || window.__luxRenderWindow.convKey !== convKey) {
    window.__luxRenderWindow = { convKey, limit: CHAT_RENDER_WINDOW, prevHidden: 0 };
  }
  const winState = window.__luxRenderWindow;
  const hiddenCount = Math.max(0, conv.messages.length - winState.limit);
  const rows = hiddenCount > 0 ? conv.messages.slice(hiddenCount) : conv.messages;
  const windowChanged = winState.prevHidden !== hiddenCount;
  const needFull = windowChanged || convKey !== window.__luxChatConvKey || !container.querySelector("#chat-feed");

  if (needFull) {
    const loadEarlierHtml =
      hiddenCount > 0
        ? `<div class="flex justify-center"><button id="lux-load-earlier-btn" type="button" class="px-3 py-1.5 rounded-full border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer transition-colors">⬆ Önceki ${hiddenCount} mesajı yükle</button></div>`
        : "";
    container.innerHTML = `<div id="chat-feed" class="flex flex-col gap-6 py-4 max-w-3xl mx-auto w-full">${loadEarlierHtml}${rows.map(buildMessageRowHtml).join("")}</div>`;
    const earlierBtn = container.querySelector("#lux-load-earlier-btn");
    if (earlierBtn) earlierBtn.addEventListener("click", expandLuxRenderWindow);
    window.__luxChatConvKey = convKey;
    window.__luxChatRenderCache = new Map(rows.map((m) => [m.id, chatMessageSignature(m)]));
    winState.prevHidden = hiddenCount;
  } else {
    const feed = container.querySelector("#chat-feed");
    const existing = new Map();
    feed.querySelectorAll("[data-chat-row-id]").forEach((el) => existing.set(el.getAttribute("data-chat-row-id"), el));

    // Artık var olmayan satırları kaldır
    const wanted = new Set(rows.map((m) => m.id));
    existing.forEach((el, id) => {
      if (!wanted.has(id)) el.remove();
    });

    const prevCache = window.__luxChatRenderCache || new Map();
    const newCache = new Map();
    for (const msg of rows) {
      const sig = chatMessageSignature(msg);
      const prevSig = prevCache.get(msg.id);
      const cur = existing.get(msg.id);
      if (cur && prevSig === sig) {
        feed.appendChild(cur); // sırayı koru (node'lar yerinde taşınır)
        newCache.set(msg.id, sig);
        continue;
      }
      const tpl = document.createElement("div");
      tpl.innerHTML = buildMessageRowHtml(msg).trim();
      const node = tpl.firstElementChild;
      if (!node) {
        newCache.set(msg.id, sig);
        continue;
      }
      if (cur && cur.parentNode === feed) {
        feed.replaceChild(node, cur);
      } else {
        feed.appendChild(node);
      }
      newCache.set(msg.id, sig);
    }
    window.__luxChatRenderCache = newCache;
    winState.prevHidden = hiddenCount;
  }

  // Cancel pending incremental delta render since full renderChat ran now
  if (window.__luxStreamRenderRaf) {
    cancelAnimationFrame(window.__luxStreamRenderRaf);
    window.__luxStreamRenderRaf = 0;
  }
  window.__luxStreamRenderPendingMsg = null;
  window.__luxLastDeltaRenderAt = performance.now();

  // Update scroll listener
  container.removeEventListener("scroll", updateScrollButtonVisibility);
  container.addEventListener("scroll", updateScrollButtonVisibility);
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    updateScrollButtonVisibility();
  });
}

function findAssistantTurnElement(container, msgId) {
  if (!container || !msgId) return null;
  const turns = container.querySelectorAll("[data-turn-msg-id]");
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].getAttribute("data-turn-msg-id") === msgId) return turns[i];
  }
  return null;
}

function renderStreamingDelta(assistantMsg) {
  if (!assistantMsg || !assistantMsg.id) return false;
  const container = document.getElementById("chat-messages-container");
  if (!container) return false;

  const turnEl = findAssistantTurnElement(container, assistantMsg.id);
  if (!turnEl) {
    renderChat();
    return false;
  }

  const mdEl = turnEl.querySelector(".lux-msg-markdown");
  if (!mdEl) {
    renderChat();
    return false;
  }
  mdEl.setAttribute("aria-busy", assistantMsg.isStreaming ? "true" : "false");

  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 140;
  mdEl.innerHTML = `${renderMarkdown(assistantMsg.content || "")}${assistantMsg.isStreaming ? '<span class="streaming-cursor"></span>' : ""}`;

  const stepEl = turnEl.querySelector(".lux-msg-step-wrap");
  if (stepEl) {
    if (assistantMsg.stepLabel) {
      stepEl.classList.remove("hidden");
      stepEl.innerHTML = assistantMsg.isStreaming
        ? `<svg class="animate-spin text-primary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg><span class="text-primary font-medium">${escapeHtml(assistantMsg.stepLabel)}</span>`
        : `<span>${escapeHtml(assistantMsg.stepLabel)}</span><span class="text-muted-foreground">›</span>`;
    } else {
      stepEl.classList.add("hidden");
    }
  }

  if (isNearBottom) {
    container.scrollTop = container.scrollHeight;
  }
  updateScrollButtonVisibility();
  window.__luxLastDeltaRenderAt = performance.now();
  return true;
}

function scheduleStreamingRender(assistantMsg) {
  if (!assistantMsg) return;
  window.__luxStreamRenderPendingMsg = assistantMsg;
  if (window.__luxStreamRenderRaf) return;

  const tick = () => {
    window.__luxStreamRenderRaf = 0;
    const target = window.__luxStreamRenderPendingMsg;
    if (!target) return;
    const elapsed = performance.now() - (window.__luxLastDeltaRenderAt || 0);
    if (elapsed < 32 && target.isStreaming) {
      window.__luxStreamRenderRaf = requestAnimationFrame(tick);
      return;
    }
    window.__luxStreamRenderPendingMsg = null;
    renderStreamingDelta(target);
  };
  window.__luxStreamRenderRaf = requestAnimationFrame(tick);
}
window.renderStreamingDelta = renderStreamingDelta;
window.scheduleStreamingRender = scheduleStreamingRender;

function updateScrollButtonVisibility() {
  const container = document.getElementById("chat-messages-container");
  const scrollBtn = document.getElementById("btn-scroll-bottom");
  if (!container || !scrollBtn) return;

  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  scrollBtn.style.display = isNearBottom ? "none" : "flex";
}

window.scrollToBottom = function () {
  const container = document.getElementById("chat-messages-container");
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
};

window.quickPrompt = function (text) {
  const textarea = document.getElementById("composer-textarea");
  if (textarea) {
    textarea.value = text;
    submitUserMessage(text);
  }
};

window.copyToClipboard = function (text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.activeElement;
    if (btn && btn.tagName === "BUTTON") {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span>✓ Kopyalandı</span>`;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1400);
    }
  });
};

// Delegated click handler for message actions and collapsible tool step cards
document.addEventListener("click", (e) => {
  const copyBtn = e.target.closest("[data-action='copy-msg']");
  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const msgId = copyBtn.getAttribute("data-msg-id");
    const conv = window.appStore?.getActiveConversation?.();
    const msg = conv?.messages?.find((m) => m.id === msgId);
    if (msg?.content) {
      window.copyToClipboard(msg.content);
    }
    return;
  }

  const speakBtn = e.target.closest("[data-action='speak-msg']");
  if (speakBtn) {
    e.preventDefault();
    e.stopPropagation();
    const msgId = speakBtn.getAttribute("data-msg-id");
    const conv = window.appStore?.getActiveConversation?.();
    const msg = conv?.messages?.find((m) => m.id === msgId);
    if (msg?.content) {
      window.speakTextMessage(msg.content);
    }
    return;
  }

  const stepBtn = e.target.closest("[data-action='toggle-tool-step']");
  if (stepBtn) {
    e.preventDefault();
    e.stopPropagation();
    const stepId = stepBtn.getAttribute("data-step-id");
    const msgId = stepBtn.getAttribute("data-msg-id");
    const conv = window.appStore?.getActiveConversation?.();
    const msg = conv?.messages?.find((m) => m.id === msgId);
    const step = msg?.toolSteps?.find((s) => s.id === stepId);
    if (step) {
      step.expanded = !step.expanded;
    }
    const detailEl = document.getElementById(`tool-detail-${stepId}`);
    if (detailEl) {
      detailEl.classList.toggle("hidden");
    }
    return;
  }

  const lightboxTarget = e.target.closest("[data-action='lightbox-img'], .prose img");
  if (lightboxTarget) {
    const src = lightboxTarget.getAttribute("data-img-src") || lightboxTarget.getAttribute("src");
    if (src) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById("lux-lightbox-overlay")?.remove();
      const ov = document.createElement("div");
      ov.id = "lux-lightbox-overlay";
      ov.className = "lux-lightbox-overlay";
      ov.innerHTML = `<img src="${escapeHtml(src)}" alt="Önizleme" />`;
      ov.addEventListener("click", () => ov.remove());
      document.body.appendChild(ov);
    }
    return;
  }

  const lullabyBtn = e.target.closest("[data-action='toggle-lullaby']");
  if (lullabyBtn) {
    e.preventDefault();
    e.stopPropagation();
    if (window.isLullabyPlaying?.()) {
      window.stopLullabyAudio?.();
    } else {
      const msgId = lullabyBtn.getAttribute("data-msg-id");
      const conv = window.appStore?.getActiveConversation?.();
      const msg = conv?.messages?.find((m) => m.id === msgId);
      const lyrics = msg?.lullaby?.lyrics || msg?.content || "";
      window.playLullabyExperience?.(lyrics);
    }
    return;
  }

  const openPathBtn = e.target.closest("[data-action='open-path']");
  if (openPathBtn) {
    e.preventDefault();
    e.stopPropagation();
    const p = openPathBtn.getAttribute("data-path");
    if (p) window.luxAPI?.openDirectory?.(p);
    return;
  }

  const removeMediaBtn = e.target.closest("[data-action='remove-media']");
  if (removeMediaBtn) {
    e.preventDefault();
    e.stopPropagation();
    const msgId = removeMediaBtn.getAttribute("data-msg-id");
    const key = (removeMediaBtn.getAttribute("data-media-key") || "").toLowerCase();
    const conv = window.appStore?.getActiveConversation?.();
    const msg = conv?.messages?.find((m) => m.id === msgId);
    if (msg && Array.isArray(msg.media)) {
      msg.media = msg.media.filter((m) => (m.fileUrl || m.url || m.localPath || "").toLowerCase() !== key);
      if (msg.media.length === 0) delete msg.media;
      window.appStore?.saveState?.();
      if (typeof renderChat === "function") renderChat();
    }
    return;
  }

  const openParentBtn = e.target.closest("[data-action='open-parent-folder']");
  if (openParentBtn) {
    e.preventDefault();
    e.stopPropagation();
    const p = openParentBtn.getAttribute("data-path");
    if (p) {
      const dir = p.replace(/[\\/][^\\/]+$/, "");
      window.luxAPI?.openDirectory?.(dir || p);
    }
    return;
  }

  const previewHtmlBtn = e.target.closest("[data-action='preview-html']");
  if (previewHtmlBtn) {
    e.preventDefault();
    e.stopPropagation();
    const p = previewHtmlBtn.getAttribute("data-path");
    if (p) window.openAuxBrowserUrl?.(p);
    return;
  }

  const openExtBtn = e.target.closest("[data-action='open-external-url']");
  if (openExtBtn) {
    e.preventDefault();
    e.stopPropagation();
    const p = openExtBtn.getAttribute("data-path");
    if (p) window.luxAPI?.openDirectory?.(p);
    return;
  }

  const openEditorBtn = e.target.closest("[data-action='open-editor-file']");
  if (openEditorBtn) {
    e.preventDefault();
    e.stopPropagation();
    const p = openEditorBtn.getAttribute("data-path");
    if (p) window.loadEditorFile?.(p);
    return;
  }

  const proseLink = e.target.closest(".prose a[href]");
  if (proseLink) {
    const href = proseLink.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      window.luxAPI?.agent?.pcControl?.({ action: "open_url", target: href });
    } else if (/^file:\/\//i.test(href) || /^[a-zA-Z]:[\\/]/.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      window.luxAPI?.openDirectory?.(href);
    }
    return;
  }
});

// -----------------------------------------------------------------------------
// Agentic Tools Schema (Lux Sınırsız Yetki) & Permission-Gated Executor
// -----------------------------------------------------------------------------

window.luxDesktopProjectsCache = window.luxDesktopProjectsCache || [];
window.__luxProjectsCacheAt = window.__luxProjectsCacheAt || 0;
window.__luxProjectsCachePromise = window.__luxProjectsCachePromise || null;

function refreshDesktopProjectsCache(force = false) {
  if (!window.luxAPI?.fs?.listDesktopProjects) return Promise.resolve(window.luxDesktopProjectsCache);
  const now = Date.now();
  if (!force && window.luxDesktopProjectsCache.length > 0 && now - window.__luxProjectsCacheAt < 5000) {
    return Promise.resolve(window.luxDesktopProjectsCache);
  }
  if (window.__luxProjectsCachePromise) {
    return window.__luxProjectsCachePromise;
  }
  const wsDir = (window.appStore?.state?.application?.workspaceDir || "").trim() || undefined;
  const p = (async () => {
    try {
      const res = await window.luxAPI.fs.listDesktopProjects(wsDir);
      if (res?.success && Array.isArray(res.projects)) {
        window.luxDesktopProjectsCache = res.projects;
        window.__luxProjectsCacheAt = Date.now();
        if (res.desktopPath && window.luxAppInfo) {
          window.luxAppInfo.desktopPath = res.desktopPath;
        }
      }
    } catch (_) {}
    return window.luxDesktopProjectsCache;
  })().finally(() => {
    if (window.__luxProjectsCachePromise === p) {
      window.__luxProjectsCachePromise = null;
    }
  });
  window.__luxProjectsCachePromise = p;
  return p;
}
window.refreshDesktopProjectsCache = refreshDesktopProjectsCache;

function isSensitivePath(filePath) {
  const norm = (filePath || "").replace(/\\/g, "/").toLowerCase();
  return /(^|\/)\.env($|\.)|id_rsa|\.pem$|\.key$|credentials|secrets?\.json$/i.test(norm);
}

function analyzeWorkspaceTree(nodes, prefix = "", stats = null) {
  const out = stats || { totalFiles: 0, totalDirs: 0, rootFiles: [], topFolders: [], allFiles: [] };
  if (!Array.isArray(nodes)) return out;

  for (const node of nodes) {
    const relPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.isDirectory) {
      out.totalDirs++;
      if (!prefix) {
        const sub = analyzeWorkspaceTree(node.children || [], relPath, {
          totalFiles: 0,
          totalDirs: 0,
          rootFiles: [],
          topFolders: [],
          allFiles: []
        });
        out.totalFiles += sub.totalFiles;
        out.totalDirs += sub.totalDirs;
        out.allFiles.push(...sub.allFiles);
        out.topFolders.push({
          name: node.name,
          fileCount: sub.totalFiles,
          dirCount: sub.totalDirs,
          files: sub.allFiles
        });
      } else {
        analyzeWorkspaceTree(node.children || [], relPath, out);
      }
    } else {
      out.totalFiles++;
      out.allFiles.push(relPath);
      if (!prefix) out.rootFiles.push(node.name);
    }
  }
  return out;
}

function summarizeTreeText(nodes, prefix = "", lines = []) {
  if (!Array.isArray(nodes) || lines.length >= 220) return lines;
  for (const node of nodes) {
    if (lines.length >= 220) break;
    const label = prefix ? `${prefix}/${node.name}` : node.name;
    lines.push(node.isDirectory ? `${label}/` : label);
    if (node.isDirectory && Array.isArray(node.children)) {
      summarizeTreeText(node.children, label, lines);
    }
  }
  return lines;
}

function formatWorkspaceInventory(nodes, resolvedLabel = "Çalışma Alanı Kök Dizini") {
  const stats = analyzeWorkspaceTree(nodes);
  const wsDir = window.appStore?.state?.application?.workspaceDir || "Aktif çalışma klasörü";

  const lines = [];
  lines.push(`Aktif Çalışma Klasörü: ${wsDir}`);
  if (resolvedLabel) lines.push(`Taranan Konum: ${resolvedLabel}`);
  lines.push(`GENEL TOPLAM: ${stats.totalFiles} dosya, ${stats.totalDirs} klasör (node_modules ve __pycache__ hariç)`);

  if (stats.topFolders.length > 0) {
    lines.push("");
    lines.push("Klasör Dağılımı:");
    for (const f of stats.topFolders) {
      const codeFiles = f.files.filter((p) => /\.(js|mjs|cjs|ts|py|html|css|json|md|bat|ps1)$/i.test(p));
      const shown = f.files.length <= 10 ? f.files : codeFiles.length > 0 ? codeFiles.slice(0, 8) : f.files.slice(0, 6);
      const rest = f.files.length - shown.length;
      lines.push(`- ${f.name}/: ${f.fileCount} dosya, ${f.dirCount} alt klasör`);
      if (shown.length > 0) {
        lines.push(`  Dosyalar: ${shown.join(", ")}${rest > 0 ? `, ... (+${rest} diğer dosya)` : ""}`);
      }
    }
  }

  if (stats.rootFiles.length > 0) {
    lines.push("");
    const nonMediaRoot = stats.rootFiles.filter((n) => !/\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n));
    const mediaRootCount = stats.rootFiles.length - nonMediaRoot.length;
    lines.push(`Kök Dizindeki Dosyalar (${stats.rootFiles.length} adet):`);
    if (stats.rootFiles.length <= 15) {
      lines.push(`- ${stats.rootFiles.join(", ")}`);
    } else {
      if (nonMediaRoot.length > 0) {
        const priorityRank = (name) => {
          const n = name.toLowerCase();
          if (n === "package.json" || n === "main.js" || n === "readme.md" || n === "preload.js") return 0;
          if (/^(Lux_|dialog_full|extracted_|live_settings|overview_icons)/.test(n)) return 3;
          if (/\.(js|py|ts|json|md|bat|ps1)$/i.test(n)) return 1;
          return 2;
        };
        const prioritizedRoot = nonMediaRoot.slice().sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b));
        const shownRoot = prioritizedRoot.length <= 14 ? prioritizedRoot : prioritizedRoot.slice(0, 12);
        const restRoot = prioritizedRoot.length - shownRoot.length;
        lines.push(
          `- Kod/Yapılandırma (${nonMediaRoot.length}): ${shownRoot.join(", ")}${restRoot > 0 ? `, ... (+${restRoot} dosya)` : ""}`
        );
      }
      if (mediaRootCount > 0) {
        const sampleMedia = stats.rootFiles.filter((n) => /\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n)).slice(0, 4);
        lines.push(
          `- Görsel/Ses (${mediaRootCount} adet): ${sampleMedia.join(", ")}${mediaRootCount > sampleMedia.length ? `, ... (+${mediaRootCount - sampleMedia.length} ek)` : ""}`
        );
      }
    }
  }

  return {
    stats,
    text: lines.join("\n"),
    shortSummary: `${resolvedLabel} (${stats.totalFiles} dosya, ${stats.totalDirs} klasör)`
  };
}

function resolveProjectOrWorkspaceDir(rawDirArg) {
  const clean = String(rawDirArg || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\\/]+$/, "");
  const configuredWs = (window.appStore?.state?.application?.workspaceDir || "").trim();
  const lower = clean.toLowerCase();

  const rootAliases = new Set([
    "",
    ".",
    "./",
    "root",
    "kök",
    "kök dizin",
    "workspace",
    "çalışma alanı",
    "calisma alani",
    "proje",
    "projeler",
    "projelerim",
    "tüm projeler",
    "tum projeler",
    "tümü",
    "tumu",
    "dosyalar",
    "aktif proje",
    "bu proje",
    "mevcut proje"
  ]);
  if (rootAliases.has(lower)) {
    return { target: configuredWs || undefined, isRootAlias: true, label: "Çalışma Alanı Kök Dizini" };
  }

  // Match real cached Desktop projects first if name matches
  const desktopMatch = (window.luxDesktopProjectsCache || []).find((p) => (p.name || "").trim().toLowerCase() === lower);
  if (desktopMatch && desktopMatch.path) {
    return { target: desktopMatch.path, isRootAlias: false, label: desktopMatch.name };
  }

  const projects = window.appStore?.state?.projects || [];
  const matchedProj = projects.find((p) => (p.name || "").trim().toLowerCase() === lower || (p.id || "").trim().toLowerCase() === lower);
  if (matchedProj) {
    if (matchedProj.path && matchedProj.path.trim()) {
      return { target: matchedProj.path.trim(), isRootAlias: false, label: matchedProj.name };
    }
    return { target: configuredWs || undefined, isRootAlias: true, label: `${matchedProj.name} (Çalışma Alanı)` };
  }

  return { target: clean, isRootAlias: false, label: clean };
}

function addMediaToTurnContext(turnContext, mediaItem) {
  if (!turnContext || !mediaItem) return;
  if (!Array.isArray(turnContext.media)) turnContext.media = [];
  const key = (mediaItem.fileUrl || mediaItem.localPath || mediaItem.url || "").toLowerCase();
  if (!key) return;
  if (!turnContext.media.some((m) => (m.fileUrl || m.localPath || m.url || "").toLowerCase() === key)) {
    turnContext.media.push(mediaItem);
  }
}

function addCreatedFileToTurnContext(turnContext, filePath) {
  if (!turnContext || !filePath) return;
  if (!Array.isArray(turnContext.createdFiles)) turnContext.createdFiles = [];
  if (!turnContext.createdFiles.includes(filePath)) {
    turnContext.createdFiles.push(filePath);
  }
}

async function executeAgentTool(name, rawArgs, turnContext = null) {
  if (turnContext?.__aborted || (turnContext?.__turnId && turnContext.__turnId !== window.__luxActiveTurnId)) {
    return { status: "error", summary: "İptal edildi", detail: "İşlem durduruldu.", resultText: "İPTAL: İşlem durduruldu." };
  }

  let args = rawArgs || {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch (_) {
      args = {};
    }
  }

  const normalizeToolPath = (p) =>
    String(p || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^@(file|folder|dir|path):/i, "")
      .trim();

  const userPrompt = String(turnContext?.userPrompt || "").toLowerCase();
  const userExplicitlyAskedYouTube = /\b(youtube|youtu\.be|şarkı|sarki|müzik|muzik|video|klip|fragman|izle|dinle)\b/i.test(userPrompt);
  const userExplicitlyAskedWebOpen =
    /(?:site|sitesi|sitesini|link|url|web\s*sayfa|web\s*site|tarayıcı|tarayici|chrome|edge|internet(?:te|ten)?\s*aç|browser|youtube|\.com|\.org|\.net|https?:\/\/)/i.test(
      userPrompt
    );

  const perms = window.appStore?.getPermissions?.() || {};
  const toolName = (name || "").trim();
  if (turnContext) {
    if (!Array.isArray(turnContext.executedTools)) turnContext.executedTools = [];
    turnContext.executedTools.push(toolName);
  }

  const approvalDenial = await requestToolExecutionDecision(toolName, args);
  if (approvalDenial) return approvalDenial;

  if (toolName === "web_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return {
        status: "error",
        summary: "(sorgu eksik)",
        detail: "query gerekli.",
        resultText: "HATA: web_search için query parametresi boş."
      };
    }
    if (perms.web_search === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: query,
        detail: "İzin reddedildi: İnternet arama izni (web_search / network_internet) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: İnternet arama izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.webSearch?.(query, { limit: args.limit || 6 });
    if (res?.success) {
      const blocks = [];
      if (res.weather) {
        const w = res.weather;
        blocks.push(
          `[CANLI HAVA DURUMU — Open-Meteo]\n` +
            `Konum: ${w.city}\n` +
            `Sıcaklık: ${w.temperature}°C (Hissedilen: ${w.apparentTemperature}°C) | Durum: ${w.condition}\n` +
            `Nem: %${w.humidity} | Rüzgar: ${w.windSpeed} km/sa | Gözlem Saati: ${w.observedAt}\n` +
            (Array.isArray(w.forecast) && w.forecast.length > 0
              ? `3 Günlük Tahmin:\n${w.forecast.map((f) => `- ${f}`).join("\n")}\n`
              : "") +
            `Kaynak: ${w.sourceUrl}`
        );
      }
      if (Array.isArray(res.results) && res.results.length > 0) {
        blocks.push(
          `[WEB ARAMA SONUÇLARI]\n` +
            res.results
              .map((r, i) => `${i + 1}. ${r.title} [${r.source}]\n   URL: ${r.url}${r.snippet ? `\n   Özet: ${r.snippet}` : ""}`)
              .join("\n")
        );
      }
      const txt = blocks.join("\n\n") || "Arama sonucu bulunamadı.";
      const sum = res.weather
        ? `${res.weather.city}: ${res.weather.temperature}°C, ${res.weather.condition}`
        : `"${query}" (${res.results?.length || 0} sonuç)`;
      return { status: "done", summary: sum, detail: txt, resultText: txt, data: res };
    }
    const errMsg = res?.error || "Web araması sonuç döndürmedi.";
    return { status: "error", summary: query, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "fetch_url") {
    const url = String(args.url || "").trim();
    if (!url) {
      return { status: "error", summary: "(URL eksik)", detail: "url parametresi gerekli.", resultText: "HATA: url boş." };
    }
    if (perms.web_search === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: url,
        detail: "İnternet erişim izni kapatılmış.",
        resultText: "HATA: web_search/network_internet izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.fetchUrl?.(url);
    if (res?.success) {
      const clipped = String(res.text || "").slice(0, 7500);
      const resultText = `Başlık: ${res.title}\nURL: ${res.url}\n\nİçerik:\n${clipped}`;
      return { status: "done", summary: res.title || url, detail: resultText.slice(0, 1500), resultText };
    }
    return {
      status: "error",
      summary: url,
      detail: res?.error || "Sayfa okunamadı",
      resultText: `HATA: ${res?.error || "Sayfa okunamadı."}`
    };
  }

  if (toolName === "image_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return { status: "error", summary: "(sorgu eksik)", detail: "query gerekli.", resultText: "HATA: Görsel arama sorgusu boş." };
    }
    if (perms.image_generation === false || perms.network_internet === false) {
      return {
        status: "denied",
        summary: query,
        detail: "Görsel veya internet erişim izni kapalı.",
        resultText: "HATA: image_generation/network_internet izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.imageSearch?.(query, {
      count: args.count || 2,
      saveDir: normalizeToolPath(args.saveDir || "")
    });
    if (res?.success && Array.isArray(res.images) && res.images.length > 0) {
      res.images.forEach((img) => {
        addMediaToTurnContext(turnContext, {
          type: "image",
          title: img.title || query,
          localPath: img.localPath,
          fileUrl: img.fileUrl,
          format: img.format,
          engine: "Web Görsel Arama"
        });
      });
      const listTxt = res.images
        .map((im, i) => `${i + 1}. ${im.title || query}\n   Yerel Dosya: ${im.localPath}\n   URL: ${im.fileUrl}`)
        .join("\n");
      return {
        status: "done",
        summary: `"${query}" (${res.images.length} görsel indirildi)`,
        detail: listTxt,
        resultText: `BAŞARILI: ${res.images.length} doğrulanmış görsel yerel diske indirildi ve sohbet galerisine otomatik eklendi:\n${listTxt}\nNot: Yanıtta görseli kullanıcıya sun; sahte harici URL uydurma.`,
        data: res
      };
    }
    return {
      status: "error",
      summary: query,
      detail: res?.error || "Görsel bulunamadı",
      resultText: `HATA: ${res?.error || "Doğrulanmış görsel bulunamadı."}`
    };
  }

  if (toolName === "image_generate") {
    const prompt = String(args.prompt || args.description || args.title || "").trim();
    if (!prompt) {
      return { status: "error", summary: "(tarif eksik)", detail: "prompt gerekli.", resultText: "HATA: Görsel tasarımı için prompt boş." };
    }
    if (perms.image_generation === false) {
      return {
        status: "denied",
        summary: prompt,
        detail: "Görsel üretme izni (image_generation) kapatılmış.",
        resultText: "HATA: image_generation izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.imageGenerate?.({
      prompt,
      title: args.title || prompt,
      style: args.style || "",
      width: args.width || 1024,
      height: args.height || 768,
      outputPath: normalizeToolPath(args.outputPath || ""),
      htmlOrSvg: args.htmlOrSvg || ""
    });
    if (res?.success && res.fileUrl) {
      addMediaToTurnContext(turnContext, {
        type: "image",
        title: args.title || prompt,
        localPath: res.localPath,
        fileUrl: res.fileUrl,
        format: res.format || "png",
        engine: res.engine || "lux-ai-studio"
      });
      if (args.outputPath && res.localPath) {
        addCreatedFileToTurnContext(turnContext, res.localPath);
      }
      return {
        status: "done",
        summary: `${args.title || prompt.slice(0, 40)} (${res.engine})`,
        detail: `Kaydedildi: ${res.localPath} (${Math.round((res.sizeBytes || 0) / 1024)} KB)`,
        resultText: `BAŞARILI: Görsel tasarlandı ve kaydedildi (${res.engine}).\nYerel Dosya: ${res.localPath}\nURL: ${res.fileUrl}\nNot: Görsel sohbet galerisine otomatik eklendi; metinde sahte URL uydurma.`,
        data: res
      };
    }
    return {
      status: "error",
      summary: prompt.slice(0, 40),
      detail: res?.error || "Tasarım oluşturulamadı",
      resultText: `HATA: ${res?.error || "Görsel oluşturulamadı."}`
    };
  }

  if (toolName === "list_projects") {
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: "projeler",
        detail: "Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.listDesktopProjects?.(window.appStore?.state?.application?.workspaceDir);
    if (res?.success && Array.isArray(res.projects)) {
      window.luxDesktopProjectsCache = res.projects;
      const lines = [`Aktif Çalışma Klasörü: ${res.workspaceDir}`, `Masaüstü: ${res.desktopPath} (${res.projects.length} proje/klasör):`];
      for (const p of res.projects) {
        const tag = p.isActiveWorkspace ? "[AKTİF]" : `[${p.source}]`;
        const sample = (p.sampleFiles || []).slice(0, 4).join(", ");
        lines.push(`- ${p.name} ${tag}: ${p.topLevelFileCount} dosya, ${p.topLevelDirCount} klasör${sample ? ` (${sample})` : ""}`);
      }
      const txt = lines.join("\n");
      return { status: "done", summary: `${res.projects.length} proje klasörü bulundu`, detail: txt, resultText: txt, data: res };
    }
    return {
      status: "error",
      summary: "projeler",
      detail: res?.error || "Projeler listelenemedi",
      resultText: `HATA: ${res?.error || "Projeler listelenemedi."}`
    };
  }

  if (toolName === "list_files") {
    const dirArg = normalizeToolPath(args.dirPath || args.path || "");
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: dirArg || ".",
        detail: "İzin reddedildi: Dosya okuma izni (file_read) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için dosyalar listelenemedi."
      };
    }
    const resolved = resolveProjectOrWorkspaceDir(dirArg);
    let res = await window.luxAPI?.fs?.listFiles?.(resolved.target);
    let finalLabel = resolved.label;
    if (!Array.isArray(res) && resolved.target) {
      const rootTarget = (window.appStore?.state?.application?.workspaceDir || "").trim() || undefined;
      const rootRes = await window.luxAPI?.fs?.listFiles?.(rootTarget);
      if (Array.isArray(rootRes)) {
        res = rootRes;
        finalLabel = `Çalışma Alanı Kök Dizini ('${dirArg}' yerine kök tarandı)`;
      }
    }
    if (Array.isArray(res)) {
      const inv = formatWorkspaceInventory(res, finalLabel);
      return {
        status: "done",
        summary: inv.shortSummary,
        detail: inv.text,
        resultText: inv.text
      };
    }
    const errMsg = res?.error || "Dizin listelenemedi.";
    return { status: "error", summary: dirArg || ".", detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "read_file") {
    const filePath = normalizeToolPath(args.filePath || args.path || "");
    if (!filePath) {
      return { status: "error", summary: "(yol eksik)", detail: "filePath gerekli.", resultText: "HATA: filePath parametresi boş." };
    }
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: filePath,
        detail: "İzin reddedildi: Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için dosya okunamadı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      return {
        status: "denied",
        summary: filePath,
        detail: "Güvenlik koruması (env_secrets_protection) nedeniyle .env / anahtar dosyalarına erişim engellendi.",
        resultText: "HATA: env_secrets_protection nedeniyle hassas dosyaya erişim reddedildi."
      };
    }
    const res = await window.luxAPI?.fs?.readFile?.(filePath);
    if (res?.success) {
      const content = res.content || "";
      const clipped = content.length > 8000 ? content.slice(0, 8000) + "\n... [içerik kırpıldı]" : content;
      return {
        status: "done",
        summary: `${res.path || filePath} (${content.length} karakter)`,
        detail: clipped.slice(0, 1200) + (clipped.length > 1200 ? "\n..." : ""),
        resultText: clipped
      };
    }
    const errMsg = res?.error || "Dosya okunamadı.";
    return { status: "error", summary: filePath, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "search_files") {
    const query = args.query || "";
    const dirArg = normalizeToolPath(args.dirPath || "");
    if (!query) {
      return {
        status: "error",
        summary: "(sorgu eksik)",
        detail: "query parametresi gerekli.",
        resultText: "HATA: query parametresi boş."
      };
    }
    if (perms.file_read === false) {
      return {
        status: "denied",
        summary: query,
        detail: "İzin reddedildi: Dosya okuma izni (file_read) kapatılmış.",
        resultText: "HATA: file_read izni kapalı olduğu için arama yapılamadı."
      };
    }
    const res = await window.luxAPI?.fs?.search?.(query, dirArg || undefined);
    if (res?.success) {
      const matches = res.matches || [];
      const text =
        matches.length > 0
          ? matches.map((m) => `${m.relPath || m.filePath || m.file || "?"}:${m.line}: ${m.text}`).join("\n")
          : "Eşleşme bulunamadı.";
      return {
        status: "done",
        summary: `"${query}" (${matches.length} eşleşme)`,
        detail: text,
        resultText: text
      };
    }
    const errMsg = res?.error || "Arama başarısız.";
    return { status: "error", summary: query, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "write_file") {
    const filePath = normalizeToolPath(args.filePath || args.path || "");
    const content = typeof args.content === "string" ? args.content : "";
    if (!filePath) {
      return { status: "error", summary: "(yol eksik)", detail: "filePath gerekli.", resultText: "HATA: filePath parametresi boş." };
    }
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: filePath,
        detail: "İzin reddedildi: Dosya yazma izni (file_write) kapatılmış.",
        resultText: "HATA: file_write izni kapalı olduğu için dosyaya yazılamadı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      return {
        status: "denied",
        summary: filePath,
        detail: "Güvenlik koruması (env_secrets_protection) nedeniyle hassas dosyaya yazılamaz.",
        resultText: "HATA: env_secrets_protection nedeniyle hassas dosyaya yazma reddedildi."
      };
    }
    const res = await window.luxAPI?.fs?.writeFile?.(filePath, content);
    if (res?.success) {
      window.playLuxSound?.("codeActionApplied");
      window.invalidateWorkspaceFilesCache?.();
      window.refreshDiffViews?.();
      addCreatedFileToTurnContext(turnContext, res.path || filePath);
      if (typeof window.activeEditorPath === "function" && res.path && window.activeEditorPath().toLowerCase() === res.path.toLowerCase()) {
        window.loadEditorFile?.(res.path);
      }
      return {
        status: "done",
        summary: `${res.path || filePath} (${content.length} karakter yazıldı)`,
        detail: `Başarıyla kaydedildi: ${res.path || filePath}`,
        resultText: `BAŞARILI: ${res.path || filePath} kaydedildi (${content.length} karakter).`
      };
    }
    const errMsg = res?.error || "Dosya yazılamadı.";
    return { status: "error", summary: filePath, detail: errMsg, resultText: `HATA: ${errMsg}` };
  }

  if (toolName === "mkdir") {
    const dirPath = normalizeToolPath(args.dirPath || args.path || "");
    if (!dirPath) return { status: "error", summary: "(yol eksik)", detail: "dirPath gerekli.", resultText: "HATA: dirPath boş." };
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: dirPath,
        detail: "Dosya yazma izni (file_write) kapalı.",
        resultText: "HATA: file_write izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.mkdir?.(dirPath);
    if (res?.success) {
      refreshDesktopProjectsCache(true);
      return {
        status: "done",
        summary: `Klasör oluşturuldu: ${res.path}`,
        detail: res.path,
        resultText: `BAŞARILI: Klasör hazır: ${res.path}`
      };
    }
    return {
      status: "error",
      summary: dirPath,
      detail: res?.error || "Klasör oluşturulamadı",
      resultText: `HATA: ${res?.error || "Klasör oluşturulamadı."}`
    };
  }

  if (toolName === "move_path") {
    const srcPath = normalizeToolPath(args.srcPath || args.from || "");
    const destPath = normalizeToolPath(args.destPath || args.to || "");
    if (!srcPath || !destPath)
      return { status: "error", summary: "(yol eksik)", detail: "srcPath ve destPath gerekli.", resultText: "HATA: Yol eksik." };
    if (perms.file_write === false) {
      return {
        status: "denied",
        summary: srcPath,
        detail: "Dosya yazma izni (file_write) kapalı.",
        resultText: "HATA: file_write izni kapalı."
      };
    }
    const res = await window.luxAPI?.fs?.movePath?.(srcPath, destPath);
    if (res?.success) {
      return {
        status: "done",
        summary: `${res.from} -> ${res.to}`,
        detail: "Taşıma tamamlandı",
        resultText: `BAŞARILI: ${res.from} -> ${res.to}`
      };
    }
    return { status: "error", summary: srcPath, detail: res?.error || "Taşınamadı", resultText: `HATA: ${res?.error || "Taşınamadı."}` };
  }

  if (toolName === "delete_path") {
    const targetPath = normalizeToolPath(args.targetPath || args.path || "");
    if (!targetPath) return { status: "error", summary: "(yol eksik)", detail: "targetPath gerekli.", resultText: "HATA: targetPath boş." };
    if (perms.file_delete === false) {
      return {
        status: "denied",
        summary: targetPath,
        detail: "Dosya silme izni (file_delete) kapalı.",
        resultText: "HATA: file_delete izni kapalı."
      };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(targetPath)) {
      return {
        status: "denied",
        summary: targetPath,
        detail: "Hassas dosya koruması aktif.",
        resultText: "HATA: Hassas dosya silinemedi."
      };
    }
    const res = await window.luxAPI?.fs?.deletePath?.(targetPath);
    if (res?.success) {
      window.invalidateWorkspaceFilesCache?.();
      return { status: "done", summary: `Silindi: ${res.path}`, detail: res.path, resultText: `BAŞARILI: Silindi -> ${res.path}` };
    }
    return { status: "error", summary: targetPath, detail: res?.error || "Silinemedi", resultText: `HATA: ${res?.error || "Silinemedi."}` };
  }

  if (toolName === "run_command") {
    const command = args.command || args.cmd || "";
    const cwdArg = normalizeToolPath(args.cwd || "");
    if (!command) {
      return {
        status: "error",
        summary: "(komut eksik)",
        detail: "command parametresi gerekli.",
        resultText: "HATA: command parametresi boş."
      };
    }
    if (userPrompt && /(?:youtube\.com|youtu\.be)/i.test(command) && !userExplicitlyAskedYouTube) {
      return {
        status: "denied",
        summary: command,
        detail: "Kullanıcı YouTube açılmasını istemediği için komut engellendi.",
        resultText: "HATA: Kullanıcı YouTube açılmasını istemedi."
      };
    }
    if (perms.terminal_execute === false) {
      return {
        status: "denied",
        summary: command,
        detail: "İzin reddedildi: Terminal çalıştırma izni (terminal_execute) Ayarlar > İzinler bölümünden kapatılmış.",
        resultText: "HATA: terminal_execute izni kapalı olduğu için komut çalıştırılamadı."
      };
    }
    const res = await window.luxAPI?.terminal?.execute?.(command, cwdArg || undefined);
    const output = (res?.output || res?.error || "Tamamlandı.").slice(0, 6000);
    window.luxLastTerminalOutput = `PS > ${command}\n${output}`;
    return {
      status: res?.code && res.code !== 0 ? "error" : "done",
      summary: command,
      detail: output,
      resultText: output
    };
  }

  if (toolName === "capture_screen") {
    if (perms.pc_control === false) {
      return {
        status: "denied",
        summary: "ekran görüntüsü",
        detail: "Bilgisayar kontrol izni (pc_control) kapalı.",
        resultText: "HATA: pc_control izni kapalı."
      };
    }
    const res = await window.luxAPI?.agent?.captureScreen?.({ outputPath: normalizeToolPath(args.outputPath || "") });
    if (res?.success && res.fileUrl) {
      addMediaToTurnContext(turnContext, {
        type: "image",
        title: "Masaüstü Ekran Görüntüsü",
        localPath: res.localPath,
        fileUrl: res.fileUrl,
        format: "png",
        engine: res.engine || "screen-capture"
      });
      return {
        status: "done",
        summary: `Ekran görüntüsü alındı (${Math.round((res.sizeBytes || 0) / 1024)} KB)`,
        detail: `Kaydedildi: ${res.localPath}`,
        resultText: `BAŞARILI: Ekran görüntüsü alındı ve sohbette görüntülendi.\nDosya: ${res.localPath}\nURL: ${res.fileUrl}`
      };
    }
    return {
      status: "error",
      summary: "ekran",
      detail: res?.error || "Alınamadı",
      resultText: `HATA: ${res?.error || "Ekran görüntüsü alınamadı."}`
    };
  }

  if (toolName === "pc_control") {
    const action = String(args.action || "")
      .trim()
      .toLowerCase();
    if (!action)
      return {
        status: "error",
        summary: "(eylem eksik)",
        detail: "action gerekli.",
        resultText: "HATA: pc_control action parametresi boş."
      };
    const isBrowserAction = action === "open_url" || action === "open_website";
    if (isBrowserAction && perms.pc_control === false && perms.browser_automation === false) {
      return {
        status: "denied",
        summary: action,
        detail: "Tarayıcı ve bilgisayar kontrol izinleri kapalı.",
        resultText: "HATA: Tarayıcı kontrol izni kapalı."
      };
    }
    if (!isBrowserAction && perms.pc_control === false) {
      return {
        status: "denied",
        summary: action,
        detail: "Bilgisayar kontrol izni (pc_control) kapatılmış.",
        resultText: "HATA: pc_control izni kapalı."
      };
    }
    const rawTarget = String(args.target || args.value || "").trim();
    if (isBrowserAction && userPrompt) {
      if (/(?:youtube\.com|youtu\.be)/i.test(rawTarget) && !userExplicitlyAskedYouTube) {
        return {
          status: "denied",
          summary: rawTarget,
          detail: "Kullanıcı YouTube açılmasını istemediği için engellendi.",
          resultText: "HATA: Kullanıcı YouTube açılmasını istemedi; istenen yerel dosya veya klasör aracını kullan."
        };
      }
      const looksExternalHttp =
        /^https?:\/\//i.test(rawTarget) ||
        (rawTarget.includes(".") &&
          !/\.(?:html?|txt|md|json|js|py|css)$/i.test(rawTarget) &&
          !/^[a-zA-Z]:[\\/]|^desktop|^masaüstü|^masaustu/i.test(rawTarget));
      if (looksExternalHttp && !userExplicitlyAskedWebOpen) {
        return {
          status: "denied",
          summary: rawTarget,
          detail: "Kullanıcı web sitesi açılmasını istemediği için engellendi.",
          resultText: "HATA: Kullanıcı tarayıcıda web sitesi açılmasını istemedi."
        };
      }
    }
    const res = await window.luxAPI?.agent?.pcControl?.({
      action,
      target: args.target || "",
      value: args.value || "",
      x: args.x,
      y: args.y,
      steps: args.steps,
      blockYouTube: userPrompt ? !userExplicitlyAskedYouTube : false
    });
    if (res?.success) {
      const out = res.output || `${action} tamamlandı.`;
      return { status: "done", summary: `${action}: ${args.target || out.slice(0, 40)}`, detail: out, resultText: `BAŞARILI: ${out}` };
    }
    return {
      status: "error",
      summary: action,
      detail: res?.error || "Uygulanamadı",
      resultText: `HATA: ${res?.error || "PC komutu başarısız."}`
    };
  }

  if (toolName === "play_lullaby") {
    const title = String(args.title || "Yumuşak Uyku Ninnisi").trim();
    const lyrics = String(args.lyrics || "Dandini dandini dastana, tatlı rüyalar sana...").trim();
    if (turnContext) {
      turnContext.lullaby = { title, lyrics };
      turnContext.lullabyTriggered = true;
    }
    const isVoice = Boolean(turnContext?.isVoiceTurn || window.voiceSessionActive);
    window.playLullabyExperience?.(lyrics, { skipVoice: isVoice, loops: 2 });
    return {
      status: "done",
      summary: `🌙 ${title}`,
      detail: lyrics,
      resultText: `BAŞARILI: "${title}" ninnisi ve yumuşak müzik kutusu melodisi çalınmaya başlandı. Sohbet ekranında ninni kartı gösteriliyor.`
    };
  }

  return {
    status: "error",
    summary: toolName,
    detail: `Bilinmeyen araç: ${toolName}`,
    resultText: `HATA: '${toolName}' adında tanımlı bir araç yok.`
  };
}

window.executeLuxAgentTool = executeAgentTool;

function recordToolStepUI(assistantMsg, name, args, execRes, opts = {}) {
  if (!assistantMsg || assistantMsg.__aborted) return;
  if (assistantMsg.__turnId && assistantMsg.__turnId !== window.__luxActiveTurnId) return;
  if (!Array.isArray(assistantMsg.toolSteps)) assistantMsg.toolSteps = [];
  const stepId = `step-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const argPreview = args?.filePath || args?.query || args?.target || args?.action || args?.command || args?.dirPath || args?.prompt || "";
  assistantMsg.toolSteps.push({
    id: stepId,
    name,
    summary: execRes.summary || argPreview,
    status: execRes.status,
    detail: execRes.detail,
    expanded: false
  });
  assistantMsg.stepLabel = `✓ ${name}: ${execRes.summary || argPreview}`;
  if (!opts.deferRender) {
    renderChat();
  }
}

async function executeToolCallsBatch(rawCalls, assistantMsg, parseFn) {
  const items = (rawCalls || []).map((raw, idx) => {
    const parsed = parseFn ? parseFn(raw) : raw;
    return {
      idx,
      raw,
      name: String(parsed?.name || "").trim(),
      args: parsed?.args || {}
    };
  });
  if (items.length === 0) return [];

  if (items.length === 1) {
    const it = items[0];
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    const argPreview =
      it.args?.filePath ||
      it.args?.query ||
      it.args?.target ||
      it.args?.action ||
      it.args?.command ||
      it.args?.dirPath ||
      it.args?.prompt ||
      "";
    assistantMsg.stepLabel = `⚡ ${it.name} çalıştırılıyor: ${argPreview}`.slice(0, 80);
    renderChat();
    const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    recordToolStepUI(assistantMsg, it.name, it.args, execRes);
    return [{ ...it, execRes }];
  }

  const hasOrderSensitive = items.some((it) => /^(?:delete_path|move_path|run_command|pc_control)$/i.test(it.name));
  const results = new Array(items.length);

  if (hasOrderSensitive) {
    for (const it of items) {
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      const argPreview =
        it.args?.filePath ||
        it.args?.query ||
        it.args?.target ||
        it.args?.action ||
        it.args?.command ||
        it.args?.dirPath ||
        it.args?.prompt ||
        "";
      assistantMsg.stepLabel = `⚡ ${it.name} çalıştırılıyor: ${argPreview}`.slice(0, 80);
      renderChat();
      const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      recordToolStepUI(assistantMsg, it.name, it.args, execRes, { deferRender: true });
      results[it.idx] = { ...it, execRes };
    }
    renderChat();
    return results;
  }

  // Run mkdir calls first if paired with write_file, then parallelize read/search/web/image/write batch
  const mkdirItems = items.filter((it) => it.name === "mkdir");
  const parallelItems = items.filter((it) => it.name !== "mkdir");

  for (const it of mkdirItems) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg.stepLabel = `⚡ mkdir çalıştırılıyor...`;
    renderChat();
    const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    results[it.idx] = { ...it, execRes };
  }

  if (parallelItems.length > 0) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg.stepLabel = `⚡ ${parallelItems.map((it) => it.name).join(", ")} çalıştırılıyor...`;
    renderChat();
    const batchRes = await Promise.all(
      parallelItems.map(async (it) => ({
        it,
        execRes: await executeAgentTool(it.name, it.args, assistantMsg)
      }))
    );
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    for (const { it, execRes } of batchRes) {
      results[it.idx] = { ...it, execRes };
    }
  }

  for (const entry of results) {
    if (entry) {
      recordToolStepUI(assistantMsg, entry.name, entry.args, entry.execRes, { deferRender: true });
    }
  }
  renderChat();
  return results;
}

async function maybePreloadWorkspaceContextForPrompt(text, assistantMsg) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const perms = window.appStore?.getPermissions?.() || {};
  if (!hasFs || perms.file_read === false) return null;

  const lower = String(text || "").toLowerCase();
  const hasBuildOrWriteIntent =
    /(?:oluştur|olustur|kur|yarat|tasarla|web\s*tasar|html|css|js|yaz|düzenle|duzenle|ekle|sil|taşı|tasi|yeniden\s*adlandır|adını\s*değiştir)/i.test(
      lower
    );
  const realProjects = await refreshDesktopProjectsCache();

  // Check if user explicitly mentions a known Desktop project by name (e.g. "lux_al", "lux_futures_xl", "al tasarım")
  const mentionedProj =
    !hasBuildOrWriteIntent &&
    (realProjects || []).find((p) => {
      const pLow = (p.name || "").toLowerCase();
      return pLow.length >= 3 && !p.isActiveWorkspace && lower.includes(pLow);
    });

  if (mentionedProj) {
    const execRes = await executeAgentTool("list_files", { dirPath: mentionedProj.path }, assistantMsg);
    recordToolStepUI(assistantMsg, "list_files", { dirPath: mentionedProj.name }, execRes);
    if (execRes.status === "done") {
      return `[GÜNCEL PROJE TARAMASI — ${mentionedProj.name}]\n${execRes.resultText}\n\nKullanıcı "${mentionedProj.name}" projesini sordu. Yukarıdaki gerçek dosya ve klasör listesini samimi 'sen' diliyle netçe aktar.`;
    }
  }

  const asksProjectsList =
    !hasBuildOrWriteIntent &&
    /(projeler|projelerim|masaüstü|masaustu|desktop).*(neler|list|hangi|kaç|kac|göster|goster|klasör|klasor|dosya|var\s*mı)/i.test(lower);
  const asksFileListing =
    !hasBuildOrWriteIntent &&
    /(dosya|klasör|klasor|dizin).*(kaç|kac|say|list|neler|isim|adları|adlari|hepsi|tümü|tumu|içer|icer)|(kaç|kac).*(dosya|klasör|klasor)|(listele|listesini\s*çık|listesini\s*cik).*(dosya|proje|klasör)/i.test(
      lower
    );

  if (!asksProjectsList && !asksFileListing) return null;

  const parts = [];
  if (asksProjectsList) {
    const projRes = await executeAgentTool("list_projects", {}, assistantMsg);
    recordToolStepUI(assistantMsg, "list_projects", {}, projRes);
    if (projRes.status === "done") {
      parts.push(`[MASAÜSTÜ & ÇALIŞMA ALANI PROJELERİ]\n${projRes.resultText}`);
    }
  }

  if (asksFileListing) {
    const execRes = await executeAgentTool("list_files", { dirPath: "" }, assistantMsg);
    recordToolStepUI(assistantMsg, "list_files", { dirPath: "" }, execRes);
    if (execRes.status === "done") {
      parts.push(`[GÜNCEL ÇALIŞMA ALANI TARAMASI]\n${execRes.resultText}`);
    }
  }

  if (parts.length === 0) return null;
  return `${parts.join("\n\n")}\n\n[BİLGİ NOTU: Sadece yukarıdaki gerçek proje ve dosya isimlerini doğal arkadaşça Türkçe ile özetle (180 kelimeyi geçme). Uydurma isim ekleme.]`;
}

function maybePreloadConversationMemoryForPrompt(text) {
  const lower = String(text || "").toLowerCase();
  const asksMemory = /(dün|dun|önceki|onceki|geçmiş|gecmis|eski\s*sohbet|daha\s*önce|hatırl|hatirl|ne\s*konuşt|konuşmuşt|konusmust)/i.test(
    lower
  );
  if (!asksMemory) return null;

  const { entries, yesterdayEntries } = collectSavedConversationMemory();
  const specificallyYesterday = /\bdün\b|\bdünkü\b|\bdünü\b|\bdünün\b/i.test(lower);

  if (specificallyYesterday) {
    if (yesterdayEntries.length > 0) {
      const list = yesterdayEntries.map((e) => `- [${e.dateTag} · ${e.projName}] "${e.title}": ${e.snippet}`).join("\n");
      return `[Hafıza Kontrol Sonucu — Dünkü Kayıtlı Sohbet]\nDün konuşulanlar:\n${list}\nYukarıdaki konuyu ve içeriği akıcı, kısa bir sohbet cümlesiyle dostça anlat.`;
    }
    return `[Hafıza Kontrol Sonucu: Düne ait kayıtlı sohbet YOK (0 kayıt).]\nKullanıcıya düne ait kayıtlı bir sohbet bulunmadığını tek kısa, samimi ve dürüst bir cümleyle söyle (ör. 'Hafıza çekmecesine baktım ama düne ait bir sohbet kaydı yok valla!').`;
  }

  if (entries.length === 0) {
    return `[Hafıza Kontrol Sonucu: Geçmişe ait mesaj içeren başka sohbet kaydı YOK.]\nYönerge: Dürüst ve sıcak 'sen' diliyle kayıt olmadığını söyle.`;
  }

  const list = entries
    .slice(0, 4)
    .map((e) => `- [${e.dateTag} · ${e.projName}] Konu: "${e.title}" | Konuşulanlar: ${e.snippet}`)
    .join("\n");
  return `[Hafıza Kontrol Sonucu — Kayıtlı Sohbetler]\n${list}\nYönerge: Bu gerçek kayıtlara göre samimi 'sen' diliyle yanıt ver.`;
}

async function resolvePromptContextMentions(rawText, assistantMsg = null) {
  if (!rawText || typeof rawText !== "string") return rawText;
  const perms = window.appStore?.getPermissions?.() || {};
  const extraSections = [];

  const fileMatches = Array.from(rawText.matchAll(/@file:([^\s]+)/g));
  for (const match of fileMatches.slice(0, 4)) {
    const filePath = match[1];
    if (perms.file_read === false) {
      extraSections.push(`[Bağlam @file:${filePath}: Dosya okuma izni (file_read) kapalı]`);
      continue;
    }
    if (perms.env_secrets_protection === true && isSensitivePath(filePath)) {
      extraSections.push(`[Bağlam @file:${filePath}: Güvenlik koruması nedeniyle okunmadı]`);
      continue;
    }
    const res = await window.luxAPI?.fs?.readFile?.(filePath);
    if (res?.success) {
      const clipped = (res.content || "").slice(0, 6000);
      extraSections.push(`[Dosya Bağlamı: ${filePath}]\n\`\`\`\n${clipped}\n\`\`\``);
    } else {
      extraSections.push(`[Bağlam @file:${filePath}: Okunamadı (${res?.error || "bulunamadı"})]`);
    }
  }

  const folderMatches = Array.from(rawText.matchAll(/@folder:([^\s]+)/g));
  for (const match of folderMatches.slice(0, 3)) {
    const dirPath = match[1];
    if (perms.file_read === false) {
      extraSections.push(`[Bağlam @folder:${dirPath}: Dosya okuma izni kapalı]`);
      continue;
    }
    const res = await window.luxAPI?.fs?.listFiles?.(dirPath === "." ? "" : dirPath);
    if (Array.isArray(res)) {
      const listing = summarizeTreeText(res).join("\n");
      extraSections.push(`[Klasör İçeriği: ${dirPath}]\n${listing}`);
    }
  }

  if (/@screen:[^\s]+/i.test(rawText)) {
    if (perms.pc_control === false) {
      extraSections.push("[Bağlam @screen: Bilgisayar kontrol izni (pc_control) kapalı olduğu için ekran görüntüsü alınamadı]");
    } else if (window.luxAPI?.agent?.captureScreen) {
      const scrRes = await executeAgentTool("capture_screen", {}, assistantMsg);
      recordToolStepUI(assistantMsg, "capture_screen", {}, scrRes);
      if (scrRes.status === "done") {
        extraSections.push(`[Ekran Görüntüsü Alındı]\n${scrRes.resultText}`);
      }
    }
  }

  if (rawText.includes("@terminal:last_output")) {
    const termOut = window.luxLastTerminalOutput || "Henüz kayıtlı terminal çıktısı yok.";
    extraSections.push(`[Son Terminal Çıktısı]\n\`\`\`\n${String(termOut).slice(0, 4000)}\n\`\`\``);
  }

  if (extraSections.length === 0) return rawText;
  return `${rawText}\n\n---\nEklenen Çalışma Alanı Bağlamları:\n${extraSections.join("\n\n")}`;
}

async function maybeRecoverMissingActionOrRefusal(userText, rawReply, model, priorHistory, assistantMsg) {
  let reply = String(rawReply || "").trim();
  if (isTurnCanceled(assistantMsg) || assistantMsg?.__apiError) return reply;

  const perms = window.appStore?.getPermissions?.() || {};
  const steps = Array.isArray(assistantMsg?.toolSteps) ? assistantMsg.toolSteps : [];
  if (steps.some((s) => s.status === "denied")) {
    return reply;
  }

  const executed = new Set(assistantMsg?.executedTools || []);
  const lower = String(userText || "").toLowerCase();
  const refusalRx =
    /(?:internet\s*bağlantım\s*yok|erişimim\s*yok|internete\s*erişemiyorum|belirli\s*bir\s*kaynağa\s*erişimim\s*yok|özel\s*bir\s*servis(?:\s*veya\s*uygulama)?\s*kullanmanız\s*gerekebilir|yapamam|edemem|bulamam|tasarlayamam|oluşturamam|söyleyemem|kontrol\s*edemem|gerçek\s*zamanlı\s*(?:bilgiye|hava\s*durumuna)\s*(?:erişimim|ulaşımım)\s*yok|yetkim\s*yok|mümkün\s*değil|maalesef[^.!?\n]*(?:internet|eriş|görsel|resim|hava\s*durumu|ninni|kontrol))/i;
  const isTimeoutFallback = /model\s*tarafına\s*şu\s*an\s*ulaşılamadı/i.test(reply);
  const isRefusal = isTimeoutFallback || refusalRx.test(reply);

  const asksLullaby = /\b(?:ninni|uyut|uyku\s*şarkısı)\b/i.test(lower);
  const asksScreen = /(ekran\s*görüntüsü|ekran\s*goruntusu|screenshot|ekranı\s*çek|ekrani\s*cek|ekran\s*resmi)/i.test(lower);
  const asksSysInfo = /(sistem\s*bilg|donanım\s*bilg|ram\s*durumu|cpu\s*bilg|bilgisayar\s*bilg)/i.test(lower);
  const isWebBuildPrompt =
    /(?:web\s*(?:tasar[ıi]m[ıi]?|sitesi|sayfas[ıi]|projesi)|açılış\s*sayfası|landing\s*page|(?:html|css|js).*(?:site|sayfa|proje|tasarla|kur|oluştur)).*(?:tasarla|kur|oluştur|yap|yaz)|(?:masaüstü|masaustu|desktop|klasör|klasor).*(?:web|html|sayfa|site|tasar)/i.test(
      lower
    );

  const folderReq = !isWebBuildPrompt ? extractFolderCreationRequest(userText) : null;
  const fileWriteReq = !isWebBuildPrompt && !folderReq ? extractFileWriteRequest(userText) : null;
  const moveReq = extractMoveOrRenameRequest(userText);
  const deleteReq = extractDeleteRequest(userText);
  const openReq = !folderReq && !fileWriteReq ? extractAppOrFolderOpenRequest(userText) : null;

  const asksImageSearch =
    /(?:resim|resmi|fotoğraf|fotograf|görsel|gorsel).*(?:bul|getir|göster|ara)|(?:bul\s*getir|göster).*(?:resim|fotoğraf|görsel)/i.test(
      lower
    );
  const asksImageDesign =
    !isWebBuildPrompt &&
    !folderReq &&
    /(?:resim|logo|afiş|poster|ikon|wallpaper|illüstrasyon|kapak|görsel|art|desen).*(?:tasarla|çiz|ciz|üret|uret|oluştur|hazırla)|(?:tasarla|çiz|ciz).*(?:resim|logo|afiş|poster|görsel)/i.test(
      lower
    );
  const asksWeatherOrInternet =
    /(hava\s*durumu|sıcaklık|kaç\s*derece|internetten|webden|web'den|araştır|haberler|dolar\s*kuru|euro\s*kuru|altın\s*fiyat|borsa|güncel)/i.test(
      lower
    );
  const asksFileList = /(dosya|klasör|klasor|projeler).*(?:listele|kaç|kac|neler|hangi|isim)/i.test(lower);

  const hasAnyLocalAction = Boolean(
    asksLullaby ||
    asksScreen ||
    asksSysInfo ||
    asksImageSearch ||
    asksImageDesign ||
    isWebBuildPrompt ||
    asksFileList ||
    folderReq ||
    fileWriteReq ||
    moveReq ||
    deleteReq ||
    openReq ||
    executed.size > 0
  );

  // 1. Lullaby recovery
  if (!isTurnCanceled(assistantMsg) && asksLullaby && !executed.has("play_lullaby")) {
    const cleanLyrics =
      !isRefusal && reply.length >= 30
        ? reply
        : "Eee eee eee uyusun da büyüsün, yıldızlar üstünü örtsün...\nGözlerin tatlı rüyalara dalsın, ay ışığı yastığına konsun.\nMışıl mışıl uyu, sabaha gülümseyerek uyan.";
    const res = await executeAgentTool("play_lullaby", { title: "Tatlı Rüyalar Ninnisi", lyrics: cleanLyrics }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "play_lullaby", { title: "Tatlı Rüyalar Ninnisi" }, res);
    if (isRefusal || reply.length < 25) {
      reply = `${cleanLyrics}\n\n🌙 *Senin için yumuşak müzik kutusu ninnisini başlattım, karttan istediğin zaman açıp kapatabilirsin.*`;
    }
  }

  // 2. Folder creation recovery (e.g., "masaüstüne BB diye bir klasör oluştur")
  if (!isTurnCanceled(assistantMsg) && folderReq && !executed.has("mkdir") && perms.file_write !== false && window.luxAPI?.fs?.mkdir) {
    const res = await executeAgentTool("mkdir", { dirPath: folderReq.dirPath }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "mkdir", { dirPath: folderReq.dirPath }, res);
    if (res.status === "done") {
      if (isRefusal || !reply || reply.length < 25 || !reply.toLowerCase().includes(folderReq.folderName.toLowerCase())) {
        reply = `${folderReq.displayLocation} **${folderReq.folderName}** klasörünü hemen oluşturdum! 📁`;
      }
    } else if (res.status === "error") {
      reply = `**${folderReq.folderName}** klasörünü oluştururken bir sorun çıktı: ${res.detail || res.resultText}`;
    }
  }

  // 2b. Single File write recovery (e.g., "masaüstüne not.txt diye bir dosya oluştur")
  if (
    !isTurnCanceled(assistantMsg) &&
    fileWriteReq &&
    !executed.has("write_file") &&
    perms.file_write !== false &&
    window.luxAPI?.fs?.writeFile
  ) {
    if (fileWriteReq.baseDir && fileWriteReq.baseDir.includes("/") && window.luxAPI?.fs?.mkdir) {
      await executeAgentTool("mkdir", { dirPath: fileWriteReq.baseDir }, assistantMsg);
      if (isTurnCanceled(assistantMsg)) return reply;
    }
    const res = await executeAgentTool(
      "write_file",
      {
        filePath: fileWriteReq.filePath,
        content: fileWriteReq.content
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "write_file", { filePath: fileWriteReq.filePath }, res);
    if (res.status === "done") {
      if (isRefusal || !reply || reply.length < 25 || !reply.toLowerCase().includes(fileWriteReq.fileName.toLowerCase())) {
        reply = `**${fileWriteReq.fileName}** dosyasını \`${fileWriteReq.filePath}\` konumuna hemen oluşturdum! 📄`;
      }
    }
  }

  // 2c. Move / Rename recovery
  if (!isTurnCanceled(assistantMsg) && moveReq && !executed.has("move_path") && perms.file_write !== false && window.luxAPI?.fs?.movePath) {
    const res = await executeAgentTool(
      "move_path",
      {
        sourcePath: moveReq.sourcePath,
        destPath: moveReq.destPath
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "move_path", { sourcePath: moveReq.sourcePath, destPath: moveReq.destPath }, res);
    if (res.status === "done") {
      reply = moveReq.isRename
        ? `Adını **${moveReq.destPath.split("/").pop()}** olarak değiştirdim!`
        : `**${moveReq.sourcePath}** konumunu **${moveReq.destPath}** hedefine taşıdım!`;
    } else if (isRefusal) {
      reply = `Taşıma / yeniden adlandırma işlemi yapılamadı: ${res.detail || res.resultText}`;
    }
  }

  // 2d. Explicit file/folder Delete recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    deleteReq &&
    !executed.has("delete_path") &&
    perms.file_delete !== false &&
    window.luxAPI?.fs?.deletePath
  ) {
    const res = await executeAgentTool("delete_path", { targetPath: deleteReq.targetPath }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "delete_path", { targetPath: deleteReq.targetPath }, res);
    if (res.status === "done") {
      reply = `**${deleteReq.targetName}** diskten kalıcı olarak silindi.`;
    } else if (isRefusal) {
      reply = `Silme işlemi gerçekleştirilemedi: ${res.detail || res.resultText}`;
    }
  }

  // 2e. Open App / Open Folder recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    openReq &&
    !executed.has("pc_control") &&
    perms.pc_control !== false &&
    window.luxAPI?.agent?.pcControl
  ) {
    const res = await executeAgentTool("pc_control", { action: openReq.mode, target: openReq.target }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "pc_control", { action: openReq.mode, target: openReq.target }, res);
    if (res.status === "done" && (isRefusal || !reply || reply.length < 25)) {
      reply =
        openReq.mode === "open_app" ? `**${openReq.target}** uygulamasını hemen açtım!` : `**${openReq.target}** klasörünü hemen açtım!`;
    }
  }

  // 3. Screen capture recovery
  if (!isTurnCanceled(assistantMsg) && asksScreen && !executed.has("capture_screen") && perms.pc_control !== false) {
    const res = await executeAgentTool("capture_screen", {}, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "capture_screen", {}, res);
    if (res.status === "done" && isRefusal) {
      reply = `Ekran görüntünü hemen yakaladım! Aşağıdaki karttan tam boy büyütebilir veya dosyayı açabilirsin 📸`;
    }
  }

  // 4. System info recovery
  if (!isTurnCanceled(assistantMsg) && asksSysInfo && !executed.has("pc_control") && perms.pc_control !== false) {
    const res = await executeAgentTool("pc_control", { action: "system_info" }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "pc_control", { action: "system_info" }, res);
    if (res.status === "done" && (isRefusal || !/\b(?:GB|CPU|Windows|DESKTOP)\b/i.test(reply))) {
      reply = `${reply && !isRefusal ? reply + "\n\n" : ""}**Sistem Bilgilerin:**\n\`\`\`\n${res.detail}\n\`\`\``;
    }
  }

  // 5. Web Image Search recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    asksImageSearch &&
    !executed.has("image_search") &&
    perms.image_generation !== false &&
    perms.network_internet !== false
  ) {
    const imgQuery = extractCleanMediaQuery(userText, "search");
    const res = await executeAgentTool("image_search", { query: imgQuery, count: 2 }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "image_search", { query: imgQuery }, res);
    if (res.status === "done" && (isRefusal || /example\.com|placehold|unsplash\.com|bulamadım|resim\s*gösteremiyorum/i.test(reply))) {
      reply = `İnternetten **${imgQuery}** görsellerini bulup senin için getirdim! Aşağıdaki görsellere tıklayıp büyütebilirsin 🚗✨`;
    }
  }

  // 6. AI Image Design recovery
  if (!isTurnCanceled(assistantMsg) && asksImageDesign && !executed.has("image_generate") && perms.image_generation !== false) {
    const designPrompt = extractCleanMediaQuery(userText, "design");
    const res = await executeAgentTool("image_generate", { prompt: designPrompt, title: designPrompt }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "image_generate", { prompt: designPrompt }, res);
    if (
      res.status === "done" &&
      (isRefusal || /example\.com|placehold|unsplash\.com|tasarlayam|çizemem/i.test(reply) || !assistantMsg?.media?.length)
    ) {
      reply =
        reply && !isRefusal ? reply : `**${designPrompt}** tasarımını hazırlayıp aşağıya bıraktım! Beğendiysen diske de kaydedebiliriz 🎨`;
    }
  }

  // 7. Desktop / Workspace Web Project write_file recovery
  if (
    !isTurnCanceled(assistantMsg) &&
    isWebBuildPrompt &&
    !executed.has("write_file") &&
    perms.file_write !== false &&
    window.luxAPI?.fs?.writeFile
  ) {
    const folderName = extractExplicitDesktopFolderName(userText);
    const webBase = detectRequestedBaseDir(userText) || "Desktop";
    const targetDir = `${webBase}/${folderName}`;
    const mkRes = await executeAgentTool("mkdir", { dirPath: targetDir }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "mkdir", { dirPath: targetDir }, mkRes);

    const blocks = extractCodeBlocksFromReply(reply);
    let htmlCode = blocks.html;
    let cssCode = blocks.css;
    let jsCode = blocks.js;

    if (!htmlCode || htmlCode.length < 80) {
      const starter = buildStarterWebFiles(userText, folderName);
      htmlCode = starter.html;
      if (!cssCode) cssCode = starter.css;
    } else if (cssCode && !/style\.css/i.test(htmlCode) && /<\/head>/i.test(htmlCode)) {
      htmlCode = htmlCode.replace(/<\/head>/i, '  <link rel="stylesheet" href="style.css" />\n</head>');
    }

    const htmlRes = await executeAgentTool(
      "write_file",
      {
        filePath: `${targetDir}/index.html`,
        content: htmlCode
      },
      assistantMsg
    );
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/index.html` }, htmlRes);

    if (cssCode) {
      const cssRes = await executeAgentTool(
        "write_file",
        {
          filePath: `${targetDir}/style.css`,
          content: cssCode
        },
        assistantMsg
      );
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/style.css` }, cssRes);
    }
    if (jsCode) {
      const jsRes = await executeAgentTool(
        "write_file",
        {
          filePath: `${targetDir}/script.js`,
          content: jsCode
        },
        assistantMsg
      );
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/script.js` }, jsRes);
    }

    if (isRefusal || !reply || reply.length < 40) {
      reply = `Masaüstünde **${folderName}** klasörünü oluşturup projeni gerçek dosyalarla kurdum! Aşağıdaki **Önizle** veya **Tarayıcıda Aç** butonlarıyla tasarımı hemen canlı görebilirsin 🚀`;
    } else if (!/masaüstü|desktop|kaydet|oluştur/i.test(reply)) {
      reply =
        `Masaüstündeki **${folderName}** klasörüne dosyaları kaydettim! Aşağıdaki butonlardan doğrudan tarayıcıda önizleyebilirsin 🚀\n\n` +
        reply.replace(/```[\s\S]*?```/g, "").trim();
    }
  }

  // 8. Live Internet / Weather recovery — STRICTLY blocked for local OS/file/folder requests, stop words, or LLM timeouts
  const asksLiveWebQuery =
    !hasAnyLocalAction &&
    !parseLuxVoiceStopCommand(userText) &&
    !isWipeMemoryPrompt(userText) &&
    !/(?:nasılsın|naber|selam|merhaba|teşekkür|sağ\s*ol|adın\s*ne|kimsin|seni\s*kim|dün\s*ne|sohbet|hafıza|hatırl)/i.test(lower);
  const allowWebRecovery = (asksWeatherOrInternet && !hasAnyLocalAction) || (isRefusal && !isTimeoutFallback && asksLiveWebQuery);

  if (
    !isTurnCanceled(assistantMsg) &&
    allowWebRecovery &&
    !executed.has("web_search") &&
    perms.web_search !== false &&
    perms.network_internet !== false
  ) {
    const res = await executeAgentTool("web_search", { query: userText }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "web_search", { query: userText }, res);
    if (res.status === "done" && res.data) {
      const w = res.data.weather;
      if (w) {
        const fc = Array.isArray(w.forecast) && w.forecast.length > 0 ? `\n\n**3 Günlük Tahmin:**\n- ${w.forecast.join("\n- ")}` : "";
        reply = `Hemen internetten canlı veriyi çektim! **${w.city}** şu an **${w.temperature}°C** (hissedilen ${w.apparentTemperature}°C) ve hava **${w.condition}**. Nem %${w.humidity}, rüzgar ${w.windSpeed} km/saat.${fc}`;
      } else if (Array.isArray(res.data.results) && res.data.results.length > 0) {
        const bullets = res.data.results
          .slice(0, 4)
          .map((r) => `- **${r.title}** (${r.source})\n  ${r.snippet || ""}\n  [Kaynağı Aç](${r.url})`)
          .join("\n");
        reply = `İnternetten canlı arama yaptım, öne çıkan sonuçlar şunlar:\n\n${bullets}`;
      }
    }
  }

  return reply;
}

function createStreamSpeechPipeline(assistantMsg, voiceSettings, turnPerf, myTurnId) {
  const voiceId = voiceSettings.voice || "Fola";
  const speed = voiceSettings.speed || 1.0;
  const engineMode = voiceSettings.engineMode || "auto";
  const cloneRefPath = voiceSettings.cloneRefPath || "";
  const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";
  const transcriptEl = document.getElementById("voice-hud-transcript");
  const mySpeechEpoch = (window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1);

  const queue = [];
  const queuedTexts = [];
  let scannedOffset = 0;
  let stepBlocked = false;
  let noMoreChunks = false;
  let drainRunning = false;
  let firstAudioSentSound = false;
  let wakeDrain = null;
  let resolveDone = null;
  const donePromise = new Promise((res) => {
    resolveDone = res;
  });

  const signalDrain = () => {
    if (wakeDrain) {
      const fn = wakeDrain;
      wakeDrain = null;
      fn();
    }
  };

  const enqueueSentence = (cleanSentence) => {
    const s = String(cleanSentence || "").trim();
    if (!s || s.length < 2) return;
    if (isTurnCanceled(assistantMsg) || mySpeechEpoch !== window.__luxSpeechEpoch) return;
    if (window.appStore?.getVoiceSettings?.()?.isSpeakerMuted) return;

    queuedTexts.push(s);
    if (!turnPerf.firstSentenceQueuedAt) {
      turnPerf.firstSentenceQueuedAt = performance.now();
    }
    const synthPromise = window.luxAPI.voice.synthesize(s, voiceId, speed, engineMode, cloneRefPath, { openrouterApiKey });
    queue.push({ text: s, synthPromise });
    signalDrain();
    if (!drainRunning) {
      runDrainLoop();
    }
  };

  const runDrainLoop = async () => {
    if (drainRunning) return;
    drainRunning = true;
    try {
      let idx = 0;
      while (true) {
        if (idx >= queue.length) {
          if (noMoreChunks) break;
          await new Promise((res) => {
            wakeDrain = res;
          });
          continue;
        }
        const item = queue[idx++];
        let synthRes = null;
        try {
          synthRes = await item.synthPromise;
        } catch (_) {
          synthRes = null;
        }

        if (synthRes?.success && !turnPerf.firstTtsReadyAt) {
          turnPerf.firstTtsReadyAt = performance.now();
        }

        if (window.isTentativeBargeInActive?.()) {
          const bargeStatus = await window.waitForTentativeBargeInResolution?.();
          if (bargeStatus === "committed") break;
        }
        if (
          isTurnCanceled(assistantMsg) ||
          mySpeechEpoch !== window.__luxSpeechEpoch ||
          window.appStore?.getVoiceSettings?.()?.isSpeakerMuted
        ) {
          break;
        }
        if (!synthRes?.success || !synthRes.audioBase64) continue;

        if (!firstAudioSentSound) {
          firstAudioSentSound = true;
          window.playLuxSound?.("responseReceived1");
        }

        const engineBadge =
          synthRes.engine === "piper-offline"
            ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Çevrimdışı Piper</span>`
            : synthRes.engine === "kokoro-onnx"
              ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Kokoro 82M</span>`
              : synthRes.engine === "coqui-xtts-v2"
                ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 mr-1.5 font-mono">🎙 XTTS-v2</span>`
                : synthRes.engine === "openrouter-fish"
                  ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mr-1.5 font-mono">🌊 Fish S2.1 :free</span>`
                  : synthRes.engine === "openrouter-heygen"
                    ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 mr-1.5 font-mono">🎙 HeyGen :free</span>`
                    : "";

        const audio = new Audio(synthRes.audioBase64);
        audio.volume = Math.max(0, Math.min(1, (window.appStore?.getVoiceSettings?.()?.volume ?? 100) / 100));
        if (/^openrouter-/i.test(synthRes.engine || "")) {
          audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));
        }
        window.currentVoiceAudio = audio;
        window.isAIResponding = true;

        await new Promise(async (resolve) => {
          let settled = false;
          const stopTimer = () => {
            if (currentStreamingTimer) {
              clearInterval(currentStreamingTimer);
              currentStreamingTimer = null;
            }
          };
          const finishAudio = () => {
            stopTimer();
            if (window.currentVoiceAudio === audio) {
              window.currentVoiceAudio = null;
            }
            window.isAIResponding = false;
            window.lastAiAudioEndedAt = Date.now();
            window.resetVoiceCaptureBuffers?.();
            if (!settled) {
              settled = true;
              resolve();
            }
          };

          audio.onended = () => {
            audio.__luxTentativePause = false;
            finishAudio();
          };
          audio.onpause = () => {
            if (!audio.ended && !audio.__luxTentativePause) {
              finishAudio();
            }
          };
          audio.onerror = finishAudio;

          try {
            await audio.play();
            if (!turnPerf.firstAudioPlayAt) {
              turnPerf.firstAudioPlayAt = performance.now();
              if (turnPerf.vadEndedAt) {
                turnPerf.firstAudioE2eMs = Math.round(Date.now() - turnPerf.vadEndedAt);
              }
            }
            const estDurationMs = Math.max(700, item.text.length * 55);
            const streamStart = Date.now();
            currentStreamingTimer = setInterval(() => {
              if (isTurnCanceled(assistantMsg) || !window.currentVoiceAudio || mySpeechEpoch !== window.__luxSpeechEpoch) {
                finishAudio();
                return;
              }
              if (audio.__luxTentativePause || window.isTentativeBargeInActive?.()) {
                return;
              }
              const liveDurationMs = audio.duration && !isNaN(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : estDurationMs;
              const elapsed = audio.duration > 0 && audio.currentTime > 0 ? audio.currentTime * 1000 : Date.now() - streamStart;
              const progress = Math.min(1.0, elapsed / liveDurationMs);
              if (transcriptEl && window.voiceSessionActive) {
                const chars = Math.max(1, Math.floor(item.text.length * progress));
                transcriptEl.innerHTML = `${engineBadge}<span class="text-foreground leading-relaxed font-normal">${escapeHtml(item.text.slice(0, chars))}</span>${!noMoreChunks || idx < queue.length || progress < 1.0 ? '<span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle"></span>' : ""}`;
              }
              if (progress >= 1.0) {
                stopTimer();
              }
            }, 40);
          } catch (_) {
            finishAudio();
          }
        });

        if (isTurnCanceled(assistantMsg) || mySpeechEpoch !== window.__luxSpeechEpoch) {
          break;
        }
      }
    } finally {
      drainRunning = false;
      resolveDone?.();
    }
  };

  return {
    onStepStart() {
      scannedOffset = 0;
      stepBlocked = false;
    },
    pushRawText(rawStepText) {
      if (stepBlocked || noMoreChunks) return;
      if (/<think>(?![\s\S]*<\/think>)/i.test(rawStepText)) return;
      if (/<lux_tool/i.test(rawStepText)) {
        stepBlocked = true;
        return;
      }
      const noThink = String(rawStepText || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
      const codeFenceIdx = noThink.indexOf("```");
      const safeRegion = codeFenceIdx >= 0 ? noThink.slice(0, codeFenceIdx) : noThink;
      if (codeFenceIdx >= 0) stepBlocked = true;

      // Hold false-refusal sentences until maybeRecoverMissingActionOrRefusal completes
      if (queuedTexts.length === 0 && /(?:üzgünüm|maalesef|erişimim\s*yok|yapamam|edemem|ulaşılamadı)/i.test(safeRegion)) {
        stepBlocked = true;
        return;
      }

      const slice = safeRegion.slice(scannedOffset);
      if (slice.length < 22) return;

      const sentenceEndRx = /([.?!…]+)(?=\s|$)/g;
      let m;
      let lastConsumedEnd = 0;
      while ((m = sentenceEndRx.exec(slice)) !== null) {
        const endPos = m.index + m[1].length;
        const candidate = slice.slice(lastConsumedEnd, endPos);
        const trimCand = candidate.trim();
        if (trimCand.length < 20) continue;
        // Skip numbered list markers ("1."), decimals ("3.5"), or common abbreviations
        if (/(?:^|\s)\d{1,2}\.$|\b(?:örn|vb|vs|dr|prof|av|no)\.$/i.test(trimCand)) continue;

        const cleaned = cleanTextForSpeech(trimCand);
        if (cleaned && cleaned.length >= 4 && !/(?:üzgünüm|maalesef|erişimim\s*yok|yapamam|edemem|ulaşılamadı)/i.test(cleaned)) {
          enqueueSentence(cleaned);
        }
        lastConsumedEnd = endPos;
      }

      if (lastConsumedEnd > 0) {
        scannedOffset += lastConsumedEnd;
      } else if (slice.length >= 145) {
        const commaBreak = slice.search(/[,;—–]\s+(?=.{20,})/);
        if (commaBreak >= 40) {
          const cutPos = commaBreak + 1;
          const cleaned = cleanTextForSpeech(slice.slice(0, cutPos));
          if (cleaned && cleaned.length >= 12) {
            enqueueSentence(cleaned);
          }
          scannedOffset += cutPos;
        }
      }
    },
    async complete(finalFullText) {
      const fullSpeechText = cleanTextForSpeech(finalFullText);
      window.__luxLastSpokenText = fullSpeechText;
      window.__luxLastSpokenAt = Date.now();

      if (fullSpeechText) {
        if (queuedTexts.length === 0) {
          for (const chunk of splitSpeechSentencesForStreaming(fullSpeechText)) {
            enqueueSentence(chunk);
          }
        } else {
          // Only synthesize trailing spoken sentences not yet queued
          const allSentences = fullSpeechText
            .split(/(?<=[.?!…])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const alreadySpokenChars = queuedTexts.join(" ").length;
          let acc = 0;
          const remaining = [];
          for (const s of allSentences) {
            if (acc + 6 < alreadySpokenChars) {
              acc += s.length + 1;
            } else {
              remaining.push(s);
            }
          }
          const remText = remaining.join(" ").trim();
          if (remText && remText.length >= 3) {
            for (const chunk of splitSpeechSentencesForStreaming(remText)) {
              enqueueSentence(chunk);
            }
          }
        }
      }

      noMoreChunks = true;
      signalDrain();
      if (queue.length > 0 || drainRunning) {
        await donePromise;
      }
      if (window.__luxActiveTurnId === myTurnId) {
        window.isAIResponding = false;
      }
    }
  };
}

window.submitUserMessage = async function (content, options = {}) {
  let text = (content || "").trim();
  // Metin yok ama konum işareti varsa: kısa sabit etiketle gönder (koordinatlar metne yazılmaz)
  if (!text && window.hasPendingLocationAttachments?.()) {
    text = "İşaretlediğim konuma bak.";
  }
  if (!text) return;

  // Clear composer textarea immediately
  const textarea = document.getElementById("composer-textarea");
  if (textarea) {
    textarea.value = "";
    textarea.style.height = "auto";
  }

  // Immediate voice/text stop command ("Dur", "Durdur", "Sus", "İptal", ...)
  const parsedStop = parseLuxVoiceStopCommand(text);
  if (parsedStop?.type === "stop") {
    window.stopAllAssistantOutput?.(true);
    const transcriptEl = document.getElementById("voice-hud-transcript");
    if (transcriptEl && window.voiceSessionActive) {
      transcriptEl.textContent = "⏹ Durduruldu — Dinliyor. Herhangi bir şey sorun.";
    }
    return;
  }

  const effectiveText = parsedStop?.type === "stop_and_continue" ? parsedStop.remainder : text;

  // Stop any ongoing speech & lullaby
  window.stopSpeaking?.();
  window.stopLullabyAudio?.();

  // If already generating, abort previous cleanly first (without re-calling stopSpeaking)
  if (window.isGenerating) {
    window.abortGeneration(true, { stopSpeech: false });
  }

  // Direct zero-base memory wipe command ("hafızanı sıfırdan sil")
  if (isWipeMemoryPrompt(effectiveText)) {
    const isVoiceWipe = Boolean(options.isVoice || window.voiceSessionActive);
    await window.appStore.wipeMemory({ preserveSettings: true });
    const wipedConv = window.appStore.getActiveConversation() || window.appStore.createConversation("Yeni Sohbet");
    const wipeReply =
      "Hafızayı sıfırdan sildim! Tüm eski sohbet kayıtları, proje kalıntıları ve önbellek temizlendi; şu an tertemiz ve sıfır bir sayfadayız.";
    if (wipedConv) {
      wipedConv.timestamp = "Şimdi";
      wipedConv.updatedAt = Date.now();
      wipedConv.messages.push({
        id: "msg-" + Date.now(),
        role: "assistant",
        modelName: "Sistem",
        stepLabel: "Hafıza sıfırdan temizlendi",
        content: wipeReply,
        isStreaming: false,
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      });
      window.appStore.saveState();
    }
    if (typeof window.renderApp === "function") {
      window.renderApp();
    } else {
      renderChat();
    }
    if (isVoiceWipe && typeof window.speakTextMessage === "function") {
      window.speakTextMessage(wipeReply);
    }
    return;
  }

  // Play Lux requestSent sound
  window.playLuxSound?.("requestSent");

  // 1. Get or create active conversation
  let conv = window.appStore.getActiveConversation();
  if (!conv) {
    conv = window.appStore.createConversation("Yeni Sohbet");
  }
  if (!conv) {
    console.error("No active conversation found or created");
    return;
  }

  // Filter out the assistant placeholder later if building history
  const priorHistory = conv.messages.slice();

  // 2. Add User Message & auto-title new conversation
  conv.timestamp = "Şimdi";
  conv.updatedAt = Date.now();
  conv.messages.push({
    id: "msg-" + Date.now(),
    role: "user",
    content: effectiveText,
    timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  });
  window.appStore.setConversationTitleIfDefault?.(conv.id, effectiveText);
  if (typeof window.updateTopbarNavigation === "function") {
    window.updateTopbarNavigation();
  }
  if (typeof window.renderSidebar === "function") {
    window.renderSidebar();
  }

  const activeModel = getActiveModel();
  if (!activeModel) {
    const emptyMsg =
      "Şu an kayıtlı veya seçili bir LLM modelin yok. **Ayarlar → Modeller** bölümünden dilediğin bir modeli ekleyip seçebilirsin.";
    conv.messages.push({
      id: "msg-" + (Date.now() + 1),
      role: "assistant",
      modelName: "Sistem",
      stepLabel: "Seçili model bulunamadı",
      content: emptyMsg,
      isStreaming: false,
      timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    });
    window.isGenerating = false;
    updateComposerSendButton(false);
    window.appStore.saveState();
    renderChat();
    if ((options.isVoice || window.voiceSessionActive) && typeof window.speakTextMessage === "function") {
      window.speakTextMessage(emptyMsg);
    }
    return;
  }

  // 3. Add Streaming Assistant Placeholder with Monotonic Turn Token & Stream Pipeline
  const myTurnId = ++window.__luxActiveTurnId;
  const assistantMsgId = "msg-" + (Date.now() + 1);
  const isVoiceTurn = Boolean(options.isVoice || window.voiceSessionActive);
  const voiceSettings = window.appStore?.getVoiceSettings?.() || {};
  const turnPerf = {
    startedAt: performance.now(),
    vadEndedAt: isVoiceTurn ? window.__luxPerfLastTurn?.vadEndedAt || null : null,
    sttMs: isVoiceTurn ? window.__luxPerfLastTurn?.sttMs || 0 : 0,
    firstTokenAt: null,
    llmDoneAt: null,
    firstSentenceQueuedAt: null,
    firstTtsReadyAt: null,
    firstAudioPlayAt: null,
    firstAudioE2eMs: null,
    model: activeModel.modelId || activeModel.name,
    provider: activeModel.provider || ""
  };
  if (isVoiceTurn) {
    window.__luxPerfLastTurn = null;
  }

  const assistantMsg = {
    id: assistantMsgId,
    role: "assistant",
    modelName: activeModel.name,
    stepLabel: `${activeModel.name} düşünüyor...`,
    toolSteps: [],
    media: [],
    createdFiles: [],
    executedTools: [],
    isVoiceTurn,
    userPrompt: effectiveText,
    __turnId: myTurnId,
    __turnPerf: turnPerf,
    __didStreamTokens: false,
    content: "",
    isStreaming: true,
    timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  };

  let streamSpeech = null;
  if (isVoiceTurn && !voiceSettings.isSpeakerMuted && voiceSettings.streamingTts !== false && window.luxAPI?.voice?.synthesize) {
    streamSpeech = createStreamSpeechPipeline(assistantMsg, voiceSettings, turnPerf, myTurnId);
  }
  let responseReceivedSoundPlayed = false;
  assistantMsg.__streamReset = () => {
    assistantMsg.__didStreamTokens = false;
    assistantMsg.content = "";
    streamSpeech?.onStepStart?.();
    scheduleStreamingRender(assistantMsg);
  };
  assistantMsg.__onStreamToken = (_delta, accumulatedRawStep) => {
    if (isTurnCanceled(assistantMsg)) return;
    if (!turnPerf.firstTokenAt) {
      turnPerf.firstTokenAt = performance.now();
    }
    const cleanStepVisible = stripMarkupForLiveStream(accumulatedRawStep).trimStart();
    if (cleanStepVisible) {
      if (!responseReceivedSoundPlayed) {
        responseReceivedSoundPlayed = true;
        window.playLuxSound?.("responseReceived1");
      }
      assistantMsg.__didStreamTokens = true;
      assistantMsg.content = cleanStepVisible;
      scheduleStreamingRender(assistantMsg);
    }
    streamSpeech?.pushRawText?.(accumulatedRawStep);
  };

  conv.messages.push(assistantMsg);

  const finalizeTransientFields = () => {
    delete assistantMsg.executedTools;
    delete assistantMsg.isVoiceTurn;
    delete assistantMsg.userPrompt;
    delete assistantMsg.__turnId;
    delete assistantMsg.__aborted;
    delete assistantMsg.__apiError;
    delete assistantMsg.__turnPerf;
    delete assistantMsg.__didStreamTokens;
    delete assistantMsg.__streamReset;
    delete assistantMsg.__onStreamToken;
    if (Array.isArray(assistantMsg.media) && assistantMsg.media.length === 0) {
      delete assistantMsg.media;
    }
    if (Array.isArray(assistantMsg.createdFiles) && assistantMsg.createdFiles.length === 0) {
      delete assistantMsg.createdFiles;
    }
  };

  window.isGenerating = true;
  updateComposerSendButton(true);
  window.appStore.saveState();
  renderChat();

  // Refresh Desktop projects list & resolve @file:, @folder:, @screen:, @terminal: + pre-grounding
  await refreshDesktopProjectsCache();
  if (isTurnCanceled(assistantMsg)) {
    finalizeTransientFields();
    return;
  }

  // Konum işareti METNE YAZILMAZ; şimdi (bu gönderim için) tüketilir ve modele gizli bağlam olarak eklenir
  const locationPromptSuffix = window.consumePendingLocationPrompt?.() || "";
  let modelPrompt = await resolvePromptContextMentions(effectiveText, assistantMsg);
  if (isTurnCanceled(assistantMsg)) {
    finalizeTransientFields();
    return;
  }

  const preloadedFsContext = await maybePreloadWorkspaceContextForPrompt(effectiveText, assistantMsg);
  if (isTurnCanceled(assistantMsg)) {
    finalizeTransientFields();
    return;
  }
  if (preloadedFsContext) {
    modelPrompt = `${modelPrompt}\n\n---\n${preloadedFsContext}`;
  }
  const preloadedMemoryContext = maybePreloadConversationMemoryForPrompt(effectiveText);
  if (preloadedMemoryContext) {
    modelPrompt = `${modelPrompt}\n\n---\n${preloadedMemoryContext}`;
  }
  // Konum işareti METNE YAZILMAZ; yalnız modele gizli bağlam olarak eklenir
  if (locationPromptSuffix) {
    modelPrompt = `${modelPrompt}${locationPromptSuffix}`;
  }

  // 4. Generate Content with True Token Streaming, Cooldown, & Agentic Tools
  let fullResponseText = "";
  try {
    fullResponseText = await callModelWithFallback(activeModel, modelPrompt, priorHistory, assistantMsg);
  } catch (err) {
    if (isTurnCanceled(assistantMsg) || err?.name === "AbortError") {
      assistantMsg.isStreaming = false;
      finalizeTransientFields();
      if (window.__luxActiveTurnId === myTurnId) {
        window.isGenerating = false;
        updateComposerSendButton(false);
      }
      window.appStore.saveState();
      renderChat();
      return;
    }
    console.error("Critical model dispatch error:", err);
    assistantMsg.__apiError = {
      status: Number(err?.status) || 0,
      message: err?.message || "",
      modelName: activeModel.name,
      modelId: activeModel.modelId || ""
    };
    assistantMsg.stepLabel = `⚠ ${activeModel.name} hatası`;
    fullResponseText = formatModelApiErrorMessage(err, activeModel);
  }
  turnPerf.llmDoneAt = performance.now();

  if (isTurnCanceled(assistantMsg)) {
    assistantMsg.isStreaming = false;
    finalizeTransientFields();
    window.appStore.saveState();
    renderChat();
    return;
  }

  // Anti-Refusal & Missing-Tool Recovery + Media Cleanup (skipped on genuine API errors)
  if (!assistantMsg.__apiError) {
    try {
      fullResponseText = await maybeRecoverMissingActionOrRefusal(effectiveText, fullResponseText, activeModel, priorHistory, assistantMsg);
    } catch (recErr) {
      console.warn("Action recovery warning:", recErr);
    }
  }

  if (isTurnCanceled(assistantMsg)) {
    assistantMsg.isStreaming = false;
    finalizeTransientFields();
    window.appStore.saveState();
    renderChat();
    return;
  }

  fullResponseText = sanitizePostToolMediaReply(fullResponseText, assistantMsg);
  if (!assistantMsg.__apiError) {
    fullResponseText = naturalizeConversationalTurkish(fullResponseText, effectiveText, priorHistory, {
      noYesterdayMemory: Boolean(preloadedMemoryContext && preloadedMemoryContext.includes("YOK (0 kayıt)")),
      hasMedia: Boolean(assistantMsg.media && assistantMsg.media.length > 0),
      hasCreatedFiles: Boolean(assistantMsg.createdFiles && assistantMsg.createdFiles.length > 0),
      hasLullaby: Boolean(assistantMsg.lullaby)
    });
  }

  if (isTurnCanceled(assistantMsg)) {
    assistantMsg.isStreaming = false;
    finalizeTransientFields();
    window.appStore.saveState();
    renderChat();
    return;
  }

  // Ensure live streamed markdown reflects normalized final text immediately before/during speech
  if (assistantMsg.__didStreamTokens) {
    assistantMsg.content = fullResponseText;
    scheduleStreamingRender(assistantMsg);
  }

  // 5. Complete Stream-to-Speech Pipeline OR Non-Streamed Voice Playback
  if (streamSpeech) {
    if (!assistantMsg.__didStreamTokens) {
      assistantMsg.content = fullResponseText;
      scheduleStreamingRender(assistantMsg);
    }
    try {
      await streamSpeech.complete(fullResponseText);
    } catch (voiceErr) {
      console.warn("Stream speech completion error:", voiceErr);
    }
  } else if (isVoiceTurn && !voiceSettings.isSpeakerMuted && window.luxAPI?.voice?.synthesize) {
    const speechText = cleanTextForSpeech(fullResponseText);
    window.__luxLastSpokenText = speechText;
    window.__luxLastSpokenAt = Date.now();
    const speechChunks =
      voiceSettings.streamingTts !== false ? splitSpeechSentencesForStreaming(speechText) : speechText ? [speechText] : [];
    const transcriptEl = document.getElementById("voice-hud-transcript");
    const mySpeechEpoch = (window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1);
    const voiceId = voiceSettings.voice || "Fola";
    const speed = voiceSettings.speed || 1.0;
    const engineMode = voiceSettings.engineMode || "auto";
    const cloneRefPath = voiceSettings.cloneRefPath || "";
    const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";

    const totalSpeechChars = speechChunks.reduce((acc, s) => acc + s.length, 0) || 1;
    let cumSpeechChars = 0;

    try {
      if (speechChunks.length > 0 && !turnPerf.firstSentenceQueuedAt) {
        turnPerf.firstSentenceQueuedAt = performance.now();
      }
      let currentSynthPromise =
        speechChunks.length > 0
          ? window.luxAPI.voice.synthesize(speechChunks[0], voiceId, speed, engineMode, cloneRefPath, { openrouterApiKey })
          : null;

      for (let chunkIdx = 0; chunkIdx < speechChunks.length; chunkIdx++) {
        const chunkText = speechChunks[chunkIdx];
        const synthRes = currentSynthPromise ? await currentSynthPromise : null;
        if (synthRes?.success && !turnPerf.firstTtsReadyAt) {
          turnPerf.firstTtsReadyAt = performance.now();
        }

        if (window.isTentativeBargeInActive?.()) {
          const bargeStatus = await window.waitForTentativeBargeInResolution?.();
          if (bargeStatus === "committed") {
            assistantMsg.isStreaming = false;
            finalizeTransientFields();
            if (window.__luxActiveTurnId === myTurnId) {
              updateComposerSendButton(false);
            }
            window.appStore.saveState();
            renderChat();
            return;
          }
        }

        if (
          isTurnCanceled(assistantMsg) ||
          mySpeechEpoch !== window.__luxSpeechEpoch ||
          window.appStore?.getVoiceSettings?.()?.isSpeakerMuted
        ) {
          break;
        }

        const nextChunkText = speechChunks[chunkIdx + 1];
        currentSynthPromise = nextChunkText
          ? window.luxAPI.voice.synthesize(nextChunkText, voiceId, speed, engineMode, cloneRefPath, { openrouterApiKey })
          : null;

        if (!synthRes || !synthRes.success || !synthRes.audioBase64) {
          cumSpeechChars += chunkText.length;
          continue;
        }

        if (chunkIdx === 0 && !responseReceivedSoundPlayed) {
          responseReceivedSoundPlayed = true;
          window.playLuxSound?.("responseReceived1");
        }

        const startRatio = cumSpeechChars / totalSpeechChars;
        cumSpeechChars += chunkText.length;
        const endRatio = Math.min(1.0, cumSpeechChars / totalSpeechChars);
        const speechEndChar = Math.floor(speechText.length * endRatio);
        const startFullChar = Math.floor(fullResponseText.length * startRatio);
        const endFullChar = chunkIdx === speechChunks.length - 1 ? fullResponseText.length : Math.floor(fullResponseText.length * endRatio);

        const audio = new Audio(synthRes.audioBase64);
        audio.volume = Math.max(0, Math.min(1, (window.appStore?.getVoiceSettings?.()?.volume ?? 100) / 100));
        if (/^openrouter-/i.test(synthRes.engine || "")) {
          audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));
        }
        window.currentVoiceAudio = audio;
        window.isAIResponding = true;

        await new Promise(async (resolve) => {
          let hasResolved = false;
          const stopTimer = () => {
            if (currentStreamingTimer) {
              clearInterval(currentStreamingTimer);
              currentStreamingTimer = null;
            }
          };
          const finish = () => {
            stopTimer();
            if (window.currentVoiceAudio === audio) {
              window.currentVoiceAudio = null;
            }
            window.isAIResponding = false;
            window.lastAiAudioEndedAt = Date.now();
            window.resetVoiceCaptureBuffers?.();
            if (chunkIdx === speechChunks.length - 1 && !assistantMsg.content && !isTurnCanceled(assistantMsg)) {
              assistantMsg.content = fullResponseText;
            }
            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          };

          audio.onended = () => {
            audio.__luxTentativePause = false;
            if (!isTurnCanceled(assistantMsg) && !assistantMsg.__didStreamTokens) {
              if (chunkIdx === speechChunks.length - 1) {
                assistantMsg.content = fullResponseText;
              } else if ((assistantMsg.content || "").length < endFullChar) {
                assistantMsg.content = fullResponseText.slice(0, endFullChar);
              }
            }
            finish();
          };
          audio.onpause = () => {
            if (!audio.ended && !audio.__luxTentativePause) {
              if (window.isGenerating && mySpeechEpoch === window.__luxSpeechEpoch && !isTurnCanceled(assistantMsg)) {
                assistantMsg.content = fullResponseText;
              }
              finish();
            }
          };
          audio.onerror = finish;

          try {
            await audio.play();
            if (!turnPerf.firstAudioPlayAt) {
              turnPerf.firstAudioPlayAt = performance.now();
              if (turnPerf.vadEndedAt) {
                turnPerf.firstAudioE2eMs = Math.round(Date.now() - turnPerf.vadEndedAt);
              }
            }
            const estDurationMs = Math.max(900, chunkText.length * 60);
            const streamStart = Date.now();
            const engineBadge =
              synthRes.engine === "piper-offline"
                ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Çevrimdışı Piper</span>`
                : synthRes.engine === "kokoro-onnx"
                  ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Kokoro 82M</span>`
                  : synthRes.engine === "coqui-xtts-v2"
                    ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 mr-1.5 font-mono">🎙 XTTS-v2</span>`
                    : synthRes.engine === "openrouter-fish"
                      ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mr-1.5 font-mono">🌊 Fish S2.1 :free</span>`
                      : synthRes.engine === "openrouter-heygen"
                        ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 mr-1.5 font-mono">🎙 HeyGen :free</span>`
                        : "";

            currentStreamingTimer = setInterval(() => {
              if (isTurnCanceled(assistantMsg) || !window.currentVoiceAudio || mySpeechEpoch !== window.__luxSpeechEpoch) {
                finish();
                return;
              }
              if (audio.__luxTentativePause || window.isTentativeBargeInActive?.()) {
                return;
              }

              const liveDurationMs = audio.duration && !isNaN(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : estDurationMs;
              const elapsed = audio.duration > 0 && audio.currentTime > 0 ? audio.currentTime * 1000 : Date.now() - streamStart;
              const progress = Math.min(1.0, elapsed / liveDurationMs);
              if (!assistantMsg.__didStreamTokens) {
                const targetChar = Math.max(startFullChar + 1, startFullChar + Math.floor((endFullChar - startFullChar) * progress));
                assistantMsg.content = fullResponseText.slice(0, targetChar);
                scheduleStreamingRender(assistantMsg);
              }

              if (transcriptEl && window.voiceSessionActive) {
                const startHudChar = Math.floor(speechText.length * startRatio);
                const hudChar = startHudChar + Math.floor((speechEndChar - startHudChar) * progress);
                transcriptEl.innerHTML = `${engineBadge}<span class="text-foreground leading-relaxed font-normal">${escapeHtml(speechText.slice(0, hudChar))}</span>${chunkIdx < speechChunks.length - 1 || progress < 1.0 ? '<span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle"></span>' : ""}`;
              }

              if (progress >= 1.0) {
                stopTimer();
                if (!assistantMsg.__didStreamTokens) {
                  assistantMsg.content = fullResponseText.slice(0, endFullChar);
                  scheduleStreamingRender(assistantMsg);
                }
              }
            }, 32);
          } catch (playErr) {
            console.warn("Audio play error or autoplay policy:", playErr);
            if (!isTurnCanceled(assistantMsg)) {
              assistantMsg.content = fullResponseText;
            }
            finish();
          }
        });

        if (isTurnCanceled(assistantMsg) || mySpeechEpoch !== window.__luxSpeechEpoch) {
          break;
        }
      }
    } catch (voiceErr) {
      console.warn("Neural streaming sync error, falling back to text:", voiceErr);
    }
  }

  if (isTurnCanceled(assistantMsg)) {
    assistantMsg.isStreaming = false;
    finalizeTransientFields();
    window.appStore.saveState();
    renderChat();
    return;
  }

  // Fallback progressive typewriter ONLY when response was NOT already token-streamed (e.g., error/recovery)
  if (!isTurnCanceled(assistantMsg) && assistantMsg.content !== fullResponseText) {
    if (assistantMsg.__didStreamTokens || assistantMsg.__apiError) {
      assistantMsg.content = fullResponseText;
    } else {
      if (!responseReceivedSoundPlayed) {
        responseReceivedSoundPlayed = true;
        window.playLuxSound?.("responseReceived1");
      }
      let currentIdx = assistantMsg.content.length || 0;
      const chunkSize = Math.max(4, Math.floor(fullResponseText.length / 40));

      await new Promise((resolve) => {
        currentStreamingTimer = setInterval(() => {
          if (isTurnCanceled(assistantMsg)) {
            clearInterval(currentStreamingTimer);
            currentStreamingTimer = null;
            resolve();
          } else {
            currentIdx += chunkSize;
            if (currentIdx >= fullResponseText.length) {
              currentIdx = fullResponseText.length;
              assistantMsg.content = fullResponseText;
              clearInterval(currentStreamingTimer);
              currentStreamingTimer = null;
              resolve();
            } else {
              assistantMsg.content = fullResponseText.slice(0, currentIdx);
            }
            scheduleStreamingRender(assistantMsg);
          }
        }, 16);
      });
    }
  }

  if (isTurnCanceled(assistantMsg)) {
    assistantMsg.isStreaming = false;
    finalizeTransientFields();
    window.appStore.saveState();
    renderChat();
    return;
  }

  assistantMsg.isStreaming = false;
  if (
    !assistantMsg.__apiError &&
    !assistantMsg.stepLabel?.includes("durduruldu") &&
    !assistantMsg.stepLabel?.includes("söz kesti") &&
    !assistantMsg.stepLabel?.includes("Auto-Free") &&
    !assistantMsg.stepLabel?.includes("hatası")
  ) {
    assistantMsg.stepLabel = `${assistantMsg.modelName || activeModel.name} yanıtı tamamladı`;
  }

  window.playLuxSound?.("LuxCascadeDone");

  const wasStillGenerating = !isTurnCanceled(assistantMsg);
  if (window.__luxActiveTurnId === myTurnId) {
    window.isGenerating = false;
  }

  const transcriptEl = document.getElementById("voice-hud-transcript");
  if (transcriptEl && window.voiceSessionActive && wasStillGenerating) {
    transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
  }

  console.info("[LUX_PERF]", {
    mode: isVoiceTurn ? "voice" : "text",
    provider: turnPerf.provider,
    model: turnPerf.model,
    streamed: Boolean(assistantMsg.__didStreamTokens),
    sttMs: turnPerf.sttMs || null,
    ttftMs: turnPerf.firstTokenAt ? Math.round(turnPerf.firstTokenAt - turnPerf.startedAt) : null,
    llmTotalMs: turnPerf.llmDoneAt ? Math.round(turnPerf.llmDoneAt - turnPerf.startedAt) : null,
    ttsFirstChunkMs: turnPerf.firstTtsReadyAt
      ? Math.round(turnPerf.firstTtsReadyAt - (turnPerf.firstSentenceQueuedAt || turnPerf.startedAt))
      : null,
    firstAudioE2eMs: turnPerf.firstAudioE2eMs
  });

  finalizeTransientFields();
  if (window.__luxActiveTurnId === myTurnId) {
    updateComposerSendButton(false);
  }
  window.appStore.saveState();
  renderChat();
};

window.speakTextMessage = async function (text) {
  if (window.stopSpeaking) window.stopSpeaking();
  const mySpeechEpoch = (window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1);
  const settings = window.appStore?.getVoiceSettings?.() || {};
  const speechText = cleanTextForSpeech(text);
  if (!speechText || settings.isSpeakerMuted) return;

  window.__luxLastSpokenText = speechText;
  window.__luxLastSpokenAt = Date.now();

  const speechChunks = settings.streamingTts !== false ? splitSpeechSentencesForStreaming(speechText) : [speechText];
  const voiceId = settings.voice || "Fola";
  const speed = settings.speed || 1.0;
  const engineMode = settings.engineMode || "auto";
  const cloneRefPath = settings.cloneRefPath || "";
  const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";

  try {
    let nextPromise = window.luxAPI?.voice?.synthesize?.(speechChunks[0], voiceId, speed, engineMode, cloneRefPath, { openrouterApiKey });
    for (let i = 0; i < speechChunks.length; i++) {
      const res = nextPromise ? await nextPromise : null;
      if (mySpeechEpoch !== window.__luxSpeechEpoch) return;

      const upcoming = speechChunks[i + 1];
      nextPromise = upcoming
        ? window.luxAPI?.voice?.synthesize?.(upcoming, voiceId, speed, engineMode, cloneRefPath, { openrouterApiKey })
        : null;

      if (!res?.success || !res.audioBase64) continue;
      if (i === 0) window.playLuxSound?.("responseReceived1");

      await new Promise((resolve) => {
        if (mySpeechEpoch !== window.__luxSpeechEpoch) {
          resolve();
          return;
        }
        const audio = new Audio(res.audioBase64);
        audio.volume = Math.max(0, Math.min(1, (window.appStore?.getVoiceSettings?.()?.volume ?? 100) / 100));
        if (/^openrouter-/i.test(res.engine || "")) {
          audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(speed) || 1.0));
        }
        window.currentVoiceAudio = audio;
        window.isAIResponding = true;
        let done = false;
        const cleanup = (playDoneSound = false) => {
          if (done) return;
          done = true;
          if (window.currentVoiceAudio === audio) {
            window.currentVoiceAudio = null;
          }
          window.isAIResponding = false;
          window.lastAiAudioEndedAt = Date.now();
          window.resetVoiceCaptureBuffers?.();
          if (playDoneSound) {
            window.playLuxSound?.("LuxCascadeDone");
          }
          resolve();
        };
        audio.onended = () => {
          audio.__luxTentativePause = false;
          cleanup(i === speechChunks.length - 1);
        };
        audio.onpause = () => {
          if (!audio.ended && !audio.__luxTentativePause) cleanup(false);
        };
        audio.onerror = () => cleanup(false);
        audio.play().catch(() => cleanup(false));
      });
    }
  } catch (err) {
    window.isAIResponding = false;
    window.currentVoiceAudio = null;
    console.warn("Speech playback error:", err);
  }
};

function submitUserMessage(content, options) {
  return window.submitUserMessage(content, options);
}

// Stop / Abort generation (also invoked by Barge-In & "Dur" commands)
window.abortGeneration = function (interrupted = false, opts = {}) {
  window.__luxActiveTurnId = (window.__luxActiveTurnId || 0) + 1;
  window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1;
  if (opts.stopSpeech !== false) {
    try {
      window.stopSpeaking?.();
    } catch (_) {}
  }
  if (currentStreamingTimer) {
    clearInterval(currentStreamingTimer);
    currentStreamingTimer = null;
  }
  if (currentAbortController) {
    try {
      currentAbortController.abort(new DOMException(interrupted ? "Söz kesildi" : "Kullanıcı durdurdu", "AbortError"));
    } catch (_) {}
    currentAbortController = null;
  }
  window.isGenerating = false;
  window.isAIResponding = false;
  updateComposerSendButton(false);

  const conv = window.appStore.getActiveConversation();
  if (conv && Array.isArray(conv.messages)) {
    let changed = false;
    for (const msg of conv.messages) {
      if (msg && msg.role === "assistant" && (msg.isStreaming || msg.__turnId)) {
        msg.__aborted = true;
        msg.isStreaming = false;
        delete msg.executedTools;
        delete msg.isVoiceTurn;
        delete msg.userPrompt;
        delete msg.__turnId;
        msg.stepLabel = interrupted ? "⚡ Kullanıcı söz kesti — durduruldu" : "Kullanıcı tarafından durduruldu";
        changed = true;
      }
    }
    if (changed) {
      window.appStore.saveState();
      renderChat();
    }
  }
};

function updateComposerSendButton(isGenerating) {
  const btn = document.getElementById("btn-input-cancel");
  if (!btn) return;

  if (isGenerating) {
    btn.setAttribute("title", "Yanıtı Durdur");
    btn.innerHTML = `<div class="bg-red-500 w-[0.625rem] h-[0.625rem] rounded-[1px] shadow-sm"></div>`;
    btn.classList.add("bg-secondary", "hover:bg-red-500/20");
  } else {
    btn.setAttribute("title", "Mesajı Gönder");
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" class="text-foreground">
        <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/>
      </svg>
    `;
    btn.classList.remove("hover:bg-red-500/20");
  }
}
window.updateComposerSendButton = updateComposerSendButton;
