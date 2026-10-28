import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Arquivos de teste
    "**/*.test.*",
    "**/*.spec.*",
    // Gerado pelo orval (openapi:export -> generate:api); nunca editado manualmente.
    "src/lib/generated/**",
    // Gerado pelo payload (payload:migrate:create); nunca editado manualmente.
    "src/migrations/**",
  ]),
  {
    // Hook de suspense só pode nascer na camada de queries: é lá que se decide se um dado
    // suspende, e o componente apenas consome. Nenhum lint consegue verificar se existe um
    // <AsyncBoundary> acima na árvore — isso é runtime, e o boundary mora no pai.
    // Ver docs/frontend/async-boundary.md.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/actions/**/queries.ts", "src/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              importNames: ["useSuspenseQuery", "useSuspenseQueries"],
              message:
                "Hook de suspense só em lib/actions/*/queries.ts — o componente consome o hook, não escolhe se ele suspende. Ver docs/frontend/async-boundary.md",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      complexity: ["warn", 10],
    },
  },
]);

export default eslintConfig;
