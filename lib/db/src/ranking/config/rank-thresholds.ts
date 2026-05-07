import type { RankThreshold } from "../types";

export const rankThresholds: RankThreshold[] = [
  { name: "Bronze", minPoints: 0, maxPoints: 199 },
  { name: "Silver", minPoints: 200, maxPoints: 499 },
  { name: "Gold", minPoints: 500, maxPoints: 899 },
  { name: "Platinum", minPoints: 900, maxPoints: 1399 },
  { name: "Diamond", minPoints: 1400, maxPoints: 1999 },
  { name: "Master", minPoints: 2000, maxPoints: 2699 },
  { name: "Grandmaster", minPoints: 2700, maxPoints: 3499 },
  { name: "Challenger", minPoints: 3500, maxPoints: null },
];

