type SpoonacularProduct = {
  id?: number;
  title?: string;
  name?: string;
  price?: number;
  pricePerServing?: number;
  servings?: {
    price?: number;
  };
  image?: string;
};

export type SpoonacularPriceLookupResult = {
  provider: 'spoonacular';
  query: string;
  productId?: number;
  title?: string;
  price?: number;
  currency?: string;
  priceUnit?: 'cents' | 'dollars';
};

export type SpoonacularConfig = {
  apiKey: string;
  baseUrl: string;
  priceUnit?: 'cents' | 'dollars';
};

function extractPrice(product: SpoonacularProduct | null | undefined) {
  if (!product) return undefined;
  if (typeof product.price === 'number') return product.price;
  if (typeof product.pricePerServing === 'number') return product.pricePerServing;
  if (typeof product.servings?.price === 'number') return product.servings.price;
  return undefined;
}

function productTitle(product: SpoonacularProduct | null | undefined) {
  if (!product) return undefined;
  return product.title ?? product.name ?? undefined;
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

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Spoonacular request failed: ${response.status}`);
  }
  return response.json();
}

export async function lookupSpoonacularPrice(
  query: string,
  config: SpoonacularConfig
): Promise<SpoonacularPriceLookupResult> {
  const searchUrl = new URL('/food/products/search', config.baseUrl);
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('number', '1');
  searchUrl.searchParams.set('addProductInformation', 'true');
  searchUrl.searchParams.set('apiKey', config.apiKey);

  const searchJson = await fetchJson(searchUrl.toString());
  const product = (searchJson?.products?.[0] ?? null) as SpoonacularProduct | null;

  let price = extractPrice(product);
  let title = productTitle(product);

  if (price === undefined && product?.id) {
    const detailUrl = new URL(`/food/products/${product.id}`, config.baseUrl);
    detailUrl.searchParams.set('apiKey', config.apiKey);
    const detailJson = await fetchJson(detailUrl.toString());
    price = extractPrice(detailJson as SpoonacularProduct);
    title = title ?? productTitle(detailJson as SpoonacularProduct);
  }

  return {
    provider: 'spoonacular',
    query,
    productId: product?.id,
    title,
    price,
    currency: price === undefined ? undefined : 'USD',
    priceUnit: resolvePriceUnit(price, config.priceUnit),
  };
}
