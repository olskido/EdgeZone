"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convictionScore = void 0;
const convictionScore = (input) => {
    const liq = Math.max(0, input.liquidityUsd);
    const vol = Math.max(0, input.volumeUsd);
    const wallets = Math.max(0, input.walletEvents24h);
    const score = Math.max(0, Math.min(100, Math.round(Math.log10(1 + liq) * 10 + Math.log10(1 + vol) * 10 + wallets)));
    return { convictionScore: score };
};
exports.convictionScore = convictionScore;
