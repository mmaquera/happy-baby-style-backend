module.exports = {
  displayName: 'authz',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@hbs/auth$': '<rootDir>/../../libs/auth/src/index.ts',
  },
};
