import { requireRole } from "@/lib/guard";
import { getSupervisorAccess } from "@/lib/guard";
import { SupervisorWaitingScreen } from "@/components/supervisor-waiting-screen";

/**
 * Supervisor portal gate.
 *
 * A supervisor account provisioned by the Main Admin stays locked until the
 * Main Admin approves it. Instead of redirecting (which would loop), the layout
 * swaps the whole supervisor area for the waiting screen.
 */
export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("SUPERVISOR");
  const access = await getSupervisorAccess();

  if (access.ok) return <>{children}</>;

  return (
    <SupervisorWaitingScreen
      reason={access.reason}
      note={access.note}
      fullName={access.session?.fullName ?? null}
    />
  );
}
