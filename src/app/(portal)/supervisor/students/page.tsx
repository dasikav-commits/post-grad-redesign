import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export default async function Page() {
  const session = await requireRole("SUPERVISOR");
  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!supervisor) {
    return null;
  }

  const proposals = await prisma.researchProposal.findMany({
    where: {
      supervisors: { some: { supervisorId: supervisor.id } },
    },
    orderBy: { submittedDate: "desc" },
    select: {
      id: true,
      title: true,
      application: {
        select: {
          id: true,
          fullName: true,
          status: true,
        },
      },
      supervisors: {
        where: { supervisorId: supervisor.id },
        select: { isMain: true, status: true },
      },
      files: { select: { fileName: true, filePath: true } },
      presentations: {
        select: {
          presentationDate: true,
          venue: true,
          isDone: true,
          outcome: true,
        },
        orderBy: { presentationDate: "desc" },
        take: 1,
      },
    },
  });

  return (
    <>
      <PageHeader
        title="My Students"
        subtitle="Students you supervise as main or co-supervisor. Open a student to view their full dossier."
      />
      <div className="space-y-3">
        {proposals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-sm text-neutral-500">
            No assigned students yet.
          </div>
        ) : (
          proposals.map((proposal) => {
            const selfRole = proposal.supervisors[0];
            const proposalFile = proposal.files[0];
            const status = proposal.application.status;
            const presentation = proposal.presentations[0] ?? null;
            return (
              <div key={proposal.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-black">{proposal.application.fullName}</p>
                    <p className="text-sm text-neutral-600">{proposal.title}</p>
                    {presentation && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Presentation: {new Date(presentation.presentationDate).toLocaleString()}
                        {presentation.venue ? ` · ${presentation.venue}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : "bg-brand text-white"
                      }`}
                    >
                      {status}
                    </span>
                    <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                      {selfRole?.isMain ? "Main supervisor" : "Co-supervisor"}
                    </span>
                    <Link
                      href={`/supervisor/students/${proposal.application.id}`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-black hover:border-brand"
                    >
                      View student
                    </Link>
                  </div>
                </div>
                {proposalFile && (
                  <div className="mt-3 text-sm">
                    <a
                      href={`/api/files?path=${encodeURIComponent(proposalFile.filePath)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-black underline"
                    >
                      Download proposal ({proposalFile.fileName})
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
