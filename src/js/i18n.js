// LUX AI — i18n iskeleti (varsayılan: Türkçe, English hazır)
//
// Neden gömülü katalog: uygulama file:// origin'den paketli çalışır; dış JSON
// fetch'i bu bağlamda güvenilir değildir. Katalog büyüdüğünde build adımıyla
// src/locales/*.json'a taşınabilir. Anahtar biçimi: "alan.alt_alan".
// Yer tutucular: "{name}" biçiminde; LuxI18n.t('key', { name: '...' }) ile doldurulur.
// Kullanıcı dili localStorage "lux-locale" üzerinden kalıcıdır (setLocale ile).
(function () {
  const LOCALES = Object.freeze({
    tr: {
      "app.name": "Lux AI",
      "common.save": "Kaydet",
      "common.cancel": "Vazgeç",
      "common.close": "Kapat",
      "common.delete": "Sil",
      "common.settings": "Ayarlar",
      "common.approve": "Onayla",
      "common.deny": "Reddet",
      "approval.title": "Yüksek Riskli İşlem Onayı",
      "approval.subtitle": "Lux şu işlemi çalıştırmak istiyor: {label}",
      "approval.run": "Çalıştır",
      "approval.deny": "Reddet",
      "approval.remember": "Bir daha sorma — Otomatik Komut Onayı'nı aç (Ayarlar > İzinler)",
      "approval.emptyDetail": "(ayrıntı yok)",
      "vault.title": "Anahtar Kasası (Şifreli)",
      "vault.subtitle":
        "Gemini / OpenRouter / OpenAI / Anthropic API anahtarları yalnızca bu cihazda şifreli saklanır; arayüze asla düz metin dönülmez.",
      "vault.rotate": "Kasayı Yeniden Şifrele",
      "vault.rotating": "Yeniden şifreleniyor…",
      "vault.loading": "Kasa durumu yükleniyor…",
      "vault.rotateDone": "Kasa yeniden şifrelendi ({count} anahtar).",
      "vault.schemeSafeStorage": "İşletim sistemi anahtar zinciri (safeStorage)",
      "vault.schemeAesGcm": "AES-256-GCM (dosya tabanlı, makineye özgü)",
      "voice.consentTitle": "Ses tanıma modeli ilk kullanımda indirilecek.",
      "voice.consentBody": "faster-whisper (small, int8) bir kez iner (~244 MB), sonra tamamen çevrimdışı çalışır.",
      "voice.consentNo": "Şimdi Değil",
      "voice.consentYes": "İndir ve Hazırla"
    },
    en: {
      "app.name": "Lux AI",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.close": "Close",
      "common.delete": "Delete",
      "common.settings": "Settings",
      "common.approve": "Approve",
      "common.deny": "Deny",
      "approval.title": "High-Risk Action Approval",
      "approval.subtitle": "Lux wants to run the following: {label}",
      "approval.run": "Run",
      "approval.deny": "Deny",
      "approval.remember": "Do not ask again — enable Auto-Approve (Settings > Permissions)",
      "approval.emptyDetail": "(no details)",
      "vault.title": "Key Vault (Encrypted)",
      "vault.subtitle":
        "Gemini / OpenRouter / OpenAI / Anthropic API keys are stored encrypted on this device only; they are never returned in plaintext.",
      "vault.rotate": "Re-encrypt Vault",
      "vault.rotating": "Re-encrypting…",
      "vault.loading": "Loading vault status…",
      "vault.rotateDone": "Vault re-encrypted ({count} keys).",
      "vault.schemeSafeStorage": "OS key chain (safeStorage)",
      "vault.schemeAesGcm": "AES-256-GCM (file-based, machine-bound)",
      "voice.consentTitle": "The speech model will be downloaded on first use.",
      "voice.consentBody": "faster-whisper (small, int8) downloads once (~244 MB), then runs fully offline.",
      "voice.consentNo": "Not Now",
      "voice.consentYes": "Download & Prepare"
    }
  });

  const DEFAULT_LOCALE = "tr";
  let current = DEFAULT_LOCALE;
  try {
    const saved = window.localStorage ? window.localStorage.getItem("lux-locale") : null;
    if (saved && Object.prototype.hasOwnProperty.call(LOCALES, saved)) current = saved;
  } catch (_) {
    /* private mode vb. — varsayılanla devam */
  }

  function t(key, params) {
    const dict = LOCALES[current] || LOCALES[DEFAULT_LOCALE];
    let str = (dict && dict[key]) || LOCALES[DEFAULT_LOCALE][key] || LOCALES.en[key] || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        str = String(str).split(`{${k}}`).join(String(v));
      }
    }
    return str;
  }

  function setLocale(next) {
    if (!Object.prototype.hasOwnProperty.call(LOCALES, next)) return false;
    current = next;
    try {
      window.localStorage?.setItem("lux-locale", next);
    } catch (_) {}
    try {
      document.documentElement.lang = next;
    } catch (_) {}
    return true;
  }

  window.LuxI18n = {
    t,
    setLocale,
    availableLocales: Object.keys(LOCALES),
    get locale() {
      return current;
    }
  };
})();
