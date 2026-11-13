// LUX AI — Renderer tarafı sessiz hata günlüğü
//
// Neden var: Renderer kodunda bilinçli olarak yutulan catch bloklarını
// sessiz bırakmak yerine LUX_DEBUG=1 (veya localStorage "lux-debug" = "1") ile
// açılabilen tek bir kapıdan geçir. Üretimde (varsayılan) hiçbir çıktı üretmez;
// kapalıyken maliyeti yalnızca bir boolean kontrolüdür.
//
// Kullanım: catch bloklarında `window.luxDebug?.("kapsam", err)` çağrılır.
// Kapsam olarak dosya:satır etiketi kullanılır (örn. "voice.js:253").
(function () {
  function isDebugEnabled() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("lux-debug") === "1" || localStorage.getItem("LUX_DEBUG") === "1") {
          return true;
        }
      }
    } catch (_) {
      // localStorage erişilemezse (ör. worklet-benzeri bağlam) sessiz geç
    }
    try {
      if (typeof process !== "undefined" && process?.env?.LUX_DEBUG === "1") return true;
    } catch (_) {
      /* process yok */
    }
    return false;
  }

  window.luxDebug = function luxDebug(scope, err) {
    if (!isDebugEnabled()) return;
    const label = scope ? `[lux:${scope}]` : "[lux]";
    if (err === undefined) {
      console.debug(label);
      return;
    }
    console.debug(label, err);
  };
})();
