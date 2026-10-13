import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getStudentApplication } from "@/lib/student";
import { unreadCount, unreadMessageCount } from "@/lib/notify";
import { progressSchedule, windowStatus } from "@/lib/progress";
import { PageHeader, PlaceholderCard } from "@/components/page-header";
import { ProgressRing, StatCard, ChartCard } from "@/components/charts";

export const dynamic = "force-dynamic";

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-medium text-foreground">{v || "—"}</span>
    </div>
  );
}

export default async function StudentDashboard() {
  const session = await requireRole("STUDENT");
  const app = await getStudentApplication(session.userId);

  if (!app) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${session.fullName}`}
          subtitle="Student dashboard"
        />
        <PlaceholderCard>
          Your approved application details are not available yet.
        </PlaceholderCard>
      </>
    );
  }

  const proposal = app.researchProposals[0];
  const level = proposal?.degreeSought.level ?? "OTHER";
  const schedule = progressSchedule(level, app.studyMode, app.programStartYear);

  const submittedKeys = new Set(
    (proposal?.progressReports ?? [])
      .map((r) => r.periodKey)
      .filter((k): k is string => Boolean(k)),
  );
  const now = new Date();
  const submittedCount = schedule.filter((w) =>
    submittedKeys.has(w.periodKey),
  ).length;
  const openNow = schedule.filter(
    (w) => windowStatus(w, now, submittedKeys) === "open",
  );
  const main = proposal?.supervisors.find((s) => s.isMain)?.supervisor;
  const co = (proposal?.supervisors ?? []).filter((s) => !s.isMain);

  // What is waiting for the student: corrections, messages, notifications.
  const [openCorrections, unreadMessages, unreadNotifications] = await Promise.all([
    prisma.correctionRequest.count({
      where: { status: "OPEN", application: { userId: session.userId } },
    }),
    unreadMessageCount(session.userId, null),
    unreadCount(session.userId, null),
  ]);

  return (
    <>
      {openCorrections > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-black">
            {openCorrections} correction{openCorrections === 1 ? "" : "s"} need your
            attention
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            A reviewer asked you to fix something in your application.{" "}
            <Link href="/student/corrections" className="font-semibold text-brand underline">
              Open Corrections →
            </Link>
          </p>
        </div>
      )}

      <PageHeader
        title={`Welcome, ${session.fullName}`}
        subtitle="Your programme, supervisors and progress-report schedule."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Research progress"
          subtitle="Progress reports submitted"
          className="flex flex-col items-center justify-center"
        >
          <ProgressRing
            value={submittedCount}
            total={schedule.length || 1}
            label={`${submittedCount}/${schedule.length}`}
          />
        </ChartCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <StatCard
            label="Reports required"
            value={schedule.length}
            accent="from-indigo-500 to-violet-500"
          />
          <StatCard
            label="Submitted"
            value={submittedCount}
            accent="from-emerald-500 to-teal-500"
          />
          <StatCard
            label="Open windows"
            value={openNow.length}
            accent="from-amber-500 to-orange-500"
          />
          <StatCard
            label="Remaining"
            value={Math.max(0, schedule.length - submittedCount)}
            accent="from-sky-500 to-cyan-500"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Programme">
          <Field k="Faculty" v={app.faculty} />
          <Field k="Degree" v={app.degreeProgram} />
          <Field
            k="Study mode"
            v={
              app.studyMode === "FULL_TIME"
                ? "Full time"
                : app.studyMode === "PART_TIME"
                  ? "Part time"
                  : "—"
            }
          />
          <Field
            k="Duration"
            v={app.durationYears ? `${app.durationYears} years` : "—"}
          />
          <Field k="Start year" v={app.programStartYear} />
        </ChartCard>

        <ChartCard title="Research & supervisors">
          <Field k="Proposal" v={proposal?.title} />
          <Field k="Main supervisor" v={main?.name} />
          <Field
            k="Co-supervisors"
            v={co.length ? co.map((s) => s.supervisor.name).join(", ") : "—"}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Progress reports">
          {openNow.length > 0 ? (
            <p className="text-sm text-foreground">
              You have a report window open:{" "}
              <strong>{openNow.map((w) => w.label).join(", ")}</strong>.{" "}
              <Link
                href="/student/progress"
                className="font-semibold text-brand underline"
              >
                Submit now →
              </Link>
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              No window is open right now.{" "}
              <Link
                href="/student/progress"
                className="font-semibold text-brand underline"
              >
                View full schedule →
              </Link>
            </p>
          )}
        </ChartCard>

        <ChartCard title="Presentations">
          <p className="text-sm text-neutral-600">
            Your presentation will be scheduled by the Registrar after your
            application is approved.{" "}
            <Link
              href="/student/presentations"
              className="font-semibold text-brand underline"
            >
              View presentation schedule →
            </Link>
          </p>
        </ChartCard>
      </div>

      {/* Everything the student can act on */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "/student/requirements",
            label: "Requirements",
            hint: "See the 13 registration requirements",
          },
          {
            href: "/student/corrections",
            label: "Corrections",
            hint:
              openCorrections > 0
                ? `${openCorrections} waiting for your reply`
                : "Nothing outstanding",
          },
          {
            href: "/student/messages",
            label: "Messages",
            hint:
              unreadMessages > 0
                ? `${unreadMessages} unread from your supervisors`
                : "Message your supervisors",
          },
          {
            href: "/student/notifications",
            label: "Notifications",
            hint:
              unreadNotifications > 0
                ? `${unreadNotifications} unread from your faculty`
                : "Faculty & admin notices",
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-border bg-white p-4 transition hover:border-brand"
          >
            <p className="text-sm font-bold text-black">{c.label}</p>
            <p className="mt-1 text-xs text-neutral-600">{c.hint}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
