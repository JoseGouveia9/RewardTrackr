<img src="public/logo.webp" alt="RewardTrackr" width="60" align="left" style="margin-right:14px;border-radius:12px" />

# RewardTrackr

A free tool built to help GoMining users export their full rewards history for tax reporting and personal record keeping.

> **Disclaimer:** This is an unofficial tool and is not affiliated with, endorsed by, or associated with the GoMining team.

## What it does

Tax season is stressful enough without having to manually track your crypto rewards. GoMining only offers built-in exports for Solo Mining and MinerWars, leaving everything else out. RewardTrackr fills that gap. Connect your account, pick which sheets you want, and download a ready-to-use `.xlsx` file with all your data, including fiat values in your local currency, making it easy to hand off to your accountant or fill in your tax return.

You can also browse your data directly in the app before exporting, with filters, date ranges, and currency toggles.

**Sheets you can export:**

- Solo Mining
- MinerWars
- Simple Earn
- Bounties
- Referrals
- Ambassador
- Deposits & Withdrawals
- Purchases & Upgrades
- Transactions (veGoMining Rewards, Personal MinerWars Rewards, Miner Sales, Liquidity Rewards, Clan Ownership Rewards, Bonuses)

**Fiat values** are fetched automatically using historical rates (CoinGecko + FX Rates API), so each row shows what your rewards were worth in USD, and optionally in your local currency, at the time they were received.

## Features

- **Data Viewer** - browse your records in-app before exporting, with filters, date ranges, and currency toggles
- **Fiat conversion** - each row shows the USD and local currency value at the time the reward was received
- **Browser cache** - data is cached after the first fetch, so subsequent exports only pull new records
- **Dark & light mode** - follows your system preference with a manual toggle

## Privacy

Your GoMining session token is used only inside your browser to fetch your data directly from the GoMining API. It is never sent to any third-party server or stored anywhere outside your device.

## How to use

1. Install the RewardTrackr browser extension
2. Open GoMining in your browser and make sure you're logged in
3. Click the extension icon to sync your session
4. Open the [RewardTrackr app](https://josegouveia9.github.io/RewardTrackr/)
5. Select the sheets you want and click **Build Excel**

That's it, your file will download automatically.

## Notes

- The app runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a request fails due to rate limits, wait a moment and try again.
- Exports are limited to **1 per day** to keep the service free and available for everyone.
- Data is cached in your browser after the first export, so future exports only fetch new records.

## Tech stack

| Layer            | Choice                              | Reason                                                                |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------- |
| UI framework     | React 19 + TypeScript               | Component model and type safety                                       |
| Build tool       | Vite 8                              | Fast dev server and ESM-native bundling                               |
| Styling          | Plain CSS (component-scoped)        | No overhead, full control, dark/light theming via CSS variables       |
| Animations       | Framer Motion                       | Declarative enter/exit transitions                                    |
| State            | `useState` + custom hooks           | Feature logic is self-contained, no global store needed               |
| Data fetching    | Native `fetch` with custom wrappers | Lightweight, no extra dependency for simple REST calls                |
| Excel generation | ExcelJS                             | Full control over cell formatting, column widths, and sheet structure |
| Pricing data     | CoinGecko + FX Rates API            | Historical USD prices and fiat exchange rates per day                 |
| Backend          | Cloudflare Workers                  | Edge-deployed, free-tier friendly, low-latency proxy                  |
| Error tracking   | Sentry                              | Production error visibility with source maps                          |
| Code quality     | ESLint 10 + Prettier + Husky        | Enforced on every commit via lint-staged                              |

The folder structure follows a **feature-based layout** (`features/auth`, `features/export`, `features/data-viewer`) where each feature owns its components, hooks, types, and utilities. Shared utilities live in `src/lib`. There is no UI component library, all components are hand-built.

### Why no server-side backend?

This was a deliberate choice, driven by two things:

**Deployment simplicity** - a fully static app can be hosted on GitHub Pages at zero cost with no infrastructure to maintain. There is no server to provision, scale, or keep alive.

**User trust** - your GoMining session token is the most sensitive piece of data in this flow. By keeping everything client-side, the token never leaves your browser. It is used directly to call the GoMining API from your machine, the resulting data is processed locally, and the final `.xlsx` file is assembled and downloaded entirely in-browser. There is no server that could log, store, or misuse it. You can verify this yourself by inspecting the source, what you read is exactly what runs.

The Cloudflare Worker listed in the stack is a thin, stateless proxy used only to attach required headers to third-party API calls (CoinGecko, FX rates) that would otherwise be blocked by CORS. It never sees your token or your reward data.

## Feedback & issues

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/JoseGouveia9/RewardTrackr/issues).

---

© 2026 José Gouveia · Moustachio
