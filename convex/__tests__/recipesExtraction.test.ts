import { extractRecipeFromHtml, parseIngredientLine } from '../recipes';

describe('recipe extraction', () => {
  it('extracts recipe from JSON-LD before fallback parsing', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Test Soup",
              "recipeYield": "4 servings",
              "recipeIngredient": ["1 1/2 cups broth", "2 tbsp olive oil"],
              "recipeInstructions": [
                { "@type": "HowToStep", "text": "Heat the oil." },
                { "@type": "HowToStep", "text": "Add broth and simmer." }
              ]
            }
          </script>
        </head>
        <body><h1>Ignored title</h1></body>
      </html>
    `;

    const extracted = extractRecipeFromHtml(html);
    expect(extracted.source).toBe('jsonld');
    expect(extracted.name).toBe('Test Soup');
    expect(extracted.servings).toBe(4);
    expect(extracted.ingredientLines).toHaveLength(2);
    expect(extracted.instructionSteps).toEqual(['Heat the oil.', 'Add broth and simmer.']);
  });

  it('parses mixed fractions and ranges in ingredient lines', () => {
    expect(parseIngredientLine('1 1/2 cups flour')).toEqual({
      quantity: 1.5,
      unit: 'cup',
      name: 'flour',
    });
    expect(parseIngredientLine('1-1/2 cups flour')).toEqual({
      quantity: 1.5,
      unit: 'cup',
      name: 'flour',
    });
    expect(parseIngredientLine('3-4 cloves garlic')).toEqual({
      quantity: 3.5,
      unit: 'clove',
      name: 'garlic',
    });
    expect(parseIngredientLine('1 (14-ounce) can diced tomatoes')).toEqual({
      quantity: 1,
      unit: 'can',
      name: 'diced tomatoes',
    });
    expect(parseIngredientLine('salt and pepper to taste')).toEqual({
      name: 'salt and pepper',
    });
  });
});
