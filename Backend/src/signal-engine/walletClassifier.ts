export type WalletLabel = 'ELITE_ACCUMULATOR' | 'DIAMOND_HOLDER' | 'EXIT_RISK' | 'EARLY_SNIPER' | 'UNKNOWN';

export interface WalletClassifierInput {
  actions: string[];
  holdingDays: number;
  riskScore: number; // 0..100
}

export interface WalletClassifierOutput {
  label: WalletLabel;
  why: string;
}

export const walletClassifier = (input: WalletClassifierInput): WalletClassifierOutput => {
  const risk = Math.max(0, Math.min(100, input.riskScore));
  const actions = input.actions.map((a) => a.toLowerCase());

  if (risk >= 70) return { label: 'EXIT_RISK', why: 'High risk score from behavior heuristics.' };
  if (actions.some((a) => a.includes('accum'))) return { label: 'ELITE_ACCUMULATOR', why: 'Accumulation actions detected.' };
  if (input.holdingDays >= 14) return { label: 'DIAMOND_HOLDER', why: 'Holding duration suggests conviction.' };
  if (actions.some((a) => a.includes('snipe'))) return { label: 'EARLY_SNIPER', why: 'Sniping behavior detected.' };

  return { label: 'UNKNOWN', why: 'Insufficient wallet event data.' };
};
