import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/charts";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PresentationRow = {
  id: number;
  title: string;
  presentationDate: Date;
  isDone: boolean;
  isFinal: boolean;
  proposal: {
    title: string;
    application: { fullName: string; degreeProgram: string | null; faculty: string | null };
    supervisors: { supervisor: { name: string } }[];
  };
};

function Row({ presentation }: { presentation: PresentationRow }) {
  const app = presentation.proposal.application;
  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3 font-medium text-black">
        {app.fullName}
        <div className="text-xs text-neutral-500">
          {app.faculty ?? "—"} · {app.degreeProgram ?? "—"}
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-600">
        {presentation.title || presentation.proposal.title}
        <div className="text-xs text-neutral-500">
          {presentation.proposal.supervisors
            .map((s) => s.supervisor.name)
            .join(", ") || "—"}
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-600">{fmt(presentation.presentationDate)}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            presentation.isFinal
              ? "bg-green-100 text-green-800"
              : presentation.isDone
                ? "bg-yellow-100 text-yellow-800"
                : "bg-blue-100 text-blue-800"
          }`}
        >
          {presentation.isFinal
            ? "Approved"
            : presentation.isDone
              ? "Completed — awaiting approval"
              : "Scheduled"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/registrar/presentations/${presentation.id}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-black hover:border-brand"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function Table({ rows, empty }: { rows: PresentationRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-neutral-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-semibold">Student</th>
            <th className="px-4 py-2 font-semibold">Presentation</th>
            <th className="px-4 py-2 font-semibold">Date &amp; time</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Row key={p.id} presentation={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SELECT = {
  id: true,
  title: true,
  presentationDate: true,
  isDone: true,
  isFinal: true,
  proposal: {
    select: {
      title: true,
      application: {
        select: { fullName: true, degreeProgram: true, faculty: true },
      },
      supervisors: { select: { supervisor: { select: { name: true } } } },
    },
  },
};

export default async function AdminPresentationsPage() {
  await requireRole("MAIN_ADMIN");

  const presentations = await prisma.presentation.findMany({
    orderBy: { presentationDate: "desc" },
    select: SELECT,
  });

  const completed = presentations.filter((p: { isDone: boolean }) => p.isDone);
  const approved = completed.filter((p: { isFinal: boolean }) => p.isFinal);
  const awaitingApproval = completed.filter((p: { isFinal: boolean }) => !p.isFinal);
  const scheduled = presentations.filter((p: { isDone: boolean }) => !p.isDone);

  return (
    <>
      <PageHeader
        title="Presentations"
        subtitle="Every research presentation across all faculties — scheduled, completed and approved."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Scheduled"
          value={scheduled.length}
          hint="Not yet presented"
          accent="from-sky-500 to-cyan-500"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          hint={`${awaitingApproval.length} awaiting approval`}
          accent="from-amber-500 to-orange-500"
        />
        <StatCard
          label="Approved"
          value={approved.length}
          hint="Students registered"
          accent="from-emerald-500 to-teal-500"
        />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold text-black">Completed presentations</h2>
        <Table
          rows={completed}
          empty="No completed presentations yet."
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold text-black">Scheduled presentations</h2>
        <Table rows={scheduled} empty="No presentations have been scheduled yet." />
      </section>
    </>
  );
}
