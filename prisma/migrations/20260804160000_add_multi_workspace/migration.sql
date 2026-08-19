-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "activeWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Backfill User rows for every existing workspace member so the new
-- foreign key below can be added without data loss.
INSERT INTO "User" ("id", "activeWorkspaceId", "createdAt", "updatedAt")
SELECT DISTINCT "userId", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkspaceMember"
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE INDEX "User_activeWorkspaceId_idx" ON "User"("activeWorkspaceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
