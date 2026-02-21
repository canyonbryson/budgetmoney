import { secureGetItem, secureSetItem } from '@/lib/secureStore';

const DEVICE_ID_KEY = 'grocerybudget.deviceId';
let memoryDeviceId: string | null = null;

function generateId() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await safeSecureGet();
  if (existing) return existing;

  const local = readLocalStorage();
  if (local) return local;

  if (memoryDeviceId) return memoryDeviceId;

  const next = generateId();
  memoryDeviceId = next;
  const stored = await safeSecureSet(next);
  if (!stored) {
    writeLocalStorage(next);
  }
  return next;
}

export async function getDeviceId(): Promise<string | null> {
  const existing = await safeSecureGet();
  if (existing) return existing;
  const local = readLocalStorage();
  if (local) return local;
  return memoryDeviceId;
}

async function safeSecureGet(): Promise<string | null> {
  try {
    return await secureGetItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

async function safeSecureSet(value: string): Promise<boolean> {
  try {
    await secureSetItem(DEVICE_ID_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function readLocalStorage(): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

function writeLocalStorage(value: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(DEVICE_ID_KEY, value);
    return true;
  } catch {
    return false;
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

