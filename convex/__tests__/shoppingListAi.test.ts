import {
  normalizeMergedShoppingListItems,
  type ShoppingListMergeItemDraft,
} from '../ai/shoppingList';

describe('normalizeMergedShoppingListItems', () => {
  it('falls back to deterministic draft when ai items are empty', () => {
    const draft: ShoppingListMergeItemDraft[] = [
      { itemName: 'Milk', quantity: 1, unit: 'gallon' },
      { itemName: 'Eggs', quantity: 12, unit: 'ea' },
    ];

    const result = normalizeMergedShoppingListItems([], draft);

    expect(result).toEqual([
      { itemName: 'Milk', quantity: 1, unit: 'gallon' },
      { itemName: 'Eggs', quantity: 12, unit: 'ea' },
    ]);
  });

  it('dedupes ai items by canonical name and unit', () => {
    const result = normalizeMergedShoppingListItems(
      [
        {
          canonical_name: 'yellow onion',
          display_name: 'Yellow Onion',
          quantity: 1,
          unit: 'lb',
          confidence: 0.9,
          source_meals: ['Mon dinner'],
        },
        {
          canonical_name: 'yellow onion',
          display_name: 'Onion',
          quantity: 2,
          unit: 'lb',
          confidence: 0.85,
          source_meals: ['Tue dinner'],
        },
      ],
      []
    );

    expect(result).toEqual([
      {
        itemName: 'Yellow Onion',
        quantity: 3,
        unit: 'lb',
      },
    ]);
  });

  it('keeps unknown quantity when ai returns null quantity', () => {
    const result = normalizeMergedShoppingListItems(
      [
        {
          canonical_name: 'salt',
          display_name: 'Salt',
          quantity: null,
          unit: null,
          confidence: 0.5,
          source_meals: ['Thu dinner'],
        },
      ],
      []
    );

    expect(result).toEqual([
      {
        itemName: 'Salt',
        quantity: undefined,
        unit: undefined,
      },
    ]);
  });
});
