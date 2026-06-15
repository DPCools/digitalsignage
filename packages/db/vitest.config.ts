import { defineConfig } from 'vitest/config';
import path from 'path';

const root = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: [
      // Stub generated Prisma clients (produced by `prisma generate`, gitignored).
      // Match on the raw relative specifier used in the source files.
      {
        find: '../src/generated/public',
        replacement: path.resolve(root, 'src/__tests__/__stubs__/generated-public.ts'),
      },
      {
        find: '../src/generated/tenant',
        replacement: path.resolve(root, 'src/__tests__/__stubs__/generated-tenant.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
  },
});
