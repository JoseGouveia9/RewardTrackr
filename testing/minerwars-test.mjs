/**
 * MinerWars Round Reward Formula - Test Script
 *
 * Formula (validated from clan-leaderboard/index-v2):
 *   btcPerBlock = btcFund / totalMinedBlocks
 *   clan reward (N blocks) = btcPerBlock * N
 *
 * For won rounds, blocks are derived from round.multiplier (x4 => 4 blocks).
 * User reward remains an estimation placeholder until the user formula is validated.
 *
 * Endpoints used:
 *   1. nft-game/rewards-by-user              → rounds won by clan (roundId, cycleId)
 *   2. nft-game/clan-leaderboard/index-v2    → btcFund + totalMinedBlocks + clan snapshot
 *   4. nft/my-computing-power-chart          → user TH/s per day
 *      nft-game/clan/analytics               → clan TH/s per day
 *      nft-game/clan/get-my                  → current clan power
 *   5. nft-income/find-aggregated-by-date    → solo mining days in cycle
 *   6. mempool.space hashrate/3m             → Bitcoin difficulty epochs for solo equivalent
 *
 * Usage:
 *   BEARER_TOKEN=<token> node minerwars-test.mjs [cycleId]
 *   e.g.: BEARER_TOKEN=<token> node minerwars-test.mjs 144
 */

const BEARER_TOKEN = process.env.BEARER_TOKEN ?? '';
const TARGET_CYCLE_ID = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

// Returns the most recent Tuesday (cycle start) at 00:00 UTC for a given date string
function getCycleStartTuesdayUTC(dateStr) {
  const d = new Date(dateStr);
  const dayOfWeek = d.getUTCDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceTuesday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

if (!BEARER_TOKEN) {
  console.error('ERROR: BEARER_TOKEN environment variable is required.');
  console.error('Usage: BEARER_TOKEN=<token> node minerwars-test.mjs');
  process.exit(1);
}

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en,pt-PT;q=0.9,pt;q=0.8,en-US;q=0.7',
  authorization: `Bearer ${BEARER_TOKEN}`,
  'cache-control': 'no-cache',
  'content-type': 'application/json',
  'ngsw-bypass': 'true',
  origin: 'https://app.gomining.com',
  pragma: 'no-cache',
  referer: 'https://app.gomining.com/',
  'x-device-type': 'desktop',
};

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} at ${url}: ${text}`);
  }
  return res.json();
}

async function get(url) {
  const res = await fetch(url, { method: 'GET', headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} at ${url}: ${text}`);
  }
  return res.json();
}

// ─── Discount + live prices ──────────────────────────────────────────────────
async function getDiscountInfo() {
  const res = await post('https://api.gomining.com/api/user/get-my-nft-discount', {});
  return res.data ?? {};
}

async function getGmtPrice() {
  const res = await get('https://api.gomining.com/api/exchanges/getTokenPrice');
  return res.data?.value ?? 0;
}

async function getGominingBtcPrice() {
  const res = await get('https://api.gomining.com/api/exchanges/getPrice?symbol=BTC&value=1');
  return res.data ?? 0;
}

async function getMyNftAvgEE() {
  const res = await post('https://api.gomining.com/api/nft/get-my', {});
  const arr = res?.data?.array ?? [];
  const vals = arr.map(n => n.energyEfficiency).filter(v => v != null && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ─── Endpoint 1: detect/fetch rounds for a given cycle ──────────────────────
// If targetCycleId is null, auto-detects the current (most recent) cycle.
// Paginates rewards-by-user until all rounds for the target cycle are collected.
// Returns { cycleId, cycleStartDate, rounds[] }
async function getCurrentCycleRounds(targetCycleId = null) {
  const limit = 40;
  let targetId = targetCycleId;
  let cycleStartDate = null;
  const collected = [];
  let skip = 0;

  console.log(
    `  Paginating rewards-by-user${targetId ? ` for cycleId ${targetId}` : ' (auto-detect)'}...`,
  );

  while (true) {
    const res = await post('https://api.gomining.com/api/nft-game/rewards-by-user', {
      filters: { type: 'clan' },
      pagination: { skip, limit },
    });
    const array = res.data.array ?? [];
    if (array.length === 0) break;

    // Auto-detect: use the most recent cycle from the first page
    if (!targetId) {
      targetId = array[0].cycleId;
      cycleStartDate = getCycleStartTuesdayUTC(array[0].endedAt);
      console.log(`  Detected cycleId: ${targetId}  |  Cycle start: ${cycleStartDate.slice(0, 10)}`);
    }

    // Collect rounds for the target cycle
    for (const r of array) {
      if (r.cycleId === targetId) {
        collected.push(r);
        if (!cycleStartDate) cycleStartDate = getCycleStartTuesdayUTC(r.endedAt);
      }
    }

    // Stop once we've passed the target cycle (found older rounds)
    if (array.some((r) => r.cycleId < targetId) || array.length < limit) break;
    skip += limit;
  }

  return { cycleId: targetId, cycleStartDate, rounds: collected };
}

// ─── Endpoint 2: all rounds in a cycle (for old user reward formula) ─────────
async function getAllRoundsInCycle(cycleId, leagueId) {
  const collected = [];
  const limit = 50;
  let skip = 0;
  let total = null;

  console.log(`  Paginating round/find-by-cycleId for cycleId ${cycleId} leagueId ${leagueId}...`);

  while (true) {
    const res = await post('https://api.gomining.com/api/nft-game/round/find-by-cycleId', {
      cycleId,
      multipliers: MULTIPLIERS,
      pagination: { limit, skip, count: 0 },
      leagueId,
    });

    if (total === null) total = res.data.count;
    const array = res.data.array ?? [];
    collected.push(...array);

    if (collected.length >= total || array.length < limit) break;
    skip += limit;
  }

  return collected;
}

// ─── Endpoint 3: BTC fund + total mined blocks + clan snapshot ──────────────
async function getCycleClanData(calculatedAt, leagueId, myClanId) {
  const limit = 50;
  let skip = 0;
  let btcFund = null;
  let totalMinedBlocks = null;
  let clanNftPower = null;
  let clanBlocksMined = null;
  let leagueWeightedEE = null;

  while (true) {
    const res = await post('https://api.gomining.com/api/nft-game/clan-leaderboard/index-v2', {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    if (btcFund === null) {
      btcFund = parseFloat(res.data.btcFund);
      totalMinedBlocks = Number(res.data.totalMinedBlocks ?? 0);
      leagueWeightedEE = res.data.weightedEnergyEfficiencyPerTh ?? null;
    }

    const allClans = [
      ...(res.data.clansPromoted ?? []),
      ...(res.data.clansRemaining ?? []),
      ...(res.data.clansRelegated ?? []),
    ];

    const mine = allClans.find((c) => c.clanId === myClanId);
    if (mine) {
      clanNftPower = mine.nftPower;
      clanBlocksMined = Number(mine.blocksMined ?? 0);
      break;
    }

    const totalCount = res.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return { btcFund, totalMinedBlocks, clanNftPower, clanBlocksMined, leagueWeightedEE };
}

// ─── Endpoint 6: user NFT power per day ────────────────────────────────────
// Returns Map<"YYYY-MM-DD", power_TH>
async function getUserPowerChart(cycleStartDate) {
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const res = await post('https://api.gomining.com/api/nft/my-computing-power-chart', {
    start: cycleStartDate,
    end: end.toISOString(),
  });

  const map = new Map();
  for (const entry of res.data ?? []) {
    map.set(entry.label, entry.value); // label = "YYYY-MM-DD"
  }
  return map;
}

// ─── Endpoint 7: clan NFT power per day ─────────────────────────────────────
// Returns Map<"YYYY-MM-DD", power_TH>
async function getClanPowerAnalytics(clanId) {
  const res = await post('https://api.gomining.com/api/nft-game/clan/analytics', {
    type: 'default',
    clanId,
    timeRange: '30-days',
  });

  const map = new Map();
  const clan = res.data?.[0];
  for (const entry of clan?.analyticsData ?? []) {
    const date = entry.date.slice(0, 10); // "YYYY-MM-DD"
    map.set(date, entry.power);
  }
  return map;
}

// ─── Mempool sats/TH/day via Bitcoin difficulty ──────────────────────────────
// Formula: sats/TH/day = (3.125e8 * 86400 * 1e12) / (difficulty * 2^32)
// Fetches last 3 months of difficulty epochs from mempool.space (no auth).
// For each cycle day, applies the epoch whose retarget happened on or before it.
// Handles retargets that fall mid-cycle (different difficulty for different days).
async function getMempoolSatsPerTHByDate(cycleDates) {
  // Full Bitcoin history — difficulty-adjustments/all covers all cycles, not just last 3 months
  const raw = await fetch('https://mempool.space/api/v1/mining/difficulty-adjustments/all').then((r) => r.json());
  const FACTOR = (3.125e8 * 86400 * 1e12) / Math.pow(2, 32);

  const epochs = (Array.isArray(raw) ? raw : [])
    .filter((item) => Array.isArray(item) && item.length >= 3)
    .map((item) => ({
      date: new Date(item[0] * 1000).toISOString().slice(0, 10),
      difficulty: item[2],
      satsPerTH: FACTOR / item[2],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Map each cycle day to the most recent epoch on or before it
  const byDate = new Map();
  for (const dateStr of cycleDates) {
    let applicable = null;
    for (const ep of epochs) {
      if (ep.date <= dateStr) applicable = ep;
    }
    if (applicable) byDate.set(dateStr, applicable.satsPerTH);
  }

  const latest = epochs[epochs.length - 1];
  return { byDate, latestSatsPerTH: latest?.satsPerTH ?? null, epochs };
}

// ─── Solo mining history: find last solo day within a cycle ─────────────────
// Returns a Set of 'YYYY-MM-DD' strings with solo income within the cycle range.
// Handles mid-cycle departures: multiple solo days possible (not just initial join).
async function getSoloMiningDates(cycleStartDate, cycleEndDate) {
  // Add 1 extra day to endDate: solo income for the last cycle day is stored in the DB
  // around 00:10 UTC the *next* day (createdAt), so a window capped at cycleEndDate misses it.
  const endDatePlus1 = new Date(cycleEndDate);
  endDatePlus1.setUTCDate(endDatePlus1.getUTCDate() + 1);
  const endDateStr = endDatePlus1.toISOString().slice(0, 10);

  const res = await post('https://api.gomining.com/api/nft-income/find-aggregated-by-date', {
    startDate: `${cycleStartDate}T00:00:00.000Z`,
    endDate: `${endDateStr}T23:59:59.999Z`,
    limit: 20,
    skip: 0,
  });
  const records = res.data?.array ?? [];
  const dates = new Set();
  for (const r of records) {
    // calculatedAt reflects the actual day the income was for (always T23:59:59.999Z)
    const dateStr = (r.incomeStatistic?.calculatedAt ?? r.createdAt ?? '').slice(0, 10);
    if (dateStr) dates.add(dateStr);
  }
  return dates;
}

// ─── Endpoint 8: current clan power (today) ──────────────────────────────────
async function getCurrentClanPower(clanId) {
  const res = await post('https://api.gomining.com/api/nft-game/clan/get-by-id', {
    clanId,
    pagination: { limit: 10, skip: 0, count: 0 },
    filters: { filterType: 'none' },
    sort: { sortType: 'none' },
  });
  return res.data?.power ?? null;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('  MinerWars Round Reward Formula');
  console.log('='.repeat(60));

  // ── Step 1: detect/fetch cycle + all won rounds ──
  console.log(`\n[1] ${TARGET_CYCLE_ID ? `Fetching cycle ${TARGET_CYCLE_ID}` : 'Detecting current cycle'} from rewards-by-user...`);
  const { cycleId: CYCLE_ID, cycleStartDate: CYCLE_START_DATE, rounds: userRounds } =
    await getCurrentCycleRounds(TARGET_CYCLE_ID);

  if (!CYCLE_ID || userRounds.length === 0) {
    console.log('  No rounds found for your clan in the current cycle. Exiting.');
    return;
  }

  console.log(`  Cycle: ${CYCLE_ID}  |  Started: ${CYCLE_START_DATE.slice(0, 10)}`);

  // Sort descending by roundId — [0] = most recent
  userRounds.sort((a, b) => b.roundId - a.roundId);
  const refRound = userRounds[0];
  const lastRoundLeagueId = refRound.leagueId;
  console.log(`  Total rounds won: ${userRounds.length}  |  League: ${lastRoundLeagueId}  |  Clan: ${refRound.clanId}`);

  // ── Step 2: all rounds in cycle (for user reward formula) ──
  const myClanId = refRound.clanId;
  console.log(`\n[2] Fetching all rounds in cycle ${CYCLE_ID} (leagueId ${lastRoundLeagueId})`);
  const allCycleRounds = await getAllRoundsInCycle(CYCLE_ID, lastRoundLeagueId);
  const completedRounds = allCycleRounds.filter((r) => !r.active && r.power > 0);
  const sumAllMultipliers = completedRounds.reduce((s, r) => s + r.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((s, r) => s + r.power, 0);
  const avgRoundNftPower = totalPowerSum / completedRounds.length;
  const completedRoundsMap = new Map(completedRounds.map((r) => [r.id, r]));
  console.log(`  Total rounds in cycle: ${completedRounds.length}  |  Sum multipliers: ${sumAllMultipliers}  |  Avg power: ${avgRoundNftPower.toFixed(4)}`);

  // ── Step 3: BTC fund + mined blocks + clan snapshot ──
  console.log(`\n[3] Fetching BTC fund + mined blocks + clan snapshot (leagueId ${lastRoundLeagueId}, clanId ${myClanId})`);
  const { btcFund, totalMinedBlocks, clanNftPower, clanBlocksMined, leagueWeightedEE } =
    await getCycleClanData(CYCLE_START_DATE, lastRoundLeagueId, myClanId);
  const btcPrizePool = btcFund;
  const btcPerBlock = totalMinedBlocks > 0 ? btcPrizePool / totalMinedBlocks : 0;
  console.log(`  btcFund: ${btcPrizePool} BTC`);
  console.log(`  totalMinedBlocks: ${totalMinedBlocks}`);
  console.log(`  btcPerBlock: ${btcPerBlock.toFixed(12)} BTC`);
  console.log(`  Clan blocksMined (snapshot): ${clanBlocksMined ?? 'not found'}`);
  console.log(`  Clan nftPower (cycle snapshot):  ${clanNftPower ?? 'not found'} TH/s`);

  // ── Step 4: Fetch per-day power charts + current clan power ──
  const TODAY = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const cycleEndDate = new Date(CYCLE_START_DATE);
  cycleEndDate.setUTCDate(cycleEndDate.getUTCDate() + 6);
  const CYCLE_END = cycleEndDate.toISOString().slice(0, 10);
  const isCycleLive = TODAY >= CYCLE_START_DATE.slice(0, 10) && TODAY <= CYCLE_END;
  console.log(`\n[4] Fetching daily user & clan NFT power charts + current clan power...`);
  const [userPowerByDate, clanPowerByDate, currentClanPower] = await Promise.all([
    getUserPowerChart(CYCLE_START_DATE),
    getClanPowerAnalytics(myClanId),
    getCurrentClanPower(myClanId),
  ]);
  // Last known user power from chart (most recent day entry)
  const lastUserPower = userPowerByDate.size > 0
    ? [...userPowerByDate.values()].at(-1)
    : null;
  console.log(`  User power chart entries: ${userPowerByDate.size}  (latest: ${lastUserPower?.toFixed(4) ?? 'N/A'} TH/s)`);
  console.log(`  Clan power chart entries: ${clanPowerByDate.size}`);
  if (clanPowerByDate.size === 0) {
    const fallback = isCycleLive
      ? `current clan power (${currentClanPower?.toFixed(4) ?? 'N/A'} TH/s)`
      : `clan power at cycle end (${clanNftPower?.toFixed(4) ?? 'N/A'} TH/s)`;
    console.log(`  ⚠  No clan analytics (clan may be <30 days old) — using ${fallback}. Estimation may be over/under-inflated.`);
  }
  console.log(`  Current clan power (clan/get-by-id): ${currentClanPower?.toFixed(4) ?? 'N/A'} TH/s`);

  // ── Step 4: Calculate rewards for ALL won rounds ──
  console.log(`\n[4] Calculating rewards for all ${userRounds.length} won rounds...`);
  console.log('    Clan formula (new): btcPerBlock * roundBlocks  →  btcFund / totalMinedBlocks * multiplier');
  console.log('    User formula (old): (multiplier / sumAllMultipliers) * btcFund * powerRatio * (userPower / clanPower)\n');

  // Sort ascending by roundId for display
  const sortedRounds = [...userRounds].sort((a, b) => a.roundId - b.roundId);
  const colW = [10, 21, 7, 10, 12, 14, 12, 14, 12];
  const header = [
    'Round ID'.padEnd(colW[0]),
    'Date'.padEnd(colW[1]),
    'Blocks'.padEnd(colW[2]),
    'User TH/s'.padEnd(colW[3]),
    'Clan TH/s'.padEnd(colW[4]),
    'Clan BTC'.padEnd(colW[5]),
    'Clan sats'.padEnd(colW[6]),
    'User BTC*'.padEnd(colW[7]),
    'User sats*'.padEnd(colW[8]),
  ].join(' | ');
  const divider = '-'.repeat(header.length);

  console.log(header);
  console.log(divider);

  let totalUserBtc = 0;
  let totalClanBtc = 0;
  let totalWonBlocks = 0;
  let missingPower = 0;
  const roundRewards = new Map(); // roundId → { btc, date }

  for (const round of sortedRounds) {
    // Per-day power: chart first, then current sources, then last known
    const roundDate = (round.endedAt ?? '').slice(0, 10);
    const isToday = roundDate >= TODAY;
    const effectiveUserPower = userPowerByDate.has(roundDate)
      ? userPowerByDate.get(roundDate)
      : (lastUserPower ?? null);
    const effectiveClanPower = clanPowerByDate.has(roundDate)
      ? clanPowerByDate.get(roundDate)
      : (isToday ? currentClanPower : clanNftPower);

    const roundBlocks = Number(round.multiplier ?? 1);
    // Clan reward: new validated formula (btcPerBlock × blocks)
    const clanReward = btcPerBlock * roundBlocks;
    // User reward: old formula base (multiplier/sumMult * btcFund * powerRatio) × user share
    const entry = completedRoundsMap.get(round.roundId);
    const powerRatio = entry ? entry.power / avgRoundNftPower : 1;
    const clanRewardOldBase = (round.multiplier / sumAllMultipliers) * btcPrizePool * powerRatio;
    const userReward = effectiveClanPower ? clanRewardOldBase * (effectiveUserPower / effectiveClanPower) : null;
    if (effectiveClanPower == null) missingPower++;

    totalClanBtc += clanReward;
    totalWonBlocks += roundBlocks;
    if (userReward !== null) totalUserBtc += userReward;
    roundRewards.set(round.roundId, { btc: userReward ?? 0, date: roundDate });

    const row = [
      String(round.roundId).padEnd(colW[0]),
      (round.endedAt ?? '').slice(0, 19).replace('T', ' ').padEnd(colW[1]),
      String(roundBlocks).padEnd(colW[2]),
      effectiveUserPower != null ? effectiveUserPower.toFixed(2).padEnd(colW[3]) : 'N/A'.padEnd(colW[3]),
      effectiveClanPower != null ? effectiveClanPower.toFixed(2).padEnd(colW[4]) : 'N/A'.padEnd(colW[4]),
      clanReward.toFixed(10).padEnd(colW[5]),
      (clanReward * 1e8).toFixed(2).padEnd(colW[6]),
      userReward !== null ? userReward.toFixed(10).padEnd(colW[7]) : 'N/A'.padEnd(colW[7]),
      userReward !== null ? (userReward * 1e8).toFixed(2).padEnd(colW[8]) : 'N/A'.padEnd(colW[8]),
    ].join(' | ');
    console.log(row);
  }

  console.log(divider);
  console.log('\n' + '='.repeat(60));
  console.log('  TOTALS (estimated) — Cycle ' + CYCLE_ID);
  console.log('='.repeat(60));
  console.log(`  Rounds won:               ${userRounds.length}  (${missingPower} missing clan power entries)`);
  console.log(`  Won blocks (sum mult):    ${totalWonBlocks}`);
  if (clanBlocksMined != null) {
    const delta = totalWonBlocks - clanBlocksMined;
    console.log(`  Snapshot blocksMined:     ${clanBlocksMined}  (delta: ${delta >= 0 ? '+' : ''}${delta})`);
  }
  console.log(`  Reward per won round:     ${btcPerBlock.toFixed(10)} BTC  (${(btcPerBlock * 1e8).toFixed(2)} sats)`);
  console.log(`  Total clan BTC (est.):    ${totalClanBtc.toFixed(10)} BTC  (${(totalClanBtc * 1e8).toFixed(2)} sats)`);
  console.log(`  Total user BTC (est.*):   ${totalUserBtc.toFixed(10)} BTC  (${(totalUserBtc * 1e8).toFixed(2)} sats)`);
  console.log(`  Current clan power (today):      ${currentClanPower?.toFixed(4) ?? 'N/A'} TH/s`);
  console.log(`  Last known user power:           ${lastUserPower?.toFixed(4) ?? 'N/A'} TH/s`);
  console.log('  * user estimate still uses power-ratio placeholder');
  console.log('='.repeat(60));

  // ── Step 5: Hypothetical solo mining comparison ──
  console.log(`\n[5] Computing hypothetical solo mining earnings (mempool.space difficulty)...`);

  // All calendar days from cycle start → cycle end (7 days), capped at TODAY
  const cycleCutoff = CYCLE_END < TODAY ? CYCLE_END : TODAY;
  const cycleDates = [];
  for (
    let d = new Date(CYCLE_START_DATE);
    d.toISOString().slice(0, 10) <= cycleCutoff;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    cycleDates.push(d.toISOString().slice(0, 10));
  }

  // Live cycles have a one-day funding lag: day 1 is funded on day 2.
  // For elapsed solo-equivalent comparisons, exclude cycle day 1 while the cycle is live.
  const elapsedComparisonDates = isCycleLive ? cycleDates.slice(1) : cycleDates;

  // Detect solo mining days within this cycle (handles mid-cycle departures/re-entries)
  // rewards-by-user naturally omits rounds when user was out of clan, so both sides align
  const solodays = await getSoloMiningDates(cycleDates[0], CYCLE_END);
  const soloDaysSorted = [...solodays].filter((d) => cycleDates.includes(d)).sort();
  console.log(
    `  Solo days in cycle: ${
      soloDaysSorted.length > 0 ? soloDaysSorted.join(', ') : 'none (fully in MinerWars)'
    }`,
  );

  const { byDate: satsPerThByDate, latestSatsPerTH, epochs: diffEpochs } =
    await getMempoolSatsPerTHByDate(cycleDates);
  // Show only the epochs relevant to this cycle's date range
  const cycleEpochs = diffEpochs.filter((ep) => ep.date <= cycleDates[cycleDates.length - 1]).slice(-6);
  console.log(`  Difficulty epochs (${diffEpochs.length} total, showing cycle-relevant):`);
  cycleEpochs.forEach((ep) =>
    console.log(`    ${ep.date}  sats/TH=${ep.satsPerTH.toFixed(4)}`),
  );
  console.log(`  Latest sats/TH/day: ${latestSatsPerTH?.toFixed(4) ?? 'N/A'} (block subsidy only)`);

  const cw = [12, 12, 13, 12, 8];
  const hdr = [
    'Date'.padEnd(cw[0]),
    'User TH/s'.padEnd(cw[1]),
    'Sats/TH/day'.padEnd(cw[2]),
    'Solo sats'.padEnd(cw[3]),
    'Status'.padEnd(cw[4]),
  ].join(' | ');
  const div = '-'.repeat(hdr.length);
  console.log('\n' + hdr);
  console.log(div);

  for (const dateStr of cycleDates) {
    const excluded = solodays.has(dateStr);
    const userPow = userPowerByDate.has(dateStr)
      ? userPowerByDate.get(dateStr)
      : (lastUserPower ?? 0);
    const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
    const dailySats = satsPerTH != null && userPow ? satsPerTH * userPow : null;
    console.log([
      dateStr.padEnd(cw[0]),
      userPow != null ? userPow.toFixed(2).padEnd(cw[1]) : 'N/A'.padEnd(cw[1]),
      satsPerTH != null ? satsPerTH.toFixed(4).padEnd(cw[2]) : 'N/A'.padEnd(cw[2]),
      dailySats != null ? dailySats.toFixed(2).padEnd(cw[3]) : 'N/A'.padEnd(cw[3]),
      (excluded ? 'solo' : 'MinerWars').padEnd(cw[4]),
    ].join(' | '));
  }
  console.log(div);

  // Exclude solo days from both sides:
  // - MinerWars: rewards-by-user naturally has no rounds on solo days, but filter explicitly too
  // - Solo equiv: skip days the user was in solo (they already earned actual solo income those days)
  let filteredMinerWarsSats = 0;
  for (const { btc, date } of roundRewards.values()) {
    if (!solodays.has(date)) filteredMinerWarsSats += btc * 1e8;
  }
  let filteredSoloSats = 0;
  for (const dateStr of elapsedComparisonDates) {
    if (solodays.has(dateStr)) continue;
    const userPow = userPowerByDate.has(dateStr) ? userPowerByDate.get(dateStr) : (lastUserPower ?? 0);
    const satsPerTH = satsPerThByDate.get(dateStr) ?? latestSatsPerTH;
    if (satsPerTH != null && userPow) filteredSoloSats += satsPerTH * userPow;
  }

  const diffSats = filteredMinerWarsSats - filteredSoloSats;
  const pct = filteredSoloSats > 0 ? ((diffSats / filteredSoloSats) * 100).toFixed(1) : 'N/A';
  const windowLabel =
    soloDaysSorted.length === 0
      ? 'full cycle'
      : `full cycle excl. solo day(s): ${soloDaysSorted.join(', ')}`;

  // Build full 7-day solo target: past days use actual rates, future days use latest rate.
  // This projects what solo mining would earn over the entire cycle (excl. solo days).
  const fullCycleDates = [];
  for (let d = new Date(cycleDates[0] + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    fullCycleDates.push(s);
    if (s === CYCLE_END) break;
  }
  let targetSoloSats = 0;
  let targetActualDays = 0;
  let targetProjectedDays = 0;
  for (const dateStr of fullCycleDates) {
    if (solodays.has(dateStr)) continue;
    const isPast = elapsedComparisonDates.includes(dateStr);
    const userPow = isPast
      ? (userPowerByDate.has(dateStr) ? userPowerByDate.get(dateStr) : (lastUserPower ?? 0))
      : (lastUserPower ?? 0);
    const satsPerTH = isPast
      ? (satsPerThByDate.get(dateStr) ?? latestSatsPerTH)
      : latestSatsPerTH;
    if (satsPerTH != null && userPow) {
      targetSoloSats += satsPerTH * userPow;
      if (isPast) targetActualDays++; else targetProjectedDays++;
    }
  }
  const progressPct = targetSoloSats > 0 ? ((filteredMinerWarsSats / targetSoloSats) * 100).toFixed(1) : 'N/A';
  const targetLabel = targetProjectedDays > 0
    ? `${targetActualDays} day(s) actual + ${targetProjectedDays} projected @ ${latestSatsPerTH?.toFixed(4) ?? 'N/A'} sats/TH`
    : `${targetActualDays} day(s) actual`;

  // ── Clan target: same structure as solo target but using clan TH/s ──────────
  // clanMinerWarsSats: blocks mined by clan so far × btcPerBlock
  const clanMinerWarsSats = (clanBlocksMined ?? 0) * btcPerBlock * 1e8;
  const btcPerBlockSats = btcPerBlock * 1e8;

  let clanTargetSats = 0;
  let clanTargetActualDays = 0;
  let clanTargetProjectedDays = 0;
  const lastClanPower = clanPowerByDate.size > 0 ? [...clanPowerByDate.values()].at(-1) : currentClanPower;
  for (const dateStr of fullCycleDates) {
    if (solodays.has(dateStr)) continue;
    const isPast = elapsedComparisonDates.includes(dateStr);
    const clanPow = isPast
      ? (clanPowerByDate.has(dateStr) ? clanPowerByDate.get(dateStr) : (lastClanPower ?? 0))
      : (currentClanPower ?? lastClanPower ?? 0);
    const satsPerTH = isPast
      ? (satsPerThByDate.get(dateStr) ?? latestSatsPerTH)
      : latestSatsPerTH;
    if (satsPerTH != null && clanPow) {
      clanTargetSats += satsPerTH * clanPow;
      if (isPast) clanTargetActualDays++; else clanTargetProjectedDays++;
    }
  }

  const clanProgressPct = clanTargetSats > 0 ? ((clanMinerWarsSats / clanTargetSats) * 100).toFixed(1) : 'N/A';
  const clanBlocksNeeded = isCycleLive && btcPerBlockSats > 0 && clanTargetSats > clanMinerWarsSats
    ? Math.ceil((clanTargetSats - clanMinerWarsSats) / btcPerBlockSats)
    : null;
  const clanTargetLabel = clanTargetProjectedDays > 0
    ? `${clanTargetActualDays} day(s) actual + ${clanTargetProjectedDays} projected @ ${latestSatsPerTH?.toFixed(4) ?? 'N/A'} sats/TH`
    : `${clanTargetActualDays} day(s) actual`;

  console.log('\n' + '='.repeat(60));
  console.log('  COMPARISON — MinerWars vs Solo Mining (cycle ' + CYCLE_ID + ')');
  console.log('='.repeat(60));
  console.log(`  Window:              ${windowLabel}`);
  console.log(`  MinerWars (est.):    ${filteredMinerWarsSats.toFixed(2).padStart(12)} sats`);
  console.log(`  Solo equiv (est.):   ${filteredSoloSats.toFixed(2).padStart(12)} sats  (days elapsed)`);
  console.log(`  Difference:          ${(diffSats > 0 ? '+' : '') + diffSats.toFixed(2).padStart(12)} sats  (${diffSats > 0 ? '+' : ''}${pct}%)`);
  console.log('');
  console.log(`  Solo target (7-day): ${targetSoloSats.toFixed(2).padStart(12)} sats  [${targetLabel}]`);
  console.log(`  MinerWars progress:  ${filteredMinerWarsSats.toFixed(2).padStart(12)} sats  (${progressPct}% of target)`);
  if (isCycleLive && clanTargetSats > 0) {
    console.log('');
    console.log(`  Clan target (7-day): ${clanTargetSats.toFixed(2).padStart(12)} sats  [${clanTargetLabel}]`);
    console.log(`  Clan progress (est): ${clanMinerWarsSats.toFixed(2).padStart(12)} sats  (${clanProgressPct}% of target)`);
    console.log(`  sats/block (current):${btcPerBlockSats.toFixed(2).padStart(12)} sats`);
    if (clanBlocksNeeded != null) {
      console.log(`  Blocks needed:       ${String(clanBlocksNeeded).padStart(12)}  to reach clan target`);
    } else if (clanMinerWarsSats >= clanTargetSats) {
      console.log(`  Blocks needed:                 0  clan target already reached!`);
    }
  }
  console.log(`  Note: solo est. uses Bitcoin difficulty formula via mempool.space (block subsidy only)`);
  console.log('='.repeat(60));

  // ── Step 6: Maintenance estimation ──────────────────────────────────────────
  console.log(`\n[6] Fetching maintenance discount + live prices...`);
  const [discountData, gmtPriceValue, liveBtcPrice, userAvgEE] = await Promise.all([
    getDiscountInfo(),
    getGmtPrice(),
    getGominingBtcPrice(),
    getMyNftAvgEE(),
  ]);

  const dailyDisc  = discountData.dailyMaintenanceDiscount  ?? 0;
  const levelDisc  = discountData.levelDiscount             ?? 0;
  const gmtDisc    = discountData.discountByMaintenanceInGmt ?? 0;
  const totalDiscount = dailyDisc + levelDisc + gmtDisc;
  const discountFactor = 1 - totalDiscount;

  console.log(`  Discount:  ${(dailyDisc*100).toFixed(2)}% (daily)  +  ${(levelDisc*100).toFixed(2)}% (level)  +  ${(gmtDisc*100).toFixed(2)}% (GMT pay)  =  ${(totalDiscount*100).toFixed(2)}% total`);
  console.log(`  BTC price: $${liveBtcPrice.toFixed(2)}   GMT price: $${gmtPriceValue.toFixed(4)}`);

  // Official GoMining formula (per won round, elapsed days instead of full 7):
  //   round electricity (USD) = (kWh × 24 × days) × round.power × EE / 1000
  //   round service (USD)     = 0.0089 × days × round.power
  //   miner share             = (round.multiplier / sumAllMultipliers) × (userTH / clanTH)
  //   miner maintenance (USD) = (roundElec + roundSvc) × share × (1 − discount)
  // EE rule: use user's own avg EE while cumulative MW ≤ cumulative solo;
  //          once MW exceeds solo, use league weighted EE for remaining rounds.
  const KWH        = 0.05;   // $/kWh — GoMining platform constant
  const SVC        = 0.0089; // $/TH/day — GoMining platform constant
  const userEE     = userAvgEE ?? 15;          // W/TH — from nft/get-my
  const leagueEE   = leagueWeightedEE ?? userEE; // W/TH — from clan-leaderboard/index-v2
  const elapsedMWDays = elapsedComparisonDates.filter(d => !solodays.has(d)).length;
  const soloThresholdSats = filteredSoloSats;

  const maintRows = [];
  let totalMaintUSD = 0;
  let cumulativeMWSats = 0;
  for (const round of sortedRounds) {
    const roundDate = (round.endedAt ?? '').slice(0, 10);
    if (solodays.has(roundDate)) continue;
    const entry = completedRoundsMap.get(round.roundId);
    const roundPower = entry?.power ?? 0;
    const userTH = userPowerByDate.has(roundDate) ? userPowerByDate.get(roundDate) : (lastUserPower ?? 0);
    const isRoundToday = roundDate >= TODAY;
    const clanTH = (clanPowerByDate.has(roundDate)
      ? clanPowerByDate.get(roundDate)
      : (isRoundToday ? currentClanPower : clanNftPower)) ?? 0;
    // Hybrid EE: user's own EE while within solo threshold, league EE once MW exceeds solo
    const EE = cumulativeMWSats < soloThresholdSats ? userEE : leagueEE;
    const roundElecUSD = (KWH * 24 * elapsedMWDays * roundPower * EE) / 1000;
    const roundSvcUSD  = SVC * elapsedMWDays * roundPower;
    const share = (clanTH > 0 && sumAllMultipliers > 0)
      ? (round.multiplier / sumAllMultipliers) * (userTH / clanTH)
      : 0;
    const minerMaintUSD = (roundElecUSD + roundSvcUSD) * share * discountFactor;
    totalMaintUSD += minerMaintUSD;
    // Accumulate MW sats for this round to track threshold crossing
    const roundUserSats = (btcPerBlock * round.multiplier * (userTH / (clanTH || 1))) * 1e8;
    cumulativeMWSats += roundUserSats;
    maintRows.push({ round, roundDate, roundPower, userTH, clanTH, EE, roundElecUSD, roundSvcUSD, share, minerMaintUSD });
  }

  const totalMaintBtc  = totalMaintUSD / liveBtcPrice;
  const totalMaintSats = totalMaintBtc * 1e8;
  const totalMaintGmt  = gmtPriceValue > 0 ? totalMaintUSD / gmtPriceValue : 0;

  console.log(`  User EE: ${userEE.toFixed(2)} W/TH (from NFTs)  |  League EE: ${leagueEE.toFixed(4)} W/TH  |  Solo threshold: ${soloThresholdSats.toFixed(2)} sats`);
  console.log(`  Formula: per-round official  |  Days: ${elapsedMWDays}  |  Rounds: ${maintRows.length}`);
  console.log('');
  for (const r of maintRows) {
    const maintSats = r.minerMaintUSD / liveBtcPrice * 1e8;
    const totalRoundUSD = r.roundElecUSD + r.roundSvcUSD;
    console.log(`  Round ${r.round.roundId}  [${r.roundDate}  blks:${r.round.multiplier}]`);
    console.log(`    Elec  = (${KWH} x 24 x ${elapsedMWDays} x ${r.roundPower.toFixed(0)} TH x ${r.EE} W/TH [${r.EE === leagueEE && r.EE !== userEE ? 'league' : 'user'}]) / 1000`
              + `  = $${r.roundElecUSD.toFixed(4)}`);
    console.log(`    Svc   = ${SVC} x ${elapsedMWDays} x ${r.roundPower.toFixed(0)} TH`
              + `  = $${r.roundSvcUSD.toFixed(4)}`);
    console.log(`    Total = $${r.roundElecUSD.toFixed(4)} + $${r.roundSvcUSD.toFixed(4)}`
              + `  = $${totalRoundUSD.toFixed(4)}`);
    console.log(`    Share = (${r.round.multiplier}/${sumAllMultipliers}) x (${r.userTH.toFixed(2)} / ${r.clanTH.toFixed(2)})`
              + `  = ${(r.share * 100).toFixed(6)}%`);
    console.log(`    Maint = $${totalRoundUSD.toFixed(4)} x ${(r.share * 100).toFixed(6)}% x ${discountFactor.toFixed(4)} (discount)`
              + `  = $${r.minerMaintUSD.toFixed(6)}  = ${maintSats.toFixed(2)} sats`);
    console.log('');
  }

  const mwNetSats  = filteredMinerWarsSats - totalMaintSats;
  const mwMaintPct = filteredMinerWarsSats > 0 ? (totalMaintSats / filteredMinerWarsSats * 100).toFixed(1) : 'N/A';

  console.log('\n' + '='.repeat(60));
  console.log('  MAINTENANCE ESTIMATE -- Cycle ' + CYCLE_ID);
  console.log('='.repeat(60));
  console.log(`  Window: ${elapsedMWDays} day(s)  |  Discount: ${(totalDiscount*100).toFixed(2)}%`);
  console.log('');
  console.log(`  MinerWars:`);
  console.log(`    Reward:      ${filteredMinerWarsSats.toFixed(2).padStart(12)} sats`);
  console.log(`    Maintenance: ${totalMaintSats.toFixed(2).padStart(12)} sats  /  ${totalMaintBtc.toFixed(8)} BTC  /  ${totalMaintGmt.toFixed(4)} GMT  (${mwMaintPct}%)`);
  console.log(`    Net:         ${mwNetSats.toFixed(2).padStart(12)} sats`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
