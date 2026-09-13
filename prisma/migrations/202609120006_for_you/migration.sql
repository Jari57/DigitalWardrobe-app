CREATE TABLE "TrendItem" ("id" TEXT PRIMARY KEY, "url" TEXT NOT NULL, "title" TEXT NOT NULL, "publisher" TEXT NOT NULL, "publishedAt" TIMESTAMP(3) NOT NULL, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "categories" TEXT[] NOT NULL, "aesthetics" TEXT[] NOT NULL);
CREATE UNIQUE INDEX "TrendItem_url_key" ON "TrendItem"("url");
ALTER TABLE "TrendItem" ADD COLUMN "imageUrl" TEXT, ADD COLUMN "imageCredit" TEXT;
CREATE INDEX "TrendItem_publishedAt_idx" ON "TrendItem"("publishedAt");
CREATE TABLE "TrendPreference" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "categories" TEXT[] NOT NULL, "aesthetics" TEXT[] NOT NULL, "region" TEXT NOT NULL DEFAULT 'US');
CREATE TABLE "TrendFeedback" ("userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "itemId" TEXT NOT NULL REFERENCES "TrendItem"("id") ON DELETE CASCADE, "liked" BOOLEAN NOT NULL DEFAULT false, "saved" BOOLEAN NOT NULL DEFAULT false, "hidden" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL, PRIMARY KEY ("userId", "itemId"));
CREATE INDEX "TrendFeedback_userId_updatedAt_idx" ON "TrendFeedback"("userId", "updatedAt");
CREATE TABLE "TrendRefresh" ("id" TEXT PRIMARY KEY, "lockUntil" TIMESTAMP(3) NOT NULL, "lastAttempt" TIMESTAMP(3), "lastSuccess" TIMESTAMP(3), "failedSources" TEXT[] NOT NULL);
