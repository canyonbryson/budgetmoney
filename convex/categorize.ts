import { v } from 'convex/values';
import { query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { Owner } from './ownership';
import { getCategoryKind } from './categoryKinds';

const MCC_MAP: Record<string, string> = {
  '5411': 'Groceries',
  '5812': 'Restaurants',
  '5541': 'Gas',
};

const KEYWORDS: Record<string, string> = {
  kroger: 'Groceries',
  costco: 'Groceries',
  trader: 'Groceries',
  walmart: 'Groceries',
  target: 'Groceries',
  whole: 'Groceries',
  restaurant: 'Restaurants',
  uber: 'Transportation',
};

const INCOME_KEYWORDS = [
  'paycheck',
  'payroll',
  'salary',
  'direct deposit',
  'deposit',
  'ach credit',
  'income',
];

const INCOME_PRIMARY_KEYWORDS = ['INCOME', 'PAYROLL', 'DIRECT_DEPOSIT', 'SALARY'];

function normalizeMerchant(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function findCategoryIdByName(
  ctx: any,
  owner: Owner,
  name: string,
  categoryByName?: Map<string, string>
) {
  if (categoryByName) {
    return categoryByName.get(name.toLowerCase()) ?? null;
  }
  const categories = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('name'), name)
      )
    )
    .collect();
  return categories[0]?._id ?? null;
}

async function findCategoryIdByKind(
  ctx: any,
  owner: Owner,
  categoryKind: 'expense' | 'income' | 'transfer',
  categoryByKind?: Map<string, string>
) {
  if (categoryByKind) {
    return categoryByKind.get(categoryKind) ?? null;
  }
  const categories = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('categoryKind'), categoryKind)
      )
    )
    .collect();
  return categories.find((cat: any) => !cat.parentId)?._id ?? null;
}

function detectSpecialFlags(input: {
  name: string;
  merchantName?: string;
  amount?: number;
  personalFinanceCategoryPrimary?: string;
  accountType?: string;
}) {
  console.log('[detectSpecialFlags] input:', input);
  const merchant = normalizeMerchant(input.merchantName ?? input.name);
  const primary = (input.personalFinanceCategoryPrimary ?? '').toUpperCase();
  const accountType = input.accountType?.toLowerCase();

  const transferKeywords = [
    'transfer',
    'xfer',
    'ach transfer',
    'wire',
    'zelle',
    'venmo',
    'cash app',
    'cashapp',
  ];
  const cardPaymentKeywords = [
    'credit card payment',
    'card payment',
    'autopay',
    'auto pay',
    'payment',
  ];
  const cardBrandKeywords = [
    'amex',
    'american express',
    'visa',
    'mastercard',
    'master card',
    'discover',
    'capital one',
    'citi',
    'chase',
    'barclay',
    'synchrony',
    'wells fargo',
    'bank of america',
  ];

  const isTransferPrimary =
    primary.includes('TRANSFER') ||
    primary.includes('CREDIT_CARD_PAYMENT') ||
    primary.includes('LOAN_PAYMENTS');

  const isTransferKeyword = transferKeywords.some((word) => merchant.includes(word));
  const hasCardBrand = cardBrandKeywords.some((word) => merchant.includes(word));
  const isCreditAccount = accountType === 'credit';
  const amount = input.amount ?? 0;

  const hasPaymentKeyword = cardPaymentKeywords.some((word) => merchant.includes(word));
  const isCreditCardPayment =
    primary.includes('CREDIT_CARD_PAYMENT') ||
    (isCreditAccount && amount < 0 && hasPaymentKeyword) ||
    (hasPaymentKeyword && hasCardBrand);

  const isTransfer = isTransferPrimary || isTransferKeyword || isCreditCardPayment;
  const isCreditPurchase = isCreditAccount && !isCreditCardPayment;
  const isRefund = amount < 0 && !isTransfer && !isCreditCardPayment;

  return {
    isTransfer,
    isCreditCardPayment,
    isCreditPurchase,
    isRefund,
  };
}

type CategorizationSource = 'rule' | 'keyword' | 'mcc' | 'none' | 'ai';

type CategorizationResult = {
  categoryId: Id<'categories'> | null;
  source: CategorizationSource;
  confidence: number;
  isTransfer: boolean;
  isCreditCardPayment: boolean;
  isCreditPurchase: boolean;
  isRefund: boolean;
};

export function isIncomeLikeTransaction(input: {
  name: string;
  merchantName?: string;
  amount?: number;
  personalFinanceCategoryPrimary?: string;
}) {
  const merchant = normalizeMerchant(input.merchantName ?? input.name);
  const primary = (input.personalFinanceCategoryPrimary ?? '').toUpperCase();
  const amount = input.amount ?? 0;
  const hasIncomePrimary = INCOME_PRIMARY_KEYWORDS.some((token) => primary.includes(token));
  const hasIncomeKeyword = INCOME_KEYWORDS.some((keyword) => merchant.includes(keyword));
  const hasTransferKeyword = merchant.includes('transfer');
  return (hasIncomePrimary || hasIncomeKeyword) && amount > 0 && !hasTransferKeyword;
}

export async function categorizeTransaction(
  ctx: any,
  owner: Owner,
  input: {
    name: string;
    merchantName?: string;
    mcc?: string;
    amount?: number;
    personalFinanceCategoryPrimary?: string;
    accountType?: string;
  },
  options?: {
    categoryByName?: Map<string, string>;
    categoryByKind?: Map<string, string>;
  }
): Promise<CategorizationResult> {
  const flags = detectSpecialFlags(input);
  const merchant = normalizeMerchant(input.name ?? input.merchantName);
  const rule = await ctx.db
    .query('merchantRules')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('normalizedMerchant'), merchant)
      )
    )
    .first();
  if (rule) {
    return {
      categoryId: rule.categoryId,
      source: 'rule' as const,
      confidence: 1,
      ...flags,
    };
  }

  if (flags.isTransfer) {
    const transferCategoryId =
      (await findCategoryIdByKind(ctx, owner, 'transfer', options?.categoryByKind)) ??
      (await findCategoryIdByName(ctx, owner, 'Transfer', options?.categoryByName));
    if (transferCategoryId) {
      return {
        categoryId: transferCategoryId,
        source: 'keyword' as const,
        confidence: 0.85,
        ...flags,
      };
    }
  }

  if (isIncomeLikeTransaction(input)) {
    const incomeCategoryId = await findCategoryIdByKind(
      ctx,
      owner,
      'income',
      options?.categoryByKind
    );
    if (incomeCategoryId) {
      return {
        categoryId: incomeCategoryId,
        source: 'keyword' as const,
        confidence: 0.85,
        ...flags,
      };
    }
  }

  if (input.mcc && MCC_MAP[input.mcc]) {
    const catId = await findCategoryIdByName(
      ctx,
      owner,
      MCC_MAP[input.mcc],
      options?.categoryByName
    );
    if (catId) {
      return { categoryId: catId, source: 'mcc' as const, confidence: 0.7, ...flags };
    }
  }

  for (const [keyword, catName] of Object.entries(KEYWORDS)) {
    if (merchant.includes(keyword)) {
      const catId = await findCategoryIdByName(ctx, owner, catName, options?.categoryByName);
      if (catId) {
        return { categoryId: catId, source: 'keyword' as const, confidence: 0.5, ...flags };
      }
    }
  }

  return { categoryId: null, source: 'none' as const, confidence: 0, ...flags };
}

export const applyPipeline = query({
  args: {
    ownerType: v.union(v.literal('device'), v.literal('user')),
    ownerId: v.string(),
    name: v.string(),
    merchantName: v.optional(v.string()),
    mcc: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = { ownerType: args.ownerType, ownerId: args.ownerId } as Owner;
    const categories = await ctx.db
      .query('categories')
      .filter((q: any) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const categoryByName = new Map(
      categories
        .filter((cat: any) => typeof cat.name === 'string')
        .map((cat: any) => [String(cat.name).toLowerCase(), String(cat._id)])
    );
    const categoryByKind = new Map<string, string>();
    for (const category of categories) {
      if (category.parentId) continue;
      const kind = getCategoryKind(category);
      if (!categoryByKind.has(kind)) {
        categoryByKind.set(kind, String(category._id));
      }
    }
    return categorizeTransaction(ctx, owner, {
      name: args.name,
      merchantName: args.merchantName,
      mcc: args.mcc,
    }, {
      categoryByName,
      categoryByKind,
    });
  },
});
