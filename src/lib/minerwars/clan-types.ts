export interface ClanHeaderInfo {
  clanId: number;
  name: string;
  logoUrl: string | null;
  targetBtc: number | null;
  progressBtc: number | null;
  // Live leaderboard snapshot.
  leagueId: number | null;
  position: number | null;
  boardClanTh: number | null;
  boardBlocksMined: number | null;
  boardBtcMined: number | null;
}

export interface ClanMemberPerformance {
  userId: number;
  alias: string;
  avatarUrl: string | null;
  // Null when the member is no longer in the live roster.
  th: number | null;
  ee: number | null;
  pps: number | null;
  powerSharePct: number | null;

  blocksMined: number;
  gmtRewards: number;
  minerWarsRewardEstBtc: number | null;
  // Null means unavailable, not zero.
  boostCostGmt: number | null;

  hasLeftClan: boolean;
}

export interface ClanPerformance {
  header: ClanHeaderInfo;
  totalClanTh: number;
  // Null on ended cycles.
  totalClanPps: number | null;
  isLive: boolean;
  members: ClanMemberPerformance[];
}
