interface ClanHeaderInfo {
  clanId: number;
  name: string;
  logoUrl: string | null;
  targetBtc: number | null;
  progressBtc: number | null;
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
  th: number | null;
  ee: number | null;
  pps: number | null;
  powerSharePct: number | null;

  blocksMined: number;
  gmtRewards: number;
  minerWarsRewardEstBtc: number | null;
  boostCostGmt: number | null;
}

export interface ClanPerformance {
  header: ClanHeaderInfo;
  totalClanTh: number;
  totalClanPps: number | null;
  isLive: boolean;
  members: ClanMemberPerformance[];
}
