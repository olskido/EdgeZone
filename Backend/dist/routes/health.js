"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const healthRoutes = async (app) => {
    app.get('/health', async () => {
        return { status: 'alive' };
    });
};
exports.healthRoutes = healthRoutes;
