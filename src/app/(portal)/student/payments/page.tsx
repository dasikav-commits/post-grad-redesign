import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { DOC_CATEGORY } from "@/lib/requirements";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtAmount(n: number) {
  return `Rs ${n.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function StudentPaymentsPage() {
  const session = await requireRole("STUDENT");

  const app = await prisma.applicationPostGraduate.findFirst({
    where: { userId: session.userId },
    select: {
      id: true,
      fullName: true,
      degreeProgram: true,
    },
  });

  if (!app) {
    return (
      <>
        <PageHeader
          title="Payments"
          subtitle="Your payment slips and the total paid will appear here."
        />
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-neutral-500">
          No application found. Please complete your registration first.
        </div>
      </>
    );
  }

  const [payments, receipts] = await Promise.all([
    prisma.payment.findMany({
      where: { applicationId: app.id },
      orderBy: { paymentDate: "asc" },
    }),
    prisma.uploadedFile.findMany({
      where: { applicationId: app.id, category: DOC_CATEGORY.paymentReceipt },
      orderBy: { id: "asc" },
    }),
  ]);

  // Receipts uploaded before the payment slips table existed have no declared
  // amount — matched to a slip by the stored file path.
  const declaredPaths = new Set(payments.map((p) => p.filePath));
  const legacyReceipts = receipts.filter((r) => !declaredPaths.has(r.filePath));

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every payment slip declared with your registration, and the total paid."
      />

      <div className="space-y-6">
        {/* Declared payment slips */}
        <div className="rounded-lg border border-border bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-black">Payment slips</h2>
            <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand-dark">
              Total paid: {fmtAmount(total)}
            </span>
          </div>

          {payments.length === 0 && legacyReceipts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-neutral-500">
              No payment slips on record yet.
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No declared amounts — see the uploaded receipts below.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Purpose</th>
                    <th className="px-4 py-2 font-semibold">Amount</th>
                    <th className="px-4 py-2 font-semibold">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-neutral-600">{fmtDate(p.paymentDate)}</td>
                      <td className="px-4 py-2.5 font-medium text-black">{p.purpose}</td>
                      <td className="px-4 py-2.5 font-medium text-black">{fmtAmount(Number(p.amount))}</td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`/api/files?path=${encodeURIComponent(p.filePath)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-black underline underline-offset-2 hover:text-brand-dark"
                        >
                          {p.fileName}
                        </a>
                        {/* Running total after each row */}
                        <span className="ml-2 text-xs text-neutral-400">
                          (running total:{" "}
                          {fmtAmount(
                            payments
                              .slice(0, idx + 1)
                              .reduce((sum, x) => sum + Number(x.amount), 0),
                          )}
                          )
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Receipts uploaded without a declared amount (legacy) */}
        {legacyReceipts.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="mb-2 text-lg font-bold text-black">Other receipts</h2>
            <p className="mb-3 text-sm text-neutral-500">
              Receipts uploaded without a declared amount.
            </p>
            <ul className="space-y-2 text-sm">
              {legacyReceipts.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2"
                >
                  <a
                    href={`/api/files?path=${encodeURIComponent(r.filePath)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-black underline underline-offset-2 hover:text-brand-dark"
                  >
                    {r.fileName}
                  </a>
                  <span className="text-xs italic text-neutral-500">
                    amount not declared
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
