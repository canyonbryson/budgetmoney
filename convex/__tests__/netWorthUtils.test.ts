import {
  defaultIncludeInBudget,
  inferNetWorthRole,
  resolveIncludeInBudget,
  resolveIncludeInNetWorth,
} from '../netWorthUtils';

describe('netWorthUtils', () => {
  it('infers role from plaid type/subtype', () => {
    expect(inferNetWorthRole('depository', 'checking')).toBe('checking');
    expect(inferNetWorthRole('depository', 'savings')).toBe('savings');
    expect(inferNetWorthRole('investment', null)).toBe('investment');
    expect(inferNetWorthRole('credit', 'credit card')).toBe('liability');
    expect(inferNetWorthRole(undefined, undefined)).toBe('checking');
  });

  it('derives budget inclusion defaults from role', () => {
    expect(defaultIncludeInBudget('checking')).toBe(true);
    expect(defaultIncludeInBudget('savings')).toBe(false);
    expect(defaultIncludeInBudget('investment')).toBe(false);
    expect(defaultIncludeInBudget('liability')).toBe(false);
  });

  it('resolves inclusion flags using explicit overrides first', () => {
    expect(resolveIncludeInBudget({ includeInBudget: true, netWorthRole: 'liability' })).toBe(true);
    expect(resolveIncludeInBudget({ includeInBudget: false, netWorthRole: 'checking' })).toBe(false);
    expect(resolveIncludeInBudget({ netWorthRole: 'checking' })).toBe(true);
    expect(resolveIncludeInBudget({ type: 'credit', subtype: 'credit card' })).toBe(false);

    expect(resolveIncludeInNetWorth({ includeInNetWorth: true })).toBe(true);
    expect(resolveIncludeInNetWorth({ includeInNetWorth: false })).toBe(false);
    expect(resolveIncludeInNetWorth({})).toBe(true);
  });
});
