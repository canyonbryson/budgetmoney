import { getBudgetSetupTemplateById } from '@/lib/budgetSetupTemplates';

/* ---------- types ---------- */

export type CycleType = 'monthly' | 'semiMonthly' | 'biweekly';
export type RolloverMode = 'none' | 'positive' | 'negative' | 'both';

export type BudgetSetupSubcategoryDraft = {
  name: string;
  amount: number;
  existingId?: string;
  rolloverMode: RolloverMode;
};

export type BudgetSetupCategoryDraft = {
  name: string;
  amount: number;
  existingId?: string;
  rolloverMode: RolloverMode;
  subcategories: BudgetSetupSubcategoryDraft[];
};

export type BudgetSetupState = {
  mode: 'create' | 'edit';
  templateId: string;
  cycleType: CycleType;
  cycleLengthDays: number;
  anchorDate: string;
  incomePerCycle: number;
  categories: BudgetSetupCategoryDraft[];
  /** IDs of all categories/subcategories that existed before editing (for hard-sync diff). */
  originalCategoryIds?: string[];
  /** Optional route to navigate to after finishing setup. */
  nextPathAfterFinish?: '/(tabs)/budgets' | '/(onboarding)/bank';
};

export type BudgetSetupStep =
  | 'cycle'
  | 'income'
  | 'categories'
  | 'allocation'
  | 'carryover'
  | 'review';

export type BudgetSetupStepPath =
  | '/(screens)/budget-setup/cycle'
  | '/(screens)/budget-setup/income'
  | '/(screens)/budget-setup/categories'
  | '/(screens)/budget-setup/allocation'
  | '/(screens)/budget-setup/carryover'
  | '/(screens)/budget-setup/review';

/* ---------- constants ---------- */

export const DEFAULT_BUDGET_CYCLE_DAYS = 30;
export const WIZARD_TOTAL_STEPS = 7;

export const CYCLE_PRESETS: { type: CycleType; days: number }[] = [
  { type: 'monthly', days: 30 },
  { type: 'semiMonthly', days: 15 },
  { type: 'biweekly', days: 14 },
];

const BUDGET_SETUP_STEPS: BudgetSetupStep[] = [
  'cycle',
  'income',
  'categories',
  'allocation',
  'carryover',
  'review',
];

const BUDGET_SETUP_STEP_PATHS: Record<BudgetSetupStep, BudgetSetupStepPath> = {
  cycle: '/(screens)/budget-setup/cycle',
  income: '/(screens)/budget-setup/income',
  categories: '/(screens)/budget-setup/categories',
  allocation: '/(screens)/budget-setup/allocation',
  carryover: '/(screens)/budget-setup/carryover',
  review: '/(screens)/budget-setup/review',
};

export function getBudgetSetupStepPath(step: BudgetSetupStep): BudgetSetupStepPath {
  return BUDGET_SETUP_STEP_PATHS[step];
}

export function getNextBudgetSetupStep(step: BudgetSetupStep): BudgetSetupStep | null {
  const idx = BUDGET_SETUP_STEPS.indexOf(step);
  if (idx < 0 || idx >= BUDGET_SETUP_STEPS.length - 1) return null;
  return BUDGET_SETUP_STEPS[idx + 1];
}

export function getPreviousBudgetSetupStep(step: BudgetSetupStep): BudgetSetupStep | null {
  const idx = BUDGET_SETUP_STEPS.indexOf(step);
  if (idx <= 0) return null;
  return BUDGET_SETUP_STEPS[idx - 1];
}

/* ---------- cycle helpers ---------- */

export function cycleLengthForType(cycleType: CycleType): number {
  const preset = CYCLE_PRESETS.find((p) => p.type === cycleType);
  return preset?.days ?? DEFAULT_BUDGET_CYCLE_DAYS;
}

export function cycleTypeForLength(days: number): CycleType {
  if (days <= 14) return 'biweekly';
  if (days <= 15) return 'semiMonthly';
  return 'monthly';
}

/* ---------- defaults ---------- */

export function getDefaultBudgetAnchorDate(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.toISOString().slice(0, 10);
}

export function getDefaultSetupState(templateId = 'starter'): BudgetSetupState {
  const template = getBudgetSetupTemplateById(templateId);
  return {
    mode: 'create',
    templateId: template.id,
    cycleType: 'monthly',
    cycleLengthDays: DEFAULT_BUDGET_CYCLE_DAYS,
    anchorDate: getDefaultBudgetAnchorDate(),
    incomePerCycle: 0,
    categories: template.categories.map((category) => ({
      name: category.name,
      amount: category.amount,
      rolloverMode: 'none' as RolloverMode,
      subcategories: [],
    })),
  };
}

/* ---------- encode / decode ---------- */

export function encodeSetupState(state: BudgetSetupState) {
  return JSON.stringify(state);
}

function parseRolloverMode(val: unknown): RolloverMode {
  if (val === 'positive' || val === 'negative' || val === 'both') return val;
  return 'none';
}

function parseCycleType(val: unknown): CycleType {
  if (val === 'semiMonthly' || val === 'biweekly') return val;
  return 'monthly';
}

function parseSubcategory(raw: any): BudgetSetupSubcategoryDraft {
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    amount: Number.isFinite(Number(raw?.amount)) ? Number(raw.amount) : 0,
    existingId: typeof raw?.existingId === 'string' ? raw.existingId : undefined,
    rolloverMode: parseRolloverMode(raw?.rolloverMode),
  };
}

function parseCategory(raw: any): BudgetSetupCategoryDraft {
  const subcategories = Array.isArray(raw?.subcategories)
    ? raw.subcategories.map(parseSubcategory)
    : [];
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    amount: Number.isFinite(Number(raw?.amount)) ? Number(raw.amount) : 0,
    existingId: typeof raw?.existingId === 'string' ? raw.existingId : undefined,
    rolloverMode: parseRolloverMode(raw?.rolloverMode),
    subcategories,
  };
}

export function decodeSetupState(raw: string | string[] | undefined): BudgetSetupState {
  const parsedValue = Array.isArray(raw) ? raw[0] : raw;
  if (!parsedValue) {
    return getDefaultSetupState();
  }
  try {
    const parsed = JSON.parse(parsedValue) as any;
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.map(parseCategory)
      : [];
    const cycleLengthDays = Number.isFinite(Number(parsed.cycleLengthDays))
      ? Math.max(1, Math.round(Number(parsed.cycleLengthDays)))
      : DEFAULT_BUDGET_CYCLE_DAYS;
    const originalCategoryIds = Array.isArray(parsed.originalCategoryIds)
      ? parsed.originalCategoryIds.filter((id: any) => typeof id === 'string')
      : undefined;
    const nextPathAfterFinish =
      parsed.nextPathAfterFinish === '/(onboarding)/bank' ||
      parsed.nextPathAfterFinish === '/(tabs)/budgets'
        ? parsed.nextPathAfterFinish
        : undefined;
    return {
      mode: parsed.mode === 'edit' ? 'edit' : 'create',
      templateId: typeof parsed.templateId === 'string' ? parsed.templateId : 'starter',
      cycleType: parseCycleType(parsed.cycleType),
      cycleLengthDays,
      anchorDate:
        typeof parsed.anchorDate === 'string' && parsed.anchorDate.trim().length
          ? parsed.anchorDate
          : getDefaultBudgetAnchorDate(),
      incomePerCycle: Number.isFinite(Number(parsed.incomePerCycle))
        ? Number(parsed.incomePerCycle)
        : 0,
      categories,
      originalCategoryIds,
      ...(nextPathAfterFinish ? { nextPathAfterFinish } : {}),
    };
  } catch {
    return getDefaultSetupState();
  }
}

/* ---------- hard-sync diff ---------- */

export type SyncAction = {
  creates: { name: string; parentName?: string; amount: number; rolloverMode: RolloverMode }[];
  updates: {
    existingId: string;
    name: string;
    amount: number;
    rolloverMode: RolloverMode;
    parentExistingId?: string;
  }[];
  deletes: string[];
};

export function computeHardSyncDiff(state: BudgetSetupState): SyncAction {
  const originalIds = new Set(state.originalCategoryIds ?? []);
  const currentIds = new Set<string>();

  const creates: SyncAction['creates'] = [];
  const updates: SyncAction['updates'] = [];

  for (const cat of state.categories) {
    if (cat.existingId) {
      currentIds.add(cat.existingId);
      updates.push({
        existingId: cat.existingId,
        name: cat.name,
        amount: cat.amount,
        rolloverMode: cat.rolloverMode,
      });
    } else {
      creates.push({ name: cat.name, amount: cat.amount, rolloverMode: cat.rolloverMode });
    }
    for (const sub of cat.subcategories) {
      if (sub.existingId) {
        currentIds.add(sub.existingId);
        updates.push({
          existingId: sub.existingId,
          name: sub.name,
          amount: sub.amount,
          rolloverMode: sub.rolloverMode,
          parentExistingId: cat.existingId,
        });
      } else {
        creates.push({
          name: sub.name,
          parentName: cat.name,
          amount: sub.amount,
          rolloverMode: sub.rolloverMode,
        });
      }
    }
  }

  const deletes = [...originalIds].filter((id) => !currentIds.has(id));

  return { creates, updates, deletes };
}
