"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phaseDetector = void 0;
const phaseDetector = (input) => {
    const v = Math.max(0, Math.min(100, input.velocityScore));
    if (v < 40)
        return { momentumPhase: 'DEAD', explanation: 'Low velocity regime.' };
    if (v < 60)
        return { momentumPhase: 'STEALTH', explanation: 'Early flow with controlled velocity.' };
    if (v < 75)
        return { momentumPhase: 'EARLY_EXPANSION', explanation: 'Velocity building with continuation potential.' };
    if (v < 90)
        return { momentumPhase: 'MARKUP', explanation: 'High velocity continuation regime.' };
    return { momentumPhase: 'DISTRIBUTION', explanation: 'Very high velocity; distribution risk increases materially.' };
};
exports.phaseDetector = phaseDetector;
