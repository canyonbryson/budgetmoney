type OpenAIJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

type OpenAIJsonRequest = {
  model: string;
  input: unknown;
  schema: OpenAIJsonSchema;
  temperature?: number;
  maxOutputTokens?: number;
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function extractOutputText(response: any): string {
  if (typeof response?.output_text === 'string') {
    return response.output_text.trim();
  }
  if (!Array.isArray(response?.output)) return '';
  const parts: string[] = [];
  for (const item of response.output) {
    if (!item) continue;
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
          parts.push(part.text);
        }
      }
    } else if (item.type === 'output_text' && typeof item.text === 'string') {
      parts.push(item.text);
    }
  }
  return parts.join('\n').trim();
}

export async function callOpenAIJson<T>(request: OpenAIJsonRequest): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const baseUrl = process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      input: request.input,
      temperature: request.temperature ?? 0.2,
      max_output_tokens: request.maxOutputTokens ?? 1200,
      text: {
        format: {
          type: 'json_schema',
          name: request.schema.name,
          schema: request.schema.schema,
          strict: request.schema.strict ?? true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  if (json?.error?.message) {
    throw new Error(`OpenAI error: ${json.error.message}`);
  }

  const outputText = extractOutputText(json);
  if (!outputText) {
    throw new Error('OpenAI response missing output text');
  }

  try {
    return JSON.parse(outputText) as T;
  } catch (error) {
    throw new Error(`OpenAI response was not valid JSON: ${String(error)}`);
  }
}
