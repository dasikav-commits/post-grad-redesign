-- Presentation outcomes (Recommended / Not recommended), venue, and the
-- student payment slips.
--
-- - presentation.venue / outcome / outcome_note / outcome_by_id / decided_at /
--   created_by_faculty_admin_id are added; created_by_admin is made nullable
--   because presentations are now created by faculty admins.
-- - payment_slip stores one row per payment slip declared during registration
--   (amount / purpose / date / slip). The slip file is also kept in
--   uploaded_file with category PAYMENT_RECEIPT, so the registration
--   requirements checklist is unchanged.
-- - Existing completed-and-final presentations are backfilled to
--   outcome = 'RECOMMENDED'.

-- CreateEnum
CREATE TYPE "PresentationOutcome" AS ENUM ('RECOMMENDED', 'NOT_RECOMMENDED');

-- AlterTable
ALTER TABLE "presentation"
  ADD COLUMN "venue" TEXT,
  ADD COLUMN "outcome" "PresentationOutcome",
  ADD COLUMN "outcome_note" TEXT,
  ADD COLUMN "outcome_by_id" INTEGER,
  ADD COLUMN "decided_at" TIMESTAMP(3),
  ADD COLUMN "created_by_faculty_admin_id" INTEGER;

-- presentations are now created by faculty admins, so the legacy admin link is
-- optional
ALTER TABLE "presentation" ALTER COLUMN "created_by_admin" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_slip" (
    "payment_slip_id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_slip_pkey" PRIMARY KEY ("payment_slip_id")
);

-- CreateIndex
CREATE INDEX "payment_slip_application_id_idx" ON "payment_slip"("application_id");

-- CreateIndex
CREATE INDEX "payment_slip_payment_date_idx" ON "payment_slip"("payment_date");

-- CreateIndex
CREATE INDEX "presentation_created_by_faculty_admin_id_idx" ON "presentation"("created_by_faculty_admin_id");

-- CreateIndex
CREATE INDEX "presentation_outcome_by_id_idx" ON "presentation"("outcome_by_id");

-- AddForeignKey
ALTER TABLE "presentation" ADD CONSTRAINT "presentation_created_by_faculty_admin_id_fkey" FOREIGN KEY ("created_by_faculty_admin_id") REFERENCES "faculty_admin"("faculty_admin_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation" ADD CONSTRAINT "presentation_outcome_by_id_fkey" FOREIGN KEY ("outcome_by_id") REFERENCES "faculty_admin"("faculty_admin_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_slip" ADD CONSTRAINT "payment_slip_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application_post_graduate"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: presentations that were approved before the outcome column
-- existed were all approved positively.
UPDATE "presentation" SET "outcome" = 'RECOMMENDED' WHERE "is_final" = true;
