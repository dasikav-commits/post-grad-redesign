import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupervisorAccess } from "@/lib/guard";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import {
  listNotifications,
  supervisorIdForUser,
  unreadMessageCount,
} from "@/lib/notify";
import { ROLE_LABELS } from "@/lib/roles";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/account/password");
  }

  const supervisorId = await supervisorIdForUser(session.userId);
  const [notifications, messages] = await Promise.all([
    listNotifications(session.userId, supervisorId),
    unreadMessageCount(session.userId, supervisorId),
  ]);
  const unread = notifications.filter((n) => !n.isRead).length;

  // Supervisors wait for Main Admin approval before their nav unlocks.
  const supervisorLocked =
    session.role === "SUPERVISOR" ? !(await getSupervisorAccess()).ok : false;

  return (
    <div className="flex min-h-screen flex-col bg-muted md:flex-row">
      <Sidebar
        role={session.role}
        fullName={session.fullName}
        email={session.email}
        locked={supervisorLocked}
        messageCount={messages}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto pt-16 md:pt-0">
        <header className="flex items-center justify-end gap-4 border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-neutral-500">
            {ROLE_LABELS[session.role]} Portal
          </p>
          <NotificationBell items={notifications} unread={unread} messageCount={messages} />
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
