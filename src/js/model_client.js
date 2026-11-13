// LUX AI — Model istemci katmanı
//
// Aktif model seçimi, istek zaman aşımı/iptal yönetimi, hata sınıflandırma,
// OpenRouter cooldown, Gemini/Ollama/OpenAI-uyumlu/Anthropic uçları ve çevrimdışı
// doğal yanıt motoru. chat.js'ten ayrıştırıldı; klasik script globalinde tanım
// kazanır, chat.js'ten ÖNCE yüklenir. (buildAgentSystemParts, executeToolCallsBatch
// gibi döngü yardımcıları hâlâ chat.js'tedir ve çalışma anında globalden çözülür.)

function luxEn() {
  try {
    return typeof window !== "undefined" && Boolean(window.LuxI18n) && window.LuxI18n.locale === "en";
  } catch (_) {
    return false;
  }
}

function getActiveModel() {
  const models = window.appStore.getModels();
  if (!Array.isArray(models) || models.length === 0) return null;
  const selectedName = window.appStore.state.selectedModel;
  let model = models.find((m) => m.name === selectedName);
  if (!model && (selectedName === "9rputer" || selectedName === "9Router")) {
    model = models.find((m) => m.name === "9Router" || m.name === "9rputer");
  }
  if (!model) model = models.find((m) => m.isDefault);
  if (!model && models.length > 0) model = models[0];
  return model || null;
}

function createRequestAbortHelper(timeoutMs = 45000) {
  const controller = new AbortController();
  currentAbortController = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort(new DOMException("Zaman aşımı", "TimeoutError"));
    } catch (_) {
      controller.abort();
    }
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
    throw new Error(luxEn() ? "Local network permission (network_localhost) is disabled" : "Yerel ağ izni (network_localhost) kapatılmış");
  }
  if (!isLocal && perms.network_internet === false) {
    throw new Error(
      luxEn() ? "Internet access permission (network_internet) is disabled" : "İnternet erişim izni (network_internet) kapatılmış"
    );
  }

  const isOpenRouter = model?.provider === "OpenRouter" || /openrouter\.ai/i.test(model?.endpoint || "");
  // Anahtar artık bellekte maskeli (••••) tutuluyor; gerçek değeri şifreli
  // kasadan çözüyoruz. Kasa boşsa eski davranışa (bellek) düşer.
  const vaultKey = isLocal ? "" : await (window.appStore?.resolveModelApiKey?.(model) ?? Promise.resolve(""));
  const effectiveKey =
    vaultKey ||
    ((model?.apiKey || "").trim() && !String(model.apiKey).includes("••••") ? String(model.apiKey).trim() : "") ||
    (isOpenRouter ? await (window.appStore?.resolveOpenRouterApiKey?.() ?? Promise.resolve("")) : "");
  const isMockKey = effectiveKey && (effectiveKey.includes("demoKey") || effectiveKey.includes("••••"));

  if ((!isLocal && !effectiveKey) || (!effectiveKey && !model?.endpoint) || isMockKey) {
    throw new Error(luxEn() ? "Configured real API key is missing" : "Yapılandırılmış gerçek API anahtarı yok");
  }

  const resolvedModel = effectiveKey ? { ...model, apiKey: effectiveKey } : model;

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
  const isMissingKey =
    msg === "Yapılandırılmış gerçek API anahtarı yok" ||
    msg === "API Anahtarı eksik" ||
    msg === "Configured real API key is missing" ||
    msg === "API key missing";
  const isPermissionBlocked = /izni\s*\([^)]+\)\s*kapatılmış|permission\s*\([^)]+\)\s*(is\s*)?(disabled|blocked|denied)/i.test(msg);
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
  const en = luxEn();
  const modelLabel = activeModel?.name || (en ? "Selected model" : "Seçili model");
  const modelIdTag = activeModel?.modelId ? ` (\`${activeModel.modelId}\`)` : "";

  if (info.isPermissionBlocked) {
    return en
      ? `⚠ Operation stopped by a security permission: \`${info.msg}\`. Check **Settings → Permissions**.`
      : `⚠ İşlem güvenlik izni nedeniyle durduruldu: \`${info.msg}\`. **Ayarlar → İzinler** bölümünden kontrol edebilirsin.`;
  }
  if (info.isMissingKey) {
    return en
      ? `⚠ **${modelLabel}** is selected but no API key has been entered yet. Add a key in **Settings → Models**, or switch to a local **Ollama** model from the bottom-left.`
      : `⚠ **${modelLabel}** seçili ama API anahtarı henüz girilmemiş. **Ayarlar → Modeller**'den anahtarını ekleyebilir ya da sol alttan yerel **Ollama** modeline geçebilirsin.`;
  }
  if (info.isRateLimit && info.isOpenRouter && info.isDailyOrCreditQuota) {
    return en
      ? `⚠ **${modelLabel}**${modelIdTag} hit the free daily request limit (**HTTP 429**) (OpenRouter free tier: 50 requests/day).\n\nSwitch to a local **Ollama** or **Google Gemini** model from the bottom-left, or top up your OpenRouter balance.`
      : `⚠ **${modelLabel}**${modelIdTag} ücretsiz günlük istek limitine (**HTTP 429**) ulaştı (OpenRouter free katmanı: günde 50 istek).\n\nSol alttan yerel **Ollama** veya **Google Gemini** modeline geçebilir ya da OpenRouter hesabına bakiye ekleyebilirsin.`;
  }
  if (info.isRateLimit) {
    return en
      ? `⚠ **${modelLabel}**${modelIdTag} hit the rate limit (**HTTP 429 — Rate Limit**): \`${info.msg}\`. Wait a moment and retry, or pick another model from the bottom-left.`
      : `⚠ **${modelLabel}**${modelIdTag} istek sınırına (**HTTP 429 — Rate Limit**) takıldı: \`${info.msg}\`. Kısa süre bekleyip tekrar deneyebilir veya sol alttan başka bir model seçebilirsin.`;
  }
  if (info.isAuthOrBilling) {
    const codeStr = info.status ? `HTTP ${info.status}` : en ? "Authorization" : "Yetkilendirme";
    return en
      ? `⚠ **${modelLabel}** connection error (**${codeStr}**): \`${info.msg}\`. Check the API key/balance in **Settings → Models**.`
      : `⚠ **${modelLabel}** bağlantı hatası (**${codeStr}**): \`${info.msg}\`. **Ayarlar → Modeller** kısmından API anahtarını/bakiyeni kontrol et.`;
  }
  if (info.isRetiredOrMissingModel) {
    return en
      ? `⚠ The selected model**${modelIdTag}** was not found or has been retired on the provider side (**HTTP 404**): \`${info.msg}\`. Pick a current model in **Settings → Models**.`
      : `⚠ Seçili model**${modelIdTag}** sağlayıcı tarafında bulunamadı veya kullanımdan kaldırıldı (**HTTP 404**): \`${info.msg}\`. **Ayarlar → Modeller**'den güncel bir model seçebilirsin.`;
  }
  if (info.isTimeout) {
    return en
      ? `⚠ **${modelLabel}**${modelIdTag} exceeded the response time limit (**Timeout**). Check your connection and retry, or pick a faster model.`
      : `⚠ **${modelLabel}**${modelIdTag} yanıt süresi sınırını aştı (**Zaman Aşımı**). Bağlantını kontrol edip tekrar deneyebilir ya da daha hızlı bir model seçebilirsin.`;
  }
  const codeBadge = info.status ? ` (**HTTP ${info.status}**)` : "";
  return en
    ? `⚠ **${modelLabel}**${modelIdTag} could not respond right now${codeBadge}: \`${info.msg || "Unknown connection error"}\`.`
    : `⚠ **${modelLabel}**${modelIdTag} şu an yanıt veremedi${codeBadge}: \`${info.msg || "Bilinmeyen bağlantı hatası"}\`.`;
}

async function callModelWithFallback(activeModel, text, messages, assistantMsg) {
  if (!activeModel) {
    return luxEn()
      ? "You don't have a saved or selected LLM model right now. Add or select one in Settings → Models."
      : "Şu an kayıtlı veya seçili bir LLM modelin yok. Ayarlar → Modeller üzerinden istediğin bir modeli ekleyip seçebilirsin.";
  }
  try {
    return await callSingleModel(activeModel, text, messages, assistantMsg);
  } catch (err) {
    if (isTurnCanceled(assistantMsg) || err?.name === "AbortError") {
      throw err;
    }

    const errInfo = classifyModelApiError(err, activeModel);
    console.warn(`Primary model (${activeModel.name}) failed [${errInfo.status || "ERR"}]:`, err.message);

    const autoHealEnabled = window.appStore?.state?.general?.autoHeal !== false;
    const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
    const shouldTryLocalFallback =
      !isVoiceTurn &&
      !errInfo.isRateLimit &&
      !errInfo.isAuthOrBilling &&
      !errInfo.isPermissionBlocked &&
      (autoHealEnabled || errInfo.isMissingKey);

    // Text mode only: fall back to warm/configured local Ollama if cloud endpoint is unreachable or key isn't set yet
    if (shouldTryLocalFallback) {
      const models = window.appStore?.getModels() || [];
      const localModel = models.find(
        (m) =>
          (m.provider === "Ollama / Yerel" || m.name.includes("Ollama") || m.endpoint?.includes("11434") || m.endpoint?.includes("1234")) &&
          m.id !== activeModel.id &&
          (m.status === "success" || m.endpoint?.includes("11434"))
      );

      if (localModel) {
        try {
          console.log(`⚡ Lux Auto-Fallback: Switching to ${localModel.name} (${localModel.modelId})`);
          if (assistantMsg) {
            assistantMsg.__streamReset?.();
            assistantMsg.modelName = `${localModel.name} (Otomatik Yedek)`;
            assistantMsg.stepLabel = luxEn()
              ? `⚡ ${activeModel.name} unreachable, switched to local ${localModel.name}.`
              : `⚡ ${activeModel.name} erişilemedi, yerel ${localModel.name} modeline geçildi.`;
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
      assistantMsg.stepLabel = luxEn()
        ? `⚠ ${activeModel.name} error${errInfo.status ? ` (HTTP ${errInfo.status})` : ""}`
        : `⚠ ${activeModel.name} hatası${errInfo.status ? ` (HTTP ${errInfo.status})` : ""}`;
    }
    return formatModelApiErrorMessage(err, activeModel);
  }
}

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
  if (!apiKey) throw Object.assign(new Error(luxEn() ? "API key missing" : "API Anahtarı eksik"), { status: 401 });
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
          .filter((p) => !p.thought && typeof p.text === "string")
          .map((p) => p.text)
          .join("");
        if (text) streamOpts.onToken?.(text, text);
        return { text: text || (luxEn() ? "Empty response received." : "Boş yanıt alındı.") };
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

      return { text: fullText || (luxEn() ? "Empty response received." : "Boş yanıt alındı.") };
    } catch (err) {
      if (req.didTimeout()) throw new Error(luxEn() ? "Gemini request timed out" : "Gemini isteği zaman aşımına uğradı");
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
  const rollup = window.LuxContextRollup?.withRollupContext
    ? window.LuxContextRollup.withRollupContext(prompt, history, { keepRecent: 12 })
    : { prompt, kept: history.slice(-12) };
  const effectivePrompt = rollup.prompt;
  const contents = [];
  rollup.kept.forEach((m) => {
    if (m.content) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      });
    }
  });
  contents.push({ role: "user", parts: [{ text: effectivePrompt }] });

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
        return luxEn() ? "Done — all steps completed." : "İşlemleri tamamladım.";
      }
      return reply ? cleanAssistantFinalText(reply) : luxEn() ? "Action completed." : "İşlem tamamlandı.";
    }

    contents.push({ role: "model", parts: [{ text: reply }] });
    const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, (tc) => ({ name: tc.name, args: tc.args }));
    const toolResults = batchResults.map(
      (r) => `${luxEn() ? "Tool" : "Araç"} (${r.name}) ${luxEn() ? "result" : "sonucu"}:\n${r.execRes.resultText}`
    );
    contents.push({
      role: "user",
      parts: [
        {
          text: luxEn()
            ? `${toolResults.join("\n\n")}\n\nBased on these real tool outputs, give the user a warm, casual, clear answer in natural English.`
            : `${toolResults.join("\n\n")}\n\nBu gerçek araç çıktılarına dayanarak kullanıcıya samimi 'sen' diliyle, doğal ve net Türkçe yanıt ver.`
        }
      ]
    });
  }

  if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
  assistantMsg?.__streamReset?.();
  const finalReply = await callGeminiAPIOnce(model, contents, systemPrompt, {
    timeoutMs,
    onToken: assistantMsg?.__onStreamToken
  });
  return cleanAssistantFinalText(finalReply) || (luxEn() ? "Done — all steps completed." : "İşlemleri tamamladım.");
}

async function fetchOllamaNativeChat(ollamaBaseUrl, payload, timeoutMs = 150000, streamOpts = {}) {
  const req = createRequestAbortHelper(timeoutMs);
  const root = String(ollamaBaseUrl || "http://127.0.0.1:11434")
    .replace(/\/(?:v1(?:\/chat\/completions)?|api\/chat)$/i, "")
    .replace(/\/+$/, "");
  const isQwen3 = /^qwen3/i.test(String(payload.model || ""));
  const approxChars = Array.isArray(payload.messages) ? payload.messages.reduce((s, m) => s + String(m.content || "").length, 0) : 0;
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
    if (req.didTimeout()) throw new Error(luxEn() ? "Model response timed out" : "Model yanıtı zaman aşımına uğradı");
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
        const e = new Error(parsed.error.message || (luxEn() ? "Upstream stream error" : "Upstream akış hatası"));
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
    if (req.didTimeout()) throw new Error(luxEn() ? "Model response timed out" : "Model yanıtı zaman aşımına uğradı");
    throw err;
  } finally {
    req.cleanup();
  }
}

async function callOpenAICompatibleAPI(model, prompt, history, assistantMsg) {
  let base = (model.endpoint || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = base.endsWith("/chat/completions") || /\/api\/chat$/i.test(base) ? base : `${base}/chat/completions`;

  const isOpenRouter = model.provider === "OpenRouter" || /openrouter\.ai/i.test(base);
  let effectiveApiKey = (model.apiKey || "").trim();
  if (!effectiveApiKey || effectiveApiKey.includes("••••")) {
    effectiveApiKey = await (window.appStore?.resolveModelApiKey?.(model) ?? Promise.resolve(""));
  }
  if (!effectiveApiKey && isOpenRouter) {
    effectiveApiKey = await (window.appStore?.resolveOpenRouterApiKey?.() ?? Promise.resolve(""));
  }
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
  if (
    base.includes("20128") &&
    (targetModelId === "yapay" || targetModelId === "vscombo" || targetModelId === "openrouter/free" || !targetModelId)
  ) {
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
  const requestTimeoutMs = isLocalCpu ? (isLarge14b ? 300000 : isMedium7b ? 210000 : 180000) : isVoiceTurn ? 18000 : 45000;
  const userQuestionOnly = String(prompt || "").split(/\n---\n\[/)[0];
  const isGroundedTurn =
    /\[Hafıza Kontrol Sonucu|\[Hafıza Durumu|\[GÜNCEL ÇALIŞMA ALANI TARAMASI|\[GÜNCEL PROJE TARAMASI|\[MASAÜSTÜ & ÇALIŞMA ALANI PROJELERİ|\[ÇALIŞMA ALANI DOSYA RAPORU/i.test(
      prompt
    );
  const skipCalibration =
    isGroundedTurn ||
    /(?:^|\s)size\b.*?(kullanma|deme|söyleme|yasak|istemiyorum)|resmi\s*(konuşma|olma)|(?:^|\s)(?:do not|don't)\s+(?:use|say|be).*?formal|formal\s*(?:language|speech|tone|address)|no\s+formal/i.test(
      userQuestionOnly
    );

  const hasToolsBridge = Boolean(window.luxAPI?.fs || window.luxAPI?.agent);
  const preGroundedAlready = Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.length > 0;
  let useNativeTools = hasToolsBridge && shouldAttachToolsForPrompt(prompt, history);
  // Skip redundant tools if turn was already pre-grounded on FS listing unless writing/web/media/pc
  if (
    preGroundedAlready &&
    !/(?:^|[\s,.;:!?])(?:oku|read|yaz|write|değiştir|duzenle|ara|search|komut|run|terminal|web|internet|hava|resim|görsel|tasarla|ninni|ekran|aç|sil|taşı|pc|uygulama|kur)(?=$|[\s,.;:!?])/i.test(
      userQuestionOnly
    )
  ) {
    useNativeTools = false;
  }
  const toolsForTurn = useNativeTools ? selectToolsForPrompt(prompt, isLocalCpu, history) : [];
  if (toolsForTurn.length === 0) useNativeTools = false;

  const messages = [
    {
      role: "system",
      content: buildAgentSystemPrompt(prompt, history, {
        includeXmlInstruction: !useNativeTools && hasToolsBridge && shouldAttachToolsForPrompt(prompt, history)
      })
    }
  ];
  if (!skipCalibration && !useNativeTools && !shouldAttachToolsForPrompt(prompt, history) && history.length === 0) {
    // Single neutral tone-calibration pair on brand-new casual turns
    if (luxEn()) {
      messages.push(
        { role: "user", content: "hey what's up" },
        { role: "assistant", content: "Hey! All good here — keeping the fans cool and the vibes warm 😄 How about you?" }
      );
    } else {
      messages.push(
        { role: "user", content: "selam naber" },
        { role: "assistant", content: "Selam! Buralardayım, işlemciler serin keyifler yerinde 😄 Sende durumlar nasıl?" }
      );
    }
  }
  const historyLimit = isLocalCpu ? -4 : -12;
  const rollup = window.LuxContextRollup?.withRollupContext
    ? window.LuxContextRollup.withRollupContext(prompt, history, { keepRecent: isLocalCpu ? 4 : 12 })
    : { prompt, kept: history.slice(historyLimit) };
  const effectivePrompt = rollup.prompt;
  rollup.kept.forEach((m) => {
    if (m.content) {
      const raw = String(m.content);
      const clippedLabel = luxEn() ? "[truncated]" : "[kısaltıldı]";
      const clipped = isLocalCpu && raw.length > 650 ? raw.slice(0, 650) + `\n...${clippedLabel}` : raw;
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: clipped
      });
    }
  });
  messages.push({ role: "user", content: effectivePrompt });

  const MAX_TOOL_STEPS = 12;
  const isCodeOrDesignBuild =
    /(?:tasarla|kod|html|css|js|script|sayfa|web\s*site|açılış\s*sayfası|kur|oluştur|code|html|css|page|website|landing|app|build|create|design)/i.test(
      userQuestionOnly
    );
  const isCreativeText =
    !isCodeOrDesignBuild && /(?:ninni|metin|makale|hikaye|şiir|lullaby|text|article|essay|story|poem|song)/i.test(userQuestionOnly);
  const streamOpts = { onToken: assistantMsg?.__onStreamToken };

  const runLoop = async (activeModelId) => {
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
      assistantMsg?.__streamReset?.();

      const payload = {
        model: activeModelId,
        messages: messages,
        temperature: useNativeTools || isGroundedTurn || skipCalibration ? 0.25 : isLocalCpu ? 0.38 : 0.68
      };
      if (isLocalCpu) {
        payload.max_tokens = isCodeOrDesignBuild ? 1600 : isCreativeText ? 700 : isGroundedTurn || useNativeTools ? 600 : 450;
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
        assistantMsg.modelName = `OpenRouter · ${String(data.model).split("/").pop()}`;
      }

      const choiceMsg = data?.choices?.[0]?.message || {};
      const nativeToolCalls = Array.isArray(choiceMsg.tool_calls) ? choiceMsg.tool_calls : [];

      if (nativeToolCalls.length > 0 && hasToolsBridge) {
        messages.push({
          role: "assistant",
          content: choiceMsg.content || null,
          tool_calls: nativeToolCalls
        });

        const batchResults = await executeToolCallsBatch(nativeToolCalls, assistantMsg, (tc) => ({
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
        const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, (tc) => ({ name: tc.name, args: tc.args }));
        const summaries = batchResults.map(
          (r) => `${luxEn() ? "Tool" : "Araç"} (${r.name}) ${luxEn() ? "result" : "sonucu"}:\n${r.execRes.resultText}`
        );
        messages.push({
          role: "user",
          content: luxEn()
            ? `${summaries.join("\n\n")}\n\nBased on the real tool outputs above, give the user a warm, natural, clear answer in English.`
            : `${summaries.join("\n\n")}\n\nYukarıdaki gerçek araç çıktılarına dayanarak kullanıcıya samimi, doğal ve net bir Türkçe yanıt ver.`
        });
        continue;
      }

      const cleaned = cleanAssistantFinalText(rawText);
      if (cleaned) return cleaned;
      if (Array.isArray(assistantMsg?.toolSteps) && assistantMsg.toolSteps.length > 0) {
        return assistantMsg.toolSteps.map((s) => `- **${s.name}**: ${s.summary}`).join("\n");
      }
      if (isOpenRouter && activeModelId !== "openrouter/free") {
        const emptyErr = new Error(luxEn() ? "OpenRouter upstream returned an empty response" : "OpenRouter upstream boş yanıt döndürdü");
        emptyErr.status = 502;
        throw emptyErr;
      }
      return luxEn() ? "Done." : "İşlemi tamamladım.";
    }

    // Final synthesis after max tool steps
    if (isTurnCanceled(assistantMsg)) throw new DOMException("İptal edildi", "AbortError");
    assistantMsg?.__streamReset?.();
    const finalPayload = { model: activeModelId, messages, temperature: 0.65 };
    if (isLocalCpu) finalPayload.max_tokens = 2048;
    const finalData = await fetchOpenAIChatCompletion(endpoint, headers, finalPayload, requestTimeoutMs, streamOpts);
    const finalText = finalData?.choices?.[0]?.message?.content || "";
    return cleanAssistantFinalText(finalText) || (luxEn() ? "Done — all steps completed." : "İşlemleri tamamladım.");
  };

  // Skip already rate-limited OpenRouter :free model during 60s cooldown window
  const cooldownMap = window.__openrouterCooldownUntil;
  const autoHealEnabled = window.appStore?.state?.general?.autoHeal !== false;
  if (isOpenRouter && targetModelId !== "openrouter/free" && autoHealEnabled && cooldownMap?.has(targetModelId)) {
    if (Date.now() < cooldownMap.get(targetModelId)) {
      console.info(`⚡ OpenRouter cooldown active for ${targetModelId}, routing via openrouter/free`);
      const orCoolReply = await runLoop("openrouter/free");
      if (assistantMsg) {
        assistantMsg.stepLabel = luxEn()
          ? `⚡ ${targetModelId} is temporarily rate-limited — Auto-Free was used.`
          : `⚡ ${targetModelId} geçici limitli olduğu için Auto-Free kullanıldı.`;
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
          return luxEn()
            ? `${fbText}\n\n> 💡 **9Router Auto-Recovery:** The selected model (\`${targetModelId}\`) did not respond on the server side (\`${err.message}\`), so your query was automatically routed to the stable **\`oc/flint-40b-free\`** model.`
            : `${fbText}\n\n> 💡 **9Router Otomatik Kurtarma:** Seçili model (\`${targetModelId}\`) sunucu tarafında yanıt vermediği (\`${err.message}\`) için sorgunuz otomatik olarak kararlı çalışan **\`oc/flint-40b-free\`** modeline yönlendirildi.`;
        }
      } catch (fbErr) {
        if (!window.isGenerating || fbErr?.name === "AbortError") throw fbErr;
        console.error("Fallback da başarısız oldu:", fbErr);
      }
    }

    // OpenRouter upstream-only failover (skip if account daily quota / credits exhausted)
    const isDailyAccountQuota = /free-models-per-day|daily\s*limit|credits|insufficient/i.test(err?.message || "");
    const isUpstreamModelLimit =
      err?.status === 429 ||
      err?.status === 404 ||
      err?.status === 502 ||
      err?.status === 503 ||
      /rate.?limit|upstream|temporarily|overload|no endpoints/i.test(err?.message || "");
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
          assistantMsg.stepLabel = luxEn()
            ? `⚡ ${targetModelId} is busy — answered via OpenRouter Auto-Free.`
            : `⚡ ${targetModelId} yoğun olduğu için OpenRouter Auto-Free üzerinden yanıtlandı.`;
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
      const text = data.content?.[0]?.text || (luxEn() ? "Empty response received." : "Boş yanıt alındı.");
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

    return fullText || (luxEn() ? "Empty response received." : "Boş yanıt alındı.");
  } catch (err) {
    if (req.didTimeout()) throw new Error(luxEn() ? "Anthropic request timed out" : "Anthropic isteği zaman aşımına uğradı");
    throw err;
  } finally {
    req.cleanup();
  }
}

async function callAnthropicWithAgentLoop(model, prompt, history, assistantMsg) {
  const sysParts = buildAgentSystemParts(prompt, history, { includeXmlInstruction: true });
  const isVoiceTurn = Boolean(assistantMsg?.isVoiceTurn || window.voiceSessionActive);
  const timeoutMs = isVoiceTurn ? 18000 : 45000;
  const rollup = window.LuxContextRollup?.withRollupContext
    ? window.LuxContextRollup.withRollupContext(prompt, history, { keepRecent: 12 })
    : { prompt, kept: history.slice(-12) };
  const effectivePrompt = rollup.prompt;
  const messages = [];
  rollup.kept.forEach((m) => {
    if (m.content) {
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      });
    }
  });
  messages.push({ role: "user", content: effectivePrompt });

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
    const batchResults = await executeToolCallsBatch(xmlCalls, assistantMsg, (tc) => ({ name: tc.name, args: tc.args }));
    const toolResults = batchResults.map(
      (r) => `${luxEn() ? "Tool" : "Araç"} (${r.name}) ${luxEn() ? "result" : "sonucu"}:\n${r.execRes.resultText}`
    );
    messages.push({
      role: "user",
      content: luxEn()
        ? `${toolResults.join("\n\n")}\n\nBased on this result, give the user a warm, natural, clear answer in English.`
        : `${toolResults.join("\n\n")}\n\nBu sonuca dayanarak kullanıcıya samimi, doğal ve net Türkçe yanıt ver.`
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
  const cleanPrompt = String(prompt || "")
    .split(/\n---\n\[/)[0]
    .trim();
  const p = cleanPrompt.toLowerCase();

  if (luxEn()) {
    if (/^(hi|hello|hey|yo|hiya|howdy)(\s|$|!|,)/.test(p) || p === "hi" || p === "hey" || p === "hello") {
      return "Hey! Coffee in hand, ready to roll 😄 What are we tinkering with today?";
    }
    if (/good\s*(morning|afternoon|evening|night)/.test(p)) {
      return "Good day to you too! Where do we pick things up — code or conversation?";
    }
    if (/(how are you|what'?s up|how'?s it going|how you doing)/.test(p)) {
      return "Running smooth — even the fans are humming along happily! How about you, what's on your mind today?";
    }
    if (/(formal|formality|honorifics|respectful tone)/.test(p) && /(don'?t use|avoid|skip|stop|no)/.test(p)) {
      return "Deal — formality is off the table. We're fully casual from here on out.";
    }
    if (p.includes("test") || p.includes("1 2 3 4") || p.includes("sound test")) {
      return "Sound test passed — coming through crystal clear on my end. Keep going!";
    }
    if (/(can you hear me|do you hear me|am i coming through|is my voice coming)/.test(p)) {
      return "Crystal clear! It's like you're sitting right across from me — go ahead.";
    }
    return `You said "${cleanPrompt}", but the selected model is unreachable right now. Check your model connection in Settings or the model picker at the bottom-left, and we'll pick right back up!`;
  }

  if (
    p === "selam" ||
    p === "merhaba" ||
    p === "slm" ||
    p === "hey" ||
    p === "selamlar" ||
    p.startsWith("selam ") ||
    p.startsWith("merhaba ")
  ) {
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
