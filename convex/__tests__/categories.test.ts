import { removeCategoryForOwner, setCategoryRolloverModeForOwner } from '../categories';

describe('removeCategoryForOwner', () => {
  it('returns without error when category is missing', async () => {
    const query = jest.fn();
    const get = jest.fn().mockResolvedValue(null);
    const replace = jest.fn();
    const del = jest.fn();

    const ctx = {
      db: {
        get,
        query,
        replace,
        delete: del,
      },
    };

    await expect(
      removeCategoryForOwner(
        ctx,
        { ownerType: 'user', ownerId: 'user_1' },
        'cat_missing' as any
      )
    ).resolves.toBeNull();

    expect(query).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('returns without error when category belongs to another owner', async () => {
    const query = jest.fn();
    const get = jest.fn().mockResolvedValue({
      _id: 'cat_1',
      ownerType: 'device',
      ownerId: 'dev_1',
      isDefault: false,
    });
    const replace = jest.fn();
    const del = jest.fn();

    const ctx = {
      db: {
        get,
        query,
        replace,
        delete: del,
      },
    };

    await expect(
      removeCategoryForOwner(
        ctx,
        { ownerType: 'user', ownerId: 'user_1' },
        'cat_1' as any
      )
    ).resolves.toBeNull();

    expect(query).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes linked budgets before deleting the category', async () => {
    const childQuery = {
      filter: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const budgetQuery = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([
        { _id: 'budget_1' },
        { _id: 'budget_2' },
      ]),
    };
    const transactionQuery = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([]),
    };

    const query = jest
      .fn()
      .mockReturnValueOnce(childQuery)
      .mockReturnValueOnce(budgetQuery)
      .mockReturnValueOnce(transactionQuery);
    const get = jest.fn().mockResolvedValue({
      _id: 'cat_1',
      ownerType: 'device',
      ownerId: 'dev_1',
      isDefault: false,
    });
    const replace = jest.fn().mockResolvedValue(null);
    const del = jest.fn().mockResolvedValue(null);

    const ctx = {
      db: {
        get,
        query,
        replace,
        delete: del,
      },
    };

    await expect(
      removeCategoryForOwner(
        ctx,
        { ownerType: 'device', ownerId: 'dev_1' },
        'cat_1' as any
      )
    ).resolves.toBeNull();

    expect(del).toHaveBeenNthCalledWith(1, 'budget_1');
    expect(del).toHaveBeenNthCalledWith(2, 'budget_2');
    expect(del).toHaveBeenNthCalledWith(3, 'cat_1');
    expect(replace).not.toHaveBeenCalled();
  });

  it('uncategorizes linked transactions before deleting category', async () => {
    const childQuery = {
      filter: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const budgetQuery = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([]),
    };
    const transactionQuery = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([
        {
          _id: 'tx_1',
          _creationTime: 1,
          ownerType: 'device',
          ownerId: 'dev_1',
          name: 'Coffee',
          date: '2026-02-10',
          amount: 5,
          currency: 'USD',
          pending: false,
          categoryId: 'cat_1',
          autoCategoryId: 'cat_1',
          categorizationSource: 'manual',
          confidence: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    };

    const query = jest
      .fn()
      .mockReturnValueOnce(childQuery)
      .mockReturnValueOnce(budgetQuery)
      .mockReturnValueOnce(transactionQuery);
    const get = jest.fn().mockResolvedValue({
      _id: 'cat_1',
      ownerType: 'device',
      ownerId: 'dev_1',
      isDefault: false,
    });
    const replace = jest.fn().mockResolvedValue(null);
    const del = jest.fn().mockResolvedValue(null);

    const ctx = {
      db: {
        get,
        query,
        replace,
        delete: del,
      },
    };

    await expect(
      removeCategoryForOwner(
        ctx,
        { ownerType: 'device', ownerId: 'dev_1' },
        'cat_1' as any
      )
    ).resolves.toBeNull();

    expect(replace).toHaveBeenCalledWith(
      'tx_1',
      expect.objectContaining({
        categorizationSource: 'none',
        confidence: 0,
      })
    );
    const replacement = replace.mock.calls[0][1];
    expect(replacement).not.toHaveProperty('categoryId');
    expect(replacement).not.toHaveProperty('autoCategoryId');
    expect(del).toHaveBeenLastCalledWith('cat_1');
  });
});

describe('setCategoryRolloverModeForOwner', () => {
  it('returns without error when category is missing', async () => {
    const get = jest.fn().mockResolvedValue(null);
    const patch = jest.fn();
    const ctx = {
      db: {
        get,
        patch,
      },
    };

    await expect(
      setCategoryRolloverModeForOwner(
        ctx,
        { ownerType: 'user', ownerId: 'user_1' },
        'cat_missing' as any,
        'negative'
      )
    ).resolves.toBeNull();

    expect(patch).not.toHaveBeenCalled();
  });

  it('returns without error when category belongs to another owner', async () => {
    const get = jest.fn().mockResolvedValue({
      _id: 'cat_1',
      ownerType: 'device',
      ownerId: 'dev_1',
    });
    const patch = jest.fn();
    const ctx = {
      db: {
        get,
        patch,
      },
    };

    await expect(
      setCategoryRolloverModeForOwner(
        ctx,
        { ownerType: 'user', ownerId: 'user_1' },
        'cat_1' as any,
        'negative'
      )
    ).resolves.toBeNull();

    expect(patch).not.toHaveBeenCalled();
  });
});
