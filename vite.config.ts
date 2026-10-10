import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

/**
 * pdf.js reads a few files only when a PDF needs them: character maps (for
 * CJK text), the standard fonts (for PDFs that don't embed theirs), image
 * decoders and colour profiles. They're served from /pdfjs/: copied into
 * the build, and straight from node_modules in development. (Its JavaScript
 * engine for scripts in PDFs is left out; scripts never run.)
 */
function pdfjsResources(): Plugin {
  const source = resolve('node_modules/pdfjs-dist')
  const folders = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
  const wanted = (path: string) => !/quickjs/.test(path)
  return {
    name: 'momentum-pdfjs-resources',
    configureServer(server) {
      server.middlewares.use('/pdfjs', (request, response, next) => {
        const path = normalize(
          decodeURIComponent(request.url ?? '/').split('?')[0],
        )
        const [folder] = path.split('/').filter(Boolean)
        const file = join(source, path)
        if (
          !folders.includes(folder) ||
          !file.startsWith(source) ||
          !wanted(file) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        )
          return next()
        response.setHeader(
          'Content-Type',
          file.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream',
        )
        createReadStream(file).pipe(response)
      })
    },
    writeBundle(options) {
      for (const folder of folders)
        cpSync(
          join(source, folder),
          join(options.dir ?? 'dist', 'pdfjs', folder),
          {
            recursive: true,
            filter: wanted,
          },
        )
    },
  }
}

// The engine for the in-browser embeddings model: its size is shown before
// it's downloaded.
const ortWasmBytes = statSync(
  resolve('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
).size

// https://vite.dev/config/
export default defineConfig({
  define: { __ORT_WASM_BYTES__: JSON.stringify(ortWasmBytes) },
  plugins: [
    react(),
    tailwindcss(),
    pdfjsResources(),
    VitePWA({
      // Our own service worker (src/sw.ts) for offline caching and reminders.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Momentum',
        short_name: 'Momentum',
        description: 'Build a daily habit, one day at a time.',
        theme_color: '#05070f',
        background_color: '#05070f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Check in for today',
            short_name: 'Check in',
            url: '/?checkin=1',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Capture to inbox',
            short_name: 'Capture',
            url: '/inbox?capture=1',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
        // Installed, Momentum appears in other apps' share menus (Android);
        // what's shared lands in the inbox.
        share_target: {
          action: '/inbox',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      injectManifest: {
        // woff2 only: every browser with service workers supports it.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,avif,woff2}'],
        // Fonts for scripts Momentum doesn't use are fetched on demand instead.
        globIgnores: [
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*',
          // AI SDKs download the first time an AI feature is used (then the
          // service worker keeps them), not on install. So does the worker
          // that runs the embeddings model on this device.
          '**/assets/ai/**',
          // So does pdf.js, the first time a PDF is added or opened, and
          // the files it reads for some PDFs.
          '**/assets/pdf/**',
          '**/pdfjs/**',
          // So do the maths fonts, the first time a note shows maths.
          '**/KaTeX_*',
        ],
        // Bundled background photos can be large.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: {
    // Module workers, so the embeddings worker can load its engine lazily.
    format: 'es',
    rolldownOptions: {
      output: {
        // With the AI SDKs (see globIgnores): only needed once it's used.
        entryFileNames: 'assets/ai/[name]-[hash].js',
        chunkFileNames: 'assets/ai/[name]-[hash].js',
        assetFileNames: (asset) =>
          asset.names.some((name) => name.startsWith('ort-wasm'))
            ? 'assets/engine/[name]-[hash][extname]'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // React and Motion change rarely. Kept apart from Momentum's own
              // code, an update downloads only the part that changed.
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|motion|motion-dom|motion-utils|framer-motion)[\\/]/,
            },
          ],
        },
        // Chunks holding the AI SDKs go in their own folder (see globIgnores).
        chunkFileNames: (chunk) => {
          if (
            chunk.moduleIds.some((id) =>
              /node_modules[\\/](openai|@anthropic-ai[\\/]sdk)[\\/]/.test(id),
            )
          )
            return 'assets/ai/[name]-[hash].js'
          // pdf.js likewise (see globIgnores).
          if (
            chunk.moduleIds.some((id) =>
              /node_modules[\\/]pdfjs-dist[\\/]/.test(id),
            )
          )
            return 'assets/pdf/[name]-[hash].js'
          // Code the bundler splits out because several chunks share it is
          // named after whichever module came first, which misleads (a "log"
          // chunk full of timer code). Call it what it is.
          if (
            !chunk.isDynamicEntry &&
            !['vendor', 'rolldown-runtime'].includes(chunk.name)
          )
            return 'assets/shared-[hash].js'
          return 'assets/[name]-[hash].js'
        },
        assetFileNames: (asset) => {
          // pdf.js's worker (imported as a URL) goes with pdf.js.
          if (asset.names.some((name) => name.startsWith('pdf.worker')))
            return 'assets/pdf/[name]-[hash][extname]'
          // The embeddings engine is kept with the model it runs (in
          // Cache Storage, by the worker), so the service worker leaves it.
          if (asset.names.some((name) => name.startsWith('ort-wasm')))
            return 'assets/engine/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  test: {
    // Run date logic in a time zone with daylight saving to catch DST bugs.
    env: { TZ: 'Australia/Sydney' },
  },
})
