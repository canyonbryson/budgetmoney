export type NetWorthRole = 'checking' | 'savings' | 'investment' | 'liability';

const LIABILITY_TYPES = new Set(['credit', 'loan']);
const INVESTMENT_TYPES = new Set(['investment', 'brokerage']);
const SAVINGS_SUBTYPES = new Set(['savings', 'money market', 'cash management']);
const CHECKING_SUBTYPES = new Set(['checking']);
const LIABILITY_SUBTYPES = new Set([
  'credit card',
  'line of credit',
  'mortgage',
  'student',
  'auto',
  'personal',
]);

function normalizePlaidValue(value?: string | null) {
  return value?.toLowerCase().trim() ?? '';
}

export function inferNetWorthRole(type?: string | null, subtype?: string | null): NetWorthRole {
  const normalizedType = normalizePlaidValue(type);
  const normalizedSubtype = normalizePlaidValue(subtype);

  if (LIABILITY_TYPES.has(normalizedType) || LIABILITY_SUBTYPES.has(normalizedSubtype)) {
    return 'liability';
  }
  if (INVESTMENT_TYPES.has(normalizedType)) {
    return 'investment';
  }
  if (SAVINGS_SUBTYPES.has(normalizedSubtype)) {
    return 'savings';
  }
  if (CHECKING_SUBTYPES.has(normalizedSubtype)) {
    return 'checking';
  }
  if (normalizedType === 'depository') {
    return normalizedSubtype === 'savings' ? 'savings' : 'checking';
  }

  return 'checking';
}

export function defaultIncludeInBudget(role: NetWorthRole) {
  return role === 'checking';
}

export function resolveIncludeInBudget(account: {
  includeInBudget?: boolean;
  netWorthRole?: NetWorthRole;
  type?: string | null;
  subtype?: string | null;
}) {
  if (typeof account.includeInBudget === 'boolean') return account.includeInBudget;
  const role = account.netWorthRole ?? inferNetWorthRole(account.type, account.subtype);
  return defaultIncludeInBudget(role);
}

export function resolveIncludeInNetWorth(account: { includeInNetWorth?: boolean }) {
  return account.includeInNetWorth ?? true;
}
