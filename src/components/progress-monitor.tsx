"use client";

import { useMemo, useState } from "react";
import type {
  StudentProgressRow,
  SupervisorReviewStatus,
} from "@/lib/admin-progress";
import { reviewProgressStage } from "@/lib/progress-actions";
import { ESCALATION_LABEL, ESCALATION_STYLE } from "@/lib/status-labels";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const REVIEW_STYLES: Record<SupervisorReviewStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  PENDING: "bg-amber-100 text-amber-700",
};

function presentationBadge(p: StudentProgressRow["presentation"]) {
  if (!p) return { label: "Not scheduled", cls: "bg-neutral-100 text-neutral-500" };
  if (p.isFinal) return { label: "Approved", cls: "bg-emerald-100 text-emerald-700" };
  if (p.isDone) return { label: "Completed", cls: "bg-sky-100 text-sky-700" };
  return { label: "Scheduled", cls: "bg-amber-100 text-amber-700" };
}

const STAGE_LABEL = {
  supervisor: "Awaiting supervisors",
  faculty: "Awaiting Faculty Admin",
  admin: "Awaiting Main Admin",
  complete: "Signed off",
} as const;

const STAGE_STYLE = {
  supervisor: "bg-amber-100 text-amber-700",
  faculty: "bg-sky-100 text-sky-700",
  admin: "bg-violet-100 text-violet-700",
  complete: "bg-emerald-100 text-emerald-700",
} as const;

/** Supervisor → Faculty → Admin chain indicator for one report. */
function EscalationChain({ report }: { report: StudentProgressRow["reports"][number] }) {
  const steps = [
    {
      key: "supervisor",
      label: "Supervisor",
      done: report.allApproved,
      badge: report.allApproved ? "Approved" : "Pending",
      style: report.allApproved
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700",
    },
    {
      key: "faculty",
      label: "Faculty",
      done: report.facultyStatus === "APPROVED",
      badge: ESCALATION_LABEL[report.facultyStatus] ?? report.facultyStatus,
      style: ESCALATION_STYLE[report.facultyStatus] ?? "bg-neutral-100 text-neutral-600",
    },
    {
      key: "admin",
      label: "Admin",
      done: report.adminStatus === "APPROVED",
      badge: ESCALATION_LABEL[report.adminStatus] ?? report.adminStatus,
      style: ESCALATION_STYLE[report.adminStatus] ?? "bg-neutral-100 text-neutral-600",
    },
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-neutral-300">→</span>}
          <span className="text-[11px] font-medium text-neutral-500">{s.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.style}`}>
            {s.badge}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Faculty / Main Admin decision on a report that has reached their stage. */
function StageReviewForm({
  progressId,
  stage,
}: {
  progressId: number;
  stage: "FACULTY" | "ADMIN";
}) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(decision: "APPROVED" | "RETURNED") {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("progressId", String(progressId));
      fd.set("stage", stage);
      fd.set("decision", decision);
      fd.set("comment", comment);
      const res = await reviewProgressStage(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(decision === "APPROVED" ? "Endorsed" : "Returned to the student");
    } catch {
      setError("Could not save the review. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="mt-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
        {done}. The student and supervisors have been notified.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-brand bg-brand-light/40 p-2.5">
      <p className="text-xs font-semibold text-brand-dark">
        {stage === "FACULTY"
          ? "Faculty review — endorse to forward to the Main Admin, or return it to the student."
          : "Admin sign-off — final stage of the Supervisor → Faculty → Admin chain."}
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
      />
      {error && <p className="text-xs text-black">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("APPROVED")}
          className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : stage === "FACULTY" ? "Endorse & forward" : "Sign off"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("RETURNED")}
          className="rounded-md border border-border bg-white px-3 py-1 text-xs font-semibold text-black hover:border-brand disabled:opacity-50"
        >
          Return to student
        </button>
      </div>
    </div>
  );
}

export function ProgressMonitor({
  students,
  showFaculty,
  reviewStage,
}: {
  students: StudentProgressRow[];
  showFaculty?: boolean;
  /** When set, reports waiting on that stage get an inline decision form. */
  reviewStage?: "FACULTY" | "ADMIN" | null;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        (s.proposalTitle ?? "").toLowerCase().includes(q) ||
        s.supervisorNames.some((n) => n.toLowerCase().includes(q)),
    );
  }, [students, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <svg
          className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student, proposal or supervisor…"
          className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-sm text-neutral-500">
          {students.length === 0
            ? "No registered students with proposals yet."
            : "No students match your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const open = openId === s.applicationId;
            const pres = presentationBadge(s.presentation);
            const waitingOnYou =
              reviewStage &&
              s.reports.some(
                (r) =>
                  (reviewStage === "FACULTY" && r.stage === "faculty") ||
                  (reviewStage === "ADMIN" && r.stage === "admin"),
              );
            return (
              <div
                key={s.applicationId}
                className={`card-shadow rounded-2xl border bg-white p-4 ${
                  waitingOnYou ? "border-brand" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {s.studentName}
                      {s.registrationNumber && (
                        <span className="ml-2 rounded bg-brand-light px-1.5 py-0.5 text-[11px] font-semibold text-brand-dark">
                          {s.registrationNumber}
                        </span>
                      )}
                      {waitingOnYou && (
                        <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          Needs your review
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-neutral-600">
                      {s.proposalTitle ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {showFaculty && s.faculty ? `${s.faculty} · ` : ""}
                      {s.degreeProgram ?? ""}
                      {s.supervisorNames.length > 0
                        ? ` · ${s.supervisorNames.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pres.cls}`}>
                      Presentation: {pres.label}
                    </span>
                    {s.presentation && (
                      <span className="text-xs text-neutral-500">{fmt(s.presentation.date)}</span>
                    )}
                    <span className="text-xs text-neutral-500">
                      {s.reports.length} report{s.reports.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.applicationId)}
                  className="mt-3 rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
                >
                  {open ? "Hide details" : "Details"}
                </button>

                {open && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    {s.reports.length === 0 ? (
                      <p className="text-sm text-neutral-500">
                        No progress reports submitted yet.
                      </p>
                    ) : (
                      s.reports.map((r) => (
                        <div key={r.id} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{r.title}</p>
                              <p className="text-xs text-neutral-500">
                                Submitted {fmt(r.submittedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLE[r.stage]}`}
                              >
                                {STAGE_LABEL[r.stage]}
                              </span>
                              {r.filePath && (
                                <a
                                  href={`/api/files?path=${encodeURIComponent(r.filePath)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-brand-dark underline"
                                >
                                  View report
                                </a>
                              )}
                            </div>
                          </div>

                          <EscalationChain report={r} />

                          <div className="mt-3 space-y-1.5">
                            {r.supervisors.map((sup, i) => (
                              <div
                                key={i}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5"
                              >
                                <span className="text-sm text-neutral-700">
                                  {sup.supervisorName}
                                  {sup.isMain && (
                                    <span className="ml-1 text-xs text-brand-dark">(Main)</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {sup.reviewedAt && (
                                    <span className="text-[11px] text-neutral-400">
                                      {fmt(sup.reviewedAt)}
                                    </span>
                                  )}
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REVIEW_STYLES[sup.status]}`}
                                  >
                                    {sup.status === "PENDING" ? "Not reviewed" : sup.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {r.supervisors.some((sup) => sup.comment) && (
                            <div className="mt-2 space-y-1">
                              {r.supervisors
                                .filter((sup) => sup.comment)
                                .map((sup, i) => (
                                  <p key={i} className="text-xs text-neutral-600">
                                    <span className="font-semibold">{sup.supervisorName}:</span>{" "}
                                    {sup.comment}
                                  </p>
                                ))}
                            </div>
                          )}

                          {(r.facultyComment || r.adminComment) && (
                            <div className="mt-2 space-y-1">
                              {r.facultyComment && (
                                <p className="text-xs text-neutral-600">
                                  <span className="font-semibold">Faculty Admin:</span>{" "}
                                  {r.facultyComment}
                                  {r.facultyReviewedAt && (
                                    <span className="ml-1 text-neutral-400">
                                      ({fmt(r.facultyReviewedAt)})
                                    </span>
                                  )}
                                </p>
                              )}
                              {r.adminComment && (
                                <p className="text-xs text-neutral-600">
                                  <span className="font-semibold">Main Admin:</span>{" "}
                                  {r.adminComment}
                                  {r.adminReviewedAt && (
                                    <span className="ml-1 text-neutral-400">
                                      ({fmt(r.adminReviewedAt)})
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}

                          {reviewStage === "FACULTY" && r.stage === "faculty" && (
                            <StageReviewForm progressId={r.id} stage="FACULTY" />
                          )}
                          {reviewStage === "ADMIN" && r.stage === "admin" && (
                            <StageReviewForm progressId={r.id} stage="ADMIN" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
