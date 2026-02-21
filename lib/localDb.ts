import { formatPeriodDate as formatDate, getCurrentPeriod, getPeriodForOffset } from './budgetPeriods';
import { normalizeRecipeIngredientsForSave } from '../convex/lib/recipeValidation';
import { normalizeItemName, normalizeQuantity, roundQuantity, type UnitKind } from '../convex/lib/normalize';

type SqliteDbLike = {
  runAsync: (sql: string, params?: any[]) => Promise<unknown>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
};

type SqliteModuleLike = {
  openDatabaseSync: (name: string) => SqliteDbLike;
};

const DB_NAME = 'grocerybudget.db';

let dbInstance: SqliteDbLike | null = null;

function getSQLiteModule(): SqliteModuleLike {
  try {
    const mod = require('expo-sqlite') as SqliteModuleLike | undefined;
    if (!mod || typeof mod.openDatabaseSync !== 'function') {
      throw new Error('expo-sqlite is unavailable in this runtime.');
    }
    return mod;
  } catch {
    throw new Error(
      'Local database is unavailable because Expo SQLite is not installed in this client. Update Expo Go to a compatible version or run a development build.'
    );
  }
}

function getDb() {
  if (!dbInstance) {
    const sqlite = getSQLiteModule();
    dbInstance = sqlite.openDatabaseSync(DB_NAME);
  }
  return dbInstance;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function runSql(sql: string, params: any[] = []) {
  const db = getDb();
  return db.runAsync(sql, params);
}

async function getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getDb();
  return db.getAllAsync<T>(sql, params);
}

async function getFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await getAll<T>(sql, params);
  return rows.length ? rows[0] : null;
}

async function setMeta(key: string, value: string) {
  await runSql(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  );
  await runSql(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

async function getMeta(key: string) {
  await runSql(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  );
  const row = await getFirst<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function ensureColumn(table: string, column: string, definition: string) {
  const info = await getAll<{ name: string }>(`PRAGMA table_info(${table})`);
  const hasColumn = info.some((row) => row.name === column);
  if (!hasColumn) {
    await runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function normalizeLocalCategoryKind(kind?: string | null) {
  if (kind === 'income' || kind === 'transfer' || kind === 'expense') return kind;
  return null;
}

function normalizeRecipeName(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function parseRecipeTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  } catch {
    return [];
  }
}

function stringifyRecipeTags(tags?: string[] | null) {
  if (!tags?.length) return null;
  const normalized = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
  return normalized.length ? JSON.stringify(normalized) : null;
}

function getLocalCategoryKind(category: { name?: string | null; categoryKind?: string | null }) {
  const explicit = normalizeLocalCategoryKind(category.categoryKind);
  if (explicit) return explicit;
  const normalizedName = (category.name ?? '').trim().toLowerCase();
  if (normalizedName === 'transfer') return 'transfer';
  if (normalizedName === 'income') return 'income';
  return 'expense';
}

function isLocalExpenseCategory(category: { name?: string | null; categoryKind?: string | null }) {
  return getLocalCategoryKind(category) === 'expense';
}

export function buildLocalCategoryKindSets(
  categories: Array<{ id: string; name?: string | null; categoryKind?: string | null }>
) {
  const expenseIds = new Set<string>();
  const incomeIds = new Set<string>();
  const transferIds = new Set<string>();
  for (const category of categories) {
    const kind = getLocalCategoryKind(category);
    if (kind === 'income') incomeIds.add(category.id);
    else if (kind === 'transfer') transferIds.add(category.id);
    else expenseIds.add(category.id);
  }
  return { expenseIds, incomeIds, transferIds };
}

export function summarizeLocalTransactionsByKind(
  transactions: Array<{ categoryId?: string | null; amount: number }>,
  kindSets: { expenseIds: Set<string>; incomeIds: Set<string>; transferIds: Set<string> }
) {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let transferTotal = 0;
  const expenseByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    if (kindSets.incomeIds.has(tx.categoryId)) {
      incomeTotal += tx.amount;
      continue;
    }
    if (kindSets.transferIds.has(tx.categoryId)) {
      transferTotal += tx.amount;
      continue;
    }
    if (kindSets.expenseIds.has(tx.categoryId)) {
      expenseTotal += tx.amount;
      expenseByCategory.set(tx.categoryId, (expenseByCategory.get(tx.categoryId) ?? 0) + tx.amount);
    }
  }
  return { expenseTotal, incomeTotal, transferTotal, expenseByCategory };
}

export async function initLocalDb() {
  await runSql('PRAGMA journal_mode = WAL');
  await runSql(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, categoryKind TEXT DEFAULT "expense", parentId TEXT, sortOrder INTEGER DEFAULT 0, rolloverMode TEXT, carryoverAdjustment REAL DEFAULT 0, isDefault INTEGER DEFAULT 0, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgetSettings (id INTEGER PRIMARY KEY NOT NULL, cycleLengthDays INTEGER NOT NULL, anchorDate TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY NOT NULL, categoryId TEXT NOT NULL, periodStart TEXT NOT NULL, periodLengthDays INTEGER NOT NULL, amount REAL NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgetCycleSnapshots (id TEXT PRIMARY KEY NOT NULL, periodStart TEXT NOT NULL, periodEnd TEXT NOT NULL, periodLengthDays INTEGER NOT NULL, totalBudgetBase REAL NOT NULL, totalSpent REAL NOT NULL, overUnderBase REAL NOT NULL, carryoverPositiveTotal REAL NOT NULL, carryoverNegativeTotal REAL NOT NULL, carryoverNetTotal REAL NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgetCategoryCycleSnapshots (id TEXT PRIMARY KEY NOT NULL, periodStart TEXT NOT NULL, categoryId TEXT NOT NULL, categoryName TEXT NOT NULL, rolloverMode TEXT NOT NULL, budgetBase REAL NOT NULL, spent REAL NOT NULL, remainingBase REAL NOT NULL, carryoverAppliedIn REAL NOT NULL, carryoverOut REAL NOT NULL, carryoverRunningTotal REAL NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE INDEX IF NOT EXISTS idx_budgetCycleSnapshots_periodStart ON budgetCycleSnapshots (periodStart)'
  );
  await runSql(
    'CREATE INDEX IF NOT EXISTS idx_budgetCategoryCycleSnapshots_period_category ON budgetCategoryCycleSnapshots (periodStart, categoryId)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL, categoryId TEXT, pending INTEGER DEFAULT 0, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, servings REAL, notes TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS recipeIngredients (id TEXT PRIMARY KEY NOT NULL, recipeId TEXT NOT NULL, name TEXT NOT NULL, quantity REAL, unit TEXT)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS mealPlans (id TEXT PRIMARY KEY NOT NULL, weekStart TEXT NOT NULL, planningMode TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS mealPlanItems (id TEXT PRIMARY KEY NOT NULL, mealPlanId TEXT NOT NULL, recipeId TEXT, title TEXT NOT NULL, day TEXT NOT NULL, slot TEXT, notes TEXT)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS shoppingListItems (id TEXT PRIMARY KEY NOT NULL, mealPlanId TEXT NOT NULL, itemName TEXT NOT NULL, quantity REAL, unit TEXT, estimatedCost REAL, priceSource TEXT, isChecked INTEGER DEFAULT 0, inPantry INTEGER DEFAULT 0)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS creditCards (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, dueDate TEXT NOT NULL, minimumPayment REAL, statementBalance REAL, lastStatementDate TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );

  await ensureColumn('mealPlanItems', 'slot', 'TEXT');
  await ensureColumn('mealPlanItems', 'recipeId', 'TEXT');
  await ensureColumn('mealPlanItems', 'mealType', 'TEXT');
  await ensureColumn('mealPlans', 'planningMode', 'TEXT');
  await ensureColumn('recipes', 'sourceUrl', 'TEXT');
  await ensureColumn('recipes', 'name', 'TEXT');
  await ensureColumn('recipes', 'instructions', 'TEXT');
  await ensureColumn('recipes', 'pricePerServing', 'REAL');
  await ensureColumn('recipes', 'tags', 'TEXT');
  await ensureColumn('recipes', 'searchName', 'TEXT');
  await ensureColumn('budgetSettings', 'monthlyIncome', 'REAL DEFAULT 0');
  await ensureColumn('categories', 'categoryKind', 'TEXT DEFAULT "expense"');
  await ensureColumn('categories', 'carryoverAdjustment', 'REAL DEFAULT 0');

  await ensureBudgetSettings();
  await ensureIncomeCategory();
}

async function ensureBudgetSettings() {
  const existing = await getFirst<LocalBudgetSettings>('SELECT * FROM budgetSettings LIMIT 1');
  if (existing) return existing;
  const now = new Date();
  const anchorDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const record = {
    id: 1,
    cycleLengthDays: 30,
    anchorDate: formatDate(anchorDate),
    monthlyIncome: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await runSql(
    'INSERT INTO budgetSettings (id, cycleLengthDays, anchorDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [record.id, record.cycleLengthDays, record.anchorDate, record.createdAt, record.updatedAt]
  );
  return record;
}

async function ensureIncomeCategory() {
  const existing = await getFirst<LocalCategory>(
    "SELECT * FROM categories WHERE parentId IS NULL AND (categoryKind = 'income' OR lower(name) = 'income') LIMIT 1"
  );
  const now = Date.now();
  if (existing) {
    if (existing.categoryKind !== 'income') {
      await runSql('UPDATE categories SET categoryKind = ?, updatedAt = ? WHERE id = ?', [
        'income',
        now,
        existing.id,
      ]);
    }
    return existing;
  }
  const id = makeId('cat');
  await runSql(
    'INSERT INTO categories (id, name, categoryKind, parentId, sortOrder, rolloverMode, carryoverAdjustment, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, 'Income', 'income', null, 0, 'none', 0, 1, now, now]
  );
  return { id, name: 'Income', categoryKind: 'income', createdAt: now, updatedAt: now } as LocalCategory;
}

async function markLocalDirty() {
  await setMeta('localDirty', '1');
}

export async function isLocalDirty() {
  return (await getMeta('localDirty')) === '1';
}

export async function clearLocalDirty() {
  await setMeta('localDirty', '0');
}

export async function getBudgetSettings() {
  return ensureBudgetSettings();
}

export async function updateBudgetSettings(cycleLengthDays: number, anchorDate: string, monthlyIncome?: number) {
  const settings = await ensureBudgetSettings();
  if (monthlyIncome !== undefined) {
    await runSql(
      'UPDATE budgetSettings SET cycleLengthDays = ?, anchorDate = ?, monthlyIncome = ?, updatedAt = ? WHERE id = ?',
      [Math.round(cycleLengthDays), anchorDate, monthlyIncome, Date.now(), settings.id]
    );
  } else {
    await runSql(
      'UPDATE budgetSettings SET cycleLengthDays = ?, anchorDate = ?, updatedAt = ? WHERE id = ?',
      [Math.round(cycleLengthDays), anchorDate, Date.now(), settings.id]
    );
  }
  await markLocalDirty();
}

export async function getBudgetHierarchy() {
  const settings = await ensureBudgetSettings();
  const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const categories = allCategories.filter((cat) => isLocalExpenseCategory(cat));
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]));

  const byParent = new Map<string, LocalCategory[]>();
  for (const cat of categories) {
    if (!cat.parentId) continue;
    const list = byParent.get(cat.parentId) ?? [];
    list.push(cat);
    byParent.set(cat.parentId, list);
  }

  const topLevel = categories.filter((cat) => !cat.parentId);
  const items = topLevel.map((cat) => {
    const children = byParent.get(cat.id) ?? [];
    const childItems = children.map((child) => ({
      categoryId: child.id,
      name: child.name,
      amount: budgetMap.get(child.id) ?? 0,
      rolloverMode: child.rolloverMode ?? 'none',
    }));
    const childTotal = childItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      categoryId: cat.id,
      name: cat.name,
      amount: budgetMap.get(cat.id) ?? 0,
      rolloverMode: cat.rolloverMode ?? 'none',
      childTotal,
      children: childItems,
    };
  });

  return { periodStart, items };
}

export async function getBudgetHierarchyWithSpent() {
  const settings = await ensureBudgetSettings();
  const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const { periodStart: previousPeriodStart } = getPeriodForOffset(
    settings.anchorDate,
    settings.cycleLengthDays,
    new Date(periodStart),
    -1
  );
  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const categories = allCategories.filter((cat) => isLocalExpenseCategory(cat));
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const carryoverRows = await getAll<LocalBudgetCategoryCycleSnapshot>(
    'SELECT categoryId, carryoverRunningTotal FROM budgetCategoryCycleSnapshots WHERE periodStart = ?',
    [previousPeriodStart]
  );
  const carryoverMap = new Map(carryoverRows.map((row) => [row.categoryId, row.carryoverRunningTotal]));

  const transactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [periodStart, periodEnd]
  );
  const kindSets = buildLocalCategoryKindSets(allCategories);
  const totals = summarizeLocalTransactionsByKind(
    transactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
    kindSets
  );
  const spentByCategory = totals.expenseByCategory;

  const byParent = new Map<string, LocalCategory[]>();
  for (const cat of categories) {
    if (!cat.parentId) continue;
    const list = byParent.get(cat.parentId) ?? [];
    list.push(cat);
    byParent.set(cat.parentId, list);
  }

  const topLevel = categories.filter((cat) => !cat.parentId);
  const items = topLevel.map((cat) => {
    const children = byParent.get(cat.id) ?? [];
    const childItems = children.map((child) => ({
      categoryId: child.id,
      name: child.name,
      amount: budgetMap.get(child.id) ?? 0,
      spent: spentByCategory.get(child.id) ?? 0,
      rolloverMode: child.rolloverMode ?? 'none',
      carryoverBase: carryoverMap.get(child.id) ?? 0,
      carryoverAdjustment: child.carryoverAdjustment ?? 0,
      carryoverCurrent: (carryoverMap.get(child.id) ?? 0) + (child.carryoverAdjustment ?? 0),
    }));
    const childTotal = childItems.reduce((sum, item) => sum + item.amount, 0);
    const childSpentTotal = childItems.reduce((sum, item) => sum + item.spent, 0);
    const carryoverBase = carryoverMap.get(cat.id) ?? 0;
    const carryoverAdjustment = cat.carryoverAdjustment ?? 0;
    return {
      categoryId: cat.id,
      name: cat.name,
      amount: budgetMap.get(cat.id) ?? 0,
      spent: (spentByCategory.get(cat.id) ?? 0) + childSpentTotal,
      rolloverMode: cat.rolloverMode ?? 'none',
      carryoverBase,
      carryoverAdjustment,
      carryoverCurrent: carryoverBase + carryoverAdjustment,
      childTotal,
      children: childItems,
    };
  });

  return {
    periodStart,
    periodEnd,
    monthlyIncome: settings.monthlyIncome ?? 0,
    incomeTotal: totals.incomeTotal,
    items,
  };
}

export async function getBudgetAllocation(parentCategoryId: string) {
  const settings = await ensureBudgetSettings();
  const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const parent = await getFirst<LocalCategory>('SELECT * FROM categories WHERE id = ?', [parentCategoryId]);
  if (!parent) throw new Error('Category not found');
  if (!isLocalExpenseCategory(parent)) throw new Error('Budgets can only be set on expense categories.');

  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const children = (await getAll<LocalCategory>('SELECT * FROM categories WHERE parentId = ?', [parent.id])).filter(
    (child) => isLocalExpenseCategory(child)
  );

  return {
    periodStart,
    parent: {
      categoryId: parent.id,
      name: parent.name,
      amount: budgetMap.get(parent.id) ?? 0,
      rolloverMode: parent.rolloverMode ?? 'none',
    },
    children: children.map((child) => ({
      categoryId: child.id,
      name: child.name,
      amount: budgetMap.get(child.id) ?? 0,
      rolloverMode: child.rolloverMode ?? 'none',
    })),
  };
}

export async function upsertBudget(categoryId: string, amount: number) {
  const category = await getFirst<LocalCategory>('SELECT * FROM categories WHERE id = ?', [categoryId]);
  if (!category) throw new Error('Category not found');
  if (!isLocalExpenseCategory(category)) throw new Error('Budgets can only be set on expense categories.');
  const settings = await ensureBudgetSettings();
  const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const now = Date.now();
  const existing = await getFirst<LocalBudget>(
    'SELECT * FROM budgets WHERE categoryId = ? AND periodStart = ? LIMIT 1',
    [categoryId, periodStart]
  );
  if (existing) {
    await runSql('UPDATE budgets SET amount = ?, updatedAt = ? WHERE id = ?', [amount, now, existing.id]);
  } else {
    await runSql(
      'INSERT INTO budgets (id, categoryId, periodStart, periodLengthDays, amount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [makeId('budget'), categoryId, periodStart, settings.cycleLengthDays, amount, now, now]
    );
  }
  await markLocalDirty();
}

export async function updateBudgetAllocations(parentCategoryId: string, parentAmount: number, allocations: { categoryId: string; amount: number }[]) {
  const parent = await getFirst<LocalCategory>('SELECT * FROM categories WHERE id = ?', [parentCategoryId]);
  if (!parent) throw new Error('Category not found');
  if (!isLocalExpenseCategory(parent)) throw new Error('Budgets can only be set on expense categories.');

  const children = (await getAll<LocalCategory>('SELECT * FROM categories WHERE parentId = ?', [parentCategoryId])).filter(
    (child) => isLocalExpenseCategory(child)
  );
  const childIds = new Set(children.map((child) => child.id));
  if (allocations.length !== children.length) {
    throw new Error('All subcategories must be allocated.');
  }
  for (const alloc of allocations) {
    if (!childIds.has(alloc.categoryId)) {
      throw new Error('Allocation contains invalid subcategory.');
    }
  }
  const sum = allocations.reduce((total, alloc) => total + alloc.amount, 0);
  if (Math.abs(sum - parentAmount) > 0.01) {
    throw new Error('Subcategory totals must match the parent budget.');
  }

  await upsertBudget(parentCategoryId, parentAmount);
  for (const alloc of allocations) {
    await upsertBudget(alloc.categoryId, alloc.amount);
  }
}

export async function getCategories() {
  const rows = await getAll<LocalCategory>('SELECT * FROM categories ORDER BY name');
  return rows.map((row) => ({ ...row, _id: row.id, categoryKind: getLocalCategoryKind(row) }));
}

export async function createCategory(
  name: string,
  parentId?: string | null,
  categoryKind: 'expense' | 'income' | 'transfer' = 'expense'
) {
  const trimmed = name.trim();
  if (!trimmed.length) throw new Error('Category name is required.');
  if (parentId && parentId === '') parentId = null;
  const lower = trimmed.toLowerCase();
  const inferredKind: 'expense' | 'income' | 'transfer' =
    lower === 'income' ? 'income' : lower === 'transfer' ? 'transfer' : 'expense';
  const resolvedKind = categoryKind === 'expense' ? inferredKind : categoryKind;
  const now = Date.now();
  await runSql(
    'INSERT INTO categories (id, name, categoryKind, parentId, sortOrder, rolloverMode, carryoverAdjustment, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [makeId('cat'), trimmed, resolvedKind, parentId ?? null, 0, 'none', 0, 0, now, now]
  );
  await markLocalDirty();
}

export async function updateCategory(id: string, name: string, parentId?: string | null) {
  const trimmed = name.trim();
  if (!trimmed.length) throw new Error('Category name is required.');
  if (parentId && parentId === id) throw new Error('Category cannot be its own parent.');
  await runSql(
    'UPDATE categories SET name = ?, parentId = ?, updatedAt = ? WHERE id = ?',
    [trimmed, parentId ?? null, Date.now(), id]
  );
  await markLocalDirty();
}

export async function setCategoryRolloverMode(id: string, mode: string) {
  await runSql('UPDATE categories SET rolloverMode = ?, updatedAt = ? WHERE id = ?', [mode, Date.now(), id]);
  await markLocalDirty();
}

export async function setCategoryCarryoverAdjustment(id: string, carryoverAdjustment: number) {
  await runSql('UPDATE categories SET carryoverAdjustment = ?, updatedAt = ? WHERE id = ?', [
    carryoverAdjustment,
    Date.now(),
    id,
  ]);
  await markLocalDirty();
}

export async function removeCategory(id: string) {
  const category = await getFirst<LocalCategory>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!category) throw new Error('Category not found.');
  if (category.isDefault) throw new Error('Default categories cannot be deleted.');

  const child = await getFirst<LocalCategory>('SELECT * FROM categories WHERE parentId = ? LIMIT 1', [id]);
  if (child) throw new Error('Delete subcategories first.');

  const budget = await getFirst<LocalBudget>('SELECT * FROM budgets WHERE categoryId = ? LIMIT 1', [id]);
  if (budget) throw new Error('Category has budgets. Remove budgets first.');

  const transaction = await getFirst<LocalTransaction>('SELECT * FROM transactions WHERE categoryId = ? LIMIT 1', [id]);
  if (transaction) throw new Error('Category is used by transactions.');

  await runSql('DELETE FROM categories WHERE id = ?', [id]);
  await markLocalDirty();
}

export async function listTransactions(args: {
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  uncategorizedOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
  pending?: boolean;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  if (args.startDate) {
    conditions.push('date >= ?');
    params.push(args.startDate);
  }
  if (args.endDate) {
    conditions.push('date <= ?');
    params.push(args.endDate);
  }
  if (args.uncategorizedOnly) {
    conditions.push('categoryId IS NULL');
  } else if (args.categoryId) {
    conditions.push('categoryId = ?');
    params.push(args.categoryId);
  }
  if (args.minAmount !== undefined) {
    conditions.push('amount >= ?');
    params.push(args.minAmount);
  }
  if (args.maxAmount !== undefined) {
    conditions.push('amount <= ?');
    params.push(args.maxAmount);
  }
  if (args.pending !== undefined) {
    conditions.push('pending = ?');
    params.push(args.pending ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = args.limit ?? 50;
  const rows = await getAll<LocalTransaction>(
    `SELECT * FROM transactions ${where} ORDER BY date DESC`,
    params
  );

  const categories = await getAll<LocalCategory>('SELECT * FROM categories');
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let filtered = rows;
  if (args.search) {
    const needle = args.search.toLowerCase();
    filtered = filtered.filter((row) => row.name.toLowerCase().includes(needle));
  }
  if (filtered.length > limit) {
    filtered = filtered.slice(0, limit);
  }

  return {
    items: filtered.map((tx) => ({
      _id: tx.id,
      name: tx.name,
      date: tx.date,
      amount: tx.amount,
      categoryId: tx.categoryId ?? undefined,
      categoryName: tx.categoryId ? categoryMap.get(tx.categoryId)?.name : undefined,
      pending: Boolean(tx.pending),
    })),
  };
}

export async function createTransaction(args: {
  name: string;
  amount: number;
  date: string;
  categoryId?: string | null;
  pending?: boolean;
}) {
  const now = Date.now();
  await runSql(
    'INSERT INTO transactions (id, name, date, amount, categoryId, pending, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      makeId('tx'),
      args.name.trim(),
      args.date.trim(),
      args.amount,
      args.categoryId ?? null,
      args.pending ? 1 : 0,
      now,
      now,
    ]
  );
  await markLocalDirty();
}

export async function setTransactionCategory(transactionId: string, categoryId: string | null) {
  await runSql(
    'UPDATE transactions SET categoryId = ?, updatedAt = ? WHERE id = ?',
    [categoryId ?? null, Date.now(), transactionId]
  );
  await markLocalDirty();
}

export async function listRecipes() {
  const rows = await getAll<LocalRecipe>('SELECT * FROM recipes ORDER BY updatedAt DESC');
  return rows.map((row) => ({
    ...row,
    name: row.name ?? row.title ?? 'Recipe',
    instructions: row.instructions ?? row.content ?? '',
    tags: parseRecipeTags(row.tags),
    _id: row.id,
  }));
}

export async function createRecipe(args: {
  name: string;
  instructions?: string;
  servings?: number | null;
  pricePerServing?: number | null;
  notes?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}) {
  const now = Date.now();
  const id = makeId('recipe');
  const name = args.name.trim() || 'Recipe';
  const instructions = args.instructions ?? '';
  const tags = stringifyRecipeTags(args.tags);
  await runSql(
    'INSERT INTO recipes (id, title, content, name, instructions, servings, pricePerServing, notes, sourceUrl, tags, searchName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      name,
      instructions,
      name,
      instructions,
      args.servings ?? null,
      args.pricePerServing ?? null,
      args.notes ?? null,
      args.sourceUrl ?? null,
      tags,
      normalizeRecipeName(name),
      now,
      now,
    ]
  );
  await markLocalDirty();
  return id;
}

export async function updateRecipe(args: {
  recipeId: string;
  name: string;
  instructions: string;
  servings?: number | null;
  pricePerServing?: number | null;
  notes?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}) {
  const name = args.name.trim() || 'Recipe';
  const instructions = args.instructions;
  const tags = stringifyRecipeTags(args.tags);
  await runSql(
    'UPDATE recipes SET title = ?, content = ?, name = ?, instructions = ?, servings = ?, pricePerServing = ?, notes = ?, sourceUrl = ?, tags = ?, searchName = ?, updatedAt = ? WHERE id = ?',
    [
      name,
      instructions,
      name,
      instructions,
      args.servings ?? null,
      args.pricePerServing ?? null,
      args.notes ?? null,
      args.sourceUrl ?? null,
      tags,
      normalizeRecipeName(name),
      Date.now(),
      args.recipeId,
    ]
  );
  await markLocalDirty();
}

export async function setRecipeIngredients(args: {
  recipeId: string;
  ingredients: { name: string; quantity?: number | null; unit?: string | null }[];
}) {
  const normalizedIngredients = normalizeRecipeIngredientsForSave(args.ingredients, {
    requireAmount: true,
  });
  if (normalizedIngredients.blankNameIndexes.length > 0) {
    throw new Error('Each ingredient must include a name.');
  }
  if (normalizedIngredients.missingAmountIndexes.length > 0) {
    throw new Error('Each ingredient must include an amount before saving.');
  }

  await runSql('DELETE FROM recipeIngredients WHERE recipeId = ?', [args.recipeId]);
  for (const ingredient of normalizedIngredients.ingredients) {
    const name = ingredient.name.trim();
    await runSql(
      'INSERT INTO recipeIngredients (id, recipeId, name, quantity, unit) VALUES (?, ?, ?, ?, ?)',
      [
        makeId('ing'),
        args.recipeId,
        name,
        ingredient.quantity ?? null,
        ingredient.unit ?? null,
      ]
    );
  }
  await markLocalDirty();
}

export async function getRecipeDetail(recipeId: string) {
  const recipe = await getFirst<LocalRecipe>('SELECT * FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) return null;
  const ingredients = await getAll<LocalRecipeIngredient>(
    'SELECT * FROM recipeIngredients WHERE recipeId = ?',
    [recipeId]
  );
  return {
    recipe: {
      ...recipe,
      name: recipe.name ?? recipe.title ?? 'Recipe',
      instructions: recipe.instructions ?? recipe.content ?? '',
      tags: parseRecipeTags(recipe.tags),
      _id: recipe.id,
    },
    ingredients: ingredients.map((ing) => ({ ...ing, _id: ing.id })),
  };
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getCandidateWeekStarts(date = new Date()) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const candidates: string[] = [];
  for (let daysBack = 0; daysBack < 7; daysBack += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - daysBack);
    candidates.push(formatDate(d));
  }
  return candidates;
}

async function getOrCreateMealPlan(weekStart?: string) {
  const weekKey = weekStart ?? formatDate(getWeekStart());
  let plan = await getFirst<LocalMealPlan>('SELECT * FROM mealPlans WHERE weekStart = ?', [weekKey]);
  if (plan) return plan;
  const now = Date.now();
  const id = makeId('mealplan');
  await runSql(
    'INSERT INTO mealPlans (id, weekStart, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    [id, weekKey, now, now]
  );
  plan = {
    id,
    weekStart: weekKey,
    createdAt: now,
    updatedAt: now,
  };
  await markLocalDirty();
  return plan;
}

async function getCurrentCandidateMealPlan() {
  const candidates = getCandidateWeekStarts();
  const placeholders = candidates.map(() => '?').join(', ');
  return await getFirst<LocalMealPlan>(
    `SELECT * FROM mealPlans WHERE weekStart IN (${placeholders}) ORDER BY weekStart DESC LIMIT 1`,
    candidates
  );
}

async function resolveCurrentWeekPlanForShopping(createIfMissing: boolean, weekStart?: string) {
  if (weekStart) {
    if (createIfMissing) return await getOrCreateMealPlan(weekStart);
    return await getFirst<LocalMealPlan>('SELECT * FROM mealPlans WHERE weekStart = ?', [weekStart]);
  }

  const currentCandidate = await getCurrentCandidateMealPlan();
  if (currentCandidate) return currentCandidate;
  if (!createIfMissing) return null;
  return await getOrCreateMealPlan();
}

export async function getCurrentWeekPlan() {
  let plan = await getCurrentCandidateMealPlan();
  if (!plan) {
    plan = await getOrCreateMealPlan();
  }
  const items = await getAll<LocalMealPlanItem>('SELECT * FROM mealPlanItems WHERE mealPlanId = ?', [plan.id]);
  return {
    weekStart: plan.weekStart,
    planningMode: plan.planningMode ?? undefined,
    items: items.map((item) => ({ ...item, _id: item.id })),
  };
}

export async function getWeekPlan(weekStart: string) {
  const plan = await getOrCreateMealPlan(weekStart);
  const items = await getAll<LocalMealPlanItem>('SELECT * FROM mealPlanItems WHERE mealPlanId = ?', [plan.id]);
  return {
    weekStart: plan.weekStart,
    planningMode: plan.planningMode ?? undefined,
    items: items.map((item) => ({ ...item, _id: item.id })),
  };
}

export async function setMealPlanMode(weekStart: string, planningMode: 'all' | 'lunchDinner' | 'dinnerOnly') {
  const plan = await getOrCreateMealPlan(weekStart);
  await runSql('UPDATE mealPlans SET planningMode = ?, updatedAt = ? WHERE id = ?', [
    planningMode,
    Date.now(),
    plan.id,
  ]);
  await markLocalDirty();
}

export async function clearWeekMealPlanItems(weekStart: string) {
  const plan = await getOrCreateMealPlan(weekStart);
  await runSql('DELETE FROM mealPlanItems WHERE mealPlanId = ?', [plan.id]);
  await runSql('UPDATE mealPlans SET updatedAt = ? WHERE id = ?', [Date.now(), plan.id]);
  await markLocalDirty();
}

export async function addMealPlanItem(args: {
  title: string;
  day: string;
  slot?: string | null;
  weekStart?: string;
  recipeId?: string | null;
  mealType?: string | null;
}) {
  const plan = await getOrCreateMealPlan(args.weekStart);
  const now = Date.now();
  await runSql(
    'INSERT INTO mealPlanItems (id, mealPlanId, recipeId, title, day, slot, notes, mealType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [makeId('mealitem'), plan.id, args.recipeId ?? null, args.title.trim(), args.day.trim(), args.slot ?? null, null, args.mealType ?? null]
  );
  await runSql('UPDATE mealPlans SET updatedAt = ? WHERE id = ?', [now, plan.id]);
  await markLocalDirty();
}

export async function updateMealPlanItem(args: {
  itemId: string;
  title: string;
  day: string;
  slot?: string | null;
  recipeId?: string | null;
  mealType?: string | null;
}) {
  await runSql(
    'UPDATE mealPlanItems SET title = ?, day = ?, slot = ?, recipeId = ?, mealType = ? WHERE id = ?',
    [args.title.trim(), args.day.trim(), args.slot ?? null, args.recipeId ?? null, args.mealType ?? null, args.itemId]
  );
  await markLocalDirty();
}

export async function deleteMealPlanItem(itemId: string) {
  await runSql('DELETE FROM mealPlanItems WHERE id = ?', [itemId]);
  await markLocalDirty();
}

export async function getShoppingListCurrentWeek() {
  return getShoppingListForWeek();
}

type LocalShoppingListDraftItem = {
  itemName: string;
  quantity?: number;
  unit?: string;
};

export function buildLocalShoppingListDraft(args: {
  planItems: LocalMealPlanItem[];
  recipeIngredientsByRecipeId: Map<string, LocalRecipeIngredient[]>;
}) {
  type AggregatedItem = {
    itemName: string;
    quantity: number;
    unit?: string;
    kind: UnitKind;
    hasUnknownQuantity: boolean;
  };

  const aggregated = new Map<string, AggregatedItem>();
  const addItem = (name: string, quantity?: number | null, unit?: string | null) => {
    const trimmedName = name.trim();
    if (!trimmedName.length) return;
    const normalizedName = normalizeItemName(trimmedName);
    if (!normalizedName) return;

    const normalized = normalizeQuantity(quantity, unit);
    const unitKey =
      normalized.kind === 'unknown' ? `unknown:${normalized.unit ?? ''}` : normalized.kind;
    const key = `${normalizedName}:${unitKey}`;
    const current = aggregated.get(key) ?? {
      itemName: trimmedName,
      quantity: 0,
      unit: normalized.unit,
      kind: normalized.kind,
      hasUnknownQuantity: false,
    };

    if (normalized.quantity === undefined) {
      current.hasUnknownQuantity = true;
    } else {
      current.quantity = roundQuantity(current.quantity + normalized.quantity);
    }
    aggregated.set(key, current);
  };

  const recipePlanItems = args.planItems.filter((item) => !item.mealType || item.mealType === 'recipe');
  for (const item of recipePlanItems) {
    if (item.recipeId) {
      const ingredients = args.recipeIngredientsByRecipeId.get(item.recipeId) ?? [];
      if (ingredients.length) {
        for (const ingredient of ingredients) {
          addItem(ingredient.name, ingredient.quantity, ingredient.unit);
        }
      } else {
        addItem(item.title, 1, 'x');
      }
    } else {
      addItem(item.title, 1, 'x');
    }
  }

  const rows: LocalShoppingListDraftItem[] = [];
  for (const item of aggregated.values()) {
    rows.push({
      itemName: item.itemName,
      quantity: item.hasUnknownQuantity ? undefined : item.quantity,
      unit: item.unit,
    });
  }
  return rows;
}

export async function getShoppingListForWeek(weekStart?: string) {
  const plan = await resolveCurrentWeekPlanForShopping(false, weekStart);
  const resolvedWeekStart = weekStart ?? formatDate(getWeekStart());
  if (!plan) {
    return {
      weekStart: resolvedWeekStart,
      items: [],
      totalEstimatedCost: 0,
    };
  }
  const items = await getAll<LocalShoppingListItem>(
    'SELECT * FROM shoppingListItems WHERE mealPlanId = ?',
    [plan.id]
  );
  const totalEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
  return {
    weekStart: plan.weekStart,
    items: items.map((item) => ({
      _id: item.id,
      itemName: item.itemName,
      quantity: item.quantity ?? undefined,
      unit: item.unit ?? undefined,
      estimatedCost: item.estimatedCost ?? undefined,
      priceSource: item.priceSource ?? undefined,
      isChecked: Boolean(item.isChecked),
      inPantry: Boolean(item.inPantry),
      coverage: item.inPantry ? 'full' : 'none',
    })),
    totalEstimatedCost,
  };
}

export async function generateShoppingListForWeek(weekStart?: string) {
  const plan = await resolveCurrentWeekPlanForShopping(true, weekStart);
  await runSql('DELETE FROM shoppingListItems WHERE mealPlanId = ?', [plan.id]);

  const planItems = await getAll<LocalMealPlanItem>(
    'SELECT * FROM mealPlanItems WHERE mealPlanId = ?',
    [plan.id]
  );
  const recipeIds = Array.from(
    new Set(
      planItems
        .map((item) => item.recipeId)
        .filter((recipeId): recipeId is string => typeof recipeId === 'string' && recipeId.length > 0)
    )
  );

  const recipeIngredientsByRecipeId = new Map<string, LocalRecipeIngredient[]>();
  if (recipeIds.length) {
    const placeholders = recipeIds.map(() => '?').join(', ');
    const ingredients = await getAll<LocalRecipeIngredient>(
      `SELECT * FROM recipeIngredients WHERE recipeId IN (${placeholders})`,
      recipeIds
    );
    for (const ingredient of ingredients) {
      const current = recipeIngredientsByRecipeId.get(ingredient.recipeId) ?? [];
      current.push(ingredient);
      recipeIngredientsByRecipeId.set(ingredient.recipeId, current);
    }
  }

  const rows = buildLocalShoppingListDraft({
    planItems,
    recipeIngredientsByRecipeId,
  });

  for (const row of rows) {
    await runSql(
      'INSERT INTO shoppingListItems (id, mealPlanId, itemName, quantity, unit, estimatedCost, priceSource, isChecked, inPantry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [makeId('shopitem'), plan.id, row.itemName, row.quantity ?? null, row.unit ?? null, null, null, 0, 0]
    );
  }
  await markLocalDirty();
}

export async function addShoppingListItem(args: {
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  estimatedCost?: number | null;
}) {
  const plan = await getOrCreateMealPlan();
  await runSql(
    'INSERT INTO shoppingListItems (id, mealPlanId, itemName, quantity, unit, estimatedCost, priceSource, isChecked, inPantry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      makeId('shopitem'),
      plan.id,
      args.itemName.trim(),
      args.quantity ?? null,
      args.unit ?? null,
      args.estimatedCost ?? null,
      null,
      0,
      0,
    ]
  );
  await markLocalDirty();
}

export async function setShoppingListItemChecked(itemId: string, isChecked: boolean) {
  await runSql('UPDATE shoppingListItems SET isChecked = ? WHERE id = ?', [isChecked ? 1 : 0, itemId]);
  await markLocalDirty();
}

export async function updateShoppingListItem(args: {
  itemId: string;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  estimatedCost?: number | null;
}) {
  const trimmedName = args.itemName.trim();
  if (!trimmedName.length) {
    throw new Error('Item name is required');
  }
  await runSql(
    'UPDATE shoppingListItems SET itemName = ?, quantity = ?, unit = ?, estimatedCost = ? WHERE id = ?',
    [trimmedName, args.quantity ?? null, args.unit ?? null, args.estimatedCost ?? null, args.itemId]
  );
  await markLocalDirty();
}

export async function deleteShoppingListItem(itemId: string) {
  await runSql('DELETE FROM shoppingListItems WHERE id = ?', [itemId]);
  await markLocalDirty();
}

export async function moveShoppingListItemToPantry(itemId: string) {
  await runSql('UPDATE shoppingListItems SET inPantry = 1 WHERE id = ?', [itemId]);
  await markLocalDirty();
}

export async function listCreditCards() {
  const rows = await getAll<LocalCreditCard>('SELECT * FROM creditCards ORDER BY dueDate ASC');
  return rows.map((row) => ({ ...row, _id: row.id }));
}

export async function upsertCreditCard(args: {
  cardId?: string | null;
  name: string;
  dueDate: string;
  minimumPayment?: number | null;
  statementBalance?: number | null;
  lastStatementDate?: string | null;
}) {
  const now = Date.now();
  const payload = [
    args.name.trim(),
    args.dueDate.trim(),
    args.minimumPayment ?? null,
    args.statementBalance ?? null,
    args.lastStatementDate ?? null,
    now,
  ];
  if (args.cardId) {
    await runSql(
      'UPDATE creditCards SET name = ?, dueDate = ?, minimumPayment = ?, statementBalance = ?, lastStatementDate = ?, updatedAt = ? WHERE id = ?',
      [...payload, args.cardId]
    );
    await markLocalDirty();
    return args.cardId;
  }

  const id = makeId('card');
  await runSql(
    'INSERT INTO creditCards (id, name, dueDate, minimumPayment, statementBalance, lastStatementDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, ...payload, now]
  );
  await markLocalDirty();
  return id;
}

export async function deleteCreditCard(cardId: string) {
  await runSql('DELETE FROM creditCards WHERE id = ?', [cardId]);
  await markLocalDirty();
}

export async function getMonthSummary() {
  const settings = await ensureBudgetSettings();
  const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const categories = allCategories.filter((cat) => isLocalExpenseCategory(cat));
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const transactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [periodStart, periodEnd]
  );

  const totals = summarizeLocalTransactionsByKind(
    transactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
    buildLocalCategoryKindSets(allCategories)
  );
  const spentByCategory = totals.expenseByCategory;

  const categoriesSummary = categories.map((cat) => {
    const budget = budgets.find((b) => b.categoryId === cat.id);
    const spent = spentByCategory.get(cat.id) ?? 0;
    const budgetAmount = budget?.amount ?? 0;
    const remaining = budgetAmount - spent;
    return {
      categoryId: cat.id,
      name: cat.name,
      spent,
      budgetAmount,
      remaining,
      overBudget: spent > budgetAmount && budgetAmount > 0,
    };
  });

  const totalSpent = totals.expenseTotal;
  const totalBudget = categoriesSummary.reduce((sum, c) => sum + c.budgetAmount, 0);
  const uncategorizedTransactions = transactions.filter((tx) => !tx.categoryId);
  const uncategorizedCount = uncategorizedTransactions.length;
  const uncategorizedAmount = uncategorizedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    periodStart,
    periodEnd,
    totalSpent,
    incomeTotal: totals.incomeTotal,
    totalBudget,
    categories: categoriesSummary,
    uncategorizedCount,
    uncategorizedAmount,
  };
}

export async function getPlannedVsActual() {
  const settings = await ensureBudgetSettings();
  const now = new Date();
  const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, now);
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const kindSets = buildLocalCategoryKindSets(allCategories);

  const monthlyTransactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [periodStart, periodEnd]
  );
  const monthlyActual = summarizeLocalTransactionsByKind(
    monthlyTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
    kindSets
  ).expenseTotal;

  const weekStartDate = getWeekStart(now);
  const weekStart = formatDate(weekStartDate);
  const weekEnd = formatDate(addDays(weekStartDate, 7));
  const weeklyTransactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [weekStart, weekEnd]
  );
  const weeklyActual = summarizeLocalTransactionsByKind(
    weeklyTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
    kindSets
  ).expenseTotal;
  const weeklyPlanned =
    settings.cycleLengthDays > 0 ? totalBudget * (7 / settings.cycleLengthDays) : totalBudget;

  return {
    periodStart,
    periodEnd,
    weekStart,
    weekEnd,
    weekly: { planned: weeklyPlanned, actual: weeklyActual },
    monthly: { planned: totalBudget, actual: monthlyActual },
  };
}

export function computeLocalCarryoverOut(mode: string | null | undefined, remainingBase: number) {
  if (mode === 'positive') return Math.max(remainingBase, 0);
  if (mode === 'negative') return Math.min(remainingBase, 0);
  if (mode === 'both') return remainingBase;
  return 0;
}

export function applyLocalCarryoverToCategoryRows(
  rows: Array<{ categoryId: string; carryoverOut: number }>,
  previousCarryoverByCategory: Map<string, number>
) {
  const nextCarryoverByCategory = new Map(previousCarryoverByCategory);
  const computedRows = rows.map((row) => {
    const carryoverAppliedIn = nextCarryoverByCategory.get(row.categoryId) ?? 0;
    const carryoverRunningTotal = carryoverAppliedIn + row.carryoverOut;
    nextCarryoverByCategory.set(row.categoryId, carryoverRunningTotal);
    return {
      ...row,
      carryoverAppliedIn,
      carryoverRunningTotal,
    };
  });
  const carryoverPositiveTotal = computedRows.reduce(
    (sum, row) => sum + (row.carryoverRunningTotal > 0 ? row.carryoverRunningTotal : 0),
    0
  );
  const carryoverNegativeTotal = computedRows.reduce(
    (sum, row) => sum + (row.carryoverRunningTotal < 0 ? row.carryoverRunningTotal : 0),
    0
  );
  return {
    rows: computedRows,
    carryoverPositiveTotal,
    carryoverNegativeTotal,
    carryoverNetTotal: carryoverPositiveTotal + carryoverNegativeTotal,
    nextCarryoverByCategory,
  };
}

function getEarliestLocalHistoryPeriodStart(args: {
  anchorDate: string;
  cycleLengthDays: number;
  budgets: LocalBudget[];
  transactions: LocalTransaction[];
}) {
  const candidates: string[] = [];
  for (const budget of args.budgets) candidates.push(budget.periodStart);
  for (const tx of args.transactions) candidates.push(tx.date);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return getPeriodForOffset(args.anchorDate, args.cycleLengthDays, new Date(candidates[0]), 0).periodStart;
}

export async function ensureHistorySnapshots(throughPeriodStart?: string) {
  const settings = await ensureBudgetSettings();
  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const categories = allCategories.filter((category) => isLocalExpenseCategory(category));
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets');
  const transactions = await getAll<LocalTransaction>('SELECT * FROM transactions');

  const firstPeriodStart = getEarliestLocalHistoryPeriodStart({
    anchorDate: settings.anchorDate,
    cycleLengthDays: settings.cycleLengthDays,
    budgets,
    transactions,
  });
  const lastClosedPeriodStart =
    throughPeriodStart ??
    getPeriodForOffset(settings.anchorDate, settings.cycleLengthDays, new Date(), -1).periodStart;

  if (!firstPeriodStart || firstPeriodStart > lastClosedPeriodStart) {
    return { firstPeriodStart, lastClosedPeriodStart, createdCycles: 0 };
  }

  const kindSets = buildLocalCategoryKindSets(allCategories);
  const carryoverByCategory = new Map<string, number>();
  let createdCycles = 0;
  const now = Date.now();

  for (
    let cycleStart = firstPeriodStart;
    cycleStart <= lastClosedPeriodStart;
    cycleStart = getPeriodForOffset(settings.anchorDate, settings.cycleLengthDays, new Date(cycleStart), 1).periodStart
  ) {
    const { periodEnd } = getPeriodForOffset(cycleStart, settings.cycleLengthDays, new Date(cycleStart), 0);
    const budgetsForPeriod = budgets.filter((budget) => budget.periodStart === cycleStart);
    const transactionsForPeriod = transactions.filter((tx) => tx.date >= cycleStart && tx.date < periodEnd);
    const spentByCategory = summarizeLocalTransactionsByKind(
      transactionsForPeriod.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
      kindSets
    ).expenseByCategory;

    const categoryRows = categories.map((category) => {
      const budgetBase = budgetsForPeriod.find((budget) => budget.categoryId === category.id)?.amount ?? 0;
      const spent = spentByCategory.get(category.id) ?? 0;
      const remainingBase = budgetBase - spent;
      const carryoverAppliedIn = carryoverByCategory.get(category.id) ?? 0;
      const carryoverOut = computeLocalCarryoverOut(category.rolloverMode, remainingBase);
      const carryoverRunningTotal = carryoverAppliedIn + carryoverOut;
      carryoverByCategory.set(category.id, carryoverRunningTotal);
      return {
        categoryId: category.id,
        categoryName: category.name,
        rolloverMode: (category.rolloverMode as 'none' | 'positive' | 'negative' | 'both' | null) ?? 'none',
        budgetBase,
        spent,
        remainingBase,
        carryoverAppliedIn,
        carryoverOut,
        carryoverRunningTotal,
      };
    });

    const totalBudgetBase = budgetsForPeriod.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = transactionsForPeriod
      .filter((tx) => tx.categoryId && kindSets.expenseIds.has(tx.categoryId))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const overUnderBase = totalBudgetBase - totalSpent;
    const carryoverPositiveTotal = categoryRows.reduce(
      (sum, row) => sum + (row.carryoverRunningTotal > 0 ? row.carryoverRunningTotal : 0),
      0
    );
    const carryoverNegativeTotal = categoryRows.reduce(
      (sum, row) => sum + (row.carryoverRunningTotal < 0 ? row.carryoverRunningTotal : 0),
      0
    );
    const carryoverNetTotal = carryoverPositiveTotal + carryoverNegativeTotal;

    await runSql('DELETE FROM budgetCycleSnapshots WHERE periodStart = ?', [cycleStart]);
    await runSql('DELETE FROM budgetCategoryCycleSnapshots WHERE periodStart = ?', [cycleStart]);
    await runSql(
      'INSERT INTO budgetCycleSnapshots (id, periodStart, periodEnd, periodLengthDays, totalBudgetBase, totalSpent, overUnderBase, carryoverPositiveTotal, carryoverNegativeTotal, carryoverNetTotal, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        makeId('bcycle'),
        cycleStart,
        periodEnd,
        settings.cycleLengthDays,
        totalBudgetBase,
        totalSpent,
        overUnderBase,
        carryoverPositiveTotal,
        carryoverNegativeTotal,
        carryoverNetTotal,
        now,
        now,
      ]
    );

    for (const row of categoryRows) {
      await runSql(
        'INSERT INTO budgetCategoryCycleSnapshots (id, periodStart, categoryId, categoryName, rolloverMode, budgetBase, spent, remainingBase, carryoverAppliedIn, carryoverOut, carryoverRunningTotal, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          makeId('bcatcycle'),
          cycleStart,
          row.categoryId,
          row.categoryName,
          row.rolloverMode,
          row.budgetBase,
          row.spent,
          row.remainingBase,
          row.carryoverAppliedIn,
          row.carryoverOut,
          row.carryoverRunningTotal,
          now,
          now,
        ]
      );
    }

    createdCycles += 1;
  }

  return { firstPeriodStart, lastClosedPeriodStart, createdCycles };
}

export async function listHistoryCycles(args?: { limit?: number; cursor?: string }) {
  const limit = Math.min(Math.max(Math.round(args?.limit ?? 12), 1), 60);
  const cursor = args?.cursor;
  const rows = await getAll<LocalBudgetCycleSnapshot>(
    cursor
      ? 'SELECT * FROM budgetCycleSnapshots WHERE periodStart < ? ORDER BY periodStart DESC LIMIT ?'
      : 'SELECT * FROM budgetCycleSnapshots ORDER BY periodStart DESC LIMIT ?',
    cursor ? [cursor, limit + 1] : [limit + 1]
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    periodLengthDays: row.periodLengthDays,
    totalBudgetBase: row.totalBudgetBase,
    totalSpent: row.totalSpent,
    overUnderBase: row.overUnderBase,
    carryoverPositiveTotal: row.carryoverPositiveTotal,
    carryoverNegativeTotal: row.carryoverNegativeTotal,
    carryoverNetTotal: row.carryoverNetTotal,
  }));
  return { items, nextCursor: hasMore ? rows[limit].periodStart : undefined };
}

export async function getHistoryCycleDetails(periodStart: string) {
  const cycle = await getFirst<LocalBudgetCycleSnapshot>(
    'SELECT * FROM budgetCycleSnapshots WHERE periodStart = ? LIMIT 1',
    [periodStart]
  );
  if (!cycle) return { cycle: null, categories: [] };
  const categories = await getAll<LocalBudgetCategoryCycleSnapshot>(
    'SELECT * FROM budgetCategoryCycleSnapshots WHERE periodStart = ? ORDER BY categoryName ASC',
    [periodStart]
  );
  return {
    cycle: {
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      periodLengthDays: cycle.periodLengthDays,
      totalBudgetBase: cycle.totalBudgetBase,
      totalSpent: cycle.totalSpent,
      overUnderBase: cycle.overUnderBase,
      carryoverPositiveTotal: cycle.carryoverPositiveTotal,
      carryoverNegativeTotal: cycle.carryoverNegativeTotal,
      carryoverNetTotal: cycle.carryoverNetTotal,
    },
    categories: categories.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      rolloverMode: row.rolloverMode,
      budgetBase: row.budgetBase,
      spent: row.spent,
      remainingBase: row.remainingBase,
      carryoverAppliedIn: row.carryoverAppliedIn,
      carryoverOut: row.carryoverOut,
      carryoverRunningTotal: row.carryoverRunningTotal,
    })),
  };
}

export async function addManualHistoryCycle(
  periodStart: string,
  entries: Array<{ categoryId: string; spent: number }>
) {
  const settings = await ensureBudgetSettings();
  const currentPeriodStart = getPeriodForOffset(
    settings.anchorDate,
    settings.cycleLengthDays,
    new Date(),
    0
  ).periodStart;
  if (periodStart >= currentPeriodStart) {
    throw new Error('Manual history must be in a prior period.');
  }

  const allCategories = await getAll<LocalCategory>('SELECT * FROM categories');
  const expenseCategories = allCategories.filter((category) => isLocalExpenseCategory(category));
  const entrySpentByCategory = new Map(entries.map((entry) => [entry.categoryId, Number(entry.spent)]));
  if (!expenseCategories.length) {
    throw new Error('Create budget categories before adding manual history.');
  }
  for (const category of expenseCategories) {
    if (!entrySpentByCategory.has(category.id)) {
      throw new Error('All expense categories must be included.');
    }
    const spent = entrySpentByCategory.get(category.id) ?? 0;
    if (!Number.isFinite(spent) || spent < 0) {
      throw new Error('Each category spent amount must be a non-negative number.');
    }
  }

  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets');
  const targetBudgetMap = new Map(
    budgets
      .filter((budget) => budget.periodStart === periodStart)
      .map((budget) => [budget.categoryId, budget.amount])
  );
  const currentBudgetMap = new Map(
    budgets
      .filter((budget) => budget.periodStart === currentPeriodStart)
      .map((budget) => [budget.categoryId, budget.amount])
  );
  const previousPeriodStart = getPeriodForOffset(
    settings.anchorDate,
    settings.cycleLengthDays,
    new Date(periodStart),
    -1
  ).periodStart;
  const previousRows = await getAll<LocalBudgetCategoryCycleSnapshot>(
    'SELECT categoryId, carryoverRunningTotal FROM budgetCategoryCycleSnapshots WHERE periodStart = ?',
    [previousPeriodStart]
  );
  const previousCarryoverByCategory = new Map(
    previousRows.map((row) => [row.categoryId, row.carryoverRunningTotal])
  );

  const manualRows = expenseCategories.map((category) => {
    const budgetBase = targetBudgetMap.get(category.id) ?? currentBudgetMap.get(category.id) ?? 0;
    const spent = entrySpentByCategory.get(category.id) ?? 0;
    const rolloverMode = (category.rolloverMode as 'none' | 'positive' | 'negative' | 'both' | null) ?? 'none';
    const remainingBase = budgetBase - spent;
    const carryoverOut = computeLocalCarryoverOut(rolloverMode, remainingBase);
    return {
      categoryId: category.id,
      categoryName: category.name,
      rolloverMode,
      budgetBase,
      spent,
      remainingBase,
      carryoverOut,
    };
  });
  const recomputed = applyLocalCarryoverToCategoryRows(
    manualRows.map((row) => ({ categoryId: row.categoryId, carryoverOut: row.carryoverOut })),
    previousCarryoverByCategory
  );
  const recomputedByCategory = new Map(recomputed.rows.map((row) => [row.categoryId, row]));
  const periodEnd = getPeriodForOffset(periodStart, settings.cycleLengthDays, new Date(periodStart), 0).periodEnd;
  const totalBudgetBase = manualRows.reduce((sum, row) => sum + row.budgetBase, 0);
  const totalSpent = manualRows.reduce((sum, row) => sum + row.spent, 0);
  const overUnderBase = totalBudgetBase - totalSpent;
  const now = Date.now();

  await runSql('DELETE FROM budgetCycleSnapshots WHERE periodStart = ?', [periodStart]);
  await runSql('DELETE FROM budgetCategoryCycleSnapshots WHERE periodStart = ?', [periodStart]);
  await runSql(
    'INSERT INTO budgetCycleSnapshots (id, periodStart, periodEnd, periodLengthDays, totalBudgetBase, totalSpent, overUnderBase, carryoverPositiveTotal, carryoverNegativeTotal, carryoverNetTotal, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      makeId('bcycle'),
      periodStart,
      periodEnd,
      settings.cycleLengthDays,
      totalBudgetBase,
      totalSpent,
      overUnderBase,
      recomputed.carryoverPositiveTotal,
      recomputed.carryoverNegativeTotal,
      recomputed.carryoverNetTotal,
      now,
      now,
    ]
  );
  for (const row of manualRows) {
    const carryover = recomputedByCategory.get(row.categoryId);
    if (!carryover) continue;
    await runSql(
      'INSERT INTO budgetCategoryCycleSnapshots (id, periodStart, categoryId, categoryName, rolloverMode, budgetBase, spent, remainingBase, carryoverAppliedIn, carryoverOut, carryoverRunningTotal, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        makeId('bcatcycle'),
        periodStart,
        row.categoryId,
        row.categoryName,
        row.rolloverMode,
        row.budgetBase,
        row.spent,
        row.remainingBase,
        carryover.carryoverAppliedIn,
        row.carryoverOut,
        carryover.carryoverRunningTotal,
        now,
        now,
      ]
    );
  }

  let runningCarryoverByCategory = recomputed.nextCarryoverByCategory;
  const laterCycles = await getAll<LocalBudgetCycleSnapshot>(
    'SELECT * FROM budgetCycleSnapshots WHERE periodStart > ? ORDER BY periodStart ASC',
    [periodStart]
  );
  for (const cycle of laterCycles) {
    const cycleRows = await getAll<LocalBudgetCategoryCycleSnapshot>(
      'SELECT * FROM budgetCategoryCycleSnapshots WHERE periodStart = ?',
      [cycle.periodStart]
    );
    const cycleRecomputed = applyLocalCarryoverToCategoryRows(
      cycleRows.map((row) => ({ categoryId: row.categoryId, carryoverOut: row.carryoverOut })),
      runningCarryoverByCategory
    );
    const byCategoryId = new Map(cycleRecomputed.rows.map((row) => [row.categoryId, row]));
    for (const row of cycleRows) {
      const nextRow = byCategoryId.get(row.categoryId);
      if (!nextRow) continue;
      await runSql(
        'UPDATE budgetCategoryCycleSnapshots SET carryoverAppliedIn = ?, carryoverRunningTotal = ?, updatedAt = ? WHERE id = ?',
        [nextRow.carryoverAppliedIn, nextRow.carryoverRunningTotal, now, row.id]
      );
    }
    await runSql(
      'UPDATE budgetCycleSnapshots SET carryoverPositiveTotal = ?, carryoverNegativeTotal = ?, carryoverNetTotal = ?, updatedAt = ? WHERE id = ?',
      [
        cycleRecomputed.carryoverPositiveTotal,
        cycleRecomputed.carryoverNegativeTotal,
        cycleRecomputed.carryoverNetTotal,
        now,
        cycle.id,
      ]
    );
    runningCarryoverByCategory = cycleRecomputed.nextCarryoverByCategory;
  }

  await markLocalDirty();
  return { periodStart, periodEnd, categoryCount: manualRows.length };
}

export async function getTrends() {
  const transactions = await getAll<LocalTransaction>('SELECT * FROM transactions ORDER BY date DESC');
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  const monthlyTotals = Array.from(totals.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 6)
    .map(([month, total]) => ({ month, total }));
  return { monthlyTotals };
}

export async function exportLocalData() {
  const recipes = await getAll<LocalRecipe>('SELECT * FROM recipes');
  const mealPlanItems = await getAll<LocalMealPlanItem>('SELECT * FROM mealPlanItems');
  const budgetSettings = await getFirst<LocalBudgetSettings>('SELECT * FROM budgetSettings LIMIT 1');
  const categories = await getAll<LocalCategory>('SELECT * FROM categories');
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets');
  const transactions = await getAll<LocalTransaction>('SELECT * FROM transactions');
  const recipeIngredients = await getAll<LocalRecipeIngredient>('SELECT * FROM recipeIngredients');
  const mealPlans = await getAll<LocalMealPlan>('SELECT * FROM mealPlans');
  const shoppingListItems = await getAll<LocalShoppingListItem>('SELECT * FROM shoppingListItems');
  const creditCards = await getAll<LocalCreditCard>('SELECT * FROM creditCards');
  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      categoryKind: category.categoryKind ?? undefined,
      parentId: category.parentId ?? null,
      rolloverMode: category.rolloverMode ?? undefined,
      carryoverAdjustment: category.carryoverAdjustment ?? 0,
      isDefault: category.isDefault ?? undefined,
    })),
    budgetSettings: toImportBudgetSettings(budgetSettings),
    budgets: budgets.map((budget) => ({
      categoryId: budget.categoryId,
      periodStart: budget.periodStart,
      periodLengthDays: budget.periodLengthDays,
      amount: budget.amount,
    })),
    transactions: transactions.map((transaction) => ({
      name: transaction.name,
      date: transaction.date,
      amount: transaction.amount,
      categoryId: transaction.categoryId ?? null,
      pending:
        transaction.pending === null || transaction.pending === undefined
          ? undefined
          : Boolean(transaction.pending),
    })),
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title ?? undefined,
      content: recipe.content ?? undefined,
      name: recipe.name ?? recipe.title ?? '',
      instructions: recipe.instructions ?? recipe.content ?? '',
      servings: recipe.servings ?? null,
      notes: recipe.notes ?? null,
      sourceUrl: recipe.sourceUrl ?? null,
      tags: parseRecipeTags(recipe.tags),
      pricePerServing: recipe.pricePerServing ?? null,
    })),
    recipeIngredients: recipeIngredients.map((ingredient) => ({
      recipeId: ingredient.recipeId,
      name: ingredient.name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit ?? null,
    })),
    mealPlans: mealPlans.map((mealPlan) => ({
      id: mealPlan.id,
      weekStart: mealPlan.weekStart,
    })),
    mealPlanItems: mealPlanItems.map((item) => ({
      mealPlanId: item.mealPlanId,
      recipeId: item.recipeId ?? null,
      title: item.title,
      day: item.day,
      slot: item.slot ?? null,
      notes: item.notes ?? null,
      mealType: item.mealType ?? null,
    })),
    shoppingListItems: shoppingListItems.map((item) => ({
      mealPlanId: item.mealPlanId,
      itemName: item.itemName,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      estimatedCost: item.estimatedCost ?? null,
      isChecked:
        item.isChecked === null || item.isChecked === undefined ? undefined : Boolean(item.isChecked),
      inPantry:
        item.inPantry === null || item.inPantry === undefined ? undefined : Boolean(item.inPantry),
    })),
    creditCards: creditCards.map((card) => ({
      name: card.name,
      dueDate: card.dueDate,
      minimumPayment: card.minimumPayment ?? null,
      statementBalance: card.statementBalance ?? null,
      lastStatementDate: card.lastStatementDate ?? null,
    })),
  };
}

export function toImportBudgetSettings(
  settings: LocalBudgetSettings | null | undefined
): { cycleLengthDays: number; anchorDate: string } | undefined {
  if (!settings) return undefined;
  return {
    cycleLengthDays: settings.cycleLengthDays,
    anchorDate: settings.anchorDate,
  };
}

export type LocalCategory = {
  id: string;
  name: string;
  categoryKind?: 'expense' | 'income' | 'transfer' | null;
  parentId?: string | null;
  sortOrder?: number | null;
  rolloverMode?: string | null;
  carryoverAdjustment?: number | null;
  isDefault?: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalBudgetSettings = {
  id: number;
  cycleLengthDays: number;
  anchorDate: string;
  monthlyIncome?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type LocalBudget = {
  id: string;
  categoryId: string;
  periodStart: string;
  periodLengthDays: number;
  amount: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalBudgetCycleSnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLengthDays: number;
  totalBudgetBase: number;
  totalSpent: number;
  overUnderBase: number;
  carryoverPositiveTotal: number;
  carryoverNegativeTotal: number;
  carryoverNetTotal: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalBudgetCategoryCycleSnapshot = {
  id: string;
  periodStart: string;
  categoryId: string;
  categoryName: string;
  rolloverMode: 'none' | 'positive' | 'negative' | 'both';
  budgetBase: number;
  spent: number;
  remainingBase: number;
  carryoverAppliedIn: number;
  carryoverOut: number;
  carryoverRunningTotal: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalTransaction = {
  id: string;
  name: string;
  date: string;
  amount: number;
  categoryId?: string | null;
  pending?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type LocalRecipe = {
  id: string;
  title?: string | null;
  content?: string | null;
  name?: string | null;
  instructions?: string | null;
  servings?: number | null;
  pricePerServing?: number | null;
  notes?: string | null;
  sourceUrl?: string | null;
  tags?: string | null;
  searchName?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type LocalRecipeIngredient = {
  id: string;
  recipeId: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
};

export type LocalMealPlan = {
  id: string;
  weekStart: string;
  planningMode?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type LocalMealPlanItem = {
  id: string;
  mealPlanId: string;
  recipeId?: string | null;
  title: string;
  day: string;
  slot?: string | null;
  notes?: string | null;
  mealType?: string | null;
};

export type LocalShoppingListItem = {
  id: string;
  mealPlanId: string;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  estimatedCost?: number | null;
  priceSource?: string | null;
  isChecked?: number | null;
  inPantry?: number | null;
};

export type LocalCreditCard = {
  id: string;
  name: string;
  dueDate: string;
  minimumPayment?: number | null;
  statementBalance?: number | null;
  lastStatementDate?: string | null;
  createdAt: number;
  updatedAt: number;
};
