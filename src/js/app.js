// Main Renderer Orchestrator for Lux AI

let currentZoomLevel = 1.0;

document.addEventListener("DOMContentLoaded", async () => {
  // Kalıcı state (userData/lux_ai_data.json) varsa localStorage kopyasının
  // üzerine bindir. localStorage kotası dolduğunda veri kaybını önler.
  try {
    const hydrated = await window.appStore?.hydrateFromDurable?.();
    if (hydrated) window.renderApp?.();
  } catch (_) {}

  setupModals();
  window.applyAccentTheme?.(window.appStore?.state?.appearance?.accentColor);
  const wsDir = window.appStore?.state?.application?.workspaceDir;
  if (wsDir && window.luxAPI?.setWorkspaceDir) {
    window.luxAPI.setWorkspaceDir(wsDir).catch(() => {});
  }
  if (window.luxAPI?.getAppInfo) {
    window.luxAPI
      .getAppInfo()
      .then((info) => {
        if (info) window.luxAppInfo = info;
      })
      .catch(() => {});
  }
  window.renderApp();

  // Subscribe store changes
  window.appStore.subscribe(() => {
    updateLayoutVisibility();
  });

  setupHeaderEvents();
  setupComposerEvents();
  setupKeyboardShortcuts();
  setupSidebarResize();
  if (window.initVoiceMode) window.initVoiceMode();
  setTimeout(() => {
    if (window.discoverLocalAIModels) {
      window.discoverLocalAIModels({ silent: true });
    }
  }, 650);
});

window.updateTopbarNavigation = function () {
  const project = window.appStore.getActiveProject();
  const conv = window.appStore.getActiveConversation();

  const projectBreadcrumb = document.getElementById("breadcrumb-project");
  const convBreadcrumb = document.getElementById("breadcrumb-conv");
  if (projectBreadcrumb) projectBreadcrumb.textContent = project ? project.name : "LUX_ai";
  if (convBreadcrumb) convBreadcrumb.textContent = conv ? conv.title : "Yeni Sohbet";

  const btnBack = document.getElementById("btn-nav-back");
  const btnFwd = document.getElementById("btn-nav-forward");
  const canBack = Boolean(window.appStore.canGoBack?.());
  const canFwd = Boolean(window.appStore.canGoForward?.());

  if (btnBack) {
    btnBack.disabled = !canBack;
    btnBack.classList.toggle("opacity-35", !canBack);
    btnBack.classList.toggle("pointer-events-none", !canBack);
  }
  if (btnFwd) {
    btnFwd.disabled = !canFwd;
    btnFwd.classList.toggle("opacity-35", !canFwd);
    btnFwd.classList.toggle("pointer-events-none", !canFwd);
  }
};

window.renderApp = function () {
  const state = window.appStore.state;

  // Update Breadcrumb & History Buttons
  window.updateTopbarNavigation();

  // Render Sub-components
  renderSidebar();
  renderChat();
  renderRightPanel();
  renderIdePanel();

  // Update Composer Model & Mode labels
  const modelLabel = document.getElementById("composer-model-label");
  if (modelLabel) modelLabel.textContent = state.selectedModel || "Model Seç";

  const modeLabel = document.getElementById("composer-mode-label");
  if (modeLabel) modeLabel.textContent = state.selectedMode;

  const hudVoiceName = document.getElementById("hud-voice-current-name");
  if (hudVoiceName && window.appStore?.getVoiceSettings) {
    hudVoiceName.textContent = window.appStore.getVoiceSettings().voice || "Fola";
  }

  updateComposerModelDropdown();
  updateLayoutVisibility();
};

const KNOWN_PROVIDER_SUBMODELS = {
  "9Router": [
    {
      id: "oc/flint-40b-free",
      name: "Flint 40B",
      tag: "40B Parametre",
      badge: "Önerilen",
      desc: "OpenCode yüksek kapasiteli, kararlı ve çok hızlı yanıt veren model"
    },
    { id: "oc/beam-free", name: "Beam Free", tag: "Hızlı & Kotasız", badge: "Hızlı", desc: "OpenCode kotasız ultra hızlı çalışan model" },
    {
      id: "oc/deepseek-v4.1-flash-free",
      name: "DeepSeek v4.1 Flash",
      tag: "Flash Free",
      badge: "Gelişmiş",
      desc: "DeepSeek yüksek zeka ve akıl yürütme modeli"
    },
    { id: "bzl/auto:free", name: "BazaarLink Auto", tag: "Auto Free", badge: "Ücretsiz", desc: "BazaarLink otomatik serbest model" }
  ],
  "Ollama (Yerel)": [
    {
      id: "qwen2.5:3b",
      name: "Qwen 2.5 3B",
      tag: "3B · Hızlı CPU",
      badge: "Önerilen",
      desc: "Anlık streaming (~1.1s TTFT) sunan hafif yerel Türkçe CPU modeli"
    },
    {
      id: "qwen3.5:4b",
      name: "Qwen 3.5 4B",
      tag: "4B · Seri Tepki",
      badge: "Hızlı 4B",
      desc: "Düşük gecikmeli kompakt Türkçe model (~0.45s sıcak TTFT)"
    },
    {
      id: "qwen2.5:7b",
      name: "Qwen 2.5 7B",
      tag: "7B · Altın Türkçe",
      badge: "Dengeli 7B",
      desc: "Kodlama ve kapsamlı görevler için güçlü yerel model (CPU'da daha yavaş)"
    },
    {
      id: "qwen3:8b",
      name: "Qwen 3 8B",
      tag: "8B · Akıl Yürütme",
      badge: "8B Akıllı",
      desc: "Gelişmiş muhakeme, araç yürütme ve Türkçe sohbet"
    },
    {
      id: "qwen2.5:14b",
      name: "Qwen 2.5 14B",
      tag: "14B · Derin Zeka",
      badge: "14B Pro",
      desc: "Yüksek RAM ile derin kodlama ve analiz gücü"
    }
  ],
  "Google Gemini": [
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash-Lite",
      tag: "Ultra Hızlı · Ücretsiz Katman",
      badge: "Önerilen",
      desc: "Google AI Studio aktif ücretsiz katman: en düşük gecikme ve sesli sohbet uyumu"
    },
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      tag: "1M Bağlam · Ücretsiz Katman",
      badge: "Hızlı",
      desc: "Ücretsiz katmanda güçlü ajan araçları ve çok modlu zeka"
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      tag: "1M Bağlam · Ücretsiz Katman",
      badge: "Kararlı",
      desc: "Google AI Studio kararlı Flash modeli (Aralık 2026'da 3.5 Flash-Lite'a yönlenir)"
    }
  ],
  OpenAI: [
    { id: "gpt-4o", name: "GPT-4o", tag: "Omni Model", badge: "Önerilen", desc: "Yüksek zeka ve çok modlu" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", tag: "Ekonomik & Hızlı", badge: "Mini", desc: "Hızlı ve düşük gecikmeli" },
    { id: "o1", name: "OpenAI o1", tag: "Akıl Yürütme", badge: "Muhakeme", desc: "Adım adım derin düşünme" },
    { id: "o3-mini", name: "o3-mini", tag: "Hızlı Akıl Yürütme", badge: "Yeni", desc: "Gelişmiş mantık ve kodlama" }
  ],
  Anthropic: [
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      tag: "Kod ve Mantık",
      badge: "Önerilen",
      desc: "Mükemmel kod yazma yeteneği"
    },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", tag: "Yüksek Hız", badge: "Hızlı", desc: "Hafif ve çevik model" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", tag: "Derin Analiz", badge: "Opus", desc: "Kapsamlı bağlam ve analiz" }
  ],
  DeepSeek: [
    { id: "deepseek-chat", name: "DeepSeek V3", tag: "Genel Zeka", badge: "Önerilen", desc: "DeepSeek V3 sohbet motoru" },
    { id: "deepseek-reasoner", name: "DeepSeek R1", tag: "Düşünce Zinciri", badge: "Muhakeme", desc: "R1 derin mantık ve matematik" }
  ],
  OpenRouter: [
    {
      id: "openrouter/free",
      name: "Free Models Auto-Router",
      tag: "200K · Araç + Akıl Yürütme · Otomatik Yedek",
      badge: "Önerilen",
      desc: "Çalışan tüm ücretsiz OpenRouter modelleri arasında otomatik geçiş yapar (429 korumalı)"
    },
    {
      id: "nvidia/nemotron-3.5-lightning:free",
      name: "NVIDIA Nemotron 3.5 Lightning",
      tag: "1M Bağlam · Hızlı Ajan",
      badge: "Hızlı",
      desc: "Düşük gecikmeli ajan iş akışları ve sesli mod ($0)"
    },
    {
      id: "google/gemma-4-26b-a4b-it:free",
      name: "Google Gemma 4 26B A4B MoE",
      tag: "256K · Hızlı Çok Modlu",
      badge: "Hızlı",
      desc: "Hızlı MoE mimarili Gemma 4 (metin, görsel, video destekli)"
    },
    {
      id: "cohere/north-mini-code:free",
      name: "Cohere North Mini Code",
      tag: "256K · Kodlama + Ajan",
      badge: "Hızlı",
      desc: "30B toplam / 3B aktif parametreli hızlı ajan ve kod üretimi ($0)"
    },
    {
      id: "liquid/lfm-3-1.7b:free",
      name: "Liquid LFM3-1.7B",
      tag: "256K · Ultra Hızlı Araç",
      badge: "Hızlı",
      desc: "Çok dilli hızlı sohbet ve araç çağırma için hafif 1.7B model"
    },
    {
      id: "google/gemma-4-31b-it:free",
      name: "Google Gemma 4 31B",
      tag: "256K · Metin + Görsel + Video",
      badge: "Ücretsiz",
      desc: "Google Gemma 4 yüksek muhakeme ve çok modlu ücretsiz LLM ($0)"
    },
    {
      id: "nvidia/nemotron-3-ultra-550b-a55b:free",
      name: "NVIDIA Nemotron 3 Ultra 550B",
      tag: "1M Bağlam · MoE Pro",
      badge: "Ücretsiz",
      desc: "550B MoE (55B aktif) 1 milyon bağlamlı dev ücretsiz model (daha ağır yanıt süresi)"
    },
    {
      id: "nvidia/nemotron-3.5-super-vl:free",
      name: "NVIDIA Nemotron 3.5 Super VL",
      tag: "1M · GUI + Görsel/Video",
      badge: "Ücretsiz",
      desc: "Ekran, belge, GUI analizi ve kodlama için multimodal model"
    },
    {
      id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      name: "NVIDIA Nemotron 3 Nano Omni",
      tag: "256K · Ses + Görsel + Video",
      badge: "Ücretsiz",
      desc: "Ses, video, görsel ve metni tek yerde işleyen akıl yürütme modeli"
    },
    {
      id: "thinkingmachines/inkling-2-small:free",
      name: "Inkling 2 Small",
      tag: "1M Bağlam · Metin + Görsel",
      badge: "Ücretsiz",
      desc: "1M token bağlam penceresi, kodlama ve araç çağırma ($0)"
    },
    {
      id: "dots-studio/dots-3-note-preview:free",
      name: "Dots3-Note Preview",
      tag: "512K · Metin + Görsel",
      badge: "Ücretsiz",
      desc: "Uzun belge, analiz ve görsel okuma için 512K bağlamlı model"
    },
    {
      id: "recursive/flint-v1.0:free",
      name: "Recursive Flint v1.0",
      tag: "256K · Kod + Araştırma",
      badge: "Ücretsiz",
      desc: "Derin kodlama, muhakeme ve araştırma için optimize ücretsiz LLM"
    },
    {
      id: "liquid/lfm-2.5-2.6b:free",
      name: "Liquid LFM2.5-2.6B",
      tag: "64K · Hafif Özet/RAG",
      badge: "Ücretsiz",
      desc: "Hızlı veri çıkarımı, özetleme ve RAG görevleri ($0)"
    }
  ]
};

KNOWN_PROVIDER_SUBMODELS["Ollama / Yerel"] = KNOWN_PROVIDER_SUBMODELS["Ollama (Yerel)"];
window.KNOWN_PROVIDER_SUBMODELS = KNOWN_PROVIDER_SUBMODELS;

function isOpenRouterFreeChatModel(m) {
  if (!m || !m.id) return false;
  const id = String(m.id);
  if (/^(?:google\/lyria-|fish-audio\/|heygen\/)/i.test(id)) return false;
  const pr = m.pricing || {};
  const isZero = String(pr.prompt) === "0" && String(pr.completion) === "0";
  if (!isZero && !id.endsWith(":free") && id !== "openrouter/free") return false;
  const outMods = m.architecture?.output_modalities || ["text"];
  return Array.isArray(outMods) ? outMods.includes("text") : true;
}
window.isOpenRouterFreeChatModel = isOpenRouterFreeChatModel;

window.luxLocalDiscoveryState = {
  skipped: false,
  lastRun: null,
  reason: "",
  runtimes: []
};

async function probeEndpointWithTimeout(url, timeoutMs = 1500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

window.discoverLocalAIModels = async function ({ silent = true } = {}) {
  const perms = window.appStore?.getPermissions?.() || {};
  if (perms.network_localhost === false) {
    window.luxLocalDiscoveryState = {
      skipped: true,
      lastRun: Date.now(),
      reason: "Yerel ağ izni (network_localhost) kapalı olduğu için otomatik tarama atlandı.",
      runtimes: []
    };
    return window.luxLocalDiscoveryState;
  }

  const probeOllama = async () => {
    const tags = await probeEndpointWithTimeout("http://127.0.0.1:11434/api/tags", 1500);
    if (tags && Array.isArray(tags.models)) {
      const ids = tags.models.map((m) => m.name || m.model).filter(Boolean);
      return { online: true, ids };
    }
    const v1 = await probeEndpointWithTimeout("http://127.0.0.1:11434/v1/models", 1500);
    if (v1 && Array.isArray(v1.data)) {
      const ids = v1.data.map((m) => m.id).filter(Boolean);
      return { online: true, ids };
    }
    return { online: false, ids: [] };
  };

  const probeOpenAIV1 = async (port) => {
    const data = await probeEndpointWithTimeout(`http://127.0.0.1:${port}/v1/models`, 1500);
    if (data && Array.isArray(data.data)) {
      const ids = data.data.map((m) => m.id).filter(Boolean);
      return { online: true, ids };
    }
    return { online: false, ids: [] };
  };

  const models = window.appStore?.getModels?.() || [];
  const selectedName = window.appStore?.state?.selectedModel || "";
  const activeCard = models.find((m) => m.name === selectedName);
  const activeIsOllama = Boolean(
    activeCard &&
    (activeCard.name === "Ollama (Yerel)" || activeCard.provider === "Ollama / Yerel" || activeCard.endpoint?.includes("11434"))
  );
  const hasOllamaCard = models.some((m) => m.name === "Ollama (Yerel)" || m.provider === "Ollama / Yerel" || m.endpoint?.includes("11434"));
  const hasLmsCard = models.some((m) => m.endpoint?.includes("1234") || m.name.includes("LM Studio"));
  const hasNineRouterCard = models.some((m) => m.name === "9Router" || m.endpoint?.includes("20128"));

  let [ollamaRes, lmStudioRes, nineRouterRes] = await Promise.all([
    !silent || hasOllamaCard ? probeOllama() : Promise.resolve({ online: false, ids: [] }),
    !silent || hasLmsCard ? probeOpenAIV1(1234) : Promise.resolve({ online: false, ids: [] }),
    !silent || hasNineRouterCard ? probeOpenAIV1(20128) : Promise.resolve({ online: false, ids: [] })
  ]);

  // Only start Ollama daemon automatically if user actively selected Ollama OR explicitly ran manual discovery
  if (!ollamaRes.online && (activeIsOllama || !silent) && window.luxAPI?.ensureOllama) {
    try {
      const started = await window.luxAPI.ensureOllama();
      if (started?.running) {
        ollamaRes = await probeOllama();
      }
    } catch (_) {}
  }

  let changed = false;

  // 1. Sync existing Ollama (11434) card if present (never force-recreate a deleted card)
  if (ollamaRes.online) {
    const pickPreferredOllamaModel = (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return "qwen2.5:3b";
      return (
        ids.find((id) => id === "qwen3.5:4b") ||
        ids.find((id) => id === "qwen2.5:3b") ||
        ids.find((id) => id === "qwen2.5:7b") ||
        ids.find((id) => id === "qwen3:8b") ||
        ids.find((id) => id === "qwen2.5:14b") ||
        ids.find((id) => id.includes("qwen2.5")) ||
        ids.find((id) => id.includes("qwen3")) ||
        ids[0]
      );
    };

    if (ollamaRes.ids.length > 0) {
      const existingPresets = KNOWN_PROVIDER_SUBMODELS["Ollama (Yerel)"] || [];
      KNOWN_PROVIDER_SUBMODELS["Ollama (Yerel)"] = ollamaRes.ids.map((id) => {
        const known = existingPresets.find((p) => p.id === id);
        return known
          ? { ...known, tag: `${known.tag} · Aktif` }
          : {
              id,
              name: id,
              tag: "Yerel Ollama",
              badge: id.includes("14b")
                ? "14B Pro"
                : id.includes("7b") || id.includes("8b")
                  ? "Türkçe 7B+"
                  : id.includes("3b") || id.includes("4b")
                    ? "Hızlı CPU"
                    : "Yüklü",
              desc: "Yerel Ollama (D:\\LuxAI_Models) üzerinden algılandı"
            };
      });
      KNOWN_PROVIDER_SUBMODELS["Ollama / Yerel"] = KNOWN_PROVIDER_SUBMODELS["Ollama (Yerel)"];
    }

    const ollamaCard = models.find((m) => m.name === "Ollama (Yerel)" || m.provider === "Ollama / Yerel" || m.endpoint?.includes("11434"));
    if (ollamaCard) {
      ollamaCard.status = "success";
      ollamaCard.lastTested = `Çevrimiçi (${ollamaRes.ids.length} model)`;
      if (ollamaRes.ids.length > 0 && !ollamaRes.ids.includes(ollamaCard.modelId)) {
        ollamaCard.modelId = pickPreferredOllamaModel(ollamaRes.ids);
      }
      changed = true;
    }
  }

  // 2. Sync existing LM Studio (1234) card if present (never force-recreate a deleted card)
  if (lmStudioRes.online) {
    if (lmStudioRes.ids.length > 0) {
      KNOWN_PROVIDER_SUBMODELS["LM Studio (Yerel)"] = lmStudioRes.ids.map((id) => ({
        id,
        name: id,
        tag: "LM Studio (1234)",
        badge: "Yerel",
        desc: "LM Studio üzerinden algılandı"
      }));
    }
    const lmsCard = models.find((m) => m.endpoint?.includes("1234") || m.name.includes("LM Studio"));
    if (lmsCard) {
      lmsCard.status = "success";
      lmsCard.lastTested = `Çevrimiçi (${lmStudioRes.ids.length} model)`;
      if (lmStudioRes.ids.length > 0 && !lmStudioRes.ids.includes(lmsCard.modelId)) {
        lmsCard.modelId = lmStudioRes.ids[0];
      }
      changed = true;
    }
  }

  // 3. Sync 9Router (20128)
  if (nineRouterRes.online) {
    if (nineRouterRes.ids.length > 0) {
      const basePresets = KNOWN_PROVIDER_SUBMODELS["9Router"] || [];
      const merged = basePresets.slice();
      nineRouterRes.ids.forEach((id) => {
        if (!merged.some((item) => item.id === id)) {
          const isFree = id.includes("free") || id.startsWith("oc/");
          merged.push({
            id,
            name: id,
            tag: "9Router Havuzu",
            badge: isFree ? "Ücretsiz" : "9Router"
          });
        }
      });
      KNOWN_PROVIDER_SUBMODELS["9Router"] = merged;
    }
    const routerCard = models.find((m) => m.name === "9Router" || m.endpoint?.includes("20128"));
    if (routerCard) {
      routerCard.status = "success";
      routerCard.lastTested = `Otomatik keşfedildi (${nineRouterRes.ids.length} model)`;
      changed = true;
    }
  }

  window.luxLocalDiscoveryState = {
    skipped: false,
    lastRun: Date.now(),
    reason: "",
    runtimes: [
      { id: "ollama", label: "Ollama", port: 11434, online: ollamaRes.online, modelsCount: ollamaRes.ids.length, models: ollamaRes.ids },
      {
        id: "lmstudio",
        label: "LM Studio",
        port: 1234,
        online: lmStudioRes.online,
        modelsCount: lmStudioRes.ids.length,
        models: lmStudioRes.ids
      },
      {
        id: "9router",
        label: "9Router",
        port: 20128,
        online: nineRouterRes.online,
        modelsCount: nineRouterRes.ids.length,
        models: nineRouterRes.ids
      }
    ]
  };

  if (changed && window.appStore) {
    window.appStore.saveState();
  }
  if ((changed || !silent) && typeof window.renderApp === "function") {
    window.renderApp();
  }
  return window.luxLocalDiscoveryState;
};

function closeSubModelFlyout() {
  document.getElementById("lux-submodel-flyout")?.remove();
}

function openSubModelFlyout(targetItemEl, providerModel) {
  closeSubModelFlyout();

  const providerName = providerModel.name;
  const isOpenRouterProvider = providerModel.provider === "OpenRouter" || /openrouter\.ai/i.test(providerModel.endpoint || "");
  let submodels = (
    KNOWN_PROVIDER_SUBMODELS[providerName] ||
    KNOWN_PROVIDER_SUBMODELS[providerModel.provider] ||
    (isOpenRouterProvider ? KNOWN_PROVIDER_SUBMODELS["OpenRouter"] : null) ||
    []
  ).slice();

  if (submodels.length === 0) {
    if (providerModel.endpoint?.includes("1234") || providerModel.name.includes("LM Studio")) {
      submodels = (KNOWN_PROVIDER_SUBMODELS["LM Studio (Yerel)"] || []).slice();
    } else if (providerModel.provider.includes("Yerel") || providerModel.endpoint?.includes("11434")) {
      submodels = (KNOWN_PROVIDER_SUBMODELS["Ollama (Yerel)"] || []).slice();
    } else if (providerModel.endpoint?.includes("20128")) {
      submodels = (KNOWN_PROVIDER_SUBMODELS["9Router"] || []).slice();
    } else {
      submodels = [{ id: providerModel.modelId || "default", name: providerModel.name, tag: "Aktif Model", badge: "Varsayılan" }];
    }
  }

  const hasEffectiveOpenRouterKey =
    isOpenRouterProvider && Boolean((providerModel.apiKey || "").trim() || window.appStore?.getOpenRouterApiKey?.());

  // Ensure current active modelId is in the list
  if (providerModel.modelId && !submodels.some((sm) => sm.id === providerModel.modelId)) {
    submodels.unshift({
      id: providerModel.modelId,
      name: providerModel.modelId,
      tag: "Özel Model",
      badge: "Kullanıcı"
    });
  }

  const flyout = document.createElement("div");
  flyout.id = "lux-submodel-flyout";
  flyout.className = "lux-submodel-flyout";
  flyout.style.position = "fixed";
  flyout.style.zIndex = "1050";

  const renderFlyoutContent = (filterText = "") => {
    const filtered = filterText
      ? submodels.filter(
          (sm) => sm.name.toLowerCase().includes(filterText.toLowerCase()) || sm.id.toLowerCase().includes(filterText.toLowerCase())
        )
      : submodels;

    return `
      <!-- Header -->
      <div class="p-3 border-b border-border/50 flex items-center justify-between shrink-0 bg-sidebar/50 rounded-t-xl">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
              <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
            </svg>
          </div>
          <div class="truncate">
            <h4 class="text-xs font-semibold text-foreground m-0 truncate">${escapeHtml(providerModel.name)} Modelleri</h4>
            <span class="text-[10px] text-muted-foreground">${submodels.length} model mevcut</span>
          </div>
        </div>
        <button type="button" id="btn-close-submodel-flyout" class="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Kapat">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
        </button>
      </div>

      <!-- Quick Search Filter -->
      <div class="p-2 border-b border-border/30 bg-background/50">
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/40 border border-border/40 focus-within:border-primary/50 transition-colors">
          <svg class="text-muted-foreground shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="submodel-search-input" value="${escapeHtml(filterText)}" placeholder="Model ara..." class="w-full bg-transparent text-xs text-foreground outline-none font-sans" />
        </div>
        ${
          isOpenRouterProvider && !hasEffectiveOpenRouterKey
            ? `
          <button type="button" id="btn-flyout-openrouter-setup" class="mt-1.5 w-full px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-[10px] text-amber-300 flex items-center justify-between gap-1 cursor-pointer transition-colors">
            <span>🔑 OpenRouter API anahtarı henüz girilmedi</span>
            <span class="font-semibold underline shrink-0">Anahtar Gir →</span>
          </button>
        `
            : ""
        }
      </div>

      <!-- Scrollable Submodels List -->
      <div class="flex flex-col gap-1 p-1.5 max-h-56 overflow-y-auto custom-scrollbar" id="submodels-items-list">
        ${
          filtered.length === 0
            ? `
          <div class="p-4 text-center text-xs text-muted-foreground">Eşleşen model bulunamadı.</div>
        `
            : filtered
                .map((sm) => {
                  const isSelected = sm.id === providerModel.modelId;
                  return `
            <div class="submodel-item p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 ${isSelected ? "bg-primary/20 text-primary border border-primary/30 font-medium" : "text-secondary-foreground hover:bg-secondary/60"}" data-submodel-id="${escapeHtml(sm.id)}">
              <div class="flex flex-col min-w-0 pr-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs truncate">${escapeHtml(sm.name)}</span>
                  ${sm.badge ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full ${sm.badge === "Önerilen" ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground border border-border/40"} shrink-0">${escapeHtml(sm.badge)}</span>` : ""}
                </div>
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate">
                  <span>${escapeHtml(sm.id)}</span>
                  ${sm.tag ? `<span class="text-[9px] opacity-70">· ${escapeHtml(sm.tag)}</span>` : ""}
                </div>
              </div>
              ${
                isSelected
                  ? `
                <svg class="text-primary shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              `
                  : ""
              }
            </div>
          `;
                })
                .join("")
        }
      </div>

      <!-- Custom Model ID Input & Footer -->
      <div class="p-2.5 border-t border-border/40 flex flex-col gap-1.5 bg-sidebar/50 rounded-b-xl">
        <label class="text-[11px] text-muted-foreground font-normal">Veya özel bir model ID girin:</label>
        <div class="flex items-center gap-1.5">
          <input type="text" id="custom-submodel-input" placeholder="örn. deepseek-v3, glm-5..." class="flex-1 bg-secondary/60 border border-border/60 rounded px-2 py-1 text-xs text-foreground outline-none font-mono" />
          <button type="button" id="btn-apply-custom-submodel" class="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 cursor-pointer transition-colors shrink-0">
            Seç
          </button>
        </div>
      </div>
    `;
  };

  flyout.innerHTML = renderFlyoutContent();
  document.body.appendChild(flyout);

  // Positioning
  const rect = targetItemEl.getBoundingClientRect();
  const flyoutWidth = 310;
  const flyoutHeight = 350;

  let left = rect.right + 8;
  if (left + flyoutWidth > window.innerWidth - 10) {
    left = Math.max(10, rect.left - flyoutWidth - 8);
  }

  let top = rect.bottom - flyoutHeight;
  if (top < 10) top = 10;
  if (top + flyoutHeight > window.innerHeight - 10) {
    top = window.innerHeight - flyoutHeight - 10;
  }

  flyout.style.left = `${left}px`;
  flyout.style.top = `${top}px`;

  // Attach search filter listener
  const attachEvents = () => {
    flyout.querySelector("#btn-close-submodel-flyout")?.addEventListener("click", closeSubModelFlyout);
    flyout.querySelector("#btn-flyout-openrouter-setup")?.addEventListener("click", () => {
      closeSubModelFlyout();
      document.getElementById("menu-composer-model")?.classList.remove("show");
      window.openSettingsModal?.("models");
    });

    const searchInput = flyout.querySelector("#submodel-search-input");
    searchInput?.addEventListener("input", (e) => {
      const listContainer = flyout.querySelector("#submodels-items-list");
      const val = e.target.value.toLowerCase().trim();
      const filtered = val ? submodels.filter((sm) => sm.name.toLowerCase().includes(val) || sm.id.toLowerCase().includes(val)) : submodels;

      if (listContainer) {
        listContainer.innerHTML =
          filtered.length === 0
            ? `
          <div class="p-4 text-center text-xs text-muted-foreground">Eşleşen model bulunamadı.</div>
        `
            : filtered
                .map((sm) => {
                  const isSelected = sm.id === providerModel.modelId;
                  return `
            <div class="submodel-item p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 ${isSelected ? "bg-primary/20 text-primary border border-primary/30 font-medium" : "text-secondary-foreground hover:bg-secondary/60"}" data-submodel-id="${escapeHtml(sm.id)}">
              <div class="flex flex-col min-w-0 pr-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs truncate">${escapeHtml(sm.name)}</span>
                  ${sm.badge ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full ${sm.badge === "Önerilen" ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground border border-border/40"} shrink-0">${escapeHtml(sm.badge)}</span>` : ""}
                </div>
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate">
                  <span>${escapeHtml(sm.id)}</span>
                  ${sm.tag ? `<span class="text-[9px] opacity-70">· ${escapeHtml(sm.tag)}</span>` : ""}
                </div>
              </div>
              ${
                isSelected
                  ? `
                <svg class="text-primary shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              `
                  : ""
              }
            </div>
          `;
                })
                .join("");

        attachSubmodelClicks();
      }
    });

    // Custom model ID submit
    const btnCustom = flyout.querySelector("#btn-apply-custom-submodel");
    const customInput = flyout.querySelector("#custom-submodel-input");
    const applyCustom = () => {
      const val = customInput?.value?.trim();
      if (val) {
        selectSubModel(val);
      }
    };
    btnCustom?.addEventListener("click", applyCustom);
    customInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustom();
      }
    });

    attachSubmodelClicks();
  };

  const selectSubModel = (subId) => {
    providerModel.modelId = subId;
    window.appStore.updateModel(providerModel.id, { modelId: subId });
    window.appStore.setModel(providerModel.name);
    closeSubModelFlyout();
    document.getElementById("menu-composer-model")?.classList.remove("show");
    window.renderApp();
  };

  const attachSubmodelClicks = () => {
    flyout.querySelectorAll(".submodel-item").forEach((item) => {
      item.addEventListener("click", () => {
        const subId = item.getAttribute("data-submodel-id");
        if (subId) selectSubModel(subId);
      });
    });
  };

  attachEvents();

  // If Ollama, try to dynamically fetch local models to supplement the list
  const perms = window.appStore?.getPermissions?.() || {};
  if (perms.network_localhost !== false && (providerModel.provider.includes("Yerel") || providerModel.endpoint?.includes("11434"))) {
    fetch("http://127.0.0.1:11434/v1/models")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          let added = false;
          data.data.forEach((m) => {
            if (!submodels.some((sm) => sm.id === m.id)) {
              submodels.push({ id: m.id, name: m.id, tag: "Yerel Ollama", badge: "Yüklü" });
              added = true;
            }
          });
          if (added && document.getElementById("lux-submodel-flyout")) {
            flyout.innerHTML = renderFlyoutContent(flyout.querySelector("#submodel-search-input")?.value || "");
            attachEvents();
          }
        }
      })
      .catch(() => {});
  } else if (perms.network_localhost !== false && (providerModel.endpoint?.includes("20128") || providerModel.name.includes("9Router"))) {
    // If 9Router, fetch all 150+ live models from local proxy
    fetch("http://127.0.0.1:20128/v1/models")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          let added = false;
          data.data.forEach((m) => {
            if (!submodels.some((sm) => sm.id === m.id)) {
              const isFree = m.id.includes("free") || m.id.startsWith("oc/");
              submodels.push({
                id: m.id,
                name: m.id,
                tag: "9Router Havuzu",
                badge: isFree ? "Ücretsiz" : "9Router"
              });
              added = true;
            }
          });
          if (added && document.getElementById("lux-submodel-flyout")) {
            flyout.innerHTML = renderFlyoutContent(flyout.querySelector("#submodel-search-input")?.value || "");
            attachEvents();
          }
        }
      })
      .catch(() => {});
  } else if (perms.network_internet !== false && isOpenRouterProvider) {
    // OpenRouter: fetch live catalog and merge any active $0 / :free text LLMs dynamically
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          let added = false;
          data.data.filter(isOpenRouterFreeChatModel).forEach((m) => {
            if (!submodels.some((sm) => sm.id === m.id)) {
              const ctxK = m.context_length ? `${Math.round(m.context_length / 1000)}K` : "Ücretsiz";
              submodels.push({
                id: m.id,
                name: (m.name || m.id).replace(/\s*\(free\)\s*$/i, ""),
                tag: `${ctxK} · Canlı OpenRouter ($0)`,
                badge: "Ücretsiz"
              });
              added = true;
            }
          });
          if (added && document.getElementById("lux-submodel-flyout")) {
            KNOWN_PROVIDER_SUBMODELS["OpenRouter"] = submodels.slice();
            flyout.innerHTML = renderFlyoutContent(flyout.querySelector("#submodel-search-input")?.value || "");
            attachEvents();
          }
        }
      })
      .catch(() => {});
  }
}

window.openSubModelFlyout = openSubModelFlyout;
window.closeSubModelFlyout = closeSubModelFlyout;

function updateComposerModelDropdown() {
  const menuModel = document.getElementById("menu-composer-model");
  const modelLabel = document.getElementById("composer-model-label");
  if (!menuModel) return;

  const models = window.appStore.getModels();
  const selectedModel = window.appStore.state.selectedModel || models[0]?.name || "";
  const activeModelObj = models.find((m) => m.name === selectedModel);

  let displayLabel = selectedModel || "Model Seç";
  if (activeModelObj && activeModelObj.modelId) {
    const shortSub =
      activeModelObj.modelId === "openrouter/free" ? "Auto Free" : activeModelObj.modelId.split("/").pop().replace(":latest", "");
    if (shortSub && shortSub !== selectedModel) {
      displayLabel = `${selectedModel} · ${shortSub}`;
    }
  }

  if (modelLabel) {
    modelLabel.textContent = displayLabel;
  }

  const modelsListHtml =
    models.length === 0
      ? `<div class="px-3 py-2.5 text-xs text-muted-foreground">Kayıtlı LLM modeli yok</div>`
      : models
          .map((m) => {
            const shortSub = m.modelId
              ? m.modelId === "openrouter/free"
                ? "auto:free"
                : m.modelId.split("/").pop().replace(":latest", "")
              : "";
            const isActive = m.name === selectedModel;
            const isOpenRouterRow = m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "");
            const hasEffectiveOrKey = isOpenRouterRow && Boolean((m.apiKey || "").trim() || window.appStore?.getOpenRouterApiKey?.());
            const dotClass =
              m.status === "success" ? "bg-emerald-400" : isOpenRouterRow && !hasEffectiveOrKey ? "bg-amber-400" : "bg-blue-400";
            return `
          <div class="lux-dropdown-item font-medium flex items-center justify-between group/mitem py-1.5 ${isActive ? "active" : ""}" data-model="${escapeHtml(m.name)}" data-model-id="${escapeHtml(m.id)}">
            <div class="flex items-center gap-2 min-w-0 pr-1">
              <span class="w-2 h-2 rounded-full shrink-0 ${dotClass}"></span>
              <span class="truncate">${escapeHtml(m.name)}</span>
              ${shortSub ? `<span class="text-[10px] px-1.5 py-0.2 rounded bg-secondary/80 text-muted-foreground font-mono truncate max-w-[95px] border border-border/40">${escapeHtml(shortSub)}</span>` : ""}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" class="btn-submodel-picker px-1.5 py-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors flex items-center gap-0.5" data-model="${escapeHtml(m.name)}" title="${escapeHtml(m.name)} modellerini seç">
                <span class="text-[10px] opacity-80 font-normal">Modeller</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        `;
          })
          .join("");

  menuModel.innerHTML =
    modelsListHtml +
    `
    <div class="lux-dropdown-divider"></div>
    <div class="lux-dropdown-item text-xs text-primary flex items-center gap-2 cursor-pointer" id="btn-open-models-settings">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M450-450H250q-12.75,0-21.37-8.63T220-480.01t8.62-21.37T250-510H450V-710q0-12.75 8.63-21.37T480.01-740t21.37,8.62T510-710v200H710q12.75,0 21.37,8.63T740-479.99t-8.62,21.37T710-450H510v200q0,12.75-8.63,21.37T479.99-220t-21.37-8.62T450-250V-450Z"/>
      </svg>
      <span>Model Ekle & Yapılandır...</span>
    </div>
  `;

  // Attach event listeners to model items & submodel buttons
  menuModel.querySelectorAll(".lux-dropdown-item[data-model]").forEach((item) => {
    const modelName = item.getAttribute("data-model");
    const providerModel = models.find((m) => m.name === modelName);

    // Clicking the "Modeller ›" button opens the submodel flyout
    item.querySelector(".btn-submodel-picker")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (providerModel) {
        openSubModelFlyout(item, providerModel);
      }
    });

    // Clicking the item row: if already active or has submodels, open flyout; else setModel
    item.addEventListener("click", (e) => {
      if (e.target.closest(".btn-submodel-picker")) return;
      if (providerModel) {
        const hasSubmodels =
          modelName === "9Router" ||
          modelName === "Ollama (Yerel)" ||
          modelName === "OpenRouter" ||
          providerModel.provider === "OpenRouter" ||
          /openrouter\.ai/i.test(providerModel.endpoint || "") ||
          KNOWN_PROVIDER_SUBMODELS[modelName] ||
          KNOWN_PROVIDER_SUBMODELS[providerModel.provider];
        if (hasSubmodels) {
          e.stopPropagation();
          openSubModelFlyout(item, providerModel);
        } else {
          window.appStore.setModel(modelName);
          menuModel.classList.remove("show");
          closeSubModelFlyout();
          window.renderApp();
        }
      }
    });
  });

  menuModel.querySelector("#btn-open-models-settings")?.addEventListener("click", () => {
    menuModel.classList.remove("show");
    closeSubModelFlyout();
    window.openSettingsModal("models");
  });
}

function updateLayoutVisibility() {
  const state = window.appStore.state;
  const sidebar = document.getElementById("sidebar-wrapper");
  const sash = document.getElementById("sidebar-sash");
  const breadcrumbContainer = document.getElementById("breadcrumb-container");
  const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
  const rightPanel = document.getElementById("right-panel-container");
  const toggleRightBtn = document.getElementById("btn-toggle-right-panel");
  const toggleSplitBtn = document.getElementById("btn-toggle-split-window");
  const ideSplit = document.getElementById("ide-split-container");

  if (sidebar) {
    if (state.sidebarOpen) {
      sidebar.style.display = "flex";
      sidebar.style.width = (state.sidebarWidth || 256) + "px";
      if (sash) sash.style.display = "flex";
      if (breadcrumbContainer) {
        breadcrumbContainer.style.paddingLeft = "0px";
      }
      if (toggleSidebarBtn) {
        toggleSidebarBtn.setAttribute("aria-expanded", "true");
        toggleSidebarBtn.setAttribute("title", "Kenar Çubuğunu Gizle (Ctrl+B)");
        toggleSidebarBtn.classList.remove("bg-secondary", "text-foreground");
      }
    } else {
      sidebar.style.display = "none";
      sidebar.style.width = "0px";
      if (sash) sash.style.display = "none";
      if (breadcrumbContainer) {
        // Offset breadcrumb to sit right after the static cluster ([Logo][Toggle][<][>][Q])
        breadcrumbContainer.style.paddingLeft = "164px";
      }
      if (toggleSidebarBtn) {
        toggleSidebarBtn.setAttribute("aria-expanded", "false");
        toggleSidebarBtn.setAttribute("title", "Kenar Çubuğunu Göster (Ctrl+B)");
        toggleSidebarBtn.classList.add("bg-secondary", "text-foreground");
      }
    }
  }
  if (rightPanel) {
    rightPanel.style.display = state.rightPanelOpen ? "flex" : "none";
  }
  if (toggleRightBtn) {
    if (state.rightPanelOpen) {
      toggleRightBtn.classList.add("bg-secondary", "text-secondary-foreground");
      toggleRightBtn.classList.remove("bg-transparent", "text-muted-foreground");
    } else {
      toggleRightBtn.classList.remove("bg-secondary", "text-secondary-foreground");
      toggleRightBtn.classList.add("bg-transparent", "text-muted-foreground");
    }
  }
  if (toggleSplitBtn) {
    if (state.ideSplitActive) {
      toggleSplitBtn.classList.add("bg-secondary", "text-secondary-foreground");
      toggleSplitBtn.classList.remove("bg-transparent", "text-muted-foreground");
    } else {
      toggleSplitBtn.classList.remove("bg-secondary", "text-secondary-foreground");
      toggleSplitBtn.classList.add("bg-transparent", "text-muted-foreground");
    }
  }
  if (ideSplit) {
    ideSplit.style.display = state.ideSplitActive ? "flex" : "none";
  }
}

function setupHeaderEvents() {
  // Titlebar & General Dropdown Menus
  const menuButtons = document.querySelectorAll(".lux-menu-btn");
  menuButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetMenuId = btn.getAttribute("data-menu");
      const targetMenu = document.getElementById(targetMenuId);

      // Close all other dropdowns
      document.querySelectorAll(".lux-dropdown-menu").forEach((m) => {
        if (m !== targetMenu) m.classList.remove("show");
      });

      targetMenu?.classList.toggle("show");
    });
  });

  // Close dropdowns on outside click
  window.addEventListener("click", (e) => {
    if (!e.target.closest("#lux-submodel-flyout") && !e.target.closest(".btn-submodel-picker")) {
      closeSubModelFlyout();
    }
    if (!e.target.closest(".lux-dropdown-menu") && !e.target.closest(".lux-menu-btn") && !e.target.closest("#lux-submodel-flyout")) {
      document.querySelectorAll(".lux-dropdown-menu").forEach((m) => m.classList.remove("show"));
    }
  });

  // Toggle Sidebar Button
  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    window.appStore.toggleSidebar();
    window.renderApp();
  });

  // Toggle Right Panel Button
  document.getElementById("btn-toggle-right-panel")?.addEventListener("click", () => {
    window.appStore.toggleRightPanel();
    window.renderApp();
  });

  // Open IDE Mode Button
  document.getElementById("btn-open-ide")?.addEventListener("click", () => {
    window.appStore.toggleIdeSplit();
    window.renderApp();
  });

  // Toggle Split Window Button [|]
  document.getElementById("btn-toggle-split-window")?.addEventListener("click", () => {
    window.appStore.toggleIdeSplit();
    window.renderApp();
  });

  // Topbar History Navigation (Back / Forward)
  document.getElementById("btn-nav-back")?.addEventListener("click", () => {
    if (window.appStore.navigateBack?.()) {
      window.renderApp();
    }
  });
  document.getElementById("btn-nav-forward")?.addEventListener("click", () => {
    if (window.appStore.navigateForward?.()) {
      window.renderApp();
    }
  });

  // Topbar Interactive Breadcrumbs
  document.getElementById("breadcrumb-project")?.addEventListener("click", () => {
    const proj = window.appStore.getActiveProject();
    if (proj) {
      window.openSettingsModal(`project:${proj.id}`);
    } else {
      window.openSettingsModal("show_all");
    }
  });
  document.getElementById("breadcrumb-conv")?.addEventListener("click", () => {
    window.openPalette();
  });

  // Search / Palette Button
  document.getElementById("btn-search-palette")?.addEventListener("click", () => {
    window.openPalette();
  });

  // App Logo Click (Starts new conversation)
  document.getElementById("btn-app-logo")?.addEventListener("click", () => {
    window.appStore.createConversation("Yeni Sohbet");
    window.renderApp();
  });
}

function setupComposerEvents() {
  const textarea = document.getElementById("composer-textarea");
  const btnCancel = document.getElementById("btn-input-cancel");

  if (!textarea) return;

  // Auto-resize textarea
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";
  });

  // Enter to send (Shift+Enter for newline) - handles "Dur" stop words cleanly and interrupts active speech
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = textarea.value;
      const stopCmd = window.parseLuxVoiceStopCommand?.(val);
      if (stopCmd?.type === "stop") {
        window.stopAllAssistantOutput?.(true);
        textarea.value = "";
        textarea.style.height = "auto";
        return;
      }
      window.stopSpeaking?.();
      window.stopLullabyAudio?.();
      if (val && val.trim().length > 0) {
        window.submitUserMessage(val);
      }
    }
  });

  // Single Send / Stop button handler (avoids double-firing with document delegation)
  btnCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const val = textarea.value;
    const stopCmd = window.parseLuxVoiceStopCommand?.(val);
    if (stopCmd?.type === "stop") {
      window.stopAllAssistantOutput?.(true);
      textarea.value = "";
      textarea.style.height = "auto";
      return;
    }
    if (window.isGenerating) {
      window.stopAllAssistantOutput?.(false);
    } else if (val && val.trim().length > 0) {
      window.submitUserMessage(val);
    } else if (window.currentVoiceAudio || window.isAIResponding || window.isLullabyPlaying?.()) {
      window.stopAllAssistantOutput?.(false);
    }
  });

  // Mode Selector Options
  const menuMode = document.getElementById("menu-composer-mode");
  menuMode?.querySelectorAll(".lux-dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      const mode = item.getAttribute("data-mode") || item.getAttribute("data-value");
      if (mode) {
        window.appStore.setMode(mode);
        menuMode.querySelectorAll(".lux-dropdown-item").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        menuMode.classList.remove("show");
        window.renderApp();
      }
    });
  });
}

function closeTopmostModalOrOverlay() {
  if (typeof luxActiveCustomSelect !== "undefined" && luxActiveCustomSelect) {
    closeLuxActiveCustomSelect();
    return true;
  }

  if (document.getElementById("lux-submodel-flyout")) {
    closeSubModelFlyout();
    return true;
  }

  let closedAnyMenu = false;
  document.querySelectorAll(".lux-dropdown-menu.show").forEach((m) => {
    m.classList.remove("show");
    closedAnyMenu = true;
  });
  if (closedAnyMenu) return true;

  const lightbox = document.getElementById("lux-lightbox-overlay");
  if (lightbox) {
    lightbox.remove();
    return true;
  }

  const picker = document.getElementById("card-model-picker-modal");
  if (picker) {
    picker.remove();
    return true;
  }

  const voiceLib = document.getElementById("voice-library-modal");
  if (voiceLib) {
    voiceLib.querySelector("#btn-close-voice-lib")?.click();
    if (document.getElementById("voice-library-modal")) voiceLib.remove();
    return true;
  }

  const chooseVoice = document.getElementById("choose-voice-modal");
  if (chooseVoice) {
    chooseVoice.querySelector("#btn-close-voice-modal, .close-voice-modal-btn")?.click();
    if (document.getElementById("choose-voice-modal")) chooseVoice.remove();
    return true;
  }

  const aboutModal = document.getElementById("about-modal-dialog");
  if (aboutModal) {
    aboutModal.remove();
    return true;
  }

  const palette = document.getElementById("palette-modal");
  if (palette && palette.classList.contains("show")) {
    window.closePalette();
    return true;
  }

  const settings = document.getElementById("settings-modal");
  if (settings && settings.classList.contains("show")) {
    window.closeSettingsModal();
    return true;
  }

  return false;
}

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    // Esc -> Stop ALL AI output (generation + speech + lullaby) & close topmost open modal
    if (e.key === "Escape") {
      window.stopAllAssistantOutput?.(false);
      closeTopmostModalOrOverlay();
      return;
    }

    // Enter outside composer while AI audio is speaking cuts speech output cleanly
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      e.target?.id !== "composer-textarea" &&
      (window.currentVoiceAudio || window.isLullabyPlaying?.())
    ) {
      window.stopAllAssistantOutput?.(false);
    }

    if (!(e.ctrlKey || e.metaKey)) return;
    const keyLower = e.key.toLowerCase();

    // Ctrl+, -> Settings
    if (e.key === ",") {
      e.preventDefault();
      window.openSettingsModal();
    }
    // Ctrl+N -> New Conversation
    else if (keyLower === "n") {
      e.preventDefault();
      window.appStore.createConversation("Yeni Sohbet");
      window.renderApp();
    }
    // Ctrl+B -> Toggle Sidebar
    else if (keyLower === "b") {
      e.preventDefault();
      window.appStore.toggleSidebar();
      window.renderApp();
    }
    // Ctrl+J -> Toggle Overview Panel
    else if (keyLower === "j") {
      e.preventDefault();
      window.appStore.toggleRightPanel();
      window.renderApp();
    }
    // Ctrl+` -> Open Right Panel Integrated Terminal
    else if (e.key === "`" || e.code === "Backquote") {
      e.preventDefault();
      window.openRightPanelTerminal?.();
    }
    // Ctrl+I or Ctrl+\ -> Toggle Split IDE
    else if (keyLower === "i" || e.key === "\\" || e.code === "Backslash") {
      e.preventDefault();
      window.appStore.toggleIdeSplit();
      window.renderApp();
    }
    // Ctrl+K / Ctrl+P / Ctrl+Shift+P -> Command Palette
    else if (keyLower === "k" || keyLower === "p") {
      e.preventDefault();
      const paletteModal = document.getElementById("palette-modal");
      if (paletteModal?.classList.contains("show")) window.closePalette();
      else window.openPalette();
    }
    // Ctrl+S -> Save active file when IDE editor is active
    else if (keyLower === "s") {
      if (
        window.appStore?.state?.ideSplitActive &&
        window.getAuxViewMode?.() === "editor" &&
        typeof window.saveCurrentEditorFile === "function"
      ) {
        e.preventDefault();
        window.saveCurrentEditorFile();
      }
    }
    // Ctrl+= -> Zoom In
    else if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      window.zoomIn();
    }
    // Ctrl+- -> Zoom Out
    else if (e.key === "-") {
      e.preventDefault();
      window.zoomOut();
    }
    // Ctrl+0 -> Reset Zoom
    else if (e.key === "0") {
      e.preventDefault();
      window.resetZoom();
    }
  });
}

// Global Zoom Controls
window.zoomIn = function () {
  currentZoomLevel = Math.min(currentZoomLevel + 0.1, 1.6);
  document.body.style.zoom = currentZoomLevel;
};
window.zoomOut = function () {
  currentZoomLevel = Math.max(currentZoomLevel - 0.1, 0.7);
  document.body.style.zoom = currentZoomLevel;
};
window.resetZoom = function () {
  currentZoomLevel = 1.0;
  document.body.style.zoom = 1.0;
};

// Global Context Attach Actions
window.pickFileContext = async function () {
  const textarea = document.getElementById("composer-textarea");
  if (!textarea) return;
  if (window.luxAPI?.pickFile) {
    const res = await window.luxAPI.pickFile();
    if (res && !res.canceled && res.relPath) {
      textarea.value += ` @file:${res.relPath} `;
      textarea.focus();
    }
    return;
  }
  textarea.value += " @file:src/index.html ";
  textarea.focus();
};
window.pickFolderContext = async function () {
  const textarea = document.getElementById("composer-textarea");
  if (!textarea) return;
  if (window.luxAPI?.pickFolder) {
    const res = await window.luxAPI.pickFolder();
    if (res && !res.canceled && res.path) {
      textarea.value += ` @folder:${res.path} `;
      textarea.focus();
    }
    return;
  }
  textarea.value += " @folder:src/ ";
  textarea.focus();
};
window.captureScreenshotContext = function () {
  const textarea = document.getElementById("composer-textarea");
  if (textarea) {
    textarea.value += " @screen:captured_window ";
    textarea.focus();
  }
};
window.addTerminalContext = function () {
  const textarea = document.getElementById("composer-textarea");
  if (textarea) {
    textarea.value += " @terminal:last_output ";
    textarea.focus();
  }
};

window.clearActiveChat = function () {
  const conv = window.appStore.getActiveConversation();
  if (conv) {
    conv.messages = [];
    window.appStore.saveState();
    window.renderApp();
  }
};

window.exportChatMarkdown = function () {
  const conv = window.appStore.getActiveConversation();
  if (!conv) return;
  const md = conv.messages.map((m) => `### ${m.role === "user" ? "Kullanıcı" : "Lux AI"}\n\n${m.content}\n`).join("\n---\n\n");
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${conv.title || "lux_ai_chat"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

window.exportChatJson = function () {
  const conv = window.appStore.getActiveConversation();
  if (!conv) return;
  const jsonStr = JSON.stringify(conv, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${conv.title || "lux_ai_chat"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

window.openModelParamsModal = function () {
  window.openSettingsModal("models");
};

window.openAboutModal = async function () {
  document.getElementById("about-modal-dialog")?.remove();
  let appInfo = null;
  try {
    appInfo = await window.luxAPI?.getAppInfo?.();
  } catch (_) {}
  const versionStr = escapeHtml(appInfo?.version || "1.0.0");
  const platformStr = escapeHtml(appInfo?.platform || "win32");

  const modal = document.createElement("div");
  modal.id = "about-modal-dialog";
  modal.className = "lux-modal-backdrop show flex items-center justify-center";
  modal.style.cssText =
    "position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); z-index: 2600; display: flex; align-items: center; justify-content: center;";
  modal.innerHTML = `
    <div class="lux-modal max-w-sm w-full bg-[#121216] border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative select-none p-6 text-center">
      <div class="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mx-auto mb-3 shadow-lg">
        <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
          <path d="M26 32C26 24.27 32.27 18 40 18H68C75.73 18 82 24.27 82 32V92C82 99.73 88.27 106 96 106H140C147.73 106 154 112.27 154 120V148C154 155.73 147.73 162 140 162H40C32.27 162 26 155.73 26 148V32Z" fill="currentColor"/>
        </svg>
      </div>
      <h3 class="text-base font-semibold text-foreground m-0">Lux AI Desktop</h3>
      <span class="text-xs text-primary font-mono mt-0.5 mb-2 inline-block">v${versionStr} · Lux Native Engine</span>
      <p class="text-xs text-muted-foreground leading-relaxed m-0 mb-5">
        Google Lux IDE mimarisini temel alan, yerel yapay zeka ajanları, çift modlu IDE ve stüdyo nöral ses motoru ile güçlendirilmiş masaüstü çalışma alanı.
      </p>
      <div class="flex flex-col gap-1.5 text-xs text-muted-foreground bg-card/40 p-3 rounded-xl border border-border/50 text-left mb-5 font-mono text-[11px]">
        <div class="flex justify-between"><span>Ortam:</span><span class="text-foreground">Electron (${platformStr}) + Node.js</span></div>
        <div class="flex justify-between"><span>Ses Motoru:</span><span class="text-foreground">Whisper · Moonshine · Piper · Kokoro · XTTS</span></div>
        <div class="flex justify-between"><span>Yerel AI:</span><span class="text-foreground">Ollama &amp; 9Router</span></div>
      </div>
      <button type="button" class="w-full py-2 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs transition-colors cursor-pointer" onclick="document.getElementById('about-modal-dialog')?.remove()">
        Tamam
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
};

function setupSidebarResize() {
  const sash = document.querySelector('[data-testid="sidebar-sash"]');
  const sidebar = document.getElementById("sidebar-wrapper");
  if (!sash || !sidebar) return;

  sash.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = sidebar.offsetWidth;
    document.body.classList.add("resizing-col");

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + deltaX;

      const minWidth = 180;
      const maxWidth = 480;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      sidebar.style.width = newWidth + "px";
      window.appStore.state.sidebarWidth = newWidth;
    };

    const onMouseUp = () => {
      document.body.classList.remove("resizing-col");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.appStore.saveState();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

// ----------------------------------------------------
// Lux Pixel-Perfect Custom Dropdown Component
// Eliminates Windows OS light popup white backgrounds
// ----------------------------------------------------
let luxActiveCustomSelect = null;

function closeLuxActiveCustomSelect() {
  if (luxActiveCustomSelect) {
    luxActiveCustomSelect.close();
    luxActiveCustomSelect = null;
  }
}

// Single global listeners for all custom selects
window.addEventListener("click", (e) => {
  if (luxActiveCustomSelect) {
    if (!luxActiveCustomSelect.wrapper.contains(e.target) && !luxActiveCustomSelect.menu?.contains(e.target)) {
      closeLuxActiveCustomSelect();
    }
  }
});

window.addEventListener(
  "scroll",
  (e) => {
    if (luxActiveCustomSelect && !luxActiveCustomSelect.menu?.contains(e.target)) {
      closeLuxActiveCustomSelect();
    }
  },
  true
);

window.makeLuxCustomSelect = function (selectEl, customClasses = {}) {
  if (!selectEl) return null;
  if (selectEl.dataset.customized === "true" && selectEl._customWrapper) {
    if (selectEl._customSelectRefresh) selectEl._customSelectRefresh();
    return selectEl._customWrapper;
  }

  const origWidth = selectEl.style.width;
  selectEl.dataset.customized = "true";
  // Visually hide original select while keeping it functional in DOM
  selectEl.style.position = "absolute";
  selectEl.style.opacity = "0";
  selectEl.style.pointerEvents = "none";
  selectEl.style.width = "1px";
  selectEl.style.height = "1px";
  selectEl.style.margin = "-1px";
  selectEl.style.padding = "0";
  selectEl.style.overflow = "hidden";
  selectEl.style.clip = "rect(0, 0, 0, 0)";
  selectEl.style.border = "0";

  const wrapper = document.createElement("div");
  wrapper.className = `lux-custom-select-wrapper ${customClasses.wrapper || ""}`;
  if (selectEl.classList.contains("flex-1")) wrapper.classList.add("flex-1");
  if (origWidth && origWidth !== "1px") wrapper.style.width = origWidth;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `lux-custom-select-trigger ${customClasses.trigger || ""}`;

  const labelSpan = document.createElement("span");
  labelSpan.className = "lux-select-label truncate";

  const arrowSpan = document.createElement("span");
  arrowSpan.className = "lux-select-arrow shrink-0 text-muted-foreground transition-transform duration-150 flex items-center";
  arrowSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowSpan);
  wrapper.appendChild(trigger);

  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  selectEl._customWrapper = wrapper;

  let activeMenu = null;

  function closeMenu() {
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
      trigger.classList.remove("is-open");
      arrowSpan.style.transform = "none";
    }
    if (luxActiveCustomSelect && luxActiveCustomSelect.wrapper === wrapper) {
      luxActiveCustomSelect = null;
    }
  }

  function updateTriggerLabel() {
    const selectedOption = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
    labelSpan.textContent = selectedOption ? selectedOption.text : "-- Seçin --";
  }

  function openMenu() {
    closeLuxActiveCustomSelect();

    const menu = document.createElement("div");
    menu.className = "lux-custom-select-menu custom-scrollbar";

    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";

    const menuWidth = Math.max(rect.width, 220);
    let leftPos = rect.left;
    if (leftPos + menuWidth > window.innerWidth - 12) {
      leftPos = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    menu.style.left = `${leftPos}px`;
    menu.style.width = `${menuWidth}px`;

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 220 && rect.top > 220) {
      menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      menu.style.top = "auto";
    } else {
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.bottom = "auto";
    }

    Array.from(selectEl.options).forEach((opt, idx) => {
      const optEl = document.createElement("div");
      optEl.className = "lux-custom-select-option";
      const isSelected = opt.selected || idx === selectEl.selectedIndex;
      if (isSelected) optEl.classList.add("is-selected");
      if (opt.value === "__custom__") optEl.classList.add("is-custom-action");

      optEl.innerHTML = `
        <span class="truncate">${escapeHtml(opt.text)}</span>
        ${isSelected ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="shrink-0 text-primary"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
      `;

      optEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEl.selectedIndex = idx;
        selectEl.value = opt.value;
        updateTriggerLabel();
        closeMenu();
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      });

      menu.appendChild(optEl);
    });

    document.body.appendChild(menu);
    activeMenu = menu;
    trigger.classList.add("is-open");
    arrowSpan.style.transform = "rotate(180deg)";

    luxActiveCustomSelect = {
      wrapper,
      menu,
      close: closeMenu
    };
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeMenu) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  selectEl.addEventListener("change", updateTriggerLabel);

  const observer = new MutationObserver(() => {
    updateTriggerLabel();
    if (activeMenu) openMenu();
  });
  observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

  selectEl._customSelectRefresh = () => {
    updateTriggerLabel();
    if (activeMenu) openMenu();
  };

  updateTriggerLabel();
  return wrapper;
};
