/*
  Warnings:

  - A unique constraint covering the columns `[contract,chain]` on the table `tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "tokens_contract_key";

-- AlterTable
ALTER TABLE "market_snapshots" ADD COLUMN     "fdv" DECIMAL(38,18),
ADD COLUMN     "price_change_24h" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "chain" TEXT NOT NULL DEFAULT 'solana',
ADD COLUMN     "dex_id" TEXT,
ADD COLUMN     "last_ingested_at" TIMESTAMP(3),
ADD COLUMN     "pair_address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tokens_contract_chain_key" ON "tokens"("contract", "chain");
