import { computeAmountMatchScore } from '../receipts';

describe('computeAmountMatchScore', () => {
  it('defaults to neutral score without receipt amount', () => {
    expect(computeAmountMatchScore(42)).toEqual({
      amountDiff: null,
      amountPct: null,
      amountScore: 0.4,
    });
  });

  it('scores close matches strongly', () => {
    const result = computeAmountMatchScore(99.6, 100);
    expect(result.amountDiff).toBeCloseTo(0.4, 6);
    expect(result.amountPct).toBeCloseTo(0.004, 6);
    expect(result.amountScore).toBe(1);
  });
});
