'use strict';

module.exports = {
	preset: 'jest-preset-angular',
	setupFilesAfterEnv: ['<rootDir>/tests/setupJest.ts'],
	testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
	collectCoverage: true,
	// Tout le code applicatif, y compris les fichiers qu'aucun test n'importe (couverture réelle).
	collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.spec.ts', '!src/app/**/*.routes.ts', '!src/app/**/index.ts'],
	coverageReporters: ['html', 'text-summary', 'json-summary', 'lcov'],
	// Seuils à cliquet : relevés au niveau atteint, jamais baissés (cf. AGENTS.md). Les fichiers des dossiers listés
	// sont exclus du calcul de « global » (reste de l'application : corpus, admin, outils…).
	coverageThreshold: {
		global: {statements: 4, branches: 2, functions: 5, lines: 4},
		'./src/app/chat/': {statements: 87, branches: 79, functions: 87, lines: 88},
		'./src/app/shared/': {statements: 75, branches: 67, functions: 71, lines: 74}
	},
	// Paquets publiés en ESM uniquement (.js), importés par les composants standalone : à transpiler pour Jest.
	transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|marked/|nanoid/))']
};
