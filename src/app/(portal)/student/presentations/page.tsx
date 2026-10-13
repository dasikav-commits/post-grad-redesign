import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function StudentPresentationsPage() {
  const session = await requireRole("STUDENT");

  const app = await prisma.applicationPostGraduate.findFirst({
    where: { userId: session.userId },
    select: {
      id: true,
      fullName: true,
      degreeProgram: true,
      status: true,
      researchProposals: {
        select: {
          id: true,
          title: true,
          description: true,
          supervisors: {
            select: {
              supervisor: { select: { name: true } },
              isMain: true,
            },
          },
          presentations: {
            select: {
              id: true,
              presentationDate: true,
              isDone: true,
              isFinal: true,
              title: true,
            },
            orderBy: { presentationDate: "desc" },
          },
        },
        take: 1,
      },
    },
  });

  if (!app || app.researchProposals.length === 0) {
    return (
      <>
        <PageHeader
          title="Presentations"
          subtitle="Your presentation schedule will appear here once assigned."
        />
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No research proposal found. Please complete your registration first.
        </div>
      </>
    );
  }

  const proposal = app.researchProposals[0];
  const presentations = proposal.presentations;

  return (
    <>
      <PageHeader
        title="Presentations"
        subtitle="View your assigned presentation dates and details."
      />

      {presentations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No presentation date has been assigned yet. The Registrar will schedule your
          presentation once your application is approved.
        </div>
      ) : (
        <div className="space-y-4">
          {presentations.map((pres) => (
            <div
              key={pres.id}
              className="rounded-lg border border-border bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-black">{pres.title}</h3>
                  <p className="text-sm text-neutral-600">{proposal.title}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded whitespace-nowrap ${
                    pres.isFinal
                      ? "bg-green-100 text-green-800"
                      : pres.isDone
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {pres.isFinal ? "Approved" : pres.isDone ? "Completed" : "Scheduled"}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="border-t border-border pt-3">
                  <p className="text-neutral-500">Date & Time</p>
                  <p className="font-medium text-black">
                    {new Date(pres.presentationDate).toLocaleString()}
                  </p>
                </div>

                {proposal.supervisors.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-neutral-500 mb-2">Supervisors</p>
                    <div className="space-y-1">
                      {proposal.supervisors.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-black">{s.supervisor.name}</span>
                          {s.isMain && (
                            <span className="text-xs bg-brand text-white px-2 py-0.5 rounded">
                              Main
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {pres.isFinal && (
                <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-800">
                    ✓ Your presentation has been approved. You are now registered as a postgraduate
                    student.
                  </p>
                </div>
              )}
              {pres.isDone && !pres.isFinal && (
                <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-800">
                    Your presentation has been completed and is awaiting the Registrar&apos;s final
                    approval.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
