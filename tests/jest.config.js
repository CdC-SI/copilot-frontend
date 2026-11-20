'use strict';

module.exports = {
	preset: 'jest-preset-angular',
	setupFilesAfterEnv: ['<rootDir>/tests/setupJest.ts'],
	collectCoverage: true,
	// Paquets publiés en ESM uniquement (.js), importés par les composants standalone : à transpiler pour Jest.
	transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|marked/|nanoid/))']
};
