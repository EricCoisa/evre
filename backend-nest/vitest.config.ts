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
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*.e2e-spec.ts', 'node_modules', 'dist'],
    setupFiles: ['./test/setup-env.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/modules/**/*.service.ts',
        'src/common/services/**/*.ts',
        'src/common/guards/**/*.ts',
        'src/common/filters/**/*.ts',
        'src/common/interceptors/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        '**/*.module.ts',
        '**/*.dto.ts',
        '**/*.entity.ts',
        '**/*.const.ts',
        '**/*.type.ts',
        '**/*.types.ts',
        '**/*.interface.ts',
        '**/*.decorator.ts',
        '**/*.strategy.ts',
        '**/index.ts',
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
