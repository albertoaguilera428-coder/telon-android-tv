/*
Telón - Reglas de ESLint
Para: Telón TV
De: Albert Alvear - Desarrollador, Analista de datos, hacker e ingeniero de software pragmático

Las reglas recomendadas más algunas que atrapan lo que más nos ha costado: catch vacíos,
eval, variables sin usar y funciones demasiado enredadas. Corre en el pipeline y antes de
integrar; un error bloquea el cambio.
*/
'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'build/**', 'app/build/**', '.gradle/**', 'reports/**', '.stryker-tmp/**'] },
  js.configs.recommended,
  // ============================================================
  // CÓDIGO DE LA APP (navegador, scripts clásicos)
  // ============================================================
  {
    files: ['app/src/main/assets/www/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser }
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'all', ignoreRestSiblings: false }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      // Umbrales de alarma (sección 6 de la guía): si se superan, se revisa el diseño.
      'complexity': ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 5]
    }
  },
  // ============================================================
  // PRUEBAS, SCRIPTS Y CONFIGURACIÓN (Node)
  // ============================================================
  {
    files: ['test/**/*.js', 'features/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { sourceType: 'module' }
  },
  {
    // Estas funciones se evalúan dentro de Chromium (page.evaluate).
    files: ['test/e2e/visual.test.js', 'scripts/medir-rendimiento.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
];
