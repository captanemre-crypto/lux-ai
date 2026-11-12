// IPC girdi doğrulama birim testleri (scripts/main-ipc yolu: src/main/validate.js)
const assert = require('assert');
const { asString, asId, asIntInRange, isPlainObject, asOptions, ID_RE } = require('../src/main/validate');

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

test('asString: normal string geçer', () => {
  assert.strictEqual(asString('merhaba', 'x'), 'merhaba');
});
test('asString: string olmayan reddedilir', () => {
  assert.throws(() => asString(42, 'x'), /string olmalı/);
  assert.throws(() => asString({ a: 1 }, 'x'), /string olmalı/);
  assert.throws(() => asString(['a'], 'x'), /string olmalı/);
});
test('asString: undefined zorunluda hata, isteğe bağlıda boş string', () => {
  assert.throws(() => asString(undefined, 'x'), /gerekli/);
  assert.strictEqual(asString(undefined, 'x', { required: false }), '');
});
test('asString: uzunluk sınırı uygulanır', () => {
  assert.throws(() => asString('a'.repeat(5000), 'x', { max: 100 }), /çok uzun/);
  assert.strictEqual(asString('a'.repeat(100), 'x', { max: 100 }).length, 100);
});
test('asId: geçerli kimlikler', () => {
  for (const ok of ['gemini', 'openai', 'voice-openrouter', 'e2e-test-key', 'A.B_C:D']) {
    assert.strictEqual(asId(ok), ok);
  }
});
test('asId: yol gezinme ve boşluk reddedilir', () => {
  for (const bad of ['../etc', 'a b', 'a/b', '', 'x'.repeat(129), 'turkce-ç']) {
    assert.throws(() => asId(bad));
  }
});
test('asIntInRange: sınırlar ve fallback', () => {
  assert.strictEqual(asIntInRange(50, 'n', { min: 1, max: 100 }), 50);
  assert.strictEqual(asIntInRange(5000, 'n', { min: 1, max: 100 }), 100);
  assert.strictEqual(asIntInRange(-5, 'n', { min: 1, max: 100 }), 1);
  assert.strictEqual(asIntInRange('abc', 'n', { min: 1, max: 100, fallback: 7 }), 7);
  assert.strictEqual(asIntInRange(3.9, 'n', { min: 1, max: 100 }), 3);
});
test('isPlainObject: dizi ve null düz nesne sayılmaz', () => {
  assert.ok(isPlainObject({}));
  assert.ok(!isPlainObject([]));
  assert.ok(!isPlainObject(null));
  assert.ok(!isPlainObject('str'));
});
test('asOptions: undefined → {}, dizi reddedilir', () => {
  assert.deepStrictEqual(asOptions(undefined), {});
  assert.deepStrictEqual(asOptions(null), {});
  assert.throws(() => asOptions([1, 2]), /nesne olmalı/);
});
test('ID_RE kendi başına kullanılabilir', () => {
  assert.ok(ID_RE.test('valid-id_1.2:3'));
  assert.ok(!ID_RE.test(' spaces '));
});

console.log(`\nVALIDATE TESTS FINISHED: ${pass}/${pass + fail} PASSED (${fail} FAILED)`);
process.exit(fail ? 1 : 0);
