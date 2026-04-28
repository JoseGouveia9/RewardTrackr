const SHARE_ALLOWED_KEYS = new Set([
  "solo-mining",
  "minerwars",
  "bounty",
  "referrals",
  "ambassador",
  "deposits",
  "withdrawals",
  "purchases",
  "upgrades",
  "transactions",
  "simple-earn",
]);

const SHARE_FIELDS_BY_KEY = {
  "solo-mining": [
    "createdAt",
    "currency",
    "reinvestmentStatus",
    "poolReward",
    "poolRewardGMT",
    "poolRewardUSD",
    "poolRewardFiat",
    "maintenance",
    "maintenanceGMT",
    "maintenanceUSD",
    "maintenanceFiat",
    "reward",
    "rewardGMT",
    "rewardInUSD",
    "rewardInFiat",
    "reinvested",
    "totalPower",
    "discount",
    "satsPerTh",
    "btcPriceAtTime",
    "btcPriceGmt",
  ],
  minerwars: [
    "createdAt",
    "currency",
    "reinvestmentStatus",
    "poolReward",
    "poolRewardGMT",
    "poolRewardUSD",
    "poolRewardFiat",
    "maintenance",
    "maintenanceGMT",
    "maintenanceUSD",
    "maintenanceFiat",
    "reward",
    "rewardGMT",
    "rewardInUSD",
    "rewardInFiat",
    "reinvested",
    "totalPower",
    "discount",
    "btcPriceAtTime",
    "btcPriceGmt",
  ],
  bounty: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  referrals: [
    "createdAt",
    "currency",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  ambassador: [
    "createdAt",
    "currency",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  deposits: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  withdrawals: ["createdAt", "currency", "reward", "rewardInUSD", "rewardInUsd", "rewardInFiat"],
  purchases: ["createdAt", "type", "currency", "reward", "valueUsd", "valueFiat"],
  upgrades: ["createdAt", "type", "currency", "reward", "valueUsd", "valueFiat"],
  transactions: [
    "createdAt",
    "txType",
    "fromType",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
  "simple-earn": [
    "createdAt",
    "asset",
    "currency",
    "apr",
    "reward",
    "rewardInUSD",
    "rewardInUsd",
    "rewardInFiat",
  ],
};

const STRING_FIELDS = new Set([
  "createdAt",
  "currency",
  "reinvestmentStatus",
  "asset",
  "type",
  "txType",
  "fromType",
]);

const BOOLEAN_FIELDS = new Set(["reinvested"]);

const OPTIONAL_NUMBER_FIELDS = new Set(["satsPerTh", "btcPriceAtTime", "btcPriceGmt"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeString(value, maxLen = 80) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function sanitizeRecord(record, allowedFields) {
  if (!isPlainObject(record)) return null;

  const out = {};
  for (const field of allowedFields) {
    if (!(field in record)) continue;
    if (STRING_FIELDS.has(field)) {
      const raw = record[field];
      if (raw === null) { out[field] = null; continue; }
      const value = sanitizeString(raw, 40);
      if (value) out[field] = value;
      continue;
    }
    if (BOOLEAN_FIELDS.has(field)) {
      out[field] = Boolean(record[field]);
      continue;
    }
    if (OPTIONAL_NUMBER_FIELDS.has(field)) {
      if (record[field] == null) continue;
      const n = Number(record[field]);
      if (Number.isFinite(n) && n > 0) out[field] = n;
      continue;
    }
    out[field] = sanitizeNumber(record[field]);
  }

  if (!out.createdAt) return null;
  return out;
}

export function sanitizeSheetsPayload(rawData) {
  if (!isPlainObject(rawData)) return {};

  const sanitized = {};
  for (const [rawKey, rawEntry] of Object.entries(rawData)) {
    const key = String(rawKey);
    if (!SHARE_ALLOWED_KEYS.has(key)) continue;
    if (!isPlainObject(rawEntry)) continue;

    const allowedFields = SHARE_FIELDS_BY_KEY[key] ?? [];
    const rawRecords = Array.isArray(rawEntry.records) ? rawEntry.records : [];
    const records = [];

    for (const record of rawRecords) {
      const clean = sanitizeRecord(record, allowedFields);
      if (clean) records.push(clean);
    }

    sanitized[key] = {
      sheetName: sanitizeString(rawEntry.sheetName, 120) || key,
      fetchedAt: sanitizeNumber(rawEntry.fetchedAt || Date.now()),
      records,
    };
  }

  return sanitized;
}
