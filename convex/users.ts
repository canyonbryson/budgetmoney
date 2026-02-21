import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { ensureDefaultIncomeCategoryForOwner } from './categories';
import { migrateOwnerData } from './familyMigration';
import { isFamilyModeEnabled } from './ownership';

const ROLLOVER_MODES = v.union(
  v.literal('none'),
  v.literal('positive'),
  v.literal('negative'),
  v.literal('both')
);

function toMealType(
  value?: string | null
): 'recipe' | 'leftovers' | 'eatOut' | 'skip' | 'other' | undefined {
  if (
    value === 'recipe' ||
    value === 'leftovers' ||
    value === 'eatOut' ||
    value === 'skip' ||
    value === 'other'
  ) {
    return value;
  }
  return undefined;
}

async function ensureFamilyForUser(ctx: any, userId: string, now: number) {
  const existingMembership = await ctx.db
    .query('familyMembers')
    .withIndex('by_userId_status', (q: any) => q.eq('userId', userId).eq('status', 'active'))
    .first();
  if (existingMembership) {
    return existingMembership.familyId;
  }

  const familyId = await ctx.db.insert('families', {
    name: 'My Family',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert('familyMembers', {
    familyId,
    userId,
    role: 'owner',
    status: 'active',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return familyId;
}

export const ensure = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    const now = Date.now();

    if (auth) {
      const existing = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('userId'), auth.subject))
        .first();
      if (!existing) {
        await ctx.db.insert('users', {
          userId: auth.subject,
          email: auth.email,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(existing._id, { updatedAt: now, email: auth.email ?? existing.email });
      }

      const familyId = isFamilyModeEnabled()
        ? await ensureFamilyForUser(ctx, auth.subject, now)
        : undefined;

      if (familyId && isFamilyModeEnabled()) {
        await migrateOwnerData(
          ctx,
          { ownerType: 'user', ownerId: auth.subject },
          { ownerType: 'family', ownerId: String(familyId) }
        );
      }

      const device = await ctx.db
        .query('userDevices')
        .filter((q) => q.eq(q.field('deviceId'), args.deviceId))
        .first();
      if (!device) {
        await ctx.db.insert('userDevices', {
          deviceId: args.deviceId,
          ownerType: familyId ? 'family' : 'user',
          ownerId: familyId ? String(familyId) : auth.subject,
          mergedToUserId: auth.subject,
          createdAt: now,
          updatedAt: now,
        });
      }
      return;
    }

    const existingDevice = await ctx.db
      .query('userDevices')
      .filter((q) => q.eq(q.field('deviceId'), args.deviceId))
      .first();
    if (!existingDevice) {
      await ctx.db.insert('userDevices', {
        deviceId: args.deviceId,
        ownerType: 'device',
        ownerId: args.deviceId,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const importLocalData = mutation({
  args: {
    data: v.object({
      categories: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          categoryKind: v.optional(
            v.union(v.literal('expense'), v.literal('income'), v.literal('transfer'))
          ),
          parentId: v.optional(v.union(v.string(), v.null())),
          rolloverMode: v.optional(ROLLOVER_MODES),
          carryoverAdjustment: v.optional(v.number()),
          isDefault: v.optional(v.number()),
        })
      ),
      budgetSettings: v.optional(
        v.object({
          cycleLengthDays: v.number(),
          anchorDate: v.string(),
        })
      ),
      budgets: v.array(
        v.object({
          categoryId: v.string(),
          periodStart: v.string(),
          periodLengthDays: v.number(),
          amount: v.number(),
        })
      ),
      transactions: v.array(
        v.object({
          name: v.string(),
          date: v.string(),
          amount: v.number(),
          categoryId: v.optional(v.union(v.string(), v.null())),
          pending: v.optional(v.union(v.boolean(), v.null())),
        })
      ),
      recipes: v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          content: v.optional(v.string()),
          name: v.optional(v.string()),
          instructions: v.optional(v.string()),
          servings: v.optional(v.union(v.number(), v.null())),
          pricePerServing: v.optional(v.union(v.number(), v.null())),
          notes: v.optional(v.union(v.string(), v.null())),
          sourceUrl: v.optional(v.union(v.string(), v.null())),
          tags: v.optional(v.union(v.array(v.string()), v.null())),
        })
      ),
      recipeIngredients: v.array(
        v.object({
          recipeId: v.string(),
          name: v.string(),
          quantity: v.optional(v.union(v.number(), v.null())),
          unit: v.optional(v.union(v.string(), v.null())),
        })
      ),
      mealPlans: v.array(
        v.object({
          id: v.string(),
          weekStart: v.string(),
        })
      ),
      mealPlanItems: v.array(
        v.object({
          mealPlanId: v.string(),
          recipeId: v.optional(v.union(v.string(), v.null())),
          title: v.string(),
          day: v.string(),
          slot: v.optional(v.union(v.string(), v.null())),
          notes: v.optional(v.union(v.string(), v.null())),
          mealType: v.optional(v.union(v.string(), v.null())),
        })
      ),
      shoppingListItems: v.array(
        v.object({
          mealPlanId: v.string(),
          itemName: v.string(),
          quantity: v.optional(v.union(v.number(), v.null())),
          unit: v.optional(v.union(v.string(), v.null())),
          estimatedCost: v.optional(v.union(v.number(), v.null())),
          isChecked: v.optional(v.union(v.boolean(), v.null())),
          inPantry: v.optional(v.union(v.boolean(), v.null())),
        })
      ),
      creditCards: v.optional(
        v.array(
          v.object({
            name: v.string(),
            dueDate: v.string(),
            minimumPayment: v.optional(v.union(v.number(), v.null())),
            statementBalance: v.optional(v.union(v.number(), v.null())),
            lastStatementDate: v.optional(v.union(v.string(), v.null())),
          })
        )
      ),
    }),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error('Not authorized');
    let ownerType: 'user' | 'family' = 'user';
    let ownerId = auth.subject;
    if (isFamilyModeEnabled()) {
      const membership = await ctx.db
        .query('familyMembers')
        .withIndex('by_userId_status', (q: any) =>
          q.eq('userId', auth.subject).eq('status', 'active')
        )
        .first();
      if (membership) {
        ownerType = 'family';
        ownerId = String(membership.familyId);
      }
    }
    const now = Date.now();

    const normalize = (value: string) => value.toLowerCase().replace(/\\s+/g, ' ').trim();
    const categoryKey = (name: string, parentName?: string | null) =>
      `${normalize(parentName ?? '')}::${normalize(name)}`;

    const existingCategories = await ctx.db
      .query('categories')
      .filter((q) => q.and(q.eq(q.field('ownerType'), ownerType), q.eq(q.field('ownerId'), ownerId)))
      .collect();
    const existingByKey = new Map<string, typeof existingCategories[number]>();
    const existingById = new Map(existingCategories.map((c) => [String(c._id), c]));
    for (const cat of existingCategories) {
      const parentName = cat.parentId ? existingById.get(String(cat.parentId))?.name ?? '' : '';
      existingByKey.set(categoryKey(cat.name ?? 'Category', parentName), cat);
    }
    const existingTopByName = new Map(
      existingCategories.filter((c) => !c.parentId).map((c) => [normalize(c.name ?? ''), c])
    );

    const localCategories = args.data.categories ?? [];
    const localById = new Map(localCategories.map((c) => [c.id, c]));
    const categoryIdMap = new Map<string, any>();

    const orderedCategories = [
      ...localCategories.filter((c) => !c.parentId),
      ...localCategories.filter((c) => c.parentId),
    ];

    for (const cat of orderedCategories) {
      const parentName = cat.parentId ? localById.get(cat.parentId)?.name ?? '' : '';
      const key = categoryKey(cat.name, parentName);
      const existing = existingByKey.get(key);
      if (existing) {
        await ctx.db.patch(existing._id, {
          rolloverMode: cat.rolloverMode ?? existing.rolloverMode,
          carryoverAdjustment: cat.carryoverAdjustment ?? existing.carryoverAdjustment,
          categoryKind: cat.categoryKind ?? existing.categoryKind,
          updatedAt: now,
        });
        categoryIdMap.set(cat.id, existing._id);
        continue;
      }

      let parentId: any = undefined;
      if (cat.parentId) {
        parentId = categoryIdMap.get(cat.parentId);
        if (!parentId && parentName) {
          const existingParent = existingTopByName.get(normalize(parentName));
          if (existingParent) parentId = existingParent._id;
        }
      }

      const createdId = await ctx.db.insert('categories', {
        ownerType,
        ownerId,
        name: cat.name,
        categoryKind: cat.categoryKind,
        parentId,
        rolloverMode: cat.rolloverMode ?? 'none',
        carryoverAdjustment: cat.carryoverAdjustment ?? 0,
        isDefault: Boolean(cat.isDefault),
        createdAt: now,
        updatedAt: now,
      });
      categoryIdMap.set(cat.id, createdId);
    }

    await ensureDefaultIncomeCategoryForOwner(ctx, { ownerType, ownerId });

    if (args.data.budgetSettings) {
      const existingSettings = await ctx.db
        .query('budgetSettings')
        .filter((q) => q.and(q.eq(q.field('ownerType'), ownerType), q.eq(q.field('ownerId'), ownerId)))
        .first();
      if (existingSettings) {
        await ctx.db.patch(existingSettings._id, {
          cycleLengthDays: args.data.budgetSettings.cycleLengthDays,
          anchorDate: args.data.budgetSettings.anchorDate,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert('budgetSettings', {
          ownerType,
          ownerId,
          cycleLengthDays: args.data.budgetSettings.cycleLengthDays,
          anchorDate: args.data.budgetSettings.anchorDate,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const budget of args.data.budgets ?? []) {
      const categoryId = categoryIdMap.get(budget.categoryId);
      if (!categoryId) continue;
      const existing = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period_category', (q) =>
          q
            .eq('ownerType', ownerType)
            .eq('ownerId', ownerId)
            .eq('periodStart', budget.periodStart)
            .eq('categoryId', categoryId)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { amount: budget.amount, updatedAt: now });
      } else {
        await ctx.db.insert('budgets', {
          ownerType,
          ownerId,
          categoryId,
          periodStart: budget.periodStart,
          periodLengthDays: budget.periodLengthDays,
          amount: budget.amount,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const existingTransactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) => q.eq('ownerType', ownerType).eq('ownerId', ownerId))
      .take(1000);
    const txKey = (name: string, date: string, amount: number) =>
      `${date}::${amount.toFixed(2)}::${normalize(name)}`;
    const txMap = new Map(existingTransactions.map((tx) => [txKey(tx.name, tx.date, tx.amount), tx]));

    for (const tx of args.data.transactions ?? []) {
      const key = txKey(tx.name, tx.date, tx.amount);
      const existing = txMap.get(key);
      const categoryId = tx.categoryId ? categoryIdMap.get(tx.categoryId) : undefined;
      if (existing) {
        if (categoryId) {
          await ctx.db.patch(existing._id, {
            categoryId,
            categorizationSource: 'manual',
            confidence: 1,
            updatedAt: now,
          });
        }
        continue;
      }
      await ctx.db.insert('transactions', {
        ownerType,
        ownerId,
        date: tx.date,
        name: tx.name,
        merchantName: tx.name,
        amount: tx.amount,
        currency: 'USD',
        pending: tx.pending ?? false,
        categoryId,
        autoCategoryId: categoryId,
        categorizationSource: categoryId ? 'manual' : 'none',
        confidence: categoryId ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingRecipes = await ctx.db
      .query('recipes')
      .filter((q) => q.and(q.eq(q.field('ownerType'), ownerType), q.eq(q.field('ownerId'), ownerId)))
      .collect();
    const recipeKey = (title: string, content: string) =>
      `${normalize(title)}::${normalize(content)}`;
    const recipeMap = new Map(
      existingRecipes.map((r) => [recipeKey(r.name ?? r.title ?? '', r.instructions ?? r.content ?? ''), r])
    );
    const recipeIdMap = new Map<string, any>();

    for (const recipe of args.data.recipes ?? []) {
      const name = (recipe.name ?? recipe.title ?? '').trim() || 'Recipe';
      const instructions = recipe.instructions ?? recipe.content ?? '';
      const key = recipeKey(name, instructions);
      const existing = recipeMap.get(key);
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: name,
          content: instructions,
          name,
          instructions,
          servings: recipe.servings ?? undefined,
          pricePerServing: recipe.pricePerServing ?? undefined,
          notes: recipe.notes ?? undefined,
          sourceUrl: recipe.sourceUrl ?? undefined,
          tags: recipe.tags ?? undefined,
          searchName: normalize(name),
          updatedAt: now,
        });
        recipeIdMap.set(recipe.id, existing._id);
        continue;
      }
      const createdId = await ctx.db.insert('recipes', {
        ownerType,
        ownerId,
        title: name,
        content: instructions,
        name,
        instructions,
        servings: recipe.servings ?? undefined,
        pricePerServing: recipe.pricePerServing ?? undefined,
        notes: recipe.notes ?? undefined,
        sourceUrl: recipe.sourceUrl ?? undefined,
        tags: recipe.tags ?? undefined,
        searchName: normalize(name),
        createdAt: now,
        updatedAt: now,
      });
      recipeIdMap.set(recipe.id, createdId);
    }

    const ingredientsByRecipe = new Map<string, typeof args.data.recipeIngredients>();
    for (const ingredient of args.data.recipeIngredients ?? []) {
      const list = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
      list.push(ingredient);
      ingredientsByRecipe.set(ingredient.recipeId, list);
    }
    for (const [localRecipeId, serverRecipeId] of recipeIdMap.entries()) {
      const existingIngredients = await ctx.db
        .query('recipeIngredients')
        .withIndex('by_recipe', (q) => q.eq('recipeId', serverRecipeId))
        .collect();
      for (const ing of existingIngredients) {
        await ctx.db.delete(ing._id);
      }
      const localIngredients = ingredientsByRecipe.get(localRecipeId) ?? [];
      for (const ing of localIngredients) {
        await ctx.db.insert('recipeIngredients', {
          ownerType,
          ownerId,
          recipeId: serverRecipeId,
          name: ing.name,
          quantity: ing.quantity ?? undefined,
          unit: ing.unit ?? undefined,
        });
      }
    }

    const existingPlans = await ctx.db
      .query('mealPlans')
      .filter((q) => q.and(q.eq(q.field('ownerType'), ownerType), q.eq(q.field('ownerId'), ownerId)))
      .collect();
    const planByWeek = new Map(existingPlans.map((plan) => [plan.weekStart, plan]));
    const planIdMap = new Map<string, any>();

    for (const plan of args.data.mealPlans ?? []) {
      const existing = planByWeek.get(plan.weekStart);
      if (existing) {
        planIdMap.set(plan.id, existing._id);
        continue;
      }
      const createdId = await ctx.db.insert('mealPlans', {
        ownerType,
        ownerId,
        weekStart: plan.weekStart,
        createdAt: now,
        updatedAt: now,
      });
      planIdMap.set(plan.id, createdId);
    }

    const itemsByPlan = new Map<string, typeof args.data.mealPlanItems>();
    for (const item of args.data.mealPlanItems ?? []) {
      const list = itemsByPlan.get(item.mealPlanId) ?? [];
      list.push(item);
      itemsByPlan.set(item.mealPlanId, list);
    }

    const listByPlan = new Map<string, typeof args.data.shoppingListItems>();
    for (const item of args.data.shoppingListItems ?? []) {
      const list = listByPlan.get(item.mealPlanId) ?? [];
      list.push(item);
      listByPlan.set(item.mealPlanId, list);
    }

    for (const [localPlanId, serverPlanId] of planIdMap.entries()) {
      const existingItems = await ctx.db
        .query('mealPlanItems')
        .withIndex('by_plan', (q) => q.eq('mealPlanId', serverPlanId))
        .collect();
      for (const item of existingItems) {
        await ctx.db.delete(item._id);
      }

      for (const item of itemsByPlan.get(localPlanId) ?? []) {
        await ctx.db.insert('mealPlanItems', {
          ownerType,
          ownerId,
          mealPlanId: serverPlanId,
          recipeId: item.recipeId ? recipeIdMap.get(item.recipeId) : undefined,
          title: item.title,
          day: item.day,
          slot: item.slot ?? undefined,
          notes: item.notes ?? undefined,
          mealType: toMealType(item.mealType ?? null),
        });
      }

      const existingShopping = await ctx.db
        .query('shoppingListItems')
        .withIndex('by_plan', (q) => q.eq('mealPlanId', serverPlanId))
        .collect();
      for (const item of existingShopping) {
        await ctx.db.delete(item._id);
      }

      for (const item of listByPlan.get(localPlanId) ?? []) {
        await ctx.db.insert('shoppingListItems', {
          ownerType,
          ownerId,
          mealPlanId: serverPlanId,
          itemName: item.itemName,
          quantity: item.quantity ?? undefined,
          unit: item.unit ?? undefined,
          estimatedCost: item.estimatedCost ?? undefined,
          priceSource: undefined,
          isChecked: Boolean(item.isChecked),
        });
      }
    }

    for (const card of args.data.creditCards ?? []) {
      await ctx.db.insert('creditCards', {
        ownerType,
        ownerId,
        name: card.name,
        dueDate: card.dueDate,
        minimumPayment: card.minimumPayment ?? undefined,
        statementBalance: card.statementBalance ?? undefined,
        lastStatementDate: card.lastStatementDate ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const mergeDeviceToUser = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error('Not authorized');

    const now = Date.now();
    const device = await ctx.db
      .query('userDevices')
      .filter((q) => q.eq(q.field('deviceId'), args.deviceId))
      .first();
    if (device?.mergedToUserId === auth.subject) {
      return;
    }

    if (device) {
      await ctx.db.patch(device._id, {
        ownerType: 'user',
        ownerId: auth.subject,
        mergedToUserId: auth.subject,
        updatedAt: now,
      });
    }

    const reassign = async (table: any) => {
      const docs = await ctx.db
        .query(table)
        .filter((q) =>
          q.and(
            q.eq(q.field('ownerType'), 'device'),
            q.eq(q.field('ownerId'), args.deviceId)
          )
        )
        .collect();
      for (const doc of docs) {
        await ctx.db.patch(doc._id, {
          ownerType: 'user',
          ownerId: auth.subject,
        });
      }
    };

    await reassign('plaidItems');
    await reassign('plaidAccounts');
    await reassign('syncState');
    await reassign('transactions');
    await reassign('merchantRules');
    await reassign('categories');
    await reassign('budgets');
    await reassign('budgetSettings');
    await reassign('receipts');
    await reassign('receiptLineItems');
    await reassign('receiptLinks');
    await reassign('transactionSplits');
    await reassign('recipes');
    await reassign('recipeIngredients');
    await reassign('mealPlans');
    await reassign('mealPlanItems');
    await reassign('shoppingListItems');
    await reassign('pantryItems');
    await reassign('canonicalItems');
    await reassign('itemPrices');
    await reassign('creditCards');
    await reassign('notificationSettings');
    await reassign('devices');

    if (isFamilyModeEnabled()) {
      const familyId = await ensureFamilyForUser(ctx, auth.subject, now);
      await migrateOwnerData(
        ctx,
        { ownerType: 'user', ownerId: auth.subject },
        { ownerType: 'family', ownerId: String(familyId) }
      );

      const refreshedDevice = await ctx.db
        .query('userDevices')
        .filter((q) => q.eq(q.field('deviceId'), args.deviceId))
        .first();
      if (refreshedDevice) {
        await ctx.db.patch(refreshedDevice._id, {
          ownerType: 'family',
          ownerId: String(familyId),
          updatedAt: now,
        });
      }
    }
  },
});
