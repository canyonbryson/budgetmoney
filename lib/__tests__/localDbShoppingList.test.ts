import { buildLocalShoppingListDraft } from '../localDb';

describe('buildLocalShoppingListDraft', () => {
  it('aggregates recipe ingredients by normalized name and unit kind', () => {
    const rows = buildLocalShoppingListDraft({
      planItems: [
        { id: 'a', mealPlanId: 'p', recipeId: 'r1', title: 'Meal A', day: 'Mon' },
        { id: 'b', mealPlanId: 'p', recipeId: 'r2', title: 'Meal B', day: 'Tue' },
      ],
      recipeIngredientsByRecipeId: new Map([
        ['r1', [{ id: 'i1', recipeId: 'r1', name: 'Tomato', quantity: 1, unit: 'kg' }]],
        ['r2', [{ id: 'i2', recipeId: 'r2', name: 'tomato', quantity: 500, unit: 'g' }]],
      ]),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      itemName: 'Tomato',
      quantity: 1500,
      unit: 'g',
    });
  });

  it('falls back to meal title when recipe has no ingredients', () => {
    const rows = buildLocalShoppingListDraft({
      planItems: [{ id: 'a', mealPlanId: 'p', recipeId: 'r1', title: 'Taco Night', day: 'Mon' }],
      recipeIngredientsByRecipeId: new Map(),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].itemName).toBe('Taco Night');
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].unit).toBe('ea');
  });

  it('ignores non-recipe meal types', () => {
    const rows = buildLocalShoppingListDraft({
      planItems: [
        { id: 'a', mealPlanId: 'p', title: 'Takeout', day: 'Mon', mealType: 'eatOut' },
        { id: 'b', mealPlanId: 'p', title: 'Leftovers', day: 'Tue', mealType: 'leftovers' },
      ],
      recipeIngredientsByRecipeId: new Map(),
    });

    expect(rows).toEqual([]);
  });
});
