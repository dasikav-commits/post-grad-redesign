import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationReviewPacket } from "@/lib/review";
import { PageHeader } from "@/components/page-header";
import { ApplicationReview } from "@/components/application-review";

export const dynamic = "force-dynamic";

export default async function FacultyAdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("FACULTY_ADMIN");
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) {
    return <NotFound />;
  }

  // Faculty admins only see their own faculty.
  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });
  const packet = await getApplicationReviewPacket(applicationId);

  if (
    !packet ||
    (profile?.faculty && packet.faculty && profile.faculty !== packet.faculty)
  ) {
    return <NotFound />;
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/faculty-admin/applications"
          className="text-sm text-neutral-500 underline"
        >
          ← Back to applications
        </Link>
      </div>
      <PageHeader
        title={`Application: ${packet.fullName}`}
        subtitle={`Application #${packet.id} · communicate errors or corrections straight to the student.`}
      />
      <ApplicationReview packet={packet} />
    </>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Application not found" />
      <Link
        href="/faculty-admin/applications"
        className="text-sm text-brand underline"
      >
        ← Back to applications
      </Link>
    </>
  );
}
