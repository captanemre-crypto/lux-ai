// LUX AI — Ortak sohbet durumu (klasik script global lexical ortamı)
//
// chat.js modülerleşmesi: tüm chat modüllerinin gördüğü durum ve iptal
// yardımcıları burada tanımlanır. Klasik script'lerde top-level `let`,
// global lexical ortamda yaşar; sonraki dosyalar aynı isimlere bağlanır
// (model_client.js de currentAbortController'ı paylaşır).

// Chat Area & Floating Composer with Real AI Engine & Agentic Tool Loop (Exact Lux Replica)

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

window.stopAllAssistantOutput = function (interrupted = false) {
  try {
    window.stopSpeaking?.();
  } catch (e) {
    window.luxDebug?.("chat_shared.js:26", e);
  }
  try {
    window.stopLullabyAudio?.();
  } catch (e) {
    window.luxDebug?.("chat_shared.js:29", e);
  }
  try {
    window.abortGeneration?.(Boolean(interrupted));
  } catch (e) {
    window.luxDebug?.("chat_shared.js:32", e);
  }
};

// djb2 tabanlı, hızlı ve çakışması ihmal edilebilir satır imzası
