export type MomentumPhase = 'STEALTH' | 'EARLY_EXPANSION' | 'MARKUP' | 'DISTRIBUTION' | 'DEAD';

export interface PhaseInput {
  change1hPercent: number;
  change24hPercent: number;
  velocityScore: number; // 0..100
}

export interface PhaseOutput {
  momentumPhase: MomentumPhase;
  explanation: string;
}

export const phaseDetector = (input: PhaseInput): PhaseOutput => {
  const v = Math.max(0, Math.min(100, input.velocityScore));

  if (v < 40) return { momentumPhase: 'DEAD', explanation: 'Low velocity regime.' };
  if (v < 60) return { momentumPhase: 'STEALTH', explanation: 'Early flow with controlled velocity.' };
  if (v < 75) return { momentumPhase: 'EARLY_EXPANSION', explanation: 'Velocity building with continuation potential.' };
  if (v < 90) return { momentumPhase: 'MARKUP', explanation: 'High velocity continuation regime.' };

  return { momentumPhase: 'DISTRIBUTION', explanation: 'Very high velocity; distribution risk increases materially.' };
};
