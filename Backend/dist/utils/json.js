"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = void 0;
const safeJsonParse = (value) => {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
};
exports.safeJsonParse = safeJsonParse;
