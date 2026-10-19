import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { MarkPresentationCompleteForm } from "./mark-form";

export const dynamic = "force-dynamic";

export default async function SupervisorPresentationDetailPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
  const session = await requireRole("SUPERVISOR");
  const { presentationId } = await params;
  const id = Number(presentationId);

  if (!Number.isInteger(id)) notFound();

  const presentation = await prisma.presentation.findUnique({
    where: { id },
    include: {
      proposal: {
        select: {
          title: true,
          description: true,
          application: {
            select: {
              fullName: true,
              degreeProgram: true,
              nic: true,
            },
          },
          supervisors: {
            select: {
              supervisor: { select: { name: true, id: true } },
              isMain: true,
              status: true,
            },
          },
          progressReports: {
            select: {
              id: true,
              title: true,
              submittedAt: true,
              reviews: {
                select: {
                  status: true,
                  comment: true,
                  supervisor: { select: { name: true } },
                  reviewedAt: true,
                },
              },
            },
            orderBy: { submittedAt: "desc" },
            take: 3,
          },
        },
      },
    },
  });

  if (!presentation) notFound();

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!supervisor) notFound();

  // Verify supervisor is assigned to this proposal
  const isAssigned = presentation.proposal.supervisors.some((s) => s.supervisor.id === supervisor.id);
  if (!isAssigned) notFound();

  const student = presentation.proposal.application;
  const proposal = presentation.proposal;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/supervisor/presentations"
          className="text-sm text-neutral-500 underline"
        >
          ← Back to presentations
        </Link>
      </div>
      <PageHeader
        title={`Presentation — ${student.fullName}`}
        subtitle={`Scheduled for ${new Date(presentation.presentationDate).toLocaleDateString()}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Student Info */}
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Student Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Name</span>
                <span className="font-medium text-black">{student.fullName}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-neutral-500">NIC</span>
                <span className="font-medium text-black">{student.nic}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-neutral-500">Degree Program</span>
                <span className="font-medium text-black">{student.degreeProgram}</span>
              </div>
            </div>
          </div>

          {/* Proposal Info */}
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Research Proposal</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-500">Title</p>
                <p className="font-medium text-black">{proposal.title}</p>
              </div>
              <div>
                <p className="text-neutral-500">Description</p>
                <p className="text-neutral-700">{proposal.description || "No description provided"}</p>
              </div>
            </div>
          </div>

          {/* Presentation Details */}
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Presentation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Date & Time</span>
                <span className="font-medium text-black">
                  {new Date(presentation.presentationDate).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-neutral-500">Venue</span>
                <span className="font-medium text-black">
                  {presentation.venue || "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-neutral-500">Status</span>
                <span
                  className={`font-medium ${
                    presentation.outcome === "RECOMMENDED"
                      ? "text-green-700"
                      : presentation.outcome === "NOT_RECOMMENDED"
                        ? "text-red-700"
                        : presentation.isDone
                          ? "text-yellow-700"
                          : "text-blue-700"
                  }`}
                >
                  {presentation.outcome === "RECOMMENDED"
                    ? "Recommended"
                    : presentation.outcome === "NOT_RECOMMENDED"
                      ? "Not recommended"
                      : presentation.isDone
                        ? "Completed"
                        : "Scheduled"}
                </span>
              </div>
            </div>
          </div>

          {/* All Supervisors */}
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Supervisors</h3>
            <div className="space-y-2">
              {proposal.supervisors.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-black">{s.supervisor.name}</p>
                    <p className="text-xs text-neutral-500">
                      {s.isMain ? "Main Supervisor" : "Co-Supervisor"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Progress Reports */}
          {proposal.progressReports.length > 0 && (
            <div className="rounded-lg border border-border bg-white p-4">
              <h3 className="mb-3 text-base font-bold text-black">Recent Progress Reports</h3>
              <div className="space-y-3">
                {proposal.progressReports.map((report) => (
                  <div key={report.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-black">{report.title}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(report.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {report.reviews.length > 0 && (
                      <div className="mt-2 space-y-1 text-sm">
                        {report.reviews.map((review, idx) => (
                          <div key={idx} className="rounded bg-neutral-50 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-600">{review.supervisor?.name}</span>
                              <span
                                className={`text-xs font-semibold ${
                                  review.status === "APPROVED"
                                    ? "text-green-700"
                                    : review.status === "REJECTED"
                                      ? "text-red-700"
                                      : "text-gray-700"
                                }`}
                              >
                                {review.status}
                              </span>
                            </div>
                            {review.comment && (
                              <p className="mt-1 text-xs text-neutral-600">&ldquo;{review.comment}&rdquo;</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-1">
          <MarkPresentationCompleteForm
            presentationId={id}
            isDone={presentation.isDone}
          />
        </div>
      </div>
    </>
  );
}
