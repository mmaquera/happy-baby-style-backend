module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@graphql/(.*)$': '<rootDir>/src/graphql/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@hbs/shared-kernel$': '<rootDir>/../../libs/shared-kernel/src/index',
    '^@hbs/logging$': '<rootDir>/../../libs/logging/src/index',
    '^@hbs/prisma$': '<rootDir>/../../libs/prisma/src/index',
    '^@hbs/auth$': '<rootDir>/../../libs/auth/src/index'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
}; 