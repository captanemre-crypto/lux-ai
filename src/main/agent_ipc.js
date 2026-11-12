// Lux Unlimited Agent IPCs (Web, Görsel, Ekran, PC Kontrol) — main.js'ten ayrıştırıldı.
const path = require('path');
const fs = require('fs');

const { asString, asOptions, MAX_QUERY, MAX_PATH } = require('./validate');
function registerAgentIpc({
  ipcMain,
  BrowserWindow,
  desktopCapturer,
  clipboard,
  shell,
  agentCaps,
  mediaCacheDir,
  getWorkspaceDir,
  getKnownPathOverrides
}) {
  // ----------------------------------------------------
  // Lux Unlimited Agent IPCs (Web, Image Search/Gen, Screen, PC Control)
  // ----------------------------------------------------
  async function renderStudioDesignPng(htmlContent, outPath, width = 1024, height = 768) {
    let offWin = null;
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      offWin = new BrowserWindow({
        width,
        height,
        show: false,
        backgroundColor: '#070709',
        webPreferences: {
          offscreen: true,
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      await offWin.loadURL(dataUrl);
      await new Promise((r) => setTimeout(r, 220));
      const nativeImg = await offWin.webContents.capturePage();
      const pngBuf = nativeImg.toPNG();
      fs.writeFileSync(outPath, pngBuf);
      return {
        success: pngBuf.length > 0,
        localPath: outPath,
        fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
        format: 'png',
        sizeBytes: pngBuf.length,
        engine: 'lux-studio-canvas'
      };
    } finally {
      if (offWin && !offWin.isDestroyed()) {
        try {
          offWin.destroy();
        } catch (_) {}
      }
    }
  }

  ipcMain.handle('agent-web-search', async (event, query, options = {}) => {
    try {
      query = asString(query, 'query', { max: MAX_QUERY });
      options = asOptions(options);
      return await agentCaps.webSearch(query, options);
    } catch (err) {
      return { success: false, error: err.message, results: [] };
    }
  });

  ipcMain.handle('agent-web-fetch', async (event, url, options = {}) => {
    try {
      url = asString(url, 'url', { max: 2048 });
      options = asOptions(options);
      return await agentCaps.fetchWebpage(url, options);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('agent-image-search', async (event, query, options = {}) => {
    try {
      query = asString(query, 'query', { max: MAX_QUERY });
      options = asOptions(options);
      const saveDir = options?.saveDir
        ? agentCaps.resolveSmartPath(options.saveDir, getWorkspaceDir(), getKnownPathOverrides())
        : mediaCacheDir;
      return await agentCaps.searchAndDownloadImages(query, {
        count: options?.count || 2,
        saveDir
      });
    } catch (err) {
      return { success: false, error: err.message, images: [] };
    }
  });

  ipcMain.handle('agent-image-generate', async (event, payload = {}) => {
    try {
      payload = asOptions(payload, 'payload');
      const prompt = asString(payload.prompt || payload.title || 'Lux AI Visual Design', 'prompt', {
        max: MAX_QUERY
      }).trim();
      const width = Math.max(320, Math.min(1600, Number(payload.width) || 1024));
      const height = Math.max(240, Math.min(1200, Number(payload.height) || 768));
      const slug =
        prompt
          .toLowerCase()
          .replace(/[^a-z0-9çğıöşü]+/gi, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 32) || 'tasarim';
      const baseOut = payload.outputPath
        ? agentCaps.resolveSmartPath(payload.outputPath, getWorkspaceDir(), getKnownPathOverrides())
        : path.join(mediaCacheDir, `${slug}_${Date.now()}`);

      const wantsStudioOnly =
        Boolean(payload.htmlOrSvg) ||
        payload.engine === 'studio' ||
        /\b(diyagram|şema|tablo|kart|sunum|ui|arayüz|poster\s*yazı)\b/i.test(prompt);
      if (!wantsStudioOnly) {
        const aiRes = await agentCaps.generateAiImageViaPollinations(prompt, baseOut, {
          width,
          height,
          style: payload.style || ''
        });
        if (aiRes) {
          return { success: true, prompt, ...aiRes };
        }
      }

      const html = agentCaps.buildCreativeStudioHtml(prompt, {
        width,
        height,
        title: payload.title || prompt,
        htmlOrSvg: payload.htmlOrSvg || ''
      });
      const parsedOut = path.parse(baseOut);
      const pngOut = parsedOut.ext ? path.join(parsedOut.dir, `${parsedOut.name}.png`) : `${baseOut}.png`;
      const studioRes = await renderStudioDesignPng(html, pngOut, width, height);
      return { success: studioRes.success, prompt, ...studioRes };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('agent-capture-screen', async (event, payload = {}) => {
    try {
      payload = asOptions(payload, 'payload');
      const rawOut = payload?.outputPath ? asString(payload.outputPath, 'outputPath', { max: MAX_PATH }) : '';
      const outPath = rawOut
        ? agentCaps.resolveSmartPath(rawOut, getWorkspaceDir(), getKnownPathOverrides())
        : path.join(mediaCacheDir, `ekran_${Date.now()}.png`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        if (sources && sources.length > 0 && sources[0].thumbnail && !sources[0].thumbnail.isEmpty()) {
          const pngBuf = sources[0].thumbnail.toPNG();
          if (pngBuf.length > 1000) {
            fs.writeFileSync(outPath, pngBuf);
            return {
              success: true,
              localPath: outPath,
              fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
              sizeBytes: pngBuf.length,
              engine: 'electron-desktop-capturer'
            };
          }
        }
      } catch (_) {}

      const psRes = await agentCaps.captureScreenWithPowershell(outPath);
      if (psRes.success && fs.existsSync(outPath)) {
        const sizeBytes = fs.statSync(outPath).size;
        return {
          success: true,
          localPath: outPath,
          fileUrl: 'file:///' + outPath.replace(/\\/g, '/'),
          sizeBytes,
          resolution: psRes.output,
          engine: 'powershell-screen-capture'
        };
      }
      return { success: false, error: psRes.error || 'Ekran görüntüsü alınamadı.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('agent-pc-control', async (event, payload = {}) => {
    try {
      payload = asOptions(payload, 'payload');
      if (payload.action !== undefined) payload.action = asString(payload.action, 'action', { max: 64 });
      return await agentCaps.pcControl(payload, {
        ...getKnownPathOverrides(),
        clipboard,
        shell
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerAgentIpc };
