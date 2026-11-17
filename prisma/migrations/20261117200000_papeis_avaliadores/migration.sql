-- AlterTable
ALTER TABLE "activity_evaluators" ADD COLUMN     "documents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "presentation" BOOLEAN NOT NULL DEFAULT true;

