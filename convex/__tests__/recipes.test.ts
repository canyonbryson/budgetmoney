import { buildIngredientLookupQueries } from '../recipes';

describe('buildIngredientLookupQueries', () => {
  it('strips prep notes and keeps useful lookup variants', () => {
    const queries = buildIngredientLookupQueries('garlic; finely minced');
    expect(queries).toContain('garlic; finely minced');
    expect(queries).toContain('garlic');
  });

  it('removes parenthetical notes from lookup candidates', () => {
    const queries = buildIngredientLookupQueries('chicken broth (I use low sodium)');
    expect(queries).toContain('chicken broth (I use low sodium)');
    expect(queries).toContain('chicken broth');
  });
});
