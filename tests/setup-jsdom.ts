// Polyfill ResizeObserver for jsdom environment (required by Ant Design components)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe() {
      // Trigger callback with empty entries for initial render
      this.callback([], this);
    }

    unobserve() {}

    disconnect() {}
  };
}

// Polyfill window.matchMedia for jsdom (used by Ant Design responsive components)
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function createLocalStorageMock(): Storage {
  const storage = new Map<string, string>();

  return {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
  };
}

const currentLocalStorage = globalThis.localStorage;

if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof currentLocalStorage?.getItem !== 'function' ||
  typeof currentLocalStorage?.setItem !== 'function' ||
  typeof currentLocalStorage?.removeItem !== 'function' ||
  typeof currentLocalStorage?.clear !== 'function'
) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createLocalStorageMock(),
  });
}
