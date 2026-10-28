import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
      test: resolve(__dirname, './test'),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'nodenext' },
      jsc: {
        target: 'es2023',
        transform: {
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./test/setup-e2e-env.ts'],
    globalSetup: ['./test/vitest-global-setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage-e2e',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/modules/**/*.service.ts',
        'src/modules/**/*.controller.ts',
        'src/common/**/*.ts',
      ],
      exclude: [
        '**/*.module.ts',
        '**/*.dto.ts',
        '**/*.entity.ts',
        '**/*.const.ts',
        '**/*.type.ts',
        '**/*.types.ts',
        '**/*.interface.ts',
        '**/index.ts',
      ],
    },
  },
});
