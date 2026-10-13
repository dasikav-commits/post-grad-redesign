/**
 * In-app notification helpers. Notifications target either a portal user
 * (recipientUserId — students, faculty admins, registrars, main admins) or a
 * supervisor profile (supervisorId — supervisors may not have an account yet,
 * but a linked user account is required to actually see the panel).
 *
 * A Prisma transaction client can be passed in so notifications are written
 * inside the same transaction as the event that triggered them.
 */

import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type NotifyInput = {
  title: string;
  message: string;
  applicationId?: number | null;
  /** Grouping badge shown in the notification centre, e.g. "correction". */
  category?: string | null;
  /** Display name of whoever sent it ("Main Admin", "Faculty of Computing"…). */
  senderName?: string | null;
  /** Portal route the notification should open. */
  link?: string | null;
};

function fields(input: NotifyInput) {
  return {
    title: input.title,
    message: input.message,
    applicationId: input.applicationId ?? null,
    category: input.category ?? null,
    senderName: input.senderName ?? null,
    link: input.link ?? null,
  };
}

/** Notify a single portal user by user id. */
export async function notifyUser(
  userId: number,
  input: NotifyInput,
  db: Db = prisma,
): Promise<void> {
  await db.notification.create({
    data: { ...fields(input), recipientUserId: userId },
  });
}

/** Notify a supervisor by supervisor profile id. */
export async function notifySupervisor(
  supervisorId: number,
  input: NotifyInput,
  db: Db = prisma,
): Promise<void> {
  await db.notification.create({
    data: { ...fields(input), supervisorId },
  });
}

/** Notify every user holding a given role (e.g. all registrars). */
export async function notifyRole(
  role: "REGISTRAR" | "MAIN_ADMIN" | "FACULTY_ADMIN",
  input: NotifyInput,
  db: Db = prisma,
): Promise<void> {
  const users = await db.portalUser.findMany({
    where: { role },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ ...fields(input), recipientUserId: u.id })),
  });
}

/** Notify the faculty admin(s) responsible for a faculty (matched by name). */
export async function notifyFacultyAdmins(
  facultyName: string | null | undefined,
  input: NotifyInput,
  db: Db = prisma,
): Promise<void> {
  if (!facultyName) return;
  const admins = await db.facultyAdminProfile.findMany({
    where: { faculty: facultyName },
    select: { userId: true },
  });
  if (admins.length === 0) return;
  await db.notification.createMany({
    data: admins.map((a) => ({ ...fields(input), recipientUserId: a.userId })),
  });
}

/**
 * Notify the student behind an application — but only if they already have a
 * portal account. Applicants whose registration has not been completed yet have
 * no account, so callers pair this with an email (and the Registrar, who is the
 * channel for reaching those students). Returns true when a notification was
 * written.
 */
export async function notifyApplicationStudent(
  application: { id: number; userId: number | null; fullName: string },
  input: NotifyInput,
  db: Db = prisma,
): Promise<boolean> {
  if (!application.userId) return false;
  await db.notification.create({
    data: {
      ...fields(input),
      applicationId: input.applicationId ?? application.id,
      recipientUserId: application.userId,
    },
  });
  return true;
}

/** The supervisor profile id linked to a user, or null if none. */
export async function supervisorIdForUser(userId: number): Promise<number | null> {
  const sup = await prisma.supervisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return sup?.id ?? null;
}

/** Prisma `where` matching notifications visible to a user + supervisor profile. */
export function recipientWhere(userId: number, supervisorId: number | null) {
  return {
    OR: [
      { recipientUserId: userId },
      ...(supervisorId ? [{ supervisorId }] : []),
    ],
  };
}

/** Count unread notifications visible to a user (their user id + supervisor profile). */
export async function unreadCount(
  userId: number,
  supervisorId: number | null,
): Promise<number> {
  return prisma.notification.count({
    where: { isRead: false, ...recipientWhere(userId, supervisorId) },
  });
}

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  category: string | null;
  senderName: string | null;
  link: string | null;
};

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  category: true,
  senderName: true,
  link: true,
};

/** Recent notifications visible to a user + supervisor profile. */
export async function listNotifications(
  userId: number,
  supervisorId: number | null,
  limit = 20,
): Promise<NotificationItem[]> {
  return prisma.notification.findMany({
    where: recipientWhere(userId, supervisorId),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: NOTIFICATION_SELECT,
  });
}

/** All notifications for a user (student notification centre). */
export async function listAllNotifications(
  userId: number,
  supervisorId: number | null,
): Promise<NotificationItem[]> {
  return prisma.notification.findMany({
    where: recipientWhere(userId, supervisorId),
    orderBy: { createdAt: "desc" },
    select: NOTIFICATION_SELECT,
  });
}

/** Unread message count for the sidebar/bell badge. */
export async function unreadMessageCount(
  userId: number,
  supervisorId: number | null,
): Promise<number> {
  return prisma.message.count({
    where: {
      isRead: false,
      OR: [
        { recipientId: userId },
        ...(supervisorId ? [{ supervisorId }] : []),
      ],
    },
  });
}

/** Label used when a notification is sent "on behalf of" a portal role. */
export function roleSenderName(role: UserRole, fullName?: string | null): string {
  const label: Record<UserRole, string> = {
    STUDENT: "Student",
    SUPERVISOR: "Supervisor",
    MAIN_ADMIN: "Main Admin",
    FACULTY_ADMIN: "Faculty Admin",
    REGISTRAR: "Registrar",
  };
  return fullName ? `${label[role]} · ${fullName}` : label[role];
}
