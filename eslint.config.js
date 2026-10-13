import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const rules = {
  "id-length": ["error", { min: 3, exceptions: ["x", "y", "z", "i", "j", "dx", "dy", "dt", "vx", "vy", "nx", "ny"], properties: "never" }],
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
