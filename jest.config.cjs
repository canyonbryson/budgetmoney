const base = require('@injured/test/node');
module.exports = {
  ...base,
  collectCoverage: true,
  collectCoverageFrom: [
    'constants/**/*.ts',
    '!**/__tests__/**',
    '!components/ui/ParallaxScrollView.tsx',
  ],
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};


