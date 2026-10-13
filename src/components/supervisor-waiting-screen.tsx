import { PageHeader, PlaceholderCard } from "@/components/page-header";

/**
 * Shown in place of the supervisor portal until the Main Admin approves the
 * supervisor's account.
 */
export function SupervisorWaitingScreen({
  reason,
  note,
  fullName,
}: {
  reason: "no-profile" | "pending" | "rejected";
  note: string | null;
  fullName: string | null;
}) {
  const title =
    reason === "rejected"
      ? "Supervisor access not approved"
      : reason === "no-profile"
        ? "Supervisor profile not found"
        : "Waiting for admin approval";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={fullName ? `Signed in as ${fullName}` : undefined}
      />

      <div className="space-y-4">
        <div className="card-shadow rounded-2xl border border-border bg-white p-6">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${
                reason === "rejected" ? "bg-rose-500" : "bg-amber-500"
              }`}
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5v.5" />
              </svg>
            </span>
            <div>
              <p className="text-sm text-neutral-700">
                {reason === "rejected"
                  ? "The Main Admin did not approve your supervisor portal account. Please contact the postgraduate office for details."
                  : reason === "no-profile"
                    ? "No supervisor profile is linked to this account yet. Please contact the postgraduate office."
                    : "Your supervisor account has been created but is not active yet. The Main Admin has to approve it before you can review students, progress reports and presentations."}
              </p>
              {note && (
                <p className="mt-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-neutral-700">
                  <span className="font-semibold">Admin note:</span> {note}
                </p>
              )}
              <p className="mt-3 text-xs text-neutral-500">
                You will be notified in the portal and by email as soon as the
                approval is granted.
              </p>
            </div>
          </div>
        </div>

        <PlaceholderCard>
          Everything else in the Supervisor portal is locked until approval.
        </PlaceholderCard>
      </div>
    </>
  );
}
