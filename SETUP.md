# GroceryBudget — Setup

## Prereqs
- Node 18+
- Expo CLI
- Xcode / Android Studio
- Accounts: Clerk, Convex, Plaid (Sandbox), OpenAI

## Install

```
npm install
```

## Environment

Copy `.env.example` to `.env` and fill in values (see README).

## Run

```
# backend
npx convex dev

# app
npm run start
```

## Notes
- Plaid is sandbox only for this project.
- AI features require `OPENAI_API_KEY`.
- Plaid Link requires a dev build (native module). Use `npx expo prebuild` and a dev client.
- Webhook verification uses `jose` and requires `PLAID_CLIENT_ID` + `PLAID_SECRET`.
