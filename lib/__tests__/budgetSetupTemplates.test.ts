import {
  budgetSetupTemplates,
  getBudgetSetupTemplateById,
} from '../budgetSetupTemplates';

describe('budgetSetupTemplates', () => {
  it('contains a skippable no-template option', () => {
    const none = getBudgetSetupTemplateById('none');
    expect(none.id).toBe('none');
    expect(none.categories).toEqual([]);
  });

  it('falls back to starter template on unknown id', () => {
    const fallback = getBudgetSetupTemplateById('unknown');
    expect(fallback.id).toBe(budgetSetupTemplates[0].id);
  });
});
