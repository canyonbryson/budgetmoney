export type WalmartPriceLookupResult = {
  provider: 'walmart';
  query: string;
  title?: string;
  price?: number;
  currency?: string;
  priceUnit?: 'cents' | 'dollars';
  productUrl?: string;
};

export type WalmartLookupConfig = {
  baseUrl: string;
  apiKey?: string;
  apiKeyHeader?: string;
  hostHeader?: string;
  hostValue?: string;
  queryParam?: string;
  priceUnit?: 'cents' | 'dollars';
};

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '').trim();
    if (!cleaned.length) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function resolvePriceUnit(
  price: number | undefined,
  forcedUnit?: 'cents' | 'dollars'
): 'cents' | 'dollars' | undefined {
  if (forcedUnit) return forcedUnit;
  if (price === undefined) return undefined;
  if (Number.isInteger(price) && price >= 1000) return 'cents';
  return 'dollars';
}

function getCandidates(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.payload?.products)) return payload.payload.products;
  if (Array.isArray(payload?.payload?.items)) return payload.payload.items;
  return [];
}

function extractCandidatePrice(candidate: any) {
  return (
    toOptionalNumber(candidate?.price) ??
    toOptionalNumber(candidate?.currentPrice) ??
    toOptionalNumber(candidate?.unitPrice) ??
    toOptionalNumber(candidate?.salePrice) ??
    toOptionalNumber(candidate?.pricing?.price) ??
    toOptionalNumber(candidate?.pricing?.currentPrice) ??
    toOptionalNumber(candidate?.pricing?.unitPrice)
  );
}

function candidateTitle(candidate: any) {
  return (
    toOptionalString(candidate?.title) ??
    toOptionalString(candidate?.name) ??
    toOptionalString(candidate?.description) ??
    ''
  );
}

function candidateScore(query: string, candidate: any) {
  const title = candidateTitle(candidate);
  if (!title) return 0;

  const queryTokens = tokenize(query);
  const titleTokens = tokenize(title);
  if (!queryTokens.length || !titleTokens.length) return 0;

  let overlap = 0;
  for (const queryToken of queryTokens) {
    if (titleTokens.includes(queryToken)) overlap += 1;
  }

  const overlapScore = overlap / queryTokens.length;
  const lengthPenalty = titleTokens.length > 10 ? 0.1 : 0;
  const hasPriceBonus = extractCandidatePrice(candidate) !== undefined ? 0.15 : 0;

  return overlapScore + hasPriceBonus - lengthPenalty;
}

function buildRequestUrl(query: string, config: WalmartLookupConfig) {
  if (config.baseUrl.includes('{query}')) {
    const encodedQuery = encodeURIComponent(query);
    return config.baseUrl.replaceAll('{query}', encodedQuery);
  }

  const url = new URL(config.baseUrl);
  url.searchParams.set(config.queryParam ?? 'query', query);
  return url.toString();
}

export async function lookupWalmartPrice(
  query: string,
  config: WalmartLookupConfig
): Promise<WalmartPriceLookupResult> {
  const url = buildRequestUrl(query, config);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.apiKey) {
    headers[config.apiKeyHeader ?? 'Authorization'] = config.apiKey;
  }
  if (config.hostHeader && config.hostValue) {
    headers[config.hostHeader] = config.hostValue;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Walmart lookup failed: ${response.status}`);
  }

  const json = await response.json();
  const candidates = getCandidates(json);

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: candidateScore(query, candidate),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0]?.candidate ?? null;
  const price = extractCandidatePrice(best);

  return {
    provider: 'walmart',
    query,
    title: candidateTitle(best),
    price,
    currency: price === undefined ? undefined : 'USD',
    priceUnit: resolvePriceUnit(price, config.priceUnit),
    productUrl: toOptionalString(best?.url) ?? toOptionalString(best?.productUrl),
  };
}
