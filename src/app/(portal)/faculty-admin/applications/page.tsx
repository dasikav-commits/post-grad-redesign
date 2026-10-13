import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationSummaries } from "@/lib/application-summary";
import { PageHeader } from "@/components/page-header";
import {
  ApplicationsTable,
  ExportExcelButton,
  type AppRow,
} from "@/components/applications-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireRole("FACULTY_ADMIN");

  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });
  const faculty = profile?.faculty ?? null;

  const applications = await prisma.applicationPostGraduate.findMany({
    where: {
      ...(faculty ? { faculty } : {}),
      status: { in: ["ACTIVE", "APPROVED"] },
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      fullName: true,
      nic: true,
      faculty: true,
      degreeProgram: true,
      status: true,
      registrationDate: true,
      verificationStatus: true,
    },
  });

  const summaries = await getApplicationSummaries(
    applications.map((a: { id: number }) => a.id),
  );

  const rows: AppRow[] = applications.map((a) => {
    const s = summaries.get(a.id);
    return {
      id: a.id,
      fullName: a.fullName,
      nic: a.nic,
      faculty: a.faculty,
      degreeProgram: a.degreeProgram,
      status: a.status,
      registrationDate: a.registrationDate,
      verificationStatus: a.verificationStatus,
      requirementsMet: s?.requirementsMet ?? null,
      requirementsTotal: s?.requirementsTotal ?? null,
      openCorrections: s?.openCorrections ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={
          faculty
            ? `${faculty} — open an application to check what the student uploaded, communicate errors or corrections, and notify the student.`
            : "Open an application to check what the student uploaded, communicate errors or corrections, and notify the student."
        }
      />
      <ApplicationsTable
        rows={rows}
        emptyMessage="No applications for your faculty yet."
        showDetailLink
        showVerification
        detailBase="/faculty-admin/applications"
        toolbar={<ExportExcelButton href="/api/export/applications?scope=all" />}
      />
    </>
  );
}
