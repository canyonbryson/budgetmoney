import { resolveTransactionsRouteParams } from '../transactionsNavigation';

describe('resolveTransactionsRouteParams', () => {
  it('defaults both flags to false', () => {
    expect(resolveTransactionsRouteParams({})).toEqual({
      openNew: false,
      uncategorizedOnly: false,
    });
  });

  it('accepts "1" for enabled flags', () => {
    expect(
      resolveTransactionsRouteParams({
        openNew: '1',
        uncategorizedOnly: '1',
      })
    ).toEqual({
      openNew: true,
      uncategorizedOnly: true,
    });
  });

  it('treats arrays as disabled for safety', () => {
    expect(
      resolveTransactionsRouteParams({
        openNew: ['1'],
        uncategorizedOnly: ['1'],
      })
    ).toEqual({
      openNew: false,
      uncategorizedOnly: false,
    });
  });
});
