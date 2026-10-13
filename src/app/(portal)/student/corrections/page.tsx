import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, PlaceholderCard } from "@/components/page-header";
import { ROLE_LABEL } from "@/lib/status-labels";
import { CorrectionResponse } from "./correction-response";

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

/**
 * Corrections sent to the student by a faculty admin, the registrar or the main
 * admin. The student replies here; the reviewer is notified in the portal and by
 * email.
 */
export default async function Page() {
  const session = await requireRole("STUDENT");

  const corrections = await prisma.correctionRequest.findMany({
    where: { application: { userId: session.userId } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      items: true,
      message: true,
      status: true,
      createdAt: true,
      studentResponse: true,
      respondedAt: true,
      resolvedAt: true,
      raisedByRole: true,
      raisedBy: { select: { fullName: true, role: true } },
      application: { select: { id: true, fullName: true, verificationStatus: true } },
    },
  });

  const open = corrections.filter((c) => c.status === "OPEN");

  if (corrections.length === 0) {
    return (
      <>
        <PageHeader
          title="Corrections"
          subtitle="Errors and corrections raised by a faculty admin, the registrar or the main admin."
        />
        <PlaceholderCard>
          No corrections have been raised against your application. Anything a
          reviewer asks you to fix will appear here, and you will also get an
          email.
        </PlaceholderCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Corrections"
        subtitle={
          open.length > 0
            ? `${open.length} correction${open.length === 1 ? "" : "s"} still to action. Reply below once you have fixed them.`
            : "All corrections have been closed."
        }
      />

      <div className="space-y-4">
        {corrections.map((c) => {
          const items = c.items
            .split("\n")
            .map((i) => i.trim())
            .filter(Boolean);
          const isOpen = c.status === "OPEN";
          const sender = c.raisedBy?.fullName
            ? `${ROLE_LABEL[c.raisedBy.role] ?? c.raisedBy.role} · ${c.raisedBy.fullName}`
            : (ROLE_LABEL[c.raisedByRole ?? ""] ?? "Reviewer");

          return (
            <div
              key={c.id}
              className={`rounded-lg border bg-white p-4 ${
                isOpen ? "border-amber-300" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-black">
                    Correction requested
                    <span className="ml-2 text-xs font-medium text-neutral-500">
                      #{c.application.id} · {c.application.fullName}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {sender} · {fmt(c.createdAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isOpen ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isOpen ? "Open" : "Closed"}
                </span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-black">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {item}
                  </li>
                ))}
              </ul>

              {c.message && (
                <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-neutral-700">
                  {c.message}
                </p>
              )}

              {c.studentResponse && (
                <div className="mt-3 rounded-md border border-border px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Your response · {c.respondedAt ? fmt(c.respondedAt) : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-black">
                    {c.studentResponse}
                  </p>
                </div>
              )}

              {c.resolvedAt && (
                <p className="mt-3 text-xs text-emerald-700">
                  Closed on {fmt(c.resolvedAt)}.
                </p>
              )}

              {isOpen && (
                <div className="mt-4 border-t border-border pt-3">
                  <CorrectionResponse correctionId={c.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
