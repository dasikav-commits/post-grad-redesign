import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { PresentationReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export default async function PresentationDetailPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
  await requireRole("REGISTRAR");
  const { presentationId } = await params;
  const id = Number(presentationId);

  if (!Number.isInteger(id)) notFound();

  const presentation = await prisma.presentation.findUnique({
    where: { id },
    include: {
      proposal: {
        select: {
          applicationId: true,
          title: true,
          description: true,
          application: {
            select: {
              id: true,
              fullName: true,
              degreeProgram: true,
              nic: true,
              status: true,
            },
          },
          supervisors: {
            select: {
              supervisor: { select: { name: true } },
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
            take: 5,
          },
        },
      },
    },
  });

  if (!presentation) notFound();

  const student = presentation.proposal.application;
  const proposal = presentation.proposal;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/registrar/presentations"
          className="text-sm text-neutral-500 underline"
        >
          ← Back to presentations
        </Link>
      </div>
      <PageHeader
        title={`Presentation Review — ${student.fullName}`}
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
                <p className="text-neutral-700">{proposal.description || "—"}</p>
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
                <span className="text-neutral-500">Status</span>
                <span
                  className={`font-medium ${
                    presentation.isFinal
                      ? "text-green-700"
                      : presentation.isDone
                        ? "text-yellow-700"
                        : "text-blue-700"
                  }`}
                >
                  {presentation.isFinal
                    ? "Approved"
                    : presentation.isDone
                      ? "Completed"
                      : "Scheduled"}
                </span>
              </div>
            </div>
          </div>

          {/* Supervisors */}
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
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      s.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : s.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {s.status}
                  </span>
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

        {/* Review Panel */}
        <div className="lg:col-span-1">
          <PresentationReviewForm
            presentationId={id}
            isDone={presentation.isDone}
            isFinal={presentation.isFinal}
            applicationId={student.id}
            applicationStatus={student.status}
          />
        </div>
      </div>
    </>
  );
}
