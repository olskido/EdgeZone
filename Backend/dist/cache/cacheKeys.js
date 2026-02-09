"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = void 0;
exports.cacheKeys = {
    tokenList: (page, limit, sort) => `tokens:list:${sort}:${page}:${limit}`,
    tokenDetail: (id) => `tokens:detail:${id}`
};
