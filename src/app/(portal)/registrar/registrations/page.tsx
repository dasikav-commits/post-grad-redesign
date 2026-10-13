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
  await requireRole("REGISTRAR");

  // New registrations awaiting review = status ACTIVE.
  const apps = await prisma.applicationPostGraduate.findMany({
    where: { status: "ACTIVE" },
    orderBy: { registrationDate: "asc" },
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
    apps.map((a: { id: number }) => a.id),
  );

  const rows: AppRow[] = apps.map((a) => {
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
        title="New Registrations"
        subtitle="Applications awaiting review. Open one to check the requirements, verify the information and inform the student — the outcome is decided at the presentation review."
      />
      <ApplicationsTable
        rows={rows}
        emptyMessage="No new registrations to review."
        showDetailLink
        showVerification
        detailBase="/registrar/registrations"
        toolbar={<ExportExcelButton href="/api/export/applications?scope=active" />}
      />
    </>
  );
}
