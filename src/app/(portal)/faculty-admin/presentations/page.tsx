import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function FacultyPresentationsPage() {
  const session = await requireRole("FACULTY_ADMIN");

  // Faculty admins only see their own faculty.
  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });
  const faculty = profile?.faculty ?? null;

  const apps = await prisma.applicationPostGraduate.findMany({
    where: {
      ...(faculty ? { faculty } : {}),
      status: { in: ["ACTIVE", "APPROVED"] },
    },
    select: {
      id: true,
      status: true,
      fullName: true,
      nic: true,
      degreeProgram: true,
      researchProposals: {
        select: {
          id: true,
          title: true,
          presentations: {
            select: {
              id: true,
              presentationDate: true,
              venue: true,
              isDone: true,
              isFinal: true,
              outcome: true,
            },
            orderBy: { presentationDate: "desc" },
            take: 1,
          },
        },
        take: 1,
      },
    },
    orderBy: { registrationDate: "desc" },
  });

  const withoutPresentation = apps.filter(
    (a) => a.researchProposals[0]?.presentations.length === 0,
  );
  const scheduled = apps.filter((a) => {
    const p = a.researchProposals[0]?.presentations[0];
    return p && !p.isDone;
  });
  const awaitingOutcome = apps.filter((a) => {
    const p = a.researchProposals[0]?.presentations[0];
    return p && p.isDone && !p.outcome;
  });

  return (
    <>
      <PageHeader
        title="Presentations"
        subtitle={
          faculty
            ? `${faculty} — assign dates and venues, then record the outcome of every completed presentation.`
            : "Assign dates and venues, then record the outcome of every completed presentation."
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          href="/faculty-admin/presentations/completed"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-black hover:border-brand"
        >
          Completed presentations
        </Link>
      </div>

      <div className="space-y-6">
        {/* Presentations Pending Assignment */}
        {withoutPresentation.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-4 text-lg font-bold text-black">
              Pending Presentation Assignment
            </h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Student</th>
                    <th className="px-4 py-2 font-semibold">Degree</th>
                    <th className="px-4 py-2 font-semibold">Proposal</th>
                    <th className="px-4 py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {withoutPresentation.map((app) => (
                    <tr key={app.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium text-black">
                        {app.fullName}
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {app.degreeProgram || "—"}
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {app.researchProposals[0]?.title || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/faculty-admin/presentations/assign/${app.id}`}
                          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                        >
                          Assign date &amp; venue
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scheduled Presentations */}
        {scheduled.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-4 text-lg font-bold text-black">
              Scheduled Presentations
            </h2>
            <div className="space-y-2">
              {scheduled.map((app) => {
                const p = app.researchProposals[0]!.presentations[0]!;
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-neutral-50"
                  >
                    <div>
                      <p className="font-medium text-black">{app.fullName}</p>
                      <p className="text-sm text-neutral-600">
                        {app.researchProposals[0]?.title}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {new Date(p.presentationDate).toLocaleString()}
                        {p.venue ? ` · ${p.venue}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                        Scheduled
                      </span>
                      <Link
                        href={`/faculty-admin/presentations/${p.id}`}
                        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Awaiting the Faculty Admin's outcome */}
        {awaitingOutcome.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-4 text-lg font-bold text-black">
              Awaiting your outcome
            </h2>
            <div className="space-y-2">
              {awaitingOutcome.map((app) => {
                const p = app.researchProposals[0]!.presentations[0]!;
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3"
                  >
                    <div>
                      <p className="font-medium text-black">{app.fullName}</p>
                      <p className="text-sm text-neutral-600">
                        {app.researchProposals[0]?.title}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Presented {new Date(p.presentationDate).toLocaleString()}
                        {p.venue ? ` · ${p.venue}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        Pending approval
                      </span>
                      <Link
                        href={`/faculty-admin/presentations/${p.id}`}
                        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {apps.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
            No presentations to manage yet.
          </div>
        )}
      </div>
    </>
  );
}
