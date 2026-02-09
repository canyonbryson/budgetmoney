import { formatPlaidErrorMessage } from '../plaid';

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
