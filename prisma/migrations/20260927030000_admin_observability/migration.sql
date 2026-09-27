CREATE TABLE "TrafficDaily" (
  "day" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "device" TEXT NOT NULL,
  "signedIn" BOOLEAN NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY ("day", "page", "channel", "device", "signedIn")
);
CREATE TABLE "ServiceControl" (
  "id" TEXT PRIMARY KEY DEFAULT 'global',
  "aiPaused" BOOLEAN NOT NULL DEFAULT false,
  "dailyCapMicros" INTEGER,
  "requestsPerUser" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "ServiceControl" ("id") VALUES ('global');
CREATE TABLE "AdminAudit" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");
