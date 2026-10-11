import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "id-length": ["error", { min: 3, exceptions: ["x", "y", "z", "i", "j"], properties: "never" }],
      "no-undef": "error",
      "no-shadow": "error",
      "max-lines": ["error", 800],
      "max-lines-per-function": ["error", 80],
      "max-len": ["error", 100],
      complexity: ["error", 15],
      "no-unused-vars": "error",
      "no-restricted-globals": ["error", "event", "name", "length", "status"],
    },
  },
];
