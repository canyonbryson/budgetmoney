import { lookupWincoPrice } from '../priceProviders/winco';

describe('lookupWincoPrice', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('extracts product price from products array payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            title: 'Roma Tomato',
            price: 1.49,
            url: 'https://example.com/tomato',
          },
        ],
      }),
    }) as any;

    const result = await lookupWincoPrice('roma tomato', {
      baseUrl: 'https://prices.example.com/winco/search',
    });

    expect(result).toEqual({
      provider: 'winco',
      query: 'roma tomato',
      title: 'Roma Tomato',
      price: 1.49,
      currency: 'USD',
      priceUnit: 'dollars',
      productUrl: 'https://example.com/tomato',
    });
  });

  it('supports url templates with {query}', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    global.fetch = fetchMock as any;

    await lookupWincoPrice('green onion', {
      baseUrl: 'https://prices.example.com/winco/search?q={query}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://prices.example.com/winco/search?q=green%20onion',
      expect.any(Object)
    );
  });
});
