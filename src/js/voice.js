// Google Antigravity Voice Mode (Gemini Live) 1:1 Implementation for Lux AI
// Supports Live Session Floating HUD, Organic Luminous Fluid Orb, Voice Carousel, Speed Control & High-Fidelity Neural Voice Synthesis

let voiceSessionActive = false;
let voiceSessionTimer = null;
let voiceSessionSeconds = 0;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceMicStream = null;
let voiceProcessorNode = null;
let voiceAnimFrame = null;
let currentVoiceCarouselIndex = 0;

let recordedSamples = [];
let isSpeaking = false;
let silenceTimer = null;
let isTranscribing = false;
let activeSpokenTurnId = 0;
let bargeInCandidate = null;
window.isAIResponding = window.isAIResponding || false;
window.currentVoiceAudio = window.currentVoiceAudio || null;
window.lastAiAudioEndedAt = window.lastAiAudioEndedAt || 0;
window.resetVoiceCaptureBuffers = window.resetVoiceCaptureBuffers || null;

// Vocal-band DSP analyzer (260Hz-3400Hz cascaded bandpass + waveform shape metrics)
// Distinguishes sustained human speech from mechanical mic bumps, sub-bass thumps, sharp clicks & cable rubs
function createVoiceFrameAnalyzer(sampleRate = 16000) {
  const sr = Math.max(8000, Number(sampleRate) || 16000);
  const dt = 1.0 / sr;
  const rcHp = 1.0 / (2 * Math.PI * 240);
  const alphaHp = rcHp / (rcHp + dt);
  const rcLp = 1.0 / (2 * Math.PI * 3400);
  const alphaLp = dt / (rcLp + dt);

  let prevX = 0;
  let hp1 = 0;
  let prevHp1 = 0;
  let hp2 = 0;
  let bp = 0;
  let prevBp = 0;

  return {
    sampleRate: sr,
    analyze(frame) {
      const n = frame?.length || 0;
      if (n === 0) {
        return { rms: 0, framePeak: 0, bandRms: 0, bandPeak: 0, bandRatio: 0, crest: 0, dutyCycle: 0, bandZcr: 0 };
      }
      let rawSum = 0;
      let framePeak = 0;
      let bandSum = 0;
      let bandPeak = 0;
      let zcrCount = 0;
      const bandOut = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        const s = frame[i];
        rawSum += s * s;
        const rawAbs = s < 0 ? -s : s;
        if (rawAbs > framePeak) framePeak = rawAbs;

        hp1 = alphaHp * (hp1 + s - prevX);
        prevX = s;
        hp2 = alphaHp * (hp2 + hp1 - prevHp1);
        prevHp1 = hp1;
        bp = bp + alphaLp * (hp2 - bp);
        bandOut[i] = bp;

        bandSum += bp * bp;
        const bAbs = bp < 0 ? -bp : bp;
        if (bAbs > bandPeak) bandPeak = bAbs;
        if ((bp >= 0) !== (prevBp >= 0)) zcrCount++;
        prevBp = bp;
      }

      const rms = Math.sqrt(rawSum / n);
      const bandRms = Math.sqrt(bandSum / n);
      const activeGate = Math.max(0.00018, bandPeak * 0.14);
      let activeCount = 0;
      for (let i = 0; i < n; i++) {
        const a = bandOut[i];
        if ((a < 0 ? -a : a) > activeGate) activeCount++;
      }

      return {
        rms,
        framePeak,
        bandRms,
        bandPeak,
        bandRatio: bandRms / (rms + 1e-7),
        crest: bandPeak / (bandRms + 1e-7),
        dutyCycle: activeCount / n,
        bandZcr: zcrCount / n
      };
    }
  };
}

function classifyVocalFrame(stats) {
  const nonImpulseShape = stats.bandRatio >= 0.22 && stats.dutyCycle >= 0.08 && stats.crest <= 11.5;
  const vocalShape = stats.bandRatio >= 0.25 && stats.dutyCycle >= 0.095 && stats.crest <= 10.5;
  const harmonicZcr = stats.bandZcr >= 0.02 && stats.bandZcr <= 0.38;
  return {
    idleQuality: nonImpulseShape,
    bargeVowel: vocalShape && harmonicZcr,
    bargeConsonant: nonImpulseShape && stats.bandZcr >= 0.018 && stats.bandZcr <= 0.78
  };
}

function isLikelySpeakerEcho(recognizedText) {
  const lastSpoken = String(window.__luxLastSpokenText || "").trim();
  if (!lastSpoken) return false;
  const recentlyEnded = (Date.now() - (window.lastAiAudioEndedAt || 0)) < 2200;
  if (!recentlyEnded && !window.currentVoiceAudio) return false;
  if (window.parseLuxVoiceStopCommand?.(recognizedText)) return false;

  const norm = (s) => String(s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const spokenNorm = norm(lastSpoken);
  const heardNorm = norm(recognizedText);
  if (!heardNorm || !spokenNorm) return false;
  if (heardNorm.length >= 8 && spokenNorm.includes(heardNorm)) return true;

  const spokenWords = new Set(spokenNorm.split(" ").filter(w => w.length >= 2));
  const heardWords = heardNorm.split(" ").filter(w => w.length >= 2);
  if (heardWords.length < 2) return false;
  let overlap = 0;
  for (const w of heardWords) {
    if (spokenWords.has(w)) overlap++;
  }
  return (overlap / heardWords.length) >= 0.70;
}

window.luxVoiceDsp = { createVoiceFrameAnalyzer, classifyVocalFrame };

window.isTentativeBargeInActive = function() {
  return Boolean(bargeInCandidate && bargeInCandidate.active);
};

window.waitForTentativeBargeInResolution = function() {
  if (!bargeInCandidate || !bargeInCandidate.active) {
    return Promise.resolve("none");
  }
  return new Promise((resolve) => {
    bargeInCandidate.waiters.push(resolve);
  });
};

// Antigravity Official Sound Effects Player
function playAntigravitySound(soundName) {
  const notifs = window.appStore?.state?.notifications;
  if (notifs && notifs.agentSounds === false) return;
  const vol = notifs ? (notifs.soundVolume ?? 100) / 100 : 1.0;
  try {
    const audio = new Audio(`assets/sounds/${soundName}.mp3`);
    audio.volume = Math.max(0, Math.min(1, vol));
    audio.play().catch(() => {});
  } catch (e) {}
}

window.playAntigravitySound = playAntigravitySound;

// Gentle Lullaby Music-Box & Soothing Voice Player (never touches DSP VAD)
const lullabyState = {
  active: false,
  timers: [],
  audios: [],
  voiceAudio: null
};

function updateLullabyUiButtons(isPlaying) {
  document.querySelectorAll("[data-action='toggle-lullaby']").forEach((btn) => {
    const labelEl = btn.querySelector("[data-lullaby-label]");
    if (labelEl) {
      labelEl.textContent = isPlaying ? "Ninniyi Durdur" : "Ninniyi Sesli Dinle";
    }
    btn.classList.toggle("is-playing", Boolean(isPlaying));
  });
}

window.isLullabyPlaying = function() {
  return Boolean(lullabyState.active);
};

window.stopLullabyAudio = function() {
  lullabyState.active = false;
  while (lullabyState.timers.length > 0) {
    clearTimeout(lullabyState.timers.pop());
  }
  while (lullabyState.audios.length > 0) {
    const a = lullabyState.audios.pop();
    try { a.pause(); } catch (_) {}
  }
  if (lullabyState.voiceAudio) {
    lullabyState.voiceAudio.__luxTentativePause = false;
    try { lullabyState.voiceAudio.pause(); } catch (_) {}
    if (window.currentVoiceAudio === lullabyState.voiceAudio) {
      window.currentVoiceAudio = null;
    }
    lullabyState.voiceAudio = null;
  }
  updateLullabyUiButtons(false);
};

window.playLullabyNotes = function(options = {}) {
  const settings = window.appStore?.getVoiceSettings?.() || {};
  if (settings.isSpeakerMuted) return false;
  const notifs = window.appStore?.state?.notifications;
  const sysVol = notifs ? (notifs.soundVolume ?? 100) / 100 : 1.0;
  const vol = Math.max(0.02, Math.min(0.45, (options.volume ?? 0.18) * sysVol));
  const loops = Math.max(1, Math.min(4, Number(options.loops) || 2));

  // Soft Brahms / cradle melody using verified src/assets/sounds/*.mp3 notes
  const pattern = [
    ["E4", 0], ["E4", 460], ["G4", 920], ["E4", 1680], ["E4", 2140], ["G4", 2600],
    ["E4", 3400], ["G4", 3860], ["C5", 4350], ["B4", 5100], ["A4", 5650], ["A4", 6250], ["G4", 6850],
    ["D4", 7750], ["E4", 8210], ["F4", 8680], ["D4", 9300], ["D4", 9760], ["E4", 10220], ["F4", 10680], ["D4", 11300],
    ["F4", 12050], ["B4", 12520], ["A4", 13000], ["G4", 13520], ["B4", 14050], ["C5", 14700]
  ];
  const cycleMs = 15800;

  lullabyState.active = true;
  updateLullabyUiButtons(true);

  for (let loop = 0; loop < loops; loop++) {
    const baseOffset = loop * cycleMs;
    for (const [note, offsetMs] of pattern) {
      const t = setTimeout(() => {
        if (!lullabyState.active) return;
        try {
          const noteAudio = new Audio(`assets/sounds/${note}.mp3`);
          noteAudio.volume = vol;
          lullabyState.audios.push(noteAudio);
          noteAudio.onended = () => {
            lullabyState.audios = lullabyState.audios.filter((x) => x !== noteAudio);
          };
          noteAudio.play().catch(() => {});
        } catch (_) {}
      }, baseOffset + offsetMs);
      lullabyState.timers.push(t);
    }
  }

  const endTimer = setTimeout(() => {
    if (!lullabyState.voiceAudio) {
      lullabyState.active = false;
      updateLullabyUiButtons(false);
    }
  }, loops * cycleMs + 1200);
  lullabyState.timers.push(endTimer);
  return true;
};

window.playLullabyExperience = async function(lyricsText, options = {}) {
  window.stopLullabyAudio?.();
  const settings = window.appStore?.getVoiceSettings?.() || {};
  if (settings.isSpeakerMuted) return false;

  const loops = options.loops || (options.skipVoice ? 2 : 1);
  window.playLullabyNotes({ volume: options.skipVoice ? 0.22 : 0.14, loops });

  if (!options.skipVoice && lyricsText && window.luxAPI?.voice?.synthesize) {
    const cleanSpeech = typeof window.cleanTextForSpeech === "function"
      ? window.cleanTextForSpeech(lyricsText)
      : String(lyricsText).slice(0, 440);
    if (cleanSpeech) {
      try {
        const calmSpeed = Math.max(0.75, Math.min(0.92, (settings.speed || 1.0) * 0.86));
        const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";
        const res = await window.luxAPI.voice.synthesize(
          cleanSpeech,
          settings.voice || "Fola",
          calmSpeed,
          settings.engineMode || "auto",
          settings.cloneRefPath || "",
          { openrouterApiKey }
        );
        if (res?.success && res.audioBase64 && lullabyState.active) {
          const audio = new Audio(res.audioBase64);
          audio.volume = Math.max(0, Math.min(1, ((settings.volume ?? 100) / 100) * 0.92));
          if (/^openrouter-/i.test(res.engine || "")) {
            audio.playbackRate = Math.max(0.5, Math.min(2.0, calmSpeed));
          }
          lullabyState.voiceAudio = audio;
          window.currentVoiceAudio = audio;
          window.isAIResponding = true;
          const finishVoice = () => {
            if (window.currentVoiceAudio === audio) window.currentVoiceAudio = null;
            if (lullabyState.voiceAudio === audio) lullabyState.voiceAudio = null;
            window.isAIResponding = false;
            window.lastAiAudioEndedAt = Date.now();
            window.resetVoiceCaptureBuffers?.();
            lullabyState.active = false;
            while (lullabyState.timers.length > 0) {
              clearTimeout(lullabyState.timers.pop());
            }
            updateLullabyUiButtons(false);
          };
          audio.onended = () => { audio.__luxTentativePause = false; finishVoice(); };
          audio.onpause = () => { if (!audio.ended && !audio.__luxTentativePause) finishVoice(); };
          audio.onerror = finishVoice;
          await audio.play().catch(() => finishVoice());
        }
      } catch (_) {}
    }
  }
  return true;
};

// 16-bit 16000Hz PCM WAV Encoder (Synchronous ArrayBuffer + Base64 fast path)
function encodeWAVBuffer(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

function encodeWAV(samples, sampleRate = 16000) {
  return new Blob([encodeWAVBuffer(samples, sampleRate)], { type: "audio/wav" });
}

function encodeWAVBase64(samples, sampleRate = 16000) {
  const bytes = new Uint8Array(encodeWAVBuffer(samples, sampleRate));
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

let isVoiceModeInitialized = false;

function initVoiceMode() {
  if (isVoiceModeInitialized) return;
  isVoiceModeInitialized = true;

  const btnLive = document.getElementById("btn-voice-live");
  const container = document.getElementById("voice-live-container");

  if (container) {
    container.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleVoiceMode();
    });
  } else if (btnLive) {
    btnLive.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleVoiceMode();
    });
  }

  const btnComposerMic = document.getElementById("btn-composer-mic");
  btnComposerMic?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.toggleComposerDictation?.();
  });

  // HUD Controls
  const btnEnd = document.getElementById("btn-voice-end");
  btnEnd?.addEventListener("click", () => stopVoiceSession());

  const btnMinimize = document.getElementById("btn-voice-minimize");
  const hudPanel = document.querySelector(".voice-hud-panel");
  btnMinimize?.addEventListener("click", () => {
    if (hudPanel) {
      hudPanel.classList.toggle("minimized");
      const isMin = hudPanel.classList.contains("minimized");
      btnMinimize.innerHTML = isMin
        ? `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`
        : `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  });

  // Voice Selector in HUD
  const btnHudVoice = document.getElementById("btn-hud-voice-select");
  btnHudVoice?.addEventListener("click", () => {
    if (window.luxVoiceLibrary?.openModal) {
      window.luxVoiceLibrary.openModal();
    } else if (window.openChooseVoiceModal) {
      window.openChooseVoiceModal();
    }
  });

  // Mic Toggle
  const btnMic = document.getElementById("btn-voice-mic-toggle");
  const iconMicActive = document.getElementById("icon-mic-active");
  const iconMicMuted = document.getElementById("icon-mic-muted");
  btnMic?.addEventListener("click", () => {
    const settings = window.appStore.getVoiceSettings();
    const isMuted = !settings.isMuted;
    window.appStore.setVoiceSetting("isMuted", isMuted);
    if (iconMicActive && iconMicMuted) {
      iconMicActive.classList.toggle("hidden", isMuted);
      iconMicMuted.classList.toggle("hidden", !isMuted);
    }
    const transcriptEl = document.getElementById("voice-hud-transcript");
    if (transcriptEl) {
      transcriptEl.textContent = isMuted ? "Mikrofon kapatıldı (Sessiz)." : "Dinliyor. Herhangi bir şey sorun.";
    }
  });

  // Speaker Toggle
  const btnSpeaker = document.getElementById("btn-voice-speaker-toggle");
  const iconSpeakerActive = document.getElementById("icon-speaker-active");
  const iconSpeakerMuted = document.getElementById("icon-speaker-muted");
  btnSpeaker?.addEventListener("click", () => {
    const settings = window.appStore.getVoiceSettings();
    const isMuted = !settings.isSpeakerMuted;
    window.appStore.setVoiceSetting("isSpeakerMuted", isMuted);
    if (iconSpeakerActive && iconSpeakerMuted) {
      iconSpeakerActive.classList.toggle("hidden", isMuted);
      iconSpeakerMuted.classList.toggle("hidden", !isMuted);
    }
    if (isMuted) {
      window.stopSpeaking?.();
    }
  });

  // Voice Speed Popover & Slider
  const btnSpeed = document.getElementById("btn-voice-speed-toggle");
  const flyoutSpeed = document.getElementById("voice-speed-flyout");
  const sliderSpeed = document.getElementById("voice-speed-slider");
  const textSpeed = document.getElementById("voice-speed-text");

  btnSpeed?.addEventListener("click", (e) => {
    e.stopPropagation();
    flyoutSpeed?.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (flyoutSpeed && !flyoutSpeed.contains(e.target) && e.target !== btnSpeed) {
      flyoutSpeed.classList.add("hidden");
    }
  });

  sliderSpeed?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (textSpeed) textSpeed.textContent = `${val}x`;
    window.appStore.setVoiceSetting("speed", val);
  });
}

function toggleVoiceMode(forceState) {
  const shouldOpen = typeof forceState === "boolean" ? forceState : !voiceSessionActive;
  if (shouldOpen) {
    startVoiceSession();
  } else {
    stopVoiceSession();
  }
}

async function startVoiceSession() {
  voiceSessionActive = true;
  window.voiceSessionActive = true;
  voiceSessionSeconds = 0;

  const hud = document.getElementById("voice-mode-hud");
  const btnLive = document.getElementById("btn-voice-live");
  const timerEl = document.getElementById("voice-hud-timer");
  const transcriptEl = document.getElementById("voice-hud-transcript");

  if (hud) hud.classList.remove("hidden");
  if (btnLive) btnLive.parentElement?.classList.add("voice-btn-active");

  if (timerEl) timerEl.textContent = "0:00";
  if (transcriptEl) transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";

  const curVoice = window.appStore.getVoiceSettings().voice || "Fola";
  const hudVoiceName = document.getElementById("hud-voice-current-name");
  if (hudVoiceName) hudVoiceName.textContent = curVoice;

  // Timer counter
  clearInterval(voiceSessionTimer);
  voiceSessionTimer = setInterval(() => {
    voiceSessionSeconds++;
    const m = Math.floor(voiceSessionSeconds / 60);
    const s = voiceSessionSeconds % 60;
    if (timerEl) {
      timerEl.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
    }
  }, 1000);

  // Pre-warm active STT/TTS engine matching engineMode so cloud voices don't load 18s local Piper needlessly
  const curVoiceSettings = window.appStore?.getVoiceSettings?.() || {};
  window.luxAPI?.voice?.warmup?.({
    sttModel: curVoiceSettings.sttEngine || "auto",
    voice: curVoiceSettings.voice || "Fola",
    mode: curVoiceSettings.engineMode || "auto"
  }).catch?.(() => {});

  // Play Antigravity official session start sound
  playAntigravitySound("voiceRecordingStarted");

  // Start real microphone capture & VAD
  startAudioCapture();
}

function clearCandidateBargeIn(status = "cancelled") {
  if (!bargeInCandidate) return;
  const candidate = bargeInCandidate;
  bargeInCandidate = null;
  if (candidate.pausedAudio) {
    candidate.pausedAudio.__luxTentativePause = false;
  }
  const waiters = candidate.waiters || [];
  candidate.waiters = [];
  for (const w of waiters) {
    try { w(status); } catch (_) {}
  }
}

function stopVoiceSession() {
  if (!voiceSessionActive && !window.voiceSessionActive) return;
  voiceSessionActive = false;
  window.voiceSessionActive = false;
  clearInterval(voiceSessionTimer);

  clearCandidateBargeIn("cancelled");
  playAntigravitySound("voiceRecordingStopped");

  const hud = document.getElementById("voice-mode-hud");
  const btnLive = document.getElementById("btn-voice-live");

  if (hud) hud.classList.add("hidden");
  if (btnLive) btnLive.parentElement?.classList.remove("voice-btn-active");

  stopAudioCapture();

  if (window.currentVoiceAudio) {
    window.currentVoiceAudio.__luxTentativePause = false;
    try { window.currentVoiceAudio.pause(); } catch (e) {}
    window.currentVoiceAudio = null;
  }
  window.stopLullabyAudio?.();
  window.isAIResponding = false;
  activeSpokenTurnId++;
  isSpeaking = false;
  isTranscribing = false;
}

window.stopSpeaking = function() {
  window.__luxSpeechEpoch = (window.__luxSpeechEpoch || 0) + 1;
  clearCandidateBargeIn("cancelled");
  if (window.currentVoiceAudio) {
    window.currentVoiceAudio.__luxTentativePause = false;
    try { window.currentVoiceAudio.pause(); } catch (e) {}
    window.currentVoiceAudio = null;
  }
  window.stopLullabyAudio?.();
  window.isAIResponding = false;
  window.lastAiAudioEndedAt = Date.now();
  window.resetVoiceCaptureBuffers?.();
  isSpeaking = false;
};

let onBargeInReset = null;

window.triggerVoiceBargeIn = function(preChunks = []) {
  if (!voiceSessionActive && !window.voiceSessionActive) return false;
  clearCandidateBargeIn("committed");
  activeSpokenTurnId++;
  window.stopSpeaking?.();
  window.abortGeneration?.(true);
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (typeof onBargeInReset === "function") {
    try { onBargeInReset(); } catch (_) {}
  }
  window.isAIResponding = false;
  window.lastAiAudioEndedAt = 0;

  const hasLiveCapture = Boolean(voiceProcessorNode);
  if (Array.isArray(preChunks) && preChunks.length > 0) {
    recordedSamples = preChunks.map(c => new Float32Array(c));
    isSpeaking = true;
  } else {
    recordedSamples = [];
    isSpeaking = hasLiveCapture;
  }

  if (hasLiveCapture && isSpeaking) {
    silenceTimer = setTimeout(() => {
      processRecordedAudio();
    }, 520);
  }

  const transcriptEl = document.getElementById("voice-hud-transcript");
  if (transcriptEl) {
    transcriptEl.innerHTML = `<span class="text-amber-400 font-medium flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
      ⚡ Söz kesildi — Dinliyor...
    </span>`;
  }
  playAntigravitySound("voiceRecordingStarted");
  return true;
};

function beginTentativeBargeIn(preChunks = []) {
  if (!voiceSessionActive && !window.voiceSessionActive) return false;
  if (bargeInCandidate && bargeInCandidate.active) return false;

  const transcriptEl = document.getElementById("voice-hud-transcript");
  const pausedAudio = (window.currentVoiceAudio && !window.currentVoiceAudio.paused && !window.currentVoiceAudio.ended)
    ? window.currentVoiceAudio
    : null;

  if (pausedAudio) {
    pausedAudio.__luxTentativePause = true;
    try { pausedAudio.pause(); } catch (_) {}
  }

  bargeInCandidate = {
    active: true,
    startedAt: Date.now(),
    pausedAudio,
    wasGenerating: Boolean(window.isGenerating),
    prevTranscriptHtml: transcriptEl ? transcriptEl.innerHTML : "",
    waiters: []
  };

  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (typeof onBargeInReset === "function") {
    try { onBargeInReset(); } catch (_) {}
  }

  recordedSamples = Array.isArray(preChunks) ? preChunks.map(c => new Float32Array(c)) : [];
  isSpeaking = true;

  silenceTimer = setTimeout(() => {
    processRecordedAudio();
  }, 420);

  if (transcriptEl) {
    transcriptEl.innerHTML = `<span class="text-primary font-medium flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>
      Dinliyor...
    </span>`;
  }
  return true;
}

function restoreFalseBargeIn(candidate) {
  if (!candidate) return;
  const waiters = candidate.waiters || [];
  candidate.waiters = [];
  if (bargeInCandidate === candidate) bargeInCandidate = null;
  for (const w of waiters) {
    try { w("resumed"); } catch (_) {}
  }

  const transcriptEl = document.getElementById("voice-hud-transcript");
  const pausedAudio = candidate.pausedAudio;

  if (pausedAudio && pausedAudio === window.currentVoiceAudio && !pausedAudio.ended) {
    pausedAudio.__luxTentativePause = false;
    window.isAIResponding = true;
    if (transcriptEl && candidate.prevTranscriptHtml) {
      transcriptEl.innerHTML = candidate.prevTranscriptHtml;
    }
    pausedAudio.play().catch(() => {
      window.isAIResponding = false;
      if (window.currentVoiceAudio === pausedAudio) {
        window.currentVoiceAudio = null;
      }
    });
    return;
  }

  if (pausedAudio) {
    pausedAudio.__luxTentativePause = false;
  }

  if (window.isGenerating) {
    window.isAIResponding = true;
    if (transcriptEl && voiceSessionActive) {
      transcriptEl.innerHTML = candidate.prevTranscriptHtml
        || `<span class="text-primary italic flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>Antigravity düşünüyor...</span>`;
    }
    return;
  }

  window.isAIResponding = false;
  if (transcriptEl && voiceSessionActive) {
    transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
  }
}

// Voice session stays active until user explicitly closes or ends it
// (window blur / visibility listeners removed to prevent accidental disconnections)

async function startAudioCapture() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("getUserMedia not supported");
      return;
    }

    const settings = window.appStore.getVoiceSettings();
    const micId = settings.microphone;
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(micId && micId !== "default" ? { deviceId: { ideal: micId } } : {})
      }
    };

    voiceMicStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (!voiceMicStream || !voiceSessionActive) {
      try { voiceMicStream?.getTracks?.().forEach(t => t.stop()); } catch (_) {}
      return;
    }

    // Use 16000Hz for speech recognition compatibility
    voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (voiceAudioContext.state === "suspended") {
      await voiceAudioContext.resume();
    }
    if (!voiceSessionActive) {
      stopAudioCapture();
      return;
    }
    const source = voiceAudioContext.createMediaStreamSource(voiceMicStream);

    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 64;
    source.connect(voiceAnalyser);

    const zeroGain = voiceAudioContext.createGain();
    zeroGain.gain.value = 0;
    zeroGain.connect(voiceAudioContext.destination);

    // Prefer modern off-thread AudioWorkletNode; auto-fallback to ScriptProcessorNode if unavailable
    let usingWorklet = false;
    if (voiceAudioContext.audioWorklet && typeof AudioWorkletNode === "function") {
      try {
        await voiceAudioContext.audioWorklet.addModule("js/voice_worklet_processor.js");
        if (!voiceSessionActive || !voiceAudioContext) return;
        voiceProcessorNode = new AudioWorkletNode(voiceAudioContext, "lux-pcm-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          processorOptions: { chunkSize: 1024 }
        });
        source.connect(voiceProcessorNode);
        voiceProcessorNode.connect(zeroGain);
        usingWorklet = true;
      } catch (workletErr) {
        console.warn("AudioWorklet unavailable, falling back to ScriptProcessor:", workletErr?.message || workletErr);
      }
    }

    if (!usingWorklet) {
      voiceProcessorNode = voiceAudioContext.createScriptProcessor(1024, 1, 1);
      source.connect(voiceProcessorNode);
      voiceProcessorNode.connect(zeroGain);
    }

    recordedSamples = [];
    isSpeaking = false;
    isTranscribing = false;
    const actualRate = voiceAudioContext?.sampleRate || 16000;
    const frameMs = (1024 / actualRate) * 1000;
    const maxPreRollChunks = Math.max(6, Math.round(640 / frameMs));
    const maxCaptureChunks = Math.max(150, Math.round(22000 / frameMs));
    const requiredBargeAudioFrames = Math.max(2, Math.round(180 / frameMs));
    const requiredBargeThinkFrames = Math.max(3, Math.round(290 / frameMs));
    const frameAnalyzer = createVoiceFrameAnalyzer(actualRate);

    const captureStartedAt = Date.now();
    let calibrationFrames = 0;
    let noiseFloor = 0.00015;
    let peakFloor = 0.0004;
    let bandNoiseFloor = 0.00006;
    const preRollBuffer = []; // Keep ~640ms rolling audio before speech onset so initial consonants aren't clipped
    const bargeInPreBuffer = []; // Keep ~640ms rolling audio to capture first word of barge-in interruption
    let bargeInFrames = 0;
    let bargeGapGrace = 0;

    onBargeInReset = () => {
      bargeInFrames = 0;
      bargeGapGrace = 0;
      bargeInPreBuffer.length = 0;
    };

    window.resetVoiceCaptureBuffers = () => {
      bargeInFrames = 0;
      bargeGapGrace = 0;
      bargeInPreBuffer.length = 0;
      preRollBuffer.length = 0;
      if (!bargeInCandidate) {
        recordedSamples = [];
        isSpeaking = false;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      }
    };

    const handlePcmFrame = (input) => {
      if (!voiceSessionActive || isTranscribing || !input || input.length === 0) return;

      const curSettings = window.appStore.getVoiceSettings();
      if (curSettings.isMuted) return;

      const stats = frameAnalyzer.analyze(input);
      const cls = classifyVocalFrame(stats);
      const { rms, framePeak, bandRms } = stats;

      // True adaptive SNR thresholds: handles both quiet mics (floor rms=0.00007, speech=0.0004+) & noisy rooms
      const speechThreshold = Math.max(0.00032, Math.min(0.025, noiseFloor * 3.0));
      const holdThreshold = Math.max(0.00022, Math.min(0.018, noiseFloor * 2.1));
      const peakSpeechThreshold = Math.max(0.0016, Math.min(0.08, peakFloor * 3.2));
      const peakHoldThreshold = Math.max(0.0011, Math.min(0.06, peakFloor * 2.3));
      const bandSpeechThreshold = Math.max(0.00018, Math.min(0.016, bandNoiseFloor * 3.2));
      const bargeBandThreshold = Math.max(0.00050, Math.min(0.025, bandNoiseFloor * 7.2, bandSpeechThreshold * 2.6));

      const aiBusy = Boolean(window.currentVoiceAudio || window.isAIResponding || window.isGenerating || window.isLullabyPlaying?.());
      if (aiBusy && !(bargeInCandidate && bargeInCandidate.active)) {
        // Fast barge-in detection for 1-syllable stop commands ("Dur", "Sus", "Kes") while still rejecting thumps/clicks
        const hasVocalEnergy = bandRms > bargeBandThreshold;
        if (hasVocalEnergy && cls.bargeVowel) {
          bargeInPreBuffer.push(new Float32Array(input));
          if (bargeInPreBuffer.length > maxPreRollChunks) bargeInPreBuffer.shift();
          bargeInFrames++;
          bargeGapGrace = 0;
        } else if (hasVocalEnergy && cls.bargeConsonant && bargeInFrames > 0) {
          bargeInPreBuffer.push(new Float32Array(input));
          if (bargeInPreBuffer.length > maxPreRollChunks) bargeInPreBuffer.shift();
          bargeGapGrace = 0;
        } else if (bargeInFrames > 0 && bargeGapGrace < 1) {
          bargeGapGrace++;
          bargeInPreBuffer.push(new Float32Array(input));
          if (bargeInPreBuffer.length > maxPreRollChunks) bargeInPreBuffer.shift();
        } else {
          bargeInFrames = 0;
          bargeGapGrace = 0;
          if (cls.idleQuality) {
            bargeInPreBuffer.push(new Float32Array(input));
            if (bargeInPreBuffer.length > 3) bargeInPreBuffer.shift();
          } else {
            bargeInPreBuffer.length = 0;
          }
        }

        const reqFrames = (window.currentVoiceAudio || window.isLullabyPlaying?.())
          ? requiredBargeAudioFrames
          : requiredBargeThinkFrames;
        if (bargeInFrames >= reqFrames) {
          bargeInFrames = 0;
          bargeGapGrace = 0;
          const chunksToKeep = bargeInPreBuffer.map(chunk => new Float32Array(chunk));
          bargeInPreBuffer.length = 0;
          beginTentativeBargeIn(chunksToKeep);
        }
        return;
      }

      bargeInFrames = 0;
      bargeGapGrace = 0;
      if (bargeInPreBuffer.length > 0) bargeInPreBuffer.length = 0;

      // Short start-chime gate (180ms) and brief 90ms speaker decay guard
      const now = Date.now();
      const inCandidate = Boolean(bargeInCandidate && bargeInCandidate.active);
      if (!inCandidate && ((now - captureStartedAt) < 180 || (now - (window.lastAiAudioEndedAt || 0)) < 90)) {
        preRollBuffer.length = 0;
        return;
      }
      if (!inCandidate && calibrationFrames < 4) {
        calibrationFrames++;
        const clampedRms = Math.min(0.012, rms);
        const clampedPeak = Math.min(0.04, framePeak);
        const clampedBand = Math.min(0.008, bandRms);
        noiseFloor = calibrationFrames === 1 ? Math.max(0.00005, clampedRms) : (noiseFloor * (calibrationFrames - 1) + clampedRms) / calibrationFrames;
        peakFloor = calibrationFrames === 1 ? Math.max(0.00015, clampedPeak) : (peakFloor * (calibrationFrames - 1) + clampedPeak) / calibrationFrames;
        bandNoiseFloor = calibrationFrames === 1 ? Math.max(0.00002, clampedBand) : (bandNoiseFloor * (calibrationFrames - 1) + clampedBand) / calibrationFrames;
        return;
      }

      // Rolling pre-buffer (~640ms) to avoid clipping first syllable
      if (!isSpeaking) {
        preRollBuffer.push(new Float32Array(input));
        if (preRollBuffer.length > maxPreRollChunks) preRollBuffer.shift();
      }

      const rawLoud = rms > speechThreshold || framePeak > peakSpeechThreshold || bandRms > bandSpeechThreshold;
      const activeSpeech = isSpeaking ? rawLoud : (rawLoud && cls.idleQuality);
      const softHold = rms > holdThreshold || framePeak > peakHoldThreshold || bandRms > bandSpeechThreshold * 0.7;

      // Adapt noise floor slowly during real room silence
      if (!isSpeaking && !activeSpeech) {
        noiseFloor = Math.max(0.00005, noiseFloor * 0.94 + Math.min(0.015, rms) * 0.06);
        peakFloor = Math.max(0.00015, peakFloor * 0.94 + Math.min(0.045, framePeak) * 0.06);
        bandNoiseFloor = Math.max(0.00002, bandNoiseFloor * 0.94 + Math.min(0.010, bandRms) * 0.06);
      }

      if (activeSpeech) {
        if (!isSpeaking) {
          isSpeaking = true;
          // Prepend pre-roll buffer so initial Turkish consonants & soft words aren't clipped
          recordedSamples = [...preRollBuffer.map(chunk => new Float32Array(chunk))];
          preRollBuffer.length = 0;
          const transcriptEl = document.getElementById("voice-hud-transcript");
          if (transcriptEl) {
            transcriptEl.innerHTML = `<span class="text-primary font-medium flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>
              Dinliyor...
            </span>`;
          }
        }
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        recordedSamples.push(new Float32Array(input));
        if (recordedSamples.length >= maxCaptureChunks) {
          processRecordedAudio();
        }
      } else if (isSpeaking && softHold) {
        // Keep trailing soft syllables & brief consonant gaps alive without cutting sentence
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        recordedSamples.push(new Float32Array(input));
        if (recordedSamples.length >= maxCaptureChunks) {
          processRecordedAudio();
        }
      } else if (isSpeaking) {
        // Collect buffer during natural breathing pause (~480ms) before turn submit
        recordedSamples.push(new Float32Array(input));
        if (recordedSamples.length >= maxCaptureChunks) {
          processRecordedAudio();
        } else if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            processRecordedAudio();
          }, inCandidate ? 420 : 480);
        }
      }
    };

    if (usingWorklet) {
      voiceProcessorNode.port.onmessage = (ev) => {
        if (ev?.data instanceof Float32Array) {
          handlePcmFrame(ev.data);
        } else if (ev?.data?.buffer) {
          handlePcmFrame(new Float32Array(ev.data));
        }
      };
    } else {
      voiceProcessorNode.onaudioprocess = (e) => {
        handlePcmFrame(e.inputBuffer.getChannelData(0));
      };
    }

    // Live wavebars animation
    const dataArray = new Uint8Array(voiceAnalyser.frequencyBinCount);
    const animateBars = () => {
      if (!voiceSessionActive) return;
      voiceAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const level = Math.min(2.0, Math.max(0.4, avg / 22));

      // Composer wavebars
      const b1 = document.getElementById("voice-bar-1");
      const b2 = document.getElementById("voice-bar-2");
      const b3 = document.getElementById("voice-bar-3");
      if (b1 && b2 && b3) {
        b1.setAttribute("height", `${Math.min(500, 350 * level)}`);
        b2.setAttribute("height", `${Math.min(700, 525 * level)}`);
        b3.setAttribute("height", `${Math.min(400, 175 * level)}`);
      }

      // HUD subtle waveform bars
      const hudWaves = document.querySelectorAll(".voice-hud-panel .wavebar-1, .voice-hud-panel .wavebar-2, .voice-hud-panel .wavebar-3");
      if (hudWaves && hudWaves.length > 0) {
        const hLevel = Math.max(0.3, Math.min(1.0, avg / 45));
        hudWaves.forEach((bar, idx) => {
          bar.style.height = `${Math.round(8 + hLevel * 14 * (idx === 1 ? 1.2 : 0.8))}px`;
        });
      }

      voiceAnimFrame = requestAnimationFrame(animateBars);
    };
    animateBars();

  } catch (err) {
    console.error("Audio capture initialization error:", err);
    const transcriptEl = document.getElementById("voice-hud-transcript");
    if (transcriptEl) {
      transcriptEl.innerHTML = `<span class="text-red-400">Mikrofon erişim hatası: ${escapeHtml(err.message)}</span>`;
    }
  }
}

function stopAudioCapture() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (voiceProcessorNode) {
    try { voiceProcessorNode.port?.postMessage?.("stop"); } catch (e) {}
    try { voiceProcessorNode.disconnect(); } catch (e) {}
    voiceProcessorNode = null;
  }
  if (voiceAnalyser) {
    try { voiceAnalyser.disconnect(); } catch (e) {}
    voiceAnalyser = null;
  }
  if (voiceMicStream) {
    try { voiceMicStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    voiceMicStream = null;
  }
  if (voiceAudioContext) {
    try { voiceAudioContext.close(); } catch (e) {}
    voiceAudioContext = null;
  }
  if (voiceAnimFrame) {
    cancelAnimationFrame(voiceAnimFrame);
    voiceAnimFrame = null;
  }
  clearCandidateBargeIn("cancelled");
  recordedSamples = [];
  isSpeaking = false;
  isTranscribing = false;
  onBargeInReset = null;
  window.resetVoiceCaptureBuffers = null;
}

async function processRecordedAudio() {
  if ((!voiceSessionActive && !window.voiceSessionActive) || recordedSamples.length === 0 || isTranscribing) {
    if (bargeInCandidate && !isTranscribing && recordedSamples.length === 0) {
      restoreFalseBargeIn(bargeInCandidate);
    }
    return;
  }
  const candidate = bargeInCandidate;
  isSpeaking = false;
  isTranscribing = true;
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  // Combine Float32Array samples
  let totalLength = 0;
  for (const chunk of recordedSamples) totalLength += chunk.length;
  const mergedSamples = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of recordedSamples) {
    mergedSamples.set(chunk, offset);
    offset += chunk.length;
  }
  recordedSamples = [];

  // Minimum 0.22s at actual AudioContext rate & non-trivial peak amplitude (supports quiet headsets)
  const actualRate = voiceAudioContext?.sampleRate || 16000;
  let peak = 0;
  for (let i = 0; i < mergedSamples.length; i++) {
    const a = Math.abs(mergedSamples[i]);
    if (a > peak) peak = a;
  }
  if (totalLength < actualRate * 0.22 || peak < 0.0020) {
    isTranscribing = false;
    if (candidate) {
      restoreFalseBargeIn(candidate);
    } else {
      const transcriptEl = document.getElementById("voice-hud-transcript");
      if (transcriptEl && voiceSessionActive) transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
    }
    return;
  }

  const transcriptEl = document.getElementById("voice-hud-transcript");
  if (transcriptEl && !candidate) {
    transcriptEl.innerHTML = `<span class="text-primary italic animate-pulse">Algılanıyor...</span>`;
  }

  let recognizedText = "";
  let engineLabel = "";
  const vadEndedAt = Date.now();
  const sttStartedAt = performance.now();
  try {
    const base64Data = encodeWAVBase64(mergedSamples, voiceAudioContext?.sampleRate || 16000);
    const curSettings = window.appStore.getVoiceSettings();

    if (window.luxAPI?.voice?.transcribe) {
      const res = await window.luxAPI.voice.transcribe(
        base64Data,
        "tr-TR",
        curSettings.engineMode || "auto",
        curSettings.sttEngine || "auto"
      );
      const rawText = (res && res.success && res.text) ? res.text.trim() : "";
      const alnumLen = rawText.replace(/[^\p{L}\p{N}]/gu, "").length;
      if (alnumLen >= 2) {
        recognizedText = rawText;
        engineLabel = res.engine || "";
      }
      window.__luxPerfLastTurn = {
        vadEndedAt,
        sttMs: Math.round(performance.now() - sttStartedAt),
        sttEngine: res?.engine || curSettings.sttEngine || "auto"
      };
    }
  } catch (err) {
    console.warn("Transcription check:", err.message);
  } finally {
    // Release STT lock BEFORE generating/speaking so voice barge-in stays responsive!
    isTranscribing = false;
  }

  if (!voiceSessionActive && !window.voiceSessionActive) {
    if (candidate) clearCandidateBargeIn("cancelled");
    return;
  }

  if (recognizedText) {
    const stopCmd = window.parseLuxVoiceStopCommand?.(recognizedText);
    if (!stopCmd && isLikelySpeakerEcho(recognizedText)) {
      if (candidate) {
        restoreFalseBargeIn(candidate);
      } else if (transcriptEl && voiceSessionActive) {
        transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
      }
      return;
    }

    if (candidate) {
      // Confirmed spoken interruption: now cleanly commit barge-in & tear down previous turn
      const waiters = candidate.waiters || [];
      candidate.waiters = [];
      if (bargeInCandidate === candidate) bargeInCandidate = null;
      if (candidate.pausedAudio) candidate.pausedAudio.__luxTentativePause = false;
      for (const w of waiters) {
        try { w("committed"); } catch (_) {}
      }
      activeSpokenTurnId++;
      window.stopAllAssistantOutput?.(true);
      window.lastAiAudioEndedAt = 0;
    }

    if (stopCmd?.type === "stop") {
      activeSpokenTurnId++;
      window.stopAllAssistantOutput?.(true);
      window.lastAiAudioEndedAt = 0;
      const composerInput = document.getElementById("composer-textarea");
      if (composerInput) {
        composerInput.value = "";
        composerInput.style.height = "auto";
      }
      playAntigravitySound("voiceRecordingStopped");
      if (transcriptEl) {
        transcriptEl.innerHTML = `<span class="text-amber-400 font-medium">⏹ Durduruldu — Dinliyor...</span>`;
      }
      return;
    }

    const effectiveSpoken = stopCmd?.type === "stop_and_continue" ? stopCmd.remainder : recognizedText;
    if (stopCmd?.type === "stop_and_continue") {
      activeSpokenTurnId++;
      window.stopAllAssistantOutput?.(true);
      window.lastAiAudioEndedAt = 0;
    }

    const isNeuralLocal = engineLabel.includes("whisper") || engineLabel.includes("moonshine");
    const neuralBadgeLabel = engineLabel.includes("moonshine")
      ? "🌙 Moonshine STT"
      : (engineLabel.includes("turbo") ? "🎧 Whisper Turbo" : "🎧 Nöral STT");
    const engineBadge = isNeuralLocal
      ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ml-2 align-middle">${neuralBadgeLabel}</span>`
      : (engineLabel.includes("offline")
        ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 ml-2 align-middle">⚡ Çevrimdışı Nöral</span>`
        : "");
    playAntigravitySound("requestSent");
    if (transcriptEl) {
      transcriptEl.innerHTML = `<span class="text-foreground font-medium">"${escapeHtml(effectiveSpoken)}"</span>${engineBadge}`;
    }
    const composerInput = document.getElementById("composer-textarea");
    if (composerInput) {
      composerInput.value = effectiveSpoken;
    }
    await handleUserSpokenInput(effectiveSpoken);
  } else if (candidate) {
    // No spoken words confirmed: false bump/noise — resume paused speech or keep pending answer alive!
    restoreFalseBargeIn(candidate);
  } else {
    if (transcriptEl && voiceSessionActive) {
      transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
    }
  }
}

async function handleUserSpokenInput(spokenText) {
  const myTurnId = ++activeSpokenTurnId;
  window.isAIResponding = true;
  const transcriptEl = document.getElementById("voice-hud-transcript");
  if (transcriptEl) {
    transcriptEl.innerHTML = `<span class="text-primary italic flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>Antigravity düşünüyor...</span>`;
  }

  try {
    // Send message to chat with synchronized neural speech & streaming text
    await window.submitUserMessage(spokenText, { isVoice: true });
  } catch (err) {
    console.error("AI response error:", err);
    playAntigravitySound("error");
    if (transcriptEl) {
      transcriptEl.innerHTML = `<span class="text-red-400">Hata: ${escapeHtml(err.message)}</span>`;
    }
  } finally {
    if (myTurnId === activeSpokenTurnId) {
      window.isAIResponding = false;
    }
  }
}

async function speakAssistantResponse(text) {
  const settings = window.appStore.getVoiceSettings();
  if (settings.isSpeakerMuted) return;

  if (window.currentVoiceAudio) {
    window.currentVoiceAudio.__luxTentativePause = false;
    try { window.currentVoiceAudio.pause(); } catch (e) {}
    window.currentVoiceAudio = null;
  }

  const transcriptEl = document.getElementById("voice-hud-transcript");

  const speechText = typeof window.cleanTextForSpeech === "function"
    ? window.cleanTextForSpeech(text)
    : String(text || "")
        .replace(/```[\s\S]*?```/g, "kod bloğu")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[\p{Extended_Pictographic}\u2600-\u27BF\u{1F000}-\u{1FAFF}]/gu, " ")
        .replace(/[*#_~>]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 440);
  if (!speechText) return;
  window.__luxLastSpokenText = speechText;
  window.__luxLastSpokenAt = Date.now();

  try {
    playAntigravitySound("responseReceived1");

    if (window.luxAPI?.voice?.synthesize) {
      const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";
      const res = await window.luxAPI.voice.synthesize(
        speechText,
        settings.voice || "Arlo",
        settings.speed || 1.0,
        settings.engineMode || "auto",
        settings.cloneRefPath || "",
        { openrouterApiKey }
      );

      if (res && res.success && res.audioBase64) {
        await new Promise((resolve) => {
          const audio = new Audio(res.audioBase64);
          audio.volume = Math.max(0, Math.min(1, (settings.volume ?? 100) / 100));
          if (/^openrouter-/i.test(res.engine || "")) {
            audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(settings.speed) || 1.0));
          }
          window.currentVoiceAudio = audio;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            if (window.currentVoiceAudio === audio) {
              window.currentVoiceAudio = null;
            }
            window.isAIResponding = false;
            window.lastAiAudioEndedAt = Date.now();
            window.resetVoiceCaptureBuffers?.();
            resolve();
          };

          audio.onended = () => {
            audio.__luxTentativePause = false;
            playAntigravitySound("taskCompleted");
            if (transcriptEl && voiceSessionActive) {
              transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
            }
            finish();
          };

          audio.onpause = () => {
            if (!audio.ended && !audio.__luxTentativePause) finish();
          };

          audio.onerror = () => {
            if (transcriptEl && voiceSessionActive) {
              transcriptEl.textContent = "Dinliyor. Herhangi bir şey sorun.";
            }
            finish();
          };

          audio.play().catch((playErr) => {
            console.warn("Audio play failed:", playErr);
            finish();
          });
        });
      }
    }
  } catch (err) {
    console.warn("Neural audio speech error:", err);
  }
}

// 1:1 Antigravity Voice Mode Settings View (LLM seçiminden tamamen bağımsız)
function renderVoiceModeSettingsSection() {
  const settings = window.appStore.getVoiceSettings();
  const volume = typeof settings.volume === "number" ? settings.volume : 100;
  const currentVoice = settings.voice || "Fola";
  const engineMode = settings.engineMode || "auto";
  const sttEngine = settings.sttEngine || "auto";
  const streamingTts = settings.streamingTts !== false;
  const cloneRefPath = settings.cloneRefPath || "";
  const cloneRefName = cloneRefPath ? cloneRefPath.split(/[\\/]/).pop() : "Varsayılan (tr_default_clone.wav)";
  const openrouterKey = window.appStore?.getOpenRouterApiKey?.() || "";

  return `
    <!-- Voice mode Section (Independent STT & TTS Controls) -->
    <div class="flex flex-col gap-2 pt-2">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="text-sm font-medium text-foreground tracking-normal m-0">Sesli Mod (Voice Mode)</h3>
        <span id="settings-voice-engine-status" class="text-[11px] px-2.5 py-0.5 rounded-full bg-secondary/70 border border-border/60 text-muted-foreground font-mono">
          Motor durumu kontrol ediliyor...
        </span>
      </div>
      
      <!-- Multi-Row Card Container -->
      <div class="bg-card/40 border border-border/80 rounded-2xl flex flex-col overflow-hidden hover:border-border transition-colors">
        
        <!-- Row 1: Voice (Fola / Piper / Kokoro / XTTS + Change Button) -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Ses (TTS Modeli)</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Piper TR (DFKI/Fahrettin/Fettah), Kokoro-82M, Coqui XTTS-v2, OpenRouter :free (Fish S2.1 / HeyGen) veya Bulut Nöral sesler.
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-sm font-medium text-foreground" id="settings-voice-current-label">${escapeHtml(currentVoice)}</span>
            <button type="button" id="btn-settings-change-voice" class="agy-button bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium px-3.5 py-1.5 rounded-full border border-border/60 cursor-pointer transition-colors" title="Sesi Değiştir">
              Değiştir
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 2: Microphone Input Device -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Mikrofon</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Sesli mod ve sesle yazdırma için giriş aygıtı.
            </p>
          </div>
          <div class="relative shrink-0 min-w-[260px]">
            <select id="settings-voice-mic-select" class="agy-button bg-[#141418] hover:bg-secondary text-foreground text-xs font-normal px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer outline-none transition-colors w-full" style="background-color: #141418; color: #FAFAFA; color-scheme: dark;">
              <option value="default">Varsayılan - Mikrofon (Realtek High Definition Audio)</option>
              <option value="mic-internal">Dahili Mikrofon</option>
              <option value="mic-headset">Kulaklık Mikrofonu</option>
            </select>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 2.5: STT Model Selector -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Konuşma Tanıma Modeli (STT Motoru)</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Konuşma tanıma için Whisper Small, Large-v3-Turbo, Moonshine Edge veya Google Cloud STT motorunu seçin. LLM seçiminizden bağımsız çalışır.
            </p>
          </div>
          <div class="relative shrink-0 min-w-[260px]">
            <select id="settings-voice-stt-select" class="agy-button bg-[#141418] hover:bg-secondary text-foreground text-xs font-normal px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer outline-none transition-colors w-full" style="background-color: #141418; color: #FAFAFA; color-scheme: dark;">
              <option value="auto" ${sttEngine === "auto" ? "selected" : ""}>Otomatik (Önbelleğe Göre)</option>
              <option value="whisper-small" ${sttEngine === "whisper-small" ? "selected" : ""}>Faster-Whisper Small (Türkçe Dengeli)</option>
              <option value="whisper-large-v3-turbo" ${sttEngine === "whisper-large-v3-turbo" ? "selected" : ""}>Whisper Large-v3-Turbo (Ultra Doğruluk)</option>
              <option value="moonshine-base" ${sttEngine === "moonshine-base" ? "selected" : ""}>Moonshine Base ONNX (Ultra Hızlı EN)</option>
              <option value="whisper-base" ${sttEngine === "whisper-base" ? "selected" : ""}>Faster-Whisper Base (Hafif TR/EN)</option>
              <option value="google-cloud" ${sttEngine === "google-cloud" ? "selected" : ""}>Google Cloud Speech (Çevrimiçi)</option>
            </select>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 3: Konuşma Motoru (Çevrimiçi / Çevrimdışı Nöral Yedek) -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Konuşma Motoru (STT/TTS Modu)</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              İnternet kesildiğinde veya çevrimdışı çalışmada yerel D:\\ motorlarına (Whisper/Moonshine + Piper/Kokoro/XTTS) geçer.
            </p>
          </div>
          <div class="relative shrink-0 min-w-[260px]">
            <select id="settings-voice-engine-select" class="agy-button bg-[#141418] hover:bg-secondary text-foreground text-xs font-normal px-3 py-1.5 rounded-lg border border-border/60 cursor-pointer outline-none transition-colors w-full" style="background-color: #141418; color: #FAFAFA; color-scheme: dark;">
              <option value="auto" ${engineMode === "auto" ? "selected" : ""}>Otomatik (Seçili Yerel + Bulut Nöral)</option>
              <option value="online" ${engineMode === "online" ? "selected" : ""}>Yalnızca Çevrimiçi (Bulut Nöral)</option>
              <option value="offline" ${engineMode === "offline" ? "selected" : ""}>Yalnızca Çevrimdışı (Tamamen Yerel D:\\)</option>
            </select>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 3.5: Streaming TTS (Pipecat Sentence Pipeline) -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Akışlı Cümle Sesi (Pipecat Boru Hattı)</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Uzun yanıtları cümle cümle paralel sentezleyip beklemeden okur (daha düşük ilk ses gecikmesi).
            </p>
          </div>
          <label class="lux-toggle shrink-0" title="Akışlı cümle sentezini aç / kapat">
            <input type="checkbox" id="settings-voice-streaming-toggle" ${streamingTts ? "checked" : ""} />
            <span class="slider"></span>
          </label>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 3.75: XTTS-v2 Reference Voice File -->
        <div class="p-5 flex items-center justify-between gap-4">
          <div class="flex flex-col gap-1 pr-4 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">XTTS-v2 Referans Ses Dosyası (Ses Klonlama)</span>
            <p id="settings-clone-ref-label" class="text-xs text-purple-300/90 font-mono leading-relaxed m-0 truncate" title="${escapeHtml(cloneRefPath || cloneRefName)}">
              ${escapeHtml(cloneRefName)}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" id="btn-settings-pick-clone-audio" class="agy-button bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-500/35 cursor-pointer transition-colors">
              Dosya Seç...
            </button>
            <button type="button" id="btn-settings-reset-clone-audio" class="agy-button bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs px-2.5 py-1.5 rounded-lg border border-border/60 cursor-pointer transition-colors ${cloneRefPath ? '' : 'opacity-40 pointer-events-none'}" title="Varsayılan örneğe dön">
              Sıfırla
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 3.85: OpenRouter Free Cloud TTS API Key -->
        <div class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex flex-col gap-1 pr-4 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-foreground tracking-tight">OpenRouter API Anahtarı (Ücretsiz :free Sesler)</span>
              <span id="settings-voice-or-status" class="text-[10px] px-2 py-0.5 rounded-full font-mono border ${openrouterKey ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-secondary/60 text-muted-foreground border-border/60'}">
                ${openrouterKey ? '✓ Bağlı · $0 Free' : 'Girilmedi'}
              </span>
            </div>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Fish Audio S2.1 Pro (:free) ve HeyGen Voice Turbo (:free) için gerekli (ücretsiz katman: 20 RPM · 50 RPD). Modeller sekmesinden de otomatik okunur.
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <input type="password" id="settings-voice-openrouter-key-input" value="${escapeHtml(openrouterKey)}" placeholder="sk-or-v1-..." class="agy-button bg-[#141418] text-foreground text-xs font-mono px-2.5 py-1.5 rounded-lg border border-border/60 outline-none focus:border-sky-400 w-44" style="background-color: #141418; color: #FAFAFA;" />
            <button type="button" id="btn-settings-toggle-or-key" class="agy-button bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs px-2 py-1.5 rounded-lg border border-border/60 cursor-pointer transition-colors" title="Anahtarı Göster/Gizle">👁</button>
            <button type="button" id="btn-settings-save-or-key" class="agy-button bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-500/35 cursor-pointer transition-colors">Kaydet</button>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-border/60"></div>

        <!-- Row 4: Volume Slider -->
        <div class="p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1 pr-6 flex-1 min-w-0">
            <span class="text-sm font-medium text-foreground tracking-tight">Ses Düzeyi</span>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">
              Antigravity sesli yanıtlarının ses yüksekliği.
            </p>
          </div>
          <div class="flex items-center gap-4 shrink-0">
            <input type="range" id="settings-voice-volume-slider" min="0" max="100" value="${volume}" style="background: linear-gradient(to right, #2F71E3 0%, #2F71E3 ${volume}%, #23242c ${volume}%, #23242c 100%);" class="lux-range-slider" />
            <span id="settings-voice-volume-text" class="text-xs font-semibold text-foreground w-11 text-right font-mono">%${volume}</span>
          </div>
        </div>

      </div>
    </div>
  `;
}

function attachVoiceModeSettingsEvents(container) {
  const btnChange = container.querySelector("#btn-settings-change-voice");
  btnChange?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.luxVoiceLibrary?.openModal) {
      window.luxVoiceLibrary.openModal();
    } else if (window.openChooseVoiceModal) {
      window.openChooseVoiceModal();
    } else {
      openVoiceOrbModal();
    }
  });

  const volSlider = container.querySelector("#settings-voice-volume-slider");
  const volText = container.querySelector("#settings-voice-volume-text");
  volSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    if (volText) volText.textContent = `%${val}`;
    volSlider.style.background = `linear-gradient(to right, #2F71E3 0%, #2F71E3 ${val}%, #23242c ${val}%, #23242c 100%)`;
    window.appStore.setVoiceSetting("volume", val);
  });
  volSlider?.addEventListener("change", () => {
    window.appStore.playVoiceSample(window.appStore.getVoiceSettings().voice);
  });

  const sttSelect = container.querySelector("#settings-voice-stt-select");
  if (sttSelect && window.makeAntigravityCustomSelect) {
    window.makeAntigravityCustomSelect(sttSelect);
  }
  sttSelect?.addEventListener("change", (e) => {
    window.appStore.setVoiceSetting("sttEngine", e.target.value);
  });

  const engineSelect = container.querySelector("#settings-voice-engine-select");
  if (engineSelect && window.makeAntigravityCustomSelect) {
    window.makeAntigravityCustomSelect(engineSelect);
  }
  engineSelect?.addEventListener("change", (e) => {
    window.appStore.setVoiceSetting("engineMode", e.target.value);
  });

  const streamingToggle = container.querySelector("#settings-voice-streaming-toggle");
  streamingToggle?.addEventListener("change", (e) => {
    window.appStore.setVoiceSetting("streamingTts", Boolean(e.target.checked));
  });

  const btnPickClone = container.querySelector("#btn-settings-pick-clone-audio");
  const btnResetClone = container.querySelector("#btn-settings-reset-clone-audio");
  const cloneLbl = container.querySelector("#settings-clone-ref-label");
  btnPickClone?.addEventListener("click", async () => {
    const picked = await window.luxAPI?.voice?.pickCloneAudio?.();
    if (picked && !picked.canceled && picked.path) {
      window.appStore.setVoiceSetting("cloneRefPath", picked.path);
      if (cloneLbl) {
        cloneLbl.textContent = picked.path.split(/[\\/]/).pop();
        cloneLbl.title = picked.path;
      }
      if (btnResetClone) {
        btnResetClone.classList.remove("opacity-40", "pointer-events-none");
      }
    }
  });
  btnResetClone?.addEventListener("click", () => {
    window.appStore.setVoiceSetting("cloneRefPath", "");
    if (cloneLbl) {
      cloneLbl.textContent = "Varsayılan (tr_default_clone.wav)";
      cloneLbl.title = "Varsayılan (tr_default_clone.wav)";
    }
    btnResetClone.classList.add("opacity-40", "pointer-events-none");
  });

  const orKeyInput = container.querySelector("#settings-voice-openrouter-key-input");
  const orToggleBtn = container.querySelector("#btn-settings-toggle-or-key");
  const orSaveBtn = container.querySelector("#btn-settings-save-or-key");
  const orStatusBadge = container.querySelector("#settings-voice-or-status");
  orToggleBtn?.addEventListener("click", () => {
    if (!orKeyInput) return;
    orKeyInput.type = orKeyInput.type === "password" ? "text" : "password";
  });
  const saveOrKey = () => {
    const val = (orKeyInput?.value || "").trim();
    window.appStore?.setOpenRouterApiKey?.(val);
    if (orStatusBadge) {
      orStatusBadge.textContent = val ? "✓ Bağlı · $0 Free" : "Girilmedi";
      orStatusBadge.className = `text-[10px] px-2 py-0.5 rounded-full font-mono border ${val ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-secondary/60 text-muted-foreground border-border/60"}`;
    }
    if (orSaveBtn) {
      orSaveBtn.textContent = val ? "✓ Kaydedildi" : "Temizlendi";
      setTimeout(() => { if (orSaveBtn.isConnected) orSaveBtn.textContent = "Kaydet"; }, 1800);
    }
  };
  orSaveBtn?.addEventListener("click", saveOrKey);
  orKeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveOrKey();
    }
  });

  // Query live voice backend status (Whisper + Moonshine + Piper + Kokoro + XTTS availability on D:)
  const engineStatusEl = container.querySelector("#settings-voice-engine-status");
  if (engineStatusEl && window.luxAPI?.voice?.getStatus) {
    window.luxAPI.voice.getStatus().then((st) => {
      if (st?.success) {
        const readyParts = [];
        if (st.offlineSttAvailable) readyParts.push(st.whisperTurboCached ? "Whisper Small/Turbo" : "Whisper");
        if (st.moonshineAvailable) readyParts.push("Moonshine");
        if (st.offlineTtsAvailable) readyParts.push(`Piper x${st.piperVoicesCount || 1}`);
        if (st.kokoroAvailable) readyParts.push("Kokoro-82M");
        if (st.xttsAvailable) readyParts.push("XTTS-v2");
        if (st.openrouterTtsAvailable && (window.appStore?.getOpenRouterApiKey?.() || st.openrouterConfigured)) {
          readyParts.push("OpenRouter :free");
        }
        if (readyParts.length > 0) {
          engineStatusEl.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono";
          engineStatusEl.textContent = `✓ D:\\ Hazır (${readyParts.join(" · ")})`;
        } else {
          engineStatusEl.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono";
          engineStatusEl.textContent = "Bulut Hazır (Yerel Kısmi)";
        }
      } else {
        engineStatusEl.textContent = "Durum alınamadı";
      }
    }).catch(() => {
      engineStatusEl.textContent = "Bulut Modu";
    });
  }

  const micSelect = container.querySelector("#settings-voice-mic-select");
  if (micSelect && window.makeAntigravityCustomSelect) {
    window.makeAntigravityCustomSelect(micSelect);
  }
  micSelect?.addEventListener("change", (e) => {
    window.appStore.setVoiceSetting("microphone", e.target.value);
    if (voiceSessionActive) {
      stopAudioCapture();
      startAudioCapture();
    }
  });

  // Populate actual audio input devices if available
  if (navigator.mediaDevices?.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(d => d.kind === "audioinput");
      if (audioInputs.length > 0 && micSelect) {
        const curMic = window.appStore.getVoiceSettings().microphone || "default";
        const optionsHtml = [
          `<option value="default" ${curMic === "default" ? "selected" : ""} class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">Varsayılan Sistem Mikrofonu</option>`,
          ...audioInputs.filter(d => d.deviceId !== "default" && d.deviceId !== "communications").map((d, idx) => `
            <option value="${escapeHtml(d.deviceId)}" ${d.deviceId === curMic ? "selected" : ""} class="bg-[#16161b] text-[#f3f4f6]" style="background-color: #16161b; color: #f3f4f6;">${escapeHtml(d.label || `Giriş Aygıtı ${idx + 1}`)}</option>
          `)
        ].join("");
        micSelect.innerHTML = optionsHtml;
        micSelect.value = curMic;
        micSelect._customSelectRefresh?.();
      }
    }).catch(() => {});
  }
}

// 1:1 Antigravity "Choose Antigravity's Voice" Carousel Modal (Image 3 & 4 - media_1794235564020_c0035b7f.png)
function openVoiceOrbModal() {
  document.getElementById("choose-voice-modal")?.remove();

  const voices = window.appStore.getAvailableVoices();
  const currentVoiceId = window.appStore.getVoiceSettings().voice;
  currentVoiceCarouselIndex = voices.findIndex(v => v.id === currentVoiceId);
  if (currentVoiceCarouselIndex < 0) currentVoiceCarouselIndex = 0;

  const modalEl = document.createElement("div");
  modalEl.id = "choose-voice-modal";
  modalEl.className = "lux-modal-backdrop show";
  modalEl.style.zIndex = "2500";

  const renderContent = () => {
    const v = voices[currentVoiceCarouselIndex];
    return `
      <div class="lux-modal max-w-sm w-full bg-[#121216] border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative select-none p-6 pt-5" style="box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.9);">
        
        <!-- Header -->
        <div class="flex items-center justify-between w-full mb-2">
          <span class="w-6"></span>
          <h3 class="text-base font-semibold text-foreground m-0 text-center flex-1">
            Choose Antigravity's Voice
          </h3>
          <button type="button" id="btn-close-voice-modal" class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" title="Kapat">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Center: Carousel with Organic Luminous Orb & Navigation -->
        <div class="relative w-full h-[230px] flex items-center justify-center my-3">
          <!-- Prev Button -->
          <button type="button" id="btn-voice-prev" class="absolute left-1 z-20 p-2 text-muted-foreground/70 hover:text-foreground cursor-pointer transition-colors" title="Önceki Ses">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <!-- Organic Luminous Fluid Cloud / Orb (Matches Image 3 & 4) -->
          <div class="antigravity-voice-orb-container" style="--voice-accent: ${v.color}; --voice-secondary: ${v.secondaryColor};">
            <div class="antigravity-voice-orb-outer"></div>
            <div class="antigravity-voice-orb-core"></div>
          </div>

          <!-- Next Button -->
          <button type="button" id="btn-voice-next" class="absolute right-1 z-20 p-2 text-muted-foreground/70 hover:text-foreground cursor-pointer transition-colors" title="Sonraki Ses">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <!-- Voice Name & Description -->
        <div class="text-center flex flex-col items-center gap-1 mb-4">
          <h4 class="text-xl font-bold text-foreground m-0 tracking-tight">${escapeHtml(v.name)}</h4>
          <p class="text-xs text-muted-foreground m-0">${escapeHtml(v.desc)}</p>
        </div>

        <!-- Carousel Pagination Dots (Active pill indicator) -->
        <div class="flex items-center justify-center gap-1.5 mb-5">
          ${voices.map((item, idx) => {
            const isActive = idx === currentVoiceCarouselIndex;
            return isActive
              ? `<span class="w-6 h-1.5 rounded-full transition-all duration-300" style="background-color: ${v.color}; box-shadow: 0 0 10px ${v.color};"></span>`
              : `<span class="w-1.5 h-1.5 rounded-full bg-white/20 transition-all duration-300"></span>`;
          }).join('')}
        </div>

        <!-- Bottom Action Button: "Use [Voice]" -->
        <button type="button" id="btn-use-voice" class="w-full py-3 px-4 rounded-2xl bg-[#0088FF] hover:bg-[#0077EE] text-white font-medium text-sm transition-all shadow-lg hover:shadow-primary/30 cursor-pointer flex items-center justify-center gap-2">
          <span>Use ${escapeHtml(v.name)}</span>
        </button>

        <button type="button" id="btn-open-full-lib" class="w-full mt-2 py-2 px-3 rounded-xl border border-white/10 hover:border-white/20 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center gap-1.5">
          <span>Tüm Stüdyo Kütüphanesini Gör (${window.luxVoiceLibrary?.catalog?.length || 28} Ses) ›</span>
        </button>

      </div>
    `;
  };

  const attachEvents = () => {
    modalEl.querySelector("#btn-close-voice-modal")?.addEventListener("click", () => modalEl.remove());
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) modalEl.remove();
    });

    modalEl.querySelector("#btn-voice-prev")?.addEventListener("click", () => {
      currentVoiceCarouselIndex = (currentVoiceCarouselIndex - 1 + voices.length) % voices.length;
      modalEl.innerHTML = renderContent();
      attachEvents();
      // Play vocal sample
      window.appStore.playVoiceSample(voices[currentVoiceCarouselIndex].id);
    });

    modalEl.querySelector("#btn-voice-next")?.addEventListener("click", () => {
      currentVoiceCarouselIndex = (currentVoiceCarouselIndex + 1) % voices.length;
      modalEl.innerHTML = renderContent();
      attachEvents();
      // Play vocal sample
      window.appStore.playVoiceSample(voices[currentVoiceCarouselIndex].id);
    });

    modalEl.querySelector("#btn-open-full-lib")?.addEventListener("click", () => {
      modalEl.remove();
      window.luxVoiceLibrary?.openModal?.();
    });

    modalEl.querySelector("#btn-use-voice")?.addEventListener("click", () => {
      const selected = voices[currentVoiceCarouselIndex];
      window.appStore.setVoiceSetting("voice", selected.id);
      window.appStore.playVoiceSample(selected.id);

      const label = document.getElementById("settings-voice-current-label");
      if (label) label.textContent = selected.name;
      const hudLbl = document.getElementById("hud-voice-current-name");
      if (hudLbl) hudLbl.textContent = selected.id;

      modalEl.remove();
    });
  };

  modalEl.innerHTML = renderContent();
  document.body.appendChild(modalEl);
  attachEvents();

  // Play initial preview chime/sample
  window.appStore.playVoiceSample(voices[currentVoiceCarouselIndex].id);
}

// Single-turn Composer Dictation (#btn-composer-mic)
let composerDictationActive = false;
let dictationContext = null;
let dictationStream = null;
let dictationProcessor = null;
let dictationChunks = [];
let dictationAutoStopTimer = null;

async function stopAndTranscribeComposerDictation() {
  if (!composerDictationActive) return;
  composerDictationActive = false;
  if (dictationAutoStopTimer) {
    clearTimeout(dictationAutoStopTimer);
    dictationAutoStopTimer = null;
  }

  const btn = document.getElementById("btn-composer-mic");
  btn?.classList.remove("bg-red-500/20", "text-red-400", "ring-2", "ring-red-500/50", "animate-pulse");
  btn?.setAttribute("title", "Sesle Yaz (Dikte)");

  const sampleRate = dictationContext?.sampleRate || 16000;
  try { dictationProcessor?.port?.postMessage?.("stop"); } catch (_) {}
  try { dictationProcessor?.disconnect(); } catch (_) {}
  try { dictationStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  try { dictationContext?.close(); } catch (_) {}
  dictationProcessor = null;
  dictationStream = null;
  dictationContext = null;

  const chunks = dictationChunks;
  dictationChunks = [];
  if (!chunks.length) return;

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  if (totalLen < sampleRate * 0.2) return;

  const merged = new Float32Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }

  try {
    const b64 = encodeWAVBase64(merged, sampleRate);
    const settings = window.appStore?.getVoiceSettings?.() || {};
    const res = await window.luxAPI?.voice?.transcribe?.(
      b64,
      "tr-TR",
      settings.engineMode || "auto",
      settings.sttEngine || "auto"
    );
    if (res?.success && res.text && res.text.trim()) {
      const textarea = document.getElementById("composer-textarea");
      if (textarea) {
        const prefix = textarea.value && !textarea.value.endsWith(" ") ? " " : "";
        textarea.value += prefix + res.text.trim();
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";
        textarea.focus();
      }
      playAntigravitySound("voiceRecordingStopped");
    }
  } catch (err) {
    console.warn("Composer dictation error:", err);
  }
}

window.toggleComposerDictation = async function() {
  if (composerDictationActive) {
    await stopAndTranscribeComposerDictation();
    return;
  }

  if (voiceSessionActive || window.voiceSessionActive) {
    stopVoiceSession();
  }

  if (!navigator.mediaDevices?.getUserMedia) return;

  const btn = document.getElementById("btn-composer-mic");
  try {
    const settings = window.appStore?.getVoiceSettings?.() || {};
    const micId = settings.microphone;
    dictationStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(micId && micId !== "default" ? { deviceId: { ideal: micId } } : {})
      }
    });
    dictationContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (dictationContext.state === "suspended") await dictationContext.resume();

    const src = dictationContext.createMediaStreamSource(dictationStream);
    const zeroGain = dictationContext.createGain();
    zeroGain.gain.value = 0;

    dictationChunks = [];
    composerDictationActive = true;
    window.luxAPI?.voice?.warmup?.({
      sttModel: settings.sttEngine || "auto",
      voice: settings.voice || "Fola",
      mode: settings.engineMode || "auto"
    }).catch?.(() => {});
    playAntigravitySound("voiceRecordingStarted");
    btn?.classList.add("bg-red-500/20", "text-red-400", "ring-2", "ring-red-500/50", "animate-pulse");
    btn?.setAttribute("title", "Dikte Kaydını Durdur ve Metne Çevir");

    const dictationStartedAt = Date.now();
    const dictationAnalyzer = createVoiceFrameAnalyzer(dictationContext?.sampleRate || 16000);
    let speechSeen = false;
    let lastSoundAt = Date.now();
    const handleDictationFrame = (inputData) => {
      if (!composerDictationActive || !inputData || inputData.length === 0) return;
      if (Date.now() - dictationStartedAt < 250) return;
      dictationChunks.push(new Float32Array(inputData));
      const stats = dictationAnalyzer.analyze(inputData);
      const cls = classifyVocalFrame(stats);
      const hasLevel = stats.rms > 0.00035 || stats.framePeak > 0.0018 || stats.bandRms > 0.00022;
      if (hasLevel && (speechSeen || cls.idleQuality)) {
        speechSeen = true;
        lastSoundAt = Date.now();
      } else if (speechSeen && (Date.now() - lastSoundAt > 1200)) {
        stopAndTranscribeComposerDictation();
      }
    };

    let dictationWorklet = false;
    if (dictationContext.audioWorklet && typeof AudioWorkletNode === "function") {
      try {
        await dictationContext.audioWorklet.addModule("js/voice_worklet_processor.js");
        if (!composerDictationActive || !dictationContext) return;
        dictationProcessor = new AudioWorkletNode(dictationContext, "lux-pcm-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          processorOptions: { chunkSize: 1024 }
        });
        dictationProcessor.port.onmessage = (ev) => {
          if (ev?.data instanceof Float32Array) {
            handleDictationFrame(ev.data);
          } else if (ev?.data?.buffer) {
            handleDictationFrame(new Float32Array(ev.data));
          }
        };
        dictationWorklet = true;
      } catch (_) {}
    }
    if (!dictationWorklet) {
      dictationProcessor = dictationContext.createScriptProcessor(2048, 1, 1);
      dictationProcessor.onaudioprocess = (ev) => {
        handleDictationFrame(ev.inputBuffer.getChannelData(0));
      };
    }

    src.connect(dictationProcessor);
    dictationProcessor.connect(zeroGain);
    zeroGain.connect(dictationContext.destination);

    // Safety cap 30 seconds
    dictationAutoStopTimer = setTimeout(() => {
      if (composerDictationActive) stopAndTranscribeComposerDictation();
    }, 30000);
  } catch (err) {
    console.warn("Mic dictation init failed:", err);
    composerDictationActive = false;
  }
};

// Exports
window.initVoiceMode = initVoiceMode;
window.toggleVoiceMode = toggleVoiceMode;
window.startVoiceSession = startVoiceSession;
window.stopVoiceSession = stopVoiceSession;
window.openVoiceOrbModal = openVoiceOrbModal;
if (typeof window.openChooseVoiceModal !== "function") {
  window.openChooseVoiceModal = openVoiceOrbModal;
}
window.renderVoiceModeSettingsSection = renderVoiceModeSettingsSection;
window.attachVoiceModeSettingsEvents = attachVoiceModeSettingsEvents;
