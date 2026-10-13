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

/**
 * The Registrar acts as the main handler for applications: every application in
 * every faculty, with the same verification / recorrection / notification tools
 * the Main Admin has.
 */
export default async function Page() {
  await requireRole("REGISTRAR");

  const applications = await prisma.applicationPostGraduate.findMany({
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
      registrationNumber: true,
    },
  });

  const summaries = await getApplicationSummaries(
    applications.map((a: { id: number }) => a.id),
  );

  const rows: AppRow[] = applications.map((a) => {
    const s = summaries.get(a.id);
    return {
      id: a.id,
      fullName: a.registrationNumber
        ? `${a.fullName} · ${a.registrationNumber}`
        : a.fullName,
      nic: a.nic,
      faculty: a.faculty,
      degreeProgram: a.degreeProgram,
      status: a.status,
      registrationDate: a.registrationDate,
      verificationStatus: a.verificationStatus,
      requirementsMet: s?.requirementsMet ?? null,
      requirementsTotal: s?.requirementsTotal ?? null,
      openCorrections: s?.openCorrections ?? 0,
      detailHref: `/registrar/registrations/${a.id}`,
    };
  });

  return (
    <>
      <PageHeader
        title="All Applications"
        subtitle="Every application across all faculties. Open one to verify the uploaded information, request recorrections or notify the student."
      />
      <ApplicationsTable
        rows={rows}
        emptyMessage="No applications yet."
        showDetailLink
        showVerification
        toolbar={<ExportExcelButton href="/api/export/applications?scope=all" />}
      />
    </>
  );
}
