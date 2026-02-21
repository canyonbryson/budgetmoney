import { parseMonthlyIncomeInput } from '../income';

describe('parseMonthlyIncomeInput', () => {
  it('treats empty input as skip', () => {
    expect(parseMonthlyIncomeInput('')).toBeNull();
    expect(parseMonthlyIncomeInput('   ')).toBeNull();
  });

  it('parses valid non-negative values', () => {
    expect(parseMonthlyIncomeInput('5000')).toBe(5000);
    expect(parseMonthlyIncomeInput('0')).toBe(0);
  });

  it('rejects invalid or negative values', () => {
    expect(parseMonthlyIncomeInput('-1')).toBeNaN();
    expect(parseMonthlyIncomeInput('abc')).toBeNaN();
  });
});
