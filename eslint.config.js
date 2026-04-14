import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importX from "eslint-plugin-import-x";
import prettierConfig from "eslint-config-prettier";

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
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Enforce unidirectional architecture: shared → features → app
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            // shared modules (components, lib, hooks, utils, types) cannot import from features or app
            {
              target: "./src/components",
              from: ["./src/features", "./src/app"],
              message: "Shared components must not import from features or app.",
            },
            {
              target: "./src/lib",
              from: ["./src/features", "./src/app"],
              message: "lib must not import from features or app.",
            },
            {
              target: "./src/hooks",
              from: ["./src/features", "./src/app"],
              message: "Shared hooks must not import from features or app.",
            },
            {
              target: "./src/utils",
              from: ["./src/features", "./src/app"],
              message: "Shared utils must not import from features or app.",
            },
            {
              target: "./src/types",
              from: ["./src/features", "./src/app"],
              message: "Shared types must not import from features or app.",
            },
            // features cannot import from app
            {
              target: "./src/features",
              from: "./src/app",
              message: "Features must not import from the app layer.",
            },
            // no cross-feature imports
            {
              target: "./src/features/auth",
              from: "./src/features/export",
              message: "Cross-feature imports are not allowed.",
            },
            {
              target: "./src/features/export",
              from: "./src/features/auth",
              message: "Cross-feature imports are not allowed.",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
