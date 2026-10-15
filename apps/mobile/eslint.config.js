// ESLint 9 flat config. `npm run lint` runs this through `expo lint`.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Not our code: build output, the native projects `expo prebuild` generates, and the types
    // generated from backend/schemas (npm run gen:types).
    ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'src/api/types.ts'],
  },
]);
