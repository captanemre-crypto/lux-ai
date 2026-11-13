// LUX AI — Statik ses efektleri için AudioBuffer önbelleği
//
// Önceki davranış: her playLuxSound()/ninni notası için `new Audio()` oluşturuluyor;
// Chromium aynı mp3'ü her seferinde diskten okuyup yeniden decode ediyordu
// (124 adet ses dosyası, lullaby her 15,8 sn'de bir 26 nota çalıyor).
//
// Bu modül fetch(src) -> decodeAudioData tek kez yapar, sonucu Map'te tutar ve
// sonraki çalmalar sıfır decode ile başlar. Sadece statik asset yolları önbelleğe
// alınır (base64/data: TTS çıktıları her biri benzersizdir — önbellek israfı olur).
(function () {
  const cache = new Map(); // src -> Promise<AudioBuffer>
  let ctx = null;

  function ensureContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  }

  function shouldCache(src) {
    if (typeof src !== "string" || src.startsWith("data:") || src.startsWith("blob:")) return false;
    return true;
  }

  function loadBuffer(src) {
    if (cache.has(src)) return cache.get(src);
    const promise = (async () => {
      const context = ensureContext();
      const res = await fetch(src);
      if (!res.ok) throw new Error("Ses yüklenemedi (" + res.status + "): " + src);
      const raw = await res.arrayBuffer();
      return await context.decodeAudioData(raw);
    })();
    cache.set(src, promise);
    // Decode hatası olursa önbellekten düşür ki bir sonraki deneme yeniden fetch etsin.
    promise.catch(() => cache.delete(src));
    return promise;
  }

  /**
   * Sesi çal. Dönen handle: { stop(), onended } — lullaby gibi durdurulabilir
   * bağlamlar için. Fire-and-forget kullanımda sonucu yok sayın.
   */
  async function play(src, options = {}) {
    const volume = Math.max(0, Math.min(1, Number(options.volume ?? 1)));
    const context = ensureContext();
    if (!context) return null;
    try {
      if (context.state === "suspended") await context.resume();
      const buffer = await loadBuffer(shouldCache(src) ? src : src);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
      const handle = {
        source,
        gain,
        onended: null,
        stop() {
          try {
            source.stop();
          } catch (e) {
            window.luxDebug?.("audio_cache.js:66", e);
          }
        }
      };
      source.onended = () => {
        if (typeof handle.onended === "function") handle.onended();
      };
      return handle;
    } catch (_) {
      return null;
    }
  }

  window.luxAudioCache = {
    play,
    load: loadBuffer,
    preload(srcs) {
      for (const s of srcs || []) loadBuffer(s).catch(() => {});
    },
    size() {
      return cache.size;
    },
    clear() {
      cache.clear();
    }
  };
})();
