export interface ConvictionInput {
  liquidityUsd: number;
  volumeUsd: number;
  walletEvents24h: number;
}

export interface ConvictionOutput {
  convictionScore: number; // 0..100
}

export const convictionScore = (input: ConvictionInput): ConvictionOutput => {
  const liq = Math.max(0, input.liquidityUsd);
  const vol = Math.max(0, input.volumeUsd);
  const wallets = Math.max(0, input.walletEvents24h);

  const score = Math.max(
    0,
    Math.min(100, Math.round(Math.log10(1 + liq) * 10 + Math.log10(1 + vol) * 10 + wallets))
  );

  return { convictionScore: score };
};
