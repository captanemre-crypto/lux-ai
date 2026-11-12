// Yerel makine kontrolü (system_info, açık klasör, ekran görüntüsü, ps1)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { getKnownDirs, resolveSmartPath } = require('./paths');
const { clampInt, sanitizePsDoubleQuoted, sanitizePsSingleQuoted } = require('./net_guard');

function runPsScript(psScript, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const wrapped = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n${psScript}`;
    const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          success: !err,
          output: (stdout || '').trim(),
          error: err ? (stderr || err.message || '').trim() : ''
        });
      }
    );
  });
}

function captureScreenWithPowershell(destPath) {
  const safePath = sanitizePsSingleQuoted(destPath);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$dir = Split-Path -Parent '${safePath}'
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bmp.Save('${safePath}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "$($bounds.Width)x$($bounds.Height)"
`;
  return runPsScript(script, 15000);
}

async function pcControl(payload = {}, helpers = {}) {
  const action = String(payload.action || '')
    .trim()
    .toLowerCase();
  const target = String(payload.target || '').trim();
  const value = payload.value !== undefined ? String(payload.value) : '';
  const workspaceDir = payload.workspaceDir || helpers.workspaceDir || process.cwd();

  if (action === 'system_info') {
    const memTotalGb = (os.totalmem() / 1024 ** 3).toFixed(1);
    const memFreeGb = (os.freemem() / 1024 ** 3).toFixed(1);
    const cpus = os.cpus() || [];
    return {
      success: true,
      action,
      output: [
        `Bilgisayar: ${os.hostname()} (${os.platform()} ${os.release()} ${os.arch()})`,
        `Kullanıcı: ${os.userInfo().username} | Masaüstü: ${getKnownDirs(helpers).desktop}`,
        `CPU: ${cpus[0]?.model || 'Bilinmiyor'} (${cpus.length} çekirdek)`,
        `RAM: ${memFreeGb} GB boş / ${memTotalGb} GB toplam`,
        `Aktif Çalışma Klasörü: ${workspaceDir}`
      ].join('\n')
    };
  }

  if (action === 'clipboard_get') {
    const text = helpers.clipboard?.readText?.() || '';
    return { success: true, action, text, output: text || '(pano boş)' };
  }

  if (action === 'clipboard_set') {
    const content = value || target;
    helpers.clipboard?.writeText?.(content);
    return { success: true, action, output: `Panoya kopyalandı (${content.length} karakter).` };
  }

  if (action === 'open_url' || action === 'open_website') {
    let url = target || value;
    if (!url) return { success: false, error: 'URL parametresi gerekli.' };
    if (payload.blockYouTube === true && /(?:youtube\.com|youtu\.be)/i.test(url)) {
      return { success: false, error: 'Kullanıcı YouTube açılmasını istemedi.' };
    }
    if (
      /^[a-zA-Z]:[\\/]|^desktop|^masaüstü|^masaustu|^~/i.test(url) ||
      (!/^https?:\/\//i.test(url) && !url.includes('.'))
    ) {
      const resolved = resolveSmartPath(url, workspaceDir, helpers);
      if (fs.existsSync(resolved)) {
        const errMsg = await helpers.shell?.openPath?.(resolved);
        return { success: !errMsg, action, path: resolved, output: errMsg || `Açıldı: ${resolved}` };
      }
    }
    if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) {
      if (/\s/.test(url) || !url.includes('.')) {
        return { success: false, error: `Geçerli bir URL veya mevcut yerel yol değil: ${url}` };
      }
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      if (payload.blockYouTube === true && /(?:youtube\.com|youtu\.be)/i.test(parsed.hostname)) {
        return { success: false, error: 'Kullanıcı YouTube açılmasını istemedi.' };
      }
    } catch (_) {
      return { success: false, error: `Geçersiz URL: ${url}` };
    }
    await helpers.shell?.openExternal?.(url);
    return { success: true, action, url, output: `Tarayıcıda açıldı: ${url}` };
  }

  if (action === 'open_folder' || action === 'open_path') {
    const resolved = resolveSmartPath(target || value || workspaceDir, workspaceDir, helpers);
    if (!fs.existsSync(resolved)) {
      return { success: false, error: `Konum bulunamadı: ${resolved}` };
    }
    const errMsg = await helpers.shell?.openPath?.(resolved);
    return { success: !errMsg, action, path: resolved, output: errMsg || `Açıldı: ${resolved}` };
  }

  if (action === 'open_app' || action === 'launch_app') {
    const appAlias = {
      'not defteri': 'notepad.exe',
      'not defterini': 'notepad.exe',
      not: 'notepad.exe',
      notepad: 'notepad.exe',
      'hesap makinesi': 'calc.exe',
      'hesap makinesini': 'calc.exe',
      'hesap makinası': 'calc.exe',
      'hesap makinasi': 'calc.exe',
      hesap: 'calc.exe',
      calculator: 'calc.exe',
      calc: 'calc.exe',
      chrome: 'chrome.exe',
      'google chrome': 'chrome.exe',
      edge: 'msedge.exe',
      'microsoft edge': 'msedge.exe',
      tarayıcı: 'msedge.exe',
      tarayici: 'msedge.exe',
      vscode: 'code',
      'vs code': 'code',
      explorer: 'explorer.exe',
      'dosya gezgini': 'explorer.exe',
      'dosya yöneticisi': 'explorer.exe',
      'dosya yoneticisi': 'explorer.exe',
      paint: 'mspaint.exe',
      painti: 'mspaint.exe',
      çizim: 'mspaint.exe',
      'görev yöneticisi': 'taskmgr.exe',
      'gorev yoneticisi': 'taskmgr.exe',
      ayarlar: 'ms-settings:',
      'windows ayarları': 'ms-settings:',
      powershell: 'powershell.exe',
      terminal: 'powershell.exe',
      terminali: 'powershell.exe',
      cmd: 'cmd.exe',
      'komut istemi': 'cmd.exe'
    };
    const appCmd = appAlias[target.toLowerCase()] || target;
    if (!appCmd) return { success: false, error: 'Açılacak uygulama belirtilmedi.' };
    const safeApp = sanitizePsSingleQuoted(appCmd);
    const safeArgs = value ? sanitizePsSingleQuoted(value) : '';
    const ps = safeArgs
      ? `Start-Process -FilePath '${safeApp}' -ArgumentList '${safeArgs}'`
      : `Start-Process -FilePath '${safeApp}'`;
    const r = await runPsScript(ps, 10000);
    return {
      success: r.success,
      action,
      output: r.success ? `Uygulama başlatıldı: ${appCmd}` : r.error || 'Başlatılamadı',
      error: r.error
    };
  }

  if (action === 'list_windows') {
    const r = await runPsScript(
      `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object ProcessName, Id, MainWindowTitle | ConvertTo-Json -Compress`,
      10000
    );
    return { success: r.success, action, output: r.output || '[]', error: r.error };
  }

  if (action === 'focus_window') {
    const safeTarget = target.replace(/'/g, "''");
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeTarget}*' -or $_.ProcessName -like '*${safeTarget}*' } | Select-Object -First 1
if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
  [LuxWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [LuxWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Write-Output ("Odaklandı: " + $p.ProcessName + " - " + $p.MainWindowTitle)
} else {
  Write-Error "Pencere bulunamadı"
}
`;
    const r = await runPsScript(ps, 10000);
    return { success: r.success, action, output: r.output || r.error, error: r.error };
  }

  if (action === 'type_text') {
    const txt = value || target;
    if (!txt) return { success: false, error: 'Yazılacak metin boş.' };
    if (helpers.clipboard?.writeText) {
      helpers.clipboard.writeText(txt);
      const r = await runPsScript(
        `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 120; [System.Windows.Forms.SendKeys]::SendWait('^v')`,
        8000
      );
      return { success: r.success, action, output: r.success ? `Metin yazıldı (${txt.length} karakter).` : r.error };
    }
    return { success: false, error: 'Pano erişimi yok.' };
  }

  if (action === 'send_keys' || action === 'hotkey') {
    const keys = value || target;
    if (!keys) return { success: false, error: 'Tuş dizisi boş.' };
    const safeKeys = sanitizePsSingleQuoted(keys);
    const r = await runPsScript(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`,
      8000
    );
    return { success: r.success, action, output: r.success ? `Tuşlar gönderildi: ${keys}` : r.error };
  }

  if (action === 'mouse_click' || action === 'mouse_move') {
    const x = clampInt(payload.x, -10000, 10000, 0);
    const y = clampInt(payload.y, -10000, 10000, 0);
    const doClick = action === 'mouse_click';
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
}
"@
[LuxMouse]::SetCursorPos(${x}, ${y}) | Out-Null
${doClick ? '[LuxMouse]::mouse_event(0x0002, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; [LuxMouse]::mouse_event(0x0004, 0, 0, 0, 0);' : ''}
Write-Output "${doClick ? 'Tıklandı' : 'Konumlandı'}: (${x}, ${y})"
`;
    const r = await runPsScript(ps, 8000);
    return { success: r.success, action, output: r.output || r.error };
  }

  if (action === 'volume') {
    const mode = (value || target).toLowerCase();
    const vk =
      mode.includes('mute') || mode.includes('sessiz')
        ? '0xAD'
        : mode.includes('down') || mode.includes('azalt') || mode.includes('kıs')
          ? '0xAE'
          : '0xAF';
    const safeMode = sanitizePsDoubleQuoted(mode || 'up');
    const steps = mode.includes('mute') || mode.includes('sessiz') ? 1 : clampInt(payload.steps, 1, 20, 3);
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LuxAudioKey {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
for ($i = 0; $i -lt ${steps}; $i++) {
  [LuxAudioKey]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
  [LuxAudioKey]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
}
Write-Output "Ses komutu uygulandı: ${safeMode}"
`;
    const r = await runPsScript(ps, 8000);
    return { success: r.success, action, output: r.output || r.error };
  }

  return { success: false, error: `Bilinmeyen pc_control eylemi: ${action}` };
}

module.exports = {
  runPsScript,
  captureScreenWithPowershell,
  pcControl
};
