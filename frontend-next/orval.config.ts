import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: '../backend-nest/openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/lib/generated',
      schemas: './src/lib/generated/schemas',
      client: 'axios',
      httpClient: 'axios',
      override: {
        mutator: {
          path: './src/lib/api/orval-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
