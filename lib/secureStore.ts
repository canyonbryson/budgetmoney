type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

const memoryStore = new Map<string, string>();

function getSecureStoreModule(): SecureStoreLike | null {
  try {
    const mod = require('expo-secure-store') as SecureStoreLike | undefined;
    if (
      mod &&
      typeof mod.getItemAsync === 'function' &&
      typeof mod.setItemAsync === 'function' &&
      typeof mod.deleteItemAsync === 'function'
    ) {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export async function secureGetItem(key: string): Promise<string | null> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    try {
      return await secureStore.getItemAsync(key);
    } catch {
      // Fall through to non-native fallback.
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to memory fallback.
    }
  }

  return memoryStore.get(key) ?? null;
}

export async function secureSetItem(key: string, value: string): Promise<void> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    try {
      await secureStore.setItemAsync(key, value);
      return;
    } catch {
      // Fall through to non-native fallback.
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // Fall through to memory fallback.
    }
  }

  memoryStore.set(key, value);
}

export async function secureDeleteItem(key: string): Promise<void> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    try {
      await secureStore.deleteItemAsync(key);
    } catch {
      // Ignore and continue with fallbacks.
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore and continue with memory fallback.
    }
  }

  memoryStore.delete(key);
}
