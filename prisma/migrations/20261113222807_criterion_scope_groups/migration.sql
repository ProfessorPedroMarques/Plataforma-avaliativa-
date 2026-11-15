-- CreateEnum
CREATE TYPE "CriterionScope" AS ENUM ('GROUP', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "criteria" ADD COLUMN     "scope" "CriterionScope" NOT NULL DEFAULT 'GROUP';

