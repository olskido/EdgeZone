"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verdictGenerator = void 0;
const verdictGenerator = (input) => {
    const c = Math.max(0, Math.min(100, input.convictionScore));
    const threat = input.threatLevel;
    if (threat === 'HIGH') {
        return { edgeVerdict: 'HIGH_RISK', confidence: Math.min(80, Math.max(30, Math.round(c * 0.6))) };
    }
    if (c >= 75 && threat === 'LOW') {
        return { edgeVerdict: 'STRONG_BUY', confidence: Math.min(99, Math.max(60, Math.round(c * 0.95))) };
    }
    if (c >= 55) {
        return { edgeVerdict: 'WAIT', confidence: Math.min(90, Math.max(45, Math.round(c * 0.85))) };
    }
    return { edgeVerdict: 'WAIT', confidence: Math.min(70, Math.max(25, Math.round(c * 0.7))) };
};
exports.verdictGenerator = verdictGenerator;
