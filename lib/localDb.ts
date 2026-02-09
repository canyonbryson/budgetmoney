import * as SQLite from 'expo-sqlite';

const DB_NAME = 'grocerybudget.db';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', sub: ['Costco', 'Household', 'Food', 'Eating Out'] },
  { name: 'Bills', sub: ['Utilities', 'Internet', 'Phone'] },
  { name: 'Rent', sub: [] },
  { name: 'Restaurants', sub: [] },
  { name: 'Transportation', sub: ['Gas', 'Ride Share', 'Transit'] },
  { name: 'Entertainment', sub: [] },
  { name: 'Health', sub: [] },
  { name: 'Transfer', sub: [] },
  { name: 'Savings', sub: [] },
  { name: 'Income', sub: [] },
];

let dbInstance: SQLite.SQLiteDatabase | null = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabase(DB_NAME);
  }
  return dbInstance;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function runSql<T = SQLite.SQLResultSet>(sql: string, params: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result as unknown as T),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

async function getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await runSql<SQLite.SQLResultSet>(sql, params);
  const rows = result?.rows?.length ? result.rows._array : [];
  return rows as T[];
}

async function getFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await getAll<T>(sql, params);
  return rows.length ? rows[0] : null;
}

async function setMeta(key: string, value: string) {
  await runSql(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

async function getMeta(key: string) {
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

export async function initLocalDb() {
  await runSql('PRAGMA journal_mode = WAL');
  await runSql(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, parentId TEXT, sortOrder INTEGER DEFAULT 0, rolloverMode TEXT, isDefault INTEGER DEFAULT 0, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgetSettings (id INTEGER PRIMARY KEY NOT NULL, cycleLengthDays INTEGER NOT NULL, anchorDate TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY NOT NULL, categoryId TEXT NOT NULL, periodStart TEXT NOT NULL, periodLengthDays INTEGER NOT NULL, amount REAL NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
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
    'CREATE TABLE IF NOT EXISTS mealPlans (id TEXT PRIMARY KEY NOT NULL, weekStart TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS mealPlanItems (id TEXT PRIMARY KEY NOT NULL, mealPlanId TEXT NOT NULL, title TEXT NOT NULL, day TEXT NOT NULL, slot TEXT, notes TEXT)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS shoppingListItems (id TEXT PRIMARY KEY NOT NULL, mealPlanId TEXT NOT NULL, itemName TEXT NOT NULL, quantity REAL, unit TEXT, estimatedCost REAL, priceSource TEXT, isChecked INTEGER DEFAULT 0, inPantry INTEGER DEFAULT 0)'
  );
  await runSql(
    'CREATE TABLE IF NOT EXISTS creditCards (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, dueDate TEXT NOT NULL, minimumPayment REAL, statementBalance REAL, lastStatementDate TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)'
  );

  await ensureColumn('mealPlanItems', 'slot', 'TEXT');

  await ensureBudgetSettings();
  await seedDefaultCategories();
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentPeriod(anchorDate: string, cycleLengthDays: number, now: Date) {
  const anchor = new Date(anchorDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((now.getTime() - anchor.getTime()) / msPerDay);
  const periods = Math.floor(Math.max(diffDays, 0) / cycleLengthDays);
  const periodStart = new Date(anchor.getTime() + periods * cycleLengthDays * msPerDay);
  const periodEnd = new Date(periodStart.getTime() + cycleLengthDays * msPerDay);
  return { periodStart: formatDate(periodStart), periodEnd: formatDate(periodEnd) };
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await runSql(
    'INSERT INTO budgetSettings (id, cycleLengthDays, anchorDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [record.id, record.cycleLengthDays, record.anchorDate, record.createdAt, record.updatedAt]
  );
  return record;
}

async function seedDefaultCategories() {
  const existing = await getFirst<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (existing && existing.count > 0) return;
  const now = Date.now();
  for (const top of DEFAULT_CATEGORIES) {
    const topId = makeId('cat');
    await runSql(
      'INSERT INTO categories (id, name, parentId, sortOrder, rolloverMode, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [topId, top.name, null, 0, 'none', 1, now, now]
    );
    for (const sub of top.sub) {
      const subId = makeId('cat');
      await runSql(
        'INSERT INTO categories (id, name, parentId, sortOrder, rolloverMode, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [subId, sub, topId, 0, 'none', 1, now, now]
      );
    }
  }
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

export async function updateBudgetSettings(cycleLengthDays: number, anchorDate: string) {
  const settings = await ensureBudgetSettings();
  await runSql(
    'UPDATE budgetSettings SET cycleLengthDays = ?, anchorDate = ?, updatedAt = ? WHERE id = ?',
    [Math.round(cycleLengthDays), anchorDate, Date.now(), settings.id]
  );
  await markLocalDirty();
}

export async function getBudgetHierarchy() {
  const settings = await ensureBudgetSettings();
  const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const categories = await getAll<LocalCategory>('SELECT * FROM categories');
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

export async function getBudgetAllocation(parentCategoryId: string) {
  const settings = await ensureBudgetSettings();
  const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
  const parent = await getFirst<LocalCategory>('SELECT * FROM categories WHERE id = ?', [parentCategoryId]);
  if (!parent) throw new Error('Category not found');

  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const children = await getAll<LocalCategory>('SELECT * FROM categories WHERE parentId = ?', [parent.id]);

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

  const children = await getAll<LocalCategory>('SELECT * FROM categories WHERE parentId = ?', [parentCategoryId]);
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
  return rows.map((row) => ({ ...row, _id: row.id }));
}

export async function createCategory(name: string, parentId?: string | null) {
  const trimmed = name.trim();
  if (!trimmed.length) throw new Error('Category name is required.');
  if (parentId && parentId === '') parentId = null;
  const now = Date.now();
  await runSql(
    'INSERT INTO categories (id, name, parentId, sortOrder, rolloverMode, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [makeId('cat'), trimmed, parentId ?? null, 0, 'none', 0, now, now]
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
  if (args.categoryId) {
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
    filtered = rows.filter((row) => row.name.toLowerCase().includes(needle));
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
  return rows.map((row) => ({ ...row, _id: row.id }));
}

export async function createRecipe(args: {
  title: string;
  content?: string;
  servings?: number | null;
  notes?: string | null;
}) {
  const now = Date.now();
  const id = makeId('recipe');
  await runSql(
    'INSERT INTO recipes (id, title, content, servings, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, args.title.trim(), args.content ?? '', args.servings ?? null, args.notes ?? null, now, now]
  );
  await markLocalDirty();
  return id;
}

export async function updateRecipe(args: {
  recipeId: string;
  title: string;
  content: string;
  servings?: number | null;
  notes?: string | null;
}) {
  await runSql(
    'UPDATE recipes SET title = ?, content = ?, servings = ?, notes = ?, updatedAt = ? WHERE id = ?',
    [
      args.title.trim(),
      args.content,
      args.servings ?? null,
      args.notes ?? null,
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
  await runSql('DELETE FROM recipeIngredients WHERE recipeId = ?', [args.recipeId]);
  for (const ingredient of args.ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;
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
    recipe: { ...recipe, _id: recipe.id },
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

export async function getCurrentWeekPlan() {
  const plan = await getOrCreateMealPlan();
  const items = await getAll<LocalMealPlanItem>('SELECT * FROM mealPlanItems WHERE mealPlanId = ?', [plan.id]);
  return { weekStart: plan.weekStart, items: items.map((item) => ({ ...item, _id: item.id })) };
}

export async function addMealPlanItem(args: { title: string; day: string; slot?: string | null }) {
  const plan = await getOrCreateMealPlan();
  const now = Date.now();
  await runSql(
    'INSERT INTO mealPlanItems (id, mealPlanId, title, day, slot, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [makeId('mealitem'), plan.id, args.title.trim(), args.day.trim(), args.slot ?? null, null]
  );
  await runSql('UPDATE mealPlans SET updatedAt = ? WHERE id = ?', [now, plan.id]);
  await markLocalDirty();
}

export async function updateMealPlanItem(args: { itemId: string; title: string; day: string; slot?: string | null }) {
  await runSql(
    'UPDATE mealPlanItems SET title = ?, day = ?, slot = ? WHERE id = ?',
    [args.title.trim(), args.day.trim(), args.slot ?? null, args.itemId]
  );
  await markLocalDirty();
}

export async function deleteMealPlanItem(itemId: string) {
  await runSql('DELETE FROM mealPlanItems WHERE id = ?', [itemId]);
  await markLocalDirty();
}

export async function getShoppingListCurrentWeek() {
  const plan = await getOrCreateMealPlan();
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
  const categories = await getAll<LocalCategory>('SELECT * FROM categories');
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const transactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [periodStart, periodEnd]
  );

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const key = tx.categoryId;
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
  }

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

  const totalSpent = categoriesSummary.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = categoriesSummary.reduce((sum, c) => sum + c.budgetAmount, 0);

  return {
    periodStart,
    periodEnd,
    totalSpent,
    totalBudget,
    categories: categoriesSummary,
  };
}

export async function getPlannedVsActual() {
  const settings = await ensureBudgetSettings();
  const now = new Date();
  const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, now);
  const budgets = await getAll<LocalBudget>('SELECT * FROM budgets WHERE periodStart = ?', [periodStart]);
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

  const monthlyTransactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [periodStart, periodEnd]
  );
  const monthlyActual = monthlyTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const weekStartDate = getWeekStart(now);
  const weekStart = formatDate(weekStartDate);
  const weekEnd = formatDate(addDays(weekStartDate, 7));
  const weeklyTransactions = await getAll<LocalTransaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ?',
    [weekStart, weekEnd]
  );
  const weeklyActual = weeklyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
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
  return {
    categories: await getAll<LocalCategory>('SELECT * FROM categories'),
    budgetSettings: await getFirst<LocalBudgetSettings>('SELECT * FROM budgetSettings LIMIT 1'),
    budgets: await getAll<LocalBudget>('SELECT * FROM budgets'),
    transactions: await getAll<LocalTransaction>('SELECT * FROM transactions'),
    recipes: await getAll<LocalRecipe>('SELECT * FROM recipes'),
    recipeIngredients: await getAll<LocalRecipeIngredient>('SELECT * FROM recipeIngredients'),
    mealPlans: await getAll<LocalMealPlan>('SELECT * FROM mealPlans'),
    mealPlanItems: await getAll<LocalMealPlanItem>('SELECT * FROM mealPlanItems'),
    shoppingListItems: await getAll<LocalShoppingListItem>('SELECT * FROM shoppingListItems'),
    creditCards: await getAll<LocalCreditCard>('SELECT * FROM creditCards'),
  };
}

export type LocalCategory = {
  id: string;
  name: string;
  parentId?: string | null;
  sortOrder?: number | null;
  rolloverMode?: string | null;
  isDefault?: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalBudgetSettings = {
  id: number;
  cycleLengthDays: number;
  anchorDate: string;
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
  title: string;
  content: string;
  servings?: number | null;
  notes?: string | null;
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
  createdAt: number;
  updatedAt: number;
};

export type LocalMealPlanItem = {
  id: string;
  mealPlanId: string;
  title: string;
  day: string;
  slot?: string | null;
  notes?: string | null;
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
