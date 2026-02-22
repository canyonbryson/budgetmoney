import { lookupWalmartPrice } from '../priceProviders/walmart';

describe('lookupWalmartPrice', () => {
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

    const result = await lookupWalmartPrice('roma tomato', {
      baseUrl: 'https://prices.example.com/walmart/search',
    });

    expect(result).toEqual({
      provider: 'walmart',
      query: 'roma tomato',
      title: 'Roma Tomato',
      price: 1.49,
      currency: 'USD',
      priceUnit: 'dollars',
      productUrl: 'https://example.com/tomato',
    });
  });

  it('supports custom api key and host headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    global.fetch = fetchMock as any;

    await lookupWalmartPrice('green onion', {
      baseUrl: 'https://prices.example.com/walmart/search',
      apiKey: 'abc123',
      apiKeyHeader: 'X-Api-Key',
      hostHeader: 'X-RapidAPI-Host',
      hostValue: 'walmart-data.p.rapidapi.com',
      queryParam: 'q',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://prices.example.com/walmart/search?q=green+onion',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Api-Key': 'abc123',
          'X-RapidAPI-Host': 'walmart-data.p.rapidapi.com',
        }),
      })
    );
  });

  it('returns no price safely when payload is malformed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ foo: { bar: 'baz' } }),
    }) as any;

    const result = await lookupWalmartPrice('celery', {
      baseUrl: 'https://prices.example.com/walmart/search',
    });

    expect(result.provider).toBe('walmart');
    expect(result.query).toBe('celery');
    expect(result.price).toBeUndefined();
  });
});
