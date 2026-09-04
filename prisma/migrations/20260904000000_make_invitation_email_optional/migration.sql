-- AlterTable: Make email nullable for link-based invitations
ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "email" DROP NOT NULL;
