// LUX AI — Model istemcisi (model_client.js) yalıtılmış birim testleri
//
// global.fetch'i stub'layıp Gemini SSE akış ayrıştırma, Gemini JSON yolu,
// HTTP 429 hata sınıflandırma, anahtarsız açılış + yerel modele otomatik
// geçiş (fallback) ve ses turunda fallback kapalı davranışını doğrular.
// Gerçek ağ isteği YAPILMAZ; model_client.js vm sandbox'ında çalıştırılır.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT_DIR, 'src/js/model_client.js'), 'utf8');

const results = { total: 0, passed: 0, failed: 0 };
async function test(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.failed++;
    console.error(`[FAIL] ${name}: ${err && err.stack ? err.stack.split('\n')[0] : err}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function makeSseReader(raw) {
  const bytes = new TextEncoder().encode(raw);
  const cut = Math.max(1, Math.floor(bytes.length / 2));
  const chunks = [bytes.subarray(0, cut), bytes.subarray(cut)];
  let i = 0;
  return {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { value: undefined, done: true };
          return { value: chunks[i++], done: false };
        }
      };
    }
  };
}
const sseBody = (raw) => makeSseReader(raw);
const sseHeaders = {
  get: (n) => (String(n).toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : '')
};
const jsonHeaders = { get: (n) => (String(n).toLowerCase() === 'content-type' ? 'application/json' : '') };
const okSseRes = (raw) => ({
  ok: true,
  status: 200,
  headers: sseHeaders,
  body: sseBody(raw),
  json: async () => {
    throw new Error('json beklenmiyordu');
  }
});
const okJsonRes = (obj) => ({ ok: true, status: 200, headers: jsonHeaders, body: null, json: async () => obj });
const errJsonRes = (status, obj) => ({ ok: false, status, headers: jsonHeaders, body: null, json: async () => obj });

function makeSandbox(fetchMock, windowOverrides = {}) {
  const windowObj = {
    appStore: {
      getModels: () => [],
      state: { selectedModel: '', general: {} },
      getPermissions: () => ({}),
      resolveModelApiKey: async () => '',
      resolveOpenRouterApiKey: async () => ''
    },
    luxAPI: undefined,
    isGenerating: true,
    ...windowOverrides
  };
  const sandbox = {
    window: windowObj,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    AbortSignal,
    DOMException,
    TextDecoder,
    TextEncoder,
    fetch: fetchMock,
    // chat.js çalışma zamanı global'leri (mock)
    buildAgentSystemPrompt: () => 'SYS',
    shouldAttachToolsForPrompt: () => false,
    selectToolsForPrompt: () => [],
    isTurnCanceled: () => false,
    parseXmlToolCalls: () => [],
    cleanAssistantFinalText: (s) => String(s || '').trim(),
    executeToolCallsBatch: async () => [],
    renderChat: () => {}
  };
  sandbox.self = windowObj;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'model_client.js' });
  return { sandbox, window: windowObj };
}

function makeFetchMock(handler) {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  fetchMock.calls = calls;
  return fetchMock;
}

(async () => {
  console.log('========================================================');
  console.log('   LUX AI MODEL CLIENT — MOCK-FETCH BİRİM TESTLERİ      ');
  console.log('========================================================\n');

  await test('M1. Gemini SSE akışı ayrıştırılır, düşünce (thought) parçaları atlanır', async () => {
    const raw =
      'data: {"candidates":[{"content":{"parts":[{"text":"Mer"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"haba"},{"text":"GİZLİ","thought":true}]}}]}\n\n' +
      'data: [DONE]\n\n';
    const fetchMock = makeFetchMock(() => okSseRes(raw));
    const { sandbox } = makeSandbox(fetchMock);
    const tokens = [];
    const out = await sandbox.callGeminiAPIOnce(
      { apiKey: 'test-key', modelId: 'gemini-2.5-flash' },
      [{ role: 'user', parts: [{ text: 'selam' }] }],
      'SYS',
      { timeoutMs: 5000, onToken: (delta, full) => tokens.push([delta, full]) }
    );
    assert(out === 'Merhaba', `beklenen "Merhaba", dönen "${out}"`);
    assert(tokens.map((t) => t[0]).join('') === 'Merhaba', 'onToken deltaları birleşmeli');
    assert(!/GİZLİ/.test(tokens.map((t) => t[0]).join('')), 'thought parçası akmamalı');
    assert(fetchMock.calls.length === 1, 'tek istek atılmalı');
    assert(/streamGenerateContent/.test(fetchMock.calls[0].url), 'SSE ucu çağrılmalı');
  });

  await test('M2. Gemini JSON (SSE olmayan) yanıt yolu + thought filtresi', async () => {
    const fetchMock = makeFetchMock(() =>
      okJsonRes({
        candidates: [{ content: { parts: [{ text: 'Düz yanıt' }, { text: 'atlan', thought: true }] } }]
      })
    );
    const { sandbox } = makeSandbox(fetchMock);
    const out = await sandbox.callGeminiAPIOnce(
      { apiKey: 'test-key', modelId: 'gemini-2.5-flash' },
      [{ role: 'user', parts: [{ text: 'selam' }] }],
      'SYS',
      { timeoutMs: 5000 }
    );
    assert(out === 'Düz yanıt', `beklenen "Düz yanıt", dönen "${out}"`);
  });

  await test('M3. HTTP 429 → hata sınıfı rate-limit; fallback atlanır; __apiError set edilir', async () => {
    const fetchMock = makeFetchMock(() =>
      errJsonRes(429, { error: { message: 'Quota exceeded: free-models-per-day' } })
    );
    const geminiModel = {
      id: 'p1',
      name: 'Gemini',
      provider: 'Google Gemini',
      modelId: 'gemini-2.5-flash',
      apiKey: 'k',
      isDefault: true
    };
    const localModel = {
      id: 'l1',
      name: 'Local LM',
      provider: 'Local',
      endpoint: 'http://127.0.0.1:1234/v1',
      modelId: 'local-model',
      status: 'success'
    };
    const { sandbox, window } = makeSandbox(fetchMock, {});
    window.appStore.getModels = () => [geminiModel, localModel];
    window.appStore.state = { selectedModel: 'Gemini', general: {} };
    window.appStore.resolveModelApiKey = async () => 'gemini-key';
    const assistantMsg = { toolSteps: [], __streamReset: () => {} };
    const reply = await sandbox.callModelWithFallback(geminiModel, 'merhaba', [], assistantMsg);
    assert(assistantMsg.__apiError && assistantMsg.__apiError.status === 429, '__apiError.status 429 olmalı');
    assert(fetchMock.calls.length === 1, `denemeler: yalnız 1 (fallback yok), gelen: ${fetchMock.calls.length}`);
    assert(typeof reply === 'string' && reply.length > 20, 'dürüst hata mesajı dönmeli');
  });

  await test('M4. Anahtarsız Gemini → yerel LM Studio modeline otomatik geçiş', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Yedek yanıt"}}]}\n\ndata: [DONE]\n\n';
    const fetchMock = makeFetchMock((url) => {
      if (/127\.0\.0\.1:1234/.test(url)) return okSseRes(sse);
      throw new Error('beklenmeyen URL: ' + url);
    });
    const brokenGemini = {
      id: 'p1',
      name: 'Gemini',
      provider: 'Google Gemini',
      modelId: 'gemini-2.5-flash',
      apiKey: '',
      isDefault: true
    };
    const localModel = {
      id: 'l1',
      name: 'Local LM',
      provider: 'Local',
      endpoint: 'http://127.0.0.1:1234/v1',
      modelId: 'local-model',
      status: 'success'
    };
    const { sandbox, window } = makeSandbox(fetchMock, {});
    window.appStore.getModels = () => [brokenGemini, localModel];
    window.appStore.state = { selectedModel: 'Gemini', general: {} };
    window.appStore.resolveModelApiKey = async () => '';
    const tokenLog = [];
    const assistantMsg = { toolSteps: [], __streamReset: () => {}, __onStreamToken: (d, f) => tokenLog.push([d, f]) };
    const reply = await sandbox.callModelWithFallback(brokenGemini, 'merhaba', [], assistantMsg);
    assert(reply === 'Yedek yanıt', `beklenen "Yedek yanıt", dönen "${reply}"`);
    assert(assistantMsg.modelName === 'Local LM (Otomatik Yedek)', 'modelName yedek model olmalı');
    assert(
      fetchMock.calls.length === 1 && /1234\/v1\/chat\/completions/.test(fetchMock.calls[0].url),
      'yerel uç çağrılmalı'
    );
    assert(tokenLog.length >= 1, 'akış tokenleri __onStreamToken üzerinden iletilmeli');
  });

  await test('M5. Ses turunda (isVoiceTurn) yedek model devreye girmez', async () => {
    const fetchMock = makeFetchMock(() => {
      throw new Error('fetch hiç çağrılmamalı');
    });
    const brokenGemini = {
      id: 'p1',
      name: 'Gemini',
      provider: 'Google Gemini',
      modelId: 'gemini-2.5-flash',
      apiKey: '',
      isDefault: true
    };
    const localModel = {
      id: 'l1',
      name: 'Local LM',
      provider: 'Local',
      endpoint: 'http://127.0.0.1:1234/v1',
      modelId: 'local-model',
      status: 'success'
    };
    const { sandbox, window } = makeSandbox(fetchMock, {});
    window.appStore.getModels = () => [brokenGemini, localModel];
    window.appStore.state = { selectedModel: 'Gemini', general: {} };
    window.appStore.resolveModelApiKey = async () => '';
    window.voiceSessionActive = true;
    const assistantMsg = { toolSteps: [], isVoiceTurn: true, __streamReset: () => {} };
    const reply = await sandbox.callModelWithFallback(brokenGemini, 'merhaba', [], assistantMsg);
    assert(fetchMock.calls.length === 0, 'ses turunda fetch çağrılmamalı');
    assert(assistantMsg.__apiError, '__apiError doldurulmalı');
    assert(typeof reply === 'string' && reply.length > 10, 'dürüst hata mesajı dönmeli');
  });

  await test('M6. Yardımcılar: hata sınıfı, model kodu çözümü, yerel uç tespiti', async () => {
    const { sandbox } = makeSandbox(
      makeFetchMock(() => {
        throw new Error('çağrılmamalı');
      })
    );
    const c = sandbox.classifyModelApiError(Object.assign(new Error('HTTP 429 çok fazla istek'), {}), {
      provider: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1'
    });
    assert(c.status === 429 && c.isRateLimit && c.isOpenRouter, '429/OpenRouter sınıflanmalı');
    const quota = sandbox.classifyModelApiError(new Error('free-models-per-day aşıldı'), null);
    assert(quota.isDailyOrCreditQuota === true, 'günlük kota mesajı sınıflanmalı');
    const missing = sandbox.classifyModelApiError(new Error('Yapılandırılmış gerçek API anahtarı yok'), null);
    assert(missing.isMissingKey === true, 'eksik anahtar sınıflanmalı');
    assert(
      sandbox.resolveGeminiModelCode('gemini-1.5-flash') === 'gemini-3.5-flash-lite',
      'eski model kodu yükseltilmeli'
    );
    assert(sandbox.resolveGeminiModelCode('gemini-2.5-pro') === 'gemini-2.5-pro', 'güncel kod korunmalı');
    assert(sandbox.isLocalModelEndpoint({ endpoint: 'http://127.0.0.1:11434' }) === true, '127.0.0.1 yerel sayılmalı');
    assert(sandbox.isLocalModelEndpoint({ provider: 'Ollama / Yerel' }) === true, 'Ollama sağlayıcısı yerel sayılmalı');
    assert(
      sandbox.isLocalModelEndpoint({ endpoint: 'https://api.openai.com/v1' }) === false,
      'uzak uç yerel sayılmamalı'
    );
  });

  await test('M7. Canlı model keşfi (Google Gemini ve OpenAI uyumlu)', async () => {
    let capturedUrl = '';
    const { sandbox } = makeSandbox(async (url) => {
      capturedUrl = String(url);
      if (capturedUrl.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] }
            ]
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'custom-model-1', name: 'Custom 1' },
            { id: 'custom-model-2', name: 'Custom 2' }
          ]
        })
      };
    });

    const geminiModels = await sandbox.fetchLiveModelsForProvider('Google Gemini', 'test-gemini-key');
    assert(capturedUrl.includes('key=test-gemini-key'), 'Gemini API anahtarı sorgu parametresinde gitmeli');
    assert(geminiModels.length === 2, 'generateContent desteklemeyen modeller elenmeli (2 kalmalı)');
    assert(geminiModels[0].id === 'gemini-2.0-flash', 'Gemini model ID models/ ön eki olmadan çözülmeli');
    assert(geminiModels[1].id === 'gemini-1.5-pro', 'İkinci Gemini modeli doğru gelmeli');

    const openaiModels = await sandbox.fetchLiveModelsForProvider('Özel / OpenAI Uyumlu', 'test-key', 'https://my-api.com/v1');
    assert(openaiModels.length === 2, 'OpenAI modelleri listelenmeli');
    assert(openaiModels[0].id === 'custom-model-1', 'OpenAI model id çözülmeli');
  });

  console.log('\n========================================================');
  console.log(`MODEL CLIENT TESTS FINISHED: ${results.passed}/${results.total} PASSED (${results.failed} FAILED)`);
  console.log('========================================================');
  if (results.failed > 0) process.exitCode = 1;
})().catch((err) => {
  console.error('Model client test paketi çöktü:', err);
  process.exitCode = 1;
});
