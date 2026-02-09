-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "tokens_last_seen_at_idx" ON "tokens"("last_seen_at");

-- CreateIndex
CREATE INDEX "tokens_chain_volume_24h_last_seen_at_idx" ON "tokens"("chain", "volume_24h", "last_seen_at");
