import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatCard, ChartCard, DonutChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function FacultyAdminDashboard() {
  const session = await requireRole("FACULTY_ADMIN");

  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { faculty: true },
  });
  const faculty = profile?.faculty ?? undefined;

  const where = faculty ? { faculty } : {};
  const [active, approved, rejected, openCorrections, awaitingFaculty] =
    await Promise.all([
      prisma.applicationPostGraduate.count({
        where: { ...where, status: "ACTIVE" },
      }),
      prisma.applicationPostGraduate.count({
        where: { ...where, status: "APPROVED" },
      }),
      prisma.applicationPostGraduate.count({
        where: { ...where, status: "REJECTED" },
      }),
      // Corrections the faculty admin has raised that the student still owes.
      prisma.correctionRequest.count({
        where: { status: "OPEN", application: where },
      }),
      // Progress reports the supervisors have cleared, waiting on the faculty.
      prisma.progressReport.count({
        where: {
          facultyStatus: "PENDING",
          completedAt: { not: null },
          proposal: { application: where },
        },
      }),
    ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        subtitle={
          faculty
            ? `Faculty Admin — ${faculty}: check applications, communicate corrections to students and endorse progress reports.`
            : "Faculty Admin — check applications, communicate corrections to students and endorse progress reports."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Awaiting sign-off"
          value={active}
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          label="Approved"
          value={approved}
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          label="Rejected"
          value={rejected}
          accent="from-rose-500 to-pink-500"
        />
        <StatCard
          label="Open corrections"
          value={openCorrections}
          hint="Sent to students, not yet fixed"
          accent="from-fuchsia-500 to-purple-500"
        />
        <StatCard
          label="Progress to endorse"
          value={awaitingFaculty}
          hint="Cleared by supervisors"
          accent="from-indigo-500 to-violet-500"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Faculty applications"
          subtitle={faculty ?? "All faculties"}
        >
          <DonutChart
            centerLabel="Applications"
            data={[
              { label: "Awaiting", value: active, color: "#f59e0b" },
              { label: "Approved", value: approved, color: "#10b981" },
              { label: "Rejected", value: rejected, color: "#f43f5e" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Quick actions" subtitle="Faculty review tasks">
          <div className="space-y-3">
            <Link
              href="/faculty-admin/applications"
              className="block rounded-xl border border-border bg-brand-light/40 px-4 py-3 text-sm font-semibold text-brand-dark transition hover:bg-brand hover:text-white"
            >
              Review applications &amp; raise corrections →
            </Link>
            <Link
              href="/faculty-admin/progress"
              className="block rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-muted"
            >
              Endorse student progress →
            </Link>
            <Link
              href="/faculty-admin/rejected"
              className="block rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-muted"
            >
              View rejected →
            </Link>
          </div>
        </ChartCard>
      </div>
    </>
  );
}
