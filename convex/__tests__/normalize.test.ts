import { normalizeItemName } from '../lib/normalize';

describe('normalizeItemName', () => {
  it('normalizes garlic variants to one canonical key', () => {
    expect(normalizeItemName('garlic')).toBe('garlic');
    expect(normalizeItemName('garlic cloves')).toBe('garlic');
    expect(normalizeItemName('2 cloves garlic')).toBe('garlic');
  });

  it('normalizes simple plural nouns', () => {
    expect(normalizeItemName('tomatoes')).toBe('tomato');
    expect(normalizeItemName('onions')).toBe('onion');
  });
});
