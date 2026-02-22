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
      { itemName: 'milk', quantity: 1, unit: 'gallon' },
      { itemName: 'egg', quantity: 12, unit: 'ea' },
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
        itemName: 'yellow onion',
        quantity: 3,
        unit: 'lb',
      },
    ]);
  });

  it('merges similar count units into one canonical item', () => {
    const result = normalizeMergedShoppingListItems(
      [
        {
          canonical_name: 'onion',
          display_name: 'small onion (, finely diced (about 1 cup))',
          quantity: 1,
          unit: 'ea',
          confidence: 0.9,
          source_meals: ['Mon dinner'],
        },
        {
          canonical_name: 'onions',
          display_name: 'yellow onions',
          quantity: 2,
          unit: 'count',
          confidence: 0.8,
          source_meals: ['Tue dinner'],
        },
      ],
      []
    );

    expect(result).toEqual([
      {
        itemName: 'onion',
        quantity: 3,
        unit: 'ea',
      },
    ]);
  });

  it('cleans malformed ingredient labels from parser noise', () => {
    const result = normalizeMergedShoppingListItems(
      [
        {
          canonical_name: 'diced tomatoes',
          display_name: 'cans diced tomatoes (, with the juice)',
          quantity: 2,
          unit: 'can',
          confidence: 0.9,
          source_meals: ['Mon dinner'],
        },
        {
          canonical_name: 'carrot',
          display_name: 'carrots (, finely diced (about 1 cup))',
          quantity: 2,
          unit: 'ea',
          confidence: 0.9,
          source_meals: ['Mon dinner'],
        },
      ],
      []
    );

    expect(result).toEqual([
      {
        itemName: 'diced tomatoes',
        quantity: 2,
        unit: 'can',
      },
      {
        itemName: 'carrot',
        quantity: 2,
        unit: 'ea',
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
        itemName: 'salt',
        quantity: undefined,
        unit: undefined,
      },
    ]);
  });
});
