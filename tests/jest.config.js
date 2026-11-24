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
	// sont exclus du calcul de « global » (reste de l'application : outils, astuces, enveloppe…).
	coverageThreshold: {
		global: {statements: 12, branches: 21, functions: 13, lines: 12},
		'./src/app/chat/': {statements: 98, branches: 91, functions: 98, lines: 99},
		'./src/app/shared/': {statements: 97, branches: 90, functions: 96, lines: 98},
		'./src/app/admin/': {statements: 99, branches: 90, functions: 99, lines: 99},
		'./src/app/corpus/': {statements: 99, branches: 96, functions: 99, lines: 99},
		'./src/app/core/': {statements: 100, branches: 100, functions: 100, lines: 100}
	},
	// Paquets publiés en ESM uniquement (.js), importés par les composants standalone : à transpiler pour Jest.
	transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|marked/|nanoid/))']
};
