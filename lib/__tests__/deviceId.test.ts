import { getOrCreateDeviceId } from '../deviceId';

jest.mock('../secureStore', () => ({
  secureGetItem: jest.fn(),
  secureSetItem: jest.fn(),
}));

const SecureStore = jest.requireMock('../secureStore') as {
  secureGetItem: jest.Mock;
  secureSetItem: jest.Mock;
};

const DEVICE_ID_KEY = 'grocerybudget.deviceId';

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
    SecureStore.secureGetItem.mockReset();
    SecureStore.secureSetItem.mockReset();
    Object.defineProperty(global, 'localStorage', {
      value: createLocalStorage(),
      configurable: true,
    });
  });

  it('returns the secure store device id when available', async () => {
    SecureStore.secureGetItem.mockResolvedValue('secure-id');

    const value = await getOrCreateDeviceId();

    expect(value).toBe('secure-id');
    expect(global.localStorage.getItem).not.toHaveBeenCalled();
  });

  it('falls back to localStorage when SecureStore errors', async () => {
    SecureStore.secureGetItem.mockRejectedValue(new Error('no secure store'));
    global.localStorage.setItem(DEVICE_ID_KEY, 'local-id');

    const value = await getOrCreateDeviceId();

    expect(value).toBe('local-id');
  });

  it('generates and stores an id when missing', async () => {
    SecureStore.secureGetItem.mockResolvedValue(null);
    SecureStore.secureSetItem.mockResolvedValue(undefined);

    const value = await getOrCreateDeviceId();

    expect(value).toMatch(/^dev_/);
    expect(SecureStore.secureSetItem).toHaveBeenCalledWith(DEVICE_ID_KEY, value);
  });
});
