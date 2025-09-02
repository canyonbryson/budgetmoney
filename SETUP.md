# SETUP.md

# LedgerRocker — Setup (Expo + NativeWind + Convex + Clerk + Plaid)

## 0) Prereqs
- Node 18+, pnpm/yarn, Git
- Xcode + iOS Simulator; Android Studio + SDKs
- Expo CLI + EAS (`npm i -g expo-cli eas-cli`)
- Accounts: Plaid (Sandbox), Convex, Clerk, OpenAI
- (Push) Expo account for Expo Notifications

## 1) Create project from Convex + Clerk + Expo template (recommended)

This wires Convex + Clerk + Expo for you (web + native). Keep `apps/native` and the Convex backend, remove web if you don’t need it.

```bash
npm create convex@latest -- -t get-convex/turbo-expo-nextjs-clerk-convex-monorepo
cd turbo-expo-nextjs-clerk-convex-monorepo
pnpm install
````

Then:

* Set Convex & Clerk env vars as per template README.
* In `apps/native`, add your `EXPO_PUBLIC_CONVEX_URL` and Clerk publishable key.

*(Alternatively: `npx create-expo-app` from scratch and add Convex + Clerk manually.)*

## 2) Add NativeWind (Tailwind for RN)

```bash
cd apps/native
pnpm add nativewind tailwindcss react-native-reanimated react-native-safe-area-context
pnpm -w add -D prettier-plugin-tailwindcss
npx tailwindcss init
```

* Add `nativewind/preset` to `tailwind.config.js`, point `content` to your screens/components.
* Add `nativewind/babel` + `jsxImportSource: "nativewind"` to `babel.config.js`.
* Create `global.css` with `@tailwind base; @tailwind components; @tailwind utilities;`
* Edit `metro.config.js` to wrap with `withNativeWind(config, { input: './global.css' })`.
* Ensure `app.json` has `"web": { "bundler": "metro" }`.

## 3) Clerk (Expo) + Convex

* Install Clerk Expo SDK in `apps/native` and wrap app with `<ClerkProvider>`.
* In `apps/native`, wrap Convex with `<ConvexProviderWithClerk>` to share auth to server calls.
* In Convex, create a **JWT template** for Clerk and secure actions/queries by session.

## 4) Plaid (React Native) with Expo dev build

Plaid’s RN SDK is a native module; you’ll use **Expo prebuild** + **dev build**:

```bash
cd apps/native
pnpm add react-native-plaid-link-sdk
npx expo prebuild
eas build --profile development --platform ios   # and/or android
```

iOS:

* Ensure the Podfile includes `pod 'Plaid', '~> <latest>'` if required; run `pod install`.
  Android:
* Set `android.package` in `app.json` and include it when creating `link_token` (`android_package_name`).

Client flow:

* Call Convex action `create_link_token` → open Plaid Link → onSuccess send `public_token` to `exchange_public_token`.

## 5) Plaid Transactions Sync + webhooks

* In Convex, create an **HTTP Action** at `/webhooks/plaid`.
* On first link of an Item, call `/transactions/sync` once to start **SYNC\_UPDATES\_AVAILABLE** webhooks.
* Webhook handler:

  * **Verify signature** (Plaid’s JWT/JWK verification).
  * On `SYNC_UPDATES_AVAILABLE`, call `/transactions/sync` with last cursor.
  * Upsert `added`, apply changes for `modified`, delete `removed`.
  * Fan-out push notifications (see §6).

## 6) Push notifications (Expo)

* In app, use `expo-notifications` to get a device push token; store it per user/device in Convex.
* Server side, send notifications with Expo’s Push API from a Convex Action.
* Start with alerts like “New transaction posted in Groceries: \$23.41”.

## 7) Charts & i18n

* `pnpm add victory-native react-native-svg`
* `pnpm add i18next react-i18next expo-localization`
* Create `i18n/` with `en/*.json`, `es/*.json`; initialize i18next on app start.

## 8) Secure storage & config

* `pnpm add expo-secure-store`
* Store only session, push token, and benign prefs on device; **never** the Plaid access\_token.
* All secrets live in Convex env vars.

## 9) OpenAI “Ask-AI”

* Add an Action in Convex that calls OpenAI’s **Responses API** with:

  * user’s financial profile & plan (from Convex)
  * latest budget metrics & aggregates
* Return a safe, readable answer (and optional structured suggestions).

## 10) Run it

```bash
# backend
cd packages/backend
npx convex dev

# mobile
cd ../../apps/native
pnpm start
# open the dev build on device/simulator
```