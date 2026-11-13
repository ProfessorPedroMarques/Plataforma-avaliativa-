-- AlterTable
ALTER TABLE "criteria" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "guidance" TEXT;
