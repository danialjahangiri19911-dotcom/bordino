import nextJest from 'next/jest'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  // The tsconfig path aliases (next/jest does not read them).
  moduleNameMapper: {
    '^@/public/(.*)$': '<rootDir>/public/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@libs/(.*)$': '<rootDir>/src/libs/$1',
    '^@pages/(.*)$': '<rootDir>/src/_pages/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
