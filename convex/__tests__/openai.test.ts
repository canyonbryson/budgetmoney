import { callOpenAIJson } from '../openai';

describe('callOpenAIJson', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('retries once with higher token limit when output is truncated JSON', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output_text:
            '{"results":[{"transaction_id":"tx_1","category_id":"cat_1","confidence":0.87}',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output_text:
            '{"results":[{"transaction_id":"tx_1","category_id":"cat_1","confidence":0.87}]}',
        }),
      });

    global.fetch = fetchMock as any;

    const parsed = await callOpenAIJson<{ results: Array<{ transaction_id: string }> }>({
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'categorize' }] }],
      schema: {
        name: 'test_schema',
        schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: { transaction_id: { type: 'string' } },
                required: ['transaction_id'],
                additionalProperties: true,
              },
            },
          },
          required: ['results'],
          additionalProperties: false,
        },
      },
      maxOutputTokens: 800,
    });

    expect(parsed.results[0].transaction_id).toBe('tx_1');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstBody.max_output_tokens).toBe(800);
    expect(secondBody.max_output_tokens).toBe(1600);
  });
});
