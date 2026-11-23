import {defineConfig, devices} from '@playwright/test';

/**
 * Parcours e2e (FE5) : l'application tourne avec `ng serve` et le backend est simulé par `page.route`
 * (cf. `e2e/support/mock-backend.ts`) ; aucun backend réel n'est requis.
 *
 * Navigateur : Edge installé sur le poste (`channel: 'msedge'`), le téléchargement des navigateurs Playwright étant
 * bloqué sur le réseau interne. `E2E_CHANNEL=chromium` utilise le Chromium de Playwright (`npx playwright install`).
 */
const port = Number(process.env['E2E_PORT'] ?? 4300);
const channel = process.env['E2E_CHANNEL'] ?? 'msedge';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	// `ng serve` compile à la demande : trop de pages simultanées sur un serveur froid font échouer les navigations.
	workers: 3,
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: [['list'], ['html', {open: 'never'}]],
	timeout: 30_000,
	expect: {timeout: 10_000},
	use: {
		baseURL: `http://localhost:${port}`,
		locale: 'fr-CH',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		// Tout le trafic est local (application et backend simulé) : sans proxy, le proxy système du poste pouvant
		// ne pas exclure localhost (pages bloquées au chargement).
		launchOptions: {args: ['--no-proxy-server']}
	},
	projects: [
		{
			name: 'desktop',
			use: {...devices['Desktop Chrome'], channel: channel === 'chromium' ? undefined : channel}
		}
	],
	webServer: {
		command: `npx ng serve --configuration development --port ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env['CI'],
		timeout: 180_000
	}
});
