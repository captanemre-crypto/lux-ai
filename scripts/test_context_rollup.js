// context_rollup.js birim testleri — LLM'e gitmeden deterministik özet üretimini sınar
const assert = require('assert');
const { buildContextRollup, withRollupContext } = require('../src/js/context_rollup.js');

let pass = 0,
  fail = 0;
const test = (name, fn) => {
  try {
    fn();
    pass++;
    console.log(`[PASS] ${name}`);
  } catch (e) {
    fail++;
    console.error(`[FAIL] ${name}: ${e.message}`);
  }
};

const mk = (n, role = 'user', len = 60) => ({
  role: n % 2 ? role : 'assistant',
  content: `mesaj-${n} ` + 'a'.repeat(len)
});

test('boş/eksik history güvenli', () => {
  const r = buildContextRollup(undefined);
  assert.deepStrictEqual(r.kept, []);
  assert.strictEqual(r.dropped, 0);
  assert.strictEqual(r.summary, '');
});

test('eşik altındaysa özet üretilmez, mesajlar aynen kalır', () => {
  const hist = Array.from({ length: 8 }, (_, i) => mk(i));
  const r = buildContextRollup(hist, { keepRecent: 12 });
  assert.strictEqual(r.kept.length, 8);
  assert.strictEqual(r.dropped, 0);
  assert.strictEqual(r.summary, '');
});

test('40 mesajdan son 12 korunur, 28 özetlenir (satır başları doğru)', () => {
  const hist = Array.from({ length: 40 }, (_, i) => mk(i));
  const r = buildContextRollup(hist, { keepRecent: 12 });
  assert.strictEqual(r.kept.length, 12);
  assert.strictEqual(r.dropped, 28);
  assert.ok(r.summary.length > 0);
  for (const line of r.summary.split('\n')) {
    assert.ok(/^- (Kullanıcı|Asistan): /.test(line), `satır formatı: ${line}`);
  }
  // korunan bölüm son 12 mesajla birebir aynı
  assert.deepStrictEqual(r.kept, hist.slice(28));
});

test('özet uzunluğu tavanı uygulanır (maxSummaryChars)', () => {
  const hist = Array.from({ length: 200 }, (_, i) => mk(i, 'user', 400));
  const r = buildContextRollup(hist, { keepRecent: 2, maxSummaryItems: 100, maxSummaryChars: 1000 });
  assert.strictEqual(r.dropped, 198);
  assert.ok(r.summary.length <= 1000 + 62, `özet ${r.summary.length} karakter`);
});

test('özet satırı adedi tavanı (maxSummaryItems)', () => {
  const hist = Array.from({ length: 100 }, (_, i) => mk(i, 'user', 20));
  const r = buildContextRollup(hist, { keepRecent: 2, maxSummaryItems: 10 });
  assert.strictEqual(r.summary.split('\n').length, 10);
});

test('içerik dizisi (parts) ve boş mesajlar doğru işlenir', () => {
  const hist = [
    { role: 'user', content: [{ text: 'parça-bir ' }, { text: 'parça-iki' }] },
    { role: 'assistant', content: '' }, // elenmeli
    { role: 'assistant', content: 'yanıt-bir' },
    ...Array.from({ length: 12 }, (_, i) => mk(i, 'user', 10))
  ];
  const r = buildContextRollup(hist, { keepRecent: 2 });
  const all = [...r.kept];
  assert.ok(all.every((m) => String(m.content).trim().length > 0));
  assert.ok(r.dropped >= 1);
});

test('withRollupContext: özet yoksa prompt değişmez', () => {
  const r = withRollupContext(
    'selam',
    Array.from({ length: 3 }, (_, i) => mk(i))
  );
  assert.strictEqual(r.prompt, 'selam');
  assert.strictEqual(r.rolled, false);
  assert.strictEqual(r.dropped, 0);
});

test('withRollupContext: özet prompt başına eklenir, özgün metin sonda kalır', () => {
  const hist = Array.from({ length: 40 }, (_, i) => mk(i));
  const r = withRollupContext('BUGÜNKÜ SORUM', hist);
  assert.ok(r.prompt.startsWith('[ÖNCEKİ KONUŞMANIN ÖZETİ — '));
  assert.ok(r.prompt.endsWith('BUGÜNKÜ SORUM'));
  assert.ok(r.rolled);
  assert.strictEqual(r.kept.length, 12);
  assert.strictEqual(r.dropped, 28);
});

test('deterministik: aynı girdi aynı çıktıyı üretir', () => {
  const hist = Array.from({ length: 40 }, (_, i) => mk(i));
  const a = buildContextRollup(hist);
  const b = buildContextRollup(hist);
  assert.deepStrictEqual(a, b);
});

console.log(`\nCONTEXT ROLLUP TESTS FINISHED: ${pass}/${pass + fail} PASSED (${fail} FAILED)`);
process.exit(fail ? 1 : 0);
