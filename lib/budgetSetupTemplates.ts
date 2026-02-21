export type BudgetSetupTemplateId = 'starter' | 'essentials' | 'none';

export type BudgetSetupTemplate = {
  id: BudgetSetupTemplateId;
  nameKey: 'budgetSetupTemplateStarter' | 'budgetSetupTemplateEssentials' | 'budgetSetupTemplateNone';
  descriptionKey:
    | 'budgetSetupTemplateStarterDesc'
    | 'budgetSetupTemplateEssentialsDesc'
    | 'budgetSetupTemplateNoneDesc';
  categories: { name: string; amount: number }[];
};

export const budgetSetupTemplates: BudgetSetupTemplate[] = [
  {
    id: 'starter',
    nameKey: 'budgetSetupTemplateStarter',
    descriptionKey: 'budgetSetupTemplateStarterDesc',
    categories: [
      { name: 'Groceries', amount: 500 },
      { name: 'Housing', amount: 1200 },
      { name: 'Utilities', amount: 250 },
      { name: 'Transportation', amount: 220 },
      { name: 'Dining Out', amount: 180 },
    ],
  },
  {
    id: 'essentials',
    nameKey: 'budgetSetupTemplateEssentials',
    descriptionKey: 'budgetSetupTemplateEssentialsDesc',
    categories: [
      { name: 'Groceries', amount: 500 },
      { name: 'Housing', amount: 1200 },
      { name: 'Utilities', amount: 250 },
    ],
  },
  {
    id: 'none',
    nameKey: 'budgetSetupTemplateNone',
    descriptionKey: 'budgetSetupTemplateNoneDesc',
    categories: [],
  },
];

export function getBudgetSetupTemplateById(id: string | undefined): BudgetSetupTemplate {
  return budgetSetupTemplates.find((template) => template.id === id) ?? budgetSetupTemplates[0];
}
