// LUX AI — Sohbet render hattı
//
// chat.js'ten ayrıldı: mesaj sırası → HTML, incremental render, kaydırma ve
// mesaj-aksiyon delegasyonu (copy/speak/lightbox/remove-media). Yük sırası:
// agent_workspace → chat_shared → chat_render → chat_tools → chat_voice → chat.js (son).

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
