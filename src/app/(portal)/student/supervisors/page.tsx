import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, PlaceholderCard } from "@/components/page-header";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const REVIEW_STYLES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  PENDING: "bg-amber-100 text-amber-700",
};

export default async function StudentSupervisorsPage() {
  const session = await requireRole("STUDENT");

  // Latest application regardless of status, so supervisors (and the message
  // box) are available as soon as the student has proposed them.
  const app = await prisma.applicationPostGraduate.findFirst({
    where: { userId: session.userId },
    orderBy: { id: "desc" },
    select: {
      researchProposals: {
        take: 1,
        orderBy: { id: "desc" },
        select: {
          supervisors: {
            orderBy: { isMain: "desc" },
            select: {
              isMain: true,
              supervisor: {
                select: {
                  id: true,
                  name: true,
                  title: true,
                  university: true,
                  telephone: true,
                  userId: true,
                  approvalStatus: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
          progressReports: {
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              title: true,
              submittedAt: true,
              reviews: {
                select: {
                  status: true,
                  comment: true,
                  reviewedAt: true,
                  supervisorId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const proposal = app?.researchProposals[0];

  if (!proposal || proposal.supervisors.length === 0) {
    return (
      <>
        <PageHeader title="Supervisors" subtitle="Your assigned supervisors" />
        <PlaceholderCard>
          Your supervisors will appear here once you have proposed them in your
          application.
        </PlaceholderCard>
      </>
    );
  }

  const reports = proposal.progressReports;

  return (
    <>
      <PageHeader
        title="Supervisors"
        subtitle="Your assigned supervisors and their review activity."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {proposal.supervisors.map((link) => {
          const sup = link.supervisor;
          // This supervisor's review on each submitted report.
          const activity = reports.map((r) => {
            const rv = r.reviews.find((x) => x.supervisorId === sup.id);
            return {
              reportId: r.id,
              title: r.title,
              submittedAt: r.submittedAt,
              status: rv?.status ?? "PENDING",
              comment: rv?.comment ?? null,
              reviewedAt: rv?.reviewedAt ?? null,
            };
          });
          const reviewedCount = activity.filter((a) => a.status !== "PENDING").length;

          return (
            <div
              key={sup.id}
              className="card-shadow flex flex-col rounded-2xl border border-border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {[sup.title, sup.name].filter(Boolean).join(" ")}
                  </p>
                  {sup.university && (
                    <p className="text-sm text-neutral-600">{sup.university}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    link.isMain ? "bg-brand-light text-brand-dark" : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {link.isMain ? "Main supervisor" : "Co-supervisor"}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-neutral-700">
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  {sup.user?.email ? (
                    <a href={`mailto:${sup.user.email}`} className="text-brand-dark underline">
                      {sup.user.email}
                    </a>
                  ) : (
                    <span className="text-neutral-400">Email not available yet</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-neutral-700">
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
                  </svg>
                  {sup.telephone ? (
                    <a href={`tel:${sup.telephone}`} className="text-brand-dark underline">
                      {sup.telephone}
                    </a>
                  ) : (
                    <span className="text-neutral-400">Phone not available</span>
                  )}
                </div>
              </div>

              {/* Requirement: student ↔ supervisor communication */}
              <div className="mt-4 flex flex-wrap gap-2">
                {sup.userId && sup.approvalStatus === "APPROVED" ? (
                  <Link
                    href={`/student/messages?supervisor=${sup.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Message supervisor
                  </Link>
                ) : sup.user?.email ? (
                  <a
                    href={`mailto:${sup.user.email}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-brand px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-light"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    Email supervisor
                  </a>
                ) : (
                  <span className="rounded-md bg-muted px-3 py-1.5 text-sm text-neutral-500">
                    Contact details not available yet
                  </span>
                )}
                <Link
                  href="/student/messages"
                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-black hover:border-brand"
                >
                  Open message box
                </Link>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Review activity · {reviewedCount}/{reports.length} reviewed
                </p>
                {activity.length === 0 ? (
                  <p className="text-sm text-neutral-500">No reports submitted yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activity.map((a) => (
                      <div key={a.reportId} className="rounded-lg bg-muted px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-neutral-700">{a.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REVIEW_STYLES[a.status]}`}
                          >
                            {a.status === "PENDING" ? "Not reviewed" : a.status}
                          </span>
                        </div>
                        {a.comment && (
                          <p className="mt-1 text-xs text-neutral-600">{a.comment}</p>
                        )}
                        {a.reviewedAt && (
                          <p className="mt-0.5 text-[11px] text-neutral-400">
                            Reviewed {fmt(a.reviewedAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
