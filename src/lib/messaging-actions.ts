"use server";

/**
 * Student ↔ Supervisor messaging.
 *
 * A conversation is addressed by the supervisor's profile id (so the thread
 * survives the supervisor being provisioned later) plus the application, and is
 * only reachable by the two people in it. Every message raises a notification
 * for the recipient and an email.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, getSupervisorAccess } from "@/lib/guard";
import { notifyUser } from "@/lib/notify";
import { sendMessageEmail } from "@/lib/email";
import { threadKey } from "@/lib/messaging";

export type SendResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

function messagesPath(role: string) {
  return role === "SUPERVISOR" ? "/supervisor/messages" : "/student/messages";
}

/** Send a message to the other person in a thread. */
export async function sendMessage(form: FormData): Promise<SendResult> {
  let session;
  try {
    session = await requireRole(["STUDENT", "SUPERVISOR"]);
  } catch {
    return { ok: false, error: "Not signed in." };
  }

  const body = String(form.get("body") ?? "").trim();
  const applicationId = Number(form.get("applicationId")) || null;
  if (!body) return { ok: false, error: "Write a message first." };

  // --- Supervisor side of the thread -------------------------------------
  let supervisorProfileId: number;
  let recipient: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  } | null = null;

  if (session.role === "SUPERVISOR") {
    const access = await getSupervisorAccess();
    if (!access.ok) {
      return { ok: false, error: "Your portal access has not been approved yet." };
    }
    supervisorProfileId = access.supervisorId;

    if (!applicationId) {
      return { ok: false, error: "Select a student first." };
    }
    const application = await prisma.applicationPostGraduate.findUnique({
      where: { id: applicationId },
      select: {
        userId: true,
        fullName: true,
        emails: { select: { email: true } },
        researchProposals: {
          select: {
            supervisors: { where: { supervisorId: supervisorProfileId }, select: { id: true } },
          },
        },
      },
    });
    if (!application) return { ok: false, error: "Student not found." };
    const linked = application.researchProposals.some(
      (p: { supervisors: unknown[] }) => p.supervisors.length > 0,
    );
    if (!linked) {
      return { ok: false, error: "You are not a supervisor of this student." };
    }

    const userId = application.userId;
    const email = application.emails[0]?.email;
    if (!userId || !email) {
      return {
        ok: false,
        error: "This student does not have a portal account yet, so messages cannot be delivered.",
      };
    }
    const user = await prisma.portalUser.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true },
    });
    if (!user) return { ok: false, error: "Student account not found." };
    recipient = { id: user.id, fullName: user.fullName || email, email: user.email, role: user.role };
  } else {
    supervisorProfileId = Number(form.get("supervisorProfileId")) || 0;
    if (!supervisorProfileId) {
      return { ok: false, error: "Select a supervisor." };
    }

    const supervisor = await prisma.supervisorProfile.findUnique({
      where: { id: supervisorProfileId },
      select: {
        id: true,
        approvalStatus: true,
        userId: true,
        user: { select: { id: true, fullName: true, email: true, role: true } },
        proposals: { select: { proposal: { select: { applicationId: true } } } },
      },
    });
    if (!supervisor) return { ok: false, error: "Supervisor not found." };
    if (!supervisor.user) {
      return {
        ok: false,
        error: "This supervisor does not have a portal account yet — use their email address instead.",
      };
    }
    if (supervisor.approvalStatus !== "APPROVED") {
      return {
        ok: false,
        error: "This supervisor's portal access has not been approved yet — use their email address instead.",
      };
    }

    // Only supervisors the student proposed (or a supervisor in the catalogue)
    // can be addressed; proposed ones carry the application for context.
    const mine = supervisor.proposals.some(
      (p: { proposal: { applicationId: number | null } }) =>
        p.proposal.applicationId != null,
    );
    if (!mine) {
      return { ok: false, error: "You can only message one of your proposed supervisors." };
    }

    recipient = {
      id: supervisor.user.id,
      fullName: supervisor.user.fullName || supervisor.user.email,
      email: supervisor.user.email,
      role: supervisor.user.role,
    };
  }

  if (!recipient) return { ok: false, error: "Recipient not found." };
  if (recipient.id === session.userId) {
    return { ok: false, error: "You cannot message yourself." };
  }

  const threadId = threadKey(supervisorProfileId, applicationId);

  await prisma.message.create({
    data: {
      threadId,
      senderId: session.userId,
      recipientId: recipient.id,
      supervisorId: supervisorProfileId,
      applicationId,
      body,
    },
  });

  await notifyUser(recipient.id, {
    title: `New message from ${session.fullName || session.email}`,
    message: body.length > 220 ? `${body.slice(0, 220)}…` : body,
    applicationId,
    category: "message",
    senderName: session.fullName || session.email,
    link: messagesPath(recipient.role),
  });

  await sendMessageEmail({
    to: recipient.email,
    recipientName: recipient.fullName,
    senderName: session.fullName || session.email,
    body,
    replyPath: messagesPath(recipient.role),
  });

  revalidatePath("/student/messages");
  revalidatePath("/supervisor/messages");
  return { ok: true, threadId };
}

/** Mark a whole thread as read for the current user. */
export async function markMessagesRead(form: FormData): Promise<{ ok: true }> {
  let session;
  try {
    session = await requireRole(["STUDENT", "SUPERVISOR"]);
  } catch {
    return { ok: true };
  }

  const threadId = String(form.get("threadId") ?? "");
  if (!threadId) return { ok: true };

  await prisma.message.updateMany({
    where: { threadId, recipientId: session.userId, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/student/messages");
  revalidatePath("/supervisor/messages");
  return { ok: true };
}
