/**
 * MinerWars Round Reward Formula - Test Script
 *
 * Formula:
 *   clan round reward = (round multiplier / total multipliers in cycle)
 *                       * BTC prize pool
 *                       * (clan round power / avg power of all participants in round)
 *
 *   user reward = clan round reward * (user score / clan score)
 *
 * Endpoints used:
 *   1. nft-game/rewards-by-user              → rounds won by clan (roundId, multiplier, cycleId)
 *   2. nft-game/round/find-by-cycleId        → all rounds in cycle (total multipliers, avg power)
 *   3. nft-game/clan-leaderboard/index-v2    → BTC prize pool (btcFund) + clan nftPower snapshot
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

// ─── Endpoint 2: all rounds in a cycle ──────────────────────────────────────
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

// ─── Endpoint 3: BTC prize pool + clan nftPower ─────────────────────────────
async function getCycleClanData(calculatedAt, leagueId, myClanId) {
  const limit = 50;
  let skip = 0;
  let btcFund = null;
  let clanNftPower = null;

  while (true) {
    const res = await post('https://api.gomining.com/api/nft-game/clan-leaderboard/index-v2', {
      calculatedAt,
      leagueId,
      pagination: { skip, limit },
    });

    if (btcFund === null) {
      btcFund = parseFloat(res.data.btcFund);
    }

    const allClans = [
      ...(res.data.clansPromoted ?? []),
      ...(res.data.clansRemaining ?? []),
      ...(res.data.clansRelegated ?? []),
    ];

    const mine = allClans.find((c) => c.clanId === myClanId);
    if (mine) {
      clanNftPower = mine.nftPower;
      break;
    }

    const totalCount = res.data.count ?? 0;
    skip += limit;
    if (skip >= totalCount || allClans.length < limit) break;
  }

  return { btcFund, clanNftPower };
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
async function getCurrentClanPower() {
  const res = await post('https://api.gomining.com/api/nft-game/clan/get-my', {});
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

  // ── Step 2: all rounds in cycle ──
  console.log(`\n[2] Fetching all rounds in cycle ${CYCLE_ID} (leagueId ${lastRoundLeagueId})`);
  const allCycleRounds = await getAllRoundsInCycle(CYCLE_ID, lastRoundLeagueId);

  const completedRounds = allCycleRounds.filter((r) => !r.active && r.power > 0);
  const sumAllMultipliers = completedRounds.reduce((s, r) => s + r.multiplier, 0);
  const totalPowerSum = completedRounds.reduce((s, r) => s + r.power, 0);
  const avgRoundNftPower = totalPowerSum / completedRounds.length;

  console.log(`  Total rounds in cycle:               ${completedRounds.length}`);
  console.log(`  Clan won rounds:                     ${userRounds.length}`);
  console.log(`  Sum of ALL round multipliers:        ${sumAllMultipliers}`);
  console.log(`  Avg NFT power across cycle:          ${avgRoundNftPower.toFixed(4)}`);

  // ── Step 3: BTC prize pool + clan nftPower ──
  const myClanId = refRound.clanId;
  console.log(`\n[3] Fetching BTC prize pool + clan nftPower (leagueId ${lastRoundLeagueId}, clanId ${myClanId})`);
  const { btcFund, clanNftPower } = await getCycleClanData(CYCLE_START_DATE, lastRoundLeagueId, myClanId);
  const btcPrizePool = btcFund;
  console.log(`  btcFund: ${btcPrizePool} BTC`);
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
    getCurrentClanPower(),
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
    console.log(`  \u26a0  No clan analytics (clan may be <30 days old) \u2014 using ${fallback}. Estimation may be over/under-inflated.`);
  }
  console.log(`  Current clan power (clan/get-my): ${currentClanPower?.toFixed(4) ?? 'N/A'} TH/s`);

  // ── Step 5: Calculate rewards for ALL won rounds ──
  console.log(`\n[5] Calculating user rewards for all ${userRounds.length} won rounds...\n`);

  // Sort ascending by roundId for display
  const sortedRounds = [...userRounds].sort((a, b) => a.roundId - b.roundId);
  // Pre-build map for O(1) lookup by roundId
  const completedRoundsMap = new Map(completedRounds.map((r) => [r.id, r]));

  const colW = [10, 21, 5, 12, 10, 12, 12, 14, 12, 14, 12];
  const header = [
    'Round ID'.padEnd(colW[0]),
    'Date'.padEnd(colW[1]),
    'Mult'.padEnd(colW[2]),
    'Round TH/s'.padEnd(colW[3]),
    'User TH/s'.padEnd(colW[4]),
    'Clan TH/s'.padEnd(colW[5]),
    'Pwr Ratio'.padEnd(colW[6]),
    'Clan BTC'.padEnd(colW[7]),
    'Clan sats'.padEnd(colW[8]),
    'User BTC'.padEnd(colW[9]),
    'User sats'.padEnd(colW[10]),
  ].join(' | ');
  const divider = '-'.repeat(header.length);

  console.log(header);
  console.log(divider);

  let totalUserBtc = 0;
  let totalClanBtc = 0;
  let missingPower = 0;
  const roundRewards = new Map(); // roundId → { btc, date }

  for (const round of sortedRounds) {
    const entry = completedRoundsMap.get(round.roundId);
    if (!entry) {
      missingPower++;
      const row = [
        String(round.roundId).padEnd(colW[0]),
        (round.endedAt ?? '').slice(0, 19).replace('T', ' ').padEnd(colW[1]),
        `x${round.multiplier}`.padEnd(colW[2]),
        'N/A'.padEnd(colW[3]),
        'N/A'.padEnd(colW[4]),
        'N/A'.padEnd(colW[5]),
        'N/A'.padEnd(colW[6]),
        'N/A'.padEnd(colW[7]),
        'N/A'.padEnd(colW[8]),
        'N/A'.padEnd(colW[9]),
        'N/A'.padEnd(colW[10]),
      ].join(' | ');
      console.log(row);
      continue;
    }

    // Per-day power: chart first, then current sources, then last known
    const roundDate = (round.endedAt ?? '').slice(0, 10);
    const isToday = roundDate >= TODAY;
    const effectiveUserPower = userPowerByDate.has(roundDate)
      ? userPowerByDate.get(roundDate)
      : (lastUserPower ?? null);
    const effectiveClanPower = clanPowerByDate.has(roundDate)
      ? clanPowerByDate.get(roundDate)
      : (isToday ? currentClanPower : clanNftPower);

    const powerRatio = entry.power / avgRoundNftPower;
    const clanReward = (round.multiplier / sumAllMultipliers) * btcPrizePool * powerRatio;
    const userReward = effectiveClanPower ? clanReward * (effectiveUserPower / effectiveClanPower) : null;

    totalClanBtc += clanReward;
    if (userReward !== null) totalUserBtc += userReward;
    roundRewards.set(round.roundId, { btc: userReward ?? 0, date: roundDate });

    const row = [
      String(round.roundId).padEnd(colW[0]),
      (round.endedAt ?? '').slice(0, 19).replace('T', ' ').padEnd(colW[1]),
      `x${round.multiplier}`.padEnd(colW[2]),
      entry.power.toFixed(2).padEnd(colW[3]),
      effectiveUserPower.toFixed(2).padEnd(colW[4]),
      effectiveClanPower != null ? effectiveClanPower.toFixed(2).padEnd(colW[5]) : 'N/A'.padEnd(colW[5]),
      powerRatio.toFixed(4).padEnd(colW[6]),
      clanReward.toFixed(10).padEnd(colW[7]),
      (clanReward * 1e8).toFixed(2).padEnd(colW[8]),
      userReward !== null ? userReward.toFixed(10).padEnd(colW[9]) : 'N/A'.padEnd(colW[9]),
      userReward !== null ? (userReward * 1e8).toFixed(2).padEnd(colW[10]) : 'N/A'.padEnd(colW[10]),
    ].join(' | ');
    console.log(row);
  }

  console.log(divider);
  console.log('\n' + '='.repeat(60));
  console.log('  TOTALS (estimated) — Cycle ' + CYCLE_ID);
  console.log('='.repeat(60));
  console.log(`  Rounds won:               ${userRounds.length}  (${missingPower} missing power data)`);
  console.log(`  Total clan BTC (est.):    ${totalClanBtc.toFixed(10)} BTC  (${(totalClanBtc * 1e8).toFixed(2)} sats)`);
  console.log(`  Total user BTC (est.):    ${totalUserBtc.toFixed(10)} BTC  (${(totalUserBtc * 1e8).toFixed(2)} sats)`);
  console.log(`  Current clan power (today):      ${currentClanPower?.toFixed(4) ?? 'N/A'} TH/s`);
  console.log(`  Last known user power:           ${lastUserPower?.toFixed(4) ?? 'N/A'} TH/s`);
  console.log('='.repeat(60));

  // ── Step 6: Hypothetical solo mining comparison ──
  console.log(`\n[6] Computing hypothetical solo mining earnings (mempool.space difficulty)...`);

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
  console.log(`  Note: solo est. uses Bitcoin difficulty formula via mempool.space (block subsidy only)`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
