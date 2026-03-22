import type { CursorPaginationItem, RewardConfig, RewardGroup, RewardKey } from "../types";
import { ALL_TX_FROM_TYPES } from "./wallet-types";

const API =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ??
  "https://api.gomining.com";

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

export const ALL_REWARD_KEYS: RewardKey[] = [...new Set(REWARD_GROUPS.flatMap((g) => g.keys))];

const WALLET_TYPES = [
  "VIRTUAL_BNB",
  "VIRTUAL_BTC",
  "VIRTUAL_ETH",
  "VIRTUAL_GMT",
  "VIRTUAL_SOL",
  "VIRTUAL_TON",
  "VIRTUAL_USDC",
  "VIRTUAL_USDT",
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
          "nft-payment",
          "internal-payment",
          "nft-game-ability-payment",
          "card-transaction",
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
          "withdraw",
          "withdraw-order",
          "income-withdraw-instant",
          "income-withdraw",
          "nft-income-withdraw",
          "nft-game-income-withdraw",
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
            "pending",
            "success",
            "error",
            "waitingForProviderConfirmation",
            "approvedByProvider",
            "waitingForConfirmation",
            "waiting-for-user-approve",
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
