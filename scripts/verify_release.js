#!/usr/bin/env node
/**
 * YAYIN ÖNCESİ TAM PİL — npm run verify
 *
 * Dağıtım öncesi yerel güvence kapısı. Her adımı çalıştırır, çıktısını
 * olduğu gibi verir ve sonunda tek bir GEÇ/KAL özeti basar.
 *
 * Adımlar:
 *   1. npm test                       (birim/mimari/validator/rollover)
 *   2. npm run lint                   (ESLint)
 *   3. npx prettier --check .         (biçim sapması)
 *   4. css:build + git diff           (derlenmiş CSS güncel mi)
 *   5. smoke harness                  (xvfb-run, yalnız Linux'ta; diğerlerinde doğrudan)
 *   6. e2e_runtime                    (xvfb-run, yalnız Linux'ta; diğerlerinde doğrudan)
 *   7. settings audit                 (gerçek render, 76 kontrol; xvfb-run Linux'ta)
 *   8. i18n runtime probe             (EN yerelin EN kaldığı kanıt; xvfb-run Linux'ta)
 *   9. visual regression              (TR + EN kareleri, piksel eşiği %1.0; xvfb-run Linux'ta)
 *
 * Canlı API çağrıları BUNA DAHİL DEĞİLDİR (ayrı: npm run test:live) —
 * bu betik ağa ve anahtarlara bağımlı değildir.
 *
 * Çıkış kodu: 0 = tümü geçti · 1 = en az bir adım başarısız.
 */
const { spawnSync } = require('child_process');

const isLinux = process.platform === 'linux';
const electronCli = require.resolve('electron/cli.js');

const steps = [
  { name: '1/9 npm test', cmd: 'npm', args: ['test'] },
  { name: '2/9 lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: '3/9 prettier --check', cmd: 'npx', args: ['prettier', '--check', '.'] },
  {
    name: '4/9 css:build + drift kontrolü',
    cmd: 'npm',
    args: ['run', 'css:build'],
    then: { cmd: 'git', args: ['diff', '--exit-code', '--', 'src/css/compiled_tailwind.css'] }
  },
  {
    name: '5/9 smoke (gerçek açılış)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/smoke_harness.js']
      : [electronCli, 'scripts/smoke_harness.js']
  },
  {
    name: '6/9 e2e (gerçek çalışma döngüsü)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/e2e_runtime.js']
      : [electronCli, 'scripts/e2e_runtime.js']
  },
  {
    name: '7/9 settings audit (76 kontrol)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/settings_audit_e2e.js']
      : [electronCli, 'scripts/settings_audit_e2e.js']
  },
  {
    name: '8/9 i18n runtime probe',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/i18n_runtime_probe.js']
      : [electronCli, 'scripts/i18n_runtime_probe.js']
  },
  {
    name: '9/9 visual regression (TR+EN)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/visual_regression.js', '--all']
      : [electronCli, 'scripts/visual_regression.js', '--all']
  }
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: res.status === 0 };
}

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  let r = run(step.cmd, step.args);
  if (r.ok && step.then) {
    console.log(`--- ${step.then.cmd} ${step.then.args.join(' ')} ===`);
    r = run(step.then.cmd, step.then.args);
  }
  results.push({ name: step.name, ...r });
}

console.log('\n================ YAYIN PİLİ ÖZETİ ================');
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '[GEÇTİ]  ' : '[BAŞARISIZ]'} ${r.name}${r.error ? ' — ' + r.error : ''}`);
  if (!r.ok) failed += 1;
}
if (failed > 0) {
  console.error(`\nSONUÇ: ${failed} adım başarısız — YAYIN YAPMAYIN.`);
  process.exit(1);
}
console.log('\nSONUÇ: Tüm yerel güvence kapıları geçti. Yayın için RELEASING.md adımlarını izleyin.');
