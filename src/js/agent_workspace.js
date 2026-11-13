// LUX AI — Ajan çalışma alanı/bağlam yardımcıları
//
// chat.js'ten v1.5.0'da taşındı: masaüstü proje önbelleği, çalışma ağacı
// analizi ve turn-bağlamına medya/dosya ekleme kancaları. Hiçbiri chat.js'in
// private durumuna kapanım yapmaz; hepsi window.* globalleri üzerinden çalışır.
// Sıra: chat.js'ten ÖNCE yüklenmeli (index.html).

window.luxDesktopProjectsCache = window.luxDesktopProjectsCache || [];
window.__luxProjectsCacheAt = window.__luxProjectsCacheAt || 0;
window.__luxProjectsCachePromise = window.__luxProjectsCachePromise || null;

function refreshDesktopProjectsCache(force = false) {
  if (!window.luxAPI?.fs?.listDesktopProjects) return Promise.resolve(window.luxDesktopProjectsCache);
  const now = Date.now();
  if (!force && window.luxDesktopProjectsCache.length > 0 && now - window.__luxProjectsCacheAt < 5000) {
    return Promise.resolve(window.luxDesktopProjectsCache);
  }
  if (window.__luxProjectsCachePromise) {
    return window.__luxProjectsCachePromise;
  }
  const wsDir = (window.appStore?.state?.application?.workspaceDir || "").trim() || undefined;
  const p = (async () => {
    try {
      const res = await window.luxAPI.fs.listDesktopProjects(wsDir);
      if (res?.success && Array.isArray(res.projects)) {
        window.luxDesktopProjectsCache = res.projects;
        window.__luxProjectsCacheAt = Date.now();
        if (res.desktopPath && window.luxAppInfo) {
          window.luxAppInfo.desktopPath = res.desktopPath;
        }
      }
    } catch (e) {
      window.luxDebug?.("agent_workspace.js:32", e);
    }
    return window.luxDesktopProjectsCache;
  })().finally(() => {
    if (window.__luxProjectsCachePromise === p) {
      window.__luxProjectsCachePromise = null;
    }
  });
  window.__luxProjectsCachePromise = p;
  return p;
}
window.refreshDesktopProjectsCache = refreshDesktopProjectsCache;

function isSensitivePath(filePath) {
  const norm = (filePath || "").replace(/\\/g, "/").toLowerCase();
  return /(^|\/)\.env($|\.)|id_rsa|\.pem$|\.key$|credentials|secrets?\.json$/i.test(norm);
}

function analyzeWorkspaceTree(nodes, prefix = "", stats = null) {
  const out = stats || { totalFiles: 0, totalDirs: 0, rootFiles: [], topFolders: [], allFiles: [] };
  if (!Array.isArray(nodes)) return out;

  for (const node of nodes) {
    const relPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.isDirectory) {
      out.totalDirs++;
      if (!prefix) {
        const sub = analyzeWorkspaceTree(node.children || [], relPath, {
          totalFiles: 0,
          totalDirs: 0,
          rootFiles: [],
          topFolders: [],
          allFiles: []
        });
        out.totalFiles += sub.totalFiles;
        out.totalDirs += sub.totalDirs;
        out.allFiles.push(...sub.allFiles);
        out.topFolders.push({
          name: node.name,
          fileCount: sub.totalFiles,
          dirCount: sub.totalDirs,
          files: sub.allFiles
        });
      } else {
        analyzeWorkspaceTree(node.children || [], relPath, out);
      }
    } else {
      out.totalFiles++;
      out.allFiles.push(relPath);
      if (!prefix) out.rootFiles.push(node.name);
    }
  }
  return out;
}

function summarizeTreeText(nodes, prefix = "", lines = []) {
  if (!Array.isArray(nodes) || lines.length >= 220) return lines;
  for (const node of nodes) {
    if (lines.length >= 220) break;
    const label = prefix ? `${prefix}/${node.name}` : node.name;
    lines.push(node.isDirectory ? `${label}/` : label);
    if (node.isDirectory && Array.isArray(node.children)) {
      summarizeTreeText(node.children, label, lines);
    }
  }
  return lines;
}

function formatWorkspaceInventory(nodes, resolvedLabel = "Çalışma Alanı Kök Dizini") {
  const stats = analyzeWorkspaceTree(nodes);
  const wsDir = window.appStore?.state?.application?.workspaceDir || "Aktif çalışma klasörü";

  const lines = [];
  lines.push(`Aktif Çalışma Klasörü: ${wsDir}`);
  if (resolvedLabel) lines.push(`Taranan Konum: ${resolvedLabel}`);
  lines.push(`GENEL TOPLAM: ${stats.totalFiles} dosya, ${stats.totalDirs} klasör (node_modules ve __pycache__ hariç)`);

  if (stats.topFolders.length > 0) {
    lines.push("");
    lines.push("Klasör Dağılımı:");
    for (const f of stats.topFolders) {
      const codeFiles = f.files.filter((p) => /\.(js|mjs|cjs|ts|py|html|css|json|md|bat|ps1)$/i.test(p));
      const shown = f.files.length <= 10 ? f.files : codeFiles.length > 0 ? codeFiles.slice(0, 8) : f.files.slice(0, 6);
      const rest = f.files.length - shown.length;
      lines.push(`- ${f.name}/: ${f.fileCount} dosya, ${f.dirCount} alt klasör`);
      if (shown.length > 0) {
        lines.push(`  Dosyalar: ${shown.join(", ")}${rest > 0 ? `, ... (+${rest} diğer dosya)` : ""}`);
      }
    }
  }

  if (stats.rootFiles.length > 0) {
    lines.push("");
    const nonMediaRoot = stats.rootFiles.filter((n) => !/\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n));
    const mediaRootCount = stats.rootFiles.length - nonMediaRoot.length;
    lines.push(`Kök Dizindeki Dosyalar (${stats.rootFiles.length} adet):`);
    if (stats.rootFiles.length <= 15) {
      lines.push(`- ${stats.rootFiles.join(", ")}`);
    } else {
      if (nonMediaRoot.length > 0) {
        const priorityRank = (name) => {
          const n = name.toLowerCase();
          if (n === "package.json" || n === "main.js" || n === "readme.md" || n === "preload.js") return 0;
          if (/^(Lux_|dialog_full|extracted_|live_settings|overview_icons)/.test(n)) return 3;
          if (/\.(js|py|ts|json|md|bat|ps1)$/i.test(n)) return 1;
          return 2;
        };
        const prioritizedRoot = nonMediaRoot.slice().sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b));
        const shownRoot = prioritizedRoot.length <= 14 ? prioritizedRoot : prioritizedRoot.slice(0, 12);
        const restRoot = prioritizedRoot.length - shownRoot.length;
        lines.push(
          `- Kod/Yapılandırma (${nonMediaRoot.length}): ${shownRoot.join(", ")}${restRoot > 0 ? `, ... (+${restRoot} dosya)` : ""}`
        );
      }
      if (mediaRootCount > 0) {
        const sampleMedia = stats.rootFiles.filter((n) => /\.(png|jpg|jpeg|gif|webp|mp3|wav)$/i.test(n)).slice(0, 4);
        lines.push(
          `- Görsel/Ses (${mediaRootCount} adet): ${sampleMedia.join(", ")}${mediaRootCount > sampleMedia.length ? `, ... (+${mediaRootCount - sampleMedia.length} ek)` : ""}`
        );
      }
    }
  }

  return {
    stats,
    text: lines.join("\n"),
    shortSummary: `${resolvedLabel} (${stats.totalFiles} dosya, ${stats.totalDirs} klasör)`
  };
}

function resolveProjectOrWorkspaceDir(rawDirArg) {
  const clean = String(rawDirArg || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\\/]+$/, "");
  const configuredWs = (window.appStore?.state?.application?.workspaceDir || "").trim();
  const lower = clean.toLowerCase();

  const rootAliases = new Set([
    "",
    ".",
    "./",
    "root",
    "kök",
    "kök dizin",
    "workspace",
    "çalışma alanı",
    "calisma alani",
    "proje",
    "projeler",
    "projelerim",
    "tüm projeler",
    "tum projeler",
    "tümü",
    "tumu",
    "dosyalar",
    "aktif proje",
    "bu proje",
    "mevcut proje"
  ]);
  if (rootAliases.has(lower)) {
    return { target: configuredWs || undefined, isRootAlias: true, label: "Çalışma Alanı Kök Dizini" };
  }

  // Match real cached Desktop projects first if name matches
  const desktopMatch = (window.luxDesktopProjectsCache || []).find((p) => (p.name || "").trim().toLowerCase() === lower);
  if (desktopMatch && desktopMatch.path) {
    return { target: desktopMatch.path, isRootAlias: false, label: desktopMatch.name };
  }

  const projects = window.appStore?.state?.projects || [];
  const matchedProj = projects.find((p) => (p.name || "").trim().toLowerCase() === lower || (p.id || "").trim().toLowerCase() === lower);
  if (matchedProj) {
    if (matchedProj.path && matchedProj.path.trim()) {
      return { target: matchedProj.path.trim(), isRootAlias: false, label: matchedProj.name };
    }
    return { target: configuredWs || undefined, isRootAlias: true, label: `${matchedProj.name} (Çalışma Alanı)` };
  }

  return { target: clean, isRootAlias: false, label: clean };
}

function addMediaToTurnContext(turnContext, mediaItem) {
  if (!turnContext || !mediaItem) return;
  if (!Array.isArray(turnContext.media)) turnContext.media = [];
  const key = (mediaItem.fileUrl || mediaItem.localPath || mediaItem.url || "").toLowerCase();
  if (!key) return;
  if (!turnContext.media.some((m) => (m.fileUrl || m.localPath || m.url || "").toLowerCase() === key)) {
    turnContext.media.push(mediaItem);
  }
}

function addCreatedFileToTurnContext(turnContext, filePath) {
  if (!turnContext || !filePath) return;
  if (!Array.isArray(turnContext.createdFiles)) turnContext.createdFiles = [];
  if (!turnContext.createdFiles.includes(filePath)) {
    turnContext.createdFiles.push(filePath);
  }
}
