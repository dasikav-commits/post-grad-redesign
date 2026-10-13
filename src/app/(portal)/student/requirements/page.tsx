import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getApplicationReviewPacket } from "@/lib/review";
import { PageHeader, PlaceholderCard } from "@/components/page-header";
import { RequirementsChecklist } from "@/components/requirements-checklist";

export const dynamic = "force-dynamic";

/** Document category → human label, for the "what I uploaded" list. */
const CATEGORY_LABEL: Record<string, string> = {
  APPLICATION_FORM: "Application form",
  CV: "Curriculum vitae",
  BIRTH_CERTIFICATE: "Birth certificate",
  EDUCATIONAL_CERTIFICATE: "Educational certificate",
  PROFESSIONAL_CERTIFICATE: "Professional qualification",
  TRANSCRIPT: "Academic transcript",
  RESEARCH_PROPOSAL: "Research proposal",
  SUPERVISOR_CV: "Supervisor's CV",
  REFEREE_REPORT: "Referee report",
  BUDGET: "Budget",
  PHOTO: "Passport-size photo",
  PAYMENT_RECEIPT: "Payment receipt",
  OTHER: "Other document",
};

/**
 * The student's own registration requirements: what is expected, what has been
 * uploaded, and what is still missing.
 */
export default async function Page() {
  const session = await requireRole("STUDENT");

  const application = await prisma.applicationPostGraduate.findFirst({
    where: { userId: session.userId },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  if (!application) {
    return (
      <>
        <PageHeader title="Requirements" subtitle="Your registration requirements" />
        <PlaceholderCard>
          You have not submitted an application yet, so there are no requirements
          to track.
        </PlaceholderCard>
      </>
    );
  }

  const packet = await getApplicationReviewPacket(application.id);
  if (!packet || packet.studentUserId !== session.userId) {
    return (
      <>
        <PageHeader title="Requirements" subtitle="Your registration requirements" />
        <PlaceholderCard>Your application could not be loaded.</PlaceholderCard>
      </>
    );
  }

  const missing = packet.requirements.filter((r) => !r.met);

  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle="Every item the Postgraduate Institute expects for your registration, and what you have uploaded so far."
      />

      {packet.openCorrectionCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-black">
          <p className="font-semibold">
            {packet.openCorrectionCount} correction
            {packet.openCorrectionCount === 1 ? "" : "s"} awaiting your reply
          </p>
          <Link href="/student/corrections" className="text-brand underline">
            Open the Corrections page →
          </Link>
        </div>
      )}

      <RequirementsChecklist
        requirements={packet.requirements}
        summary={packet.requirementSummary}
      />

      {missing.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-white p-4">
          <h3 className="text-base font-bold text-black">Still outstanding</h3>
          <ul className="mt-2 space-y-1.5">
            {missing.map((r) => (
              <li key={r.n} className="flex gap-2 text-sm text-black">
                <span className="font-semibold text-brand">{r.n}.</span>
                <span>
                  {r.label} — <span className="text-neutral-600">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">
            Requirements are captured during the{" "}
            <Link href="/register" className="text-brand underline">
              registration process
            </Link>
            . If something is missing or wrong, a reviewer will raise a correction
            instead.
          </p>
        </div>
      )}

      {/* What has been uploaded */}
      <div className="mt-6 rounded-lg border border-border bg-white p-4">
        <h3 className="text-base font-bold text-black">Uploaded documents</h3>
        {packet.documents.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No documents on record.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {packet.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-black">
                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    {CATEGORY_LABEL[d.category ?? ""] ?? d.category ?? "Document"}
                  </span>
                  {d.fileName}
                </span>
                <a
                  href={`/api/files?path=${encodeURIComponent(d.filePath)}`}
                  className="shrink-0 rounded-md border border-border px-3 py-1 text-xs font-semibold text-black hover:border-brand"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
