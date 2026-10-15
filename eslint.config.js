const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", ".aws-sam/"] },
  js.configs.recommended,
  {
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
];
