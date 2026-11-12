// Unified satır farkı — saf fonksiyon, hem main süreç hem testler kullanır.
//
// Önceki sürüm O(n·m) DP (LCS) matrisi kuruyordu ve 250.000 hücre üstünde
// dosyaları "tamamen değişmiş" varsayan eksik bir önizlemeye düşüyordu.
// Bu sürüm:
//   1) Ortak önek/sonek satırlarını budar (yaygın durumda problem boyutu
//      değişen birkaç satıra iner),
//   2) Kalan bölgede Myers O((N+M)·D) açgözlü fark algoritması çalıştırır,
//   3) Hâlâ devasa farkta (çok büyük tam-dosya değişikliği) doğrusal önizlemeye
//      düşer — asla bellek patlamaz.
// Çıktı biçimi öncekiyle aynı: `--- a/..`, `+++ b/..`, `@@ ... @@`, 2 satır bağlam.

function trimCommon(a, b) {
  let start = 0;
  const n = a.length,
    m = b.length;
  while (start < n && start < m && a[start] === b[start]) start++;
  let aEnd = n,
    bEnd = m;
  while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) {
    aEnd--;
    bEnd--;
  }
  return { start, aEnd, bEnd };
}

// Myers diff: ops listesi döner [{type:' '|'-'|'+', text}]
function myersOps(a, b) {
  const n = a.length,
    m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const width = 2 * max + 1;
  const offset = max;
  const v = new Int32Array(width);
  const trace = [];

  for (let d = 0; d <= max; d++) {
    // Bu adımın V kopyası (geriye izleme için)
    trace.push(Int32Array.from(v));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        return backtrack(trace, a, b, d);
      }
    }
  }
  return backtrack(trace, a, b, max); // erişilmez; güvenli dönüş
}

function backtrack(trace, a, b, dFinal) {
  const n = a.length,
    m = b.length;
  const max = n + m;
  const offset = max;
  const ops = [];
  let x = n,
    y = m;

  for (let d = dFinal; d >= 1; d--) {
    // trace[d] = bu d adımının push ettiği kopyası = V'nin d-1 sonrası hâli
    const vTrace = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && vTrace[offset + k - 1] < vTrace[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vTrace[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: ' ', text: a[x - 1] });
      x--;
      y--;
    }
    if (x === prevX) {
      ops.push({ type: '+', text: b[y - 1] });
      y--;
    } else {
      ops.push({ type: '-', text: a[x - 1] });
      x--;
    }
  }
  while (x > 0 && y > 0) {
    ops.push({ type: ' ', text: a[x - 1] });
    x--;
    y--;
  }
  ops.reverse();
  return ops;
}

function buildUnifiedLineDiff(relPath, oldText, newText) {
  const oldLines = String(oldText || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const newLines = String(newText || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const n = oldLines.length,
    m = newLines.length;

  // Ortak önek/sonek budama
  const { start, aEnd, bEnd } = trimCommon(oldLines, newLines);
  const aMid = oldLines.slice(start, aEnd);
  const bMid = newLines.slice(start, bEnd);

  let coreOps;
  if (aMid.length === 0 && bMid.length === 0) {
    coreOps = [];
  } else if (aMid.length + bMid.length > 6000 && aMid.length * bMid.length > 4000000) {
    // Patolojik durum: doğrusal, sınırlı önizleme
    const ops = [];
    for (const l of oldLines.slice(0, 200)) ops.push({ type: '-', text: l });
    for (const l of newLines.slice(0, 200)) ops.push({ type: '+', text: l });
    let additions = Math.max(0, m - n) + Math.min(200, n);
    let deletions = Math.max(0, n - m) + Math.min(200, m);
    const preview = [
      `--- a/${relPath}`,
      `+++ b/${relPath}`,
      `@@ -1,${Math.min(n, 20)} +1,${Math.min(m, 20)} @@`,
      ...newLines.slice(0, 30).map((l) => `+${l}`)
    ].join('\n');
    return { additions, deletions, diffText: preview };
  } else {
    coreOps = myersOps(aMid, bMid);
  }

  let additions = 0,
    deletions = 0;
  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: ' ', text: oldLines[i] });
  for (const op of coreOps) {
    if (op.type === '+') additions++;
    else if (op.type === '-') deletions++;
    ops.push(op);
  }
  for (let i = aEnd; i < n; i++) ops.push({ type: ' ', text: oldLines[i] });

  // 2 satır bağlamla hunk'lar
  const linesOut = [`--- a/${relPath}`, `+++ b/${relPath}`, `@@ -1,${n} +1,${m} @@`];
  const keepIdx = new Set();
  ops.forEach((op, idx) => {
    if (op.type !== ' ') {
      for (let k = Math.max(0, idx - 2); k <= Math.min(ops.length - 1, idx + 2); k++) keepIdx.add(k);
    }
  });
  if (keepIdx.size === 0) return { additions: 0, deletions: 0, diffText: '' };

  let prevKept = -1;
  Array.from(keepIdx)
    .sort((a, b) => a - b)
    .forEach((idx) => {
      if (prevKept !== -1 && idx > prevKept + 1) linesOut.push('@@ ... @@');
      linesOut.push(`${ops[idx].type}${ops[idx].text}`);
      prevKept = idx;
    });

  return { additions, deletions, diffText: linesOut.join('\n') };
}

module.exports = { buildUnifiedLineDiff };
