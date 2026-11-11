import { defineConfig } from '@playwright/test'

// Runs the real game in a browser (Vite dev server: it exposes window.__game).
// Uses the installed Edge so no browser download is needed. `npm run test:e2e:headed` to watch it.
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'msedge',
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0), args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort --mode development',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
