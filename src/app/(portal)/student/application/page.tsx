import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { getStudentApplication } from "@/lib/student";
import { PageHeader } from "@/components/page-header";

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-medium text-black">{v || "—"}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 text-base font-bold text-black">{title}</h3>
      {children}
    </div>
  );
}

export default async function Page() {
  const session = await requireRole("STUDENT");
  const app = await getStudentApplication(session.userId);

  if (!app) {
    return (
      <>
        <PageHeader title="My Application" subtitle="Your submitted registration details and current status." />
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-sm text-neutral-500">
          Your approved application information is not available yet.
        </div>
      </>
    );
  }

  const proposal = app.researchProposals[0];
  const mainSupervisor = proposal?.supervisors.find((s) => s.isMain)?.supervisor;
  const coSupervisors = proposal?.supervisors.filter((s) => !s.isMain) ?? [];

  return (
    <>
      <PageHeader
        title="My Application"
        subtitle={`Application #${app.id} · ${app.status}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Programme & personal details">
          <Field k="Full name" v={app.fullName} />
          <Field k="Faculty" v={app.faculty} />
          <Field k="Degree" v={app.degreeProgram} />
          <Field k="Study mode" v={app.studyMode === "FULL_TIME" ? "Full time" : app.studyMode === "PART_TIME" ? "Part time" : "—"} />
          <Field k="Start year" v={app.programStartYear ?? "—"} />
          <Field k="NIC" v={app.nic} />
          <Field k="Email" v={app.emails[0]?.email ?? "—"} />
        </Card>

        <Card title="Research proposal">
          <Field k="Title" v={proposal?.title} />
          <Field k="Objectives" v={proposal?.description} />
          <Field k="Main supervisor" v={mainSupervisor?.name} />
          <Field k="Co-supervisors" v={coSupervisors.length ? coSupervisors.map((s) => s.supervisor.name).join(", ") : "—"} />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Submissions">
          {!proposal || proposal.progressReports.length === 0 ? (
            <p className="text-sm text-neutral-500">No progress reports have been submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {proposal.progressReports.map((report) => (
                <div key={report.id} className="rounded-md border border-border bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-black">{report.title}</p>
                      <p className="text-xs text-neutral-500">
                        Submitted {new Date(report.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {report.reviews[0]?.status ?? "PENDING"}
                    </span>
                  </div>
                  {report.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.files.map((file) => (
                        <a
                          key={file.id}
                          href={`/api/files?path=${encodeURIComponent(file.filePath)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-black underline"
                        >
                          {file.originalFileName}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 text-sm text-neutral-600">
        <Link href="/student/progress" className="underline">
          Manage your progress submissions →
        </Link>
      </div>
    </>
  );
}
