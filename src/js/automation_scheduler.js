// LUX AI — Otomasyon zamanlayıcısı
//
// Neden var: Ayarlar → Otomasyonlar'da kaydedilen görevler v1.6.0'a kadar yalnızca
// state'te saklanıyordu; hiçbir zaman tetiklenmiyorlardı. Bu modül 30 saniyede bir
// kontrol eder ve zamanı gelen, etkin (enabled) otomasyonları çalıştırır.
//
// Tetikleme: Otomasyonun `desc` alanı (kısa açıklama veya görev komutu) sohbete
// kullanıcı mesajı olarak gönderilir (window.quickPrompt). Böylece tüm ajan
// hattı — model, araçlar, izin/onay akışı — aynen korunur; otomasyonlar asla
// sessizce yetki yükseltmez.
//
// Zamanlama kalıpları (büyük/küçük harf duyarsız, TR/EN):
//   "Her Saat"                 → saatlik
//   "Her 30 dakika" / "Her 2 saat" / "Her 3 gün"  → aralıklı
//   "Her Gün 09:00" / "günlük 09:00" / "daily 09:00" / "09:00"  → her gün o saatte
//   "Manuel" (veya anlaşılmayan metin) → asla kendiliğinden çalışmaz; yalnız "Şimdi çalıştır"
//
// Güvenlik/uyku notları:
//   - Yeni oluşturulan otomasyonlar `createdAt` ile damgalanır; geçmişe dönük
//     "kaçırılmış" tetikleme yapmazlar. Uygulama kapalıyken kaçırılan tetiklemeler
//     bir sonraki açılışta (overdue) bir kez çalışır.
//   - Manuel çalıştırma (runNow) `lastRun`'a dokunmaz; dolayısıyla günlük bir
//     otomasyonun zamanlanmış tetiklemesini bastırmaz.

(function initAutomationScheduler() {
  const TICK_MS = 30_000;
  const FIRST_TICK_DELAY_MS = 8_000;

  function normalizeScheduleText(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/İ/g, "i")
      .replace(/ı/g, "i")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c")
      .replace(/\s+/g, " ");
  }

  /** @returns {{kind:'manual'|'unparsed'|'interval'|'daily', ms?:number, hour?:number, minute?:number}} */
  function parseSchedule(text) {
    const t = normalizeScheduleText(text);
    let m;
    if (/^(manuel|manual|elle)\b/.test(t)) return { kind: "manual" };
    if (/^(her\s*saat|saatlik|hourly)$/.test(t)) return { kind: "interval", ms: 3600e3 };
    m = t.match(/^her\s*(\d{1,4})\s*(dakika|dk|min|minute|minutes|m)$/);
    if (m) return { kind: "interval", ms: Math.max(1, +m[1]) * 60e3 };
    m = t.match(/^her\s*(\d{1,4})\s*(saat|hour|hours|h)$/);
    if (m) return { kind: "interval", ms: Math.max(1, +m[1]) * 3600e3 };
    m = t.match(/^her\s*(\d{1,4})\s*(gun|day|days|d)$/);
    if (m) return { kind: "interval", ms: Math.max(1, +m[1]) * 86400e3 };
    m = t.match(/^(?:her\s*(?:gun)?|gunluk|daily|every\s*day)\s*(?:saat\s*)?(\d{1,2})[:.](\d{2})$/);
    if (m) {
      const hour = +m[1];
      const minute = +m[2];
      if (hour < 24 && minute < 60) return { kind: "daily", hour, minute };
      return { kind: "unparsed" };
    }
    m = t.match(/^(\d{1,2})[:.](\d{2})$/);
    if (m) {
      const hour = +m[1];
      const minute = +m[2];
      if (hour < 24 && minute < 60) return { kind: "daily", hour, minute };
    }
    return { kind: "unparsed" };
  }

  /**
   * Sıradaki tetikleme zaman damgası (ms). Manuel/anlaşılmayan için null.
   * `anchor = lastRun ?? createdAt ?? now` — oluşturulma anından öncesi asla ateşlenmez.
   */
  function nextRunAt(auto, now = Date.now()) {
    const parsed = parseSchedule(auto?.schedule);
    if (parsed.kind === "manual" || parsed.kind === "unparsed") return null;
    const anchor = auto.lastRun || auto.createdAt || now;
    if (parsed.kind === "interval") {
      return anchor + parsed.ms;
    }
    // daily
    const candidate = new Date(now);
    candidate.setHours(parsed.hour, parsed.minute, 0, 0);
    let due = candidate.getTime();
    while (due <= anchor) {
      due += 86400e3;
    }
    return due;
  }

  function formatStamp(ts) {
    try {
      return new Date(ts).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return new Date(ts).toISOString();
    }
  }

  function metaLine(auto, now = Date.now()) {
    const parsed = parseSchedule(auto?.schedule);
    if (parsed.kind === "manual") return "Manuel — yalnız “Şimdi çalıştır” ile çalışır";
    if (parsed.kind === "unparsed") return "⚠ Zamanlama anlaşılamadı — manuel çalışır";
    const next = nextRunAt(auto, now);
    const last = auto?.lastRun ? formatStamp(auto.lastRun) : "—";
    return `Son: ${last} · Sonraki: ${next ? formatStamp(next) : "—"}`;
  }

  function fire(auto, { manual = false } = {}) {
    const task = String((auto && auto.desc && auto.desc.trim()) || (auto && auto.title) || "").trim();
    if (!task) {
      console.warn("[automations] boş görev komutu — atlandı", auto?.id);
      return;
    }
    try {
      if (typeof window.quickPrompt === "function") {
        window.quickPrompt(task);
      } else {
        console.warn("[automations] quickPrompt hazır değil — atlandı", auto?.id);
        return;
      }
    } catch (err) {
      console.warn("[automations] tetikleme hatası", err);
      return;
    }
    try {
      window.appStore?.triggerSystemNotification?.(manual ? "Otomasyon elle çalıştırıldı" : "Otomasyon çalıştı", auto?.title || task);
    } catch (e) {
      /* bildirim kapalıysa sessiz geç */
      window.luxDebug?.("automation_scheduler.js:133", e);
    }
    window.dispatchEvent(new CustomEvent("lux-automation-ran", { detail: { id: auto?.id, at: Date.now(), manual } }));
  }

  function tick() {
    const list = window.appStore?.state?.automations;
    if (!Array.isArray(list) || list.length === 0) return;
    const now = Date.now();
    let dirty = false;
    for (const auto of list) {
      if (!auto || !auto.enabled) continue;
      // Eski kayıtları (createdAt yok) ilk turda damgala; geçmişe dönük ateşleme yapma.
      if (!auto.createdAt) {
        auto.createdAt = now;
        dirty = true;
        continue;
      }
      const due = nextRunAt(auto, now);
      if (due !== null && now >= due) {
        auto.lastRun = now;
        dirty = true;
        fire(auto);
      }
    }
    if (dirty) {
      try {
        window.appStore?.saveState?.();
      } catch (e) {
        /* kaydetme hatası zamanlayıcıyı durdurmasın */
        window.luxDebug?.("automation_scheduler.js:162", e);
      }
    }
  }

  function runNow(id) {
    const list = window.appStore?.state?.automations || [];
    const auto = list.find((a) => a && a.id === id);
    if (!auto) return false;
    fire(auto, { manual: true });
    return true;
  }

  window.luxAutomations = {
    parseSchedule,
    nextRunAt,
    metaLine,
    runNow,
    tick
  };

  setInterval(tick, TICK_MS);
  setTimeout(tick, FIRST_TICK_DELAY_MS);
})();
