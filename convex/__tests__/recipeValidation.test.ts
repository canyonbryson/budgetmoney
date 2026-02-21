import {
  normalizeRecipeIngredientsForSave,
  parseIngredientAmount,
  splitInstructionSteps,
} from '../lib/recipeValidation';

describe('recipe validation helpers', () => {
  it('parses decimal and fractional ingredient amounts', () => {
    expect(parseIngredientAmount('2')).toBe(2);
    expect(parseIngredientAmount('1/2')).toBe(0.5);
    expect(parseIngredientAmount('1 1/2')).toBe(1.5);
    expect(parseIngredientAmount('abc')).toBeUndefined();
  });

  it('marks missing amounts when required', () => {
    const result = normalizeRecipeIngredientsForSave(
      [
        { name: 'Flour', quantity: '2', unit: 'cups' },
        { name: 'Salt', quantity: '', unit: 'tsp' },
      ],
      { requireAmount: true }
    );

    expect(result.ingredients).toHaveLength(2);
    expect(result.missingAmountIndexes).toEqual([1]);
    expect(result.blankNameIndexes).toEqual([]);
  });

  it('splits instructions into readable steps', () => {
    const steps = splitInstructionSteps('1. Mix flour and salt.\n2. Add water and stir.\n3. Bake.');
    expect(steps).toEqual(['Mix flour and salt.', 'Add water and stir.', 'Bake.']);
  });
});
