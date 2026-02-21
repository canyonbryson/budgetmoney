import { RECIPE_SCHEMA } from '../recipes';

describe('recipe parse schema', () => {
  it('declares strict required keys for OpenAI structured outputs', () => {
    const schema = RECIPE_SCHEMA as any;
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'name',
        'servings',
        'instructions',
        'ingredients',
        'price_per_serving',
        'notes',
        'tags',
        'confidence',
      ])
    );
    const ingredientItem = schema.properties.ingredients.items;
    expect(ingredientItem.required).toEqual(
      expect.arrayContaining(['name', 'quantity', 'unit', 'confidence', 'canonical_name'])
    );
  });
});
