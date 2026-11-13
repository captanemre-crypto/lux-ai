// LUX AI — Sohbet orchestration (giriş noktası)
//
// Modül haritası (index.html yük sırası):
//   agent_workspace.js → chat_shared.js → chat_render.js → chat_tools.js
//   → chat_voice.js → chat.js (bu dosya)
// Bu dosya şunları tutar: submitUserMessage akışı, iptal ve composer durumu.

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
    } catch (e) {
      window.luxDebug?.("chat.js:661", e);
    }
  }
  if (currentStreamingTimer) {
    clearInterval(currentStreamingTimer);
    currentStreamingTimer = null;
  }
  if (currentAbortController) {
    try {
      currentAbortController.abort(new DOMException(interrupted ? "Söz kesildi" : "Kullanıcı durdurdu", "AbortError"));
    } catch (e) {
      window.luxDebug?.("chat.js:670", e);
    }
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
