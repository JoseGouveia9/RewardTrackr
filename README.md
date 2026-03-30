<img src="public/logo.webp" alt="RewardTrackr" width="60" align="left" style="margin-right:14px;border-radius:12px" />

# RewardTrackr

A free tool built to help GoMining users export their full rewards history for tax reporting and personal record keeping.

> **Disclaimer:** This is an unofficial tool and is not affiliated with, endorsed by, or associated with the GoMining team.

## What it does

Tax season is stressful enough without having to manually track your crypto rewards. GoMining only offers built-in exports for Solo Mining and MinerWars, leaving everything else out. RewardTrackr fills that gap. Connect your account, pick which sheets you want, and download a ready-to-use `.xlsx` file with all your data — including fiat values in your local currency — making it easy to hand off to your accountant or fill in your tax return.

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

- **Data Viewer** — browse your fetched records directly in the app before exporting, with column sorting, pagination, and per-tab filters
- **Date range filter** — pick a custom date range with an inline calendar to narrow down your records
- **Currency toggle** — switch between BTC, GMT, USD, and your local fiat currency on the fly
- **Group by day** — collapse multiple records into daily totals for a cleaner overview
- **Transaction type filter** — select which transaction types to include in the Transactions sheet
- **Silent token refresh** — your session is automatically refreshed in the background via the extension, so you don't get logged out mid-export
- **Browser cache** — data is cached after the first fetch, so subsequent exports only pull new records
- **Dark & light mode** — follows your system preference with a manual toggle

## Privacy

Your GoMining session token is used only inside your browser to fetch your data directly from the GoMining API. It is never sent to any third-party server or stored anywhere outside your device.

## How to use

1. Install the RewardTrackr browser extension
2. Open GoMining in your browser and make sure you're logged in
3. Click the extension icon to sync your session
4. Open the [RewardTrackr app](https://josegouveia9.github.io/RewardTrackr/)
5. Select the sheets you want and click **Build Excel**

That's it — your file will download automatically.

## Notes

- The app runs on free-tier services (Cloudflare, CoinGecko, FX Rates API). If a request fails due to rate limits, wait a moment and try again.
- Exports are limited to **1 per day** to keep the service free and available for everyone.
- Data is cached in your browser after the first export, so future exports only fetch new records.

## Feedback & issues

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/JoseGouveia9/RewardTrackr/issues).

---

© 2026 José Gouveia · Moustachio
