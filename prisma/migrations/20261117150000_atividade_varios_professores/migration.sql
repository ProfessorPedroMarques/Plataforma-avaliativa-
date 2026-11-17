-- CreateTable
CREATE TABLE "activity_evaluators" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_evaluators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_evaluators_teacherId_idx" ON "activity_evaluators"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_evaluators_activityId_teacherId_key" ON "activity_evaluators"("activityId", "teacherId");

-- AddForeignKey
ALTER TABLE "activity_evaluators" ADD CONSTRAINT "activity_evaluators_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_evaluators" ADD CONSTRAINT "activity_evaluators_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: o professor responsável de cada atividade existente vira avaliador.
INSERT INTO "activity_evaluators" ("id", "activityId", "teacherId")
SELECT gen_random_uuid()::text, "id", "teacherId" FROM "activities" WHERE "teacherId" IS NOT NULL
ON CONFLICT DO NOTHING;
