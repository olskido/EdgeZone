export type ThreatLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type EdgeVerdict = 'STRONG_BUY' | 'WAIT' | 'HIGH_RISK';

export interface TokenScannerRow {
  id: string;
  name: string;
  symbol: string;
  contract: string;

  price: number;
  liquidity: number;
  volume24h: number;

  smartMoneyScore: number;
  whaleScore: number;
  edgeScore: number;

  change5mPercent?: number;
  change1hPercent?: number;

  convictionScore?: number;
  momentumPhase?: string;
  threatLevel?: ThreatLevel;
  edgeVerdict?: EdgeVerdict;
  confidence?: number;
  updatedAt?: string;
}

export interface TokenDetailResponse {
  id: string;
  name: string;
  symbol: string;
  contract: string;

  signal: {
    convictionScore: number;
    momentumPhase: string;
    threatLevel: ThreatLevel;
    edgeVerdict: EdgeVerdict;
    confidence: number;
    updatedAt: string;
  } | null;
}
