import * as React from 'react';
import renderer from 'react-test-renderer';

import HistoryScreen from '../(tabs)/history';

jest.mock('convex/react', () => ({
  useMutation: () => jest.fn().mockResolvedValue(null),
  useQuery: () => ({ items: [] }),
}));

jest.mock('@/contexts/IdentityContext', () => ({
  useIdentity: () => ({
    owner: { ownerType: 'device', ownerId: 'device-test' },
    isReady: true,
    isSignedIn: false,
  }),
}));

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ language: 'en' }),
}));

jest.mock('@/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#222',
      textMuted: '#666',
      success: '#0a0',
      error: '#a00',
      borderLight: '#ccc',
    },
    spacing: { lg: 16, md: 12, sm: 8 },
    shadows: {
      sm: {},
      md: {},
    },
    typography: {
      caption: {},
      body: {},
      bodySemiBold: {},
      label: {},
    },
    borderRadius: { sm: 8 },
  }),
}));

jest.mock('@/hooks/useLocalQuery', () => ({
  useLocalQuery: () => ({ data: { items: [] }, error: null, loading: false }),
}));

jest.mock('@/lib/localDb', () => ({
  ensureHistorySnapshots: jest.fn().mockResolvedValue(null),
  getHistoryCycleDetails: jest.fn().mockResolvedValue({ cycle: null, categories: [] }),
  listHistoryCycles: jest.fn().mockResolvedValue({ items: [] }),
}));

it('renders history tab without crashing', () => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(<HistoryScreen />);
  });
  expect(tree!.toJSON()).toBeTruthy();
});
