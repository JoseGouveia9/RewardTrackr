import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import prettierConfig from "eslint-config-prettier";

// Allowed feature -> feature imports; everything else is forbidden.
const FEATURE_DEPS = {
  auth: [],
  settings: [],
  legal: [],
  community: [],
  minerwars: [],
  export: ["minerwars"],
  records: ["minerwars", "community"],
};
const FEATURES = Object.keys(FEATURE_DEPS);

const featureZones = FEATURES.map((feature) => ({
  target: `./src/features/${feature}`,
  from: FEATURES.filter((f) => f !== feature && !FEATURE_DEPS[feature].includes(f)).map(
    (f) => `./src/features/${f}`,
  ),
  message: `${feature} may only import from: ${FEATURE_DEPS[feature].join(", ") || "shared code"}.`,
}));

const sharedZones = ["components", "lib", "hooks", "config", "types"].map((dir) => ({
  target: `./src/${dir}`,
  from: ["./src/features", "./src/app"],
  message: "Shared code must not import from features or app.",
}));

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        chrome: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Promise: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: "./tsconfig.json" })],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...sharedZones,
            {
              target: "./src/features",
              from: "./src/app",
              message: "Features must not import from the app layer.",
            },
            ...featureZones,
          ],
        },
      ],
    },
  },
  prettierConfig,
);
