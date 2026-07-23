import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

// Guardrails against "god objects" and hard-to-review code. These are enforced
// in CI (see .github/workflows/ci.yml). Existing offenders are grandfathered
// below with a tracking issue — new/edited files must stay under the limits.
const codeHealthRules = {
  "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],
  "max-depth": ["warn", 4],
  "max-params": ["warn", 5],
  complexity: ["warn", 15],
};

export default defineConfig([
  globalIgnores(["dist", "coverage", "storybook-static"]),

  // App source: browser + WebExtension APIs (chrome.*)
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["public/**", "scripts/**", "*.config.js", "**/*.{test,spec}.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        // Vite `define` build-time globals (see CLAUDE.md / vite.config.js)
        __llm_provider__: "readonly",
        __llm_options__: "readonly",
        __use_firebase__: "readonly",
        __firebase_config: "readonly",
        __app_id: "readonly",
        __initial_auth_token: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      ...codeHealthRules,
    },
  },

  // Extension background/content scripts run in the service-worker context.
  {
    files: ["public/**/*.js"],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.serviceworker, ...globals.webextensions },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Build scripts and config run under Node.
  {
    files: ["scripts/**/*.js", "*.config.js"],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Test files: Vitest globals.
  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      // ^[A-Z_] covers JSX component imports used only in markup (no eslint-plugin-react here).
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },

  // Grandfathered god objects — do not grow these; decompose per #26 / #27.
  {
    files: [
      "src/components/BookmarkApp.jsx",
      "src/components/BookmarkForm.jsx",
      "src/components/OptionsModal.jsx",
    ],
    rules: {
      "max-lines": "off",
    },
  },
]);
