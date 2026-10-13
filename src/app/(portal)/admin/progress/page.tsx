import { requireRole } from "@/lib/guard";
import { PageHeader } from "@/components/page-header";
import { getStudentProgressOverview } from "@/lib/admin-progress";
import { ProgressMonitor } from "@/components/progress-monitor";

export const dynamic = "force-dynamic";

export default async function AdminProgressPage() {
  await requireRole("MAIN_ADMIN");
  // Progress is only tracked once a student's registration has been completed.
  const students = await getStudentProgressOverview(null, true);

  return (
    <>
      <PageHeader
        title="Student Progress"
        subtitle="Registered students only — final sign-off of the Supervisor → Faculty → Admin progress chain."
      />
      <ProgressMonitor students={students} showFaculty reviewStage="ADMIN" />
    </>
  );
}
