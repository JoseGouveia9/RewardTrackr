import type { CursorPaginationItem, RewardConfig, RewardGroup, RewardKey } from "./types";

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "https://api.gomining.com";

// Currency mappings

export const CURRENCY_TO_COINGECKO: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin",
  GMT: "gmt-token",
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  TON: "the-open-network",
};

export const WALLET_TO_CURRENCY: Record<string, string> = {
  VIRTUAL_GMT: "GMT",
  VIRTUAL_BTC: "BTC",
  VIRTUAL_ETH: "ETH",
  VIRTUAL_BNB: "BNB",
  VIRTUAL_SOL: "SOL",
  VIRTUAL_TON: "TON",
  VIRTUAL_USDC: "USDC",
  VIRTUAL_USDT: "USDT",
};

export const WALLET_TX_KEYS = new Set<RewardKey>(["bounty", "deposits", "withdrawals", "transactions"]);

export const TX_CHECKBOX_OPTIONS: Array<{ label: string; fromTypes: string[] }> = [
  { label: "veGoMining Reward", fromTypes: ["auto-claim"] },
  { label: "Personal MinerWars Reward", fromTypes: ["gmt-fund"] },
  { label: "Miner Sale", fromTypes: ["marketplace-deposit"] },
  { label: "Liquidity Reward", fromTypes: ["pool-liquidity-reward"] },
  { label: "Clan Ownership Reward", fromTypes: ["gmt-fund-clan-owner"] },
  { label: "Bonus", fromTypes: ["motivation-bonus", "registration-bonus", "promocompany-bonus"] },
];

export const ALL_TX_FROM_TYPES: string[] = TX_CHECKBOX_OPTIONS.flatMap((o) => o.fromTypes);

export const TX_FROM_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TX_CHECKBOX_OPTIONS.flatMap(({ label, fromTypes }) => fromTypes.map((ft) => [ft, label])),
);

// UI reward groups

export const REWARD_GROUPS: RewardGroup[] = [
  { id: "solo-mining", label: "Solo Mining", keys: ["solo-mining"] },
  { id: "minerwars", label: "MinerWars", keys: ["minerwars"] },
  { id: "bounty", label: "Bounties", keys: ["bounty"] },
  { id: "referrals", label: "Referrals", keys: ["referrals"] },
  { id: "ambassador", label: "Ambassador", keys: ["ambassador"] },
  { id: "deposits", label: "Deposits", keys: ["deposits"] },
  { id: "withdrawals", label: "Withdrawals", keys: ["withdrawals"] },
  { id: "purchases", label: "Purchases", keys: ["purchases"] },
  { id: "upgrades", label: "Upgrades", keys: ["upgrades"] },
  { id: "transactions", label: "Transactions", keys: ["transactions"] },
];

export const ALL_REWARD_KEYS: RewardKey[] = [
  ...new Set(REWARD_GROUPS.flatMap((g) => g.keys)),
];

// Fiat currency options for the UI dropdown

export const FIAT_OPTIONS: Array<{ currency: string; label: string }> = [
  { currency: "AED", label: "UAE Dirham" },
  { currency: "ALL", label: "Albanian Lek" },
  { currency: "AMD", label: "Armenian Dram" },
  { currency: "ANG", label: "Netherlands Antillean Guilder" },
  { currency: "AOA", label: "Angolan Kwanza" },
  { currency: "ARS", label: "Argentine Peso" },
  { currency: "AUD", label: "Australian Dollar" },
  { currency: "AWG", label: "Aruban Florin" },
  { currency: "AZN", label: "Azerbaijani Manat" },
  { currency: "BAM", label: "Bosnian Mark" },
  { currency: "BBD", label: "Barbadian Dollar" },
  { currency: "BDT", label: "Bangladeshi Taka" },
  { currency: "BGN", label: "Bulgarian Lev" },
  { currency: "BHD", label: "Bahraini Dinar" },
  { currency: "BMD", label: "Bermudian Dollar" },
  { currency: "BND", label: "Brunei Dollar" },
  { currency: "BOB", label: "Bolivian Boliviano" },
  { currency: "BRL", label: "Brazilian Real" },
  { currency: "BSD", label: "Bahamian Dollar" },
  { currency: "BTN", label: "Bhutanese Ngultrum" },
  { currency: "BWP", label: "Botswana Pula" },
  { currency: "BYN", label: "Belarusian Ruble" },
  { currency: "BZD", label: "Belize Dollar" },
  { currency: "CAD", label: "Canadian Dollar" },
  { currency: "CHF", label: "Swiss Franc" },
  { currency: "CLP", label: "Chilean Peso" },
  { currency: "CNY", label: "Chinese Yuan" },
  { currency: "COP", label: "Colombian Peso" },
  { currency: "CRC", label: "Costa Rican Colón" },
  { currency: "CVE", label: "Cape Verdean Escudo" },
  { currency: "CZK", label: "Czech Koruna" },
  { currency: "DJF", label: "Djiboutian Franc" },
  { currency: "DKK", label: "Danish Krone" },
  { currency: "DOP", label: "Dominican Peso" },
  { currency: "DZD", label: "Algerian Dinar" },
  { currency: "EGP", label: "Egyptian Pound" },
  { currency: "ERN", label: "Eritrean Nakfa" },
  { currency: "ETB", label: "Ethiopian Birr" },
  { currency: "EUR", label: "Euro" },
  { currency: "FJD", label: "Fijian Dollar" },
  { currency: "GBP", label: "British Pound" },
  { currency: "GEL", label: "Georgian Lari" },
  { currency: "GHS", label: "Ghanaian Cedi" },
  { currency: "GIP", label: "Gibraltar Pound" },
  { currency: "GMD", label: "Gambian Dalasi" },
  { currency: "GTQ", label: "Guatemalan Quetzal" },
  { currency: "GYD", label: "Guyanese Dollar" },
  { currency: "HKD", label: "Hong Kong Dollar" },
  { currency: "HNL", label: "Honduran Lempira" },
  { currency: "HTG", label: "Haitian Gourde" },
  { currency: "HUF", label: "Hungarian Forint" },
  { currency: "IDR", label: "Indonesian Rupiah" },
  { currency: "ILS", label: "Israeli New Shekel" },
  { currency: "INR", label: "Indian Rupee" },
  { currency: "ISK", label: "Icelandic Króna" },
  { currency: "JMD", label: "Jamaican Dollar" },
  { currency: "JOD", label: "Jordanian Dinar" },
  { currency: "JPY", label: "Japanese Yen" },
  { currency: "KES", label: "Kenyan Shilling" },
  { currency: "KGS", label: "Kyrgyzstani Som" },
  { currency: "KHR", label: "Cambodian Riel" },
  { currency: "KMF", label: "Comorian Franc" },
  { currency: "KRW", label: "South Korean Won" },
  { currency: "KWD", label: "Kuwaiti Dinar" },
  { currency: "KYD", label: "Cayman Islands Dollar" },
  { currency: "KZT", label: "Kazakhstani Tenge" },
  { currency: "LAK", label: "Lao Kip" },
  { currency: "LKR", label: "Sri Lankan Rupee" },
  { currency: "LRD", label: "Liberian Dollar" },
  { currency: "LSL", label: "Lesotho Loti" },
  { currency: "MAD", label: "Moroccan Dirham" },
  { currency: "MDL", label: "Moldovan Leu" },
  { currency: "MGA", label: "Malagasy Ariary" },
  { currency: "MKD", label: "Macedonian Denar" },
  { currency: "MNT", label: "Mongolian Tögrög" },
  { currency: "MOP", label: "Macanese Pataca" },
  { currency: "MRU", label: "Mauritanian Ouguiya" },
  { currency: "MUR", label: "Mauritian Rupee" },
  { currency: "MVR", label: "Maldivian Rufiyaa" },
  { currency: "MWK", label: "Malawian Kwacha" },
  { currency: "MXN", label: "Mexican Peso" },
  { currency: "MYR", label: "Malaysian Ringgit" },
  { currency: "MZN", label: "Mozambican Metical" },
  { currency: "NAD", label: "Namibian Dollar" },
  { currency: "NGN", label: "Nigerian Naira" },
  { currency: "NOK", label: "Norwegian Krone" },
  { currency: "NPR", label: "Nepalese Rupee" },
  { currency: "NZD", label: "New Zealand Dollar" },
  { currency: "OMR", label: "Omani Rial" },
  { currency: "PEN", label: "Peruvian Sol" },
  { currency: "PGK", label: "Papua New Guinean Kina" },
  { currency: "PHP", label: "Philippine Peso" },
  { currency: "PKR", label: "Pakistani Rupee" },
  { currency: "PLN", label: "Polish Złoty" },
  { currency: "PYG", label: "Paraguayan Guaraní" },
  { currency: "QAR", label: "Qatari Riyal" },
  { currency: "RON", label: "Romanian Leu" },
  { currency: "RSD", label: "Serbian Dinar" },
  { currency: "RUB", label: "Russian Ruble" },
  { currency: "RWF", label: "Rwandan Franc" },
  { currency: "SAR", label: "Saudi Riyal" },
  { currency: "SBD", label: "Solomon Islands Dollar" },
  { currency: "SCR", label: "Seychellois Rupee" },
  { currency: "SEK", label: "Swedish Krona" },
  { currency: "SLE", label: "Sierra Leonean Leone" },
  { currency: "SRD", label: "Surinamese Dollar" },
  { currency: "STN", label: "São Tomé Dobra" },
  { currency: "SZL", label: "Swazi Lilangeni" },
  { currency: "THB", label: "Thai Baht" },
  { currency: "TJS", label: "Tajikistani Somoni" },
  { currency: "TMT", label: "Turkmenistani Manat" },
  { currency: "TND", label: "Tunisian Dinar" },
  { currency: "TOP", label: "Tongan Paʻanga" },
  { currency: "TTD", label: "Trinidad & Tobago Dollar" },
  { currency: "TWD", label: "New Taiwan Dollar" },
  { currency: "TZS", label: "Tanzanian Shilling" },
  { currency: "UAH", label: "Ukrainian Hryvnia" },
  { currency: "UGX", label: "Ugandan Shilling" },
  { currency: "UYU", label: "Uruguayan Peso" },
  { currency: "UZS", label: "Uzbekistani Som" },
  { currency: "VND", label: "Vietnamese Dong" },
  { currency: "VUV", label: "Vanuatu Vatu" },
  { currency: "WST", label: "Samoan Tālā" },
  { currency: "XAF", label: "Central African CFA Franc" },
  { currency: "XCD", label: "East Caribbean Dollar" },
  { currency: "XOF", label: "West African CFA Franc" },
  { currency: "XPF", label: "CFP Franc" },
  { currency: "ZAR", label: "South African Rand" },
  { currency: "ZMW", label: "Zambian Kwacha" },
];

// Reward fetch configs

const WALLET_TYPES = [
  "VIRTUAL_BNB", "VIRTUAL_BTC", "VIRTUAL_ETH", "VIRTUAL_GMT",
  "VIRTUAL_SOL", "VIRTUAL_TON", "VIRTUAL_USDC", "VIRTUAL_USDT",
];

export const REWARD_CONFIGS: RewardConfig[] = [
  {
    key: "solo-mining",
    sheetName: "Solo Mining",
    sheetType: "mining",
    enrichType: "solo-mining",
    apiUrl: `${API}/api/nft-income/find-aggregated-by-date`,
    pageSize: 20,
    pagination: "skip",
    buildBody: (skip: number) => ({
      startDate: "1990-01-01T00:00:00.000Z",
      endDate: new Date().toISOString(),
      limit: 20,
      skip,
    }),
  },
  {
    key: "minerwars",
    sheetName: "MinerWars",
    sheetType: "mining",
    enrichType: "minerwars",
    apiUrl: `${API}/api/nft-game/nft-game-income/find-aggregated-by-date`,
    pageSize: 20,
    pagination: "skip",
    buildBody: (skip: number) => ({
      startDate: "1990-01-01T00:00:00.000Z",
      endDate: new Date().toISOString(),
      limit: 20,
      skip,
    }),
  },
  {
    key: "bounty",
    sheetName: "Bounties",
    sheetType: "standard",
    enrichType: "wallet-tx-coingecko",
    apiUrl: `${API}/api/wallet/transaction-history`,
    pageSize: 100,
    pagination: "cursor",
    getNextCursor: (item: CursorPaginationItem) => new Date(item.createdAt).getTime(),
    buildBody: (cursor: number) => ({
      filter: {
        walletType: WALLET_TYPES,
        fromType: ["bounty-program"],
        range: null,
      },
      pagination: { cursor, limit: 100 },
    }),
  },
  {
    key: "referrals",
    sheetName: "Referrals",
    sheetType: "standard",
    enrichType: "existing-price",
    apiUrl: `${API}/api/ref-program/get-my`,
    pageSize: 100,
    pagination: "skip",
    buildBody: (skip: number) => ({
      filters: {
        createdAt: {
          range: {
            start: "1990-01-01T00:00:00.000Z",
            end: new Date().toISOString(),
          },
        },
        status: [],
        type: [
          "registration", "nft-payment", "internal-payment",
          "nft-game-ability-payment", "card-issued", "card-transaction",
          "simple-earn-reward",
        ],
      },
      pagination: { skip, limit: 100 },
    }),
  },
  {
    key: "ambassador",
    sheetName: "Ambassador",
    sheetType: "multi-currency",
    enrichType: "existing-price",
    apiUrl: `${API}/api/ref-program/get-my`,
    pageSize: 100,
    pagination: "skip",
    buildBody: (skip: number) => ({
      filters: {
        createdAt: {
          range: {
            start: "1990-01-01T00:00:00.000Z",
            end: new Date().toISOString(),
          },
        },
        type: ["income-kw-consumed-royalty"],
      },
      pagination: { skip, limit: 100 },
    }),
  },
  {
    key: "deposits",
    sheetName: "Deposits",
    sheetType: "multi-currency",
    enrichType: "wallet-tx-coingecko",
    apiUrl: `${API}/api/wallet/transaction-history`,
    pageSize: 20,
    pagination: "cursor",
    getNextCursor: (item: CursorPaginationItem) => new Date(item.createdAt).getTime(),
    buildBody: (cursor: number) => ({
      filter: {
        walletType: WALLET_TYPES,
        fromType: ["top-up", "fireblocks-deposit"],
        range: null,
      },
      pagination: { cursor, limit: 20 },
    }),
  },
  {
    key: "withdrawals",
    sheetName: "Withdrawals",
    sheetType: "multi-currency",
    enrichType: "wallet-tx-coingecko",
    apiUrl: `${API}/api/wallet/transaction-history`,
    pageSize: 100,
    pagination: "cursor",
    getNextCursor: (item: CursorPaginationItem) => new Date(item.createdAt).getTime(),
    buildBody: (cursor: number) => ({
      filter: {
        walletType: WALLET_TYPES,
        fromType: [
          "withdraw", "withdraw-order", "income-withdraw-instant",
          "income-withdraw", "nft-income-withdraw", "nft-game-income-withdraw",
          "income-withdraw-order",
        ],
        range: null,
      },
      pagination: { cursor, limit: 100 },
    }),
  },
  {
    key: "purchases",
    sheetName: "Purchases",
    sheetType: "purchases",
    enrichType: "purchase",
    apiUrl: `${API}/api/user-payments-history/index`,
    pageSize: 20,
    pagination: "skip",
    buildBody: (skip: number) => ({
      filters: { withCanceled: false },
      pagination: { skip, limit: 20 },
    }),
  },
  {
    key: "upgrades",
    sheetName: "Upgrades",
    sheetType: "purchases",
    enrichType: "upgrade",
    apiUrl: `${API}/api/internal-payment/get-my`,
    pageSize: 20,
    pagination: "skip",
    buildBody: (skip: number) => ({
      filters: {
        dataType: { in: ["nftEnergyEfficiencyUpgrade", "nftPowerUpgrade"] },
        status: {
          in: [
            "pending", "success", "error", "waitingForProviderConfirmation",
            "approvedByProvider", "waitingForConfirmation", "waiting-for-user-approve",
          ],
        },
      },
      sort: { createdAt: "DESC" },
      pagination: { skip, limit: 20 },
    }),
  },
  {
    key: "transactions",
    sheetName: "Transactions",
    sheetType: "transactions",
    enrichType: "wallet-tx-coingecko",
    apiUrl: `${API}/api/wallet/transaction-history`,
    pageSize: 100,
    pagination: "cursor",
    getNextCursor: (item: CursorPaginationItem) => new Date(item.createdAt).getTime(),
    buildBody: (cursor: number) => ({
      filter: {
        walletType: WALLET_TYPES,
        fromType: ALL_TX_FROM_TYPES,
        range: null,
      },
      pagination: { cursor, limit: 100 },
    }),
  },
];

export const REWARD_CONFIG_MAP: Record<string, RewardConfig> = Object.fromEntries(
  REWARD_CONFIGS.map((c) => [c.key, c]),
);
