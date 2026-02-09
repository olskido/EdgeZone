-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "pair_created_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tokens_pair_created_at_idx" ON "tokens"("pair_created_at");
