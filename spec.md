

### Accounts / Auth / Tiers

* **Clerk auth** for signed-in users.
* **Anonymous mode** allowed (free): **no AI usage, no Plaid usage** (but app structure must make tier upgrades easy).
* Data is **fully isolated per user**. Future feature: anonymized aggregate comparisons (not now).

### Plaid + Budgeting

* **Multiple Plaid items + multiple account types** (checking, credit, HYSA, investment, etc).
* Initial import: **last 30 days**, then **cursor-based incremental sync**.
* Budgeting supports:

  * **Top-level budgets** (Grocery, Bills, Rent, etc)
  * **Subcategories** inside top-level (e.g. Grocery → Costco, Household, Food, Eating Out)
* Period is **monthly by default**, optionally **custom** (user-defined cycle).
* Over budget = **visual indicator** + optional notifications.

### Categorization & Receipts

* Categorize “as well as possible” using:

  1. caches/rules
  2. deterministic (MCC/keyword)
  3. **AI as last resort** if first-time merchant / ambiguous
* Receipts:

  * **Camera photo only**
  * Auto-link to a bank transaction if possible (time/store/total; ask user if needed)
  * If unlinked: **does not affect budgets**
  * Receipt parsing: as detailed as possible; uncertain fields flagged for review
  * **Normalize items**: AI normalization + cache + user-editable canonical items/ingredients

### Recipes + Meal Planning + Pricing

* Recipe input: **URL paste**, AI reads link
* Store **full recipe content** (editable, notes)
* Parse ingredients deeply; unit conversion **approx OK**
* Pricing:

  * Prefer **most recent purchase price**
  * Else **online store pricing lookup** (and flag)
  * Cost is **per serving**
* Meal plan:

  * Weekly plan with CRUD
  * AI can search for new recipes online
  * Weekly plan produces: **estimated budget + shopping list**
  * Budget impact occurs **when purchased**, but planned amount can be tracked separately
* Pantry:

  * Initially assume everything must be bought
  * Add Pantry DB + pantry page
  * Pantry can be populated by user + photo-of-pantry AI import (future-ish but you want it in plan)

### Priorities

1. Budget accuracy
2. Receipt accuracy
3. Recipe pricing accuracy
4. Speed/simplicity
5. AI wow

Success MVP: **Plaid auto-budgeting works + meal planning & pricing works**.
