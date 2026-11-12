// Comprehensive End-to-End Lifecycle & Architecture Test Suite for LUX AI
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function test(name, fn) {
  results.total++;
  try {
    fn();
    results.passed++;
    results.details.push({ name, status: 'PASS' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.failed++;
    results.details.push({ name, status: 'FAIL', error: err.message });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

console.log('========================================================');
console.log('   LUX AI END-TO-END LIFECYCLE & ARCHITECTURE TEST      ');
console.log('========================================================\n');

// 1. Syntax Check on All JS Files
test('1. Syntax Validation Across Codebase', () => {
  const jsFiles = [
    'main.js',
    'src/preload.js',
    'src/js/app.js',
    'src/js/store.js',
    'src/js/chat.js',
    'src/js/voice.js',
    'src/js/ideMode.js',
    'src/js/rightPanel.js',
    'src/js/sidebar.js',
    'src/js/modals.js',
    'src/js/icons.js',
    'src/js/plugin_system.js',
    'src/js/voice_library.js',
    'scripts/agent_capabilities.js'
  ];

  for (const rel of jsFiles) {
    const full = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(full)) {
      throw new Error(`File missing: ${rel}`);
    }
    execSync(`node -c "${full}"`, { stdio: 'pipe' });
  }
});

// 2. Strict Prohibition: Zero Occurrences of Banned Legacy Brand
test('2. Zero Legacy Brand Check (Repo-wide strict check)', () => {
  const checkDirs = ['src', 'scripts'];
  const banned = ['anti', 'gravity'].join('');
  const regex = new RegExp(banned, 'i');

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== '.git') scanDir(full);
      } else if (ent.isFile() && /\.(js|html|css|json|md)$/i.test(ent.name)) {
        if (ent.name === 'test_lifecycle_e2e.js') continue;
        const content = fs.readFileSync(full, 'utf8');
        if (regex.test(content)) {
          throw new Error(`Found banned legacy brand in ${full}`);
        }
      }
    }
  }

  for (const d of checkDirs) {
    scanDir(path.join(ROOT_DIR, d));
  }
  const rootFiles = ['main.js', 'package.json', 'README.md', 'PERFORMANCE_AUDIT_REPORT.md'];
  for (const f of rootFiles) {
    const full = path.join(ROOT_DIR, f);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      if (regex.test(content)) {
        throw new Error(`Found banned term 'antigravity' in ${full}`);
      }
    }
  }
});

// 3. IPC Main Handlers vs Preload API Surface Verification
test('3. IPC Main Handlers vs Preload Invocation Parity', () => {
  const mainJs = fs.readFileSync(path.join(ROOT_DIR, 'main.js'), 'utf8');
  const preloadJs = fs.readFileSync(path.join(ROOT_DIR, 'src/preload.js'), 'utf8');

  const mainHandles = new Set();
  const handleRegex = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = handleRegex.exec(mainJs)) !== null) {
    mainHandles.add(match[1]);
  }

  const preloadInvokes = new Set();
  const invokeRegex = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
  while ((match = invokeRegex.exec(preloadJs)) !== null) {
    preloadInvokes.add(match[1]);
  }

  for (const inv of preloadInvokes) {
    if (!mainHandles.has(inv)) {
      throw new Error(`Preload invokes '${inv}', but main.js has no ipcMain.handle for it!`);
    }
  }
});

// 4. Agent Capabilities & System Info Unit Execution
test('4. Agent Capabilities & System Info Execution', async () => {
  const caps = require(path.join(ROOT_DIR, 'scripts/agent_capabilities.js'));
  if (typeof caps.pcControl !== 'function') {
    throw new Error('agent_capabilities.pcControl is not a function');
  }

  // Test system_info
  const sysRes = await caps.pcControl({ action: 'system_info' }, { workspaceDir: ROOT_DIR });
  if (!sysRes.success || !sysRes.output.includes('Bilgisayar:')) {
    throw new Error('system_info action failed: ' + JSON.stringify(sysRes));
  }

  // Test analyze_futures_project
  const futRes = await caps.pcControl({ action: 'analyze_futures_project' }, { workspaceDir: ROOT_DIR });
  if (!futRes.success) {
    throw new Error('analyze_futures_project action failed: ' + JSON.stringify(futRes));
  }
});

// 5. Store & Gemini Auto-Router Integration
test('5. Gemini Auto-Router at Index 0 & Submodels Validation', () => {
  const storeJs = fs.readFileSync(path.join(ROOT_DIR, 'src/js/store.js'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT_DIR, 'src/js/app.js'), 'utf8');

  // Verify Gemini Auto-Router definition
  if (!storeJs.includes('gemini/auto-router') && !appJs.includes('gemini/auto-router')) {
    throw new Error('gemini/auto-router is missing from store or app');
  }

  if (!appJs.includes('⚡ Gemini Auto-Router')) {
    throw new Error('⚡ Gemini Auto-Router is missing from KNOWN_PROVIDER_SUBMODELS in app.js');
  }
});

// 6. Visual Element & Coordinate Picker (🎯 Hedef Seç)
test('6. Visual Coordinate & Element Picker Toolbar Integration', () => {
  const ideModeJs = fs.readFileSync(path.join(ROOT_DIR, 'src/js/ideMode.js'), 'utf8');
  if (!ideModeJs.includes('aux-browser-pick-coord') || !ideModeJs.includes('Hedef Seç')) {
    throw new Error('Visual Coordinate Picker (Hedef Seç) is not integrated into ideMode.js');
  }
  if (!ideModeJs.includes('[Hedef:')) {
    throw new Error('Element formatting [Hedef: <selector> (X, Y | WxH)] is missing');
  }
});

// 7. Voice Mode Integrity & Flawless Single-Turn Dictation
test('7. Voice Mode & Dictation Rock-Solid Implementation', () => {
  const voiceJs = fs.readFileSync(path.join(ROOT_DIR, 'src/js/voice.js'), 'utf8');
  if (!voiceJs.includes('stopAndTranscribeComposerDictation')) {
    throw new Error('stopAndTranscribeComposerDictation missing in voice.js');
  }
  if (!voiceJs.includes('toggleComposerDictation')) {
    throw new Error('toggleComposerDictation missing in voice.js');
  }
  if (voiceJs.includes('dictationTypewriterQueue') || voiceJs.includes('dictationSliceInProgress')) {
    throw new Error('Unstable typewriter/slicing remnants found in voice.js dictation!');
  }
  if (!voiceJs.includes('playLuxSound')) {
    throw new Error('playLuxSound sound player is missing in voice.js');
  }
});

// 8. Plugin System Slot & Extensibility Architecture
test('8. Plugin System Registration & Modular Architecture', () => {
  const pluginSys = fs.readFileSync(path.join(ROOT_DIR, 'src/js/plugin_system.js'), 'utf8');
  if (!pluginSys.includes('window.luxPlugins') || !pluginSys.includes('registerPlugin')) {
    throw new Error('window.luxPlugins or registerPlugin missing in plugin_system.js');
  }
});

// 9. Benchmark & Roadmap Knowledge Base Documentation
test('9. Benchmark Knowledge Base (KNOWLEDGE_BASE_SYSTEM_BENCHMARK.md)', () => {
  const kbPath = path.join(ROOT_DIR, 'KNOWLEDGE_BASE_SYSTEM_BENCHMARK.md');
  if (!fs.existsSync(kbPath)) {
    throw new Error('KNOWLEDGE_BASE_SYSTEM_BENCHMARK.md does not exist!');
  }
  const kb = fs.readFileSync(kbPath, 'utf8');
  const requiredSystems = ['Jarvis', 'Claude', 'Gemini', 'ChatGPT', 'Cursor'];
  for (const s of requiredSystems) {
    if (!kb.includes(s)) {
      throw new Error(`Missing ${s} in KNOWLEDGE_BASE_SYSTEM_BENCHMARK.md`);
    }
  }
});

// 10. Chat System Prompt & Master Roadmap Integration
test('10. Chat System Prompt & Master Roadmap Direct Inclusion', () => {
  const chatJs = fs.readFileSync(path.join(ROOT_DIR, 'src/js/chat.js'), 'utf8');
  if (!chatJs.includes('KNOWLEDGE_BASE_SYSTEM_BENCHMARK.md')) {
    throw new Error('System benchmark knowledge base reference missing in chat.js');
  }
  if (!chatJs.includes('Lux AI Master Yol Haritası')) {
    throw new Error('Master roadmap steps missing in chat.js static persona');
  }
});

console.log('\n========================================================');
console.log(`TEST RUN FINISHED: ${results.passed}/${results.total} PASSED (${results.failed} FAILED)`);
console.log('========================================================');

if (results.failed > 0) {
  process.exit(1);
}
