import "server-only";

import { prisma } from "./prisma";

/**
 * Student ↔ Supervisor message box.
 *
 * A conversation is identified by a deterministic thread key so both sides can
 * find it without storing a separate "conversation" table:
 *   `sup-{supervisorId}-app-{applicationId}`
 *
 * Messages address the recipient two ways at once — by portal user (when they
 * have an account) and by supervisor profile (so a supervisor provisioned later
 * still sees the history) — plus the application for context.
 */

export function threadKey(
  supervisorId: number,
  applicationId?: number | null,
): string {
  return applicationId
    ? `sup-${supervisorId}-app-${applicationId}`
    : `sup-${supervisorId}`;
}

export type ThreadMessage = {
  id: number;
  threadId: string;
  senderId: number;
  senderName: string;
  senderRole: string;
  mine: boolean;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAt: Date;
};

/** Every message in a thread, oldest first. */
export async function getThread(
  threadId: string,
  currentUserId: number,
): Promise<ThreadMessage[]> {
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { fullName: true, role: true } } },
  });
  return messages.map(
    (m: {
      id: number;
      threadId: string;
      senderId: number;
      subject: string | null;
      body: string;
      isRead: boolean;
      createdAt: Date;
      sender: { fullName: string; role: string };
    }): ThreadMessage => ({
      id: m.id,
      threadId: m.threadId,
      senderId: m.senderId,
      senderName: m.sender.fullName,
      senderRole: m.sender.role,
      mine: m.senderId === currentUserId,
      subject: m.subject,
      body: m.body,
      isRead: m.isRead,
      createdAt: m.createdAt,
    }),
  );
}

/** Mark everything addressed to this user/supervisor in a thread as read. */
export async function markThreadRead(
  threadId: string,
  userId: number,
  supervisorId: number | null,
): Promise<void> {
  await prisma.message.updateMany({
    where: {
      threadId,
      isRead: false,
      OR: [
        { recipientId: userId },
        ...(supervisorId ? [{ supervisorId }] : []),
      ],
    },
    data: { isRead: true },
  });
}

export type InboxThread = {
  threadId: string;
  counterpartName: string;
  counterpartRole: string | null;
  supervisorId: number | null;
  applicationId: number | null;
  studentName: string | null;
  proposalTitle: string | null;
  lastMessage: string;
  lastAt: Date;
  unread: number;
  messageCount: number;
};

/**
 * Conversations visible to a user: those addressed to their account, or to the
 * supervisor profile linked to their account. Grouped by thread, newest first.
 */
export async function getInbox(
  userId: number,
  supervisorId: number | null,
): Promise<InboxThread[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        // Addressed to this account …
        { recipientId: userId },
        // … or sent by it, so a conversation you started stays in your inbox.
        { senderId: userId },
        ...(supervisorId ? [{ supervisorId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      sender: { select: { fullName: true, role: true } },
      recipient: { select: { fullName: true, role: true } },
      application: {
        select: {
          fullName: true,
          researchProposals: { take: 1, select: { title: true } },
        },
      },
    },
  });

  const byThread = new Map<string, InboxThread>();
  for (const m of messages) {
    const existing = byThread.get(m.threadId);
    const mine = m.senderId === userId;
    // The other side of the conversation, whichever direction the newest
    // message travelled.
    const counterpart = mine ? m.recipient : m.sender;
    const unread = (existing?.unread ?? 0) + (m.isRead || mine ? 0 : 1);
    if (!existing) {
      byThread.set(m.threadId, {
        threadId: m.threadId,
        counterpartName: counterpart?.fullName ?? m.sender.fullName,
        counterpartRole: counterpart?.role ?? m.sender.role,
        supervisorId: m.supervisorId,
        applicationId: m.applicationId,
        studentName: m.application?.fullName ?? null,
        proposalTitle: m.application?.researchProposals[0]?.title ?? null,
        lastMessage: m.body,
        lastAt: m.createdAt,
        unread,
        messageCount: 1,
      });
    } else {
      existing.unread = unread;
      existing.messageCount += 1;
    }
  }

  return [...byThread.values()].sort(
    (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
  );
}
