import {
  getDeviceOnboardingStatusForOwner,
  markDeviceOnboardingCompleteForOwner,
} from '../devices';

describe('getDeviceOnboardingStatusForOwner', () => {
  it('returns incomplete when there is no device row', async () => {
    const devicesQueryMock = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const emptyOwnerDataQuery = {
      withIndex: jest.fn().mockReturnThis(),
      take: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      db: {
        query: jest.fn().mockImplementation((table: string) => {
          if (table === 'devices') return devicesQueryMock;
          return emptyOwnerDataQuery;
        }),
      },
    };

    await expect(
      getDeviceOnboardingStatusForOwner(ctx, {
        ownerType: 'device',
        ownerId: 'dev_1',
      })
    ).resolves.toEqual({
      completed: false,
      onboardingCompletedAt: null,
    });
  });

  it('returns complete for owner when devices row exists under by_ownerType_ownerId', async () => {
    const queryByOwnerMock = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        _id: 'device_row_user_1',
        ownerType: 'user',
        ownerId: 'user_1',
        onboardingCompletedAt: 1771000000000,
      }),
    };
    const ctx = {
      db: {
        query: jest.fn().mockImplementation((table: string) => {
          if (table === 'devices') return queryByOwnerMock;
          throw new Error(`Unexpected table ${table}`);
        }),
      },
    };

    await expect(
      getDeviceOnboardingStatusForOwner(ctx, {
        ownerType: 'user',
        ownerId: 'user_1',
      })
    ).resolves.toEqual({
      completed: true,
      onboardingCompletedAt: 1771000000000,
    });
  });

  it('returns complete when no devices row exists but owner already has app data', async () => {
    const devicesQuery = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const ownerDataQuery = {
      withIndex: jest.fn().mockReturnThis(),
      take: jest.fn().mockResolvedValue([{ _id: 'existing_budget' }]),
    };
    const emptyOwnerDataQuery = {
      withIndex: jest.fn().mockReturnThis(),
      take: jest.fn().mockResolvedValue([]),
    };
    const ctx = {
      db: {
        query: jest.fn().mockImplementation((table: string) => {
          if (table === 'devices') return devicesQuery;
          if (table === 'budgets') return ownerDataQuery;
          if (table === 'transactions') return emptyOwnerDataQuery;
          if (table === 'recipes') return emptyOwnerDataQuery;
          if (table === 'mealPlans') return emptyOwnerDataQuery;
          if (table === 'plaidItems') return emptyOwnerDataQuery;
          return emptyOwnerDataQuery;
        }),
      },
    };

    await expect(
      getDeviceOnboardingStatusForOwner(ctx, {
        ownerType: 'device',
        ownerId: 'dev_1',
      })
    ).resolves.toEqual({
      completed: true,
      onboardingCompletedAt: null,
    });
  });
});

describe('markDeviceOnboardingCompleteForOwner', () => {
  it('inserts a new devices row when missing', async () => {
    const devicesQueryMock = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const categoriesQueryMock = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([]),
    };
    const insert = jest.fn().mockResolvedValue('device_row_1');
    const patch = jest.fn();
    const ctx = {
      db: {
        query: jest.fn().mockImplementation((table: string) => {
          if (table === 'devices') return devicesQueryMock;
          if (table === 'categories') return categoriesQueryMock;
          throw new Error(`Unexpected table ${table}`);
        }),
        insert,
        patch,
      },
    };
    const now = 1771000000000;

    await expect(
      markDeviceOnboardingCompleteForOwner(
        ctx,
        { ownerType: 'device', ownerId: 'dev_1' },
        now
      )
    ).resolves.toBeNull();

    expect(insert).toHaveBeenCalledWith('devices', {
      deviceId: 'dev_1',
      ownerType: 'device',
      ownerId: 'dev_1',
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(insert).toHaveBeenCalledWith(
      'categories',
      expect.objectContaining({
        ownerType: 'device',
        ownerId: 'dev_1',
        name: 'Income',
        categoryKind: 'income',
      })
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('patches existing row on repeated completion (idempotent)', async () => {
    const devicesQueryMock = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        _id: 'existing_device_row',
        deviceId: 'dev_1',
      }),
    };
    const categoriesQueryMock = {
      filter: jest.fn().mockReturnThis(),
      collect: jest.fn().mockResolvedValue([]),
    };
    const patch = jest.fn().mockResolvedValue(null);
    const insert = jest.fn();
    const ctx = {
      db: {
        query: jest.fn().mockImplementation((table: string) => {
          if (table === 'devices') return devicesQueryMock;
          if (table === 'categories') return categoriesQueryMock;
          throw new Error(`Unexpected table ${table}`);
        }),
        patch,
        insert,
      },
    };
    const now = 1771000000000;

    await expect(
      markDeviceOnboardingCompleteForOwner(
        ctx,
        { ownerType: 'device', ownerId: 'dev_1' },
        now
      )
    ).resolves.toBeNull();

    expect(patch).toHaveBeenCalledWith('existing_device_row', {
      onboardingCompletedAt: now,
      updatedAt: now,
    });
    expect(insert).toHaveBeenCalledWith(
      'categories',
      expect.objectContaining({
        ownerType: 'device',
        ownerId: 'dev_1',
        name: 'Income',
        categoryKind: 'income',
      })
    );
  });
});
