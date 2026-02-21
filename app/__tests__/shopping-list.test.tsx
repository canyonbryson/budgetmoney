import * as React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import ShoppingListScreen from '../(screens)/shopping-list';

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseAction = jest.fn();
const mockSetChecked = jest.fn().mockResolvedValue(null);
const mockMoveToPantry = jest.fn().mockResolvedValue(null);
const mockAddRemoteItem = jest.fn().mockResolvedValue(null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}));

jest.mock('convex/react', () => ({
  useAction: (...args: any[]) => mockUseAction(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ language: 'en' }),
}));

jest.mock('@/contexts/IdentityContext', () => ({
  useIdentity: () => ({
    owner: { ownerType: 'device', ownerId: 'device-test' },
    isReady: true,
    isSignedIn: true,
    entitlements: { canUseAi: true },
  }),
}));

jest.mock('@/contexts/LocalDbContext', () => ({
  useLocalDb: () => ({ bumpRefresh: jest.fn() }),
}));

jest.mock('@/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#222',
      primaryMuted: '#eee',
      text: '#111',
      textMuted: '#666',
      border: '#ddd',
      borderLight: '#eee',
      error: '#a00',
    },
    spacing: { lg: 16, md: 12, sm: 8, xs: 4 },
    borderRadius: { sm: 8, md: 10, pill: 999 },
    shadows: { sm: {}, md: {} },
    typography: {
      caption: {},
      label: {},
      bodySemiBold: { fontFamily: 'System', fontWeight: '600', fontSize: 16 },
    },
  }),
}));

jest.mock('@/hooks/useLocalQuery', () => ({
  useLocalQuery: () => ({ data: null, loading: false, error: null }),
}));

jest.mock('@/lib/localDb', () => ({
  addShoppingListItem: jest.fn(),
  deleteShoppingListItem: jest.fn(),
  generateShoppingListForWeek: jest.fn(),
  getShoppingListForWeek: jest.fn(),
  moveShoppingListItemToPantry: jest.fn(),
  setShoppingListItemChecked: jest.fn(),
  updateShoppingListItem: jest.fn(),
}));

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockUseAction.mockReset();
  mockSetChecked.mockClear();
  mockMoveToPantry.mockClear();
  mockAddRemoteItem.mockClear();

  mockUseQuery.mockReturnValue({
    items: [
      {
        _id: 'item_1',
        itemName: 'Milk',
        quantity: 1,
        unit: 'ea',
        estimatedCost: 2.5,
        isChecked: true,
        coverage: 'none',
      },
    ],
    totalEstimatedCost: 2.5,
  });

  let mutationCallIndex = 0;
  const mutationFns = [mockAddRemoteItem, jest.fn(), jest.fn(), mockSetChecked, mockMoveToPantry];
  mockUseMutation.mockImplementation(() => {
    const fn = mutationFns[mutationCallIndex % mutationFns.length];
    mutationCallIndex += 1;
    return fn;
  });
  mockUseAction.mockReturnValue(jest.fn());
});

describe('ShoppingListScreen', () => {
  it('shows filtered-empty message when query has no matches', () => {
    const { getByPlaceholderText, getByText } = render(<ShoppingListScreen />);

    fireEvent.changeText(getByPlaceholderText('Search'), 'does-not-match');

    expect(getByText('No items match your search or filters.')).toBeTruthy();
  });

  it('does not toggle checked state when tapping move-to-pantry button', async () => {
    const { getByText } = render(<ShoppingListScreen />);

    fireEvent.press(getByText('Checked'));
    fireEvent.press(getByText('Move to pantry').parent as any);

    expect(mockMoveToPantry).toHaveBeenCalledTimes(1);
    expect(mockSetChecked).not.toHaveBeenCalled();
  });
});
