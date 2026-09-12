-- CreateTable
CREATE TABLE "AgentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'reserved',
    "day" TEXT NOT NULL,
    "globalScope" TEXT NOT NULL,
    "userScope" TEXT NOT NULL,
    "reservedMicros" INTEGER NOT NULL,
    "actualMicros" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentBudget" (
    "scope" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "heldMicros" INTEGER NOT NULL DEFAULT 0,
    "spentMicros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentBudget_pkey" PRIMARY KEY ("scope","day")
);

-- CreateIndex
CREATE INDEX "AgentRequest_userId_createdAt_idx" ON "AgentRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRequest_state_updatedAt_idx" ON "AgentRequest"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRequest_userId_key_key" ON "AgentRequest"("userId", "key");

-- AddForeignKey
ALTER TABLE "AgentRequest" ADD CONSTRAINT "AgentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
