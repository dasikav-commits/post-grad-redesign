import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ExportExcelButton } from "@/components/applications-table";
import { FUNDING_LABEL, STUDY_MODE_LABEL } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole("REGISTRAR");

  const apps = await prisma.applicationPostGraduate.findMany({
    where: { status: "APPROVED" },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      fullName: true,
      nic: true,
      faculty: true,
      degreeProgram: true,
      studyMode: true,
      fundingMethod: true,
      registrationNumber: true,
      contacts: { select: { contactType: true, contactValue: true } },
      user: {
        select: {
          email: true,
          userCode: true,
          initialPassword: true,
          mustChangePassword: true,
        },
      },
      researchProposals: {
        take: 1,
        orderBy: { id: "desc" },
        select: { title: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Approved"
        subtitle="Completed registrations. Share each student's login credentials until they sign in and change their password."
      />

      <div className="mb-3 flex justify-end">
        <ExportExcelButton href="/api/export/applications?scope=approved" />
      </div>

      {apps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No approved applications yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Reg No</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Degree</th>
                <th className="px-3 py-2 font-semibold">Faculty</th>
                <th className="px-3 py-2 font-semibold">FT/PT</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Contact info</th>
                <th className="px-3 py-2 font-semibold">Funding method</th>
                <th className="px-3 py-2 font-semibold">Login</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const changed = a.user ? !a.user.mustChangePassword : false;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2 font-medium text-black">
                      {a.fullName}
                      <div className="text-xs text-neutral-500">{a.nic}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-brand-dark">
                      {a.registrationNumber ?? a.user?.userCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.user?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.degreeProgram ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{a.faculty ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.studyMode ? (STUDY_MODE_LABEL[a.studyMode] ?? a.studyMode) : "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      <span className="line-clamp-2 max-w-[16rem]">
                        {a.researchProposals[0]?.title ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.contacts.length === 0
                        ? "—"
                        : a.contacts
                            .map((c: { contactType: string; contactValue: string }) => c.contactValue)
                            .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.fundingMethod
                        ? (FUNDING_LABEL[a.fundingMethod] ?? a.fundingMethod)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {changed ? (
                        <span className="rounded border border-brand px-2 py-0.5 text-xs font-semibold text-black">
                          Password changed
                        </span>
                      ) : a.user?.initialPassword ? (
                        <span className="rounded bg-brand px-2 py-0.5 font-mono text-xs font-semibold text-white">
                          {a.user.initialPassword}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/registrar/registrations/${a.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-black hover:border-brand"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
