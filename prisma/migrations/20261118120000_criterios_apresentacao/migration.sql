-- AlterTable
ALTER TABLE "evaluation_results" ADD COLUMN     "groupMax" DECIMAL(8,2),
ADD COLUMN     "groupScore" DECIMAL(8,2),
ADD COLUMN     "presentationMax" DECIMAL(8,2),
ADD COLUMN     "presentationScore" DECIMAL(8,2);

-- CreateTable
CREATE TABLE "presentation_criteria" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "weight" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_evaluations" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT,
    "teacherId" TEXT NOT NULL,
    "notes" TEXT,
    "score" DECIMAL(8,2),
    "maxScore" DECIMAL(8,2),
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_scores" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentation_criteria_active_archived_idx" ON "presentation_criteria"("active", "archived");

-- CreateIndex
CREATE INDEX "presentation_evaluations_activityId_studentId_idx" ON "presentation_evaluations"("activityId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_evaluations_activityId_studentId_teacherId_key" ON "presentation_evaluations"("activityId", "studentId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_scores_evaluationId_criterionId_key" ON "presentation_scores"("evaluationId", "criterionId");

-- AddForeignKey
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_scores" ADD CONSTRAINT "presentation_scores_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "presentation_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_scores" ADD CONSTRAINT "presentation_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "presentation_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Ponto de partida: critérios de apresentação que já existiam dentro das atividades
-- (scope INDIVIDUAL) são copiados para o novo cadastro independente, sem duplicar nomes.
-- Os critérios dos documentos (scope GROUP) não são tocados.
INSERT INTO "presentation_criteria" ("id", "title", "description", "maxPoints", "weight", "active", "archived", "position", "updatedAt")
SELECT gen_random_uuid()::text, t."title", t."description", t."maxPoints", t."weight", true, false,
       ROW_NUMBER() OVER (ORDER BY t."position", t."title"), CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (LOWER(TRIM("title"))) TRIM("title") AS "title", "description", "maxPoints", "weight", "position"
  FROM "criteria"
  WHERE "scope" = 'INDIVIDUAL' AND "active" = true
  ORDER BY LOWER(TRIM("title")), "position"
) t;
