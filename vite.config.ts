import { fileURLToPath } from 'node:url';
import { build, defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pathOf = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

const DEFAULT_SERVER_PORT = '3000';

const PRECACHED_FILES = ['**/*.{html,js,css,woff2,svg,png,webmanifest}'];

const THEME_SCRIPT_FILE = 'theme.js';

const compiledThemeScript = async (): Promise<string> => {
  const result = await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    root: pathOf('./client'),
    publicDir: false,
    build: {
      write: false,
      minify: true,
      lib: { entry: pathOf('./client/src/beforeFirstPaint.ts'), formats: ['iife'], name: 'themeBeforeFirstPaint' },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const output of outputs) {
    if ('output' in output) {
      const chunk = output.output.find((file) => file.type === 'chunk');
      if (chunk !== undefined) {
        return chunk.code;
      }
    }
  }
  throw new Error(`${THEME_SCRIPT_FILE} : aucun script produit`);
};

const themeBeforeFirstPaint = (): Plugin => ({
  name: 'autoveille:theme-before-first-paint',
  configureServer: (server) => {
    server.middlewares.use(`/${THEME_SCRIPT_FILE}`, (_request, response, next) => {
      compiledThemeScript().then((code) => {
        response.setHeader('content-type', 'text/javascript; charset=utf-8');
        response.end(code);
      }, next);
    });
  },
  generateBundle: async function () {
    this.emitFile({ type: 'asset', fileName: THEME_SCRIPT_FILE, source: await compiledThemeScript() });
  },
});

export default defineConfig(({ mode }) => ({
  root: pathOf('./client'),
  publicDir: pathOf('./public'),
  build: {
    outDir: pathOf('./dist/client'),
    emptyOutDir: true,
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${loadEnv(mode, pathOf('.'), '').PORT ?? DEFAULT_SERVER_PORT}`,
    },
  },
  plugins: [
    themeBeforeFirstPaint(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: PRECACHED_FILES,
        rollupFormat: 'iife',
      },
    }),
  ],
}));
