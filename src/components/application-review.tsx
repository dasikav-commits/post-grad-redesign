import type { ReviewPacket } from "@/lib/review";
import { DOC_CATEGORY } from "@/lib/requirements";
import { RequirementsChecklist } from "@/components/requirements-checklist";
import {
  ResolveCorrectionButton,
  VerificationPanel,
} from "@/components/verification-panel";
import {
  FUNDING_LABEL,
  VERIFICATION_LABEL,
  VERIFICATION_STYLE,
} from "@/lib/status-labels";

/**
 * One shared read-only view of a submitted application, used by the Main Admin,
 * Faculty Admin and Registrar review screens, plus the verification /
 * correction / notification controls.
 */

const CATEGORY_LABEL: Record<string, string> = {
  [DOC_CATEGORY.applicationForm]: "Signed application form",
  [DOC_CATEGORY.cv]: "Curriculum Vitae",
  [DOC_CATEGORY.birthCertificate]: "Birth certificate",
  [DOC_CATEGORY.transcript]: "Academic transcripts",
  [DOC_CATEGORY.refereeReport]: "Referee report",
  [DOC_CATEGORY.budget]: "Budget / funding evidence",
  [DOC_CATEGORY.photo]: "Passport-size photograph",
  [DOC_CATEGORY.paymentReceipt]: "Payment receipt",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

function fmt(d: Date | null | undefined) {
  return d
    ? d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-medium text-black">{v || "—"}</span>
    </div>
  );
}

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-white p-4 ${className}`}>
      {title && <h3 className="mb-2 text-base font-bold text-black">{title}</h3>}
      {children}
    </div>
  );
}

function FileLink({ path, name }: { path: string; name: string }) {
  return (
    <a
      href={`/api/files?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noreferrer"
      className="text-black underline underline-offset-2 hover:text-brand-dark"
    >
      {name}
    </a>
  );
}

export function ApplicationReview({
  packet,
  showPanel = true,
}: {
  packet: ReviewPacket;
  showPanel?: boolean;
}) {
  const proposal = packet.proposal;
  const missingLabels = packet.requirements
    .filter((r) => !r.met)
    .map((r) => r.label);

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[packet.status] ?? "bg-neutral-100 text-neutral-600"}`}
        >
          Registration: {packet.status}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERIFICATION_STYLE[packet.verificationStatus] ?? "bg-neutral-100 text-neutral-600"}`}
        >
          Verification:{" "}
          {VERIFICATION_LABEL[packet.verificationStatus] ?? packet.verificationStatus}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${packet.requirementSummary.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
        >
          Requirements: {packet.requirementSummary.met}/{packet.requirementSummary.total}
        </span>
        {packet.openCorrectionCount > 0 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
            {packet.openCorrectionCount} open correction
            {packet.openCorrectionCount === 1 ? "" : "s"}
          </span>
        )}
        {packet.registrationNumber && (
          <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
            Reg No: {packet.registrationNumber}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Programme & personal details">
          <Field k="Full name" v={packet.fullName} />
          <Field k="Name with initials" v={packet.nameWithInitials} />
          <Field k="NIC" v={packet.nic} />
          <Field k="Date of birth" v={fmt(packet.dateOfBirth)} />
          <Field k="Marital status" v={packet.maritalStatus} />
          <Field k="English proficiency" v={packet.englishProficiency} />
          <Field k="Email" v={packet.emails.join(", ")} />
          <Field
            k="Contacts"
            v={packet.contacts.map((c) => `${c.type}: ${c.value}`).join(" · ")}
          />
          <Field k="Residential address" v={packet.residentialAddress} />
          <Field k="Official address" v={packet.officialAddress} />
        </Card>

        <Card title="Programme applied for">
          <Field k="Faculty" v={packet.faculty} />
          <Field k="Degree" v={packet.degreeProgram} />
          <Field
            k="Study mode"
            v={
              packet.studyMode === "FULL_TIME"
                ? "Full time"
                : packet.studyMode === "PART_TIME"
                  ? "Part time"
                  : null
            }
          />
          <Field
            k="Duration"
            v={packet.durationYears ? `${packet.durationYears} years` : null}
          />
          <Field k="Start year" v={packet.programStartYear} />
          <Field k="Submitted" v={fmt(packet.registrationDate)} />
          <Field
            k="Funding method"
            v={
              packet.fundingMethod
                ? (FUNDING_LABEL[packet.fundingMethod] ?? packet.fundingMethod)
                : null
            }
          />
          <Field k="Funding details" v={packet.fundingDetails} />
          <Field k="Student account" v={packet.studentUserCode ?? "Not created yet"} />
        </Card>
      </div>

      <RequirementsChecklist
        requirements={packet.requirements}
        summary={packet.requirementSummary}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Checklist documents">
          {packet.documents.length === 0 ? (
            <p className="text-sm text-neutral-400">No uploaded documents.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {packet.documents.map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span className="text-neutral-500">
                    {(d.category && CATEGORY_LABEL[d.category]) || d.category || "Document"}
                  </span>
                  <FileLink path={d.filePath} name={d.fileName} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Research proposal">
          <Field k="Title" v={proposal?.title} />
          <Field k="Objectives" v={proposal?.description} />
          <div className="mt-2 space-y-1 text-sm">
            {(proposal?.files ?? []).map((f) => (
              <div key={f.id}>
                <FileLink path={f.filePath} name={f.fileName} />
              </div>
            ))}
          </div>
          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Proposed supervisors
          </p>
          {proposal?.supervisors.length ? (
            <div className="space-y-2">
              {proposal.supervisors.map((s) => (
                <div key={s.id} className="rounded border border-border p-2 text-sm">
                  <p className="font-medium text-black">
                    {[s.title, s.name].filter(Boolean).join(" ")}
                    {s.isMain && (
                      <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        MAIN
                      </span>
                    )}
                  </p>
                  {s.university && (
                    <p className="text-xs text-neutral-500">{s.university}</p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-3 text-xs">
                    {s.cvDocument ? (
                      <FileLink path={s.cvDocument} name="CV" />
                    ) : (
                      <span className="text-amber-700">CV missing</span>
                    )}
                    {s.consentDocument ? (
                      <FileLink path={s.consentDocument} name="Willingness to supervise" />
                    ) : (
                      <span className="text-amber-700">Willingness letter missing</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">None proposed.</p>
          )}
        </Card>

        <Card title="Academic qualifications">
          {packet.academicQualifications.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            packet.academicQualifications.map((a) => (
              <div key={a.id} className="border-b border-border py-2 text-sm last:border-0">
                <p className="font-medium text-black">
                  {a.degreeName} — {a.university}
                </p>
                <p className="text-xs text-neutral-500">
                  Class {a.degreeClass || "—"} · GPA {a.gpa || "—"} · Credits{" "}
                  {a.creditCount || "—"}
                </p>
                {a.files.length === 0 ? (
                  <p className="text-xs text-amber-700">Certificate not attached</p>
                ) : (
                  a.files.map((f) => (
                    <FileLink key={f.id} path={f.filePath} name={f.fileName} />
                  ))
                )}
              </div>
            ))
          )}
        </Card>

        <Card title="Professional & work experience">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Professional qualifications
          </p>
          {packet.professionalQualifications.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            packet.professionalQualifications.map((p) => (
              <div key={p.id} className="py-1 text-sm">
                <span className="text-black">{p.institution}</span>{" "}
                <span className="text-neutral-500">— {p.fieldOfStudy || "—"}</span>
                {p.files.length === 0 ? (
                  <span className="ml-2 text-xs text-amber-700">proof missing</span>
                ) : (
                  p.files.map((f) => (
                    <span key={f.id} className="ml-2">
                      <FileLink path={f.filePath} name={f.fileName} />
                    </span>
                  ))
                )}
              </div>
            ))
          )}
          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Work experience
          </p>
          {packet.workExperiences.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            packet.workExperiences.map((w) => (
              <div key={w.id} className="py-1 text-sm">
                <span className="text-black">{w.organization}</span>{" "}
                <span className="text-neutral-500">— {w.positionHeld || "—"}</span>
                {w.files.map((f) => (
                  <span key={f.id} className="ml-2">
                    <FileLink path={f.filePath} name="(letter)" />
                  </span>
                ))}
              </div>
            ))
          )}
        </Card>
        <Card title="Payment slips">
          {packet.payments.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No declared payment slips (uploaded receipts appear under Checklist
              documents).
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {packet.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-neutral-500">
                      {fmt(p.paymentDate)} · {p.purpose}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-black">
                        Rs{" "}
                        {p.amount.toLocaleString("en-LK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <FileLink path={p.filePath} name={p.fileName} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
                <span className="text-neutral-500">Total declared</span>
                <span className="font-semibold text-black">
                  Rs{" "}
                  {packet.payments
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Verification history */}
      <Card title="Verification history">
        {packet.verifications.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No verification recorded yet.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {packet.verifications.map((v) => (
              <li key={v.id} className="rounded border border-border px-2.5 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERIFICATION_STYLE[v.status] ?? "bg-neutral-100 text-neutral-600"}`}
                  >
                    {VERIFICATION_LABEL[v.status] ?? v.status}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {v.reviewerRole ?? "Staff"}
                    {v.reviewerName ? ` · ${v.reviewerName}` : ""} · {fmt(v.createdAt)}
                  </span>
                </div>
                {v.notes && <p className="mt-1 text-xs text-neutral-600">{v.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Corrections */}
      <Card title="Corrections (Form of Recorrection)">
        {packet.corrections.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No corrections have been requested.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {packet.corrections.map((c) => (
              <li key={c.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.status === "OPEN"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {c.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {c.raisedByRole ?? "Staff"}
                    {c.raisedByName ? ` · ${c.raisedByName}` : ""} · {fmt(c.createdAt)}
                    {c.emailSent ? " · emailed" : ""}
                  </span>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-neutral-700">
                  {c.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                {c.message && (
                  <p className="mt-1 text-xs text-neutral-600">{c.message}</p>
                )}
                {c.studentResponse && (
                  <div className="mt-2 rounded bg-muted px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-black">
                      Student response {c.respondedAt ? `· ${fmt(c.respondedAt)}` : ""}
                    </p>
                    <p className="text-xs text-neutral-700">{c.studentResponse}</p>
                  </div>
                )}
                {c.status === "OPEN" && (
                  <div className="mt-2">
                    <ResolveCorrectionButton
                      correctionId={c.id}
                      applicationId={packet.id}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showPanel && (
        <VerificationPanel
          applicationId={packet.id}
          verificationStatus={packet.verificationStatus}
          missingLabels={missingLabels}
        />
      )}
    </div>
  );
}
