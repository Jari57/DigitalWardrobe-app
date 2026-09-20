CREATE TABLE "UserExperience" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "region" TEXT NOT NULL DEFAULT 'US',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "maxPrice" INTEGER,
  "sizes" TEXT NOT NULL DEFAULT '',
  "draft" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "JourneyMetric" (
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "JourneyMetric_pkey" PRIMARY KEY ("userId", "day", "event"),
  CONSTRAINT "JourneyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JourneyMetric_day_event_idx" ON "JourneyMetric"("day", "event");
