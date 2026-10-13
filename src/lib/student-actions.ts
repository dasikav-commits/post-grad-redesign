"use server";

/**
 * Student-side actions: responding to a correction raised by a faculty admin,
 * the registrar or the main admin.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import {
  notifyFacultyAdmins,
  notifyRole,
  notifyUser,
  roleSenderName,
} from "@/lib/notify";
import { sendPortalEmail } from "@/lib/email";

export type CorrectionResponseResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Record the student's reply to a correction request and tell everyone
 * reviewing the application that a response is waiting.
 */
export async function respondToCorrection(
  form: FormData,
): Promise<CorrectionResponseResult> {
  const session = await requireRole("STUDENT");

  const correctionId = Number(form.get("correctionId"));
  const response = String(form.get("response") ?? "").trim();
  if (!Number.isInteger(correctionId)) {
    return { ok: false, error: "Invalid correction request." };
  }
  if (!response) {
    return { ok: false, error: "Write your response first." };
  }

  const correction = await prisma.correctionRequest.findUnique({
    where: { id: correctionId },
    select: {
      id: true,
      status: true,
      raisedById: true,
      raisedBy: { select: { id: true, fullName: true, email: true, role: true } },
      application: {
        select: { id: true, fullName: true, userId: true, faculty: true },
      },
    },
  });
  if (!correction) return { ok: false, error: "Correction request not found." };
  if (correction.application.userId !== session.userId) {
    return { ok: false, error: "This correction is not yours." };
  }
  if (correction.status === "RESOLVED") {
    return { ok: false, error: "This correction has already been closed." };
  }

  await prisma.correctionRequest.update({
    where: { id: correctionId },
    data: { studentResponse: response, respondedAt: new Date() },
  });

  const senderLabel = roleSenderName(session.role, session.fullName);
  const message = `${correction.application.fullName} replied to the correction request: ${
    response.length > 200 ? `${response.slice(0, 200)}…` : response
  }`;

  // Whoever raised it, plus the reviewers of that faculty.
  if (correction.raisedBy) {
    await notifyUser(correction.raisedBy.id, {
      title: "Student replied to a correction",
      message,
      applicationId: correction.application.id,
      category: "correction",
      senderName: senderLabel,
      link: `/admin/applications/${correction.application.id}`,
    });
    if (correction.raisedBy.email) {
      await sendPortalEmail({
        to: correction.raisedBy.email,
        name: correction.raisedBy.fullName,
        subject: "Student Replied To Correction Request",
        heading: `${correction.application.fullName} replied`,
        paragraphs: [response],
        senderLabel,
        ctaLabel: "Open the application",
        ctaPath: `/admin/applications/${correction.application.id}`,
      });
    }
  }
  // If nobody specific raised it, tell the faculty admins for that faculty.
  if (!correction.raisedBy) {
    await notifyFacultyAdmins(correction.application.faculty, {
      title: "Student replied to a correction",
      message,
      applicationId: correction.application.id,
      category: "correction",
      senderName: senderLabel,
      link: `/faculty-admin/applications/${correction.application.id}`,
    });
  }
  await notifyRole("REGISTRAR", {
    title: "Student replied to a correction",
    message,
    applicationId: correction.application.id,
    category: "correction",
    senderName: senderLabel,
    link: `/registrar/registrations/${correction.application.id}`,
  });
  await notifyRole("MAIN_ADMIN", {
    title: "Student replied to a correction",
    message,
    applicationId: correction.application.id,
    category: "correction",
    senderName: senderLabel,
    link: `/admin/applications/${correction.application.id}`,
  });

  revalidatePath("/student/corrections");
  revalidatePath("/student/application");
  revalidatePath("/student");
  return { ok: true };
}
