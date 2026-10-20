// eslint for the JavaScript of the repository, the tools and this file: `pnpm lint` from the repository root.
// The TypeScript of the site is checked by `pnpm typecheck`, unused names included (noUnusedLocals in tsconfig.json).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['site/**', 'dist/**', 'node_modules/**', 'data/**', '.venv/**', '.superpowers/**'] },
  js.configs.recommended,
  // `({ at, ...rest }) => rest` drops a field on purpose
  { rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] } },
  {
    // the headless browser checks and this file run in Node
    files: ['tools/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
];
