import { getOrCreateDeviceId } from '../deviceId';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const SecureStore = jest.requireMock('expo-secure-store') as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
};

const DEVICE_ID_KEY = 'grocerybudget:deviceId';

function createLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => (key in store ? store[key] : null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
}

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    SecureStore.getItemAsync.mockReset();
    SecureStore.setItemAsync.mockReset();
    Object.defineProperty(global, 'localStorage', {
      value: createLocalStorage(),
      configurable: true,
    });
  });

  it('returns the secure store device id when available', async () => {
    SecureStore.getItemAsync.mockResolvedValue('secure-id');

    const value = await getOrCreateDeviceId();

    expect(value).toBe('secure-id');
    expect(global.localStorage.getItem).not.toHaveBeenCalled();
  });

  it('falls back to localStorage when SecureStore errors', async () => {
    SecureStore.getItemAsync.mockRejectedValue(new Error('no secure store'));
    global.localStorage.setItem(DEVICE_ID_KEY, 'local-id');

    const value = await getOrCreateDeviceId();

    expect(value).toBe('local-id');
  });

  it('generates and stores an id when missing', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockRejectedValue(new Error('write failed'));

    const value = await getOrCreateDeviceId();

    expect(value).toMatch(/^dev_/);
    expect(global.localStorage.setItem).toHaveBeenCalledWith(DEVICE_ID_KEY, value);
  });
});
