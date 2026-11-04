// Copies Vite's built index.html into subscription/www/subscriptions.html
// so Frappe serves it at /subscriptions with Jinja CSRF boot context.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const src = '../subscription/public/frontend/index.html'
const dest = '../subscription/www/subscriptions.html'
mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`copied index.html -> ${dest}`)

