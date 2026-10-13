import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

// Ensures the current session matches one of the allowed roles. Redirects to
// /login when unauthenticated, or to the user's own home when role mismatches.
export async function requireRole(
  allowed: UserRole | UserRole[],
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

export type SupervisorAccess =
  | { ok: true; session: SessionPayload; supervisorId: number; name: string }
  | {
      ok: false;
      session: SessionPayload | null;
      reason: "no-profile" | "pending" | "rejected";
      note: string | null;
    };

/**
 * Supervisors only get portal access once the Main Admin has approved their
 * account. Used by the supervisor layout (to render the waiting screen) and by
 * every supervisor server action (so nothing can be done while unapproved).
 */
export async function getSupervisorAccess(): Promise<SupervisorAccess> {
  const session = await getSession();
  if (!session || session.role !== "SUPERVISOR") {
    return { ok: false, session, reason: "no-profile", note: null };
  }

  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, name: true, approvalStatus: true, approvalNote: true },
  });

  if (!profile) {
    return { ok: false, session, reason: "no-profile", note: null };
  }
  if (profile.approvalStatus !== "APPROVED") {
    return {
      ok: false,
      session,
      reason: profile.approvalStatus === "REJECTED" ? "rejected" : "pending",
      note: profile.approvalNote,
    };
  }
  return { ok: true, session, supervisorId: profile.id, name: profile.name };
}

export type SupervisorActionGate =
  | { ok: true; session: SessionPayload; supervisorId: number; name: string }
  | { ok: false; error: string };

/**
 * Gate for supervisor *server actions*. Same rule as the supervisor layout: the
 * Main Admin must have approved the account before anything can be done.
 */
export async function requireApprovedSupervisor(): Promise<SupervisorActionGate> {
  const session = await requireRole("SUPERVISOR");
  const access = await getSupervisorAccess();
  if (!access.ok) {
    return {
      ok: false,
      error:
        access.reason === "rejected"
          ? "Your supervisor portal access was not approved by the Main Admin."
          : "Your supervisor portal access is waiting for Main Admin approval.",
    };
  }
  return {
    ok: true,
    session: access.session ?? session,
    supervisorId: access.supervisorId,
    name: access.name,
  };
}
