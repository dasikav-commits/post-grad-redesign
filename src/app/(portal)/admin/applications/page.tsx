import Link from "next/link";
import type { VerificationStatus } from "@prisma/client";
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

type Filter = "all" | "pending" | "correction" | "verified";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting verification" },
  { key: "correction", label: "Correction requested" },
  { key: "verified", label: "Verified" },
];

/** Map a list filter to the verification statuses used by the export. */
const VERIFICATION_OF: Record<Exclude<Filter, "all">, string> = {
  pending: "NOT_VERIFIED,UNDER_REVIEW",
  correction: "CORRECTION_REQUESTED",
  verified: "VERIFIED",
};

function filterWhere(filter: Filter): {
  verificationStatus?: VerificationStatus | { in: VerificationStatus[] };
} {
  if (filter === "pending")
    return {
      verificationStatus: { in: ["NOT_VERIFIED", "UNDER_REVIEW"] },
    };
  if (filter === "correction")
    return { verificationStatus: "CORRECTION_REQUESTED" };
  if (filter === "verified") return { verificationStatus: "VERIFIED" };
  return {};
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireRole("MAIN_ADMIN");
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.key === params.filter)
    ? params.filter
    : "all") as Filter;

  const applications = await prisma.applicationPostGraduate.findMany({
    where: { status: { in: ["ACTIVE", "APPROVED"] }, ...filterWhere(filter) },
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
        subtitle="Verify the information each student uploaded, request recorrections and notify students from the application page."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/applications" : `/admin/applications?filter=${f.key}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === f.key
                ? "bg-brand text-white"
                : "border border-border bg-white text-neutral-600 hover:border-brand hover:text-brand-dark"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <ApplicationsTable
        rows={rows}
        emptyMessage="No applications yet. They will appear here once students register."
        showDetailLink
        showVerification
        detailBase="/admin/applications"
        toolbar={
          <ExportExcelButton
            href={`/api/export/applications?scope=all${
              filter === "all" ? "" : `&verification=${VERIFICATION_OF[filter]}`
            }`}
          />
        }
      />
    </>
  );
}
