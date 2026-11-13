// LUX AI — Sohbet ⇄ ses köprüsü
//
// chat.js'ten ayrıldı: akışlı TTS boru hattı (createStreamSpeechPipeline) ve
// kayıttan TTS oynatma (speakTextMessage). luxAPI.voice + audio_cache ile çalışır.

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
            window.setVoiceHudVisualState?.("listening");
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
            window.setVoiceHudVisualState?.("speaking");
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
                const karaokeHtml = typeof window.renderKaraokeTextHtml === "function"
                  ? window.renderKaraokeTextHtml(item.text, progress)
                  : `<span class="text-foreground leading-relaxed font-normal">${escapeHtml(item.text)}</span>`;
                transcriptEl.innerHTML = `${engineBadge}${karaokeHtml}${!noMoreChunks || idx < queue.length || progress < 1.0 ? '<span class="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-1 align-middle"></span>' : ""}`;
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
