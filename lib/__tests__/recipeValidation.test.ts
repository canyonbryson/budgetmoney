import { normalizeRecipeIngredientsForSave } from '../../convex/lib/recipeValidation';

describe('local recipe ingredient validation', () => {
  it('requires an amount for every named ingredient', () => {
    const result = normalizeRecipeIngredientsForSave(
      [
        { name: 'Eggs', quantity: '2', unit: 'ea' },
        { name: 'Milk', quantity: '', unit: 'cup' },
      ],
      { requireAmount: true }
    );

    expect(result.missingAmountIndexes).toEqual([1]);
  });
});
