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
  { name: '1/6 npm test', cmd: 'npm', args: ['test'] },
  { name: '2/6 lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: '3/6 prettier --check', cmd: 'npx', args: ['prettier', '--check', '.'] },
  {
    name: '4/6 css:build + drift kontrolü',
    cmd: 'npm',
    args: ['run', 'css:build'],
    then: { cmd: 'git', args: ['diff', '--exit-code', '--', 'src/css/compiled_tailwind.css'] }
  },
  {
    name: '5/6 smoke (gerçek açılış)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/smoke_harness.js']
      : [electronCli, 'scripts/smoke_harness.js']
  },
  {
    name: '6/6 e2e (gerçek çalışma döngüsü)',
    cmd: isLinux ? 'xvfb-run' : process.execPath,
    args: isLinux
      ? ['-a', process.execPath, electronCli, 'scripts/e2e_runtime.js']
      : [electronCli, 'scripts/e2e_runtime.js']
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
