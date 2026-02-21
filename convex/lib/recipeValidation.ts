export type RecipeIngredientInput = {
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
};

export type NormalizedRecipeIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
};

type NormalizeOptions = {
  requireAmount: boolean;
};

type NormalizeResult = {
  ingredients: NormalizedRecipeIngredient[];
  missingAmountIndexes: number[];
  invalidAmountIndexes: number[];
  blankNameIndexes: number[];
};

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseFractionalToken(token: string): number | undefined {
  const normalized = token.trim();
  if (!normalized) return undefined;
  const fractionMatch = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!fractionMatch) return undefined;
  const numerator = Number(fractionMatch[1]);
  const denominator = Number(fractionMatch[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return undefined;
  }
  return numerator / denominator;
}

export function parseIngredientAmount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const mixedFraction = normalized.match(/^(-?\d+)\s+(\d+\s*\/\s*\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const fraction = parseFractionalToken(mixedFraction[2]);
    if (Number.isFinite(whole) && fraction !== undefined) {
      const combined = whole + fraction;
      return combined > 0 ? combined : undefined;
    }
  }

  const fraction = parseFractionalToken(normalized);
  if (fraction !== undefined && fraction > 0) return fraction;

  return undefined;
}

export function normalizeRecipeIngredientsForSave(
  ingredients: RecipeIngredientInput[],
  options: NormalizeOptions
): NormalizeResult {
  const normalized: NormalizedRecipeIngredient[] = [];
  const missingAmountIndexes: number[] = [];
  const invalidAmountIndexes: number[] = [];
  const blankNameIndexes: number[] = [];

  ingredients.forEach((ingredient, index) => {
    const name = toOptionalString(ingredient.name);
    const unit = toOptionalString(ingredient.unit ?? undefined);
    const quantityText = typeof ingredient.quantity === 'string' ? ingredient.quantity.trim() : undefined;
    const quantity = parseIngredientAmount(ingredient.quantity);
    const quantityWasProvided =
      typeof ingredient.quantity === 'number' || (typeof quantityText === 'string' && quantityText.length > 0);

    if (!name) {
      if (quantityWasProvided || unit) {
        blankNameIndexes.push(index);
      }
      return;
    }

    if (options.requireAmount) {
      if (!quantityWasProvided || quantity === undefined) {
        missingAmountIndexes.push(index);
      }
    } else if (quantityWasProvided && quantity === undefined) {
      invalidAmountIndexes.push(index);
    }

    if (quantityWasProvided && quantity === undefined && !options.requireAmount) {
      normalized.push({ name, unit });
      return;
    }

    normalized.push({
      name,
      quantity,
      unit,
    });
  });

  return {
    ingredients: normalized,
    missingAmountIndexes,
    invalidAmountIndexes,
    blankNameIndexes,
  };
}

export function splitInstructionSteps(instructions: string) {
  const trimmed = instructions.trim();
  if (!trimmed) return [];

  const numberedCandidates = trimmed
    .split(/\n+/)
    .flatMap((line) => line.split(/(?=\s*\d+\s*[\).:-]\s+)/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\d+\s*[\).:-]\s*/, '').trim())
    .filter((line) => line.length > 0);

  if (numberedCandidates.length >= 2) return numberedCandidates;

  const newlineBlocks = trimmed
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (newlineBlocks.length >= 2) return newlineBlocks;

  const sentenceSteps = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (sentenceSteps.length >= 2) return sentenceSteps;

  return [trimmed];
}
