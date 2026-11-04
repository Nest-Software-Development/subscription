import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Frappe serves <app>/public at /assets/subscription/, while the SPA is routed at /subscriptions.
const BASE = '/assets/subscription/frontend/'
const ICONS = '/assets/subscription/manifest'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [
    vue({ template: { transformAssetUrls: false } }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ['**/*.{js,css,woff2,png,svg}'],
        globIgnores: ['**/index.html'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        modifyURLPrefix: { '': BASE },
      },
      manifest: {
        id: '/subscriptions',
        name: 'Subscription — Recurring Revenue & Vendor Manager',
        short_name: 'Subscription',
        description:
          'Manage client & vendor subscriptions, multi-client cost allocation, wallets, and renewal push alerts on ERPNext.',
        start_url: '/subscriptions',
        scope: '/subscriptions',
        display: 'standalone',
        orientation: 'any',
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        background_color: '#0B1220',
        theme_color: '#0B1220',
        lang: 'en',
        dir: 'auto',
        categories: ['finance', 'business', 'productivity'],
        icons: [
          { src: `${ICONS}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${ICONS}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${ICONS}/icon-192.maskable.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${ICONS}/icon-512.maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: `${ICONS}/monochrome-512.png`, sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
        screenshots: [
          {
            src: `${ICONS}/screenshots/narrow-pulse.png`,
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Pulse: MRR, net profit margin, and upcoming renewals',
          },
          {
            src: `${ICONS}/screenshots/narrow-subs.png`,
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Client & Vendor Subscriptions with multi-client cost linking',
          },
          {
            src: `${ICONS}/screenshots/narrow-alerts.png`,
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Push Notification permissions, email templates & wallets',
          },
          {
            src: `${ICONS}/screenshots/wide-dashboard.png`,
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Subscription Manager adaptive tablet & desktop view',
          },
        ],
        shortcuts: [
          {
            name: 'Due Soon & Pulse',
            short_name: 'Pulse',
            url: '/subscriptions',
            icons: [{ src: `${ICONS}/icon-96.png`, sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'All Subscriptions',
            short_name: 'Subs',
            url: '/subscriptions/list',
            icons: [{ src: `${ICONS}/icon-96.png`, sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Renewal Alerts',
            short_name: 'Alerts',
            url: '/subscriptions/alerts',
            icons: [{ src: `${ICONS}/icon-96.png`, sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 8085, proxy: getProxyOptions(), allowedHosts: true },
  build: {
    outDir: '../subscription/public/frontend',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
}))

function getProxyOptions() {
  const config = getCommonSiteConfig()
  const port = config?.webserver_port || 8000
  return {
    '^/(app|desk|login|api|assets|files|private)': {
      target: `http://127.0.0.1:${port}`,
      ws: true,
      router: (req) => `http://${req.headers.host.split(':')[0]}:${port}`,
    },
  }
}

function getCommonSiteConfig() {
  let dir = path.resolve('.')
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'sites')) && fs.existsSync(path.join(dir, 'apps'))) {
      const p = path.join(dir, 'sites', 'common_site_config.json')
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null
    }
    dir = path.dirname(dir)
  }
  return null
}

