import { requireRole } from "@/lib/guard";
import { getStudentProgressOverview } from "@/lib/admin-progress";
import { PageHeader } from "@/components/page-header";
import { ProgressMonitor } from "@/components/progress-monitor";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole("REGISTRAR");

  // Progress is only tracked once the registration is completed.
  const rows = await getStudentProgressOverview(undefined, true);

  return (
    <>
      <PageHeader
        title="Student Progress"
        subtitle="Every registered student's progress reports and where each one stands in the Supervisor → Faculty → Admin chain."
      />
      <ProgressMonitor students={rows} showFaculty reviewStage={null} />
    </>
  );
}
