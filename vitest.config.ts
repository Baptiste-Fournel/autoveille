import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'tests/client/**', 'tests/e2e/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          include: ['tests/client/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/client/support/setup.ts'],
        },
      },
    ],
  },
});
