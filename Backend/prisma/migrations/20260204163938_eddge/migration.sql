-- AlterTable
ALTER TABLE "signals" ADD COLUMN     "edge_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smart_money_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whale_score" INTEGER NOT NULL DEFAULT 0;
