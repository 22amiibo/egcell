import { selectionRevenueColumnChallenge } from "@/data/challenges/selectionRevenueColumn";
import type { Challenge } from "@/domain/challenges/challengeTypes";

export const challenges: Challenge[] = [selectionRevenueColumnChallenge];

/** The challenge the game opens into. */
export const defaultChallenge: Challenge = selectionRevenueColumnChallenge;
