import type { RequirementState } from "@/lib/requirements";

/**
 * The registration requirements checklist, rendered for reviewers and for the
 * student. Green = supplied, amber = still missing.
 */
export function RequirementsChecklist({
  requirements,
  summary,
  compact = false,
}: {
  requirements: RequirementState[];
  summary: { met: number; total: number; complete: boolean };
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-black">
          Registration requirements
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            summary.complete
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {summary.met} of {summary.total} met
        </span>
      </div>

      {!summary.complete && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The application is incomplete — the student still has to supply
          everything marked below before it can be verified.
        </p>
      )}

      <ul className={compact ? "grid gap-1.5" : "grid gap-1.5 sm:grid-cols-2"}>
        {requirements.map((r) => (
          <li
            key={r.key}
            className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 ${
              r.met ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                r.met ? "bg-emerald-500" : "bg-amber-500"
              }`}
            >
              {r.met ? "✓" : r.n}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-black">{r.label}</p>
              {!compact && (
                <p className="text-[11px] text-neutral-500">{r.expects}</p>
              )}
              {r.met ? (
                <p className="text-[11px] text-emerald-700">
                  {r.have} submitted{r.min > 1 ? ` (needs ${r.min})` : ""}
                </p>
              ) : (
                <p className="text-[11px] font-medium text-amber-700">
                  Missing — {r.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
