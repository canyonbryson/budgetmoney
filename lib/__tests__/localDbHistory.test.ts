import { applyLocalCarryoverToCategoryRows, computeLocalCarryoverOut } from '../localDb';

describe('local history carryover math', () => {
  it('supports the same rollover modes as convex history', () => {
    expect(computeLocalCarryoverOut('none', 60)).toBe(0);
    expect(computeLocalCarryoverOut('positive', 60)).toBe(60);
    expect(computeLocalCarryoverOut('positive', -60)).toBe(0);
    expect(computeLocalCarryoverOut('negative', -60)).toBe(-60);
    expect(computeLocalCarryoverOut('negative', 60)).toBe(0);
    expect(computeLocalCarryoverOut('both', 60)).toBe(60);
    expect(computeLocalCarryoverOut('both', -60)).toBe(-60);
  });

  it('builds a running carryover value across periods', () => {
    const cycleA = computeLocalCarryoverOut('both', 100);
    const cycleB = computeLocalCarryoverOut('negative', -45);
    const cycleC = computeLocalCarryoverOut('positive', 35);
    expect(cycleA + cycleB + cycleC).toBe(90);
  });

  it('recomputes local carryover rows from previous totals', () => {
    const result = applyLocalCarryoverToCategoryRows(
      [
        { categoryId: 'rent', carryoverOut: -30 },
        { categoryId: 'food', carryoverOut: 18 },
      ],
      new Map([
        ['rent', -10],
        ['food', 2],
      ])
    );

    expect(result.rows).toEqual([
      { categoryId: 'rent', carryoverOut: -30, carryoverAppliedIn: -10, carryoverRunningTotal: -40 },
      { categoryId: 'food', carryoverOut: 18, carryoverAppliedIn: 2, carryoverRunningTotal: 20 },
    ]);
    expect(result.carryoverPositiveTotal).toBe(20);
    expect(result.carryoverNegativeTotal).toBe(-40);
    expect(result.carryoverNetTotal).toBe(-20);
  });
});
