import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { getStudentProgressOverview } from "@/lib/admin-progress";
import { ProgressMonitor } from "@/components/progress-monitor";

export const dynamic = "force-dynamic";

export default async function FacultyAdminProgressPage() {
  const session = await requireRole("FACULTY_ADMIN");
  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });

  // Progress is only tracked once a student's registration has been completed.
  const students = await getStudentProgressOverview(profile?.faculty ?? null, true);

  return (
    <>
      <PageHeader
        title="Student Progress"
        subtitle={
          profile?.faculty
            ? `${profile.faculty} — registered students. Endorse supervisor-approved reports to forward them to the Main Admin.`
            : "Registered students. Endorse supervisor-approved reports to forward them to the Main Admin."
        }
      />
      <ProgressMonitor students={students} reviewStage="FACULTY" />
    </>
  );
}
