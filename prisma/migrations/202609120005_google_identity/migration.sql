ALTER TABLE "User" ADD COLUMN "googleUid" TEXT, ADD COLUMN "googleEmail" TEXT;
CREATE UNIQUE INDEX "User_googleUid_key" ON "User"("googleUid");
ALTER TABLE "Session" ADD COLUMN "googleAuthenticated" BOOLEAN NOT NULL DEFAULT false;
