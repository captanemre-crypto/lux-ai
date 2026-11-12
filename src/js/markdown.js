// LUX AI — Ortak metin/markdown yardımcıları
//
// Önceki durum: escapeHtml üç dosyada (app.js, chat.js, modals.js) birebir
// kopyalanmıştı; sanitizeMarkdownHtml/renderMarkdown ise yalnızca chat.js'te.
// Tek kaynak: bu dosya. index.html'de en önce yüklenir.

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function sanitizeMarkdownHtml(html) {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, iframe, object, embed, link[rel='import'], style, meta, base, form").forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const rawVal = String(attr.value || "");
        const normalizedVal = rawVal.replace(/[\u0000-\u0020]+/g, "");
        if (name.startsWith("on") || name === "srcdoc") {
          el.removeAttribute(attr.name);
        } else if (
          (name === "href" ||
            name === "src" ||
            name === "xlink:href" ||
            name === "action" ||
            name === "formaction" ||
            name === "poster" ||
            name === "background") &&
          /^(javascript:|vbscript:|data:text\/html)/i.test(normalizedVal)
        ) {
          el.removeAttribute(attr.name);
        } else if (name === "src" && el.tagName === "IMG" && /^[a-zA-Z]:[\\/]/.test(rawVal)) {
          el.setAttribute("src", "file:///" + rawVal.replace(/\\/g, "/"));
        }
      }
    });
    return doc.body.innerHTML;
  } catch (_) {
    return escapeHtml(html).replace(/\n/g, "<br>");
  }
}

function renderMarkdown(md) {
  if (!md) return "";
  try {
    if (window.marked) {
      if (typeof window.marked.parse === "function") {
        return sanitizeMarkdownHtml(window.marked.parse(md, { breaks: true, gfm: true }));
      } else if (typeof window.marked === "function") {
        return sanitizeMarkdownHtml(window.marked(md));
      }
    }
  } catch (e) {
    console.warn("Markdown parse warning:", e);
  }
  return escapeHtml(md).replace(/\n/g, "<br>");
}
window.renderMarkdown = renderMarkdown;
window.sanitizeMarkdownHtml = sanitizeMarkdownHtml;

function escapeJs(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
window.escapeJs = escapeJs;
