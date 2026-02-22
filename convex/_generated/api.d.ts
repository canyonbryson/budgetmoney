/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai_pricing from "../ai/pricing.js";
import type * as ai_shoppingList from "../ai/shoppingList.js";
import type * as analytics from "../analytics.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as categorize from "../categorize.js";
import type * as categoryKinds from "../categoryKinds.js";
import type * as dashboard from "../dashboard.js";
import type * as data from "../data.js";
import type * as devices from "../devices.js";
import type * as families from "../families.js";
import type * as familyMigration from "../familyMigration.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_recipeValidation from "../lib/recipeValidation.js";
import type * as mealPlans from "../mealPlans.js";
import type * as netWorth from "../netWorth.js";
import type * as netWorthUtils from "../netWorthUtils.js";
import type * as notifications from "../notifications.js";
import type * as openai from "../openai.js";
import type * as ownership from "../ownership.js";
import type * as pantry from "../pantry.js";
import type * as periods from "../periods.js";
import type * as plaid from "../plaid.js";
import type * as priceProviders_spoonacular from "../priceProviders/spoonacular.js";
import type * as priceProviders_walmart from "../priceProviders/walmart.js";
import type * as priceProviders_winco from "../priceProviders/winco.js";
import type * as prices from "../prices.js";
import type * as receipts from "../receipts.js";
import type * as recipes from "../recipes.js";
import type * as syncState from "../syncState.js";
import type * as transactions from "../transactions.js";
import type * as transactionsSync from "../transactionsSync.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ai/pricing": typeof ai_pricing;
  "ai/shoppingList": typeof ai_shoppingList;
  analytics: typeof analytics;
  budgets: typeof budgets;
  categories: typeof categories;
  categorize: typeof categorize;
  categoryKinds: typeof categoryKinds;
  dashboard: typeof dashboard;
  data: typeof data;
  devices: typeof devices;
  families: typeof families;
  familyMigration: typeof familyMigration;
  history: typeof history;
  http: typeof http;
  "lib/normalize": typeof lib_normalize;
  "lib/recipeValidation": typeof lib_recipeValidation;
  mealPlans: typeof mealPlans;
  netWorth: typeof netWorth;
  netWorthUtils: typeof netWorthUtils;
  notifications: typeof notifications;
  openai: typeof openai;
  ownership: typeof ownership;
  pantry: typeof pantry;
  periods: typeof periods;
  plaid: typeof plaid;
  "priceProviders/spoonacular": typeof priceProviders_spoonacular;
  "priceProviders/walmart": typeof priceProviders_walmart;
  "priceProviders/winco": typeof priceProviders_winco;
  prices: typeof prices;
  receipts: typeof receipts;
  recipes: typeof recipes;
  syncState: typeof syncState;
  transactions: typeof transactions;
  transactionsSync: typeof transactionsSync;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
