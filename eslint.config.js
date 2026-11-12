// LUX AI ESLint (flat config)
// Bilinçli olarak dar kapsam: kozmetik değil, gerçek hata yakalayan kurallar.
// no-undef / no-unused-vars KAPALI: klasik <script> dosyaları birbirinin global'ini
// kullanır (modül sistemi yok); bu kurallar burada anlamsız gürültü üretir.
'use strict';
const globals = require('globals');

const sharedRules = {
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-fallthrough': 'error',
  'no-sparse-arrays': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'use-isnan': 'error',
  'valid-typeof': ['error', { requireStringLiterals: false }],
  'no-redeclare': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-misleading-character-class': 'error',
  'no-control-regex': 'off',
  'no-useless-escape': 'off',
  'no-prototype-builtins': 'off'
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'vendor/**',
      '.git/**',
      'out/**',
      'coverage/**',
      'src/css/compiled_tailwind.css',
      'src/js/marked.umd.js',
      'src/vendor/**',
      'assets/**',
      'release/**'
    ]
  },
  {
    files: ['main.js', 'preload.js', 'src/main/**/*.js', 'src/preload.js', 'src/logger.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: sharedRules
  },
  {
    files: ['src/js/**/*.js'],
    ignores: ['src/js/marked.umd.js', 'src/vendor/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser }
    },
    rules: { ...sharedRules, 'no-redeclare': 'off' } // klasik script'lerde build deneyimi: false-positive olur
  }
];
