import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationSummaries } from "@/lib/application-summary";
import { PageHeader } from "@/components/page-header";
import { VERIFICATION_LABEL, VERIFICATION_STYLE } from "@/lib/status-labels";
import { NotifyStudentsPanel } from "./notify-panel";

export const dynamic = "force-dynamic";

/**
 * "Notify Students" — the Registrar is the channel through which applicants are
 * informed: one-to-one from an application, or to a whole group from here.
 */
export default async function Page() {
  await requireRole("REGISTRAR");

  const apps = await prisma.applicationPostGraduate.findMany({
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      fullName: true,
      faculty: true,
      degreeProgram: true,
      status: true,
      verificationStatus: true,
      registrationNumber: true,
      userId: true,
      emails: { select: { email: true } },
    },
  });

  const summaries = await getApplicationSummaries(apps.map((a: { id: number }) => a.id));
  const openCorrections = await prisma.correctionRequest.findMany({
    where: { status: "OPEN" },
    select: { applicationId: true },
  });
  const withOpenCorrections = new Set(
    openCorrections.map((c: { applicationId: number }) => c.applicationId),
  );

  const counts: Record<string, number> = {
    all: apps.length,
    new: apps.filter((a: { status: string }) => a.status === "ACTIVE").length,
    approved: apps.filter((a: { status: string }) => a.status === "APPROVED").length,
    corrections: apps.filter((a: { id: number }) => withOpenCorrections.has(a.id)).length,
    incomplete: apps.filter((a: { id: number }) => {
      const s = summaries.get(a.id);
      return s ? !s.complete : false;
    }).length,
  };

  return (
    <>
      <PageHeader
        title="Notify Students"
        subtitle="Applicants are informed through the Registrar — send a portal notification and/or an email to one applicant or to a whole group."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <NotifyStudentsPanel counts={counts} />

        <div className="rounded-lg border border-border bg-white p-4">
          <h3 className="text-base font-bold text-black">Reachable applicants</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Applicants with a portal account get an in-app notification as well.
            Those without one (registration not completed yet) are reached by
            email only.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between border-b border-border py-1">
              <dt className="text-neutral-500">With a portal account</dt>
              <dd className="font-semibold text-black">
                {apps.filter((a: { userId: number | null }) => a.userId != null).length}
              </dd>
            </div>
            <div className="flex justify-between border-b border-border py-1">
              <dt className="text-neutral-500">Email only (no account yet)</dt>
              <dd className="font-semibold text-black">
                {apps.filter((a: { userId: number | null }) => a.userId == null).length}
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-neutral-500">Owing a correction</dt>
              <dd className="font-semibold text-black">{counts.corrections}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            To message one applicant individually, open their application from{" "}
            <Link href="/registrar/applications" className="text-brand underline">
              All Applications
            </Link>{" "}
            and use “Notify student”.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Applicant</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">Faculty</th>
              <th className="px-3 py-2 font-semibold">Degree</th>
              <th className="px-3 py-2 font-semibold">Requirements</th>
              <th className="px-3 py-2 font-semibold">Verification</th>
              <th className="px-3 py-2 font-semibold">Registration</th>
              <th className="px-3 py-2 font-semibold">Portal</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-neutral-500">
                  No applications yet.
                </td>
              </tr>
            ) : (
              apps.map((a) => {
                const s = summaries.get(a.id);
                const verification = a.verificationStatus ?? "NOT_VERIFIED";
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-black">
                      {a.fullName}
                      {withOpenCorrections.has(a.id) && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          correction open
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.emails[0]?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{a.faculty ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-600">{a.degreeProgram ?? "—"}</td>
                    <td className="px-3 py-2">
                      {s ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            s.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {s.requirementsMet}/{s.requirementsTotal}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERIFICATION_STYLE[verification] ?? "bg-neutral-100 text-neutral-600"}`}
                      >
                        {VERIFICATION_LABEL[verification] ?? verification}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.registrationNumber ?? a.status}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.userId ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Account
                        </span>
                      ) : (
                        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                          Email only
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/registrar/registrations/${a.id}`}
                        className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-black hover:border-brand"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
