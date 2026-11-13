-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "rubricVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "mode" "EvaluationMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "openDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "allowedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 20,
    "maxFiles" INTEGER NOT NULL DEFAULT 5,
    "allowResubmission" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_classId_idx" ON "activities"("classId");

-- CreateIndex
CREATE INDEX "activities_teacherId_idx" ON "activities"("teacherId");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "activities"("status");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_classId_fkey" FOREIGN KEY ("classId") REFERENCES "school_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "rubric_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
