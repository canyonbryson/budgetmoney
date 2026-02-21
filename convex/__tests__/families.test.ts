import { buildInviteUrl, normalizeEmail } from '../families';
import { OWNER_SCOPED_TABLES } from '../familyMigration';

describe('normalizeEmail', () => {
  it('normalizes and trims email addresses', () => {
    expect(normalizeEmail('  USER@Example.Com ')).toBe('user@example.com');
  });

  it('returns undefined for empty values', () => {
    expect(normalizeEmail('   ')).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});

describe('buildInviteUrl', () => {
  it('builds a deep link path for invite acceptance', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'budgetmoney://';
    expect(buildInviteUrl('abc123')).toBe('budgetmoney:///family-accept/abc123');
  });

  it('builds a web URL path for invite acceptance', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://app.budgetmoney.test/';
    expect(buildInviteUrl('abc123')).toBe('https://app.budgetmoney.test/family-accept/abc123');
  });
});

describe('OWNER_SCOPED_TABLES', () => {
  it('includes critical financial tables for migration', () => {
    expect(OWNER_SCOPED_TABLES).toEqual(
      expect.arrayContaining([
        'budgets',
        'transactions',
        'mealPlans',
        'recipes',
        'receipts',
        'netWorthBuckets',
        'netWorthSnapshots',
        'budgetCycleSnapshots',
        'budgetCategoryCycleSnapshots',
      ])
    );
  });
});
