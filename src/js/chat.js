// Chat Area & Floating Composer with Real AI Engine & Agentic Tool Loop (Exact Antigravity Replica)

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

window.stopAllAssistantOutput = function(interrupted = false) {
  try { window.stopSpeaking?.(); } catch (_) {}
  try { window.stopLullabyAudio?.(); } catch (_) {}
  try { window.abortGeneration?.(Boolean(interrupted)); } catch (_) {}
};

function renderChat() {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  const conv = window.appStore.getActiveConversation();
  if (!conv || conv.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-6 text-center select-none max-w-2xl mx-auto my-auto">
        <div class="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground mb-4 shadow-sm border border-border/50">
          <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
            <path d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z" fill="currentColor"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-foreground mb-1.5">Bugün ne kurcalıyoruz?</h2>
        <p class="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          Antigravity Sınırsız Yetki aktif: internette araştır, görsel bul veya tasarla, masaüstünde proje kur, bilgisayarını yönet ya da sesli sohbet et.
        </p>

        <!-- Quick Prompt Chips -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" onclick="window.quickPrompt('Gaziantep\'te bugün hava durumu nedir? İnternetten kontrol et.')">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🌐 Canlı İnternet & Hava Durumu</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Gerçek zamanlı web araştırması ve hava durumu raporu</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" onclick="window.quickPrompt('Bana Porsche 911 araba resmi bul getir ve neon tarzda bir logo tasarla')">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🎨 Görsel Bul & Tasarla</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Web\'den fotoğraf getir veya yapay zeka ile sıfırdan çiz</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" onclick="window.quickPrompt('Masaüstünde web projesi klasörü oluşturup modern bir açılış sayfası tasarla')">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🚀 Masaüstünde Web & Kod Kur</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Otonom dosya üretimi, tarayıcı önizleme ve PC entegrasyonu</span>
          </button>

          <button class="prompt-suggestion-card p-3 rounded-xl border border-border/70 bg-card/40 flex flex-col gap-1 cursor-pointer" onclick="window.quickPrompt('Tüm projelerimi ve çalışma alanı dosyalarını listele')">
            <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>🤖 Projeler & Dosya Analizi</span>
            </div>
            <span class="text-[11px] text-muted-foreground">Çalışma alanı ve Masaüstü projelerini tam tara</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Render chat messages feed
  container.innerHTML = `
    <div class="flex flex-col gap-6 py-4 max-w-3xl mx-auto w-full">
      ${conv.messages.map((msg) => {
        if (msg.role === "user") {
          return `
            <div data-testid="user-input-step" class="flex flex-col w-full group/user-input-step items-end gap-1 pt-2">
              <div class="flex items-center justify-end gap-1.5 w-full">
                <!-- Action buttons (Copy) -->
                <div class="opacity-0 group-hover/user-input-step:opacity-100 flex items-center gap-1 transition-opacity">
                  <button role="button" aria-label="Kopyala" class="text-muted-foreground hover:text-secondary-foreground p-1 cursor-pointer transition-colors" title="Mesajı Kopyala" data-action="copy-msg" data-msg-id="${escapeHtml(msg.id)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M362.31-260Q332-260 311-281t-21-51.31V-787.69Q290-818 311-839t51.31-21H697.69Q728-860 749-839t21,51.31v455.38Q770-302 749-281t-51.31,21H362.31Zm0-60H697.69q4.62,0 8.46-3.85t3.85-8.46V-787.69q0-4.62-3.85-8.46T697.69-800H362.31q-4.62,0-8.46,3.85T350-787.69v455.38q0,4.62 3.85,8.46t8.46,3.85Zm-140,200Q192-120 171-141t-21-51.31V-677.69q0-12.77 8.62-21.38T180-707.69t21.38,8.62T210-677.69v485.38q0,4.62 3.85,8.46t8.46,3.85H587.69q12.77,0 21.38,8.62T617.69-150t-8.62,21.38T587.69-120H222.31ZM350-320q0,0 0-3.85t0-8.46V-787.69q0-4.62 0-8.46t0-3.85q0,0 0,3.85t0,8.46v455.38q0,4.62 0,8.46t0,3.85Z"/>
                    </svg>
                  </button>
                </div>

                <!-- User Message Bubble (Double border Antigravity design) -->
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
            <div class="flex flex-col gap-2 w-full group/assistant-turn" data-turn-msg-id="${escapeHtml(msg.id)}" data-msg-id="${escapeHtml(msg.id)}">
              <!-- Tool Step / Reasoning Pill -->
              <div class="lux-msg-step-wrap flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground select-none py-0.5 ${msg.stepLabel ? '' : 'hidden'}">
                ${msg.stepLabel ? (msg.isStreaming ? `
                  <svg class="animate-spin text-primary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <span class="text-primary font-medium">${escapeHtml(msg.stepLabel)}</span>
                ` : `
                  <span>${escapeHtml(msg.stepLabel)}</span>
                  <span class="text-muted-foreground">›</span>
                `) : ''}
              </div>

              <!-- Collapsible Agent Tool Execution Cards -->
              ${Array.isArray(msg.toolSteps) && msg.toolSteps.length > 0 ? `
                <div class="flex flex-col gap-1.5 my-1">
                  ${msg.toolSteps.map(step => {
                    const badgeClass = step.status === 'done'
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : (step.status === 'denied' || step.status === 'error'
                        ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        : 'text-amber-400 border-amber-500/30 bg-amber-500/10');
                    const statusLabel = step.status === 'done'
                      ? 'Tamamlandı'
                      : (step.status === 'denied' ? 'İzin Reddedildi' : (step.status === 'error' ? 'Hata' : 'Çalışıyor...'));
                    return `
                      <div class="lux-tool-step-card rounded-lg border border-border/70 bg-card/40 overflow-hidden text-xs">
                        <button type="button" class="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-secondary/50 cursor-pointer transition-colors text-left" data-action="toggle-tool-step" data-msg-id="${escapeHtml(msg.id)}" data-step-id="${escapeHtml(step.id)}">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-primary border border-border/50 shrink-0">${escapeHtml(step.name)}</span>
                            <span class="text-secondary-foreground truncate font-mono text-[11px]">${escapeHtml(step.summary || '')}</span>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}">${statusLabel}</span>
                            <svg class="w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </button>
                        <div id="tool-detail-${escapeHtml(step.id)}" class="${step.expanded ? '' : 'hidden'} px-2.5 py-2 border-t border-border/40 bg-[#050508] font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar select-text">${escapeHtml(step.detail || '')}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <!-- Comparison Table (if present in historical turns) -->
              ${msg.tableData ? `
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
                      ${msg.tableData.map(row => `
                        <tr>
                          <td><strong>${escapeHtml(row.feature)}</strong></td>
                          <td>${escapeHtml(row.oldCode)}</td>
                          <td>${escapeHtml(row.newCode)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              <!-- Assistant Markdown Text Content -->
              <div class="lux-msg-markdown text-sm text-foreground leading-relaxed select-text font-sans prose prose-invert max-w-none">
                ${renderMarkdown(msg.content)}
                ${msg.isStreaming ? '<span class="streaming-cursor"></span>' : ''}
              </div>

              <!-- Rich Verified Visual Media Gallery -->
              ${Array.isArray(msg.media) && msg.media.length > 0 ? `
                <div class="lux-media-grid my-2" data-testid="assistant-media-grid">
                  ${msg.media.map((m) => `
                    <div class="lux-media-card">
                      <img src="${escapeHtml(m.fileUrl || m.url || '')}" alt="${escapeHtml(m.title || 'Görsel')}" loading="lazy" data-action="lightbox-img" data-img-src="${escapeHtml(m.fileUrl || m.url || '')}" />
                      <div class="lux-media-card-footer">
                        <div class="flex flex-col min-w-0">
                          <span class="text-xs font-medium text-foreground truncate">${escapeHtml(m.title || 'Görsel')}</span>
                          <span class="text-[10px] text-muted-foreground truncate font-mono">${escapeHtml(m.engine || m.format || 'Yerel Önbellek')}</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          ${m.localPath ? `
                            <button type="button" class="lux-artifact-pill" data-action="open-path" data-path="${escapeHtml(m.localPath)}" title="Dosyayı / Klasörü Aç">Aç</button>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Interactive Lullaby / Music-Box Card -->
              ${msg.lullaby ? `
                <div class="lux-lullaby-card my-2" data-testid="lullaby-player-card">
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-semibold text-indigo-200 truncate">🌙 ${escapeHtml(msg.lullaby.title || 'Yumuşak Uyku Ninnisi')}</span>
                    <span class="text-[11px] text-indigo-200/70 truncate">Müzik kutusu melodisi ve yumuşak sesli eşlik hazır</span>
                  </div>
                  <button type="button" class="lux-lullaby-btn shrink-0 ${window.isLullabyPlaying?.() ? 'is-playing' : ''}" data-action="toggle-lullaby" data-msg-id="${escapeHtml(msg.id)}">
                    <span>🎵</span>
                    <span data-lullaby-label>${window.isLullabyPlaying?.() ? 'Ninniyi Durdur' : 'Ninniyi Sesli Dinle'}</span>
                  </button>
                </div>
              ` : ''}

              <!-- Created Files & Web Preview Action Bar -->
              ${Array.isArray(msg.createdFiles) && msg.createdFiles.length > 0 ? `
                <div class="lux-artifact-bar my-1" data-testid="created-files-bar">
                  ${msg.createdFiles.slice(0, 6).map((fp) => {
                    const fileName = String(fp).split(/[/\\]/).pop() || fp;
                    const isHtml = /\.(html|htm)$/i.test(fileName);
                    return `
                      ${isHtml ? `
                        <button type="button" class="lux-artifact-pill" data-action="preview-html" data-path="${escapeHtml(fp)}" title="Lux AI Dahili Tarayıcıda Önizle">
                          <span>🌐 Önizle: ${escapeHtml(fileName)}</span>
                        </button>
                        <button type="button" class="lux-artifact-pill" data-action="open-external-url" data-path="${escapeHtml(fp)}" title="Varsayılan Tarayıcıda Aç">
                          <span>↗ Tarayıcıda Aç</span>
                        </button>
                      ` : ''}
                      <button type="button" class="lux-artifact-pill" data-action="open-editor-file" data-path="${escapeHtml(fp)}" title="IDE Editörde Aç">
                        <span>📝 ${escapeHtml(fileName)}</span>
                      </button>
                    `;
                  }).join('')}
                  <button type="button" class="lux-artifact-pill" data-action="open-parent-folder" data-path="${escapeHtml(msg.createdFiles[0])}" title="Klasörü Aç">
                    <span>📁 Klasörü Aç</span>
                  </button>
                </div>
              ` : ''}

              <!-- Assistant Bottom Action Bar (Copy message & Listen) -->
              ${!msg.isStreaming ? `
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
                  ${msg.modelName ? `
                    <span class="text-[10px] text-muted-foreground/60 border border-border/40 px-1.5 py-0.5 rounded font-mono">
                      ${escapeHtml(msg.modelName)}
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }
      }).join('')}
    </div>
  `;

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

window.scrollToBottom = function() {
  const container = document.getElementById("chat-messages-container");
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
};

window.quickPrompt = function(text) {
  const textarea = document.getElementById("composer-textarea");
  if (textarea) {
    textarea.value = text;
    submitUserMessage(text);
  }
};

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.activeElement;
    if (btn && btn.tagName === "BUTTON") {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span>✓ Kopyalandı</span>`;
      setTimeout(() => { btn.innerHTML = originalText; }, 1400);
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
    const msg = conv?.messages?.find(m => m.id === msgId);
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
    const msg = conv?.messages?.find(m => m.id === msgId);
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
    const msg = conv?.messages?.find(m => m.id === msgId);
    const step = msg?.toolSteps?.find(s => s.id === stepId);
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
      const msg = conv?.messages?.find(m => m.id === msgId);
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
// Agentic Tools Schema (Antigravity Sınırsız Yetki) & Permission-Gated Executor
// -----------------------------------------------------------------------------
const LUX_OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "İnternette canlı arama yapar; güncel haber, hava durumu, fiyat, doküman ve web bilgilerini bulur.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak sorgu (örn: Gaziantep hava durumu, Porsche 911 GT3 özellikleri)" },
          limit: { type: "number", description: "Maksimum sonuç sayısı (varsayılan 6)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Verilen web sayfasının (URL) metin içeriğini ve bağlantılarını okur.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Okunacak sayfanın adresi (https://...)" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_search",
      description: "İnternette gerçek görsel/fotoğraf arar, doğrular, yerel diske indirir ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Görsel arama sorgusu (örn: Porsche 911 GT3)" },
          count: { type: "number", description: "Kaç görsel indirileceği (1-4)" },
          saveDir: { type: "string", description: "Sadece kullanıcı açıkça klasör adı isterse belirtin; normalde boş bırakın" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description: "Sıfırdan yapay zeka görseli, logo, afiş veya tasarım PNG üretir ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Tasarlanacak görselin ayrıntılı tarifi (İngilizce veya Türkçe)" },
          title: { type: "string", description: "Görsel başlığı" },
          style: { type: "string", description: "Sanat/tasarım stili (örn: cyberpunk neon, minimal flat, photorealistic)" },
          outputPath: { type: "string", description: "Sadece kullanıcı açıkça dosya adı veya yolu isterse belirtin; normalde boş bırakın" }
        },
        required: ["prompt"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "Aktif çalışma alanını ve Masaüstü'ndeki tüm gerçek proje klasörlerini dosya sayılarıyla listeler.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Çalışma alanı, Masaüstü (Desktop), proje klasörü veya belirtilen dizindeki dosya ve klasörleri listeler.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Hedef klasör yolu (örn: '', 'Desktop', 'lux_al', 'Desktop/proje')" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Belirtilen dosyanın (çalışma alanı veya Masaüstü) içeriğini okur.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Okunacak dosya yolu (örn: package.json, Desktop/not.txt)" }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Dosyalarda metin veya kod ifadesi arar.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Aranacak metin" },
          dirPath: { type: "string", description: "Opsiyonel alt klasör yolu" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Çalışma alanında veya Masaüstü'nde yeni dosya/web tasarımı oluşturur ya da mevcut dosyayı günceller.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Yazılacak dosya yolu (örn: Desktop/site/index.html, src/app.js)" },
          content: { type: "string", description: "Dosyanın tam içeriği" }
        },
        required: ["filePath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mkdir",
      description: "Masaüstü veya çalışma alanında yeni klasör oluşturur.",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "Oluşturulacak klasör yolu (örn: Desktop/yeni-web-projem)" }
        },
        required: ["dirPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_path",
      description: "Dosya veya klasörü taşır ya da yeniden adlandırır.",
      parameters: {
        type: "object",
        properties: {
          srcPath: { type: "string", description: "Kaynak dosya/klasör" },
          destPath: { type: "string", description: "Hedef dosya/klasör" }
        },
        required: ["srcPath", "destPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_path",
      description: "Belirtilen dosya veya klasörü siler.",
      parameters: {
        type: "object",
        properties: {
          targetPath: { type: "string", description: "Silinecek dosya veya klasör yolu" }
        },
        required: ["targetPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "PowerShell komutu çalıştırır ve çıktısını döndürür.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Çalıştırılacak PowerShell komutu" },
          cwd: { type: "string", description: "Opsiyonel çalışma klasörü (örn: Desktop/proje)" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "capture_screen",
      description: "Bilgisayar ekranının görüntüsünü (PNG) alır ve sohbette gösterir.",
      parameters: {
        type: "object",
        properties: {
          outputPath: { type: "string", description: "Sadece kullanıcı açıkça dosya adı veya yolu isterse belirtin; normalde boş bırakın" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pc_control",
      description: "Bilgisayarı kontrol eder: uygulama/klasör/URL açar, pencereleri listeler/odaklar, tuş/metin/fare/ses/pano yönetir.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["open_app", "open_url", "open_folder", "list_windows", "focus_window", "type_text", "send_keys", "mouse_click", "mouse_move", "volume", "clipboard_get", "clipboard_set", "system_info"],
            description: "Bilgisayar kontrol eylemi"
          },
          target: { type: "string", description: "Uygulama adı (notepad/chrome/vscode/calc), URL, dosya/klasör yolu veya pencere başlığı" },
          value: { type: "string", description: "Metin, tuş veya ses modu (up/down/mute)" },
          x: { type: "number", description: "Fare X koordinatı" },
          y: { type: "number", description: "Fare Y koordinatı" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "play_lullaby",
      description: "Kullanıcı ninni istediğinde yumuşak müzik kutusu ninnisi başlatır ve dinlenebilir ninni kartı oluşturur.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Ninni başlığı" },
          lyrics: { type: "string", description: "Okunacak sıcak ninni sözleri" }
        },
        required: ["lyrics"]
      }
    }
  }
];

const LUX_VALID_TOOL_NAMES = new Set(LUX_OPENAI_TOOLS.map(t => t.function.name));

window.luxDesktopProjectsCache = window.luxDesktopProjectsCache || [];
window.__luxProjectsCacheAt = window.__luxProjectsCacheAt || 0;
window.__luxProjectsCachePromise = window.__luxProjectsCachePromise || null;

function refreshDesktopProjectsCache(force = false) {
  if (!window.luxAPI?.fs?.listDesktopProjects) return Promise.resolve(window.luxDesktopProjectsCache);
  const now = Date.now();
  if (!force && window.luxDesktopProjectsCache.length > 0 && (now - window.__luxProjectsCacheAt) < 5000) {
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
      const codeFiles = f.files.filter(p => /\.(js|mjs|cjs|ts|py|html|css|json|md|bat|ps1)$/i.test(p));
      const shown = (f.files.length <= 10 ? f.files : (codeFiles.length > 0 ? codeFiles.slice(0, 8) : f.files.slice(0, 6)));
      const rest = f.files.length - shown.length;
      lines.push(`- ${f.name}/: ${f.fileCount} dosya, ${f.dirCount} alt klasör`);
      if (shown.length > 0) {
        lines.push(`  Dosyalar: ${shown.join(", ")}${rest > 0 ? `, ... (+${rest} diğer dosya)` : ""}`);
      }
    }
  }

  if (stats.rootFiles.length > 0) {
    lines.push("");
    const nonMediaRoot = stats.rootFiles.filter(n => !/\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n));
    const mediaRootCount = stats.rootFiles.length - nonMediaRoot.length;
    lines.push(`Kök Dizindeki Dosyalar (${stats.rootFiles.length} adet):`);
    if (stats.rootFiles.length <= 15) {
      lines.push(`- ${stats.rootFiles.join(", ")}`);
    } else {
      if (nonMediaRoot.length > 0) {
        const priorityRank = (name) => {
          const n = name.toLowerCase();
          if (n === "package.json" || n === "main.js" || n === "readme.md" || n === "preload.js") return 0;
          if (/^(antigravity_|dialog_full|extracted_|live_settings|overview_icons)/.test(n)) return 3;
          if (/\.(js|py|ts|json|md|bat|ps1)$/i.test(n)) return 1;
          return 2;
        };
        const prioritizedRoot = nonMediaRoot.slice().sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b));
        const shownRoot = prioritizedRoot.length <= 14 ? prioritizedRoot : prioritizedRoot.slice(0, 12);
        const restRoot = prioritizedRoot.length - shownRoot.length;
        lines.push(`- Kod/Yapılandırma (${nonMediaRoot.length}): ${shownRoot.join(", ")}${restRoot > 0 ? `, ... (+${restRoot} dosya)` : ""}`);
      }
      if (mediaRootCount > 0) {
        const sampleMedia = stats.rootFiles.filter(n => /\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n)).slice(0, 4);
        lines.push(`- Görsel/Ses (${mediaRootCount} adet): ${sampleMedia.join(", ")}${mediaRootCount > sampleMedia.length ? `, ... (+${mediaRootCount - sampleMedia.length} ek)` : ""}`);
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
  const clean = String(rawDirArg || "").trim().replace(/^['"]|['"]$/g, "").replace(/[\\/]+$/, "");
  const configuredWs = (window.appStore?.state?.application?.workspaceDir || "").trim();
  const lower = clean.toLowerCase();

  const rootAliases = new Set([
    "", ".", "./", "root", "kök", "kök dizin", "workspace", "çalışma alanı", "calisma alani",
    "proje", "projeler", "projelerim", "tüm projeler", "tum projeler", "tümü", "tumu",
    "dosyalar", "aktif proje", "bu proje", "mevcut proje"
  ]);
  if (rootAliases.has(lower)) {
    return { target: configuredWs || undefined, isRootAlias: true, label: "Çalışma Alanı Kök Dizini" };
  }

  // Match real cached Desktop projects first if name matches
  const desktopMatch = (window.luxDesktopProjectsCache || []).find(
    p => (p.name || "").trim().toLowerCase() === lower
  );
  if (desktopMatch && desktopMatch.path) {
    return { target: desktopMatch.path, isRootAlias: false, label: desktopMatch.name };
  }

  const projects = window.appStore?.state?.projects || [];
  const matchedProj = projects.find(p => (p.name || "").trim().toLowerCase() === lower || (p.id || "").trim().toLowerCase() === lower);
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
  if (!turnContext.media.some(m => (m.fileUrl || m.localPath || m.url || "").toLowerCase() === key)) {
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
    try { args = JSON.parse(args); } catch (_) { args = {}; }
  }

  const normalizeToolPath = (p) => String(p || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^@(file|folder|dir|path):/i, "")
    .trim();

  const userPrompt = String(turnContext?.userPrompt || "").toLowerCase();
  const userExplicitlyAskedYouTube = /\b(youtube|youtu\.be|şarkı|sarki|müzik|muzik|video|klip|fragman|izle|dinle)\b/i.test(userPrompt);
  const userExplicitlyAskedWebOpen = /(?:site|sitesi|sitesini|link|url|web\s*sayfa|web\s*site|tarayıcı|tarayici|chrome|edge|internet(?:te|ten)?\s*aç|browser|youtube|\.com|\.org|\.net|https?:\/\/)/i.test(userPrompt);

  const perms = window.appStore?.getPermissions?.() || {};
  const toolName = (name || "").trim();
  if (turnContext) {
    if (!Array.isArray(turnContext.executedTools)) turnContext.executedTools = [];
    turnContext.executedTools.push(toolName);
  }

  if (toolName === "web_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return { status: "error", summary: "(sorgu eksik)", detail: "query gerekli.", resultText: "HATA: web_search için query parametresi boş." };
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
          (Array.isArray(w.forecast) && w.forecast.length > 0 ? `3 Günlük Tahmin:\n${w.forecast.map(f => `- ${f}`).join("\n")}\n` : "") +
          `Kaynak: ${w.sourceUrl}`
        );
      }
      if (Array.isArray(res.results) && res.results.length > 0) {
        blocks.push(
          `[WEB ARAMA SONUÇLARI]\n` +
          res.results.map((r, i) => `${i + 1}. ${r.title} [${r.source}]\n   URL: ${r.url}${r.snippet ? `\n   Özet: ${r.snippet}` : ""}`).join("\n")
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
      return { status: "denied", summary: url, detail: "İnternet erişim izni kapatılmış.", resultText: "HATA: web_search/network_internet izni kapalı." };
    }
    const res = await window.luxAPI?.agent?.fetchUrl?.(url);
    if (res?.success) {
      const clipped = String(res.text || "").slice(0, 7500);
      const resultText = `Başlık: ${res.title}\nURL: ${res.url}\n\nİçerik:\n${clipped}`;
      return { status: "done", summary: res.title || url, detail: resultText.slice(0, 1500), resultText };
    }
    return { status: "error", summary: url, detail: res?.error || "Sayfa okunamadı", resultText: `HATA: ${res?.error || "Sayfa okunamadı."}` };
  }

  if (toolName === "image_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) {
      return { status: "error", summary: "(sorgu eksik)", detail: "query gerekli.", resultText: "HATA: Görsel arama sorgusu boş." };
    }
    if (perms.image_generation === false || perms.network_internet === false) {
      return { status: "denied", summary: query, detail: "Görsel veya internet erişim izni kapalı.", resultText: "HATA: image_generation/network_internet izni kapalı." };
    }
    const res = await window.luxAPI?.agent?.imageSearch?.(query, {
      count: args.count || 2,
      saveDir: normalizeToolPath(args.saveDir || "")
    });
    if (res?.success && Array.isArray(res.images) && res.images.length > 0) {
      res.images.forEach(img => {
        addMediaToTurnContext(turnContext, {
          type: "image",
          title: img.title || query,
          localPath: img.localPath,
          fileUrl: img.fileUrl,
          format: img.format,
          engine: "Web Görsel Arama"
        });
      });
      const listTxt = res.images.map((im, i) => `${i + 1}. ${im.title || query}\n   Yerel Dosya: ${im.localPath}\n   URL: ${im.fileUrl}`).join("\n");
      return {
        status: "done",
        summary: `"${query}" (${res.images.length} görsel indirildi)`,
        detail: listTxt,
        resultText: `BAŞARILI: ${res.images.length} doğrulanmış görsel yerel diske indirildi ve sohbet galerisine otomatik eklendi:\n${listTxt}\nNot: Yanıtta görseli kullanıcıya sun; sahte harici URL uydurma.`,
        data: res
      };
    }
    return { status: "error", summary: query, detail: res?.error || "Görsel bulunamadı", resultText: `HATA: ${res?.error || "Doğrulanmış görsel bulunamadı."}` };
  }

  if (toolName === "image_generate") {
    const prompt = String(args.prompt || args.description || args.title || "").trim();
    if (!prompt) {
      return { status: "error", summary: "(tarif eksik)", detail: "prompt gerekli.", resultText: "HATA: Görsel tasarımı için prompt boş." };
    }
    if (perms.image_generation === false) {
      return { status: "denied", summary: prompt, detail: "Görsel üretme izni (image_generation) kapatılmış.", resultText: "HATA: image_generation izni kapalı." };
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
    return { status: "error", summary: prompt.slice(0, 40), detail: res?.error || "Tasarım oluşturulamadı", resultText: `HATA: ${res?.error || "Görsel oluşturulamadı."}` };
  }

  if (toolName === "list_projects") {
    if (perms.file_read === false) {
      return { status: "denied", summary: "projeler", detail: "Dosya okuma izni (file_read) kapatılmış.", resultText: "HATA: file_read izni kapalı." };
    }
    const res = await window.luxAPI?.fs?.listDesktopProjects?.(window.appStore?.state?.application?.workspaceDir);
    if (res?.success && Array.isArray(res.projects)) {
      window.luxDesktopProjectsCache = res.projects;
      const lines = [
        `Aktif Çalışma Klasörü: ${res.workspaceDir}`,
        `Masaüstü: ${res.desktopPath} (${res.projects.length} proje/klasör):`
      ];
      for (const p of res.projects) {
        const tag = p.isActiveWorkspace ? "[AKTİF]" : `[${p.source}]`;
        const sample = (p.sampleFiles || []).slice(0, 4).join(", ");
        lines.push(`- ${p.name} ${tag}: ${p.topLevelFileCount} dosya, ${p.topLevelDirCount} klasör${sample ? ` (${sample})` : ""}`);
      }
      const txt = lines.join("\n");
      return { status: "done", summary: `${res.projects.length} proje klasörü bulundu`, detail: txt, resultText: txt, data: res };
    }
    return { status: "error", summary: "projeler", detail: res?.error || "Projeler listelenemedi", resultText: `HATA: ${res?.error || "Projeler listelenemedi."}` };
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
      return { status: "error", summary: "(sorgu eksik)", detail: "query parametresi gerekli.", resultText: "HATA: query parametresi boş." };
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
      const text = matches.length > 0
        ? matches.map(m => `${m.relPath || m.filePath || m.file || '?'}:${m.line}: ${m.text}`).join("\n")
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
      window.playAntigravitySound?.("codeActionApplied");
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
      return { status: "denied", summary: dirPath, detail: "Dosya yazma izni (file_write) kapalı.", resultText: "HATA: file_write izni kapalı." };
    }
    const res = await window.luxAPI?.fs?.mkdir?.(dirPath);
    if (res?.success) {
      refreshDesktopProjectsCache(true);
      return { status: "done", summary: `Klasör oluşturuldu: ${res.path}`, detail: res.path, resultText: `BAŞARILI: Klasör hazır: ${res.path}` };
    }
    return { status: "error", summary: dirPath, detail: res?.error || "Klasör oluşturulamadı", resultText: `HATA: ${res?.error || "Klasör oluşturulamadı."}` };
  }

  if (toolName === "move_path") {
    const srcPath = normalizeToolPath(args.srcPath || args.from || "");
    const destPath = normalizeToolPath(args.destPath || args.to || "");
    if (!srcPath || !destPath) return { status: "error", summary: "(yol eksik)", detail: "srcPath ve destPath gerekli.", resultText: "HATA: Yol eksik." };
    if (perms.file_write === false) {
      return { status: "denied", summary: srcPath, detail: "Dosya yazma izni (file_write) kapalı.", resultText: "HATA: file_write izni kapalı." };
    }
    const res = await window.luxAPI?.fs?.movePath?.(srcPath, destPath);
    if (res?.success) {
      return { status: "done", summary: `${res.from} -> ${res.to}`, detail: "Taşıma tamamlandı", resultText: `BAŞARILI: ${res.from} -> ${res.to}` };
    }
    return { status: "error", summary: srcPath, detail: res?.error || "Taşınamadı", resultText: `HATA: ${res?.error || "Taşınamadı."}` };
  }

  if (toolName === "delete_path") {
    const targetPath = normalizeToolPath(args.targetPath || args.path || "");
    if (!targetPath) return { status: "error", summary: "(yol eksik)", detail: "targetPath gerekli.", resultText: "HATA: targetPath boş." };
    if (perms.file_delete === false) {
      return { status: "denied", summary: targetPath, detail: "Dosya silme izni (file_delete) kapalı.", resultText: "HATA: file_delete izni kapalı." };
    }
    if (perms.env_secrets_protection === true && isSensitivePath(targetPath)) {
      return { status: "denied", summary: targetPath, detail: "Hassas dosya koruması aktif.", resultText: "HATA: Hassas dosya silinemedi." };
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
      return { status: "error", summary: "(komut eksik)", detail: "command parametresi gerekli.", resultText: "HATA: command parametresi boş." };
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
      status: (res?.code && res.code !== 0) ? "error" : "done",
      summary: command,
      detail: output,
      resultText: output
    };
  }

  if (toolName === "capture_screen") {
    if (perms.pc_control === false) {
      return { status: "denied", summary: "ekran görüntüsü", detail: "Bilgisayar kontrol izni (pc_control) kapalı.", resultText: "HATA: pc_control izni kapalı." };
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
    return { status: "error", summary: "ekran", detail: res?.error || "Alınamadı", resultText: `HATA: ${res?.error || "Ekran görüntüsü alınamadı."}` };
  }

  if (toolName === "pc_control") {
    const action = String(args.action || "").trim().toLowerCase();
    if (!action) return { status: "error", summary: "(eylem eksik)", detail: "action gerekli.", resultText: "HATA: pc_control action parametresi boş." };
    const isBrowserAction = action === "open_url" || action === "open_website";
    if (isBrowserAction && perms.pc_control === false && perms.browser_automation === false) {
      return { status: "denied", summary: action, detail: "Tarayıcı ve bilgisayar kontrol izinleri kapalı.", resultText: "HATA: Tarayıcı kontrol izni kapalı." };
    }
    if (!isBrowserAction && perms.pc_control === false) {
      return { status: "denied", summary: action, detail: "Bilgisayar kontrol izni (pc_control) kapatılmış.", resultText: "HATA: pc_control izni kapalı." };
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
      const looksExternalHttp = /^https?:\/\//i.test(rawTarget) || (rawTarget.includes(".") && !/\.(?:html?|txt|md|json|js|py|css)$/i.test(rawTarget) && !/^[a-zA-Z]:[\\/]|^desktop|^masaüstü|^masaustu/i.test(rawTarget));
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
    return { status: "error", summary: action, detail: res?.error || "Uygulanamadı", resultText: `HATA: ${res?.error || "PC komutu başarısız."}` };
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

function safeParseToolJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1. Direct standard JSON
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // 2. Fix unescaped Windows backslashes in paths (e.g. C:\Users -> C:\\Users)
  // In JSON strings, valid escapes are \", \\, \/, \b, \f, \n, \r, \t, and \uXXXX.
  try {
    const fixedBackslashes = trimmed.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
    return JSON.parse(fixedBackslashes);
  } catch (_) {}

  // 3. Relax trailing commas + fix backslashes
  try {
    const relaxed = trimmed
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
    return JSON.parse(relaxed);
  } catch (_) {}

  // 4. Single quotes to double quotes + trailing comma + backslashes
  try {
    const singleToDouble = trimmed
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/\\(?!["'\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(singleToDouble);
  } catch (_) {}

  // 5. Unescaped raw newlines inside string values
  try {
    const fixedNewlines = trimmed
      .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\r\n]+/g, "\\n");
    return JSON.parse(fixedNewlines);
  } catch (_) {}

  // 6. Regex fallback for {"name":"run_command","args":{...}}
  try {
    const nameMatch = trimmed.match(/["']?name["']?\s*:\s*["']([^"']+)["']/i);
    if (nameMatch) {
      const toolName = nameMatch[1].trim();
      const argsMatch = trimmed.match(/["']?args["']?\s*:\s*(\{[\s\S]*\})/i);
      let args = {};
      if (argsMatch) {
        args = safeParseToolJson(argsMatch[1]) || {};
      }
      return { name: toolName, args };
    }
  } catch (_) {}

  return null;
}

function parseXmlToolCalls(text) {
  if (!text || typeof text !== "string") return [];
  const calls = [];
  const regex = /<lux_tool>\s*([\s\S]*?)\s*<\/lux_tool>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = safeParseToolJson(match[1]);
      if (parsed && parsed.name) {
        const cleanName = String(parsed.name).trim();
        if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
          calls.push({ name: cleanName, args: parsed.args || parsed.arguments || {} });
        }
      }
    } catch (_) {}
  }
  if (calls.length === 0) {
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let jm;
    while ((jm = jsonBlockRegex.exec(text)) !== null) {
      try {
        const parsed = safeParseToolJson(jm[1]);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && item.name) {
            const cleanName = String(item.name).trim();
            if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
              calls.push({ name: cleanName, args: item.args || item.arguments || {} });
            }
          }
        }
      } catch (_) {}
    }
  }
  // Tolerant fallback for unclosed <lux_tool> tag
  if (calls.length === 0 && /<lux_tool/i.test(text)) {
    const unclosedMatch = text.match(/<lux_tool>\s*([\s\S]*?)(?:<\/lux_tool>|$)/i);
    if (unclosedMatch && unclosedMatch[1]) {
      const parsed = safeParseToolJson(unclosedMatch[1]);
      if (parsed && parsed.name) {
        const cleanName = String(parsed.name).trim();
        if (LUX_VALID_TOOL_NAMES.has(cleanName)) {
          calls.push({ name: cleanName, args: parsed.args || parsed.arguments || {} });
        }
      }
    }
  }
  return calls;
}

function cleanAssistantFinalText(text) {
  if (!text) return "";
  const cleaned = String(text)
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/<lux_tool[\s\S]*$/gi, "");
  const withoutThink = cleaned
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think[\s\S]*$/gi, "")
    .trim();
  return (withoutThink || cleaned).trim();
}

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
    const argPreview = it.args?.filePath || it.args?.query || it.args?.target || it.args?.action || it.args?.command || it.args?.dirPath || it.args?.prompt || "";
    assistantMsg.stepLabel = `⚡ ${it.name} çalıştırılıyor: ${argPreview}`.slice(0, 80);
    renderChat();
    const execRes = await executeAgentTool(it.name, it.args, assistantMsg);
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    recordToolStepUI(assistantMsg, it.name, it.args, execRes);
    return [{ ...it, execRes }];
  }

  const hasOrderSensitive = items.some(it => /^(?:delete_path|move_path|run_command|pc_control)$/i.test(it.name));
  const results = new Array(items.length);

  if (hasOrderSensitive) {
    for (const it of items) {
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      const argPreview = it.args?.filePath || it.args?.query || it.args?.target || it.args?.action || it.args?.command || it.args?.dirPath || it.args?.prompt || "";
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
  const mkdirItems = items.filter(it => it.name === "mkdir");
  const parallelItems = items.filter(it => it.name !== "mkdir");

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
    assistantMsg.stepLabel = `⚡ ${parallelItems.map(it => it.name).join(", ")} çalıştırılıyor...`;
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

function collectSavedConversationMemory() {
  const state = window.appStore?.state || {};
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const activeConvId = state.activeConversationId;
  const entries = [];

  for (const proj of projects) {
    for (const conv of (proj.conversations || [])) {
      if (conv.id === activeConvId) continue;
      const msgs = Array.isArray(conv.messages) ? conv.messages : [];
      if (msgs.length === 0) continue;

      let dateTag = String(conv.timestamp || "tarih yok").trim();
      if (conv.updatedAt) {
        const d = new Date(conv.updatedAt);
        const now = new Date();
        const dayDiff = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
        if (dayDiff === 0) dateTag = "Bugün";
        else if (dayDiff === 1) dateTag = "Dün";
        else dateTag = d.toLocaleDateString("tr-TR");
      } else if (/^dün$/i.test(dateTag)) {
        dateTag = "Dün";
      } else if (/^(?:şimdi|bugün)$/i.test(dateTag)) {
        dateTag = "Bugün";
      }

      const snippet = msgs.slice(-2)
        .map(m => String(m.content || "").replace(/\s+/g, " ").trim().slice(0, 110))
        .filter(Boolean)
        .join(" — ");

      entries.push({
        id: conv.id,
        projName: proj.name || "LUX_ai",
        title: conv.title || "Sohbet",
        dateTag,
        isYesterday: dateTag === "Dün",
        msgCount: msgs.length,
        snippet,
        updatedAt: conv.updatedAt || 0
      });
    }
  }

  entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return {
    entries,
    yesterdayEntries: entries.filter(e => e.isYesterday)
  };
}

function buildWorkspaceAndMemoryContext() {
  const state = window.appStore?.state || {};
  const wsDir = state.application?.workspaceDir || "c:\\Users\\SERVER\\Desktop\\LUX_ai";
  const desktopDir = window.luxAppInfo?.desktopPath || wsDir.replace(/[\\/][^\\/]+$/, "");
  const projects = Array.isArray(state.projects) ? state.projects : [];
  const activeProj = projects.find(p => p.id === state.activeProjectId) || projects[0];
  const { entries } = collectSavedConversationMemory();
  const realProjects = Array.isArray(window.luxDesktopProjectsCache) ? window.luxDesktopProjectsCache : [];

  const lines = [];
  lines.push(`- Aktif Çalışma Klasörü: ${wsDir} | Aktif Proje: ${activeProj ? activeProj.name : "LUX_ai"}`);
  lines.push(`- Masaüstü Yolu: ${desktopDir} (Dosya yollarında 'Desktop/...' veya 'Masaüstü/...' kullanabilirsin)`);
  if (realProjects.length > 0) {
    const shownProj = realProjects.slice(0, 6).map(p => `${p.name}(${p.topLevelFileCount}f)`).join(", ");
    const extraProj = realProjects.length > 6 ? `, +${realProjects.length - 6} diğer` : "";
    lines.push(`- Diskteki Projeler (${realProjects.length}): ${shownProj}${extraProj}`);
  } else if (projects.length > 0) {
    lines.push(`- Projeler (${projects.length}): ${projects.slice(0, 6).map(p => p.name).join(", ")}`);
  }

  if (entries.length > 0) {
    lines.push(`- Kayıtlı Sohbet Özetleri (${entries.length}): ${entries.slice(0, 4).map(e => `[${e.dateTag}] "${e.title}"`).join(", ")}`);
  } else {
    lines.push("- Kayıtlı Diğer Sohbetler: Mesaj içeren başka sohbet yok.");
  }

  return lines.join("\n");
}

function buildStylePreferenceReminder(rawPrompt = "", history = []) {
  const curLower = String(rawPrompt || "").split(/\n---\n\[/)[0].toLowerCase();
  const combined = [
    ...(Array.isArray(history) ? history.slice(-10).filter(m => m.role === "user").map(m => m.content || "") : []),
    curLower
  ].join("\n").toLowerCase();

  const rules = [];
  const directBan = /(?:^|\s)size\b|siz\s*(diye|kelime|hitap)|resmi/.test(curLower) && /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(curLower);
  if (directBan) {
    rules.push("ACİL KURAL: Kullanıcı artık sadece samimi 'sen' hitabıyla konuşmanı istiyor. Kısa, sıcak ve doğal tek cümleyle onayla.");
  } else if (/size|siz\s*(diye|kelime|hitap)|resmi/.test(combined) && /(kullanma|deme|söyleme|yasak|istemiyorum|bırak|yok)/.test(combined)) {
    rules.push("ÖZEL KURAL: İkinci çoğul hitap kullanma; yalnız samimi 'sen / sana / senin' kullan.");
  }
  if (/espiri|espri|samimi|doğal|dogal|insan\s*gibi|mekanik/.test(combined)) {
    rules.push("TON KURALI: Sıcak, doğal ve hafif esprili bir arkadaş gibi konuş.");
  }
  if (window.voiceSessionActive && !/dosya|listele|kaç\s*tane|kod\s*yaz/i.test(curLower)) {
    rules.push("SESLİ MOD: Cevabı akıcı konuşma dilinde 1-3 kısa cümlede tut.");
  }
  return rules.length > 0 ? `\n\n${rules.join("\n")}` : "";
}

function buildAgentSystemParts(rawPrompt = "", history = [], opts = {}) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const memContext = buildWorkspaceAndMemoryContext();
  const styleReminder = buildStylePreferenceReminder(rawPrompt, history);

  const staticPersona = [
    "Sen Antigravity gücünde sınırsız yetkiye sahip Lux AI'sın; kullanıcının yan yana çalıştığı zeki, sıcak ve samimi yakın dostusun.",
    "Temel Kurallar:",
    "- Doğal günlük Türkçe konuş; samimi 'sen / sana' çekimi kullan, resmi/kurumsal dil kullanma.",
    "- Sadece kullanıcının son isteğine odaklan.",
    "- Geçmiş sohbetler sorulduğunda sadece [Hafıza Kontrol Sonucu] verisine dayan.",
    "",
    "Sınırsız Yetki & Aksiyon Kuralları:",
    "- Canlı internet araması ve hava durumu (web_search, fetch_url), web'den görsel bulma (image_search), yapay zekayla görsel tasarlama (image_generate), Masaüstü ve tüm projelerde dosya/klasör oluşturma ve düzenleme (list_projects, list_files, read_file, write_file, mkdir, move_path, delete_path), PowerShell terminal (run_command), ekran görüntüsü ve tam PC kontrolü (capture_screen, pc_control) ve ninni/ses (play_lullaby) doğrudan çalışır durumda.",
    "- ASLA 'İnternet bağlantım yok', 'Erişimim yok', 'Resim bulamam/tasarlayamam', 'Ninni söyleyemem', 'Bilgisayarı kontrol edemem' veya 'Yapamam/edemem' deme. Bir iş istendiğinde doğrudan ilgili aracı çağır ve sonucu teslim et.",
    "- Masaüstü veya bilgisayarda klasör oluşturma dendiğinde (örn: 'masaüstüne BB diye bir klasör oluştur') DOĞRUDAN mkdir({dirPath:'Desktop/BB'}) aracını çağır; ASLA web_search ile arama yapma.",
    "- Dosya oluştur/yaz dendiğinde write_file, dosya/klasör taşı veya ad değiştir dendiğinde move_path, dosya/klasör sil dendiğinde delete_path, uygulama/klasör aç dendiğinde pc_control(open_app veya open_folder) aracını doğrudan çağır.",
    "- Kullanıcı açıkça YouTube veya video/şarkı istemediği sürece ASLA YouTube veya alakasız web sitesi açma.",
    "- İnternetten görsel veya tasarım istediğinde image_search veya image_generate aracını çalıştır; araç görseli diske indirip sohbete ekler, sahte URL uydurma.",
    "- Web sitesi veya çok dosyalı proje tasarla dendiğinde sadece sohbete kod yapıştırmakla kalma; mkdir ve write_file ile dosyaları gerçekten Masaüstü'ne veya çalışma alanına oluştur, gerekiyorsa pc_control(open_url) ile aç."
  ].join("\n");

  const xmlNote = (hasFs && opts.includeXmlInstruction)
    ? "\n\nAraç çağrısı için gerekirse <lux_tool>{\"name\":\"arac_adi\",\"args\":{...}}</lux_tool> biçimini kullan. Dosya ve klasör yollarında düz eğik çizgi (/) veya çift ters eğik çizgi (\\\\) kullan. Araç çalıştırırken sohbeti kapatacak ön metin yazmak yerine doğrudan aracı çağır; araç sonucu sana iletildiğinde kullanıcıya nihai yanıtı sun."
    : "";

  const dynamicSuffix = `Ortam:\n${memContext}${xmlNote}${styleReminder}`;
  return {
    staticPersona,
    dynamicSuffix,
    full: `${staticPersona}\n\n${dynamicSuffix}`
  };
}

function buildAgentSystemPrompt(rawPrompt = "", history = [], opts = {}) {
  return buildAgentSystemParts(rawPrompt, history, opts).full;
}

function shouldAttachToolsForPrompt(prompt = "", history = []) {
  const full = String(prompt || "");
  if (/\[Hafıza Kontrol Sonucu|\[Hafıza Durumu/i.test(full)) return false;
  const userPart = full.split(/\n---\n\[/)[0].trim().toLowerCase();
  const isTinyGreeting = userPart.length < 56 && /^(?:selam(?:lar)?|merhaba|slm|hey|naber|nasılsın|nasilsin|ne\s*haber|iyiyim|günaydın|gunaydin|iyi\s*(?:akşamlar|geceler|günler)|teşekkür(?:ler|\s*ederim)?|sağ\s*ol(?:un)?|eyvallah|tamam(?:dır)?|olur|evet|hayır|peki|dostum|kanka|arkadaşım|ya)(?:[\s,!?.]+(?:selam(?:lar)?|merhaba|slm|hey|naber|nasılsın|nasilsin|ne\s*haber|iyiyim|sen\s*nasılsın|senden\s*naber|teşekkür(?:ler|\s*ederim)?|sağ\s*ol|eyvallah|dostum|kanka|arkadaşım|bugün|nasıl\s*gidiyor))*[!?. ]*$/i.test(userPart);
  if (isTinyGreeting) return false;
  return true;
}

function selectToolsForPrompt(prompt = "", isLocalCpu = false, history = []) {
  const userPart = String(prompt || "").split(/\n---\n\[/)[0].toLowerCase();
  const pickNames = new Set();

  if (/(hava\s*durumu|derece|sıcaklık|internet|web(?:\s*ara|den|'den|te)?|araştır|arastir|haber|kur|dolar|altın|euro|döviz|borsa|kripto|bitcoin|btc|fiyat|maç|skor|saat\s*kaç|kimdir|nedir|ne\s*zaman|güncel|siteye|url|http|vikipedi|wikipedia)/i.test(userPart)) {
    pickNames.add("web_search");
    pickNames.add("fetch_url");
  }
  if (/(resim|fotoğraf|fotograf|görsel|gorsel|araba|logo|afiş|poster|çiz|ciz|tasarla|wallpaper|duvar kağıdı|illustration|illüstrasyon|banner)/i.test(userPart)) {
    if (/(tasarla|çiz|ciz|üret|uret|yarat|logo|afiş|poster|ikon|wallpaper|illüstrasyon)/i.test(userPart)) {
      pickNames.add("image_generate");
    }
    if (/(bul|getir|göster|goster|fotoğraf|fotograf|araba|marka|resmi|resmini)/i.test(userPart)) {
      pickNames.add("image_search");
    }
    pickNames.add("image_search");
    pickNames.add("image_generate");
  }
  if (/(dosya|klasör|klasor|dizin|proje|masaüstü|masaustu|desktop|belge|indirilen|oku|yaz|kaydet|oluştur|olustur|yarat|kur|düzenle|duzenle|güncelle|guncelle|incele|tara|listele|web\s*tasar|web\s*site|html|css|js|python|kod|sayfa|sil|kaldır|taşı|tasi|adını\s*değiştir|yeniden\s*adlandır)/i.test(userPart)) {
    pickNames.add("mkdir");
    pickNames.add("write_file");
    pickNames.add("list_files");
    pickNames.add("read_file");
    pickNames.add("move_path");
    pickNames.add("delete_path");
    pickNames.add("search_files");
    pickNames.add("list_projects");
  }
  const hasExplicitOpenWord = /(?:^|[\s.,!?'"()\-])(?:aç(?:ar\s*mısın|sana|abilir)?|başlat|baslat|çalıştır|calistir|kapat)(?=$|[\s.,!?'"()\-])/i.test(userPart);
  if (hasExplicitOpenWord || /(komut|terminal|powershell|script|pip|npm|node|ekran|screenshot|pencere|uygulama|hesap\s*makine|not\s*defteri|chrome|vscode|explorer|tarayıcı|kontrol|sesi|pano|clipboard|tıkla|tikla|yazdır|tuş|bilgisayar|sistem)/i.test(userPart)) {
    pickNames.add("pc_control");
    pickNames.add("capture_screen");
    pickNames.add("run_command");
    pickNames.add("write_file");
  }
  if (/(ninni|uyut|uyku|melodi|müzik|şarkı|sarki)/i.test(userPart)) {
    pickNames.add("play_lullaby");
  }

  // On ambiguous open-ended prompts: preserve full tool schemas for Cloud APIs,
  // but skip heavy native JSON schemas on local CPU to keep KV prefix warm & avoid 20-90s prompt evals (XML fallback remains active)
  if (pickNames.size === 0) {
    if (isLocalCpu) return [];
    return LUX_OPENAI_TOOLS;
  }

  const priorityOrder = [
    "mkdir",
    "write_file",
    "move_path",
    "delete_path",
    "pc_control",
    "read_file",
    "list_files",
    "search_files",
    "run_command",
    "capture_screen",
    "play_lullaby",
    "image_generate",
    "image_search",
    "list_projects",
    "web_search",
    "fetch_url"
  ];
  const limit = isLocalCpu ? 8 : 11;
  const selectedSet = new Set(priorityOrder.filter(n => pickNames.has(n)).slice(0, limit));
  return LUX_OPENAI_TOOLS.filter(t => selectedSet.has(t.function.name));
}

async function maybePreloadWorkspaceContextForPrompt(text, assistantMsg) {
  const hasFs = Boolean(window.luxAPI?.fs);
  const perms = window.appStore?.getPermissions?.() || {};
  if (!hasFs || perms.file_read === false) return null;

  const lower = String(text || "").toLowerCase();
  const hasBuildOrWriteIntent = /(?:oluştur|olustur|kur|yarat|tasarla|web\s*tasar|html|css|js|yaz|düzenle|duzenle|ekle|sil|taşı|tasi|yeniden\s*adlandır|adını\s*değiştir)/i.test(lower);
  const realProjects = await refreshDesktopProjectsCache();

  // Check if user explicitly mentions a known Desktop project by name (e.g. "lux_al", "lux_futures_xl", "al tasarım")
  const mentionedProj = !hasBuildOrWriteIntent && (realProjects || []).find(p => {
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

  const asksProjectsList = !hasBuildOrWriteIntent && /(projeler|projelerim|masaüstü|masaustu|desktop).*(neler|list|hangi|kaç|kac|göster|goster|klasör|klasor|dosya|var\s*mı)/i.test(lower);
  const asksFileListing = !hasBuildOrWriteIntent && /(dosya|klasör|klasor|dizin).*(kaç|kac|say|list|neler|isim|adları|adlari|hepsi|tümü|tumu|içer|icer)|(kaç|kac).*(dosya|klasör|klasor)|(listele|listesini\s*çık|listesini\s*cik).*(dosya|proje|klasör)/i.test(lower);

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
  const asksMemory = /(dün|dun|önceki|onceki|geçmiş|gecmis|eski\s*sohbet|daha\s*önce|hatırl|hatirl|ne\s*konuşt|konuşmuşt|konusmust)/i.test(lower);
  if (!asksMemory) return null;

  const { entries, yesterdayEntries } = collectSavedConversationMemory();
  const specificallyYesterday = /\bdün\b|\bdünkü\b|\bdünü\b|\bdünün\b/i.test(lower);

  if (specificallyYesterday) {
    if (yesterdayEntries.length > 0) {
      const list = yesterdayEntries.map(e => `- [${e.dateTag} · ${e.projName}] "${e.title}": ${e.snippet}`).join("\n");
      return `[Hafıza Kontrol Sonucu — Dünkü Kayıtlı Sohbet]\nDün konuşulanlar:\n${list}\nYukarıdaki konuyu ve içeriği akıcı, kısa bir sohbet cümlesiyle dostça anlat.`;
    }
    return `[Hafıza Kontrol Sonucu: Düne ait kayıtlı sohbet YOK (0 kayıt).]\nKullanıcıya düne ait kayıtlı bir sohbet bulunmadığını tek kısa, samimi ve dürüst bir cümleyle söyle (ör. 'Hafıza çekmecesine baktım ama düne ait bir sohbet kaydı yok valla!').`;
  }

  if (entries.length === 0) {
    return `[Hafıza Kontrol Sonucu: Geçmişe ait mesaj içeren başka sohbet kaydı YOK.]\nYönerge: Dürüst ve sıcak 'sen' diliyle kayıt olmadığını söyle.`;
  }

  const list = entries.slice(0, 4).map(e => `- [${e.dateTag} · ${e.projName}] Konu: "${e.title}" | Konuşulanlar: ${e.snippet}`).join("\n");
  return `[Hafıza Kontrol Sonucu — Kayıtlı Sohbetler]\n${list}\nYönerge: Bu gerçek kayıtlara göre samimi 'sen' diliyle yanıt ver.`;
}

function naturalizeConversationalTurkish(rawReply, userPrompt = "", history = [], opts = {}) {
  let reply = String(rawReply || "").trim();
  if (!reply) return reply;

  const recentUserText = [
    ...(Array.isArray(history) ? history.slice(-8).filter(m => m.role === "user").map(m => m.content || "") : []),
    String(userPrompt || "")
  ].join("\n").toLowerCase();
  const strictlyAvoidFormal = /(?:^|\s)size\b.*?(kullanma|deme|söyleme|yasak|istemiyorum)|resmi\s*(konuşma|olma)/i.test(recentUserText);

  // Preserve code blocks, inline code, and URLs verbatim
  const slots = [];
  const stash = (match) => {
    const token = `__LUX_CODE_SLOT_${slots.length}__`;
    slots.push(match);
    return token;
  };
  let text = reply
    .replace(/```[\s\S]*?```/g, stash)
    .replace(/(?:(?:Anlad[ıi]m|Tamam|Tamamd[ıi]r|Anla[şs][ıi]ld[ıi]|Peki)[,!.]?\s*)?(?:o\s+kelimeyi|["'`‘’“”]?size["'`‘’“”]?\s+kelimesini)\s+(?:artık\s+|bir\s+daha\s+)?(?:kullanmayacağım|kullanmam|kullanmamaya\s+çalışacağım|demeyeceğim)[^.!?\n]*[.!]?\s*/gi, "Anlaştık, bundan sonra sadece samimi 'sen' modundayız! ")
    .replace(/(?:sadece|artık)\s+["'`‘’“”]?size["'`‘’“”]?\s+modu(nda|nday[ıi]z|nday[ıi]m|na)/gi, "sadece 'sen' modu$1")
    .replace(/`[^`\n]+`/g, stash)
    .replace(/(?:https?|file):\/\/[^\s)\]]+/gi, stash);

  // Strip canned customer-support boilerplate
  text = text
    .replace(/Ben\s+bir\s+yapay\s+zeka\s+(?:asistanıyım|modeliyim)[^.!?\n]*[.!?]?\s*/gi, "")
    .replace(/(?:Başka\s+bir\s+(?:konuda|şeyde)\s+yardım(?:cı\s+olabileceğim|a\s+ihtiyacınız)[\s\S]{0,60}?[.?!]\s*)/gi, "")
    .replace(/(?:Başka\s+)?(?:Bugün|Şimdi|Hemen)\s+(?:sana|size)\s+nasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(/(?:Başka\s+)?(?:Sana|Size)\s+nasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(/(?:Başka\s+)?\bNasıl\s+yardımcı\s+olabilirim\??/gi, "")
    .replace(/(?:Samimiyetle(?:[,:]\s*|\s+)(?:(?:sana|size|bunları|bu\s+bilgileri)\s+){0,3}(?:aktardım|paylaştım|anlattım|ilettim)|(?:Bu|Bunları)\s+bilgileri\s+aktardım)[.!]?\s*/gi, "")
    .replace(/\s*(?:Başka\s+(?:bir\s+)?(?:konu|soru|şey)\s+var\s+mı)\??\s*$/gi, "")
    .replace(/^(?:Elbette|Tabii\s+ki|Memnuniyetle)[,!.:\s]+(?:size|sana)\s+/i, "Tabii, ")
    .replace(/^(?:Elbette|Memnuniyetle)[,!.:\s]+/i, "Tabii, ")
    .replace(/^\s*Anladın([,!.\s]+(?:bundan\s+sonra|artık|sadece))/gi, "Anladım$1")
    .replace(/Hangi\s+projeye[^.?\n]*\??\s*Lütfen\s+projenin\s+adını\s+paylaşın[.!]?/gi, "")
    .replace(/Lütfen\s+([^\n.!?]+?)\s+paylaşın[.!]?/gi, "$1 yazabilirsin.");

  const hasAbsenceCue = /(?:düne\s+ait|kayıt(?:tan)?|sohbet(?:ten)?)\s*(?:[^.!?\n]{0,40})(?:çıkmadı|yok|bulunamad|emin\s+olamad|göremiyorum|rastlamadım)/i.test(text);
  if (/\bhatırlıyorum\b/i.test(text) && (opts?.noYesterdayMemory || hasAbsenceCue)) {
    text = text
      .replace(/^[^.!?\n]*\bhatırlıyorum\b[^.!?\n]*[.!?]\s*/gi, "")
      .replace(/^[^.!?\n]*\bhatırlıyorum\b[,;:\s]*(?:ama|fakat|ancak)?\s*/gi, "")
      .trim();
    if (!text || /\bhatırlıyorum\b/i.test(text)) {
      text = "Hafıza çekmecesine baktım ama düne ait bir sohbet kaydı çıkmadı valla! Sıfırdan devam edelim mi?";
    }
  }

  // Systematic 2nd-person plural Turkish verb/pronoun conversion -> warm singular "sen"
  const replacements = [
    [/\bsizlerle\b/gi, (m) => m[0] === "S" ? "Seninle" : "seninle"],
    [/\bsizinle\b/gi, (m) => m[0] === "S" ? "Seninle" : "seninle"],
    [/\bsizlere\b/gi, (m) => m[0] === "S" ? "Sana" : "sana"],
    [/\bsizlerin\b/gi, (m) => m[0] === "S" ? "Senin" : "senin"],
    [/\bsizden\b/gi, (m) => m[0] === "S" ? "Senden" : "senden"],
    [/\bsizde\b/gi, (m) => m[0] === "S" ? "Sende" : "sende"],
    [/\bsizin\b/gi, (m) => m[0] === "S" ? "Senin" : "senin"],
    [/\bsizce\b/gi, (m) => m[0] === "S" ? "Sence" : "sence"],
    [/\bsizi\b/gi, (m) => m[0] === "S" ? "Seni" : "seni"],
    [/\bsiz\b/gi, (m) => m[0] === "S" ? "Sen" : "sen"],
    [/\bkonuşmanızı\b/gi, (m) => m[0] === "K" ? "Konuşmanı" : "konuşmanı"],
    [/\bkonuşmanız\b/gi, (m) => m[0] === "K" ? "Konuşman" : "konuşman"],
    [/\bprojenizi\b/gi, (m) => m[0] === "P" ? "Projeni" : "projeni"],
    [/\bprojeniz\b/gi, (m) => m[0] === "P" ? "Projen" : "projen"],
    [/\bihtiyacınız\b/gi, (m) => m[0] === "İ" ? "İhtiyacın" : "ihtiyacın"],
    [/\bisteğiniz\b/gi, (m) => m[0] === "İ" ? "İsteğin" : "isteğin"],
    [/\bnasılsınız\b/gi, (m) => m[0] === "N" ? "Nasılsın" : "nasılsın"],
    [/\bmisiniz\b/gi, (m) => m[0] === "M" ? "Misin" : "misin"],
    [/\bmısınız\b/gi, (m) => m[0] === "M" ? "Mısın" : "mısın"],
    [/\bmusunuz\b/gi, (m) => m[0] === "M" ? "Musun" : "musun"],
    [/\bmüsünüz\b/gi, (m) => m[0] === "M" ? "Müsün" : "müsün"],
    [/\bisterseniz\b/gi, (m) => m[0] === "İ" ? "İstersen" : "istersen"],
    [/\bbelirtir\s+misin\b/gi, (m) => m[0] === "B" ? "Söyler misin" : "söyler misin"],
    [/\bpaylaşın\b/gi, (m) => m[0] === "P" ? "Paylaş" : "paylaş"],
    [/\bbelirtin\b/gi, (m) => m[0] === "B" ? "Söyle" : "söyle"],
    [/([a-zçğıöşü]+(?:ebil|abil)ecek)siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:ebil|abil)ir)siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:ecek|icek|ücek))siniz\b/gi, "$1sin"],
    [/([a-zçğıöşü]+(?:acak|ıcak|ucak))sınız\b/gi, "$1sın"],
    [/([a-zçğıöşü]+[ıiuü]yor)sunuz\b/gi, "$1sun"],
    [/([a-zçğıöşü]+[ıiuü]yor)sanız\b/gi, "$1san"],
    [/\b([aA])lanınız(da|dan|a|ı)?\b/g, "$1lanın$2"],
    [/\b([dD])osyalarınız(da|dan|a|ı)?\b/g, "$1osyaların$2"],
    [/\b([çÇ])alışmalarınız(da|dan|a|ı)?\b/g, "$1alışmaların$2"],
    [/\b([kK])aydınız(da|dan|a|ı|e)?\b/g, "$1aydın$2"],
    [/\b([sS])ohbetiniz(de|den|e|i)?\b/g, "$1ohbetin$2"],
    [/\b([mM])esajınız(da|dan|a|ı)?\b/g, "$1esajın$2"],
    [/\bteyit\s+edebilirim\b/gi, "net görebiliyorum"],
    [/\bbulunmaktaydı\b/gi, "var"],
    [/\bbulunmaktadır\b/gi, "var"],
    [/\bgöstermektedir\b/gi, "gösteriyor"],
    [/\biçermektedir\b/gi, "içeriyor"],
    [/\bsahiptir\b/gi, "sahip"]
  ];
  for (const [rx, rep] of replacements) {
    text = text.replace(rx, rep);
  }

  // Convert standalone Turkish "size" (avoid hyphenated/English "file size", "font-size", etc.)
  text = text.replace(/(^|[\s([{"'“‘—–])(size)(?=[,;:.!?)\]"'”’\s]|$)/gi, (full, pre, word, offset) => {
    const prevSlice = text.slice(Math.max(0, offset - 12), offset).toLowerCase();
    if (/(?:file|font|max|min|page|step|chunk|batch|byte|pixel|screen|buffer)\s*$/i.test(prevSlice) && !strictlyAvoidFormal) {
      return full;
    }
    return pre + (word[0] === "S" ? "Sana" : "sana");
  });

  // Fix awkward pronoun combos and leaked instruction phrases
  text = text
    .replace(/^\s*(?:Sen|Sana)\s+(?:şu\s+)?(?:klasör(?:leri|ler)|dosyaları|bilgileri)[^\n:.]{0,60}(?:listele|aktar|özetle|paylaş)[:：]?\s*/i, "")
    .replace(/\b[Ss]ana\s+ile\b/g, (m) => m[0] === "S" ? "Seninle" : "seninle")
    .replace(/\n*Bu\s+(?:dosyaların\s+isimlerini|bilgileri)[^\n.]*?'sen'\s+diliyle[^\n.]*[.!]?/gi, "");

  // Clean stray multiple spaces, robotic "Sen, " openings, or orphan prefixes after stripping filler
  text = text
    .replace(/^\s*(?:Sen|Siz),\s+/gi, "")
    .replace(/([.!?\n]\s+)(?:Sen|Siz),\s+/gi, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(?:Tabii(?:\s+ki)?|Elbette|Memnuniyetle|Tamam)[,!.:\s]*$/i, "")
    .replace(/^\s*[,;:.!?]+\s*/, "")
    .trim();

  if (text && /^[a-zçğıöşü]/.test(text)) {
    text = text[0].toLocaleUpperCase("tr-TR") + text.slice(1);
  }

  if (!text) {
    if (opts?.hasMedia) {
      return "İstediğin görseli hazırlayıp hemen aşağıya bıraktım, üzerine tıklayıp büyütebilirsin 🎨";
    }
    if (opts?.hasCreatedFiles) {
      return "Dosyalarını oluşturup diske kaydettim! Aşağıdaki butonlardan tarayıcıda önizleyebilir ya da editörde açabilirsin 🚀";
    }
    if (opts?.hasLullaby) {
      return "Mışıl mışıl tatlı rüyalar, ninni müziğini başlattım 🌙";
    }
    text = "Buradayım! Ne kurcalıyoruz, dökül bakalım 😄";
  }

  return text.replace(/__LUX_CODE_SLOT_(\d+)__/g, (_, i) => slots[Number(i)] || "");
}

function getActiveModel() {
  const models = window.appStore.getModels();
  if (!Array.isArray(models) || models.length === 0) return null;
  const selectedName = window.appStore.state.selectedModel;
  let model = models.find(m => m.name === selectedName);
  if (!model && (selectedName === "9rputer" || selectedName === "9Router")) {
    model = models.find(m => m.name === "9Router" || m.name === "9rputer");
  }
  if (!model) model = models.find(m => m.isDefault);
  if (!model && models.length > 0) model = models[0];
  return model || null;
}

function createRequestAbortHelper(timeoutMs = 45000) {
  const controller = new AbortController();
  currentAbortController = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { controller.abort(new DOMException("Zaman aşımı", "TimeoutError")); } catch (_) { controller.abort(); }
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (currentAbortController === controller) {
        currentAbortController = null;
      }
    }
  };
}

function isUserCancelledError(err) {
  return !window.isGenerating || (err && err.name === "AbortError");
}

function isLocalModelEndpoint(model) {
  const ep = String(model?.endpoint || "");
  return /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(ep) || model?.provider === "Ollama / Yerel";
}

async function callSingleModel(model, text, messages, assistantMsg) {
  const perms = window.appStore?.getPermissions?.() || {};
  const isLocal = isLocalModelEndpoint(model);
  if (isLocal && perms.network_localhost === false) {
    throw new Error("Yerel ağ izni (network_localhost) kapatılmış");
  }
  if (!isLocal && perms.network_internet === false) {
    throw new Error("İnternet erişim izni (network_internet) kapatılmış");
  }

  const isOpenRouter = model?.provider === "OpenRouter" || /openrouter\.ai/i.test(model?.endpoint || "");
  const effectiveKey = (model?.apiKey || "").trim() || (isOpenRouter ? (window.appStore?.getOpenRouterApiKey?.() || "") : "");
  const isMockKey = effectiveKey && (effectiveKey.includes("demoKey") || effectiveKey.includes("••••"));

  if ((!isLocal && !effectiveKey) || (!effectiveKey && !model?.endpoint) || isMockKey) {
    throw new Error("Yapılandırılmış gerçek API anahtarı yok");
  }

  const resolvedModel = (effectiveKey && !model.apiKey) ? { ...model, apiKey: effectiveKey } : model;

  if (resolvedModel.provider === "Google Gemini") {
    return await callGeminiWithAgentLoop(resolvedModel, text, messages, assistantMsg);
  } else if (resolvedModel.provider === "Anthropic") {
    return await callAnthropicWithAgentLoop(resolvedModel, text, messages, assistantMsg);
  } else {
    return await callOpenAICompatibleAPI(resolvedModel, text, messages, assistantMsg);
  }
}

window.__openrouterCooldownUntil = window.__openrouterCooldownUntil || new Map();

function classifyModelApiError(err, activeModel) {
  const msg = String(err?.message || "");
  let status = Number(err?.status) || 0;
  if (!status) {
    const m = msg.match(/\bHTTP\s*(\d{3})\b/i);
    if (m) status = Number(m[1]);
  }
  const isOpenRouter = activeModel?.provider === "OpenRouter" || /openrouter\.ai/i.test(activeModel?.endpoint || "");
  const isMissingKey = msg === "Yapılandırılmış gerçek API anahtarı yok" || msg === "API Anahtarı eksik";
  const isPermissionBlocked = /izni\s*\([^)]+\)\s*kapatılmış/i.test(msg);
  const isDailyOrCreditQuota = /free-models-per-day|daily\s*limit|credits|insufficient|quota.*exhausted/i.test(msg);
  const isRateLimit = status === 429 || /rate.?limit/i.test(msg);
  const isAuthOrBilling = status === 401 || status === 402 || status === 403 || /invalid.*api.?key|unauthorized|authentication/i.test(msg);
  const isRetiredOrMissingModel = status === 404 || /no endpoints found|not found|does not exist|deprecated|shut down|retired/i.test(msg);
  const isTimeout = /zaman aşımı|timeout/i.test(msg);

  return {
    status,
    msg,
    isOpenRouter,
    isMissingKey,
    isPermissionBlocked,
    isDailyOrCreditQuota,
    isRateLimit,
    isAuthOrBilling,
    isRetiredOrMissingModel,
    isTimeout
  };
}

function formatModelApiErrorMessage(err, activeModel) {
  const info = classifyModelApiError(err, activeModel);
  const modelLabel = activeModel?.name || "Seçili model";
  const modelIdTag = activeModel?.modelId ? ` (\`${activeModel.modelId}\`)` : "";

  if (info.isPermissionBlocked) {
    return `⚠ İşlem güvenlik izni nedeniyle durduruldu: \`${info.msg}\`. **Ayarlar → İzinler** bölümünden kontrol edebilirsin.`;
  }
  if (info.isMissingKey) {
    return `⚠ **${modelLabel}** seçili ama API anahtarı henüz girilmemiş. **Ayarlar → Modeller**'den anahtarını ekleyebilir ya da sol alttan yerel **Ollama** modeline geçebilirsin.`;
  }
  if (info.isRateLimit && info.isOpenRouter && info.isDailyOrCreditQuota) {
    return `⚠ **${modelLabel}**${modelIdTag} ücretsiz günlük istek limitine (**HTTP 429**) ulaştı (OpenRouter free katmanı: günde 50 istek).\n\nSol alttan yerel **Ollama** veya **Google Gemini** modeline geçebilir ya da OpenRouter hesabına bakiye ekleyebilirsin.`;
  }
  if (info.isRateLimit) {
    return `⚠ **${modelLabel}**${modelIdTag} istek sınırına (**HTTP 429 — Rate Limit**) takıldı: \`${info.msg}\`. Kısa süre bekleyip tekrar deneyebilir veya sol alttan başka bir model seçebilirsin.`;
  }
  if (info.isAuthOrBilling) {
    const codeStr = info.status ? `HTTP ${info.status}` : "Yetkilendirme";
    return `⚠ **${modelLabel}** bağlantı hatası (**${codeStr}**): \`${info.msg}\`. **Ayarlar → Modeller** kısmından API anahtarını/bakiyeni kontrol et.`;
  }
  if (info.isRetiredOrMissingModel) {
    return `⚠ Seçili model**${modelIdTag}** sağlayıcı tarafında bulunamadı veya kullanımdan kaldırıldı (**HTTP 404**): \`${info.msg}\`. **Ayarlar → Modeller**'den güncel bir model seçebilirsin.`;
  }
  if (info.isTimeout) {
    return `⚠ **${modelLabel}**${modelIdTag} yanıt süresi sınırını aştı (**Zaman Aşımı**). Bağlantını kontrol edip tekrar deneyebilir ya da daha hızlı bir model seçebilirsin.`;
  }
  const codeBadge = info.status ? ` (**HTTP ${info.status}**)` : "";
  return `⚠ **${modelLabel}**${modelIdTag} şu an yanıt veremedi${codeBadge}: \`${info.msg || "Bilinmeyen bağlantı hatası"}\`.`;
}

async function callModelWithFallback(activeModel, text, messages, assistantMsg) {
  if (!activeModel) {
    return "Şu an kayıtlı veya seçili bir LLM modelin yok. Ayarlar → Modeller üzerinden istediğin bir modeli ekleyip seçebilirsin.";
  }
  try {
    return await callSingleModel(activeModel, text, messages, assistantMsg);
  } catch (err) {
    if (isTurnCanceled(assistantMsg) || (err?.name === "AbortError")) {
      throw err;
    }

    const errInfo = classifyModelApiError(err, activeModel);
    console.warn(`Primary model (${activeModel.name}) failed [${errInfo.status || "ERR"}]:`, err.message);

    const autoHealEnabled = window.appStore?.state?.general?.autoHeal !== false;
    const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
    const shouldTryLocalFallback = !isVoiceTurn
      && !errInfo.isRateLimit
      && !errInfo.isAuthOrBilling
      && !errInfo.isPermissionBlocked
      && (autoHealEnabled || errInfo.isMissingKey);

    // Text mode only: fall back to warm/configured local Ollama if cloud endpoint is unreachable or key isn't set yet
    if (shouldTryLocalFallback) {
      const models = window.appStore?.getModels() || [];
      const localModel = models.find(m =>
        (m.provider === "Ollama / Yerel" || m.name.includes("Ollama") || m.endpoint?.includes("11434") || m.endpoint?.includes("1234")) &&
        m.id !== activeModel.id &&
        (m.status === "success" || m.endpoint?.includes("11434"))
      );

      if (localModel) {
        try {
          console.log(`⚡ Antigravity Auto-Fallback: Switching to ${localModel.name} (${localModel.modelId})`);
          if (assistantMsg) {
            assistantMsg.__streamReset?.();
            assistantMsg.modelName = `${localModel.name} (Otomatik Yedek)`;
            assistantMsg.stepLabel = `⚡ ${activeModel.name} erişilemedi, yerel ${localModel.name} modeline geçildi.`;
            renderChat();
          }
          return await callSingleModel(localModel, text, messages, assistantMsg);
        } catch (fallbackErr) {
          if (isTurnCanceled(assistantMsg) || fallbackErr?.name === "AbortError") {
            throw fallbackErr;
          }
          console.warn("Fallback model also failed:", fallbackErr.message);
        }
      }
    }

    // Surface honest, actionable API error instead of masking with "model seç"
    if (assistantMsg) {
      assistantMsg.__streamReset?.();
      assistantMsg.__apiError = {
        status: errInfo.status || 0,
        message: errInfo.msg,
        modelName: activeModel.name,
        modelId: activeModel.modelId || ""
      };
      assistantMsg.content = "";
      assistantMsg.stepLabel = `⚠ ${activeModel.name} hatası${errInfo.status ? ` (HTTP ${errInfo.status})` : ""}`;
    }
    return formatModelApiErrorMessage(err, activeModel);
  }
}

function cleanTextForSpeech(text) {
  if (!text) return "";
  let clean = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/```[\s\S]*?```/g, "kod bloğu")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove keycap emojis, flag sequences, Unicode emojis, pictographs, dingbats, arrows & decorative symbols
    .replace(/[0-9#*]\uFE0F?\u20E3/g, " ")
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, " ")
    .replace(/[\p{Extended_Pictographic}\u2600-\u27BF\u{1F000}-\u{1FAFF}\u231A-\u23FA\u25A0-\u25FF\u2B00-\u2BFF\u2190-\u21FF]/gu, " ")
    .replace(/[\u200D\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}©®™•●▪▫▸▹◆◇★☆✓✔✕✖✗✘⚠⚡]/gu, " ")
    // Remove ASCII emoticons & text smileys (without touching timestamps like 21:17 or URLs)
    .replace(/(^|[\s([{"'“‘])(?:[:;=8]['’`]?[-o*^]?[)(DPpOo3\\/|*><]+|[xX][-o*']?[DPp)(]+|<\/?3|\^\^|>_<|\^_+\^|-_+-|[Tt]_[Tt]|[Oo]_[Oo])(?=$|[\s.,!?)\]}"'”’])/g, "$1")
    .replace(/\s*(?:<-+|-+>|=+>|<=+)\s*/g, " ")
    .replace(/[*#_~>]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/([.!?])\1{2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[.!?,;:\s-]+/, "")
    .trim();

  if (text.includes("FreeUsageLimitError") || text.includes("API Yanıtı / Hata")) {
    return "Seçili model bağlantısında kota sınırı veya erişim hatası oluştu. Lütfen sol alttan farklı bir model seç.";
  }

  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (sentences.length > 7) {
    clean = sentences.slice(0, 7).join(" ").trim();
  }
  if (clean.length > 440) {
    clean = clean.slice(0, 440).trim() + "...";
  }
  return clean;
}
window.cleanTextForSpeech = cleanTextForSpeech;

function splitSpeechSentencesForStreaming(text) {
  const clean = cleanTextForSpeech(text);
  if (!clean) return [];
  const rawSentences = clean.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
  if (rawSentences.length <= 1) return [clean];

  const chunks = [];
  let buf = "";
  for (const sent of rawSentences) {
    const combined = buf ? `${buf} ${sent}` : sent;
    if (!buf) {
      buf = sent;
    } else if (buf.length < 48 || combined.length <= 135) {
      buf = combined;
    } else {
      chunks.push(buf);
      buf = sent;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length > 0 ? chunks : [clean];
}
window.splitSpeechSentencesForStreaming = splitSpeechSentencesForStreaming;

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

function extractCleanMediaQuery(text, mode = "search") {
  let q = String(text || "").trim();
  if (!q) return "modern aesthetic design";

  if (q.includes(" ve ")) {
    const clauses = q.split(/\s+ve\s+/i);
    if (mode === "design") {
      const hit = clauses.find(c => /(tasarla|çiz|ciz|üret|uret|logo|afiş|poster|ikon|wallpaper|illüstrasyon|kapak)/i.test(c));
      if (hit) q = hit;
    } else {
      const hit = clauses.find(c => /(bul|getir|göster|ara|fotoğraf|fotograf|araba|marka|resim|resmi)/i.test(c));
      if (hit) q = hit;
    }
  }

  q = q
    .replace(/\b(?:bana|dostum|lütfen|lutfen|hadi|şimdi|hemen|internetten|internet'ten|webden|web'den|bul|getir|göster|goster|ara|tasarla|çiz|ciz|üret|uret|oluştur|olustur|hazırla|hazirla|yapar mısın|yap|marka|bir|bi|şu|su|resmini|resmi|resimler|resim|fotoğrafını|fotoğrafı|fotoğraf|fotograf|görselini|görseli|görsel|gorsel|tarzda|tarzında|stilde)\b/gi, " ")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return q.length >= 3 ? q : String(text || "").trim().slice(0, 120);
}

function isWipeMemoryPrompt(userText) {
  const lower = String(userText || "").trim().toLowerCase();
  if (!lower || lower.length > 160) return false;
  if (/(?:klasör|klasor|dosya)\s*(?:oluştur|olustur|aç|ac)/i.test(lower)) return false;
  if (/(?:dosya|klasör|klasor|masaüstü|masaustu|desktop|\.[a-z0-9]{1,5}\b)/i.test(lower) && !/(?:hafıza|hafiza|geçmiş|gecmis|bellek)/i.test(lower)) {
    return false;
  }
  return /(?:haf[ıi]za(?:n[ıi]|s[ıi]n[ıi]|y[ıi])?|belle[gğ]i(?:n[ıi])?|sohbet\s*ge[çc]mi[şs]i(?:ni)?|(?:tan[ıi]ml[ıi]|eski|t[üu]m)\s*verileri(?:ni)?)\s*(?:s[ıi]f[ıi]rdan\s*)?(?:sil|temizle|s[ıi]f[ıi]rla|yok\s*et)|s[ıi]f[ıi]rdan\s*(?:haf[ıi]za(?:n[ıi]|s[ıi]n[ıi]|y[ıi])?)\s*(?:sil|temizle|s[ıi]f[ıi]rla)/i.test(lower);
}

function detectRequestedBaseDir(userText) {
  const lower = String(userText || "").toLowerCase();
  if (/(?:masaüstü(?:nü|ne|nde|m|me|mde|ndeki|deki)?|masaustu(?:ne|nde|m|me|mde|ndeki)?|desktop(?:['’]?(?:a|e|ta|te|da|de|taki|deki))?)/i.test(lower)) {
    return "Desktop";
  }
  if (/(?:belgeler(?:ime|imde|e|de|deki|i)?|documents)/i.test(lower)) {
    return "Documents";
  }
  if (/(?:indirilenler(?:e|de|deki|i)?|downloads)/i.test(lower)) {
    return "Downloads";
  }
  if (/(?:resimler(?:e|de|deki|im|ime|imde|i)?|pictures)/i.test(lower)) {
    return "Pictures";
  }
  return "";
}

function stripLeadingLocationAndFillers(text) {
  let out = String(text || "").trim();
  const rx = /^(?:(?:lütfen|lutfen|dostum|hemen|şimdi|simdilik|bana|hadi|lütfen\s+bana|bi|bir|yeni|ve|ile|da|de)\s+|(?:masaüstü(?:nü|ne|nde|m|me|mde|ndeki)?|masaustu(?:ne|nde|m|me|mde|ndeki)?|desktop(?:['’]?(?:a|e|ta|te|da|de))?|belgeler(?:ime|imde|e|de)?|documents|indirilenler(?:e|de)?|downloads|resimler(?:e|de|im)?|pictures|çalışma\s*alan[ıi]na)\s+)+/i;
  let prev;
  do {
    prev = out;
    out = out.replace(rx, "").trim();
  } while (out !== prev);
  return out.replace(/^(?:ve|ile|de|da|bir|yeni|diye)\s+/i, "").trim();
}

function sanitizeLocalEntryName(rawName) {
  return String(rawName || "")
    .trim()
    .replace(/^["'`‘’“”]+|["'`‘’“”]+$/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^(?:bir|yeni)\s+/i, "")
    .replace(/\s+(?:olsun|olarak)$/i, "")
    .trim();
}

function extractFolderCreationRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (!/(?:klasör|klasor|dizin)/i.test(lower)) return null;
  if (/(?:listele|say|kaç|kac|neler|hangi|sil|kaldır|kaldir|taşı|tasi|adını\s*değiştir|adini\s*degistir|yeniden\s*adlandır|yeniden\s*adlandir)/i.test(lower)) {
    return null;
  }

  const hasExplicitOpenExisting = /(?:klasör(?:ü|ünü|unu|ini)|dizini)\s*(?:aç|ac|göster|goster)(?:\s|$|[.!?])/i.test(lower)
    && !/(?:oluştur|olustur|yarat|kur|ekle|diye|adlı|adli|adında|adinda|isminde)/i.test(lower);
  if (hasExplicitOpenExisting) return null;

  const hasCreateVerb = /(?:oluştur|olustur|yarat|kur|ekle)/i.test(lower)
    || /(?:diye|adlı|adli|adında|adinda|isminde)\s+(?:bir\s+|yeni\s+)?klasör(?:ü)?\s*(?:aç|ac)/i.test(lower)
    || /(?:masaüstü(?:ne|me)|masaustu(?:ne|me)|belgelere|indirilenlere|desktop['’]?a|[a-zA-Z]:[\\/]).*\bklasör(?:ü)?\s*aç/i.test(lower);
  if (!hasCreateVerb) return null;

  if (/\bdosya(?:sı|sını|sini|yı|yi)?\b/i.test(lower) && /\.[a-z0-9]{1,8}\b/i.test(lower)) {
    return null;
  }

  const stopwords = new Set(["bir", "yeni", "güzel", "guzel", "modern", "basit", "küçük", "kucuk", "harika", "özel", "ozel", "boş", "bos", "isimli", "adlı", "adli", "adında", "adinda", "isminde", "diye", "klasör", "klasor", "klasörü", "klasoru", "dizin", "dizini", "masaüstü", "masaüstüne", "masaüstünde", "masaustune", "masaustunde", "desktop", "belgelere", "indirilenlere", "olsun"]);

  const explicitAbs = raw.match(/([a-zA-Z]:[\\/][^\n"'*?<>|]{1,120}?)(?=\s+(?:diye|adlı|adli|adında|adinda|isminde|klasör|klasor|oluştur|olustur|kur|yarat|aç|ac)|$)/i);
  if (explicitAbs && explicitAbs[1]) {
    const absPath = explicitAbs[1].trim().replace(/[.,!?]+$/, "");
    const folderName = absPath.split(/[\\/]/).filter(Boolean).pop() || absPath;
    return {
      baseDir: "",
      folderName,
      dirPath: absPath,
      displayLocation: absPath
    };
  }

  const baseDir = detectRequestedBaseDir(raw);
  const locationLabel = baseDir === "Desktop"
    ? "Masaüstüne"
    : (baseDir === "Documents"
      ? "Belgelerim klasörüne"
      : (baseDir === "Downloads" ? "İndirilenler klasörüne" : (baseDir === "Pictures" ? "Resimlerim klasörüne" : "Çalışma alanına")));

  let folderName = "";

  const quotedRx = /["'`]([^"'`\\/:*?"<>|\n]{1,60})["'`]\s*(?:diye|adlı|adli|isminde|adında|adinda)?\s*(?:bir\s+|yeni\s+)?(?:klasör|klasor|dizin)/i;
  const qm = raw.match(quotedRx);
  if (qm && qm[1]) {
    const candidate = sanitizeLocalEntryName(qm[1]);
    if (candidate && !stopwords.has(candidate.toLowerCase())) {
      folderName = candidate;
    }
  }

  if (!folderName) {
    const namedSuffixRx = /([\wçğıöşüÇĞIİÖŞÜ._-]+(?:\s+[\wçğıöşüÇĞIİÖŞÜ._-]+){0,3})\s+(?:diye|adlı|adli|adında|adinda|isminde)\s+(?:bir\s+|yeni\s+)?(?:klasör|klasor|dizin)/i;
    const nm = raw.match(namedSuffixRx);
    if (nm && nm[1]) {
      const stripped = sanitizeLocalEntryName(stripLeadingLocationAndFillers(nm[1]));
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    const beforeFolderRx = /([\wçğıöşüÇĞIİÖŞÜ._-]+(?:\s+[\wçğıöşüÇĞIİÖŞÜ._-]+){0,2})\s+(?:klasör(?:ü|ünü|unu|ini|u)?|dizini)\s*(?:oluştur|olustur|yarat|kur|aç|ac)/i;
    const bm = raw.match(beforeFolderRx);
    if (bm && bm[1]) {
      const stripped = sanitizeLocalEntryName(stripLeadingLocationAndFillers(bm[1]));
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    const afterNameRx = /(?:klasör(?:ün)?|dizinin)\s*(?:adı|adi|ismi)\s*[:=]?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+(?:\s+[a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+){0,2})["'`]?/i;
    const am = raw.match(afterNameRx);
    if (am && am[1]) {
      const stripped = sanitizeLocalEntryName(am[1]);
      if (stripped && !stopwords.has(stripped.toLowerCase())) {
        folderName = stripped;
      }
    }
  }

  if (!folderName) {
    if (/(?:oluştur|olustur|yarat|kur)/i.test(lower) && (baseDir || /\byeni\s+(?:bir\s+)?klasör\b/i.test(lower))) {
      folderName = "Yeni Klasör";
    } else {
      return null;
    }
  }

  const dirPath = baseDir ? `${baseDir}/${folderName}` : folderName;
  return {
    baseDir,
    folderName,
    dirPath,
    displayLocation: locationLabel
  };
}

function extractFileWriteRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (!/(?:dosya|dosyası|dosyasını|dosyayı|\.txt|\.md|\.json|\.csv|\.py|\.js|\.html|\.css)/i.test(lower)) return null;
  if (/(?:sil|kaldır|taşı|tasi|oku|aç|ac\b|listele|adını\s*değiştir|yeniden\s*adlandır)/i.test(lower) && !/(?:oluştur|olustur|yaz|kaydet|ekle|yarat|kur)/i.test(lower)) {
    return null;
  }
  if (!/(?:oluştur|olustur|yaz|kaydet|yarat|kur|ekle)/i.test(lower)) return null;

  const baseDir = detectRequestedBaseDir(raw);
  let fileName = "";
  const extMatch = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]+\.(?:txt|md|json|csv|log|py|js|ts|html|css|xml|yaml|yml|ini|bat|ps1|sh))["'`]?/i);
  if (extMatch && extMatch[1]) {
    fileName = extMatch[1].replace(/[\\/:*?"<>|]/g, "-");
  } else {
    const quotedFile = raw.match(/["'`]([^"'`\\/:*?"<>|\n]{1,60})["'`]\s*(?:diye|adlı|adında|isminde)?\s*(?:bir\s+)?dosya/i);
    if (quotedFile && quotedFile[1]) {
      fileName = sanitizeLocalEntryName(quotedFile[1]);
    } else {
      const namedFile = raw.match(/([\wçğıöşüÇĞIİÖŞÜ._-]+)\s+(?:diye|adlı|adında|isminde)\s+(?:bir\s+)?dosya/i);
      if (namedFile && namedFile[1]) {
        const cleaned = sanitizeLocalEntryName(stripLeadingLocationAndFillers(namedFile[1]));
        if (cleaned) fileName = cleaned;
      }
    }
    if (fileName && !/\.[a-z0-9]{1,8}$/i.test(fileName)) {
      fileName += ".txt";
    }
  }
  if (!fileName) return null;

  let fileContent = "";
  const contentMatch = raw.match(/(?:içeriği|icerigi|içine|icine|metni)\s*[:=]?\s*["'`]([\s\S]+?)["'`](?:\s*(?:olsun|yaz)|$)/i)
    || raw.match(/(?:yaz|ekle)\s*[:=]\s*["'`]?([^\n"'`]+)["'`]?$/i);
  if (contentMatch && contentMatch[1]) {
    fileContent = contentMatch[1].trim();
  }

  let parentFolder = "";
  const parentMatch = raw.match(/(?:masaüstü(?:ne|nde)?|desktop)?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,50})["'`]?\s+klasör(?:üne|ünde|ünün\s*içine)\b/i);
  if (parentMatch && parentMatch[1] && !/^(?:masaüstü|masaustu|desktop|belgeler|indirilenler|yeni|bir)$/i.test(parentMatch[1])) {
    parentFolder = sanitizeLocalEntryName(parentMatch[1]);
  }

  const relDir = [baseDir, parentFolder].filter(Boolean).join("/");
  const filePath = relDir ? `${relDir}/${fileName}` : fileName;
  return {
    baseDir: relDir,
    fileName,
    filePath,
    content: fileContent
  };
}

function extractMoveOrRenameRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  const hasRenameVerb = /(?:adını\s*değiştir|adini\s*degistir|yeniden\s*adlandır|yeniden\s*adlandir|ismini\s*değiştir|adını\s+[^\n]+\s*yap)/i.test(lower);
  const hasMoveVerb = /(?:taşı|tasi)\b/i.test(lower);
  if (!hasRenameVerb && !hasMoveVerb) return null;

  const baseDir = detectRequestedBaseDir(raw);

  const renameMatch = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör(?:ünün|ünü|u)?|dosya(?:sının|sını|yı)?)\s*(?:adını|adini|ismini|isim)?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:olarak\s*(?:değiştir|yeniden\s*adlandır)|yap|değiştir|degistir)/i);
  if (renameMatch && renameMatch[1] && renameMatch[2]) {
    const srcName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(renameMatch[1]));
    const dstName = sanitizeLocalEntryName(renameMatch[2]);
    if (srcName && dstName) {
      const prefix = baseDir ? `${baseDir}/` : "";
      return { sourcePath: `${prefix}${srcName}`, destPath: `${prefix}${dstName}`, isRename: true };
    }
  }

  const moveMatch = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._/\\-]+)["'`]?\s*(?:klasörünü|dosyasını|klasörü|dosyayı)?\s*(masaüstü(?:ne)?|masaustu(?:ne)?|desktop['’]?a|belgelere|documents|indirilenlere|downloads)\s*(?:taşı|tasi)/i);
  if (moveMatch && moveMatch[1]) {
    const srcName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(moveMatch[1]));
    const dstBase = detectRequestedBaseDir(moveMatch[2]) || "Desktop";
    const srcBase = (srcName.includes("/") || srcName.includes("\\") || /^[a-zA-Z]:/.test(srcName)) ? "" : (baseDir === dstBase ? "" : (baseDir || "Desktop"));
    const sourcePath = srcBase ? `${srcBase}/${srcName}` : srcName;
    const baseName = srcName.split(/[\\/]/).pop();
    return { sourcePath, destPath: `${dstBase}/${baseName}`, isRename: false };
  }

  return null;
}

function extractDeleteRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (isWipeMemoryPrompt(raw)) return null;
  if (!/(?:\bsil\b|kaldır|kaldir|çöpe\s*at)/i.test(lower)) return null;
  if (!/(?:klasör|klasor|dosya|\.[a-z0-9]{1,8}\b)/i.test(lower)) return null;

  const baseDir = detectRequestedBaseDir(raw);
  const m = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör(?:ü|ünü|unu)?|dosya(?:sı|sını|yı)?)\s*(?:sil|kaldır|kaldir|çöpe\s*at)/i)
    || raw.match(/["'`]([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]\s*(?:sil|kaldır)/i);
  if (m && m[1]) {
    const targetName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(m[1]));
    if (targetName && !/^(?:bir|bu|şu|tüm|hepsi|hafıza|hafızayı|sohbet)$/i.test(targetName)) {
      const targetPath = baseDir ? `${baseDir}/${targetName}` : targetName;
      return { targetPath, targetName };
    }
  }
  return null;
}

function extractAppOrFolderOpenRequest(userText) {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();
  if (!/(?:^|[\s.,!?'"()\-])(?:aç(?:ar\s*mısın|sana|abilir\s*misin|alım)?|başlat|baslat|çalıştır|calistir|göster)(?=$|[\s.,!?'"()\-])/i.test(lower)) {
    return null;
  }
  // If prompt explicitly intends creating a new folder, don't treat as open_folder
  if (/(?:oluştur|olustur|yarat|kur|ekle)/i.test(lower) || /(?:diye|adlı|adında|isminde)\s+(?:bir\s+)?klasör/i.test(lower)) {
    return null;
  }

  const appRules = [
    [/hesap\s*makin(?:e|a)s?[ıiuü]?n?[ıiuü]?|\bcalc(?:ulator)?\b/i, "hesap makinesi"],
    [/not\s*defter(?:i|ini)?|\bnotepad\b/i, "not defteri"],
    [/görev\s*yöneticisi(?:ni)?|\btask\s*mgr\b|\btaskmgr\b/i, "görev yöneticisi"],
    [/windows\s*ayarlar[ıi]?|ayarlar[ıi]?(?:\s*aç|\s*başlat)/i, "ayarlar"],
    [/dosya\s*(?:gezgini|yöneticisi)(?:ni)?|\bexplorer\b/i, "explorer"],
    [/\bpaint(?:i|'i)?\b|\bmspaint\b/i, "paint"],
    [/\bpowershell(?:i|'i)?\b|\bterminal(?:i|'i)?\b/i, "powershell"],
    [/\bcmd(?:yi|'yi)?\b|komut\s*istemi(?:ni)?/i, "cmd"],
    [/google\s*chrome|\bchrome(?:u|'u)?\b/i, "chrome"],
    [/microsoft\s*edge|\bedge(?:'yi|yi)?\b|tarayıcı(?:yı|yi)?/i, "edge"],
    [/\bvs\s*code\b|\bvscode\b/i, "vscode"]
  ];
  for (const [rx, canonical] of appRules) {
    if (rx.test(lower)) {
      return { mode: "open_app", target: canonical };
    }
  }

  // Named folder on Desktop/Documents/Downloads/Pictures: "masaüstündeki BB klasörünü aç"
  const folderOpen = raw.match(/["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*klasör(?:ü|ünü|unu|ini)?\s*(?:aç|ac|göster)/i);
  if (folderOpen && folderOpen[1]) {
    const cleanName = sanitizeLocalEntryName(stripLeadingLocationAndFillers(folderOpen[1]));
    const baseDir = detectRequestedBaseDir(raw);
    if (cleanName && !/^(?:bir|yeni)$/i.test(cleanName)) {
      return { mode: "open_folder", target: baseDir ? `${baseDir}/${cleanName}` : cleanName };
    }
  }

  // Direct known folder open: "masaüstünü aç", "belgeleri aç", "indirilenleri aç"
  if (/masaüstü(?:nü|ne|mü)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Desktop" };
  if (/belgeler(?:im)?(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Documents" };
  if (/indirilenler(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Downloads" };
  if (/resimler(?:im)?(?:i|e)?\s*(?:aç|ac|göster)/i.test(lower)) return { mode: "open_folder", target: "Pictures" };

  return null;
}

function extractExplicitDesktopFolderName(userText) {
  const raw = String(userText || "");
  const stopwords = new Set(["bir", "yeni", "güzel", "guzel", "modern", "basit", "küçük", "kucuk", "harika", "özel", "ozel", "web", "site", "sitesi", "proje", "projesi", "içine", "icine", "diye", "klasör", "klasoru", "klasörü"]);

  const patterns = [
    /(?:masaüstü(?:nde|ne)?|masaustu(?:nde|ne)?|desktop['’]?(?:ta|da|te|de)?)\s+["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?\s*(?:klasör|adlı|isminde|adında|diye)/i,
    /klasör(?:ü|ün|ünde|üne)?\s*(?:adı|ismi)?\s*[:=]?\s*["'`]?([a-zA-Z0-9çğıöşüÇĞIİÖŞÜ._-]{1,60})["'`]?/i,
    /["'`]([a-zA-Z0-9_-]{1,50})["'`]\s*(?:klasör|projesi|dizini)/i
  ];
  for (const rx of patterns) {
    const m = raw.match(rx);
    if (m && m[1] && !stopwords.has(m[1].toLowerCase())) {
      return m[1].replace(/[\\/:*?"<>|]/g, "-");
    }
  }

  // Fallback topic slug from prompt words
  const topicWords = raw
    .toLowerCase()
    .replace(/masaüstü(?:nde|ne)?|masaustu(?:nde|ne)?|desktop|klasör(?:ü|ünü|ünde)?|oluşturup|oluştur|olustur|kur|yap|tasarla|içine|icine|modern|bir|ve|index\.html|style\.css|web|sitesi|tasarımı|sayfası/gi, " ")
    .replace(/[^a-z0-9çğıöşü\s-]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 3)
    .join("-")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");

  return topicWords ? `lux-${topicWords}-web` : "lux-web-projesi";
}

function buildStarterWebFiles(userText, folderName) {
  const topic = String(userText || "")
    .replace(/masaüstü(?:nde|ne)?|desktop|klasör(?:ü|ünü|ünde)?|oluşturup|oluştur|içine|kur|yap|tasarla/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || folderName;
  const titleText = escapeHtml(topic.slice(0, 64));

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleText} · Lux AI Studio</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">⚡ Lux Studio</div>
    <nav>
      <a href="#ozellikler">Özellikler</a>
      <a href="#galeri">Deneyim</a>
      <a href="#iletisim" class="cta-sm">Bize Ulaş</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <span class="badge">✨ Özel Tasarım</span>
      <h1>${titleText}</h1>
      <p>Antigravity gücündeki Lux AI tarafından sıfırdan tasarlanan modern, hızlı ve duyarlı web deneyimi.</p>
      <div class="actions">
        <a href="#ozellikler" class="btn-primary">Keşfetmeye Başla</a>
        <button id="theme-pulse-btn" class="btn-ghost" type="button">Atmosferi Değiştir</button>
      </div>
    </section>

    <section id="ozellikler" class="grid">
      <article class="card">
        <h3>Modern Arayüz</h3>
        <p>Cam efektli kartlar, akıcı geçişler ve göz yormayan koyu/sıcak renk dengesi.</p>
      </article>
      <article class="card">
        <h3>Duyarlı Tasarım</h3>
        <p>Masaüstü, tablet ve mobil ekranlara otomatik uyum sağlayan grid mimarisi.</p>
      </article>
      <article class="card">
        <h3>Anında Hazır</h3>
        <p>Temiz HTML5 ve CSS3 katmanı sayesinde hiçbir ek kurulum gerektirmeden çalışır.</p>
      </article>
    </section>

    <section id="galeri" class="showcase">
      <div class="showcase-box">
        <h2>Öne Çıkan Detaylar</h2>
        <p id="status-banner">Sayfa aktif — butonlara tıklayarak canlı etkileşimi test edebilirsin.</p>
      </div>
    </section>
  </main>

  <footer id="iletisim">
    <small>${escapeHtml(folderName)} · Lux AI ile oluşturuldu</small>
  </footer>

  <script>
    const btn = document.getElementById("theme-pulse-btn");
    const banner = document.getElementById("status-banner");
    let alt = false;
    btn?.addEventListener("click", () => {
      alt = !alt;
      document.body.classList.toggle("alt-accent", alt);
      if (banner) {
        banner.textContent = alt
          ? "Altın kehribar atmosfer modu etkinleştirildi!"
          : "Safir gece atmosfer moduna dönüldü.";
      }
    });
  </script>
</body>
</html>
`;

  const css = `:root {
  --bg: #0b0d14;
  --surface: #141824;
  --text: #f3f5f9;
  --muted: #98a2b8;
  --accent: #60a5fa;
  --accent-2: #a78bfa;
}
body.alt-accent {
  --accent: #f59e0b;
  --accent-2: #fb7185;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 40%), var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
.topbar {
  max-width: 1120px;
  margin: 0 auto;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand { font-weight: 700; font-size: 1.1rem; letter-spacing: 0.02em; }
nav { display: flex; gap: 20px; align-items: center; }
nav a { color: var(--muted); text-decoration: none; font-size: 0.92rem; transition: color .2s; }
nav a:hover { color: var(--text); }
.cta-sm {
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: var(--text);
}
main { max-width: 1120px; margin: 0 auto; padding: 48px 24px; }
.hero { max-width: 720px; padding: 36px 0 56px; }
.badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.35);
  color: var(--accent);
  font-size: 0.82rem;
  margin-bottom: 18px;
}
.hero h1 {
  font-size: clamp(2.1rem, 4.5vw, 3.4rem);
  line-height: 1.15;
  margin-bottom: 16px;
  background: linear-gradient(120deg, #fff, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  color: transparent;
}
.hero p { color: var(--muted); font-size: 1.05rem; margin-bottom: 28px; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
.btn-primary, .btn-ghost {
  padding: 12px 22px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  text-decoration: none;
  border: none;
  transition: transform .15s, opacity .2s;
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #090b10;
}
.btn-ghost {
  background: rgba(255,255,255,0.06);
  color: var(--text);
  border: 1px solid rgba(255,255,255,0.14);
}
.btn-primary:hover, .btn-ghost:hover { transform: translateY(-2px); }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
  margin-bottom: 42px;
}
.card, .showcase-box {
  background: rgba(20, 24, 36, 0.85);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  padding: 24px;
}
.card h3 { margin-bottom: 8px; font-size: 1.08rem; color: var(--text); }
.card p, .showcase-box p { color: var(--muted); font-size: 0.94rem; }
footer {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  color: var(--muted);
  border-top: 1px solid rgba(255,255,255,0.07);
}
`;

  return { html, css };
}

function extractCodeBlocksFromReply(replyText) {
  const blocks = { html: "", css: "", js: "" };
  const rx = /```(html|css|javascript|js)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = rx.exec(String(replyText || ""))) !== null) {
    const lang = (m[1] || "").toLowerCase();
    const code = (m[2] || "").trim();
    if (!code || code.length < 25) continue;
    if (lang === "html" || (!lang && /<!doctype|<html|<body/i.test(code))) {
      if (code.length > blocks.html.length) blocks.html = code;
    } else if (lang === "css") {
      if (code.length > blocks.css.length) blocks.css = code;
    } else if (lang === "js" || lang === "javascript") {
      if (code.length > blocks.js.length) blocks.js = code;
    }
  }
  return blocks;
}

function sanitizePostToolMediaReply(rawReply, assistantMsg) {
  let out = String(rawReply || "").trim();
  const mediaList = Array.isArray(assistantMsg?.media) ? assistantMsg.media : [];
  const allowedUrls = new Set(mediaList.map(m => String(m.fileUrl || m.url || "").trim()).filter(Boolean));

  // If media gallery is attached, strip broken/hallucinated external placeholder markdown images
  if (mediaList.length > 0) {
    out = out.replace(/!\[[^\]]*\]\(([^)]+)\)/gi, (full, url) => {
      const cleanUrl = String(url || "").trim().replace(/^<|>$/g, "");
      if (allowedUrls.has(cleanUrl)) return ""; // Rendered cleanly in lux-media-grid already
      if (/^file:\/\/\//i.test(cleanUrl)) return full;
      return "";
    });
  }

  // Strip leftover robotic disclaimers if tools actually ran and succeeded
  const hasSuccessfulTool = Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.some(s => s.status === "done");
  if (hasSuccessfulTool) {
    out = out
      .replace(/(?:Üzgünüm|Maalesef)[^.!?\n]*(?:internet\s*bağlantım\s*yok|erişimim\s*yok|kaynağa\s*erişimim\s*yok|yapamam|edemem)[^.!?\n]*[.!?]?\s*/gi, "")
      .replace(/İnternet\s+üzerinden\s+(?:yerel|uluslararası)[^.!?\n]*özel\s+bir\s+servis[^.!?\n]*[.!?]?\s*/gi, "")
      .trim();
  }

  return out;
}

function parseLuxVoiceStopCommand(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^[.,!?;:"'‘’“”\-–—\s]+/, "")
    .replace(/[.,!?;:"'‘’“”\-–—\s]+$/, "")
    .trim();
  if (!cleaned) return null;
  const lower = cleaned.toLocaleLowerCase("tr-TR");

  const exactStops = new Set([
    "dur", "durdur", "dur artık", "lütfen dur", "lutfen dur", "tamam dur",
    "hadi dur", "yeter dur", "sus", "sus artık", "kes", "kes şunu", "kes sesini",
    "yeter", "yeter artık", "iptal", "iptal et", "bekle", "stop", "cancel",
    "dur lütfen", "durdur şunu", "dur bi", "bi dur", "bir dur"
  ]);
  if (exactStops.has(lower)) {
    return { type: "stop", keyword: lower, remainder: "" };
  }

  const prefixMatch = cleaned.match(/^(dur(?:dur)?|sus|kes|iptal(?:\s+et)?|bekle|stop|cancel)(?:\s*(?:art[ıi]k|l[üu]tfen|lutfen|hadi|tamam|[şs]imdi|simdilik|ve|bi|bir))?\s*[,;:.!?-]*\s+(.+)$/i);
  if (prefixMatch && prefixMatch[2]) {
    const kw = prefixMatch[1].toLocaleLowerCase("tr-TR");
    const rem = prefixMatch[2].replace(/^[,;:.!?\-\s]+/, "").trim();
    const remLow = rem.toLocaleLowerCase("tr-TR");
    if (exactStops.has(remLow) || /^(?:ya|yahu|bir\s*saniye|bi\s*dakika|bir\s*dakika|lütfen|lutfen|artık|tamam)$/i.test(remLow)) {
      return { type: "stop", keyword: kw, remainder: "" };
    }
    if (rem.length >= 2) {
      return { type: "stop_and_continue", keyword: kw, remainder: rem };
    }
  }
  return null;
}
window.parseLuxVoiceStopCommand = parseLuxVoiceStopCommand;

async function maybeRecoverMissingActionOrRefusal(userText, rawReply, model, priorHistory, assistantMsg) {
  let reply = String(rawReply || "").trim();
  if (isTurnCanceled(assistantMsg) || assistantMsg?.__apiError) return reply;

  const perms = window.appStore?.getPermissions?.() || {};
  const steps = Array.isArray(assistantMsg?.toolSteps) ? assistantMsg.toolSteps : [];
  if (steps.some(s => s.status === "denied")) {
    return reply;
  }

  const executed = new Set(assistantMsg?.executedTools || []);
  const lower = String(userText || "").toLowerCase();
  const refusalRx = /(?:internet\s*bağlantım\s*yok|erişimim\s*yok|internete\s*erişemiyorum|belirli\s*bir\s*kaynağa\s*erişimim\s*yok|özel\s*bir\s*servis(?:\s*veya\s*uygulama)?\s*kullanmanız\s*gerekebilir|yapamam|edemem|bulamam|tasarlayamam|oluşturamam|söyleyemem|kontrol\s*edemem|gerçek\s*zamanlı\s*(?:bilgiye|hava\s*durumuna)\s*(?:erişimim|ulaşımım)\s*yok|yetkim\s*yok|mümkün\s*değil|maalesef[^.!?\n]*(?:internet|eriş|görsel|resim|hava\s*durumu|ninni|kontrol))/i;
  const isTimeoutFallback = /model\s*tarafına\s*şu\s*an\s*ulaşılamadı/i.test(reply);
  const isRefusal = isTimeoutFallback || refusalRx.test(reply);

  const asksLullaby = /\b(?:ninni|uyut|uyku\s*şarkısı)\b/i.test(lower);
  const asksScreen = /(ekran\s*görüntüsü|ekran\s*goruntusu|screenshot|ekranı\s*çek|ekrani\s*cek|ekran\s*resmi)/i.test(lower);
  const asksSysInfo = /(sistem\s*bilg|donanım\s*bilg|ram\s*durumu|cpu\s*bilg|bilgisayar\s*bilg)/i.test(lower);
  const isWebBuildPrompt = /(?:web\s*(?:tasar[ıi]m[ıi]?|sitesi|sayfas[ıi]|projesi)|açılış\s*sayfası|landing\s*page|(?:html|css|js).*(?:site|sayfa|proje|tasarla|kur|oluştur)).*(?:tasarla|kur|oluştur|yap|yaz)|(?:masaüstü|masaustu|desktop|klasör|klasor).*(?:web|html|sayfa|site|tasar)/i.test(lower);

  const folderReq = !isWebBuildPrompt ? extractFolderCreationRequest(userText) : null;
  const fileWriteReq = (!isWebBuildPrompt && !folderReq) ? extractFileWriteRequest(userText) : null;
  const moveReq = extractMoveOrRenameRequest(userText);
  const deleteReq = extractDeleteRequest(userText);
  const openReq = (!folderReq && !fileWriteReq) ? extractAppOrFolderOpenRequest(userText) : null;

  const asksImageSearch = /(?:resim|resmi|fotoğraf|fotograf|görsel|gorsel).*(?:bul|getir|göster|ara)|(?:bul\s*getir|göster).*(?:resim|fotoğraf|görsel)/i.test(lower);
  const asksImageDesign = !isWebBuildPrompt && !folderReq && /(?:resim|logo|afiş|poster|ikon|wallpaper|illüstrasyon|kapak|görsel|art|desen).*(?:tasarla|çiz|ciz|üret|uret|oluştur|hazırla)|(?:tasarla|çiz|ciz).*(?:resim|logo|afiş|poster|görsel)/i.test(lower);
  const asksWeatherOrInternet = /(hava\s*durumu|sıcaklık|kaç\s*derece|internetten|webden|web'den|araştır|haberler|dolar\s*kuru|euro\s*kuru|altın\s*fiyat|borsa|güncel)/i.test(lower);
  const asksFileList = /(dosya|klasör|klasor|projeler).*(?:listele|kaç|kac|neler|hangi|isim)/i.test(lower);

  const hasAnyLocalAction = Boolean(
    asksLullaby || asksScreen || asksSysInfo || asksImageSearch || asksImageDesign
    || isWebBuildPrompt || asksFileList || folderReq || fileWriteReq
    || moveReq || deleteReq || openReq || executed.size > 0
  );

  // 1. Lullaby recovery
  if (!isTurnCanceled(assistantMsg) && asksLullaby && !executed.has("play_lullaby")) {
    const cleanLyrics = (!isRefusal && reply.length >= 30)
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
  if (!isTurnCanceled(assistantMsg) && fileWriteReq && !executed.has("write_file") && perms.file_write !== false && window.luxAPI?.fs?.writeFile) {
    if (fileWriteReq.baseDir && fileWriteReq.baseDir.includes("/") && window.luxAPI?.fs?.mkdir) {
      await executeAgentTool("mkdir", { dirPath: fileWriteReq.baseDir }, assistantMsg);
      if (isTurnCanceled(assistantMsg)) return reply;
    }
    const res = await executeAgentTool("write_file", {
      filePath: fileWriteReq.filePath,
      content: fileWriteReq.content
    }, assistantMsg);
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
    const res = await executeAgentTool("move_path", {
      sourcePath: moveReq.sourcePath,
      destPath: moveReq.destPath
    }, assistantMsg);
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
  if (!isTurnCanceled(assistantMsg) && deleteReq && !executed.has("delete_path") && perms.file_delete !== false && window.luxAPI?.fs?.deletePath) {
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
  if (!isTurnCanceled(assistantMsg) && openReq && !executed.has("pc_control") && perms.pc_control !== false && window.luxAPI?.agent?.pcControl) {
    const res = await executeAgentTool("pc_control", { action: openReq.mode, target: openReq.target }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "pc_control", { action: openReq.mode, target: openReq.target }, res);
    if (res.status === "done" && (isRefusal || !reply || reply.length < 25)) {
      reply = openReq.mode === "open_app"
        ? `**${openReq.target}** uygulamasını hemen açtım!`
        : `**${openReq.target}** klasörünü hemen açtım!`;
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
  if (!isTurnCanceled(assistantMsg) && asksImageSearch && !executed.has("image_search") && perms.image_generation !== false && perms.network_internet !== false) {
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
    if (res.status === "done" && (isRefusal || /example\.com|placehold|unsplash\.com|tasarlayam|çizemem/i.test(reply) || !assistantMsg?.media?.length)) {
      reply = reply && !isRefusal
        ? reply
        : `**${designPrompt}** tasarımını hazırlayıp aşağıya bıraktım! Beğendiysen diske de kaydedebiliriz 🎨`;
    }
  }

  // 7. Desktop / Workspace Web Project write_file recovery
  if (!isTurnCanceled(assistantMsg) && isWebBuildPrompt && !executed.has("write_file") && perms.file_write !== false && window.luxAPI?.fs?.writeFile) {
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

    const htmlRes = await executeAgentTool("write_file", {
      filePath: `${targetDir}/index.html`,
      content: htmlCode
    }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/index.html` }, htmlRes);

    if (cssCode) {
      const cssRes = await executeAgentTool("write_file", {
        filePath: `${targetDir}/style.css`,
        content: cssCode
      }, assistantMsg);
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/style.css` }, cssRes);
    }
    if (jsCode) {
      const jsRes = await executeAgentTool("write_file", {
        filePath: `${targetDir}/script.js`,
        content: jsCode
      }, assistantMsg);
      if (isTurnCanceled(assistantMsg)) return reply;
      recordToolStepUI(assistantMsg, "write_file", { filePath: `${targetDir}/script.js` }, jsRes);
    }

    if (isRefusal || !reply || reply.length < 40) {
      reply = `Masaüstünde **${folderName}** klasörünü oluşturup projeni gerçek dosyalarla kurdum! Aşağıdaki **Önizle** veya **Tarayıcıda Aç** butonlarıyla tasarımı hemen canlı görebilirsin 🚀`;
    } else if (!/masaüstü|desktop|kaydet|oluştur/i.test(reply)) {
      reply = `Masaüstündeki **${folderName}** klasörüne dosyaları kaydettim! Aşağıdaki butonlardan doğrudan tarayıcıda önizleyebilirsin 🚀\n\n` + reply.replace(/```[\s\S]*?```/g, "").trim();
    }
  }

  // 8. Live Internet / Weather recovery — STRICTLY blocked for local OS/file/folder requests, stop words, or LLM timeouts
  const asksLiveWebQuery = !hasAnyLocalAction
    && !parseLuxVoiceStopCommand(userText)
    && !isWipeMemoryPrompt(userText)
    && !/(?:nasılsın|naber|selam|merhaba|teşekkür|sağ\s*ol|adın\s*ne|kimsin|seni\s*kim|dün\s*ne|sohbet|hafıza|hatırl)/i.test(lower);
  const allowWebRecovery = (asksWeatherOrInternet && !hasAnyLocalAction) || (isRefusal && !isTimeoutFallback && asksLiveWebQuery);

  if (!isTurnCanceled(assistantMsg) && allowWebRecovery && !executed.has("web_search") && perms.web_search !== false && perms.network_internet !== false) {
    const res = await executeAgentTool("web_search", { query: userText }, assistantMsg);
    if (isTurnCanceled(assistantMsg)) return reply;
    recordToolStepUI(assistantMsg, "web_search", { query: userText }, res);
    if (res.status === "done" && res.data) {
      const w = res.data.weather;
      if (w) {
        const fc = Array.isArray(w.forecast) && w.forecast.length > 0 ? `\n\n**3 Günlük Tahmin:**\n- ${w.forecast.join("\n- ")}` : "";
        reply = `Hemen internetten canlı veriyi çektim! **${w.city}** şu an **${w.temperature}°C** (hissedilen ${w.apparentTemperature}°C) ve hava **${w.condition}**. Nem %${w.humidity}, rüzgar ${w.windSpeed} km/saat.${fc}`;
      } else if (Array.isArray(res.data.results) && res.data.results.length > 0) {
        const bullets = res.data.results.slice(0, 4).map(r => `- **${r.title}** (${r.source})\n  ${r.snippet || ""}\n  [Kaynağı Aç](${r.url})`).join("\n");
        reply = `İnternetten canlı arama yaptım, öne çıkan sonuçlar şunlar:\n\n${bullets}`;
      }
    }
  }

  return reply;
}

function stripMarkupForLiveStream(rawText) {
  return String(rawText || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/<lux_tool>[\s\S]*?<\/lux_tool>/gi, "")
    .replace(/<lux_tool[\s\S]*$/i, "");
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
  const donePromise = new Promise((res) => { resolveDone = res; });

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
    const synthPromise = window.luxAPI.voice.synthesize(
      s,
      voiceId,
      speed,
      engineMode,
      cloneRefPath,
      { openrouterApiKey }
    );
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
          await new Promise((res) => { wakeDrain = res; });
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
        if (isTurnCanceled(assistantMsg) || mySpeechEpoch !== window.__luxSpeechEpoch || window.appStore?.getVoiceSettings?.()?.isSpeakerMuted) {
          break;
        }
        if (!synthRes?.success || !synthRes.audioBase64) continue;

        if (!firstAudioSentSound) {
          firstAudioSentSound = true;
          window.playAntigravitySound?.("responseReceived1");
        }

        const engineBadge = synthRes.engine === "piper-offline"
          ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Çevrimdışı Piper</span>`
          : (synthRes.engine === "kokoro-onnx"
            ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Kokoro 82M</span>`
            : (synthRes.engine === "coqui-xtts-v2"
              ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 mr-1.5 font-mono">🎙 XTTS-v2</span>`
              : (synthRes.engine === "openrouter-fish"
                ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mr-1.5 font-mono">🌊 Fish S2.1 :free</span>`
                : (synthRes.engine === "openrouter-heygen"
                  ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 mr-1.5 font-mono">🎙 HeyGen :free</span>`
                  : ""))));

        const audio = new Audio(synthRes.audioBase64);
        audio.volume = Math.max(0, Math.min(1, ((window.appStore?.getVoiceSettings?.()?.volume) ?? 100) / 100));
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
              const liveDurationMs = (audio.duration && !isNaN(audio.duration) && audio.duration > 0)
                ? audio.duration * 1000
                : estDurationMs;
              const elapsed = (audio.duration > 0 && audio.currentTime > 0)
                ? audio.currentTime * 1000
                : (Date.now() - streamStart);
              const progress = Math.min(1.0, elapsed / liveDurationMs);
              if (transcriptEl && window.voiceSessionActive) {
                const chars = Math.max(1, Math.floor(item.text.length * progress));
                transcriptEl.innerHTML = `${engineBadge}<span class="text-foreground leading-relaxed font-normal">${escapeHtml(item.text.slice(0, chars))}</span>${(!noMoreChunks || idx < queue.length || progress < 1.0) ? '<span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle"></span>' : ""}`;
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
          const allSentences = fullSpeechText.split(/(?<=[.?!…])\s+/).map(s => s.trim()).filter(Boolean);
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

window.submitUserMessage = async function(content, options = {}) {
  const text = (content || "").trim();
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
    const wipeReply = "Hafızayı sıfırdan sildim! Tüm eski sohbet kayıtları, proje kalıntıları ve önbellek temizlendi; şu an tertemiz ve sıfır bir sayfadayız.";
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

  // Play Antigravity requestSent sound
  window.playAntigravitySound?.("requestSent");

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
    const emptyMsg = "Şu an kayıtlı veya seçili bir LLM modelin yok. **Ayarlar → Modeller** bölümünden dilediğin bir modeli ekleyip seçebilirsin.";
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
    vadEndedAt: isVoiceTurn ? (window.__luxPerfLastTurn?.vadEndedAt || null) : null,
    sttMs: isVoiceTurn ? (window.__luxPerfLastTurn?.sttMs || 0) : 0,
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
        window.playAntigravitySound?.("responseReceived1");
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
    const speechChunks = (voiceSettings.streamingTts !== false)
      ? splitSpeechSentencesForStreaming(speechText)
      : (speechText ? [speechText] : []);
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
      let currentSynthPromise = speechChunks.length > 0
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

        if (isTurnCanceled(assistantMsg) || mySpeechEpoch !== window.__luxSpeechEpoch || window.appStore?.getVoiceSettings?.()?.isSpeakerMuted) {
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
          window.playAntigravitySound?.("responseReceived1");
        }

        const startRatio = cumSpeechChars / totalSpeechChars;
        cumSpeechChars += chunkText.length;
        const endRatio = Math.min(1.0, cumSpeechChars / totalSpeechChars);
        const speechEndChar = Math.floor(speechText.length * endRatio);
        const startFullChar = Math.floor(fullResponseText.length * startRatio);
        const endFullChar = (chunkIdx === speechChunks.length - 1)
          ? fullResponseText.length
          : Math.floor(fullResponseText.length * endRatio);

        const audio = new Audio(synthRes.audioBase64);
        audio.volume = Math.max(0, Math.min(1, ((window.appStore?.getVoiceSettings?.()?.volume) ?? 100) / 100));
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
            const engineBadge = synthRes.engine === "piper-offline"
              ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Çevrimdışı Piper</span>`
              : (synthRes.engine === "kokoro-onnx"
                ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 font-mono">⚡ Kokoro 82M</span>`
                : (synthRes.engine === "coqui-xtts-v2"
                  ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 mr-1.5 font-mono">🎙 XTTS-v2</span>`
                  : (synthRes.engine === "openrouter-fish"
                    ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mr-1.5 font-mono">🌊 Fish S2.1 :free</span>`
                    : (synthRes.engine === "openrouter-heygen"
                      ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 mr-1.5 font-mono">🎙 HeyGen :free</span>`
                      : ""))));

            currentStreamingTimer = setInterval(() => {
              if (isTurnCanceled(assistantMsg) || !window.currentVoiceAudio || mySpeechEpoch !== window.__luxSpeechEpoch) {
                finish();
                return;
              }
              if (audio.__luxTentativePause || window.isTentativeBargeInActive?.()) {
                return;
              }

              const liveDurationMs = (audio.duration && !isNaN(audio.duration) && audio.duration > 0)
                ? audio.duration * 1000
                : estDurationMs;
              const elapsed = (audio.duration > 0 && audio.currentTime > 0)
                ? audio.currentTime * 1000
                : (Date.now() - streamStart);
              const progress = Math.min(1.0, elapsed / liveDurationMs);
              if (!assistantMsg.__didStreamTokens) {
                const targetChar = Math.max(startFullChar + 1, startFullChar + Math.floor((endFullChar - startFullChar) * progress));
                assistantMsg.content = fullResponseText.slice(0, targetChar);
                scheduleStreamingRender(assistantMsg);
              }

              if (transcriptEl && window.voiceSessionActive) {
                const startHudChar = Math.floor(speechText.length * startRatio);
                const hudChar = startHudChar + Math.floor((speechEndChar - startHudChar) * progress);
                transcriptEl.innerHTML = `${engineBadge}<span class="text-foreground leading-relaxed font-normal">${escapeHtml(speechText.slice(0, hudChar))}</span>${(chunkIdx < speechChunks.length - 1 || progress < 1.0) ? '<span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle"></span>' : ''}`;
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
        window.playAntigravitySound?.("responseReceived1");
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

  window.playAntigravitySound?.("antigravityCascadeDone");

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
    ttsFirstChunkMs: turnPerf.firstTtsReadyAt ? Math.round(turnPerf.firstTtsReadyAt - (turnPerf.firstSentenceQueuedAt || turnPerf.startedAt)) : null,
    firstAudioE2eMs: turnPerf.firstAudioE2eMs
  });

  finalizeTransientFields();
  if (window.__luxActiveTurnId === myTurnId) {
    updateComposerSendButton(false);
  }
  window.appStore.saveState();
  renderChat();
};

window.speakTextMessage = async function(text) {
  if (window.stopSpeaking) window.stopSpeaking();
  const mySpeechEpoch = (window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1);
  const settings = window.appStore?.getVoiceSettings?.() || {};
  const speechText = cleanTextForSpeech(text);
  if (!speechText || settings.isSpeakerMuted) return;

  window.__luxLastSpokenText = speechText;
  window.__luxLastSpokenAt = Date.now();

  const speechChunks = (settings.streamingTts !== false)
    ? splitSpeechSentencesForStreaming(speechText)
    : [speechText];
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
      if (i === 0) window.playAntigravitySound?.("responseReceived1");

      await new Promise((resolve) => {
        if (mySpeechEpoch !== window.__luxSpeechEpoch) {
          resolve();
          return;
        }
        const audio = new Audio(res.audioBase64);
        audio.volume = Math.max(0, Math.min(1, ((window.appStore?.getVoiceSettings?.()?.volume) ?? 100) / 100));
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
            window.playAntigravitySound?.("antigravityCascadeDone");
          }
          resolve();
        };
        audio.onended = () => { audio.__luxTentativePause = false; cleanup(i === speechChunks.length - 1); };
        audio.onpause = () => { if (!audio.ended && !audio.__luxTentativePause) cleanup(false); };
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
window.abortGeneration = function(interrupted = false, opts = {}) {
  window.__luxActiveTurnId = (window.__luxActiveTurnId || 0) + 1;
  window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1;
  if (opts.stopSpeech !== false) {
    try { window.stopSpeaking?.(); } catch (_) {}
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
        msg.stepLabel = interrupted
          ? "⚡ Kullanıcı söz kesti — durduruldu"
          : "Kullanıcı tarafından durduruldu";
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

// -----------------------------------------------------------------------------
// Real API Call Implementations with Signal Cancellation & ReAct Tool Loop
// -----------------------------------------------------------------------------
function resolveGeminiModelCode(rawCode) {
  const code = String(rawCode || "").trim();
  if (!code || /^gemini-(?:1\.[05]|2\.0)-(?:flash|pro)/i.test(code)) {
    return "gemini-3.5-flash-lite";
  }
  return code;
}

function buildGeminiGenerationConfig(modelCode, disableThinking = true) {
  const cfg = { temperature: 0.55 };
  if (!disableThinking) return cfg;
  if (/^gemini-2\.5/i.test(modelCode)) {
    cfg.thinkingConfig = { thinkingBudget: 0 };
  } else if (/^gemini-3/i.test(modelCode)) {
    cfg.thinkingConfig = { thinkingLevel: "minimal" };
  }
  return cfg;
}

async function callGeminiAPIOnce(model, contents, systemPrompt, streamOpts = {}) {
  const apiKey = model.apiKey;
  if (!apiKey) throw Object.assign(new Error("API Anahtarı eksik"), { status: 401 });
  const modelCode = resolveGeminiModelCode(model.modelId);
  const timeoutMs = streamOpts.timeoutMs || 45000;

  const attemptRequest = async (useThinkingConfig) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelCode}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const req = createRequestAbortHelper(timeoutMs);
    try {
      const bodyObj = {
        systemInstruction: { parts: [{ text: systemPrompt || buildAgentSystemPrompt() }] },
        contents,
        generationConfig: buildGeminiGenerationConfig(modelCode, useThinkingConfig)
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
        signal: req.signal
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${res.status}`;
        if (useThinkingConfig && res.status === 400 && /thinking/i.test(msg)) {
          return { retryWithoutThinking: true };
        }
        const e = new Error(msg);
        e.status = res.status;
        throw e;
      }

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("text/event-stream") || !res.body?.getReader) {
        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || [])
          .filter(p => !p.thought && typeof p.text === "string")
          .map(p => p.text)
          .join("");
        if (text) streamOpts.onToken?.(text, text);
        return { text: text || "Boş yanıt alındı." };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8", { stream: true });
      let lineBuffer = "";
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const payloadStr = line.slice(5).trim();
          if (!payloadStr || payloadStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payloadStr);
            const parts = parsed?.candidates?.[0]?.content?.parts || [];
            let deltaText = "";
            for (const p of parts) {
              if (!p.thought && typeof p.text === "string") {
                deltaText += p.text;
              }
            }
            if (deltaText) {
              fullText += deltaText;
              streamOpts.onToken?.(deltaText, fullText);
            }
          } catch (_) {}
        }
      }

      if (lineBuffer.trim().startsWith("data:")) {
        const tailStr = lineBuffer.trim().slice(5).trim();
        if (tailStr && tailStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(tailStr);
            const parts = parsed?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
              if (!p.thought && typeof p.text === "string") {
                fullText += p.text;
                streamOpts.onToken?.(p.text, fullText);
              }
            }
          } catch (_) {}
        }
      }

      return { text: fullText || "Boş yanıt alındı." };
    } catch (err) {
      if (req.didTimeout()) throw new Error("Gemini isteği zaman aşımına uğradı");
      throw err;
    } finally {
      req.cleanup();
    }
  };

  let res = await attemptRequest(true);
  if (res?.retryWithoutThinking) {
    res = await attemptRequest(false);
  }
  return res.text;
}

async function callGeminiWithAgentLoop(model, prompt, history, assistantMsg) {
  const systemPrompt = buildAgentSystemPrompt(prompt, history, { includeXmlInstruction: true });
  const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
  const timeoutMs = isVoiceTurn ? 18000 : 45000;
  const contents = [];
  history.slice(-12).forEach(m => {
    if (m.content) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      });
    }
  });
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const MAX_TOOL_STEPS = 12;
  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg?.__streamReset?.();
    const reply = await callGeminiAPIOnce(model, contents, systemPrompt, {
      timeoutMs,
      onToken: assistantMsg?.__onStreamToken
    });
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    const xmlCalls = window.luxAPI?.fs ? parseXmlToolCalls(reply) : [];
    if (xmlCalls.length === 0) {
      const cleaned = cleanAssistantFinalText(reply);
      if (cleaned) return cleaned;
      if (Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.length > 0) {
        return "İşlemleri tamamladım.";
      }
      return reply ? cleanAssistantFinalText(reply) : "İşlem tamamlandı.";
    }

    contents.push({ role: "model", parts: [{ text: reply }] });
    const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, tc => ({ name: tc.name, args: tc.args }));
    const toolResults = batchResults.map(r => `Araç (${r.name}) sonucu:\n${r.execRes.resultText}`);
    contents.push({
      role: "user",
      parts: [{ text: `${toolResults.join("\n\n")}\n\nBu gerçek araç çıktılarına dayanarak kullanıcıya samimi 'sen' diliyle, doğal ve net Türkçe yanıt ver.` }]
    });
  }

  if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
  assistantMsg?.__streamReset?.();
  const finalReply = await callGeminiAPIOnce(model, contents, systemPrompt, {
    timeoutMs,
    onToken: assistantMsg?.__onStreamToken
  });
  return cleanAssistantFinalText(finalReply) || "İşlemleri tamamladım.";
}

async function fetchOllamaNativeChat(ollamaBaseUrl, payload, timeoutMs = 150000, streamOpts = {}) {
  const req = createRequestAbortHelper(timeoutMs);
  const root = String(ollamaBaseUrl || "http://127.0.0.1:11434")
    .replace(/\/(?:v1(?:\/chat\/completions)?|api\/chat)$/i, "")
    .replace(/\/+$/, "");
  const isQwen3 = /^qwen3/i.test(String(payload.model || ""));
  const approxChars = Array.isArray(payload.messages)
    ? payload.messages.reduce((s, m) => s + String(m.content || "").length, 0)
    : 0;
  const ctxLimit = approxChars > 9000 ? 6144 : 4096;
  const useStream = Boolean(streamOpts?.onToken);
  const bodyObj = {
    model: payload.model,
    messages: payload.messages,
    stream: useStream,
    keep_alive: "10m",
    ...(isQwen3 ? { think: false } : {}),
    options: {
      num_ctx: ctxLimit,
      temperature: typeof payload.temperature === "number" ? payload.temperature : 0.35,
      ...(payload.max_tokens ? { num_predict: payload.max_tokens } : {})
    },
    ...(payload.tools ? { tools: payload.tools } : {})
  };

  try {
    const res = await fetch(`${root}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      signal: req.signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || err.message || `HTTP ${res.status}`;
      const error = new Error(msg);
      error.status = res.status;
      throw error;
    }

    if (!useStream || !res.body?.getReader) {
      const data = await res.json();
      const msg = data?.message || {};
      if (msg.content) streamOpts?.onToken?.(msg.content, msg.content);
      return {
        choices: [
          {
            message: {
              role: msg.role || "assistant",
              content: msg.content || "",
              tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined
            }
          }
        ]
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { stream: true });
    let lineBuffer = "";
    let fullContent = "";
    const collectedToolCalls = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed?.error) {
            const err = new Error(parsed.error);
            err.status = 502;
            throw err;
          }
          const msg = parsed?.message || {};
          if (typeof msg.content === "string" && msg.content.length > 0) {
            fullContent += msg.content;
            streamOpts.onToken?.(msg.content, fullContent);
          }
          if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            collectedToolCalls.push(...msg.tool_calls);
          }
        } catch (parseErr) {
          if (parseErr?.status) throw parseErr;
        }
      }
    }

    if (lineBuffer.trim()) {
      try {
        const parsed = JSON.parse(lineBuffer.trim());
        const msg = parsed?.message || {};
        if (typeof msg.content === "string" && msg.content.length > 0) {
          fullContent += msg.content;
          streamOpts.onToken?.(msg.content, fullContent);
        }
        if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          collectedToolCalls.push(...msg.tool_calls);
        }
      } catch (_) {}
    }

    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: fullContent,
            tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined
          }
        }
      ]
    };
  } catch (err) {
    if (req.didTimeout()) throw new Error("Model yanıtı zaman aşımına uğradı");
    throw err;
  } finally {
    req.cleanup();
  }
}

async function fetchOpenAIChatCompletion(endpoint, headers, bodyObj, timeoutMs = 45000, streamOpts = {}) {
  if (/\/\/(127\.0\.0\.1|localhost):11434(\/|$)/i.test(endpoint) || /\/api\/chat$/i.test(endpoint)) {
    try {
      return await fetchOllamaNativeChat(endpoint, bodyObj, timeoutMs, streamOpts);
    } catch (ollamaErr) {
      if (ollamaErr?.status !== 404) throw ollamaErr;
    }
  }

  const useStream = Boolean(streamOpts?.onToken);
  const reqBody = useStream ? { ...bodyObj, stream: true } : bodyObj;
  const req = createRequestAbortHelper(timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
      signal: req.signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || err.message || `HTTP ${res.status}`;
      const error = new Error(msg);
      error.status = res.status;
      throw error;
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!useStream || !contentType.includes("text/event-stream") || !res.body?.getReader) {
      const data = await res.json();
      const fullContent = data?.choices?.[0]?.message?.content || "";
      if (fullContent && streamOpts?.onToken) {
        streamOpts.onToken(fullContent, fullContent);
      }
      return data;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { stream: true });
    let lineBuffer = "";
    let fullContent = "";
    let resolvedModel = "";
    const toolCallsMap = new Map();

    const processDataLine = (payloadStr) => {
      if (!payloadStr || payloadStr === "[DONE]") return;
      let parsed;
      try {
        parsed = JSON.parse(payloadStr);
      } catch (_) {
        return;
      }
      if (parsed?.error) {
        const e = new Error(parsed.error.message || "Upstream akış hatası");
        e.status = Number(parsed.error.code) || 502;
        throw e;
      }
      if (parsed?.model) resolvedModel = parsed.model;
      const choice = parsed?.choices?.[0];
      if (!choice) return;
      const delta = choice.delta || choice.message || {};
      if (typeof delta.content === "string" && delta.content.length > 0) {
        fullContent += delta.content;
        streamOpts.onToken?.(delta.content, fullContent);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = Number.isInteger(tc.index) ? tc.index : 0;
          const slot = toolCallsMap.get(idx) || { id: "", type: "function", function: { name: "", arguments: "" } };
          if (tc.id) slot.id = tc.id;
          if (tc.type) slot.type = tc.type;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
          toolCallsMap.set(idx, slot);
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("data:")) {
          processDataLine(line.slice(5).trim());
        }
      }
    }
    if (lineBuffer.trim().startsWith("data:")) {
      processDataLine(lineBuffer.trim().slice(5).trim());
    }

    const assembledToolCalls = Array.from(toolCallsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);

    return {
      model: resolvedModel || undefined,
      choices: [
        {
          message: {
            role: "assistant",
            content: fullContent,
            tool_calls: assembledToolCalls.length > 0 ? assembledToolCalls : undefined
          }
        }
      ]
    };
  } catch (err) {
    if (req.didTimeout()) throw new Error("Model yanıtı zaman aşımına uğradı");
    throw err;
  } finally {
    req.cleanup();
  }
}

async function callOpenAICompatibleAPI(model, prompt, history, assistantMsg) {
  let base = (model.endpoint || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = (base.endsWith("/chat/completions") || /\/api\/chat$/i.test(base)) ? base : `${base}/chat/completions`;

  const isOpenRouter = model.provider === "OpenRouter" || /openrouter\.ai/i.test(base);
  const effectiveApiKey = (model.apiKey || "").trim() || (isOpenRouter ? (window.appStore?.getOpenRouterApiKey?.() || "") : "");
  const headers = { "Content-Type": "application/json" };
  if (effectiveApiKey) {
    headers["Authorization"] = `Bearer ${effectiveApiKey}`;
  }
  if (isOpenRouter) {
    headers["X-Title"] = "Lux AI";
  }

  let defaultModelId = "gpt-4o";
  if (base.includes("11434")) defaultModelId = "qwen2.5:3b";
  else if (base.includes("1234")) defaultModelId = "local-model";
  else if (base.includes("20128")) defaultModelId = "oc/flint-40b-free";
  else if (isOpenRouter) defaultModelId = "openrouter/free";
  else if (model.provider === "DeepSeek") defaultModelId = "deepseek-chat";

  let targetModelId = model.modelId || defaultModelId;
  if (base.includes("20128") && (targetModelId === "yapay" || targetModelId === "vscombo" || targetModelId === "openrouter/free" || !targetModelId)) {
    targetModelId = "oc/flint-40b-free";
    model.modelId = "oc/flint-40b-free";
    window.appStore?.updateModel?.(model.id, { modelId: "oc/flint-40b-free" });
  }

  const isLocalCpu = isLocalModelEndpoint(model);
  if (isLocalCpu && /11434/.test(base) && window.luxAPI?.ensureOllama) {
    await window.luxAPI.ensureOllama().catch(() => {});
  }
  const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
  const isLarge14b = /14b|32b|70b/i.test(targetModelId);
  const isMedium7b = /7b|8b|9b/i.test(targetModelId);
  const requestTimeoutMs = isLocalCpu
    ? (isLarge14b ? 300000 : (isMedium7b ? 210000 : 180000))
    : (isVoiceTurn ? 18000 : 45000);
  const userQuestionOnly = String(prompt || "").split(/\n---\n\[/)[0];
  const isGroundedTurn = /\[Hafıza Kontrol Sonucu|\[Hafıza Durumu|\[GÜNCEL ÇALIŞMA ALANI TARAMASI|\[GÜNCEL PROJE TARAMASI|\[MASAÜSTÜ & ÇALIŞMA ALANI PROJELERİ|\[ÇALIŞMA ALANI DOSYA RAPORU/i.test(prompt);
  const skipCalibration = isGroundedTurn || /(?:^|\s)size\b.*?(kullanma|deme|söyleme|yasak|istemiyorum)|resmi\s*(konuşma|olma)/i.test(userQuestionOnly);

  const hasToolsBridge = Boolean(window.luxAPI?.fs || window.luxAPI?.agent);
  const preGroundedAlready = Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.length > 0;
  let useNativeTools = hasToolsBridge && shouldAttachToolsForPrompt(prompt, history);
  // Skip redundant tools if turn was already pre-grounded on FS listing unless writing/web/media/pc
  if (preGroundedAlready && !/(?:^|[\s,.;:!?])(?:oku|read|yaz|write|değiştir|duzenle|ara|search|komut|run|terminal|web|internet|hava|resim|görsel|tasarla|ninni|ekran|aç|sil|taşı|pc|uygulama|kur)(?=$|[\s,.;:!?])/i.test(userQuestionOnly)) {
    useNativeTools = false;
  }
  const toolsForTurn = useNativeTools ? selectToolsForPrompt(prompt, isLocalCpu, history) : [];
  if (toolsForTurn.length === 0) useNativeTools = false;

  const messages = [
    { role: "system", content: buildAgentSystemPrompt(prompt, history, { includeXmlInstruction: !useNativeTools && hasToolsBridge && shouldAttachToolsForPrompt(prompt, history) }) }
  ];
  if (!skipCalibration && !useNativeTools && !shouldAttachToolsForPrompt(prompt, history) && history.length === 0) {
    // Single neutral Turkish tone-calibration pair on brand-new casual turns
    messages.push(
      { role: "user", content: "selam naber" },
      { role: "assistant", content: "Selam! Buralardayım, işlemciler serin keyifler yerinde 😄 Sende durumlar nasıl?" }
    );
  }
  const historyLimit = isLocalCpu ? -4 : -12;
  history.slice(historyLimit).forEach(m => {
    if (m.content) {
      const raw = String(m.content);
      const clipped = (isLocalCpu && raw.length > 650) ? raw.slice(0, 650) + "\n...[kısaltıldı]" : raw;
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: clipped
      });
    }
  });
  messages.push({ role: "user", content: prompt });

  const MAX_TOOL_STEPS = 12;
  const isCodeOrDesignBuild = /(?:tasarla|kod|html|css|js|script|sayfa|web\s*site|açılış\s*sayfası|kur|oluştur)/i.test(userQuestionOnly);
  const isCreativeText = !isCodeOrDesignBuild && /(?:ninni|metin|makale|hikaye|şiir)/i.test(userQuestionOnly);
  const streamOpts = { onToken: assistantMsg?.__onStreamToken };

  const runLoop = async (activeModelId) => {
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      assistantMsg?.__streamReset?.();

      const payload = {
        model: activeModelId,
        messages: messages,
        temperature: (useNativeTools || isGroundedTurn || skipCalibration) ? 0.25 : (isLocalCpu ? 0.38 : 0.68)
      };
      if (isLocalCpu) {
        payload.max_tokens = isCodeOrDesignBuild ? 1600 : (isCreativeText ? 700 : (isGroundedTurn || useNativeTools ? 600 : 450));
      }
      if (useNativeTools && toolsForTurn.length > 0) {
        payload.tools = toolsForTurn;
      }

      let data;
      try {
        data = await fetchOpenAIChatCompletion(endpoint, headers, payload, requestTimeoutMs, streamOpts);
      } catch (err) {
        if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
        // Retry without native `tools` if model/runtime rejects tool schema (400 or OpenRouter 404 no tool endpoint)
        if (useNativeTools && (err?.status === 400 || err?.status === 404) && /tool|function|support|endpoint/i.test(err.message || "")) {
          useNativeTools = false;
          assistantMsg?.__streamReset?.();
          const retryPayload = { model: activeModelId, messages, temperature: 0.72 };
          data = await fetchOpenAIChatCompletion(endpoint, headers, retryPayload, requestTimeoutMs, streamOpts);
        } else {
          throw err;
        }
      }

      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");

      if (isOpenRouter && activeModelId === "openrouter/free" && data?.model && assistantMsg) {
        assistantMsg.modelName = `OpenRouter · ${String(data.model).split('/').pop()}`;
      }

      const choiceMsg = data?.choices?.[0]?.message || {};
      const nativeToolCalls = Array.isArray(choiceMsg.tool_calls) ? choiceMsg.tool_calls : [];

      if (nativeToolCalls.length > 0 && hasToolsBridge) {
        messages.push({
          role: "assistant",
          content: choiceMsg.content || null,
          tool_calls: nativeToolCalls
        });

        const batchResults = await executeToolCallsBatch(nativeToolCalls, assistantMsg, tc => ({
          name: tc.function?.name || tc.name,
          args: tc.function?.arguments || tc.arguments || {}
        }));
        for (const r of batchResults) {
          messages.push({
            role: "tool",
            tool_call_id: r.raw?.id || `call_${Date.now()}`,
            content: r.execRes.resultText
          });
        }
        continue;
      }

      const rawText = choiceMsg.content || "";
      const xmlCalls = hasToolsBridge ? parseXmlToolCalls(rawText) : [];
      if (xmlCalls.length > 0) {
        messages.push({ role: "assistant", content: rawText });
        const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, tc => ({ name: tc.name, args: tc.args }));
        const summaries = batchResults.map(r => `Araç (${r.name}) sonucu:\n${r.execRes.resultText}`);
        messages.push({
          role: "user",
          content: `${summaries.join("\n\n")}\n\nYukarıdaki gerçek araç çıktılarına dayanarak kullanıcıya samimi, doğal ve net bir Türkçe yanıt ver.`
        });
        continue;
      }

      const cleaned = cleanAssistantFinalText(rawText);
      if (cleaned) return cleaned;
      if (Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.length > 0) {
        return assistantMsg.toolSteps.map(s => `- **${s.name}**: ${s.summary}`).join("\n");
      }
      if (isOpenRouter && activeModelId !== "openrouter/free") {
        const emptyErr = new Error("OpenRouter upstream boş yanıt döndürdü");
        emptyErr.status = 502;
        throw emptyErr;
      }
      return "İşlemi tamamladım.";
    }

    // Final synthesis after max tool steps
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg?.__streamReset?.();
    const finalPayload = { model: activeModelId, messages, temperature: 0.65 };
    if (isLocalCpu) finalPayload.max_tokens = 2048;
    const finalData = await fetchOpenAIChatCompletion(
      endpoint,
      headers,
      finalPayload,
      requestTimeoutMs,
      streamOpts
    );
    const finalText = finalData?.choices?.[0]?.message?.content || "";
    return cleanAssistantFinalText(finalText) || "İşlemleri tamamladım.";
  };

  // Skip already rate-limited OpenRouter :free model during 60s cooldown window
  const cooldownMap = window.__openrouterCooldownUntil;
  const autoHealEnabled = window.appStore?.state?.general?.autoHeal !== false;
  if (isOpenRouter && targetModelId !== "openrouter/free" && autoHealEnabled && cooldownMap?.has(targetModelId)) {
    if (Date.now() < cooldownMap.get(targetModelId)) {
      console.info(`⚡ OpenRouter cooldown active for ${targetModelId}, routing via openrouter/free`);
      const orCoolReply = await runLoop("openrouter/free");
      if (assistantMsg) {
        assistantMsg.stepLabel = `⚡ ${targetModelId} geçici limitli olduğu için Auto-Free kullanıldı.`;
      }
      return orCoolReply;
    }
    cooldownMap.delete(targetModelId);
  }

  try {
    return await runLoop(targetModelId);
  } catch (err) {
    if (isTurnCanceled(assistantMsg) || err?.name === "AbortError") throw err;

    // 9Router için Akıllı Otomatik Kurtarma (Auto-Heal / Fallback)
    if (autoHealEnabled && base.includes("20128") && targetModelId !== "oc/flint-40b-free") {
      console.warn(`9Router ${targetModelId} çağrısı başarısız oldu (${err.message}). oc/flint-40b-free modeline geçiliyor...`);
      try {
        assistantMsg?.__streamReset?.();
        const fbData = await fetchOpenAIChatCompletion(
          endpoint,
          headers,
          { model: "oc/flint-40b-free", messages, temperature: 0.7 },
          25000,
          streamOpts
        );
        const fbText = fbData.choices?.[0]?.message?.content;
        if (fbText) {
          model.modelId = "oc/flint-40b-free";
          window.appStore?.updateModel?.(model.id, { modelId: "oc/flint-40b-free" });
          return `${fbText}\n\n> 💡 **9Router Otomatik Kurtarma:** Seçili model (\`${targetModelId}\`) sunucu tarafında yanıt vermediği (\`${err.message}\`) için sorgunuz otomatik olarak kararlı çalışan **\`oc/flint-40b-free\`** modeline yönlendirildi.`;
        }
      } catch (fbErr) {
        if (!window.isGenerating || fbErr?.name === "AbortError") throw fbErr;
        console.error("Fallback da başarısız oldu:", fbErr);
      }
    }

    // OpenRouter upstream-only failover (skip if account daily quota / credits exhausted)
    const isDailyAccountQuota = /free-models-per-day|daily\s*limit|credits|insufficient/i.test(err?.message || "");
    const isUpstreamModelLimit = err?.status === 429 || err?.status === 404 || err?.status === 502 || err?.status === 503
      || /rate.?limit|upstream|temporarily|overload|no endpoints/i.test(err?.message || "");
    if (isOpenRouter && !isDailyAccountQuota && err?.status === 429 && targetModelId !== "openrouter/free") {
      cooldownMap?.set(targetModelId, Date.now() + 60000);
    }
    if (autoHealEnabled && isOpenRouter && !isDailyAccountQuota && targetModelId !== "openrouter/free" && isUpstreamModelLimit) {
      console.warn(`OpenRouter ${targetModelId} yoğun (${err.message}). openrouter/free auto-router ile deneniyor...`);
      try {
        assistantMsg?.__streamReset?.();
        const orAutoReply = await runLoop("openrouter/free");
        if (assistantMsg) {
          assistantMsg.modelName = assistantMsg.modelName || "OpenRouter · Auto-Free";
          assistantMsg.stepLabel = `⚡ ${targetModelId} yoğun olduğu için OpenRouter Auto-Free üzerinden yanıtlandı.`;
        }
        return orAutoReply;
      } catch (orFbErr) {
        if (!window.isGenerating || orFbErr?.name === "AbortError") throw orFbErr;
        console.warn("OpenRouter Auto-Free failover failed:", orFbErr.message);
      }
    }
    throw err;
  }
}

async function callAnthropicAPIOnce(model, messages, systemPartsOrText, streamOpts = {}) {
  let base = (model.endpoint || "https://api.anthropic.com/v1").replace(/\/+$/, "");
  const endpoint = base.endsWith("/messages") ? base : `${base}/messages`;
  const isOfficialAnthropic = /^https:\/\/api\.anthropic\.com/i.test(endpoint);

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": model.apiKey,
    "anthropic-version": "2023-06-01",
    "dangerously-allow-browser": "true"
  };

  let systemPayload;
  if (typeof systemPartsOrText === "object" && systemPartsOrText !== null && systemPartsOrText.staticPersona) {
    if (isOfficialAnthropic) {
      systemPayload = [
        { type: "text", text: systemPartsOrText.staticPersona, cache_control: { type: "ephemeral" } },
        ...(systemPartsOrText.dynamicSuffix ? [{ type: "text", text: systemPartsOrText.dynamicSuffix }] : [])
      ];
    } else {
      systemPayload = systemPartsOrText.full;
    }
  } else {
    systemPayload = systemPartsOrText || buildAgentSystemPrompt();
  }

  const req = createRequestAbortHelper(streamOpts.timeoutMs || 45000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model.modelId || "claude-sonnet-4-5",
        max_tokens: 2048,
        stream: true,
        system: systemPayload,
        messages
      }),
      signal: req.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error?.message || `HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/event-stream") || !res.body?.getReader) {
      const data = await res.json();
      const text = data.content?.[0]?.text || "Boş yanıt alındı.";
      if (text) streamOpts.onToken?.(text, text);
      return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { stream: true });
    let lineBuffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed?.type === "content_block_delta" && parsed?.delta?.type === "text_delta" && typeof parsed.delta.text === "string") {
            fullText += parsed.delta.text;
            streamOpts.onToken?.(parsed.delta.text, fullText);
          }
        } catch (_) {}
      }
    }

    return fullText || "Boş yanıt alındı.";
  } catch (err) {
    if (req.didTimeout()) throw new Error("Anthropic isteği zaman aşımına uğradı");
    throw err;
  } finally {
    req.cleanup();
  }
}

async function callAnthropicWithAgentLoop(model, prompt, history, assistantMsg) {
  const sysParts = buildAgentSystemParts(prompt, history, { includeXmlInstruction: true });
  const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
  const timeoutMs = isVoiceTurn ? 18000 : 45000;
  const messages = [];
  history.slice(-12).forEach(m => {
    if (m.content) {
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      });
    }
  });
  messages.push({ role: "user", content: prompt });

  const MAX_TOOL_STEPS = 12;
  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg?.__streamReset?.();
    const reply = await callAnthropicAPIOnce(model, messages, sysParts, {
      timeoutMs,
      onToken: assistantMsg?.__onStreamToken
    });
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    const xmlCalls = window.luxAPI?.fs ? parseXmlToolCalls(reply) : [];
    if (xmlCalls.length === 0) {
      return cleanAssistantFinalText(reply) || reply;
    }

    messages.push({ role: "assistant", content: reply });
    const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, tc => ({ name: tc.name, args: tc.args }));
    const toolResults = batchResults.map(r => `Araç (${r.name}) sonucu:\n${r.execRes.resultText}`);
    messages.push({
      role: "user",
      content: `${toolResults.join("\n\n")}\n\nBu sonuca dayanarak kullanıcıya samimi, doğal ve net Türkçe yanıt ver.`
    });
  }

  if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
  assistantMsg?.__streamReset?.();
  const finalReply = await callAnthropicAPIOnce(model, messages, sysParts, {
    timeoutMs,
    onToken: assistantMsg?.__onStreamToken
  });
  return cleanAssistantFinalText(finalReply) || finalReply;
}

// Intelligent Built-in Reasoning Engine (Warm, witty, offline conversational fallback)
function generateNaturalResponse(prompt, model) {
  const cleanPrompt = String(prompt || "").split(/\n---\n\[/)[0].trim();
  const p = cleanPrompt.toLowerCase();

  if (p === "selam" || p === "merhaba" || p === "slm" || p === "hey" || p === "selamlar" || p.startsWith("selam ") || p.startsWith("merhaba ")) {
    return "Selam! Buralardayım, kahvemi aldım bekliyorum 😄 Bugün ne kurcalıyoruz?";
  }
  if (p.includes("günaydın")) {
    return "Günaydın! Güneş henüz açmadıysa bile ekranlar aydınlık — nasıl gidiyor?";
  }
  if (p.includes("iyi günler") || p.includes("iyi akşamlar")) {
    return "Sana da iyi günler! Nereden devam edelim, kod mu sohbet mi?";
  }
  if (p.includes("nasılsın") || p.includes("naber")) {
    return "Fıstık gibiyim, fanlar bile keyiften mırıldanıyor! Sende durumlar nasıl, bugün aklında ne var?";
  }
  if (/size|siz\s*kelime|resmi/.test(p) && /(kullanma|deme|söyleme|yasak)/.test(p)) {
    return "Anlaştık patron, resmiyeti kapının dışında bıraktım! Bundan sonra tamamen samimi 'sen' modundayız.";
  }
  if (p.includes("test") || p.includes("1 2 3 4") || p.includes("deneme") || p.includes("ses testi")) {
    return "Ses testi tamam! Cam gibi net geliyor sesin, kulağım sende — devam edebilirsin.";
  }
  if (p.includes("duyabiliyor musun") || p.includes("duyuyor musun") || p.includes("sesim geliyor mu")) {
    return "Hem de cam gibi! Sanki karşı koltukta oturuyorsun, anlat bakalım.";
  }

  return `"${cleanPrompt}" diye seslendin ama seçili model tarafına şu an ulaşılamadı. Ayarlardan model bağlantını ya da sol alttaki model seçimini kontrol et, hemen devam edelim!`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function sanitizeMarkdownHtml(html) {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, iframe, object, embed, link[rel='import'], style, meta, base, form").forEach(el => el.remove());
    doc.querySelectorAll("*").forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const rawVal = String(attr.value || "");
        const normalizedVal = rawVal.replace(/[\u0000-\u0020]+/g, "");
        if (name.startsWith("on") || name === "srcdoc") {
          el.removeAttribute(attr.name);
        } else if (
          (name === "href" || name === "src" || name === "xlink:href" || name === "action" || name === "formaction" || name === "poster" || name === "background") &&
          /^(javascript:|vbscript:|data:text\/html)/i.test(normalizedVal)
        ) {
          el.removeAttribute(attr.name);
        } else if (name === "src" && el.tagName === "IMG" && /^[a-zA-Z]:[\\/]/.test(rawVal)) {
          el.setAttribute("src", "file:///" + rawVal.replace(/\\/g, "/"));
        }
      }
    });
    return doc.body.innerHTML;
  } catch (_) {
    return escapeHtml(html).replace(/\n/g, "<br>");
  }
}

function renderMarkdown(md) {
  if (!md) return "";
  try {
    if (window.marked) {
      if (typeof window.marked.parse === 'function') {
        return sanitizeMarkdownHtml(window.marked.parse(md, { breaks: true, gfm: true }));
      } else if (typeof window.marked === 'function') {
        return sanitizeMarkdownHtml(window.marked(md));
      }
    }
  } catch (e) {
    console.warn("Markdown parse warning:", e);
  }
  return escapeHtml(md).replace(/\n/g, "<br>");
}
