// LUX AI — Yüksek riskli araç onay kapısı (chat.js'ten ayrıştırıldı)
// auto_approve_commands kapalıyken terminal/silme/PC kontrolü öncesinde kullanıcı onayı ister.
// chat.js'ten ÖNCE yüklenir; executeAgentTool buradan global çözüm yapar.

// ---- Yüksek riskli araçlar için kullanıcı onay kapısı --------------------
// auto_approve_commands (Ayarlar > İzinler) kapalıyken terminal komutu, dosya
// silme ve PC kontrolü (salt-okunur eylemler hariç) çalıştırılmadan önce
// kullanıcıdan onay alınır. Onay; modal diyalogdaki Çalıştır/Reddet düğmesiyle
// veya Esc/Enter ile verilir. Kasa hatası gibi beklenmedik durumlarda güvenli
// varsayılan REDDET'tir.
const APPROVAL_READ_ONLY_PC_ACTIONS = new Set(["system_info", "list_windows", "clipboard_get"]);

function isApprovalRequiredTool(toolName, args) {
  if (toolName === "run_command" || toolName === "delete_path") return true;
  if (toolName === "pc_control") {
    const act = String(args?.action || "")
      .trim()
      .toLowerCase();
    return !APPROVAL_READ_ONLY_PC_ACTIONS.has(act);
  }
  return false;
}

function requestToolExecutionApproval(toolName, args) {
  return new Promise((resolve) => {
    let settled = false;
    let overlay = null;
    let onKey = null;
    let guardTimer = null;
    const done = (ok, remember) => {
      if (settled) return;
      settled = true;
      try {
        if (guardTimer) clearTimeout(guardTimer);
      } catch (e) {
        window.luxDebug?.("tool_approval.js:35", e);
      }
      try {
        if (onKey) document.removeEventListener("keydown", onKey, true);
      } catch (e) {
        window.luxDebug?.("tool_approval.js:38", e);
      }
      try {
        if (overlay) overlay.remove();
      } catch (e) {
        window.luxDebug?.("tool_approval.js:41", e);
      }
      if (ok && remember) {
        try {
          window.appStore?.setPermission?.("auto_approve_commands", true);
        } catch (e) {
          window.luxDebug?.("tool_approval.js:45", e);
        }
      }
      resolve(Boolean(ok));
    };
    try {
      const perms = window.appStore?.getPermissions?.() || {};
      if (perms.auto_approve_commands === true) {
        resolve(true);
        return;
      }

      const detail =
        toolName === "run_command"
          ? String(args?.command || args?.cmd || "")
          : toolName === "delete_path"
            ? String(args?.targetPath || args?.path || "")
            : `${String(args?.action || "")}${args?.target ? " — " + String(args.target) : ""}${args?.value ? " — " + String(args.value).slice(0, 200) : ""}`;
      const label =
        toolName === "run_command" ? "Terminal Komutu" : toolName === "delete_path" ? "Dosya/Klasör Silme" : "Bilgisayar Kontrolü";

      overlay = document.createElement("div");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Yüksek riskli işlem onayı");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,0.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;";

      const card = document.createElement("div");
      card.style.cssText =
        "max-width:560px;width:100%;background:#111827;border:1px solid rgba(251,191,36,0.4);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,0.55);padding:20px 22px;color:#f3f4f6;font-family:inherit;";

      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:10px;";
      const badge = document.createElement("div");
      badge.textContent = "!";
      badge.style.cssText =
        "flex:0 0 auto;width:38px;height:38px;border-radius:9999px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.5);color:#fbbf24;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;";
      const titleWrap = document.createElement("div");
      const title = document.createElement("div");
      title.textContent = (window.LuxI18n && LuxI18n.t("approval.title")) || "Yüksek Riskli İşlem Onayı";
      title.style.cssText = "font-size:15px;font-weight:800;letter-spacing:0.02em;color:#fde68a;";
      const subtitle = document.createElement("div");
      subtitle.textContent = (window.LuxI18n && LuxI18n.t("approval.subtitle", { label })) || `Lux şu işlemi çalıştırmak istiyor: ${label}`;
      subtitle.style.cssText = "font-size:12px;color:#d1d5db;margin-top:2px;";
      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);
      titleRow.appendChild(badge);
      titleRow.appendChild(titleWrap);

      const pre = document.createElement("pre");
      pre.textContent = detail || (window.LuxI18n && LuxI18n.t("approval.emptyDetail")) || "(ayrıntı yok)";
      pre.style.cssText =
        "margin:12px 0;padding:12px 14px;background:#0b1220;border:1px solid rgba(148,163,184,0.25);border-radius:12px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;color:#fde68a;";

      const rememberRow = document.createElement("label");
      rememberRow.style.cssText =
        "display:flex;align-items:center;gap:8px;font-size:11px;color:#9ca3af;cursor:pointer;user-select:none;margin-bottom:12px;";
      const remember = document.createElement("input");
      remember.type = "checkbox";
      const rememberText = document.createElement("span");
      rememberText.textContent =
        (window.LuxI18n && LuxI18n.t("approval.remember")) || "Bir daha sorma — Otomatik Komut Onayı'nı aç (Ayarlar > İzinler)";
      rememberRow.appendChild(remember);
      rememberRow.appendChild(rememberText);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:10px;";
      const denyBtn = document.createElement("button");
      denyBtn.type = "button";
      denyBtn.textContent = (window.LuxI18n && LuxI18n.t("approval.deny")) || "Reddet";
      denyBtn.style.cssText =
        "padding:9px 18px;border-radius:10px;border:1px solid rgba(148,163,184,0.4);background:transparent;color:#e5e7eb;font-size:13px;font-weight:600;cursor:pointer;";
      const allowBtn = document.createElement("button");
      allowBtn.type = "button";
      allowBtn.textContent = (window.LuxI18n && LuxI18n.t("approval.run")) || "Çalıştır";
      allowBtn.style.cssText =
        "padding:9px 18px;border-radius:10px;border:1px solid rgba(251,191,36,0.6);background:#f59e0b;color:#1f2937;font-size:13px;font-weight:800;cursor:pointer;";
      denyBtn.addEventListener("click", () => done(false, false));
      allowBtn.addEventListener("click", () => done(true, remember.checked));
      btnRow.appendChild(denyBtn);
      btnRow.appendChild(allowBtn);

      onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(false, false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          done(true, remember.checked);
        }
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) done(false, false);
      });
      document.addEventListener("keydown", onKey, true);
      guardTimer = setTimeout(() => done(false, false), 180000); // 3 dk sessizlikte güvenli red

      card.appendChild(titleRow);
      card.appendChild(pre);
      card.appendChild(rememberRow);
      card.appendChild(btnRow);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      try {
        denyBtn.focus();
      } catch (e) {
        window.luxDebug?.("tool_approval.js:152", e);
      }
    } catch (err) {
      console.error("Onay diyaloğu açılamadı:", err);
      resolve(false);
    }
  });
}

// Null dönerse işlem devam eder; aksi hâlde reddetme sonucunu döndürür.
async function requestToolExecutionDecision(toolName, args) {
  if (!isApprovalRequiredTool(toolName, args)) return null;
  const approved = await requestToolExecutionApproval(toolName, args);
  if (approved) return null;
  const detail =
    toolName === "run_command"
      ? String(args?.command || args?.cmd || "")
      : toolName === "delete_path"
        ? String(args?.targetPath || args?.path || "")
        : String(args?.action || "");
  return {
    status: "denied",
    summary: detail.slice(0, 120) || toolName,
    detail: "Kullanıcı yüksek riskli işlemi onaylamadı.",
    resultText:
      "HATA: Kullanıcı bu işlemin çalıştırılmasını onaylamadı. Devam etme; kullanıcıya neyi yapmak istediğini ve onaylamadığını bildir."
  };
}
