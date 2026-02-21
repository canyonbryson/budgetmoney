export type WincoPriceLookupResult = {
  provider: 'winco';
  query: string;
  title?: string;
  price?: number;
  currency?: string;
  priceUnit?: 'cents' | 'dollars';
  productUrl?: string;
};

export type WincoLookupConfig = {
  baseUrl: string;
  apiKey?: string;
  storeId?: string;
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
  return [];
}

function extractCandidatePrice(candidate: any) {
  const direct =
    toOptionalNumber(candidate?.price) ??
    toOptionalNumber(candidate?.currentPrice) ??
    toOptionalNumber(candidate?.unitPrice) ??
    toOptionalNumber(candidate?.salePrice) ??
    toOptionalNumber(candidate?.pricing?.price) ??
    toOptionalNumber(candidate?.pricing?.currentPrice) ??
    toOptionalNumber(candidate?.pricing?.unitPrice);
  return direct;
}

function buildRequestUrl(query: string, config: WincoLookupConfig) {
  if (config.baseUrl.includes('{query}')) {
    const encodedQuery = encodeURIComponent(query);
    return config.baseUrl.replaceAll('{query}', encodedQuery);
  }

  const url = new URL(config.baseUrl);
  url.searchParams.set(config.queryParam ?? 'query', query);
  if (config.storeId) {
    url.searchParams.set('storeId', config.storeId);
  }
  return url.toString();
}

export async function lookupWincoPrice(
  query: string,
  config: WincoLookupConfig
): Promise<WincoPriceLookupResult> {
  const url = buildRequestUrl(query, config);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`WinCo lookup failed: ${response.status}`);
  }

  const json = await response.json();
  const candidate = getCandidates(json)[0] ?? null;
  const price = extractCandidatePrice(candidate);

  return {
    provider: 'winco',
    query,
    title:
      toOptionalString(candidate?.title) ??
      toOptionalString(candidate?.name) ??
      toOptionalString(candidate?.description),
    price,
    currency: price === undefined ? undefined : 'USD',
    priceUnit: resolvePriceUnit(price, config.priceUnit),
    productUrl:
      toOptionalString(candidate?.url) ?? toOptionalString(candidate?.productUrl),
  };
}
