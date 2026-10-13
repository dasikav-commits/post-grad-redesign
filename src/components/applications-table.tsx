import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { VERIFICATION_LABEL, VERIFICATION_STYLE } from "@/lib/status-labels";

export type AppRow = {
  id: number;
  fullName: string;
  nic: string;
  faculty: string | null;
  degreeProgram: string | null;
  status: ApplicationStatus;
  registrationDate: Date;
  /** Admin verification of the uploaded information. */
  verificationStatus?: string | null;
  /** "9/13" style requirements completeness. */
  requirementsMet?: number | null;
  requirementsTotal?: number | null;
  /** Open correction requests. */
  openCorrections?: number | null;
  /** Explicit detail link; defaults to `${detailBase}/${id}`. */
  detailHref?: string;
};

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  ACTIVE: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
};

export function ApplicationsTable({
  rows,
  emptyMessage = "No applications.",
  showDetailLink = false,
  showVerification = false,
  detailBase = "/admin/applications",
  toolbar,
}: {
  rows: AppRow[];
  emptyMessage?: string;
  showDetailLink?: boolean;
  /** Adds the verification + requirements columns (admin/faculty review). */
  showVerification?: boolean;
  detailBase?: string;
  /** Optional right-aligned controls, e.g. the Excel export button. */
  toolbar?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar && <div className="flex justify-end">{toolbar}</div>}
        <div className="card-shadow rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar && <div className="flex flex-wrap justify-end gap-2">{toolbar}</div>}
      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-border bg-brand-light text-xs uppercase tracking-wide text-brand-dark">
            <tr>
              <th className="px-4 py-3 font-semibold">Applicant</th>
              <th className="px-4 py-3 font-semibold">NIC</th>
              <th className="px-4 py-3 font-semibold">Faculty</th>
              <th className="px-4 py-3 font-semibold">Degree</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              {showVerification && (
                <>
                  <th className="px-4 py-3 font-semibold">Requirements</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                </>
              )}
              <th className="px-4 py-3 font-semibold">Status</th>
              {showDetailLink && <th className="px-4 py-3 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const verification = r.verificationStatus ?? "NOT_VERIFIED";
              const incomplete =
                r.requirementsTotal != null &&
                r.requirementsMet != null &&
                r.requirementsMet < r.requirementsTotal;
              return (
                <tr
                  key={r.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-brand-light/40"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {r.fullName}
                    {(r.openCorrections ?? 0) > 0 && (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        {r.openCorrections} correction
                        {r.openCorrections === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{r.nic}</td>
                  <td className="px-4 py-3 text-neutral-600">{r.faculty ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {r.degreeProgram ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {r.registrationDate.toLocaleDateString()}
                  </td>
                  {showVerification && (
                    <>
                      <td className="px-4 py-3">
                        {r.requirementsTotal == null ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              incomplete
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {r.requirementsMet}/{r.requirementsTotal}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERIFICATION_STYLE[verification] ?? "bg-neutral-100 text-neutral-600"}`}
                        >
                          {VERIFICATION_LABEL[verification] ?? verification}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {showDetailLink && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={r.detailHref ?? `${detailBase}/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-light px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white"
                      >
                        View
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The "Export to Excel" button used on the application lists. */
export function ExportExcelButton({
  href,
  label = "Export to Excel",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {label}
    </a>
  );
}
