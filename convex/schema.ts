import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const ownerFields = {
  ownerType: v.union(v.literal('device'), v.literal('user')),
  ownerId: v.string(),
};

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  userDevices: defineTable({
    deviceId: v.string(),
    ownerType: ownerFields.ownerType,
    ownerId: ownerFields.ownerId,
    mergedToUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_device', ['deviceId'])
    .index('by_owner', ['ownerType', 'ownerId']),

  plaidItems: defineTable({
    ...ownerFields,
    plaidItemId: v.string(),
    accessToken: v.string(),
    institutionName: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('disconnected')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerType', 'ownerId'])
    .index('by_owner_plaidItemId', ['ownerType', 'ownerId', 'plaidItemId'])
    .index('by_plaidItemId', ['plaidItemId']),

  plaidAccounts: defineTable({
    ...ownerFields,
    plaidItemIdRef: v.id('plaidItems'),
    plaidAccountId: v.string(),
    name: v.string(),
    mask: v.optional(v.string()),
    subtype: v.optional(v.string()),
    type: v.optional(v.string()),
    currentBalance: v.optional(v.number()),
    availableBalance: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerType', 'ownerId'])
    .index('by_owner_plaidAccountId', ['ownerType', 'ownerId', 'plaidAccountId'])
    .index('by_item', ['plaidItemIdRef']),

  syncState: defineTable({
    ...ownerFields,
    plaidItemIdRef: v.id('plaidItems'),
    cursor: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.union(v.literal('success'), v.literal('error'))),
    lastSyncError: v.optional(v.string()),
  }).index('by_item', ['plaidItemIdRef']),

  transactions: defineTable({
    ...ownerFields,
    plaidTransactionId: v.optional(v.string()),
    plaidAccountId: v.optional(v.string()),
    date: v.string(),
    authorizedDate: v.optional(v.string()),
    name: v.string(),
    merchantName: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    pending: v.boolean(),
    mcc: v.optional(v.string()),
    categoryId: v.optional(v.id('categories')),
    autoCategoryId: v.optional(v.id('categories')),
    categorizationSource: v.union(
      v.literal('rule'),
      v.literal('mcc'),
      v.literal('keyword'),
      v.literal('ai'),
      v.literal('manual'),
      v.literal('none'),
    ),
    confidence: v.number(),
    isTransfer: v.optional(v.boolean()),
    isRefund: v.optional(v.boolean()),
    isCreditCardPayment: v.optional(v.boolean()),
    isCreditPurchase: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_date', ['ownerType', 'ownerId', 'date'])
    .index('by_owner_category_date', ['ownerType', 'ownerId', 'categoryId', 'date'])
    .index('by_owner_plaid_tx', ['ownerType', 'ownerId', 'plaidTransactionId']),

  merchantRules: defineTable({
    ...ownerFields,
    normalizedMerchant: v.string(),
    categoryId: v.id('categories'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_merchant', ['ownerType', 'ownerId', 'normalizedMerchant']),

  categories: defineTable({
    ownerType: v.optional(v.union(v.literal('device'), v.literal('user'))),
    ownerId: v.optional(v.string()),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    gameId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.id('categories')),
    rolloverMode: v.optional(
      v.union(v.literal('none'), v.literal('positive'), v.literal('negative'), v.literal('both'))
    ),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index('by_owner_parent', ['ownerType', 'ownerId', 'parentId']),

  budgets: defineTable({
    ...ownerFields,
    categoryId: v.id('categories'),
    periodStart: v.string(),
    periodLengthDays: v.number(),
    amount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_period_category', ['ownerType', 'ownerId', 'periodStart', 'categoryId']),

  budgetSettings: defineTable({
    ...ownerFields,
    cycleLengthDays: v.number(),
    anchorDate: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerType', 'ownerId']),

  receipts: defineTable({
    ...ownerFields,
    storageId: v.string(),
    merchantName: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    receiptDate: v.optional(v.string()),
    linkedTransactionId: v.optional(v.id('transactions')),
    linkStatus: v.optional(
      v.union(v.literal('unlinked'), v.literal('linked'), v.literal('linkedMismatch'))
    ),
    needsReview: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal('parsed'), v.literal('pending'))),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_date', ['ownerType', 'ownerId', 'receiptDate'])
    .index('by_owner_review', ['ownerType', 'ownerId', 'needsReview']),

  receiptLineItems: defineTable({
    ...ownerFields,
    receiptId: v.id('receipts'),
    name: v.string(),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    lineTotal: v.optional(v.number()),
    grocerySubCategoryId: v.optional(v.id('categories')),
    normalizedItemId: v.optional(v.id('canonicalItems')),
    confidence: v.optional(v.number()),
    needsReview: v.optional(v.boolean()),
  }).index('by_receipt', ['receiptId']),

  transactionSplits: defineTable({
    ...ownerFields,
    transactionId: v.id('transactions'),
    receiptId: v.optional(v.id('receipts')),
    categoryId: v.id('categories'),
    amount: v.number(),
    source: v.union(v.literal('receipt'), v.literal('manual')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerType', 'ownerId'])
    .index('by_transaction', ['transactionId'])
    .index('by_receipt', ['receiptId'])
    .index('by_owner_category', ['ownerType', 'ownerId', 'categoryId']),

  notificationSettings: defineTable({
    ...ownerFields,
    budgetAlertsEnabled: v.boolean(),
    budgetThresholdPct: v.number(),
    receiptAlertsEnabled: v.boolean(),
    creditDueAlertsEnabled: v.boolean(),
    creditDueDaysBefore: v.number(),
    weeklySummaryEnabled: v.boolean(),
    monthlySummaryEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerType', 'ownerId']),

  creditCards: defineTable({
    ...ownerFields,
    name: v.string(),
    dueDate: v.string(),
    minimumPayment: v.optional(v.number()),
    statementBalance: v.optional(v.number()),
    lastStatementDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerType', 'ownerId']),

  receiptLinks: defineTable({
    ...ownerFields,
    receiptId: v.id('receipts'),
    transactionId: v.id('transactions'),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_receipt', ['receiptId']),

  recipes: defineTable({
    ...ownerFields,
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    servings: v.optional(v.number()),
    notes: v.optional(v.string()),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerType', 'ownerId']),

  recipeIngredients: defineTable({
    ...ownerFields,
    recipeId: v.id('recipes'),
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    normalizedItemId: v.optional(v.id('canonicalItems')),
    confidence: v.optional(v.number()),
  }).index('by_recipe', ['recipeId']),

  mealPlans: defineTable({
    ...ownerFields,
    weekStart: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_week', ['ownerType', 'ownerId', 'weekStart']),

  mealPlanItems: defineTable({
    ...ownerFields,
    mealPlanId: v.id('mealPlans'),
    recipeId: v.optional(v.id('recipes')),
    title: v.string(),
    day: v.string(),
    slot: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index('by_plan', ['mealPlanId']),

  shoppingListItems: defineTable({
    ...ownerFields,
    mealPlanId: v.id('mealPlans'),
    canonicalItemId: v.optional(v.id('canonicalItems')),
    itemName: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
    priceSource: v.optional(v.union(v.literal('receipt'), v.literal('online'))),
    isChecked: v.optional(v.boolean()),
  }).index('by_plan', ['mealPlanId']),

  pantryItems: defineTable({
    ...ownerFields,
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerType', 'ownerId']),

  canonicalItems: defineTable({
    ...ownerFields,
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_name', ['ownerType', 'ownerId', 'name']),

  itemPrices: defineTable({
    ...ownerFields,
    canonicalItemId: v.id('canonicalItems'),
    receiptId: v.optional(v.id('receipts')),
    price: v.number(),
    currency: v.string(),
    source: v.string(),
    isEstimated: v.boolean(),
    purchasedAt: v.number(),
  })
    .index('by_item', ['canonicalItemId'])
    .index('by_receipt', ['receiptId']),
});
