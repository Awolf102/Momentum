import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
          // service worker keeps them), not on install.
          '**/assets/ai/**',
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
      },
    },
  },
  test: {
    // Run date logic in a time zone with daylight saving to catch DST bugs.
    env: { TZ: 'Australia/Sydney' },
  },
})
