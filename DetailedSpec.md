# GroceryBudget — Detailed App Spec (Expo React Native + Convex + Clerk)

A budgeting + meal-planning app with two main pillars:

1. **Auto-budgeting from bank transactions (Plaid)** with envelope-style budgets, hierarchy (parent + subcategories), transfer tracking, credit card awareness, and rule/AI-assisted categorization.

2. **Receipt → items + categories + pricing** plus **Recipe → ingredients → cost-per-serving**, saved recipes, a weekly meal plan (day + optional meal slots), and an AI-generated shopping list. Receipts can optionally link to bank transactions and split grocery spending into grocery subcategories.

This spec is written to be buildable with minimal guesswork.

---

## 1) Product Rules (Locked)

### 1.1 Users, Auth, Tiers

* **Auth:** Clerk for signed-in users.
* **Anonymous mode:** Allowed and **local-only** (no Convex). “Excel-level”: budgets, categories, manual transactions, manual recipes, manual meal planning.
* **Paid:** Unlimited Plaid + AI.
* **Signed-in:** “Always online” (Convex as source of truth; no offline write queue in MVP).
* **Data isolation:** Per user. Future benchmarking (“50th percentile”) is not implemented now.

### 1.2 Benchmarking / Income / Household

* Household attributes collected:

  * **People you feed** (integer)
  * **Monthly net income** (optional, **opt-in**, stored in Convex)
* Benchmarking data is **anonymous** when used later (aggregation only; no user-level exposure).
* Paid: monthly net income **may be estimated** from transactions as a suggestion; user can override.

---

## 2) Core Features

## A) Bank Connection + Auto-Budgeting (Plaid)

### A.1 Plaid Support

* Multiple connected Items and Accounts.
* Account types include checking/savings/HYSA/credit/investment.
* Initial sync: **last 30 days**.
* Incremental sync: **cursor-based**.
* Environment:

  * MVP supports Sandbox.
  * Architecture supports Production later.

### A.2 Budget Model (Envelope Style)

* Budget hierarchy:

  * **Top-level categories** (e.g., Grocery, Bills, Rent, Charity, Personal, Income, Savings).
  * **Subcategories** within a top-level (Grocery → Costco, Household, Food, Eating Out).
* **Rule:** sub-budgets **must sum** to parent budget.
* Period defaults to **monthly**, but supports paycheck cycles:

  * weekly
  * biweekly
  * semimonthly (1st & 15th)
  * monthly starting day X
* **Rollover:** configurable per category:

  * none
  * roll remaining forward
  * roll overspend forward (debt)
* Transfers are tracked as budget events (e.g., Income → Savings allocation).

### A.3 Transactions & Categorization

* All transactions are budgeted (not just grocery), but grocery is the primary focus.
* Categorization pipeline priority:

  1. **User rule cache** (fuzzy merchant match) → wins over everything
  2. deterministic mapping (MCC, keywords)
  3. **AI as last resort** ONLY when unknown merchant and no MCC mapping
* When user manually categorizes:

  * creates/updates a fuzzy merchant rule automatically (default on; user can disable per action)
  * applies to future similar merchants
* Refunds reduce spend automatically (negative amount applies to category totals).

### A.4 Transfers

* Auto-detected transfers are **still recorded** (not excluded).
* Default: categorize as `Transfer` and also require direction mapping:

  * Source envelope decreases, destination envelope increases
* If transfer cannot be resolved, it is flagged for review.

### A.5 Credit Cards (“Pseudo-payments”)

* Credit purchases reduce budget immediately (spending counts at purchase time).
* Credit card payments are treated as **transfers** (do not double-count spending).
* Due dates & minimums:

  * **Free:** manual entry (due date, min payment, last statement balance)
  * **Paid:** Plaid Liabilities if available + fallback manual
* App warns and notifies about upcoming due dates.

---

## B) Receipts + Itemization + Grocery Subcategory Splits

### B.1 Capture

* Input: **camera photo only**.
* Receipt parsing aims for maximum detail:

  * store name/location (if present), date/time, subtotal, tax, discounts/coupons, total
  * line items: name, quantity, unit price, total price
  * item category assignment (within Grocery subcategories)

### B.2 Linking to Bank Transaction

* Goal: auto-link receipts to bank transactions when possible.
* Matching criteria:

  * similar time window
  * similar store
  * exact same total preferred
  * If mismatch but within **5% tolerance**, allow link but **flag for review**
* Multiple receipts can link to one transaction.

### B.3 Budget Effect Rules

* **Unlinked receipts do not affect budgets.**
* **Linked receipts**:

  * split the grocery transaction into **Grocery subcategory allocations** based on receipt item categories
  * parent Grocery total still equals transaction total
  * allocations are stored and drive subcategory spending
* Receipt parsing errors or low-confidence fields are flagged for review.

### B.4 Normalization

* Receipt items are normalized into a per-user canonical ingredient/item dictionary:

  * AI normalization + cache
  * user can edit canonical names and merge items

### B.5 Review UX

* Dedicated **Receipts screen** includes:

  * Inbox-style list: “Needs review”
  * Filters: linked/unlinked, store, date, confidence, mismatch flagged
* “Needs review” triggers:

  * any low-confidence field
  * total mismatch (including within 5% tolerance matches)

---

## C) Recipes + Meal Planning + Pricing

### C.1 Recipe Ingestion

* User pastes a URL; AI fetches/reads content.
* Stored data is **structured** + **summary** + **link** (not full verbatim page).
* App supports “all” recipe sources (standard pages, paywalled, YouTube descriptions, Instagram-style pages) with graceful fallback:

  * If content inaccessible, prompt user to paste text or manually enter.

### C.2 Recipe Data Requirements

* Required fields:

  * ingredients (parsed list)
  * servings
* User-editable:

  * ingredients, servings, steps, notes, tags
* If servings confidence < **0.7** or missing/ambiguous → require user confirmation.

### C.3 Ingredient Parsing

* Deep parse “as reasonably possible”:

  * ingredient name
  * quantity + unit
  * preparation notes (optional)
* Unit conversion is approximate; user can correct.

### C.4 Pricing & Cost-per-Serving

* Pricing priority per ingredient:

  1. **Most recent purchase price within last 30 days** (from receipts/linked items)
  2. else **AI web search price** (Walmart/Winco/Costco targets; may include other sources)
  3. flag any uncertain matches for review
* Free vs paid product matching:

  * **Free:** user selects best match (product search UI)
  * **Paid:** AI guesses best match; flags for review
* Outputs:

  * cost per serving (required)
  * confidence + sources displayed (receipt history vs web)

### C.5 Meal Planning

* Weekly plan with per-day schedule:

  * each day has optional slots: breakfast/lunch/dinner (slots can be empty)
* User can CRUD weekly plan.
* AI features:

  * search online for new recipes (paid)
  * generate shopping list (paid)
* Planned vs actual:

  * show **planned grocery cost** estimate vs **actual spend** weekly/monthly
  * actual spend is derived from transactions (and receipt splits when available)

### C.6 Shopping List

* Generated from meal plan:

  * aggregates quantities across recipes
  * approximate conversions handled by AI (not a strict algorithm)
  * grouped by store (future paid “optimize store routing” feature, but initial list can still group by common store preferences)
* Shopping list items:

  * persistent (do not reset)
  * checkboxes persist across devices (signed-in)
  * support “add custom item”, “mark purchased”, “move to pantry” (pantry later)

---

## 3) App Screens & UX (Specific)

### 3.1 Onboarding

* Entry state:

  * “Continue as Guest” (anonymous, local-only)
  * “Sign in” (Clerk)
* After sign-in, if guest data exists:

  * Merge flow: keep both, dedupe; **local wins conflicts**
  * Show results summary (X transactions merged, Y duplicates removed)

### 3.2 Tabs (suggested)

1. [x] **Dashboard**
2. [x] **Budget**
3. [x] **Transactions**
4. [x] **Receipts**
5. [x] **Meals** (meal plan + recipes + shopping list)
6. [x] **Settings**

### 3.3 Dashboard

* Current period summary:

  * total spent vs total budget
  * top category cards (progress bars)
  * “pace” indicator (optional)
* Alerts:

  * credit card due soon
  * receipts needing review
  * budget threshold notifications
* Quick actions:

  * [x] Sync now (paid)
  * [x] Scan receipt (camera)
  * [x] Add transaction (free/manual)

### 3.4 Budget Screen

* Budget period selector (monthly/paycheck)
* Parent categories list with allocated totals
* “Allocate” button opens allocation screen:

  * edit all sub-budgets at once
  * enforce sum == parent at save
* Rollover settings per category

### 3.5 Transactions Screen

* List + filters:

  * date range
  * category + subcategory
  * account
  * amount min/max
  * merchant search
  * pending toggle
* Transaction detail:

  * category picker
  * rule toggle (“apply to future similar merchants”)
  * receipt link suggestions (if receipt exists)
  * if credit: show statement status & due date reminders

### 3.6 Receipts Screen

* Primary sections:

  * Needs Review
  * Linked
  * Unlinked
* Receipt detail:

  * image viewer
  * parsed totals + line items
  * edit any field
  * item categories (grocery subcategories)
  * link/unlink to transaction
  * show split allocations preview

### 3.7 Meals Screen

* Sub-tabs:

  * Meal Plan (week view)
  * Recipes (saved)
  * Shopping List
* Recipe detail:

  * ingredients + steps + notes
  * servings (required)
  * cost per serving with confidence + sources
* Meal plan:

  * drag/drop recipe into slots
  * “Estimate weekly cost”
  * “Generate shopping list”

### 3.8 Settings

* Account status: guest vs signed-in
* Plan: free vs paid
* Notification settings (templates)
* Credit card reminders
* Household size + monthly net income (opt-in)
* Data export (future)
* Danger zone: clear local data / clear account data

---

## 4) Data Architecture

## 4.1 Storage Modes

### Guest (Anonymous)

* Local-only:

  * SQLite (expo-sqlite) recommended for reliability
  * Images stored locally + file path references
* No Plaid, no AI calls (hard enforced)

### Signed-in

* Convex is primary DB.
* Images stored in object storage (Convex file storage or S3 via signed URLs) with references in Convex.

---

## 5) Convex Data Model (Proposed)

### Core

* `users`

  * clerkUserId
  * createdAt
  * plan: "free" | "paid"
  * householdSize?: number
  * monthlyNetIncome?: number (opt-in)
  * incomeOptIn: boolean

### Plaid

* `plaidItems`

  * userId
  * itemId
  * accessToken (sensitive)
  * institutionName
  * status
  * createdAt/updatedAt

* `plaidAccounts`

  * userId
  * itemRef
  * plaidAccountId
  * type/subtype
  * name/mask
  * balances (optional)
  * updatedAt

* `syncState`

  * userId
  * itemRef
  * cursor
  * lastSyncAt
  * lastSyncStatus
  * lastSyncError

### Budgeting

* `categories`

  * userId
  * type: "income" | "expense" | "transfer"
  * name
  * parentCategoryId? (null for top-level)
  * sortOrder
  * createdAt/updatedAt

* `budgets`

  * userId
  * categoryId (top-level)
  * periodType: monthly/weekly/biweekly/semimonthly/monthlyDayX
  * startRule (e.g., dayOfMonth or semimonthlyDays)
  * rolloverMode: none/positive/negative/both
  * createdAt/updatedAt

* `budgetAllocations`

  * userId
  * parentBudgetId
  * subCategoryId
  * amount
  * createdAt/updatedAt

### Transactions

* `transactions`

  * userId
  * plaidTransactionId? (null if manual)
  * accountRef?
  * date
  * merchantName
  * amount
  * pending
  * categoryId (top-level)
  * subCategoryId? (within Grocery or others if expanded later)
  * source: rule/mcc/keyword/ai/manual
  * confidence
  * isCreditPurchase boolean
  * creditCardMetaRef? (if relevant)
  * createdAt/updatedAt

* `transactionSplits`

  * userId
  * transactionRef
  * subCategoryId
  * amount
  * source: receipt/manual
  * createdAt/updatedAt

* `merchantRules`

  * userId
  * merchantPattern (fuzzy normalized)
  * categoryId
  * subCategoryId?
  * createdAt/updatedAt

### Credit

* `creditCards`

  * userId
  * plaidAccountRef? (paid)
  * nickname
  * dueDateDayOfMonth (manual fallback)
  * minimumPayment
  * lastStatementBalance
  * lastPaymentDate?
  * updatedAt

### Receipts

* `receipts`

  * userId
  * imageRef
  * storeName
  * storeLocation?
  * purchaseDateTime?
  * subtotal
  * tax
  * discounts
  * total
  * linkedTransactionRef? (nullable)
  * linkStatus: unlinked/linked/linkedMismatch
  * needsReview boolean
  * confidenceOverall
  * createdAt/updatedAt

* `receiptItems`

  * userId
  * receiptRef
  * rawName
  * canonicalItemId?
  * quantity
  * unitPrice
  * totalPrice
  * grocerySubCategoryId
  * confidence
  * createdAt/updatedAt

### Canonical Items / Ingredient Dictionary (per user)

* `canonicalItems`

  * userId
  * name
  * synonyms[]
  * updatedAt

### Recipes + Meal Plan

* `recipes`

  * userId
  * sourceUrl
  * title
  * summary
  * servings (required)
  * ingredients[] (structured)
  * steps[] (optional)
  * notes
  * costPerServing
  * costConfidence
  * costSources (receipt/web)
  * createdAt/updatedAt

* `mealPlans`

  * userId
  * weekStartDate
  * createdAt/updatedAt

* `mealPlanEntries`

  * userId
  * mealPlanRef
  * date
  * slot: breakfast/lunch/dinner
  * recipeRef
  * servingsOverride? (optional)

* `shoppingLists`

  * userId
  * name (default “Week of …”)
  * createdAt/updatedAt

* `shoppingListItems`

  * userId
  * shoppingListRef
  * canonicalItemId?
  * displayName
  * quantityText (AI-generated)
  * checked boolean
  * source: mealPlan/manual
  * updatedAt

### Indexes (must-have)

* transactions: (userId, date)
* transactions: (userId, categoryId, date)
* receipts: (userId, needsReview, createdAt)
* recipes: (userId, updatedAt)
* mealPlans: (userId, weekStartDate unique)
* merchantRules: (userId, merchantPattern)

---

## 6) Backend Functions (Convex)

### 6.1 Auth + Entitlements

* Every query/mutation checks `clerkUserId` and `plan`.
* Guest mode never calls Convex.

### 6.2 Plaid (Paid only)

* `plaid.exchangePublicToken`
* `plaid.syncTransactions(cursor-based)`
* `transactions.upsertFromPlaid`
* `liabilities.fetch` (paid if supported)

### 6.3 Categorization

* `categorizeTransaction(transaction)`:

  * merchant rule fuzzy match (wins)
  * MCC/keyword
  * AI fallback only if unknown & no MCC mapping
* `merchantRules.upsertFromManualCategorization`

### 6.4 Receipts (AI paid only)

* `receipts.uploadImage`
* `receipts.parseWithAI`
* `receipts.normalizeItemsWithAI`
* `receipts.linkToTransaction` (with mismatch tolerance rules)
* `transactions.applyReceiptSplitAllocations(transactionRef, receiptRef)`

### 6.5 Recipes (AI paid only)

* `recipes.ingestFromUrl`
* `recipes.parseIngredients`
* `recipes.estimateCostPerServing` (recent receipt history within 30d else web search)
* `shoppingList.generateFromMealPlan` (AI generation)

### 6.6 Notifications

* Stored notification preferences per user.
* Triggers:

  * budget thresholds
  * receipt needs review
  * credit due soon
  * weekly planned vs actual summary

---

## 7) AI System Spec (OpenAI)

### 7.1 AI Tasks

Paid-only AI calls:

1. Transaction categorization fallback
2. Receipt OCR+parse (image → structured receipt)
3. Item normalization (raw item → canonical item)
4. Recipe ingestion (URL → structured recipe)
5. Recipe pricing (cost-per-serving with sources)
6. Shopping list generation (aggregated, approximate)

### 7.2 Explainability (Required)

Every AI-produced output must store:

* confidence score(s)
* sources:

  * receipt history vs web
* rationale text (short)
* “Needs review” flags when confidence low or mismatch exists

### 7.3 Review Control

* Any low-confidence field → requires review.
* User edits become training signals for future caching:

  * merchant rules
  * canonical item mappings
  * ingredient/product mapping preferences

---

## 8) Free vs Paid Behavior (Enforced)

### Free (Anonymous OR Signed-in Free)

* No Plaid
* No AI
* Manual:

  * budgets/categories
  * transactions
  * recipes (manual entry)
  * meal plan (manual)
  * shopping list (manual)

### Paid

* Plaid: connect/sync multiple accounts
* AI:

  * receipt parsing + normalization + linking
  * recipe URL ingestion
  * pricing via history + web
  * AI shopping list
  * AI recipe discovery suggestions
* Liabilities if available

---

## 9) Merge Strategy (Guest → Signed-in)

On sign-in:

* Upload local entities to Convex.
* Dedupe:

  * Transactions: (date, amount, merchantName normalized, account?) and/or local UUID mapping
  * Recipes: by sourceUrl; else title+ingredients hash
  * Meal plans: by weekStartDate
  * Pantry later: by canonicalItemId
* Conflicts: **local wins** (overwrite server fields on collision).
* Always keep both if no confident dedupe match.

---

## 10) MVP Build Plan (tight)

### MVP-1 (Foundation)

* [x] Clerk auth + guest mode local DB
* [x] Budget hierarchy + allocation screen + envelope logic + rollover config
* [x] Manual transactions + transaction list + filters

### MVP-2 (Paid Banking)

* [x] Plaid connect + 30d import + cursor sync
* [x] Categorization rules + AI fallback (paid)
* [x] Transfers + refunds + credit purchase classification

### MVP-3 (Receipts)

* [x] Camera capture
* [x] Paid receipt parsing pipeline + review UI
* [x] Receipt linking + grocery subcategory split allocations

### MVP-4 (Recipes + Meals)

* [x] Recipe URL ingestion (paid) + manual recipe entry (free)
* [x] Cost-per-serving w/ confidence + sources
* [x] Weekly meal plan per day w/ optional slots
* [x] AI shopping list generation + persistent checklist

### MVP-5 (Notifications + Polishing)

* [x] user-configurable notification presets
* [x] credit due reminders
* [x] planned vs actual dashboards weekly/monthly
