import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@contract': path.resolve(import.meta.dirname, 'src/contract'), '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'], environment: 'node' },
});
