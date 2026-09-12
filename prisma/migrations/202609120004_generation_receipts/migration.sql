CREATE TABLE "AgentGeneration" ("id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "costMicros" INTEGER, CONSTRAINT "AgentGeneration_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AgentGeneration_requestId_idx" ON "AgentGeneration"("requestId");
ALTER TABLE "AgentGeneration" ADD CONSTRAINT "AgentGeneration_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AgentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
