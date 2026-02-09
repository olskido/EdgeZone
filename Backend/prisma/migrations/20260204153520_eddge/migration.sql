-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "liquidity" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "market_cap" DECIMAL(38,18) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_events" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "usd_value" DECIMAL(38,18) NOT NULL,
    "label" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "token_id" TEXT NOT NULL,
    "conviction_score" INTEGER NOT NULL,
    "momentum_phase" TEXT NOT NULL,
    "threat_level" TEXT NOT NULL,
    "edge_verdict" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("token_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_contract_key" ON "tokens"("contract");

-- CreateIndex
CREATE INDEX "tokens_ticker_idx" ON "tokens"("ticker");

-- CreateIndex
CREATE INDEX "market_snapshots_token_id_idx" ON "market_snapshots"("token_id");

-- CreateIndex
CREATE INDEX "market_snapshots_timestamp_idx" ON "market_snapshots"("timestamp");

-- CreateIndex
CREATE INDEX "wallet_events_token_id_idx" ON "wallet_events"("token_id");

-- CreateIndex
CREATE INDEX "wallet_events_wallet_idx" ON "wallet_events"("wallet");

-- CreateIndex
CREATE INDEX "wallet_events_timestamp_idx" ON "wallet_events"("timestamp");

-- AddForeignKey
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_events" ADD CONSTRAINT "wallet_events_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
