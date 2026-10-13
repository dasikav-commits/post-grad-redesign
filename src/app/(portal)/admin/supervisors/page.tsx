import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SupervisorManager, type SupervisorRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function SupervisorsPage() {
  await requireRole("MAIN_ADMIN");

  const [supervisors, faculties] = await Promise.all([
    prisma.supervisorProfile.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        university: true,
        telephone: true,
        facultyId: true,
        facultyRef: { select: { name: true } },
        userId: true,
        approvalStatus: true,
        approvalNote: true,
        approvedAt: true,
        user: { select: { email: true, initialPassword: true, mustChangePassword: true } },
        _count: { select: { proposals: true } },
      },
    }),
    prisma.faculty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: SupervisorRow[] = supervisors.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    university: s.university,
    telephone: s.telephone,
    facultyId: s.facultyId,
    facultyName: s.facultyRef?.name ?? null,
    hasAccount: s.userId != null,
    approvalStatus: s.approvalStatus,
    approvalNote: s.approvalNote,
    approvedAt: s.approvedAt,
    email: s.user?.email,
    initialPassword: s.user?.initialPassword,
    mustChangePassword: s.user?.mustChangePassword,
    usageCount: s._count.proposals,
  }));

  return (
    <>
      <PageHeader
        title="Supervisors"
        subtitle="Maintain the list of supervisors students can select during registration, and approve their portal access."
      />
      <SupervisorManager supervisors={rows} faculties={faculties} />
    </>
  );
}
