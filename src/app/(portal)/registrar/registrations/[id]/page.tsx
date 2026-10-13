import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationReviewPacket } from "@/lib/review";
import { PageHeader } from "@/components/page-header";
import { ApplicationReview } from "@/components/application-review";
import { ResetPassword } from "./reset-password";

export const dynamic = "force-dynamic";

/**
 * One registration, opened from "New Registrations".
 *
 * The old Decision block (approve / reject straight from the queue) has been
 * removed: the outcome is decided by the presentation review, and this page is
 * for checking the uploaded information, requesting recorrections and informing
 * the student.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("REGISTRAR");
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const packet = await getApplicationReviewPacket(appId);
  if (!packet) notFound();

  const presentation = await prisma.presentation.findFirst({
    where: { proposal: { applicationId: appId } },
    orderBy: { presentationDate: "desc" },
    select: { id: true, presentationDate: true, isDone: true, isFinal: true },
  });

  const credentials = await prisma.applicationPostGraduate.findUnique({
    where: { id: appId },
    select: {
      status: true,
      user: {
        select: { email: true, initialPassword: true, mustChangePassword: true },
      },
    },
  });

  return (
    <>
      <div className="mb-4">
        <Link
          href="/registrar/registrations"
          className="text-sm text-neutral-500 underline"
        >
          ← Back to queue
        </Link>
      </div>
      <PageHeader
        title={packet.fullName}
        subtitle={`Application #${packet.id} · check the uploaded information, then inform the student.`}
      />

      <ApplicationReview packet={packet} />

      {/* Next step in the registration flow */}
      <div className="mt-6 rounded-lg border border-border bg-white p-4">
        <h3 className="text-base font-bold text-black">Presentation</h3>
        {presentation ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              Scheduled for{" "}
              <strong className="text-black">
                {presentation.presentationDate.toLocaleString()}
              </strong>{" "}
              ·{" "}
              {presentation.isFinal
                ? "Approved — student registered"
                : presentation.isDone
                  ? "Completed — awaiting your approval"
                  : "Not yet presented"}
            </p>
            <Link
              href={`/registrar/presentations/${presentation.id}`}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Open presentation
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              No presentation has been scheduled yet. Assign a date once the
              requirements above are met — the student account is created when
              the presentation result is approved.
            </p>
            <Link
              href={`/registrar/presentations/assign/${appId}`}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Schedule presentation date
            </Link>
          </div>
        )}
      </div>

      {/* Approved: relay the credentials */}
      {credentials?.status === "APPROVED" && (
        <div className="mt-4 rounded-lg border border-brand bg-neutral-50 p-4">
          <h3 className="text-base font-bold text-black">
            Approved — student login credentials
          </h3>
          {credentials.user ? (
            credentials.user.mustChangePassword ? (
              <div className="mt-2 space-y-1 text-sm text-black">
                <p>
                  Email: <span className="font-mono">{credentials.user.email}</span>
                </p>
                <p>
                  Temporary password:{" "}
                  <span className="font-mono">
                    {credentials.user.initialPassword ?? "(unavailable)"}
                  </span>
                </p>
                <p className="text-xs text-neutral-600">
                  Share these with the student. They disappear once the student
                  signs in and changes their password.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                The student has signed in and changed their password.
              </p>
            )
          ) : (
            <p className="mt-2 text-sm text-neutral-600">No account on record.</p>
          )}
          {credentials.user && <ResetPassword applicationId={appId} />}
        </div>
      )}
    </>
  );
}
