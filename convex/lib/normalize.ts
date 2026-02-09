export type UnitKind = 'mass' | 'volume' | 'count' | 'unknown';

export type NormalizedQuantity = {
  quantity?: number;
  unit?: string;
  kind: UnitKind;
};

const UNIT_MAP: Record<
  string,
  {
    kind: 'mass' | 'volume' | 'count';
    unit: string;
    factor: number;
  }
> = {
  g: { kind: 'mass', unit: 'g', factor: 1 },
  gram: { kind: 'mass', unit: 'g', factor: 1 },
  grams: { kind: 'mass', unit: 'g', factor: 1 },
  kg: { kind: 'mass', unit: 'g', factor: 1000 },
  kilogram: { kind: 'mass', unit: 'g', factor: 1000 },
  kilograms: { kind: 'mass', unit: 'g', factor: 1000 },
  mg: { kind: 'mass', unit: 'g', factor: 0.001 },
  milligram: { kind: 'mass', unit: 'g', factor: 0.001 },
  milligrams: { kind: 'mass', unit: 'g', factor: 0.001 },
  oz: { kind: 'mass', unit: 'g', factor: 28.3495 },
  ounce: { kind: 'mass', unit: 'g', factor: 28.3495 },
  ounces: { kind: 'mass', unit: 'g', factor: 28.3495 },
  lb: { kind: 'mass', unit: 'g', factor: 453.592 },
  lbs: { kind: 'mass', unit: 'g', factor: 453.592 },
  pound: { kind: 'mass', unit: 'g', factor: 453.592 },
  pounds: { kind: 'mass', unit: 'g', factor: 453.592 },
  ml: { kind: 'volume', unit: 'ml', factor: 1 },
  milliliter: { kind: 'volume', unit: 'ml', factor: 1 },
  milliliters: { kind: 'volume', unit: 'ml', factor: 1 },
  l: { kind: 'volume', unit: 'ml', factor: 1000 },
  liter: { kind: 'volume', unit: 'ml', factor: 1000 },
  liters: { kind: 'volume', unit: 'ml', factor: 1000 },
  tsp: { kind: 'volume', unit: 'ml', factor: 4.92892 },
  teaspoon: { kind: 'volume', unit: 'ml', factor: 4.92892 },
  teaspoons: { kind: 'volume', unit: 'ml', factor: 4.92892 },
  tbsp: { kind: 'volume', unit: 'ml', factor: 14.7868 },
  tablespoon: { kind: 'volume', unit: 'ml', factor: 14.7868 },
  tablespoons: { kind: 'volume', unit: 'ml', factor: 14.7868 },
  cup: { kind: 'volume', unit: 'ml', factor: 236.588 },
  cups: { kind: 'volume', unit: 'ml', factor: 236.588 },
  pt: { kind: 'volume', unit: 'ml', factor: 473.176 },
  pint: { kind: 'volume', unit: 'ml', factor: 473.176 },
  pints: { kind: 'volume', unit: 'ml', factor: 473.176 },
  qt: { kind: 'volume', unit: 'ml', factor: 946.353 },
  quart: { kind: 'volume', unit: 'ml', factor: 946.353 },
  quarts: { kind: 'volume', unit: 'ml', factor: 946.353 },
  gal: { kind: 'volume', unit: 'ml', factor: 3785.41 },
  gallon: { kind: 'volume', unit: 'ml', factor: 3785.41 },
  gallons: { kind: 'volume', unit: 'ml', factor: 3785.41 },
  floz: { kind: 'volume', unit: 'ml', factor: 29.5735 },
  fluidounce: { kind: 'volume', unit: 'ml', factor: 29.5735 },
  fluidounces: { kind: 'volume', unit: 'ml', factor: 29.5735 },
  ea: { kind: 'count', unit: 'ea', factor: 1 },
  each: { kind: 'count', unit: 'ea', factor: 1 },
  count: { kind: 'count', unit: 'ea', factor: 1 },
  ct: { kind: 'count', unit: 'ea', factor: 1 },
  pc: { kind: 'count', unit: 'ea', factor: 1 },
  pcs: { kind: 'count', unit: 'ea', factor: 1 },
  piece: { kind: 'count', unit: 'ea', factor: 1 },
  pieces: { kind: 'count', unit: 'ea', factor: 1 },
  item: { kind: 'count', unit: 'ea', factor: 1 },
  items: { kind: 'count', unit: 'ea', factor: 1 },
  x: { kind: 'count', unit: 'ea', factor: 1 },
};

export function normalizeItemName(name: string) {
  const cleaned = name.toLowerCase();
  const withoutSizes = cleaned.replace(
    /\b\d+(\.\d+)?\s*(oz|ounce|ounces|lb|lbs|pound|pounds|ct|count|pack|pkg|pk|g|kg|mg|ml|l)\b/g,
    ' '
  );
  return withoutSizes.replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeUnit(unit?: string) {
  return unit?.trim().toLowerCase();
}

function unitKey(unit?: string) {
  if (!unit) return '';
  return unit.toLowerCase().replace(/[\s.]+/g, '');
}

export function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeQuantity(
  quantity?: number | null,
  unit?: string | null
): NormalizedQuantity {
  const normalizedUnit = normalizeUnit(unit ?? undefined);
  const mapped = UNIT_MAP[unitKey(normalizedUnit)];

  if (quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    if (mapped) {
      return { quantity: undefined, unit: mapped.unit, kind: mapped.kind };
    }
    if (!normalizedUnit) {
      return { quantity: undefined, unit: undefined, kind: 'unknown' };
    }
    return { quantity: undefined, unit: normalizedUnit, kind: 'unknown' };
  }

  if (mapped) {
    return {
      quantity: roundQuantity(quantity * mapped.factor),
      unit: mapped.unit,
      kind: mapped.kind,
    };
  }

  if (!normalizedUnit) {
    return { quantity: roundQuantity(quantity), unit: 'ea', kind: 'count' };
  }

  return { quantity: roundQuantity(quantity), unit: normalizedUnit, kind: 'unknown' };
}
