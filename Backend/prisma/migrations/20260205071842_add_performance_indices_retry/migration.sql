-- CreateIndex
CREATE INDEX "tokens_market_cap_idx" ON "tokens"("market_cap");

-- CreateIndex
CREATE INDEX "tokens_volume_24h_idx" ON "tokens"("volume_24h");

-- CreateIndex
CREATE INDEX "tokens_created_at_idx" ON "tokens"("created_at");
