# GroceryBudget

GroceryBudget is a personal budgeting app built with Expo + Convex + Clerk. It connects to Plaid (Sandbox), categorizes spending, tracks budgets, and helps plan meals with recipes and pricing.

## Features

- Plaid Sandbox connection with multi-item accounts
- Budget categories + subcategories with monthly tracking
- Transaction categorization (rules → MCC/keyword → AI fallback)
- Receipts (camera only) with AI parsing + transaction linking
- Recipes (URL import) + meal planning + shopping list
- Pricing per serving with recent purchase price, Walmart lookup, or AI fallback
- Anonymous mode (no Plaid / no AI) with merge-on-sign-in

## Environment Variables

Create a `.env` in the project root by copying `.env.example` and filling in values:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud

# Convex server auth config (used by convex/auth.config.ts)
CLERK_ISSUER_URL=https://<your-subdomain>.clerk.accounts.dev
CLERK_JWT_TEMPLATE=convex

# OpenAI (text + vision)
OPENAI_API_KEY=...

# Plaid (Sandbox)
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=https://<your-webhook-host>/webhooks/plaid

# Walmart price lookup (shopping list + recipe estimates)
WALMART_LOOKUP_ENABLED=true
WALMART_API_BASE_URL=https://<your-walmart-endpoint>/search
WALMART_API_KEY=...
WALMART_API_KEY_HEADER=Authorization
WALMART_API_HOST_HEADER=X-RapidAPI-Host
WALMART_API_HOST_VALUE=<optional-host-value>
WALMART_QUERY_PARAM=query
WALMART_PRICE_UNIT=dollars

# Legacy generic price lookup unit (optional)
PRICE_LOOKUP_PRICE_UNIT=dollars

# Recipe search (Spoonacular-compatible)
RECIPE_SEARCH_API_KEY=...
RECIPE_SEARCH_BASE_URL=https://api.spoonacular.com
```

## Run

```
# backend
npx convex dev

# app
npm run start
```

## Notes

- Anonymous mode works with local device data but disables Plaid + AI.
- Signing in merges anonymous data into the user account.
