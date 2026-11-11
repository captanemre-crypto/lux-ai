// Store & State Manager for Lux AI (Exact Antigravity Replica)

const UNLIMITED_PERMISSIONS = {
  terminal_execute: true,
  auto_approve_commands: true,
  system_env_read: true,
  file_read: true,
  file_write: true,
  file_delete: true,
  env_secrets_protection: false,
  network_internet: true,
  network_localhost: true,
  agent_background_tasks: true,
  agent_subagents: true,
  browser_automation: true,
  pc_control: true,
  web_search: true,
  image_generation: true
};

const CURRENT_MEMORY_RESET_VERSION = 1;

const DEFAULT_MODELS = [
  {
    id: "model-ollama",
    name: "Ollama (Yerel)",
    provider: "Ollama / Yerel",
    modelId: "qwen2.5:3b",
    apiKey: "",
    endpoint: "http://localhost:11434/v1",
    isDefault: true,
    status: "idle",
    lastTested: "Yerel motor (Otomatik algılanır)",
    createdAt: "11.11.2026"
  },
  {
    id: "model-openrouter",
    name: "OpenRouter",
    provider: "OpenRouter",
    modelId: "openrouter/free",
    apiKey: "",
    endpoint: "https://openrouter.ai/api/v1",
    isDefault: false,
    status: "idle",
    lastTested: "13 ücretsiz LLM hazır · API anahtarı ekle",
    createdAt: "11.11.2026"
  }
];

function createEmptyWorkspaceProjects() {
  return [
    {
      id: "lux-ai",
      name: "LUX_ai",
      expanded: true,
      conversations: [
        {
          id: "conv-default",
          title: "Yeni Sohbet",
          timestamp: "Şimdi",
          pinned: false,
          active: true,
          messages: []
        }
      ]
    }
  ];
}

const DEFAULT_STATE = {
  projects: createEmptyWorkspaceProjects(),
  activeProjectId: "lux-ai",
  activeConversationId: "conv-default",
  sidebarOpen: true,
  sidebarWidth: 256,
  rightPanelOpen: true,
  ideSplitActive: false,
  splitPaneWidth: 540,
  selectedModel: "Ollama (Yerel)",
  selectedMode: "Turbo",
  backgroundTasksCount: 0,
  backgroundTaskName: "Boşta",
  settings: {
    apiKey: ""
  },
  general: {
    autoHeal: true
  },
  application: {
    workspaceDir: "c:\\Users\\SERVER\\Desktop\\LUX_ai",
    hardwareAccel: true,
    autoDevTools: false
  },
  appearance: {
    accentColor: "#2F71E3"
  },
  automations: [],
  feedbackLog: [],
  memoryResetVersion: CURRENT_MEMORY_RESET_VERSION,
  notifications: {
    agentNotifications: true,
    agentSounds: true,
    soundVolume: 100
  },
  defaultsSeeded: true,
  openrouterSeeded: true,
  dismissedDiscovery: {},
  voiceMode: {
    voice: "Fola",
    microphone: "default",
    volume: 100,
    speed: 1.0,
    engineMode: "auto",
    sttEngine: "auto",
    streamingTts: true,
    cloneRefPath: "",
    openrouterApiKey: "",
    isMuted: false,
    isSpeakerMuted: false,
    active: false
  },
  permissionsPolicyVersion: 2,
  permissions: { ...UNLIMITED_PERMISSIONS },
  models: JSON.parse(JSON.stringify(DEFAULT_MODELS))
};

function sanitizePersistedModels(rawModels, isLegacyMigration = false) {
  if (!Array.isArray(rawModels)) return [];
  const legacyDummyIds = new Set(["model-1", "model-2", "model-3", "model-4"]);
  const cleaned = [];
  for (const raw of rawModels) {
    if (!raw || typeof raw !== "object") continue;
    const copy = { ...raw };
    const rawKey = String(copy.apiKey || "").trim();
    const isDemoPlaceholder = /demoKey|luxaiDemo|••••/i.test(rawKey);
    if (isLegacyMigration && legacyDummyIds.has(copy.id) && (isDemoPlaceholder || !rawKey)) {
      continue;
    }
    if (isDemoPlaceholder) {
      copy.apiKey = "";
      copy.status = "idle";
      copy.lastTested = "API Anahtarı gerekli";
    }
    cleaned.push(copy);
  }
  return cleaned;
}

class AppStore {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
    this.navHistory = this.state.activeConversationId ? [this.state.activeConversationId] : [];
    this.navHistoryIndex = this.navHistory.length - 1;
  }

  loadState() {
    try {
      const data = localStorage.getItem("lux_ai_state_v2");
      if (data) {
        const parsed = JSON.parse(data);
        const isLegacyMigration = (parsed.memoryResetVersion || 0) < CURRENT_MEMORY_RESET_VERSION;
        const state = { ...DEFAULT_STATE, ...parsed };
        state.general = {
          autoHeal: true,
          ...(parsed.general || {})
        };
        state.application = {
          workspaceDir: DEFAULT_STATE.application.workspaceDir,
          hardwareAccel: true,
          autoDevTools: false,
          ...(parsed.application || {})
        };
        state.appearance = {
          accentColor: "#2F71E3",
          ...(parsed.appearance || {})
        };
        state.automations = isLegacyMigration
          ? []
          : (Array.isArray(parsed.automations) ? parsed.automations : []);
        state.feedbackLog = isLegacyMigration
          ? []
          : (Array.isArray(parsed.feedbackLog) ? parsed.feedbackLog : []);
        if (isLegacyMigration) {
          state.projects = createEmptyWorkspaceProjects();
          state.activeProjectId = "lux-ai";
          state.activeConversationId = "conv-default";
          state.backgroundTasksCount = 0;
          state.backgroundTaskName = "Boşta";
          state.memoryResetVersion = CURRENT_MEMORY_RESET_VERSION;
        }
        state.notifications = {
          agentNotifications: true,
          agentSounds: true,
          soundVolume: 100,
          ...(parsed.notifications || {})
        };
        delete state.activeSuiteId;
        state.dismissedDiscovery = {
          ...(parsed.dismissedDiscovery || {})
        };
        state.voiceMode = {
          voice: "Fola",
          microphone: "default",
          volume: 100,
          speed: 1.0,
          engineMode: "auto",
          sttEngine: "auto",
          streamingTts: true,
          cloneRefPath: "",
          openrouterApiKey: "",
          isMuted: false,
          isSpeakerMuted: false,
          active: false,
          ...(parsed.voiceMode || {})
        };
        state.voiceMode.active = false;
        if (typeof state.voiceMode.streamingTts !== "boolean") {
          state.voiceMode.streamingTts = true;
        }
        if (!state.voiceMode.sttEngine) {
          state.voiceMode.sttEngine = "auto";
        }
        if (typeof state.voiceMode.cloneRefPath !== "string") {
          state.voiceMode.cloneRefPath = "";
        }
        if (parsed.permissionsPolicyVersion !== 2) {
          state.permissions = { ...UNLIMITED_PERMISSIONS };
          state.permissionsPolicyVersion = 2;
        } else {
          state.permissions = {
            ...UNLIMITED_PERMISSIONS,
            ...(parsed.permissions || {})
          };
        }

        const hasPersistedModelsArray = Array.isArray(parsed.models);
        const isAlreadySeeded = Boolean(parsed.defaultsSeeded || parsed.openrouterSeeded);
        if (!hasPersistedModelsArray || (parsed.models.length === 0 && !isAlreadySeeded)) {
          state.models = JSON.parse(JSON.stringify(DEFAULT_MODELS));
          state.defaultsSeeded = true;
          state.openrouterSeeded = true;
        } else {
          state.models = sanitizePersistedModels(parsed.models, isLegacyMigration);

          // If legacy migration dropped only dummy demoKey cards and nothing real remained, restore clean starter cards unless dismissed
          if (isLegacyMigration && state.models.length === 0 && !state.dismissedDiscovery?.ollama) {
            state.models = JSON.parse(JSON.stringify(DEFAULT_MODELS));
          }

          // Auto-heal broken 9Router modelId & deduplicate isDefault
          let seenDefault = false;
          state.models.forEach(m => {
            if (m.endpoint && m.endpoint.includes("20128") && (m.modelId === "openrouter/free" || m.modelId === "vscombo" || !m.modelId)) {
              m.modelId = "oc/beam-free";
            }
            if (m.isDefault) {
              if (!seenDefault) seenDefault = true;
              else m.isDefault = false;
            }
          });

          // Ensure a clean OpenRouter card exists if legacy profile had never been migrated and hadn't removed everything
          const existingOrCard = state.models.find(m => m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || ""));
          if (!parsed.openrouterSeeded && !existingOrCard && state.models.length > 0) {
            const defOpenRouter = DEFAULT_MODELS.find(m => m.id === "model-openrouter");
            if (defOpenRouter) {
              const copy = JSON.parse(JSON.stringify(defOpenRouter));
              if (state.voiceMode.openrouterApiKey && state.voiceMode.openrouterApiKey.trim()) {
                copy.apiKey = state.voiceMode.openrouterApiKey.trim();
                copy.lastTested = "OpenRouter anahtarıyla hazır · Test edebilirsiniz";
              }
              state.models.push(copy);
            }
          }
          state.defaultsSeeded = true;
          state.openrouterSeeded = true;

          // Keep OpenRouter key synced bidirectionally between Voice settings & existing OpenRouter model card
          const vmKey = (state.voiceMode.openrouterApiKey || "").trim();
          const cardWithKey = state.models.find(m =>
            (m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "")) &&
            m.apiKey && m.apiKey.trim() && !m.apiKey.includes("demoKey") && !m.apiKey.includes("••••")
          );
          if (vmKey) {
            state.models.forEach(m => {
              if ((m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "")) && !m.apiKey?.trim()) {
                m.apiKey = vmKey;
              }
            });
          } else if (cardWithKey) {
            state.voiceMode.openrouterApiKey = cardWithKey.apiKey.trim();
          }

          if (state.models.length === 0) {
            state.selectedModel = "";
          } else {
            if (!seenDefault) {
              const match = state.models.find(m => m.name === state.selectedModel) || state.models[0];
              match.isDefault = true;
            }
            if (!state.models.some(m => m.name === state.selectedModel)) {
              const defModel = state.models.find(m => m.isDefault) || state.models[0];
              if (defModel) state.selectedModel = defModel.name;
            }
          }
        }

        if (isLegacyMigration) {
          try {
            localStorage.setItem("lux_ai_state_v2", JSON.stringify(state));
          } catch (_) {}
        }
        return state;
      }
    } catch (e) {
      console.warn("Using default store state", e);
    }
    const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    state.models = JSON.parse(JSON.stringify(DEFAULT_MODELS));
    state.defaultsSeeded = true;
    state.openrouterSeeded = true;
    return state;
  }

  wipeMemory({ preserveSettings = true } = {}) {
    const freshConvId = "conv-" + Date.now();
    this.state.projects = [
      {
        id: "lux-ai",
        name: "LUX_ai",
        expanded: true,
        conversations: [
          {
            id: freshConvId,
            title: "Yeni Sohbet",
            timestamp: "Şimdi",
            updatedAt: Date.now(),
            pinned: false,
            active: true,
            messages: []
          }
        ]
      }
    ];
    this.state.activeProjectId = "lux-ai";
    this.state.activeConversationId = freshConvId;
    this.state.automations = [];
    this.state.feedbackLog = [];
    this.state.backgroundTasksCount = 0;
    this.state.backgroundTaskName = "Boşta";
    this.state.memoryResetVersion = CURRENT_MEMORY_RESET_VERSION;
    this.navHistory = [freshConvId];
    this.navHistoryIndex = 0;
    if (typeof window !== "undefined") {
      window.luxLastTerminalOutput = "";
    }

    if (!preserveSettings) {
      if (this.state.voiceMode) {
        this.state.voiceMode.openrouterApiKey = "";
      }
      if (Array.isArray(this.state.models)) {
        this.state.models.forEach(m => {
          m.apiKey = "";
          m.status = "idle";
          m.lastTested = "Sıfırlandı";
        });
      }
    }

    this.saveState();
    window.luxAPI?.storage?.wipe?.().catch(() => {});
    return true;
  }

  saveState() {
    try {
      localStorage.setItem("lux_ai_state_v2", JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Store listener error:", err);
      }
    });
  }

  getActiveProject() {
    return this.state.projects.find((p) => p.id === this.state.activeProjectId) || this.state.projects[0];
  }

  getActiveConversation() {
    const proj = this.getActiveProject();
    if (!proj) return null;
    return proj.conversations.find((c) => c.id === this.state.activeConversationId) || proj.conversations[0];
  }

  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;
    this.saveState();
  }

  toggleRightPanel() {
    this.state.rightPanelOpen = !this.state.rightPanelOpen;
    this.saveState();
  }

  toggleIdeSplit() {
    this.state.ideSplitActive = !this.state.ideSplitActive;
    this.saveState();
  }

  setModel(model) {
    this.state.selectedModel = model;
    this.saveState();
  }

  setMode(mode) {
    this.state.selectedMode = mode;
    this.saveState();
  }

  _pushNavHistory(convId) {
    if (!convId) return;
    if (!Array.isArray(this.navHistory)) {
      this.navHistory = [];
      this.navHistoryIndex = -1;
    }
    if (this.navHistory[this.navHistoryIndex] === convId) return;
    this.navHistory = this.navHistory.slice(0, this.navHistoryIndex + 1);
    this.navHistory.push(convId);
    if (this.navHistory.length > 50) {
      this.navHistory.shift();
    }
    this.navHistoryIndex = this.navHistory.length - 1;
  }

  _conversationExists(convId) {
    return this.state.projects.some(p => (p.conversations || []).some(c => c.id === convId));
  }

  canGoBack() {
    if (!Array.isArray(this.navHistory)) return false;
    for (let i = this.navHistoryIndex - 1; i >= 0; i--) {
      if (this._conversationExists(this.navHistory[i])) return true;
    }
    return false;
  }

  canGoForward() {
    if (!Array.isArray(this.navHistory)) return false;
    for (let i = this.navHistoryIndex + 1; i < this.navHistory.length; i++) {
      if (this._conversationExists(this.navHistory[i])) return true;
    }
    return false;
  }

  navigateBack() {
    if (!this.canGoBack()) return false;
    for (let i = this.navHistoryIndex - 1; i >= 0; i--) {
      if (this._conversationExists(this.navHistory[i])) {
        this.navHistoryIndex = i;
        return this.selectConversation(this.navHistory[i], false);
      }
    }
    return false;
  }

  navigateForward() {
    if (!this.canGoForward()) return false;
    for (let i = this.navHistoryIndex + 1; i < this.navHistory.length; i++) {
      if (this._conversationExists(this.navHistory[i])) {
        this.navHistoryIndex = i;
        return this.selectConversation(this.navHistory[i], false);
      }
    }
    return false;
  }

  selectConversation(convId, recordHistory = true) {
    for (const proj of this.state.projects) {
      const found = (proj.conversations || []).find(c => c.id === convId);
      if (found) {
        this.state.activeProjectId = proj.id;
        this.state.activeConversationId = found.id;
        proj.expanded = true;
        if (recordHistory) this._pushNavHistory(found.id);
        this.saveState();
        return true;
      }
    }
    return false;
  }

  setActiveConversation(convId) {
    return this.selectConversation(convId, true);
  }

  createNewConversation(title = "Yeni Sohbet") {
    return this.createConversation(title);
  }

  createConversation(title = "Yeni Sohbet") {
    const proj = this.getActiveProject();
    if (!proj) return null;

    const newConv = {
      id: "conv-" + Date.now(),
      title: title,
      timestamp: "Şimdi",
      updatedAt: Date.now(),
      pinned: false,
      active: true,
      messages: []
    };

    if (!proj.conversations) proj.conversations = [];
    proj.conversations.unshift(newConv);
    proj.expanded = true;
    this.state.activeConversationId = newConv.id;
    this._pushNavHistory(newConv.id);
    this.saveState();
    return newConv;
  }

  createConversationInProject(projId, title = "Yeni Sohbet") {
    let proj = this.state.projects.find(p => p.id === projId);
    if (!proj) proj = this.getActiveProject();
    if (!proj) return null;

    const newConv = {
      id: "conv-" + Date.now(),
      title: title,
      timestamp: "Şimdi",
      updatedAt: Date.now(),
      pinned: false,
      active: true,
      messages: []
    };

    if (!proj.conversations) proj.conversations = [];
    proj.conversations.unshift(newConv);
    proj.expanded = true;
    this.state.activeProjectId = proj.id;
    this.state.activeConversationId = newConv.id;
    this._pushNavHistory(newConv.id);
    this.saveState();
    return newConv;
  }

  addProject(name, projPath = "") {
    const cleanName = (name || "").trim();
    if (!cleanName) return null;
    const newProj = {
      id: "proj-" + Date.now(),
      name: cleanName,
      path: (projPath || "").trim(),
      expanded: true,
      conversations: []
    };
    this.state.projects.push(newProj);
    this.state.activeProjectId = newProj.id;
    this.saveState();
    return newProj;
  }

  setConversationTitleIfDefault(convId, promptText) {
    for (const proj of this.state.projects) {
      const conv = (proj.conversations || []).find(c => c.id === convId);
      if (conv) {
        conv.timestamp = "Şimdi";
        conv.updatedAt = Date.now();
        if (!conv.title || conv.title === "Yeni Sohbet") {
          const clean = String(promptText || "")
            .replace(/@(file|folder|screen|terminal):[^\s]+/g, "")
            .replace(/\s+/g, " ")
            .trim() || String(promptText || "")
            .replace(/@(file|folder|screen|terminal):/gi, "")
            .replace(/\s+/g, " ")
            .trim();
          if (clean.length > 0) {
            conv.title = clean.length > 38 ? clean.slice(0, 35) + "..." : clean;
          }
        }
        return conv;
      }
    }
    return null;
  }

  deleteProject(projId) {
    const idx = this.state.projects.findIndex(p => p.id === projId);
    if (idx === -1) return false;

    const deletedProj = this.state.projects[idx];
    this.state.projects.splice(idx, 1);

    // If no projects remain, recreate default
    if (this.state.projects.length === 0) {
      this.state.projects.push({
        id: "lux-ai",
        name: "LUX_ai",
        expanded: true,
        conversations: []
      });
    }

    // If active conversation belonged to deleted project, reset active conversation
    const activeConvStillExists = this.state.projects.some(p => 
      p.conversations?.some(c => c.id === this.state.activeConversationId)
    );

    if (!activeConvStillExists) {
      const firstProjWithConv = this.state.projects.find(p => p.conversations && p.conversations.length > 0);
      if (firstProjWithConv) {
        this.state.activeProjectId = firstProjWithConv.id;
        this.state.activeConversationId = firstProjWithConv.conversations[0].id;
      } else {
        this.state.activeProjectId = this.state.projects[0].id;
        this.state.activeConversationId = null;
      }
    }

    this.saveState();
    return true;
  }

  // Model Management Methods
  getModels() {
    if (!Array.isArray(this.state.models)) {
      this.state.models = JSON.parse(JSON.stringify(DEFAULT_MODELS));
      this.state.defaultsSeeded = true;
      this.state.openrouterSeeded = true;
    }
    return this.state.models;
  }

  restoreDefaultModels() {
    const existing = this.getModels();
    DEFAULT_MODELS.forEach(defM => {
      if (!existing.some(m => m.id === defM.id || m.name === defM.name)) {
        existing.push(JSON.parse(JSON.stringify(defM)));
      }
    });
    if (existing.length > 0 && !existing.some(m => m.isDefault)) {
      existing[0].isDefault = true;
    }
    if (existing.length > 0 && !existing.some(m => m.name === this.state.selectedModel)) {
      const def = existing.find(m => m.isDefault) || existing[0];
      this.state.selectedModel = def.name;
    }
    this.state.defaultsSeeded = true;
    this.state.openrouterSeeded = true;
    this.state.dismissedDiscovery = {};
    this.saveState();
    return existing;
  }

  addModel(data) {
    const models = this.getModels();
    const newModel = {
      id: "model-" + Date.now(),
      name: data.name?.trim() || "Özel Model",
      provider: data.provider || "Özel / OpenAI Uyumlu",
      modelId: data.modelId?.trim() || "custom-model",
      apiKey: data.apiKey?.trim() || "",
      endpoint: data.endpoint?.trim() || "",
      isDefault: Boolean(data.isDefault),
      status: "idle",
      lastTested: "Henüz test edilmedi",
      createdAt: new Date().toLocaleDateString("tr-TR")
    };

    if (newModel.isDefault || models.length === 0) {
      models.forEach(m => m.isDefault = false);
      newModel.isDefault = true;
      this.state.selectedModel = newModel.name;
    }

    models.unshift(newModel);
    this.state.defaultsSeeded = true;
    this.state.openrouterSeeded = true;

    const dismissed = this.state.dismissedDiscovery || {};
    if (/11434/.test(newModel.endpoint) || /ollama/i.test(newModel.name) || newModel.provider === "Ollama / Yerel") {
      dismissed.ollama = false;
    }
    if (/1234/.test(newModel.endpoint) || /lm\s*studio/i.test(newModel.name)) {
      dismissed.lmstudio = false;
    }
    if (/20128/.test(newModel.endpoint) || /9router/i.test(newModel.name)) {
      dismissed.nineRouter = false;
    }
    this.state.dismissedDiscovery = dismissed;

    if ((newModel.provider === "OpenRouter" || /openrouter\.ai/i.test(newModel.endpoint || "")) && newModel.apiKey) {
      const vm = this.getVoiceSettings();
      vm.openrouterApiKey = newModel.apiKey;
    }
    this.saveState();
    return newModel;
  }

  updateModel(modelId, data) {
    const models = this.getModels();
    const idx = models.findIndex(m => m.id === modelId);
    if (idx === -1) return false;

    const oldName = models[idx].name;
    const newName = data.name !== undefined ? data.name.trim() : oldName;

    if (data.isDefault) {
      models.forEach(m => m.isDefault = false);
      this.state.selectedModel = newName;
    } else if (this.state.selectedModel === oldName) {
      this.state.selectedModel = newName;
    }

    models[idx] = {
      ...models[idx],
      name: newName,
      provider: data.provider !== undefined ? data.provider : models[idx].provider,
      modelId: data.modelId !== undefined ? data.modelId.trim() : models[idx].modelId,
      apiKey: data.apiKey !== undefined ? data.apiKey.trim() : models[idx].apiKey,
      endpoint: data.endpoint !== undefined ? data.endpoint.trim() : models[idx].endpoint,
      isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : models[idx].isDefault
    };

    if ((models[idx].provider === "OpenRouter" || /openrouter\.ai/i.test(models[idx].endpoint || "")) && data.apiKey !== undefined) {
      const vm = this.getVoiceSettings();
      vm.openrouterApiKey = models[idx].apiKey;
    }

    this.saveState();
    return models[idx];
  }

  deleteModel(modelId) {
    const models = this.getModels();
    const target = models.find(m => m.id === modelId);
    const wasDefault = target?.isDefault;
    const wasSelected = target && target.name === this.state.selectedModel;
    this.state.models = models.filter(m => m.id !== modelId);
    this.state.defaultsSeeded = true;
    this.state.openrouterSeeded = true;

    if (target) {
      const dismissed = { ...(this.state.dismissedDiscovery || {}) };
      if (/11434/.test(target.endpoint || "") || target.name === "Ollama (Yerel)" || target.provider === "Ollama / Yerel") {
        dismissed.ollama = true;
      }
      if (/1234/.test(target.endpoint || "") || /lm\s*studio/i.test(target.name || "")) {
        dismissed.lmstudio = true;
      }
      if (/20128/.test(target.endpoint || "") || /9router/i.test(target.name || "")) {
        dismissed.nineRouter = true;
      }
      this.state.dismissedDiscovery = dismissed;
    }

    // Reassign default/selected model cleanly if deleted
    if (this.state.models.length > 0) {
      if (wasDefault) {
        this.state.models[0].isDefault = true;
      }
      if (wasDefault || wasSelected) {
        const def = this.state.models.find(m => m.isDefault) || this.state.models[0];
        this.state.selectedModel = def.name;
      }
    } else {
      this.state.selectedModel = "";
    }

    this.saveState();
    return true;
  }

  setDefaultModel(modelId) {
    const models = this.getModels();
    models.forEach(m => {
      m.isDefault = (m.id === modelId);
      if (m.isDefault) {
        this.state.selectedModel = m.name;
      }
    });
    this.saveState();
    return true;
  }

  async testModel(modelId) {
    const models = this.getModels();
    const model = models.find(m => m.id === modelId);
    if (!model) return { success: false, message: "Model bulunamadı" };

    model.status = "testing";
    model.lastTested = "Bağlantı test ediliyor...";
    this.notify();

    const startTime = Date.now();
    try {
      const isLocal = model.provider?.includes("Yerel") || model.endpoint?.includes("localhost") || model.endpoint?.includes("127.0.0.1");
      const isOpenRouter = model.provider === "OpenRouter" || /openrouter\.ai/i.test(model.endpoint || "");
      const effectiveApiKey = (model.apiKey || "").trim() || (isOpenRouter ? this.getOpenRouterApiKey() : "");
      if (!effectiveApiKey && !isLocal) {
        model.status = "error";
        model.lastTested = isOpenRouter ? "OpenRouter API Anahtarı eksik" : "API Anahtarı eksik";
        this.saveState();
        return { success: false, message: model.lastTested };
      }

      let res;
      let quotaText = "";
      const timeoutSig = AbortSignal.timeout ? AbortSignal.timeout(isLocal ? 45000 : 12000) : undefined;

      if (model.provider === "Google Gemini") {
        if (/^gemini-(?:1\.[05]|2\.0)-(?:flash|pro)/i.test(model.modelId || "")) {
          model.modelId = "gemini-3.5-flash-lite";
          this.saveState();
        }
        const safeGeminiId = model.modelId || "gemini-3.5-flash-lite";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeGeminiId}:generateContent?key=${effectiveApiKey}`;
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }),
          signal: timeoutSig
        });
      } else if (model.provider === "Anthropic") {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": effectiveApiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: model.modelId || "claude-3-5-sonnet-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }]
          }),
          signal: timeoutSig
        });
      } else {
        // OpenAI, OpenRouter, DeepSeek, 9Router, Ollama
        if (isLocal && /11434/.test(model.endpoint || "")) {
          await window.luxAPI?.ensureOllama?.().catch(() => {});
        }
        let base = (model.endpoint || "https://api.openai.com/v1").replace(/\/+$/, "");
        const headers = { "Content-Type": "application/json" };
        if (effectiveApiKey) headers["Authorization"] = `Bearer ${effectiveApiKey}`;
        if (isOpenRouter) headers["X-Title"] = "Lux AI";

        let testModelId = model.modelId || (isOpenRouter ? "openrouter/free" : "gpt-4o");
        if (model.endpoint?.includes("20128") && (testModelId === "yapay" || testModelId === "vscombo" || testModelId === "openrouter/free" || !testModelId)) {
          testModelId = "oc/flint-40b-free";
          model.modelId = "oc/flint-40b-free";
        }

        if (isOpenRouter) {
          if (!model.apiKey && effectiveApiKey) model.apiKey = effectiveApiKey;
          res = await fetch(`${base}/key`, {
            method: "GET",
            headers,
            signal: timeoutSig
          });
          if (res && res.ok) {
            try {
              const keyInfo = await res.clone().json();
              const freeQuota = keyInfo?.data?.free_model_daily_requests;
              if (freeQuota && typeof freeQuota.remaining === "number" && typeof freeQuota.limit === "number") {
                quotaText = ` · Kalan: ${freeQuota.remaining}/${freeQuota.limit}`;
              }
            } catch (_) {}
          }
        } else {
          const url = (base.endsWith("/chat/completions") || /\/api\/chat$/i.test(base)) ? base : `${base}/chat/completions`;
          const isNativeOllamaChat = /\/api\/chat$/i.test(url);
          res = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(
              isNativeOllamaChat
                ? {
                    model: testModelId,
                    messages: [{ role: "user", content: "hi" }],
                    stream: false,
                    options: { num_predict: 1 }
                  }
                : {
                    model: testModelId,
                    messages: [{ role: "user", content: "hi" }],
                    max_tokens: 1
                  }
            ),
            signal: timeoutSig
          });
        }
      }

      const elapsed = Date.now() - startTime;
      if (res && res.ok) {
        model.status = "success";
        model.lastTested = `Bağlantı Başarılı (200 OK${quotaText} - ${elapsed}ms)`;
        this.saveState();
        return { success: true, message: `200 OK${quotaText} (${elapsed}ms)` };
      } else {
        let errDetail = `HTTP ${res ? res.status : 'Hata'}`;
        try {
          const errData = await res.json();
          if (errData?.error?.message) errDetail = errData.error.message;
        } catch (_) {}
        model.status = "error";
        model.lastTested = `Hata (${res ? res.status : '400'}): ${errDetail.slice(0, 50)}`;
        this.saveState();
        return { success: false, message: errDetail };
      }
    } catch (err) {
      model.status = "error";
      model.lastTested = `Erişim Hatası: ${err.message || 'Zaman aşımı'}`;
      this.saveState();
      return { success: false, message: err.message };
    }
  }

  // Model & Agent Permissions Management (1:1 Antigravity Security Architecture)
  getPermissions() {
    if (!this.state.permissions) {
      this.state.permissions = { ...UNLIMITED_PERMISSIONS };
    }
    return this.state.permissions;
  }

  isUnlimitedMode() {
    const p = this.getPermissions();
    const capabilityKeys = Object.keys(UNLIMITED_PERMISSIONS).filter(k => k !== "env_secrets_protection");
    return capabilityKeys.every(k => p[k] !== false) && p.env_secrets_protection === false;
  }

  enableUnlimitedMode() {
    this.state.permissions = { ...UNLIMITED_PERMISSIONS };
    this.state.permissionsPolicyVersion = 2;
    this.saveState();
    return this.state.permissions;
  }

  setPermission(key, value) {
    if (!this.state.permissions) {
      this.getPermissions();
    }
    this.state.permissions[key] = Boolean(value);
    this.saveState();
    return this.state.permissions;
  }

  resetPermissions() {
    this.state.permissions = { ...UNLIMITED_PERMISSIONS };
    this.state.permissionsPolicyVersion = 2;
    this.saveState();
    return this.state.permissions;
  }

  setAllPermissions(enabled) {
    if (!this.state.permissions) {
      this.getPermissions();
    }
    const target = Boolean(enabled);
    Object.keys(UNLIMITED_PERMISSIONS).forEach(key => {
      if (key === "env_secrets_protection") {
        this.state.permissions[key] = !target;
      } else {
        this.state.permissions[key] = target;
      }
    });
    this.saveState();
    return this.state.permissions;
  }

  // Notifications & Sound Preferences (1:1 Antigravity)
  getNotifications() {
    if (!this.state.notifications) {
      this.state.notifications = {
        agentNotifications: true,
        agentSounds: true,
        soundVolume: 100
      };
    }
    return this.state.notifications;
  }

  setNotificationSetting(key, value) {
    if (!this.state.notifications) {
      this.getNotifications();
    }
    this.state.notifications[key] = value;
    this.saveState();
    this.notify();
    return this.state.notifications;
  }

  playAntigravitySound(soundName) {
    const notifs = this.getNotifications();
    if (notifs && notifs.agentSounds === false) return;
    const vol = typeof notifs.soundVolume === "number" ? notifs.soundVolume : 100;
    if (vol <= 0) return;
    try {
      const audio = new Audio(`assets/sounds/${soundName}.mp3`);
      audio.volume = Math.max(0, Math.min(1, vol / 100));
      audio.play().catch(() => {});
    } catch (e) {}
  }

  playNotificationSound() {
    // Never play notification chimes when voice mode is active
    if (window.voiceSessionActive) return;

    const notifs = this.getNotifications();
    if (!notifs.agentSounds) return;
    const vol = typeof notifs.soundVolume === "number" ? notifs.soundVolume : 100;
    if (vol <= 0) return;

    // Debounce to prevent repetitive looping
    const now = Date.now();
    if (this._lastNotificationSoundTime && (now - this._lastNotificationSoundTime < 2500)) {
      return;
    }
    this._lastNotificationSoundTime = now;

    try {
      const audio = new Audio("assets/sounds/chatUserActionRequired.mp3");
      audio.volume = Math.max(0, Math.min(1, vol / 100));
      audio.play().catch(() => {});
    } catch (e) {
      console.warn("Audio chime playback error", e);
    }
  }

  triggerSystemNotification(title, body) {
    const notifs = this.getNotifications();
    if (notifs.agentSounds) {
      this.playNotificationSound();
    }
    if (!notifs.agentNotifications) return;

    try {
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(title, { body });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              new Notification(title, { body });
            }
          });
        }
      }
    } catch (e) {
      console.warn("System notification error", e);
    }
  }

  // Antigravity Voice Mode (Gemini Live) State & Voices (LLM seçiminden tamamen bağımsız)
  getVoiceSettings() {
    if (!this.state.voiceMode) {
      this.state.voiceMode = {
        voice: "Fola",
        microphone: "default",
        volume: 100,
        speed: 1.0,
        engineMode: "auto",
        sttEngine: "auto",
        streamingTts: true,
        cloneRefPath: "",
        openrouterApiKey: "",
        isMuted: false,
        isSpeakerMuted: false,
        active: false
      };
    }
    if (!this.state.voiceMode.engineMode) {
      this.state.voiceMode.engineMode = "auto";
    }
    if (!this.state.voiceMode.sttEngine) {
      this.state.voiceMode.sttEngine = "auto";
    }
    if (typeof this.state.voiceMode.streamingTts !== "boolean") {
      this.state.voiceMode.streamingTts = true;
    }
    if (typeof this.state.voiceMode.cloneRefPath !== "string") {
      this.state.voiceMode.cloneRefPath = "";
    }
    if (typeof this.state.voiceMode.openrouterApiKey !== "string") {
      this.state.voiceMode.openrouterApiKey = "";
    }
    return this.state.voiceMode;
  }

  getOpenRouterApiKey() {
    const vm = this.getVoiceSettings();
    if (vm.openrouterApiKey && vm.openrouterApiKey.trim()) {
      return vm.openrouterApiKey.trim();
    }
    const models = this.getModels();
    const orModel = models.find(m =>
      (m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "")) &&
      m.apiKey &&
      m.apiKey.trim() &&
      !m.apiKey.includes("demoKey") &&
      !m.apiKey.includes("••••")
    );
    return orModel ? orModel.apiKey.trim() : "";
  }

  setOpenRouterApiKey(apiKey) {
    const clean = String(apiKey || "").trim();
    const vm = this.getVoiceSettings();
    vm.openrouterApiKey = clean;
    const models = this.getModels();
    models.forEach(m => {
      if (m.provider === "OpenRouter" || /openrouter\.ai/i.test(m.endpoint || "")) {
        m.apiKey = clean;
        if (clean) {
          if (m.status !== "success") {
            m.status = "idle";
            m.lastTested = "Anahtar kaydedildi · Test edebilirsiniz";
          }
        } else {
          m.status = "idle";
          m.lastTested = "13 ücretsiz LLM hazır · API anahtarı ekle";
        }
      }
    });
    this.saveState();
    this.notify();
    return clean;
  }

  setVoiceSetting(key, value) {
    if (key === "openrouterApiKey") {
      this.setOpenRouterApiKey(value);
      return this.getVoiceSettings();
    }
    const v = this.getVoiceSettings();
    v[key] = value;
    this.saveState();
    this.notify();
    return v;
  }

  getAvailableVoices() {
    return [
      {
        id: "Fola",
        name: "Fola",
        desc: "Doğal ve samimi kadın sesi",
        color: "#3B82F6",
        secondaryColor: "#93C5FD",
        pitch: 1.1,
        rate: 1.05,
        previewText: "Merhaba! Ben Fola. Net ve samimi bir tonla Lux AI asistanınızım."
      },
      {
        id: "Arlo",
        name: "Arlo",
        desc: "Kendinden emin ve dengeli erkek sesi",
        color: "#EAB308",
        secondaryColor: "#FDE047",
        pitch: 0.9,
        rate: 1.0,
        previewText: "Selam! Ben Arlo. Kendinden emin ve akıcı bir şekilde yardımcı olmaya hazırım."
      },
      {
        id: "Piper-DFKI",
        name: "Piper DFKI TR",
        desc: "Yerel CPU nöral Türkçe ses (İnternetsiz)",
        color: "#10B981",
        secondaryColor: "#6EE7B7",
        pitch: 1.0,
        rate: 1.0,
        previewText: "Merhaba! Ben Piper Türkçe yerel nöral ses motoruyum, tamamen bilgisayarında çalışırım."
      },
      {
        id: "Piper-Fahrettin",
        name: "Piper Fahrettin TR",
        desc: "Tok, doğal yerel Türkçe erkek sesi (İnternetsiz)",
        color: "#059669",
        secondaryColor: "#34D399",
        pitch: 0.95,
        rate: 1.0,
        previewText: "Selamlar, ben Fahrettin. Yerel Piper motoruyla sıfır gecikmeli Türkçe konuşuyorum."
      },
      {
        id: "Piper-Fettah",
        name: "Piper Fettah TR",
        desc: "Enerjik ve akıcı yerel Türkçe sesi (İnternetsiz)",
        color: "#14B8A6",
        secondaryColor: "#5EEAD4",
        pitch: 1.02,
        rate: 1.0,
        previewText: "Selam dostum, ben Fettah. Akıcı yerel Türkçe sentezim her an emrinde."
      },
      {
        id: "Kokoro-af_heart",
        name: "Kokoro Heart (82M)",
        desc: "Işık hızında ultra akıcı Kokoro-82M kadın sesi (EN/Çok Dilli)",
        color: "#F59E0B",
        secondaryColor: "#FCD34D",
        pitch: 1.05,
        rate: 1.0,
        previewText: "Hello! I am Kokoro Heart running at millisecond speed locally on your CPU."
      },
      {
        id: "Kokoro-af_bella",
        name: "Kokoro Bella (82M)",
        desc: "Sıcak ve modern Kokoro-82M kadın sesi (EN/Çok Dilli)",
        color: "#FB923C",
        secondaryColor: "#FDBA74",
        pitch: 1.08,
        rate: 1.0,
        previewText: "Hi there! This is Kokoro Bella streaming on CPU with crystal clear clarity."
      },
      {
        id: "Kokoro-am_adam",
        name: "Kokoro Adam (82M)",
        desc: "Tok ve dengeli Kokoro-82M erkek sesi (EN/Çok Dilli)",
        color: "#D97706",
        secondaryColor: "#FBBF24",
        pitch: 0.92,
        rate: 1.0,
        previewText: "Hello, I am Kokoro Adam, lightweight 82 million parameter neural speech."
      },
      {
        id: "Kokoro-am_michael",
        name: "Kokoro Michael (82M)",
        desc: "Güven veren net Kokoro-82M erkek sesi (EN/Çok Dilli)",
        color: "#B45309",
        secondaryColor: "#F59E0B",
        pitch: 0.96,
        rate: 1.0,
        previewText: "Good to see you. Kokoro Michael is ready for ultra fast dialogue."
      },
      {
        id: "XTTS-Clone",
        name: "Coqui XTTS-v2 (Ses Klonlama)",
        desc: "Referans ses dosyasından sıfırdan çok dilli ses klonlama",
        color: "#8B5CF6",
        secondaryColor: "#C4B5FD",
        pitch: 1.0,
        rate: 1.0,
        previewText: "Merhaba! Ben Coqui XTTS v2 ses klonlama motoruyum, örnek ses tonunu birebir taklit edebilirim."
      },
      {
        id: "OpenRouter-Fish-S2.1",
        name: "Fish S2.1 Pro (OpenRouter)",
        desc: "OpenRouter $0 ücretsiz Türkçe + 80 dil doğal seslendirme",
        color: "#0EA5E9",
        secondaryColor: "#7DD3FC",
        pitch: 1.0,
        rate: 1.0,
        previewText: "Selam! Ben OpenRouter üzerindeki Fish Audio S2.1 Pro ücretsiz ses modeliyim."
      },
      {
        id: "OpenRouter-Fish-S2.1-Clone",
        name: "Fish S2.1 Pro Klon (OpenRouter)",
        desc: "OpenRouter $0 ücretsiz referans ses dosyasından bulut klonlama",
        color: "#0284C7",
        secondaryColor: "#38BDF8",
        pitch: 1.0,
        rate: 1.0,
        previewText: "Merhaba! Referans ses örneğinle bulutta ücretsiz ses klonlaması yapıyorum."
      },
      {
        id: "OpenRouter-HeyGen-Nadine",
        name: "HeyGen Nadine (OpenRouter)",
        desc: "OpenRouter :free stüdyo kadın sesi (44.1 kHz, TR destekli)",
        color: "#EC4899",
        secondaryColor: "#F9A8D4",
        pitch: 1.0,
        rate: 1.0,
        previewText: "Merhaba! Ben HeyGen Voice Turbo Nadine, OpenRouter üzerinden ücretsiz stüdyo sesiyim."
      },
      {
        id: "OpenRouter-HeyGen-Bram",
        name: "HeyGen Bram (OpenRouter)",
        desc: "OpenRouter :free tok stüdyo erkek sesi (44.1 kHz, TR destekli)",
        color: "#14B8A6",
        secondaryColor: "#5EEAD4",
        pitch: 0.95,
        rate: 1.0,
        previewText: "Selam! Ben HeyGen Voice Turbo Bram, net ve akıcı bir tonla konuşuyorum."
      },
      {
        id: "OpenRouter-HeyGen-Noelle",
        name: "HeyGen Noelle (OpenRouter)",
        desc: "OpenRouter :free canlı ve berrak kadın sesi (44.1 kHz)",
        color: "#F43F5E",
        secondaryColor: "#FDA4AF",
        pitch: 1.05,
        rate: 1.0,
        previewText: "Harika bir gün! Ben HeyGen Voice Turbo Noelle, her zaman konuşmaya hazırım."
      },
      {
        id: "OpenRouter-HeyGen-Lucian",
        name: "HeyGen Lucian (OpenRouter)",
        desc: "OpenRouter :free sakin ve profesyonel erkek sesi (44.1 kHz)",
        color: "#6366F1",
        secondaryColor: "#A5B4FC",
        pitch: 0.92,
        rate: 1.0,
        previewText: "Merhaba, ben HeyGen Voice Turbo Lucian. Dengeli stüdyo sesiyle yanındayım."
      },
      {
        id: "Puck",
        name: "Puck",
        desc: "Dinamik, genç ve enerjik erkek sesi",
        color: "#EC4899",
        secondaryColor: "#F472B6",
        pitch: 1.25,
        rate: 1.15,
        previewText: "Harika! Ben Puck. Enerjik ve neşeli bir tempoda birlikte çalışalım."
      },
      {
        id: "Charon",
        name: "Charon",
        desc: "Sakin, derin bariton erkek sesi",
        color: "#8B5CF6",
        secondaryColor: "#C084FC",
        pitch: 0.75,
        rate: 0.95,
        previewText: "Merhaba, ben Charon. Sakin, derin ve odaklanmış bir yaklaşımla buradayım."
      },
      {
        id: "Kore",
        name: "Kore",
        desc: "Yumuşak ve düşünceli kadın sesi",
        color: "#10B981",
        secondaryColor: "#6EE7B7",
        pitch: 1.05,
        rate: 1.0,
        previewText: "Merhaba, ben Kore. Sıcak ve düşünceli tavsiyelerle yanınızdayım."
      },
      {
        id: "Fenrir",
        name: "Fenrir",
        desc: "Güçlü ve kararlı erkek sesi",
        color: "#EF4444",
        secondaryColor: "#FCA5A5",
        pitch: 0.8,
        rate: 1.1,
        previewText: "Selam, ben Fenrir. Doğrudan ve güçlü çözümlere odaklanalım."
      },
      {
        id: "Aoede",
        name: "Aoede",
        desc: "Melodik, parlak ve neşeli kadın sesi",
        color: "#06B6D4",
        secondaryColor: "#67E8F9",
        pitch: 1.2,
        rate: 1.1,
        previewText: "Merhaba, ben Aoede. Akıcı ve aydınlık fikirlerle projeler üretelim."
      },
      {
        id: "Zephyr",
        name: "Zephyr",
        desc: "Hızlı, dinamik ve net erkek sesi",
        color: "#A855F7",
        secondaryColor: "#D8B4FE",
        pitch: 1.0,
        rate: 0.9,
        previewText: "Merhaba, ben Zephyr. Nazik ve yumuşak bir sesle size eşlik ediyorum."
      },
      {
        id: "Villainess",
        name: "Kötü Kadın (Villainess)",
        desc: "Karanlık, mesafeli ve alaycı kadın sesi",
        color: "#DC2626",
        secondaryColor: "#F87171",
        pitch: 0.85,
        rate: 0.94,
        previewText: "Demek buraya kadar gelebildin... Fazla cesursun. Bakalım sistemin karanlığıma dayanabilecek mi?"
      }
    ];
  }

  async playVoiceSample(voiceId) {
    const list = this.getAvailableVoices();
    const v = list.find(item => item.id === voiceId) || list[0];
    const settings = this.getVoiceSettings();
    if (settings.isSpeakerMuted) return;

    const seq = (this._sampleSeq = (this._sampleSeq || 0) + 1);
    if (this._sampleAudioPlayer) {
      try { this._sampleAudioPlayer.pause(); } catch (_) {}
      this._sampleAudioPlayer = null;
    }

    try {
      if (window.luxAPI?.voice?.synthesize) {
        const openrouterApiKey = this.getOpenRouterApiKey();
        const res = await window.luxAPI.voice.synthesize(
          v.previewText,
          voiceId,
          settings.speed,
          settings.engineMode || "auto",
          settings.cloneRefPath || "",
          { openrouterApiKey }
        );
        if (seq !== this._sampleSeq) return;
        if (res?.success && res.audioBase64) {
          const audio = new Audio(res.audioBase64);
          audio.volume = Math.max(0, Math.min(1, (settings.volume ?? 100) / 100));
          if (/^openrouter-/i.test(res.engine || "")) {
            audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(settings.speed) || 1.0));
          }
          this._sampleAudioPlayer = audio;
          await audio.play();
          return;
        } else if (res && !res.success) {
          console.warn("Voice sample synthesis failed:", res.error);
        }
      }
    } catch (e) {
      console.warn("Neural voice sample error:", e);
    }
  }
}

window.appStore = new AppStore();
window.playAntigravitySound = function(soundName) {
  if (window.appStore?.playAntigravitySound) {
    window.appStore.playAntigravitySound(soundName);
  } else {
    try {
      const audio = new Audio(`assets/sounds/${soundName}.mp3`);
      audio.play().catch(() => {});
    } catch (e) {}
  }
};
