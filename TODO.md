# TODO.md

# LedgerRocker — Scaffold Plan

## A. Repo hygiene (open source)
- [ ] MIT `LICENSE`
- [ ] `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- [ ] `CONTRIBUTING.md` (Conventional Commits, PR flow)
- [ ] `.github/ISSUE_TEMPLATE/*.yml` + `PULL_REQUEST_TEMPLATE.md`
- [ ] `SECURITY.md` + `.github/dependabot.yml`
- [ ] `CHANGELOG.md` (Keep a Changelog + SemVer)
- [ ] CI: lint, typecheck, tests; EAS build smoke

## B. App skeleton (Expo + NativeWind)
- [ ] Expo Router navigation (tabs: Home, Transactions, Budgets, Insights, Ask-AI, Settings)
- [ ] NativeWind set up; light/dark themes; color tokens
- [ ] i18n: en + es; language switcher

## C. Auth & backend
- [ ] Clerk screens (Sign In/Up, User button)
- [ ] Convex schema: users, items, accounts, transactions, budgets, rules, profiles, plans, notifications
- [ ] Convex auth guard (session required); Clerk JWT template

## D. Plaid integration
- [ ] Convex Actions: `create_link_token`, `exchange_public_token`
- [ ] Link UI: open link, handle success/exit/errors
- [ ] `transactions_sync` Action with cursor storage

## E. Webhooks & push
- [ ] HTTP Action `/webhooks/plaid` with signature verification
- [ ] On SYNC_UPDATES_AVAILABLE → call `/transactions/sync` → upsert
- [ ] Save device push tokens; send Expo pushes on new transactions

## F. Budgeting & insights
- [ ] Budget model (period, target, categories, rollover flag)
- [ ] Assign categories (start from Plaid’s categories; allow overrides & rules)
- [ ] Charts: spend by category, trend lines, burn-rate donut, forecast

## G. Ask-AI
- [ ] Convex `askAi` Action (OpenAI Responses API)
- [ ] Prompt framework (goals, constraints, budget summaries)
- [ ] Client screen with presets + streaming UI

## H. Security & privacy
- [ ] Never persist Plaid access_token client-side
- [ ] SecureStore for session/prefs
- [ ] Redact logs; rate-limit webhook; tests for signature verify

## I. Polish & docs
- [ ] App Store/Play build configs
- [ ] Screenshots/GIFs in README
- [ ] Upgrade guide (SDK, RN, Plaid SDK)


---

## References & tips

* **Convex HTTP Actions & functions** — perfect for receiving Plaid webhooks and kicking off sync. ([Convex Developer Hub][7])
* **Convex + Clerk + Expo template** — start here and keep `apps/native`. ([Convex][1], [GitHub][2])
* **Clerk Expo docs** — install & wrap your app with Clerk; Convex provider for Clerk. ([Clerk][10], [Convex Developer Hub][11])
* **Plaid RN SDK** — Link integration steps & version requirements. ([Plaid][6])
* **Plaid Transactions Sync & webhooks** — call `/transactions/sync` once, then rely on `SYNC_UPDATES_AVAILABLE`. ([Plaid][12])
* **Plaid Webhook Verification (JWT/JWK)** — verify authenticity of webhook payloads. ([Plaid][8])
* **Expo Dev Builds & Prebuild** — required for native modules like Plaid RN SDK. ([Expo Documentation][5])
* **Expo Notifications** — unified push across iOS/Android. ([Expo Documentation][9])
* **NativeWind with Expo** — install, Tailwind preset, Metro integration. ([nativewind.dev][3])
* **Victory Native charts** — RN charting with `react-native-svg`. ([commerce.nearform.com][13])
* **i18n in RN** — `react-i18next` + `i18next`; device locale via Expo Localization. ([react.i18next.com][14])
* **Secure storage** — use Expo SecureStore (Keychain/Keystore). ([Expo Documentation][15])
* **OpenAI Responses API** — for the “Ask-AI” copilot. ([OpenAI Platform][16])
* **Open source hygiene** — Contributor Covenant v2.1, Conventional Commits, Keep a Changelog, Dependabot, issue/PR templates. ([contributor-covenant.org][17], [conventionalcommits.org][18], [keepachangelog.com][19], [GitHub Docs][20])



[1]: https://www.convex.dev/templates/monorepo?utm_source=chatgpt.com "Monorepo with Next.js and Expo"
[2]: https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo?utm_source=chatgpt.com "get-convex/turbo-expo-nextjs-clerk-convex-monorepo"
[3]: https://www.nativewind.dev/docs/getting-started/installation?utm_source=chatgpt.com "Installation"
[4]: https://docs.expo.dev/guides/tailwind/?utm_source=chatgpt.com "Tailwind CSS"
[5]: https://docs.expo.dev/develop/development-builds/introduction/?utm_source=chatgpt.com "Introduction to development builds"
[6]: https://plaid.com/docs/link/react-native/?utm_source=chatgpt.com "Link React Native SDK"
[7]: https://docs.convex.dev/functions/http-actions?utm_source=chatgpt.com "HTTP Actions | Convex Developer Hub"
[8]: https://plaid.com/docs/api/webhooks/webhook-verification/?utm_source=chatgpt.com "Webhook verification - API"
[9]: https://docs.expo.dev/push-notifications/overview/?utm_source=chatgpt.com "Expo push notifications: Overview"
[10]: https://clerk.com/docs/quickstarts/expo?utm_source=chatgpt.com "Expo Quickstart"
[11]: https://docs.convex.dev/auth/clerk?utm_source=chatgpt.com "Convex & Clerk | Convex Developer Hub"
[12]: https://plaid.com/docs/transactions/webhooks/?utm_source=chatgpt.com "Transactions webhooks"
[13]: https://commerce.nearform.com/open-source/victory/docs/introduction/native/?utm_source=chatgpt.com "React Native | Victory"
[14]: https://react.i18next.com/?utm_source=chatgpt.com "react-i18next documentation: Introduction"
[15]: https://docs.expo.dev/versions/latest/sdk/securestore/?utm_source=chatgpt.com "SecureStore - Expo Documentation"
[16]: https://platform.openai.com/docs/api-reference/responses?utm_source=chatgpt.com "Responses API reference"
[17]: https://www.contributor-covenant.org/version/2/1/code_of_conduct/?utm_source=chatgpt.com "Contributor Covenant Code of Conduct version 2.1"
[18]: https://www.conventionalcommits.org/en/v1.0.0/?utm_source=chatgpt.com "Conventional Commits"
[19]: https://keepachangelog.com/en/1.1.0/?utm_source=chatgpt.com "Keep a Changelog"
[20]: https://docs.github.com/github/managing-security-vulnerabilities/configuring-dependabot-security-updates?utm_source=chatgpt.com "Configuring Dependabot security updates"
