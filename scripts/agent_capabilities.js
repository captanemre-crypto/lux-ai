// LUX AI — Agent yetenekleri (facade)
//
// Modüller:
//   ./agent/paths.js   — yıkıcı işlem güvenlik kalkanı + akıllı yol çözümleme
//   ./agent/files.js   — dosya listeleme/arama, masaüstü projeleri
//   ./agent/web.js     — web/hava durumu arama, sayfa getirme
//   ./agent/images.js  — görsel arama/indirme, AI görsel üretimi, Studio HTML
//   ./agent/pc.js      — system_info, klasör açma, ekran görüntüsü, PC kontrolü
//
// Dış API eskisiyle birebir aynıdır; main.js ve testler değişmeden çalışır.
const paths = require('./agent/paths');
const files = require('./agent/files');
const web = require('./agent/web');
const images = require('./agent/images');
const pc = require('./agent/pc');

module.exports = {
  assertSafeDestructiveTarget: paths.assertSafeDestructiveTarget,
  getKnownDirs: paths.getKnownDirs,
  resolveSmartPath: paths.resolveSmartPath,
  listDesktopProjects: files.listDesktopProjects,
  listFilesSmart: files.listFilesSmart,
  searchFilesSmart: files.searchFilesSmart,
  webSearch: web.webSearch,
  fetchWebpage: web.fetchWebpage,
  searchAndDownloadImages: images.searchAndDownloadImages,
  buildCreativeStudioHtml: images.buildCreativeStudioHtml,
  generateAiImageViaPollinations: images.generateAiImageViaPollinations,
  captureScreenWithPowershell: pc.captureScreenWithPowershell,
  pcControl: pc.pcControl,
  detectImageFormat: images.detectImageFormat
};
