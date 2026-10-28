// NÃO renomear pra `vitest.d.ts`: com `baseUrl: "./"` no tsconfig, um arquivo
// `vitest.d.ts` na raiz sequestra todo `import ... from 'vitest'` dos specs
// ("File 'vitest.d.ts' is not a module") e derruba o typecheck inteiro.
/// <reference types="vitest/globals" />
