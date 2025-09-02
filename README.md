# Daily Reps 👋
## Environment Variables

Create a `.env` in the project root by copying `.env.example` and filling in values:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud

# Convex server auth config (used by convex/auth.config.ts)
CLERK_ISSUER_URL=https://<your-subdomain>.clerk.accounts.dev
CLERK_JWT_TEMPLATE=convex
```

Then run the app with:

```
npm run start
```
Daily Reps is a day-to-day workout tracker that allows users to track the combined number of reps that one performs on a given day, resetting the logged reps for the following day.

This repository is the sample covered in the [**Build a daily workout tracker with Clerk, Convex, and Expo**](https://expo.dev/blog/build-a-daily-workout-tracker-with-clerk-convex-and-expo) on the Expo blog.

## Learn more

To learn how to build Daily Reps yourself, a detailed explaination of each component, service, and how they interact can be found in [the blog post](https://expo.dev/blog/build-a-daily-workout-tracker-with-clerk-convex-and-expo). Otherwise feel free to explore this repository as your convenience.

## Tools used

- [**Expo**](https://expo.dev/) is a platform that helps facilitate the development of React Native applications by providing an ecosystem of tools to help with tasks like building and testing the project, updating your applications, and submitting to the various app stores.
- [**Clerk**](https://go.clerk.com/ETd9ofq) is a user management platform designed to help developers add authentication into their applications as quickly as possible.
- [**Convex**](https://www.convex.dev/) is an open-source all inclusive backend service that combines concepts like API, database, and server functions.

## Support

If you need any support building this project, feel free to contact the author directly on X:

- [Brian Morrison II (@brianmmdev)](https://x.com/brianmmdev)

# README.md

# LedgerRocker — Expo + NativeWind + Convex + Clerk + Plaid

**LedgerRocker** is an open-source personal finance app that helps you:
- Link accounts via **Plaid**, auto-sync & categorize transactions
- Create **budgets** with envelope-style controls and alerts
- See **beautiful charts** and **forecasts** of your spending & cash-flow
- Ask an **AI copilot** questions about your finances
- Keep data safe with secure storage and least-privilege design

## Tech stack

- **App**: React Native via **Expo** (Expo Router)
- **Styling**: **NativeWind** (Tailwind for React Native) + system light/dark
- **Auth**: **Clerk** (Expo SDK)
- **Backend & DB**: **Convex** (realtime DB, server functions, HTTP Actions)
- **Plaid**: React Native Link SDK + **Transactions Sync** + **webhooks**
- **Push**: **Expo Notifications**
- **Charts**: `victory-native` + `react-native-svg`
- **i18n**: `i18next` + `react-i18next` + `expo-localization`
- **Secure storage**: `expo-secure-store` (Keychain/Keystore)

## Features

- **Plaid Link**: link_token flow, exchange public_token → store access_token (server-only)
- **Background sync**: Plaid webhook → Convex HTTP Action → `/transactions/sync` cursor flow
- **Budgets**: period, target, categories, rollovers, burn-rate, alerts
- **Insights**: category breakdowns, trend lines, month-over-month change, simple forecast
- **Ask-AI**: OpenAI-based copilot using your financial profile & plans (opt-in, revocable)
- **i18n + theming**: production-ready localization & light/dark with NativeWind
- **Privacy**: access_token never leaves server; device stores only session & prefs in SecureStore

## Architecture

```

Expo (RN) app
├─ Clerk (Expo SDK) → user session
├─ NativeWind (Tailwind classes)
├─ i18next + expo-localization
├─ Expo Notifications (device push token)
├─ Plaid Link (RN SDK) → link\_token from Convex → public\_token
│     ↳ Convex Action exchange\_public\_token → store Plaid access\_token
└─ Convex client (queries/mutations) ← realtime data
├─ HTTP Action: /webhooks/plaid  (SYNC\_UPDATES\_AVAILABLE → /transactions/sync)
├─ Actions: notify device via Expo Push
└─ Tables: users, items, accounts, transactions, budgets, rules, profiles, plans, notifications

```

## Security & privacy

- **Server-only**: Plaid access tokens & cursors live in Convex env (never on device).
- **Webhook verify**: verify Plaid webhook signatures before processing.
- **Device**: use SecureStore for tokens/prefs; no plaintext secrets in AsyncStorage.
- **Data minimization**: store only what you render; redact logs.

## Open source

- License: **MIT**
- **CODE_OF_CONDUCT.md**: Contributor Covenant v2.1
- **CONTRIBUTING.md**: Conventional Commits; PR checklist; issue/PR templates
- **CHANGELOG.md**: Keep a Changelog + SemVer
- **SECURITY.md** + Dependabot config
- CI: typecheck, lint, tests; basic EAS build checks

## Roadmap

- Smart category rules & auto-learn overrides
- CSV/OFX export & import
- Advanced forecasts (seasonality, income irregularity)
- Optional E2E encryption for selected local notes/fields
