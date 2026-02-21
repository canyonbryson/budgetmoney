import { applyCarryoverToCategoryRows, computeCarryoverOut, computeOverUnderBase } from '../history';

describe('history carryover math', () => {
  it('applies rollover mode rules to period remainder', () => {
    expect(computeCarryoverOut('none', 120)).toBe(0);
    expect(computeCarryoverOut('positive', 120)).toBe(120);
    expect(computeCarryoverOut('positive', -80)).toBe(0);
    expect(computeCarryoverOut('negative', -80)).toBe(-80);
    expect(computeCarryoverOut('negative', 120)).toBe(0);
    expect(computeCarryoverOut('both', 120)).toBe(120);
    expect(computeCarryoverOut('both', -80)).toBe(-80);
  });

  it('computes over/under from base budget only', () => {
    expect(computeOverUnderBase(1000, 900)).toBe(100);
    expect(computeOverUnderBase(1000, 1200)).toBe(-200);
  });

  it('accumulates carryover cycle to cycle', () => {
    const first = computeCarryoverOut('both', 150);
    const second = computeCarryoverOut('both', -40);
    const third = computeCarryoverOut('none', 99);
    const running = [first, second, third].reduce((sum, next) => sum + next, 0);
    expect(running).toBe(110);
  });

  it('recomputes carryover fields from prior cycle totals', () => {
    const result = applyCarryoverToCategoryRows(
      [
        { categoryId: 'a', carryoverOut: 20 },
        { categoryId: 'b', carryoverOut: -10 },
      ],
      new Map([
        ['a', 5],
        ['b', -2],
      ])
    );

    expect(result.rows).toEqual([
      { categoryId: 'a', carryoverOut: 20, carryoverAppliedIn: 5, carryoverRunningTotal: 25 },
      { categoryId: 'b', carryoverOut: -10, carryoverAppliedIn: -2, carryoverRunningTotal: -12 },
    ]);
    expect(result.carryoverPositiveTotal).toBe(25);
    expect(result.carryoverNegativeTotal).toBe(-12);
    expect(result.carryoverNetTotal).toBe(13);
  });
});
