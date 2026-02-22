import { formatPlaidErrorMessage, summarizeSyncResult } from '../plaid';

describe('formatPlaidErrorMessage', () => {
  it('returns a configuration hint for invalid api keys', () => {
    const body = JSON.stringify({
      error_code: 'INVALID_API_KEYS',
      error_message: 'invalid client_id or secret provided',
      error_type: 'INVALID_INPUT',
    });

    expect(formatPlaidErrorMessage(400, body)).toBe(
      'Plaid credentials are invalid. Update PLAID_CLIENT_ID and PLAID_SECRET.'
    );
  });
});

describe('summarizeSyncResult', () => {
  it('returns ok when no item failures occurred', () => {
    expect(
      summarizeSyncResult({
        ownersProcessed: 1,
        itemsSynced: 2,
        itemsFailed: 0,
      })
    ).toEqual({
      status: 'ok',
      ownersProcessed: 1,
      itemsSynced: 2,
      itemsFailed: 0,
      message: undefined,
    });
  });

  it('returns partial when some items succeed and some fail', () => {
    expect(
      summarizeSyncResult({
        ownersProcessed: 1,
        itemsSynced: 1,
        itemsFailed: 1,
      })
    ).toEqual({
      status: 'partial',
      ownersProcessed: 1,
      itemsSynced: 1,
      itemsFailed: 1,
      message: undefined,
    });
  });

  it('returns error when all attempted items fail', () => {
    expect(
      summarizeSyncResult({
        ownersProcessed: 1,
        itemsSynced: 0,
        itemsFailed: 1,
      })
    ).toEqual({
      status: 'error',
      ownersProcessed: 1,
      itemsSynced: 0,
      itemsFailed: 1,
      message: undefined,
    });
  });
});
