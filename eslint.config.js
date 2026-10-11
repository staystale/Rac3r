import { createRequire } from "node:module";
import globals from "globals";

// typescript-eslint only supports the TypeScript 6 API, so hand it TS 6 in place of TS 7.
const nodeRequire = createRequire(import.meta.url);
const tsPath = nodeRequire.resolve("typescript");
nodeRequire.cache[tsPath] = {
  id: tsPath, filename: tsPath, loaded: true, exports: nodeRequire("@typescript/typescript6"),
};
const { default: tsParser } = await import("@typescript-eslint/parser");
const { default: tsPlugin } = await import("@typescript-eslint/eslint-plugin");

const rules = {
  "id-length": ["error", { min: 3, exceptions: ["x", "y", "z", "i", "j"], properties: "never" }],
  "no-undef": "error",
  "no-shadow": "error",
  "max-lines": ["error", 800],
  "max-lines-per-function": ["error", 80],
  "max-len": ["error", 100],
  complexity: ["error", 15],
  "no-unused-vars": "error",
  "no-restricted-globals": ["error", "event", "name", "length", "status"],
};

export default [
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules,
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "error" },
  },
];
