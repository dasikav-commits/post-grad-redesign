import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import {
  StatCard,
  ChartCard,
  DonutChart,
  BarChart,
} from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function RegistrarDashboard() {
  const session = await requireRole("REGISTRAR");

  const [active, approved, rejected, apps, pendingPres, donePres, awaitingVerification, openCorrections] =
    await Promise.all([
      prisma.applicationPostGraduate.count({ where: { status: "ACTIVE" } }),
      prisma.applicationPostGraduate.count({ where: { status: "APPROVED" } }),
      prisma.applicationPostGraduate.count({ where: { status: "REJECTED" } }),
      prisma.applicationPostGraduate.findMany({
        select: { registrationDate: true },
      }),
      prisma.presentation.count({ where: { isDone: false } }),
      prisma.presentation.count({ where: { isDone: true } }),
      prisma.applicationPostGraduate.count({
        where: { verificationStatus: { in: ["NOT_VERIFIED", "UNDER_REVIEW"] } },
      }),
      prisma.correctionRequest.count({ where: { status: "OPEN" } }),
    ]);

  const months: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = apps.filter((a) => {
      const rd = new Date(a.registrationDate);
      return (
        rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
      );
    }).length;
    months.push({
      label: d.toLocaleDateString("en", { month: "short" }),
      value: count,
    });
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.fullName}`}
        subtitle="Registrar — the main handler for applications: verify student information and inform applicants. Presentations are handled by the Faculty Admin (shown here read-only)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="New registrations"
          value={active}
          hint="Awaiting review"
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          label="Awaiting verification"
          value={awaitingVerification}
          hint="Information to check"
          accent="from-rose-500 to-pink-500"
        />
        <StatCard
          label="Open corrections"
          value={openCorrections}
          hint="Waiting on the applicant"
          accent="from-fuchsia-500 to-purple-500"
        />
        <StatCard
          label="Approved"
          value={approved}
          hint="Accounts created"
          accent="from-emerald-500 to-teal-500"
        />
        <StatCard
          label="Pending presentations"
          value={pendingPres}
          hint="Read-only — Faculty Admin"
          accent="from-indigo-500 to-violet-500"
        />
        <StatCard
          label="Completed presentations"
          value={donePres}
          hint="Read-only — Faculty Admin"
          accent="from-sky-500 to-cyan-500"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Registration pipeline" subtitle="By status">
          <DonutChart
            centerLabel="Applications"
            data={[
              { label: "New", value: active, color: "#f59e0b" },
              { label: "Approved", value: approved, color: "#10b981" },
              { label: "Rejected", value: rejected, color: "#f43f5e" },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Registrations (last 6 months)"
          subtitle="Incoming volume"
        >
          <BarChart data={months} />
        </ChartCard>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/registrar/registrations"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Review new registrations →
        </Link>
        <Link
          href="/registrar/applications"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          All applications →
        </Link>
        <Link
          href="/registrar/notify"
          className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
        >
          Notify students
        </Link>
        <Link
          href="/registrar/progress"
          className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
        >
          Student progress
        </Link>
      </div>
    </>
  );
}
