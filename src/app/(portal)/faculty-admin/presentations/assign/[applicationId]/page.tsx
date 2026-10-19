import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AssignPresentationForm } from "./assign-form";

export const dynamic = "force-dynamic";

export default async function AssignPresentationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await requireRole("FACULTY_ADMIN");
  const { applicationId } = await params;
  const appId = Number(applicationId);

  if (!Number.isInteger(appId)) notFound();

  // Faculty admins only assign presentations for their own faculty.
  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: appId },
    select: {
      id: true,
      fullName: true,
      status: true,
      faculty: true,
      degreeProgram: true,
      researchProposals: {
        select: {
          title: true,
          description: true,
          supervisors: {
            select: {
              supervisor: {
                select: { name: true },
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!app) notFound();
  if (profile?.faculty && app.faculty && profile.faculty !== app.faculty) notFound();

  const proposal = app.researchProposals[0];

  return (
    <>
      <div className="mb-4">
        <Link href="/faculty-admin/presentations" className="text-sm text-neutral-500 underline">
          ← Back to presentations
        </Link>
      </div>
      <PageHeader
        title={`Assign Presentation Date — ${app.fullName}`}
        subtitle={`Application #${app.id} · ${app.degreeProgram}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-lg border border-border bg-white p-4">
          <h3 className="mb-4 text-base font-bold text-black">Presentation Details</h3>
          <AssignPresentationForm applicationId={appId} />
        </div>

        {/* Application Summary */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Research Proposal</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-neutral-500">Title</p>
                <p className="font-medium text-black">{proposal?.title || "—"}</p>
              </div>
              <div>
                <p className="text-neutral-500">Description</p>
                <p className="text-neutral-700">{proposal?.description || "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-black">Supervisors</h3>
            <ul className="space-y-2 text-sm">
              {proposal?.supervisors.map((s, idx) => (
                <li key={idx} className="text-neutral-700">
                  {s.supervisor.name}
                </li>
              )) || <li className="text-neutral-500">No supervisors assigned</li>}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              The student and every supervisor are notified (portal + email) with
              the date, time and venue once the presentation is assigned.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
