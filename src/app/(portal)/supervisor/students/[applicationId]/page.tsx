import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationReviewPacket } from "@/lib/review";
import { PageHeader } from "@/components/page-header";
import { ApplicationReview } from "@/components/application-review";

export const dynamic = "force-dynamic";

/**
 * Supervisor dossier: the full application review packet for one of the
 * supervisor's own students (read-only — the verification/correction panel is
 * a staff-only control and stays hidden here).
 */
export default async function SupervisorStudentDossierPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await requireRole("SUPERVISOR");
  const { applicationId } = await params;
  const appId = Number(applicationId);
  if (!Number.isInteger(appId)) notFound();

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!supervisor) notFound();

  // The supervisor must be linked to this application through a proposal.
  const linked = await prisma.researchProposal.findFirst({
    where: {
      applicationId: appId,
      supervisors: { some: { supervisorId: supervisor.id } },
    },
    select: { id: true },
  });
  if (!linked) notFound();

  const packet = await getApplicationReviewPacket(appId);
  if (!packet) notFound();

  return (
    <>
      <div className="mb-4">
        <Link href="/supervisor/students" className="text-sm text-neutral-500 underline">
          ← Back to my students
        </Link>
      </div>
      <PageHeader
        title={`Student dossier — ${packet.fullName}`}
        subtitle={`Application #${packet.id} · programme details, verification history and corrections.`}
      />
      <ApplicationReview packet={packet} showPanel={false} supervisorView />
    </>
  );
}
