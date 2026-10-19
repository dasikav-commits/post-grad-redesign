import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function SupervisorPresentationsPage() {
  const session = await requireRole("SUPERVISOR");

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!supervisor) {
    return (
      <>
        <PageHeader
          title="Presentations"
          subtitle="View scheduled presentations for your assigned students."
        />
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          Supervisor profile not found.
        </div>
      </>
    );
  }

  // Get all presentations for proposals this supervisor is assigned to
  const proposals = await prisma.researchProposal.findMany({
    where: {
      supervisors: { some: { supervisorId: supervisor.id } },
    },
    select: {
      id: true,
      title: true,
      application: {
        select: {
          fullName: true,
          nic: true,
          degreeProgram: true,
        },
      },
      presentations: {
        select: {
          id: true,
          presentationDate: true,
          venue: true,
          isDone: true,
          isFinal: true,
          outcome: true,
          title: true,
        },
        orderBy: { presentationDate: "desc" },
      },
    },
  });

  const presentationsMap = proposals
    .flatMap((p) =>
      p.presentations.map((pres) => ({
        ...pres,
        proposalId: p.id,
        proposalTitle: p.title,
        studentName: p.application.fullName,
        studentNIC: p.application.nic,
        degree: p.application.degreeProgram,
      }))
    )
    .sort((a, b) => new Date(a.presentationDate).getTime() - new Date(b.presentationDate).getTime());

  const pendingPresentations = presentationsMap.filter((p) => !p.isDone);
  const completedPresentations = presentationsMap.filter((p) => p.isDone);

  return (
    <>
      <PageHeader
        title="Presentations"
        subtitle="View and manage presentations for your assigned students."
      />

      <div className="space-y-6">
        {/* Scheduled Presentations */}
        {pendingPresentations.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-4 text-lg font-bold text-black">
              Upcoming Presentations ({pendingPresentations.length})
            </h2>
            <div className="space-y-2">
              {pendingPresentations.map((pres) => (
                <div
                  key={pres.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-neutral-50"
                >
                  <div>
                    <p className="font-medium text-black">{pres.studentName}</p>
                    <p className="text-sm text-neutral-600">{pres.proposalTitle}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(pres.presentationDate).toLocaleString()}
                      {pres.venue ? ` · ${pres.venue}` : ""} · {pres.degree}
                    </p>
                  </div>
                  <Link
                    href={`/supervisor/presentations/${pres.id}`}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Presentations */}
        {completedPresentations.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-4 text-lg font-bold text-black">
              Completed Presentations ({completedPresentations.length})
            </h2>
            <div className="space-y-2">
              {completedPresentations.map((pres) => (
                <div
                  key={pres.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium text-black">{pres.studentName}</p>
                    <p className="text-sm text-neutral-600">{pres.proposalTitle}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(pres.presentationDate).toLocaleString()}
                      {pres.venue ? ` · ${pres.venue}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      pres.outcome === "RECOMMENDED"
                        ? "bg-green-100 text-green-800"
                        : pres.outcome === "NOT_RECOMMENDED"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {pres.outcome === "RECOMMENDED"
                      ? "Recommended"
                      : pres.outcome === "NOT_RECOMMENDED"
                        ? "Not recommended"
                        : "Awaiting outcome"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {presentationsMap.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
            No presentations scheduled yet for your assigned students.
          </div>
        )}
      </div>
    </>
  );
}
