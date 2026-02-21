import * as React from 'react';
import renderer from 'react-test-renderer';

import NetWorthScreen from '../(screens)/net-worth';

const mockUseQuery = jest.fn();

jest.mock('convex/react', () => ({
  useMutation: () => jest.fn(),
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

jest.mock('@/contexts/IdentityContext', () => ({
  useIdentity: () => ({
    owner: { ownerType: 'device', ownerId: 'device-test' },
    isReady: true,
    isSignedIn: true,
  }),
}));

jest.mock('@/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#222',
      text: '#111',
      textMuted: '#666',
      textSecondary: '#888',
      border: '#ddd',
      borderLight: '#eee',
      background: '#fff',
      backgroundCard: '#fff',
    },
    spacing: { lg: 16, md: 12, sm: 8, xs: 4 },
    borderRadius: { lg: 12, md: 10, sm: 8 },
    shadows: { sm: {}, md: {} },
    typography: {
      title: {},
      subtitle: {},
      caption: {},
      body: { fontFamily: 'System', fontWeight: '400', fontSize: 16 },
      bodySemiBold: { fontFamily: 'System', fontWeight: '600', fontSize: 16 },
    },
  }),
}));

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseQuery
    .mockReturnValueOnce({
      netWorthTotal: 1000,
      assetsTotal: 1200,
      liabilitiesTotal: 200,
      checkingTotal: 500,
      savingsTotal: 300,
      investmentTotal: 400,
    })
    .mockReturnValueOnce({ points: [{ asOfDate: '2026-02-01', netWorthTotal: 900, assetsTotal: 1100, liabilitiesTotal: 200 }] })
    .mockReturnValueOnce({ points: [{ asOfDate: '2026-03-01', monthIndex: 1, netWorthTotal: 1050 }] })
    .mockReturnValueOnce([]);
});

it('renders net worth screen without crashing', () => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(<NetWorthScreen />);
  });
  expect(tree!.toJSON()).toBeTruthy();
});
