-- Portal improvements: admin verification / Form of Recorrection, direct
-- messaging, progress-report escalation (Supervisor → Faculty → Admin),
-- supervisor portal approval gate, funding method and degrees attached
-- directly to a faculty (department filtering removed).

-- CreateEnum
CREATE TYPE "FundingMethod" AS ENUM ('SELF_FUNDED', 'EMPLOYER_SPONSORED', 'UNIVERSITY_GRANT', 'EXTERNAL_SCHOLARSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_VERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "SupervisorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "application_post_graduate" ADD COLUMN     "registration_number" TEXT,
ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "funding_method" "FundingMethod",
ADD COLUMN     "funding_details" TEXT;

-- AlterTable
ALTER TABLE "degree_sought" ADD COLUMN     "faculty_id" INTEGER;

-- AlterTable
ALTER TABLE "supervisor" ADD COLUMN     "approval_status" "SupervisorApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approval_note" TEXT,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" INTEGER;

-- AlterTable
ALTER TABLE "progress_report" ADD COLUMN     "faculty_status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "faculty_comment" TEXT,
ADD COLUMN     "faculty_admin_id" INTEGER,
ADD COLUMN     "faculty_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "admin_status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "admin_comment" TEXT,
ADD COLUMN     "admin_id" INTEGER,
ADD COLUMN     "admin_reviewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sender_name" TEXT,
ADD COLUMN     "link" TEXT;

-- Backfill: every supervisor already on the list was vetted before this gate
-- existed, so keep their portal access working.
UPDATE "supervisor" SET "approval_status" = 'APPROVED', "approved_at" = CURRENT_TIMESTAMP;

-- Backfill: attach each degree to its faculty so the structure manager and the
-- registration form can list degrees without going through a department.
UPDATE "degree_sought" AS d
SET "faculty_id" = dep."faculty_id"
FROM "department" AS dep
WHERE d."department_id" = dep."department_id" AND d."faculty_id" IS NULL;

UPDATE "degree_sought" AS d
SET "faculty_id" = f."faculty_id"
FROM "faculty" AS f
WHERE d."faculty_id" IS NULL AND d."faculty" = f."name";

-- Backfill: give every completed registration a registration number
-- (PG/<year>/<seq>) so the Registrar's approved table can show "Reg No".
WITH numbered AS (
  SELECT
    "application_id",
    EXTRACT(YEAR FROM "registration_date")::integer AS yr,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM "registration_date")
      ORDER BY "application_id"
    ) AS n
  FROM "application_post_graduate"
  WHERE "status" = 'APPROVED'
)
UPDATE "application_post_graduate" AS a
SET "registration_number" = 'PG/' || numbered.yr::text || '/' || LPAD(numbered.n::text, 3, '0')
FROM numbered
WHERE a."application_id" = numbered."application_id";

-- CreateTable
CREATE TABLE "application_verification" (
    "verification_id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "notes" TEXT,
    "reviewer_id" INTEGER,
    "reviewer_role" "UserRole",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_verification_pkey" PRIMARY KEY ("verification_id")
);

-- CreateTable
CREATE TABLE "correction_request" (
    "correction_id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "raised_by_id" INTEGER,
    "raised_by_role" "UserRole",
    "items" TEXT NOT NULL,
    "message" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "student_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "correction_request_pkey" PRIMARY KEY ("correction_id")
);

-- CreateTable
CREATE TABLE "message" (
    "message_id" SERIAL NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "recipient_id" INTEGER,
    "supervisor_id" INTEGER,
    "application_id" INTEGER,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "application_verification_application_id_idx" ON "application_verification"("application_id");

-- CreateIndex
CREATE INDEX "correction_request_application_id_status_idx" ON "correction_request"("application_id", "status");

-- CreateIndex
CREATE INDEX "message_thread_id_idx" ON "message"("thread_id");

-- CreateIndex
CREATE INDEX "message_recipient_id_is_read_idx" ON "message"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "message_supervisor_id_is_read_idx" ON "message"("supervisor_id", "is_read");

-- CreateIndex
CREATE INDEX "progress_report_faculty_status_idx" ON "progress_report"("faculty_status");

-- CreateIndex
CREATE INDEX "progress_report_admin_status_idx" ON "progress_report"("admin_status");

-- CreateIndex
CREATE UNIQUE INDEX "application_post_graduate_registration_number_key" ON "application_post_graduate"("registration_number");

-- AddForeignKey
ALTER TABLE "degree_sought" ADD CONSTRAINT "degree_sought_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("faculty_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor" ADD CONSTRAINT "supervisor_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_report" ADD CONSTRAINT "progress_report_faculty_admin_id_fkey" FOREIGN KEY ("faculty_admin_id") REFERENCES "faculty_admin"("faculty_admin_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_report" ADD CONSTRAINT "progress_report_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("admin_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification" ADD CONSTRAINT "application_verification_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application_post_graduate"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification" ADD CONSTRAINT "application_verification_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application_post_graduate"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request" ADD CONSTRAINT "correction_request_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "supervisor"("supervisor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application_post_graduate"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;
