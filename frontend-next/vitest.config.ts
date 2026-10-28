import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      all: true,
      include: ['src/components/**', 'src/lib/**'],
      exclude: ['src/components/ui/**', 'src/lib/generated/**', 'src/lib/seeds/**']
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@payload-config': path.resolve(__dirname, 'payload.config.ts')
    }
  }
})
