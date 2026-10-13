import { requireRole } from "@/lib/guard";
import { listAllNotifications, unreadCount } from "@/lib/notify";
import { PageHeader, PlaceholderCard } from "@/components/page-header";
import { NotificationList } from "@/components/notification-list";

export const dynamic = "force-dynamic";

/**
 * The student notification centre: everything the faculty admin, registrar, main
 * admin and supervisors have sent — the same items that arrive by email.
 */
export default async function Page() {
  const session = await requireRole("STUDENT");

  const [items, unread] = await Promise.all([
    listAllNotifications(session.userId, null),
    unreadCount(session.userId, null),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          unread > 0
            ? `${unread} unread. Notifications from your faculty, the registrar and the main admin.`
            : "Notifications from your faculty, the registrar and the main admin."
        }
      />
      {items.length === 0 ? (
        <PlaceholderCard>
          No notifications yet. When your faculty admin verifies your
          information, asks for a correction or your progress report moves to the
          next stage, you will see it here and get an email.
        </PlaceholderCard>
      ) : (
        <NotificationList items={items} />
      )}
    </>
  );
}
