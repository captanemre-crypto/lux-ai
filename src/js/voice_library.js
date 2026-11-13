/**
 * Lux AI - Dedicated External Voice Library Module
 * Provides high-fidelity cloud & neural voice models matching Lux & Gemini Live standards.
 * Zero robotic Windows TTS.
 */

(function () {
  const VOICE_CATALOG = [
    {
      id: "Fola",
      name: "Fola",
      gender: "Kadın",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Doğal & Sıcak",
      badge: "Önerilen",
      badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
      description: "Gemini Live standardında akıcı, samimi ve son derece net Türkçe kadın sesi.",
      sampleText: "Merhaba! Ben Fola. Lux AI projenizde size akıcı ve doğal bir tonlamayla eşlik ediyorum.",
      color: "#3B82F6",
      neuralVoice: "tr-TR-EmelNeural",
      rate: 1.0,
      pitch: 0
    },
    {
      id: "Arlo",
      name: "Arlo",
      gender: "Erkek",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Sakin & Düşünceli",
      badge: "Klasik",
      badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
      description: "Derin, dengeli ve profesyonel asistan tonuna sahip doğal erkek sesi.",
      sampleText: "Selamlar. Ben Arlo. Kod geliştirme ve mimari konularda birlikte çalışabiliriz.",
      color: "#10B981",
      neuralVoice: "tr-TR-AhmetNeural",
      rate: 1.0,
      pitch: 0
    },
    {
      id: "Puck",
      name: "Puck",
      gender: "Erkek",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Dinamik & Enerjik",
      badge: "Hızlı",
      badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
      description: "Tempolu, canlı ve hızlı cevap veren dinamik konuşma tonu.",
      sampleText: "Hey! Ben Puck. Hızlı düşünür, seri cevap veririm. Ne üzerinde çalışıyoruz?",
      color: "#F59E0B",
      neuralVoice: "tr-TR-AhmetNeural",
      rate: 1.1,
      pitch: 5
    },
    {
      id: "Kore",
      name: "Kore",
      gender: "Kadın",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Yumuşak & Rahatlatıcı",
      badge: "Akıcı",
      badgeClass: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
      description: "Huzurlu, sakin ve melodik dinleme deneyimi sunan kadın sesi.",
      sampleText: "İyi çalışmalar. Ben Kore. Sakin ve detaylı açıklamalar için buradayım.",
      color: "#8B5CF6",
      neuralVoice: "tr-TR-EmelNeural",
      rate: 0.95,
      pitch: -3
    },
    {
      id: "Charon",
      name: "Charon",
      gender: "Erkek",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Derin & Tok",
      badge: "Tok Ses",
      badgeClass: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
      description: "Bariton, güçlü ve güven veren kararlı erkek sesi.",
      sampleText: "Merhaba. Ben Charon. Sistem mimarisi ve kritik kod süreçlerinde yanınızdayım.",
      color: "#06B6D4",
      neuralVoice: "tr-TR-AhmetNeural",
      rate: 0.95,
      pitch: -8
    },
    {
      id: "Aoede",
      name: "Aoede",
      gender: "Kadın",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Parlak & Neşeli",
      badge: "Canlı",
      badgeClass: "bg-pink-500/15 text-pink-400 border border-pink-500/30",
      description: "Yüksek enerjili, açık ve berrak tonlamalı kadın sesi.",
      sampleText: "Harika bir gün! Ben Aoede. Size yeni fikirler ve yaratıcı çözümler sunabilirim.",
      color: "#EC4899",
      neuralVoice: "tr-TR-EmelNeural",
      rate: 1.05,
      pitch: 6
    },
    {
      id: "Zephyr",
      name: "Zephyr",
      gender: "Erkek",
      category: "neural",
      provider: "Lux Nöral",
      tone: "Seri & Keskin",
      badge: "Kıvrak",
      badgeClass: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
      description: "Modern, hızlı tempolu ve net diksiyona sahip erkek sesi.",
      sampleText: "Selam! Ben Zephyr. Vakit kaybetmeden hemen işe koyulalım.",
      color: "#6366F1",
      rate: 1.2
    },
    {
      id: "ElevenLabs-Rachel",
      name: "Rachel Profili (Edge-TTS)",
      gender: "Kadın",
      category: "elevenlabs",
      provider: "Microsoft Edge-TTS (ElevenLabs Tarzı)",
      tone: "Stüdyo & Anlatıcı",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "Edge-TTS tr-TR-EmelNeural tabanlı (+8Hz / +%2), ElevenLabs tarzı pürüzsüz Türkçe kadın tonu.",
      sampleText: "Merhaba. Edge-TTS stüdyo profiliyle akıcı ve doğal Türkçe bir ses deneyimi sunuyorum.",
      color: "#D97706",
      rate: 1.0
    },
    {
      id: "ElevenLabs-Adam",
      name: "Adam Profili (Edge-TTS)",
      gender: "Erkek",
      category: "elevenlabs",
      provider: "Microsoft Edge-TTS (ElevenLabs Tarzı)",
      tone: "Derin & Anlatı",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "Edge-TTS tr-TR-AhmetNeural tabanlı (-20Hz), belgesel ve derin seslendirme tarzı Türkçe erkek tonu.",
      sampleText: "Selamlar. Ben Adam profili. Sistem mimarin ve projelerin için buradayım.",
      color: "#B45309",
      rate: 0.98
    },
    {
      id: "ElevenLabs-Bella",
      name: "Bella Profili (Edge-TTS)",
      gender: "Kadın",
      category: "elevenlabs",
      provider: "Microsoft Edge-TTS (ElevenLabs Tarzı)",
      tone: "Sıcak & Samimi",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "Edge-TTS tr-TR-EmelNeural tabanlı (+15Hz), canlı ve sempatik Türkçe kadın ses profili.",
      sampleText: "Harika bir gün! Kodların ve soruların için hazırım.",
      color: "#F59E0B",
      rate: 1.05
    },
    {
      id: "Cartesia-Sonic-TR",
      name: "Sonic Hızlı Profil (Edge-TTS)",
      gender: "Erkek",
      category: "cartesia",
      provider: "Microsoft Edge-TTS (Hızlı Ayar)",
      tone: "Hızlı Tempolu (+%15)",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      description: "Edge-TTS tr-TR-AhmetNeural +15% hız ayarlı akıcı Türkçe erkek asistan profili.",
      sampleText: "Hızlı Türkçe konuşma profili devrede. Anında sohbete başlayabiliriz.",
      color: "#059669",
      rate: 1.15
    },
    {
      id: "Deepgram-Aura-TR",
      name: "Aura Odaklı Profil (Edge-TTS)",
      gender: "Kadın",
      category: "deepgram",
      provider: "Microsoft Edge-TTS (Odaklı Ton)",
      tone: "Net & Odaklı",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
      description: "Edge-TTS tr-TR-EmelNeural (-10Hz) tabanlı net ve odaklı diyalog kadın ses profili.",
      sampleText: "Türkçe ses ajanınız hazır. Sorularını yanıtlamaktan memnuniyet duyarım.",
      color: "#0891B2",
      rate: 1.0
    },
    {
      id: "Qwen3-TTS-Bridge",
      name: "Qwen3 Tarzı Profil (Edge-TTS)",
      gender: "Erkek",
      category: "qwen",
      provider: "Microsoft Edge-TTS (Tok Ton)",
      tone: "Tok & Dinamik",
      badge: "Edge-TTS Profili",
      badgeClass: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
      description: "Edge-TTS tr-TR-AhmetNeural (-15Hz, +%5) tabanlı tok erkek ses profili (yerel Piper/Kokoro ayrıca seçilebilir).",
      sampleText: "Akıcı Türkçe ses profili başarıyla etkinleştirildi.",
      color: "#7C3AED",
      rate: 1.0
    },
    {
      id: "Villainess",
      name: "Kötü Kadın (Villainess)",
      gender: "Kadın",
      category: "character",
      provider: "AnyToSpeech Tarzı",
      tone: "Karanlık, Soğuk & Alaycı",
      badge: "Kötü Kadın",
      badgeClass: "bg-red-500/20 text-red-400 border border-red-500/40",
      description: "AnyToSpeech Villainess modeli: entrikacı, mesafeli, otoriter ve karanlık kadın sesi.",
      sampleText: "Demek buraya kadar gelebildin... Fazla cesursun. Bakalım sistemin karanlığıma dayanabilecek mi?",
      color: "#DC2626",
      rate: 0.94
    },
    {
      id: "Piper-DFKI",
      name: "Piper DFKI Türkçe",
      gender: "Nötr / Kadın-Erkek",
      category: "piper",
      provider: "Piper ONNX (Yerel CPU)",
      tone: "Net & Hızlı",
      badge: "Türkçe · Çevrimdışı",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      description: "Tamamen çevrimdışı, internet gerektirmeyen hızlı Türkçe Piper ONNX nöral sesi (tr_TR-dfki-medium).",
      sampleText: "Merhaba! Ben Piper Türkçe yerel nöral ses modeliyim. İnternet olmadan da pürüzsüz konuşuyorum.",
      color: "#10B981",
      rate: 1.0
    },
    {
      id: "Piper-Fahrettin",
      name: "Piper Fahrettin Türkçe",
      gender: "Erkek",
      category: "piper",
      provider: "Piper ONNX (Yerel CPU)",
      tone: "Tok & Dengeli",
      badge: "Türkçe Erkek · Çevrimdışı",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      description: "Doğal Türkçe vurgulara sahip tok ve net yerel Piper ONNX erkek sesi (tr_TR-fahrettin-medium).",
      sampleText: "Selamlar, ben Fahrettin. Yerel Piper motoruyla sıfır gecikmeli akıcı Türkçe konuşuyorum.",
      color: "#059669",
      rate: 1.0
    },
    {
      id: "Piper-Fettah",
      name: "Piper Fettah Türkçe",
      gender: "Erkek",
      category: "piper",
      provider: "Piper ONNX (Yerel CPU)",
      tone: "Dinamik & Net",
      badge: "Çevrimdışı",
      badgeClass: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
      description: "Enerjik tempolu çevrimdışı Türkçe Piper ONNX erkek sesi (tr_TR-fettah-medium).",
      sampleText: "Selam dostum, ben Fettah. Bilgisayarında tamamen çevrimdışı çalışıyorum.",
      color: "#14B8A6",
      rate: 1.0
    },
    {
      id: "Kokoro-af_heart",
      name: "Kokoro-82M Heart",
      gender: "Kadın",
      category: "kokoro",
      provider: "Kokoro-82M ONNX (D:\\)",
      tone: "Milisaniye Hız",
      badge: "82M · Hızlı CPU",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "82M parametreli ışık hızında Kokoro kadın sesi. İngilizce & çok dilli metinlerde milisaniye tepki.",
      sampleText: "Hello! I am Kokoro Heart running natively on CPU at millisecond speed.",
      color: "#F59E0B",
      rate: 1.0
    },
    {
      id: "Kokoro-af_bella",
      name: "Kokoro-82M Bella",
      gender: "Kadın",
      category: "kokoro",
      provider: "Kokoro-82M ONNX (D:\\)",
      tone: "Sıcak & Berrak",
      badge: "82M CPU",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "CPU dostu akıcı Kokoro-82M kadın sesi (af_bella).",
      sampleText: "Hi there! Kokoro Bella is active on your CPU with natural studio warmth.",
      color: "#FB923C",
      rate: 1.0
    },
    {
      id: "Kokoro-am_adam",
      name: "Kokoro-82M Adam",
      gender: "Erkek",
      category: "kokoro",
      provider: "Kokoro-82M ONNX (D:\\)",
      tone: "Dengeli & Net",
      badge: "82M CPU",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "CPU üzerinde anında sentezlenen Kokoro-82M erkek sesi (am_adam).",
      sampleText: "Hello, I am Kokoro Adam, lightweight 82M neural synthesis on CPU.",
      color: "#D97706",
      rate: 1.0
    },
    {
      id: "Kokoro-am_michael",
      name: "Kokoro-82M Michael",
      gender: "Erkek",
      category: "kokoro",
      provider: "Kokoro-82M ONNX (D:\\)",
      tone: "Güçlü & Akıcı",
      badge: "82M CPU",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      description: "Düşük gecikmeli Kokoro-82M erkek asistan sesi (am_michael).",
      sampleText: "Greetings! Kokoro Michael is ready to speak instantly from your D drive.",
      color: "#B45309",
      rate: 1.0
    },
    {
      id: "XTTS-Clone",
      name: "Coqui XTTS-v2 (Ses Klonlama)",
      gender: "Klonlanmış",
      category: "xtts",
      provider: "Coqui XTTS-v2 (D:\\xtts_venv)",
      tone: "Zero-Shot Ses Klonlama",
      badge: "Zero-Shot Klonlama",
      badgeClass: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
      description: "Seçtiğin 6 saniyelik WAV/MP3 ses örneğini Türkçe dahil 17 dilde sıfırdan klonlar.",
      sampleText: "Merhaba! Ben Coqui XTTS v2 ses klonlama motoruyum, örnek sesini birebir konuşabiliyorum.",
      color: "#8B5CF6",
      rate: 1.0
    },
    {
      id: "OpenRouter-Fish-S2.1",
      name: "Fish Audio S2.1 Pro Free",
      gender: "Çok Dilli",
      category: "openrouter",
      provider: "OpenRouter (fish-audio/s2.1-pro-free:free)",
      tone: "Doğal & Duygulu (TR + 80 Dil)",
      badge: "OpenRouter · $0 Free",
      badgeClass: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
      description:
        "OpenRouter üzerinden tamamen ücretsiz ($0) çalışan, Türkçe dahil 80+ dilde doğal ve duygulu konuşan amiral gemisi TTS modeli.",
      sampleText: "Selam dostum! Ben Fish Audio S2.1 Pro, OpenRouter üzerinden ücretsiz ve doğal Türkçe konuşuyorum.",
      color: "#0EA5E9",
      rate: 1.0
    },
    {
      id: "OpenRouter-Fish-S2.1-Clone",
      name: "Fish S2.1 Pro Klonlama Free",
      gender: "Klonlanmış",
      category: "openrouter",
      provider: "OpenRouter (fish-audio/s2.1-pro-free:free)",
      tone: "Bulut Zero-Shot Klonlama",
      badge: "OpenRouter Klon · $0",
      badgeClass: "bg-sky-500/15 text-cyan-300 border border-cyan-500/30",
      description: "Seçtiğin referans WAV/MP3 ses örneğini Fish S2.1 Pro bulut motorunda ücretsiz ($0) olarak klonlar.",
      sampleText: "Merhaba! Seçtiğin referans ses tonunu Fish Audio S2.1 Pro ile bulutta ücretsiz klonluyorum.",
      color: "#0284C7",
      rate: 1.0
    },
    {
      id: "OpenRouter-HeyGen-Nadine",
      name: "HeyGen Voice Turbo · Nadine",
      gender: "Kadın",
      category: "openrouter",
      provider: "OpenRouter (heygen/heygen-voice-1-turbo:free)",
      tone: "Stüdyo 44.1 kHz · TR + 39 Dil",
      badge: "30.11.2026'ya kadar Free",
      badgeClass: "bg-pink-500/15 text-pink-300 border border-pink-500/30",
      description: "HeyGen Voice Turbo Türkçe destekli ücretsiz kadın sesi (44.1 kHz stüdyo WAV dönüşümü ile oynatılır).",
      sampleText: "Merhaba! Ben HeyGen Voice Turbo Nadine. OpenRouter üzerinden ücretsiz stüdyo sesiyle yanındayım.",
      color: "#EC4899",
      rate: 1.0
    },
    {
      id: "OpenRouter-HeyGen-Bram",
      name: "HeyGen Voice Turbo · Bram",
      gender: "Erkek",
      category: "openrouter",
      provider: "OpenRouter (heygen/heygen-voice-1-turbo:free)",
      tone: "Tok & Dengeli · 44.1 kHz",
      badge: "30.11.2026'ya kadar Free",
      badgeClass: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
      description: "Türkçe destekli tok ve kendinden emin HeyGen Voice Turbo erkek asistan sesi (ücretsiz :free).",
      sampleText: "Selam! Ben HeyGen Bram. Projelerinde sana net ve akıcı Türkçe ile eşlik ediyorum.",
      color: "#14B8A6",
      rate: 1.0
    },
    {
      id: "OpenRouter-HeyGen-Noelle",
      name: "HeyGen Voice Turbo · Noelle",
      gender: "Kadın",
      category: "openrouter",
      provider: "OpenRouter (heygen/heygen-voice-1-turbo:free)",
      tone: "Canlı & Berrak · 44.1 kHz",
      badge: "30.11.2026'ya kadar Free",
      badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
      description: "Parlak ve akıcı sohbetler için HeyGen Voice Turbo Noelle ücretsiz kadın sesi (TR + 39 dil).",
      sampleText: "Harika bir gün! Ben HeyGen Noelle, her konuda sohbete hazırım.",
      color: "#F43F5E",
      rate: 1.0
    },
    {
      id: "OpenRouter-HeyGen-Lucian",
      name: "HeyGen Voice Turbo · Lucian",
      gender: "Erkek",
      category: "openrouter",
      provider: "OpenRouter (heygen/heygen-voice-1-turbo:free)",
      tone: "Sakin & Profesyonel · 44.1 kHz",
      badge: "30.11.2026'ya kadar Free",
      badgeClass: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
      description: "Odaklanmış ve sakin anlatımlar için HeyGen Voice Turbo Lucian ücretsiz erkek sesi (TR + 39 dil).",
      sampleText: "Selamlar, ben HeyGen Lucian. Teknik anlatımlar ve günlük sohbetler için buradayım.",
      color: "#6366F1",
      rate: 1.0
    }
  ];

  let previewAudio = null;
  let previewSeq = 0;
  let activePreviewVoiceId = null;

  const PREVIEW_IDLE_HTML = `<svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Dinle</span>`;
  const PREVIEW_LOADING_HTML = `<svg class="w-3.5 h-3.5 text-primary animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span class="text-primary">Hazırlanıyor</span>`;
  const PREVIEW_PLAYING_HTML = `<svg class="w-3.5 h-3.5 text-rose-400" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span class="text-rose-300 font-medium">Durdur</span>`;

  function setVoiceLibStatus(msg, tone = "info") {
    const el = document.getElementById("voice-lib-status-toast");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.dataset.tone = "";
      el.textContent = "";
      return;
    }
    const toneClass =
      tone === "error"
        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
        : tone === "warn"
          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
          : "bg-sky-500/15 text-sky-300 border-sky-500/30";
    el.className = `mx-5 mt-2 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0 ${toneClass}`;
    el.dataset.tone = tone;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function setPreviewButtonState(btn, state) {
    if (!btn || !btn.isConnected) return;
    btn.dataset.previewState = state;
    if (state === "loading") {
      btn.innerHTML = PREVIEW_LOADING_HTML;
      btn.title = "İptal Et";
      btn.classList.add("border-primary/50", "bg-primary/10");
      btn.classList.remove("border-rose-500/50", "bg-rose-500/10");
    } else if (state === "playing") {
      btn.innerHTML = PREVIEW_PLAYING_HTML;
      btn.title = "Oynatmayı Durdur";
      btn.classList.remove("border-primary/50", "bg-primary/10");
      btn.classList.add("border-rose-500/50", "bg-rose-500/10");
    } else {
      btn.innerHTML = PREVIEW_IDLE_HTML;
      btn.title = "Önizlemeyi Dinle";
      btn.classList.remove("border-primary/50", "bg-primary/10", "border-rose-500/50", "bg-rose-500/10");
    }
  }

  function resetAllPreviewButtons() {
    document.querySelectorAll("#voice-library-modal .btn-preview-voice").forEach((b) => {
      setPreviewButtonState(b, "idle");
    });
  }

  function stopVoicePreview(invalidate = true) {
    if (invalidate) previewSeq++;
    activePreviewVoiceId = null;
    if (previewAudio) {
      previewAudio.onended = null;
      previewAudio.onerror = null;
      previewAudio.onpause = null;
      try {
        previewAudio.pause();
      } catch (e) {
        window.luxDebug?.("voice_library.js:480", e);
      }
      try {
        previewAudio.removeAttribute("src");
      } catch (e) {
        window.luxDebug?.("voice_library.js:483", e);
      }
      previewAudio = null;
    }
    resetAllPreviewButtons();
  }

  async function playVoicePreview(voiceId) {
    const voice = VOICE_CATALOG.find((v) => v.id === voiceId) || VOICE_CATALOG[0];
    if (!voice) return;

    // Toggle off if user clicked the currently active (loading or playing) preview button
    if (activePreviewVoiceId === voice.id) {
      const wasPlaying = Boolean(previewAudio);
      stopVoicePreview(true);
      setVoiceLibStatus(wasPlaying ? "" : `${voice.name} önizlemesi iptal edildi.`, "info");
      return;
    }

    stopVoicePreview(true);
    const seq = previewSeq;
    activePreviewVoiceId = voice.id;

    // Pause any active chat/orb sample audio cleanly so preview is audible
    if (window.currentVoiceAudio && window.currentVoiceAudio !== previewAudio) {
      try {
        window.currentVoiceAudio.pause();
      } catch (e) {
        window.luxDebug?.("voice_library.js:509", e);
      }
    }
    if (window.appStore?._sampleAudioPlayer) {
      try {
        window.appStore._sampleAudioPlayer.pause();
      } catch (e) {
        window.luxDebug?.("voice_library.js:514", e);
      }
      window.appStore._sampleAudioPlayer = null;
    }

    const findPreviewBtn = () => document.querySelector(`#voice-library-modal .btn-preview-voice[data-voice-id="${CSS.escape(voice.id)}"]`);
    setPreviewButtonState(findPreviewBtn(), "loading");

    if (!window.luxAPI?.voice?.synthesize) {
      stopVoicePreview(true);
      setVoiceLibStatus("Ses sentez köprüsü (luxAPI.voice) bulunamadı. Uygulamayı yeniden başlat.", "error");
      return;
    }

    const settings = window.appStore?.getVoiceSettings?.() || {};
    const openrouterApiKey = window.appStore?.getOpenRouterApiKey?.() || "";

    if (/^XTTS/i.test(voice.id)) {
      setVoiceLibStatus(
        `${voice.name} hazırlanıyor (CPU ilk yükleme ~45-80 sn sürebilir, beklemek istemezsen başka sese geçebilirsin)...`,
        "info"
      );
    } else if (/^(Piper|Kokoro)-/i.test(voice.id)) {
      setVoiceLibStatus(`${voice.name} yerel ses motoru hazırlanıyor...`, "info");
    } else if (/^OpenRouter-/i.test(voice.id)) {
      setVoiceLibStatus(`${voice.name} OpenRouter üzerinden hazırlanıyor...`, "info");
    } else {
      setVoiceLibStatus(`${voice.name} hazırlanıyor...`, "info");
    }

    try {
      const res = await window.luxAPI.voice.synthesize(
        voice.sampleText,
        voice.id,
        voice.rate,
        settings.engineMode || "auto",
        settings.cloneRefPath || "",
        { openrouterApiKey }
      );

      if (seq !== previewSeq) return;

      if (!res) {
        stopVoicePreview(false);
        setVoiceLibStatus("Ses servisinden yanıt alınamadı.", "error");
        return;
      }

      if (!res.success || !res.audioBase64) {
        stopVoicePreview(false);
        setVoiceLibStatus(res.error || "Ses önizleme sentezlenemedi.", "error");
        if (res.missingApiKey || (/^OpenRouter-/i.test(voice.id) && !openrouterApiKey)) {
          document.getElementById("voice-lib-openrouter-bar")?.classList.remove("hidden");
          document.getElementById("voice-lib-or-key-input")?.focus();
        }
        return;
      }

      let hasStickyNotice = false;
      if (res.fallbackFrom) {
        hasStickyNotice = true;
        if (/^OpenRouter-/i.test(voice.id)) {
          setVoiceLibStatus(`OpenRouter kullanılamadı (${res.fallbackFrom}) — yerel yedek ses çalınıyor.`, "warn");
          if (!openrouterApiKey) {
            document.getElementById("voice-lib-openrouter-bar")?.classList.remove("hidden");
          }
        } else {
          setVoiceLibStatus(`${voice.name} yerine yerel yedek çalınıyor: ${res.fallbackFrom}`, "warn");
        }
      } else if (Number(settings.volume ?? 100) === 0) {
        hasStickyNotice = true;
        setVoiceLibStatus("Ses düzeyi %0 olarak ayarlı! Önizlemeyi duymak için Sesli Mod'dan ses düzeyini artır.", "warn");
      } else {
        setVoiceLibStatus(`🔊 ${voice.name} çalınıyor...`, "info");
      }

      const audio = new Audio(res.audioBase64);
      previewAudio = audio;
      audio.volume = Math.max(0, Math.min(1, Number(settings.volume ?? 100) / 100));
      if (/^openrouter-/i.test(res.engine || "")) {
        audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(settings.speed || voice.rate || 1.0)));
      }

      audio.onended = () => {
        if (seq !== previewSeq) return;
        activePreviewVoiceId = null;
        if (previewAudio === audio) previewAudio = null;
        resetAllPreviewButtons();
        if (!hasStickyNotice) setVoiceLibStatus("", "info");
      };

      audio.onerror = () => {
        if (seq !== previewSeq) return;
        activePreviewVoiceId = null;
        if (previewAudio === audio) previewAudio = null;
        resetAllPreviewButtons();
        setVoiceLibStatus("Ses verisi oynatılamadı (format veya ses aygıtı hatası).", "error");
      };

      setPreviewButtonState(findPreviewBtn(), "playing");

      try {
        await audio.play();
        if (seq !== previewSeq) {
          try {
            audio.pause();
          } catch (e) {
            window.luxDebug?.("voice_library.js:619", e);
          }
          return;
        }
      } catch (playErr) {
        if (seq !== previewSeq) return;
        activePreviewVoiceId = null;
        if (previewAudio === audio) previewAudio = null;
        resetAllPreviewButtons();
        setVoiceLibStatus(`Ses oynatılamadı: ${playErr?.message || playErr?.name || "Oynatma izni/hatası"}`, "error");
      }
    } catch (err) {
      if (seq !== previewSeq) return;
      console.warn("Preview audio playback error:", err);
      stopVoicePreview(false);
      setVoiceLibStatus(err?.message || "Ses önizleme hatası oluştu.", "error");
    }
  }

  function openVoiceLibraryModal() {
    stopVoicePreview(true);
    document.getElementById("voice-library-modal")?.remove();

    const activeSettings = window.appStore?.getVoiceSettings() || { voice: "Fola" };
    const activeVoiceId = activeSettings.voice || "Fola";

    const modal = document.createElement("div");
    modal.id = "voice-library-modal";
    modal.className = "lux-modal-backdrop show flex items-center justify-center";
    modal.style.cssText =
      "position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); z-index: 2500; display: flex; align-items: center; justify-content: center;";
    modal.innerHTML = `
      <div class="lux-modal max-w-2xl w-full max-h-[90vh] mx-4 bg-[#121216] border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative select-none">
        
        <!-- Header -->
        <div class="p-5 border-b border-border/50 flex items-center justify-between shrink-0 bg-sidebar/50">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-foreground m-0">Harici Stüdyo Ses Kütüphanesi</h3>
              <p class="text-xs text-muted-foreground m-0 mt-0.5">Gemini Live ve Lux standartlarında yüksek kaliteli nöral ses modelleri</p>
            </div>
          </div>
          <button type="button" id="btn-close-voice-lib" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors" title="Kapat">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Provider Filter Pills -->
        <div class="px-5 py-2.5 bg-sidebar/20 border-b border-border/40 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 custom-scrollbar" id="voice-filter-container">
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors bg-primary text-primary-foreground" data-filter="all">Tümü (${VOICE_CATALOG.length})</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="openrouter">OpenRouter Ücretsiz (:free)</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="neural">Türkçe Nöral</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="piper">Piper Yerel TR</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="kokoro">Kokoro-82M</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="xtts">XTTS-v2 Klon</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="elevenlabs">ElevenLabs TR</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="cartesia">Cartesia Sonic</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="deepgram">Deepgram Aura</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="qwen">Qwen3 / Açık Kaynak</button>
          <button type="button" class="voice-filter-pill shrink-0 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary" data-filter="character">Kötü Karakter (Villainess)</button>
        </div>

        <!-- Inline Status Notice -->
        <div id="voice-lib-status-toast" class="hidden"></div>

        <!-- Quick OpenRouter Key Bar (shown when openrouter filter is active or OpenRouter voice is active/selected without key) -->
        ${(() => {
          const curOrKey = window.appStore?.getOpenRouterApiKey?.() || "";
          const showInitially = /^OpenRouter-/i.test(activeVoiceId) && !curOrKey;
          return `
            <div id="voice-lib-openrouter-bar" class="mx-5 mt-3 p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 ${showInitially ? "" : "hidden"}">
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                  <span>⚡ OpenRouter :free Ses Anahtarı (Ücretsiz · $0)</span>
                  <span id="voice-lib-or-key-badge" class="text-[10px] px-1.5 py-0.5 rounded font-mono ${curOrKey ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}">${curOrKey ? "✓ Bağlı" : "Anahtar Gerekli"}</span>
                </span>
                <span class="text-[11px] text-muted-foreground">Kota: 20 istek/dk · 50 istek/gün (kredi yüklenirse 1000/gün). Anahtarın yerel olarak kaydedilir.</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <input type="password" id="voice-lib-or-key-input" value="${escapeHtml(curOrKey)}" placeholder="sk-or-v1-..." class="px-2.5 py-1.5 rounded-lg bg-[#0d0e12] border border-border/70 text-xs font-mono text-foreground w-48 outline-none focus:border-sky-400" />
                <button type="button" id="btn-voice-lib-save-or-key" class="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer transition-colors">Kaydet</button>
              </div>
            </div>
          `;
        })()}

        <!-- Voice Grid List -->
        <div class="p-5 flex flex-col gap-3 flex-1 min-h-[200px] overflow-y-auto custom-scrollbar" id="voice-cards-list">
          ${VOICE_CATALOG.map((v) => {
            const isSelected = v.id === activeVoiceId;
            const supportsClone = v.id === "XTTS-Clone" || v.id === "OpenRouter-Fish-S2.1-Clone";
            const cloneRefName = activeSettings.cloneRefPath ? activeSettings.cloneRefPath.split(/[\\/]/).pop() : "Varsayılan TR Örneği";
            return `
              <div class="voice-card p-4 rounded-xl border ${isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border/60 bg-card/30 hover:bg-card/70 hover:border-border"} transition-all flex items-center justify-between gap-4 group" data-category="${v.category || "neural"}">
                <div class="flex items-center gap-3.5 flex-1 min-w-0">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md" style="background: linear-gradient(135deg, ${v.color}, #1f2937);">
                    ${v.name[0]}
                  </div>
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-foreground">${escapeHtml(v.name)}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${v.badgeClass}">${v.badge}</span>
                      <span class="text-xs text-muted-foreground">(${v.gender} · ${v.tone})</span>
                    </div>
                    <p class="text-xs text-muted-foreground m-0 truncate">${escapeHtml(v.description)}</p>
                    ${supportsClone ? `<span class="text-[10px] text-purple-300 font-mono truncate">Referans: ${escapeHtml(cloneRefName)}</span>` : ""}
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  ${
                    supportsClone
                      ? `
                    <button type="button" class="btn-pick-clone-wav-inline px-2.5 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-[11px] text-purple-300 cursor-pointer transition-colors" title="Klonlanacak referans ses dosyasını seç">
                      Referans Seç
                    </button>
                  `
                      : ""
                  }
                  <!-- Play Preview Button -->
                  <button type="button" class="btn-preview-voice px-3 py-1.5 rounded-lg border border-border/80 hover:bg-secondary text-xs text-secondary-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer" data-voice-id="${v.id}" title="Önizlemeyi Dinle">
                    <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Dinle</span>
                  </button>

                  <!-- Select Button -->
                  <button type="button" class="btn-select-voice px-3.5 py-1.5 rounded-lg ${isSelected ? "bg-primary text-primary-foreground font-medium" : "bg-secondary hover:bg-secondary/80 text-foreground"} text-xs transition-colors cursor-pointer" data-voice-id="${v.id}">
                    ${isSelected ? "✓ Aktif" : "Seç"}
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Footer Notice -->
        <div class="p-3.5 bg-sidebar/40 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground px-5">
          <span>Yerel D:\\ motorları (Piper TR, Kokoro-82M, XTTS-v2) ve OpenRouter :free bulut ağları üzerinden sentezlenir. Mekanik TTS devre dışıdır.</span>
          <span class="text-emerald-400 font-medium shrink-0 ml-2">● ${VOICE_CATALOG.length} Stüdyo Modeli Aktif</span>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const closeVoiceLibModal = () => {
      stopVoicePreview(true);
      document.removeEventListener("keydown", onEscClose);
      modal.remove();
    };

    const onEscClose = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeVoiceLibModal();
      }
    };
    document.addEventListener("keydown", onEscClose);

    modal.querySelector("#btn-close-voice-lib")?.addEventListener("click", closeVoiceLibModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeVoiceLibModal();
      }
    });

    modal.querySelectorAll(".voice-filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const filter = pill.getAttribute("data-filter");
        modal.querySelectorAll(".voice-filter-pill").forEach((p) => {
          p.classList.remove("bg-primary", "text-primary-foreground");
          p.classList.add("text-muted-foreground");
        });
        pill.classList.remove("text-muted-foreground");
        pill.classList.add("bg-primary", "text-primary-foreground");

        const orBar = modal.querySelector("#voice-lib-openrouter-bar");
        if (orBar) {
          if (filter === "openrouter") orBar.classList.remove("hidden");
          else if (window.appStore?.getOpenRouterApiKey?.()) orBar.classList.add("hidden");
        }

        modal.querySelectorAll(".voice-card").forEach((card) => {
          const cat = card.getAttribute("data-category");
          if (filter === "all" || cat === filter) {
            card.style.display = "flex";
          } else {
            card.style.display = "none";
          }
        });
      });
    });

    const saveOrKeyBtn = modal.querySelector("#btn-voice-lib-save-or-key");
    const orKeyInput = modal.querySelector("#voice-lib-or-key-input");
    const orKeyBadge = modal.querySelector("#voice-lib-or-key-badge");
    saveOrKeyBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const val = (orKeyInput?.value || "").trim();
      window.appStore?.setOpenRouterApiKey?.(val);
      if (orKeyBadge) {
        orKeyBadge.textContent = val ? "✓ Bağlı" : "Anahtar Gerekli";
        orKeyBadge.className = `text-[10px] px-1.5 py-0.5 rounded font-mono ${val ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`;
      }
      const settingsOrInput = document.getElementById("settings-voice-openrouter-key-input");
      if (settingsOrInput) settingsOrInput.value = val;
      setVoiceLibStatus(
        val ? "OpenRouter API anahtarı kaydedildi. Ücretsiz sesleri hemen dinleyebilirsin!" : "OpenRouter anahtarı temizlendi.",
        val ? "info" : "warn"
      );
    });

    modal.querySelectorAll(".btn-pick-clone-wav-inline").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const picked = await window.luxAPI?.voice?.pickCloneAudio?.();
        if (picked && !picked.canceled && picked.path) {
          window.appStore?.setVoiceSetting("cloneRefPath", picked.path);
          closeVoiceLibModal();
          openVoiceLibraryModal();
        }
      });
    });

    modal.querySelectorAll(".btn-preview-voice").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const vid = btn.getAttribute("data-voice-id");
        if (vid) playVoicePreview(vid);
      });
    });

    modal.querySelectorAll(".btn-select-voice").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const vid = btn.getAttribute("data-voice-id");
        if (vid) {
          window.appStore?.setVoiceSetting("voice", vid);
          stopVoicePreview(true);
          document.removeEventListener("keydown", onEscClose);
          modal.remove();
          // Update any open settings or HUD labels
          const lbl = document.getElementById("settings-voice-current-label");
          if (lbl) lbl.textContent = vid;
          const hudLbl = document.getElementById("hud-voice-current-name");
          if (hudLbl) hudLbl.textContent = vid;
          // Play confirmation chime
          if (window.playLuxSound) window.playLuxSound("responseReceived1");
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  window.luxVoiceLibrary = {
    catalog: VOICE_CATALOG,
    playPreview: playVoicePreview,
    stopPreview: stopVoicePreview,
    openModal: openVoiceLibraryModal
  };

  // Bind change buttons to open this new Voice Library Modal
  window.openChooseVoiceModal = openVoiceLibraryModal;

  // Delegated click handler so clicking "Değiştir" always opens the modal regardless of how Settings rendered
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btn-settings-change-voice");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      openVoiceLibraryModal();
    }
  });
})();
