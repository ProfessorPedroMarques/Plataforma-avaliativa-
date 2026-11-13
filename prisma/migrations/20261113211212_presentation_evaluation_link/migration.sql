-- AlterTable
ALTER TABLE "evaluation_results" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "submissionId" TEXT;

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "activityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_results_evaluationId_studentId_key" ON "evaluation_results"("evaluationId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_activityId_key" ON "evaluations"("activityId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

