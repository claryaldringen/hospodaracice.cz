import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-plugin-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
      "next/core-web-vitals",
      "next/typescript",
      "plugin:prettier/recommended"
  ),
  {
    plugins: {
      prettier, // Plugin musí být definován jako objekt
    },
    rules: {
      "prettier/prettier": "error", // Prettier chyby budou ESLint chyby
    },
  },
];

export default eslintConfig;
