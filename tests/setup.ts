// Jest test setup
// Mock DOM APIs and Chrome extension APIs for testing

// Mock chrome extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
} as any;

// Mock window.performance if not available
if (!global.performance) {
  global.performance = {
    now: jest.fn(() => Date.now()),
  } as any;
}

// Mock console methods to reduce noise in tests
console.error = jest.fn();
console.warn = jest.fn();
