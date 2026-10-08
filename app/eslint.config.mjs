import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const config = [
  { ignores: [".next/**", "node_modules/**", "payload-types.ts", "migrations/**", "public/**"] },
  ...coreWebVitals,
  ...typescript,
  prettier,
  {
    // Payload documents and MDX/unified AST nodes are untyped at these
    // boundaries; typing them is a separate refactor.
    files: [
      "lib/payload-content.ts",
      "lib/mdx-pipeline.ts",
      "mdx-plugins/**",
      "admin/components/**",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // React-Compiler rules that eslint-plugin-react-hooks 7 added; the code
    // base was never written against them, so they are advisory for now.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];

export default config;
