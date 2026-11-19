-- CreateTable
CREATE TABLE "submission_file_contents" (
    "fileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "submission_file_contents_pkey" PRIMARY KEY ("fileId")
);

-- AddForeignKey
ALTER TABLE "submission_file_contents" ADD CONSTRAINT "submission_file_contents_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "submission_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

