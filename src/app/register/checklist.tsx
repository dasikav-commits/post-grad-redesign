/**
 * Registration requirements, mirroring `src/lib/requirements.ts` so what the
 * applicant is told up front is exactly what the reviewers check afterwards.
 */
const ITEMS: {
  n: number;
  title: string;
  mode: "Upload" | "Upload + Physical";
  where: string;
  note: string;
}[] = [
  {
    n: 1,
    title: "Completed Application Form (signed)",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Upload the signed form; the original is handed over in person.",
  },
  {
    n: 2,
    title: "Curriculum Vitae (CV)",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Your complete CV.",
  },
  {
    n: 3,
    title: "Birth Certificate",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Certified copy.",
  },
  {
    n: 4,
    title: "Educational Certificates",
    mode: "Upload",
    where: "Step 2 — Academic Qualifications",
    note: "Certified copy attached to every qualification you list.",
  },
  {
    n: 5,
    title: "Professional Qualifications",
    mode: "Upload",
    where: "Step 4 — Professional Experience",
    note: "Certified copy of each professional certificate.",
  },
  {
    n: 6,
    title: "Academic Transcripts",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Complete transcripts.",
  },
  {
    n: 7,
    title: "Research Proposal",
    mode: "Upload + Physical",
    where: "Step 6 — Proposal & Supervisors",
    note: "Signed proposal as a PDF; two copies handed over in person.",
  },
  {
    n: 8,
    title: "Proposed Supervisors",
    mode: "Upload",
    where: "Step 6 — Proposal & Supervisors",
    note: "1 – 5 supervisors, exactly one marked as main.",
  },
  {
    n: 9,
    title: "Supervisors' CVs",
    mode: "Upload",
    where: "Step 6 — Proposal & Supervisors",
    note: "CV plus a willingness-to-supervise document for each supervisor.",
  },
  {
    n: 10,
    title: "Referee Reports",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Two (02) reports minimum.",
  },
  {
    n: 11,
    title: "Proposed Budget / Funding Evidence",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Budget plus evidence of funding or financial support.",
  },
  {
    n: 12,
    title: "Passport-size Photograph",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Colour photograph; three copies handed over in person.",
  },
  {
    n: 13,
    title: "Payment Receipts",
    mode: "Upload + Physical",
    where: "Step 5 — Documents",
    note: "Relevant payments including the application lodging fee.",
  },
];

export function Checklist() {
  return (
    <section className="mb-8 rounded-lg border border-brand bg-white p-6">
      <h2 className="text-lg font-bold text-black">
        Registration requirements — all 13 must be met
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        The wizard will not let you submit until every item below is provided.
        Items marked <strong>Upload + Physical</strong> are submitted online here
        and also handed over in person — you acknowledge those at the end of the
        Documents step. Your progress against this list stays visible in the
        student portal under <strong>Requirements</strong>.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <li
            key={it.n}
            className="flex gap-3 rounded-md border border-border p-3 text-sm"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {it.n}
            </span>
            <div>
              <p className="font-medium text-black">{it.title}</p>
              <p className="text-xs text-neutral-500">
                <span
                  className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    it.mode === "Upload"
                      ? "bg-brand text-white"
                      : "border border-brand text-black"
                  }`}
                >
                  {it.mode}
                </span>
                {it.where} — {it.note}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
