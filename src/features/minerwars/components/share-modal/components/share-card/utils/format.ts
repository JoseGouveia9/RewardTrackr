export function formatFiatRounded(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ROMAN_NUMERALS: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(number: number): string {
  if (number <= 0) return String(number);
  let result = "";
  let remaining = number;
  for (const [value, symbol] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

export function leagueName(leagueId: number): string {
  if (leagueId === 1) return "Odyssey";
  if (leagueId === 3) return "Eclipse I";
  if (leagueId === 4) return "Horizon I";
  if (leagueId >= 5 && leagueId <= 31) return `Dune ${toRoman(leagueId - 4)}`;
  if (leagueId >= 50 && leagueId <= 51) return `Eclipse ${toRoman(leagueId - 48)}`;
  if (leagueId >= 52 && leagueId <= 59) return `Horizon ${toRoman(leagueId - 50)}`;
  return `League ${leagueId}`;
}
