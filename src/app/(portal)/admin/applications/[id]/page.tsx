import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { getApplicationReviewPacket } from "@/lib/review";
import { PageHeader } from "@/components/page-header";
import { ApplicationReview } from "@/components/application-review";

export const dynamic = "force-dynamic";

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("MAIN_ADMIN");
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const packet = await getApplicationReviewPacket(applicationId);
  if (!packet) {
    return (
      <>
        <PageHeader title="Application not found" />
        <Link href="/admin/applications" className="text-sm text-brand underline">
          ← Back to applications
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/applications" className="text-sm text-neutral-500 underline">
          ← Back to applications
        </Link>
      </div>
      <PageHeader
        title={`Application: ${packet.fullName}`}
        subtitle={`Application #${packet.id} · verify the information the student uploaded, request recorrections and notify the student.`}
      />
      <ApplicationReview packet={packet} />
    </>
  );
}
