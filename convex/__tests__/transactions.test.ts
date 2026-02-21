import { buildCategoryScope } from '../transactions';

describe('buildCategoryScope', () => {
  it('includes selected category and all descendants', () => {
    const rootId = 'cat_root' as any;
    const childId = 'cat_child' as any;
    const grandchildId = 'cat_grandchild' as any;
    const unrelatedId = 'cat_other' as any;

    const categoryIds = buildCategoryScope(
      [
        { _id: rootId, parentId: undefined },
        { _id: childId, parentId: rootId },
        { _id: grandchildId, parentId: childId },
        { _id: unrelatedId, parentId: undefined },
      ] as any,
      rootId
    );

    expect(categoryIds.has(rootId)).toBe(true);
    expect(categoryIds.has(childId)).toBe(true);
    expect(categoryIds.has(grandchildId)).toBe(true);
    expect(categoryIds.has(unrelatedId)).toBe(false);
  });
});
