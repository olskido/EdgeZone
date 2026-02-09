-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "ai_summary" TEXT,
ADD COLUMN     "ai_summary_updated" TIMESTAMP(3),
ADD COLUMN     "cluster_detected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conviction_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "momentum_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smart_wallet_flow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "threat_level" TEXT NOT NULL DEFAULT 'LOW';

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "amount_usd" DECIMAL(38,18) NOT NULL,
    "side" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_wallets" (
    "wallet_address" TEXT NOT NULL,
    "smart_score" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "avg_entry_position" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_active" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_wallets_pkey" PRIMARY KEY ("wallet_address")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_signature_key" ON "wallet_transactions"("signature");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_address_idx" ON "wallet_transactions"("wallet_address");

-- CreateIndex
CREATE INDEX "wallet_transactions_token_id_idx" ON "wallet_transactions"("token_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_timestamp_idx" ON "wallet_transactions"("timestamp");

-- CreateIndex
CREATE INDEX "wallet_transactions_token_id_timestamp_idx" ON "wallet_transactions"("token_id", "timestamp");

-- CreateIndex
CREATE INDEX "smart_wallets_smart_score_idx" ON "smart_wallets"("smart_score");

-- CreateIndex
CREATE INDEX "smart_wallets_last_active_idx" ON "smart_wallets"("last_active");

-- CreateIndex
CREATE INDEX "tokens_momentum_score_idx" ON "tokens"("momentum_score");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
