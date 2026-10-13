"use server";

/**
 * Application verification ("Form of Recorrection"), correction requests and
 * direct student notifications.
 *
 * Shared by the three staff portals that handle applications:
 *   - Main Admin   — every application
 *   - Registrar    — every application (the Registrar is the main handler and
 *                    the channel through which applicants are informed)
 *   - Faculty Admin— applications in their own faculty
 *
 * Every action writes an in-app notification for the student (when they already
 * have a portal account) *and* sends an email to the address on the
 * application, and keeps the Registrar in the loop.
 */

import { revalidatePath } from "next/cache";
import type { UserRole, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, type SessionPayload } from "@/lib/auth";
import {
  notifyApplicationStudent,
  notifyFacultyAdmins,
  notifyRole,
  roleSenderName,
} from "@/lib/notify";
import {
  sendCorrectionRequestEmail,
  sendPortalEmail,
  sendVerificationResultEmail,
} from "@/lib/email";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

const REVIEW_ROLES: UserRole[] = ["MAIN_ADMIN", "REGISTRAR", "FACULTY_ADMIN"];

async function reviewer(): Promise<
  | { ok: true; session: SessionPayload }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in." };
  if (!REVIEW_ROLES.includes(session.role)) {
    return { ok: false, error: "You do not have permission to review applications." };
  }
  return { ok: true, session };
}

/** Faculty admins may only touch applications in their own faculty. */
async function canAccess(
  session: SessionPayload,
  applicationId: number,
): Promise<
  | { ok: true; app: { id: number; userId: number | null; fullName: string; faculty: string | null; emails: string[] } }
  | { ok: false; error: string }
> {
  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      fullName: true,
      faculty: true,
      emails: { select: { email: true } },
    },
  });
  if (!app) return { ok: false, error: "Application not found." };

  if (session.role === "FACULTY_ADMIN") {
    const profile = await prisma.facultyAdminProfile.findUnique({
      where: { userId: session.userId },
      select: { faculty: true },
    });
    if (profile?.faculty && app.faculty && profile.faculty !== app.faculty) {
      return { ok: false, error: "That application belongs to another faculty." };
    }
  }

  return {
    ok: true,
    app: {
      id: app.id,
      userId: app.userId,
      fullName: app.fullName,
      faculty: app.faculty,
      emails: app.emails.map((e: { email: string }) => e.email),
    },
  };
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/**
 * Mark the uploaded student information as verified (or under review).
 * Records the decision, tells the student in-app + by email and informs the
 * other handlers.
 */
export async function verifyApplication(
  form: FormData,
): Promise<ReviewActionResult> {
  const auth = await reviewer();
  if (!auth.ok) return auth;
  const { session } = auth;

  const applicationId = Number(form.get("applicationId"));
  const status = str(form, "status") as VerificationStatus;
  const notes = str(form, "notes") || null;

  if (!Number.isInteger(applicationId)) {
    return { ok: false, error: "Invalid application." };
  }
  if (!["UNDER_REVIEW", "VERIFIED"].includes(status)) {
    return { ok: false, error: "Invalid verification status." };
  }

  const access = await canAccess(session, applicationId);
  if (!access.ok) return access;
  const app = access.app;

  await prisma.$transaction(async (tx) => {
    await tx.applicationVerification.create({
      data: {
        applicationId,
        status,
        notes,
        reviewerId: session.userId,
        reviewerRole: session.role,
      },
    });
    await tx.applicationPostGraduate.update({
      where: { id: applicationId },
      data: {
        verificationStatus: status,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
      },
    });
  });

  const senderLabel = roleSenderName(session.role, session.fullName);

  // In-app notification (only possible once the student has an account).
  await notifyApplicationStudent(app, {
    title:
      status === "VERIFIED"
        ? "Application information verified"
        : "Application under review",
    message:
      status === "VERIFIED"
        ? `${senderLabel} verified the information you uploaded with your application.`
        : `${senderLabel} is reviewing the information you uploaded.`,
    category: "verification",
    senderName: senderLabel,
    link: "/student/application",
  });

  const email = app.emails[0];
  if (email) {
    await sendVerificationResultEmail({
      to: email,
      name: app.fullName,
      verified: status === "VERIFIED",
      notes,
      senderLabel,
    });
  }

  // Keep the Registrar (the main handler for applicants) and the faculty admin
  // of this application informed about the outcome.
  if (session.role !== "REGISTRAR") {
    await notifyRole("REGISTRAR", {
      title: "Application verification updated",
      message: `${app.fullName}'s application was marked ${status === "VERIFIED" ? "verified" : "under review"} by ${senderLabel}.`,
      applicationId,
      category: "verification",
      senderName: senderLabel,
      link: `/registrar/registrations/${applicationId}`,
    });
  }
  if (session.role !== "FACULTY_ADMIN") {
    await notifyFacultyAdmins(app.faculty, {
      title: "Application verification updated",
      message: `${app.fullName}'s application was marked ${status === "VERIFIED" ? "verified" : "under review"} by ${senderLabel}.`,
      applicationId,
      category: "verification",
      senderName: senderLabel,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/registrar/registrations/${applicationId}`);
  revalidatePath(`/faculty-admin/applications/${applicationId}`);
  revalidatePath("/student/application");
  return { ok: true };
}

/**
 * Raise a "Form of Recorrection": an itemised list of what the student must
 * correct. The student is notified in-app and by email; the Registrar is told so
 * they can follow up with applicants who do not have an account yet.
 */
export async function requestCorrections(
  form: FormData,
): Promise<ReviewActionResult> {
  const auth = await reviewer();
  if (!auth.ok) return auth;
  const { session } = auth;

  const applicationId = Number(form.get("applicationId"));
  const items = str(form, "items");
  const message = str(form, "message") || null;

  if (!Number.isInteger(applicationId)) {
    return { ok: false, error: "Invalid application." };
  }
  const itemList = items
    .split("\n")
    .map((i) => i.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  if (itemList.length === 0) {
    return {
      ok: false,
      error: "List at least one correction the student has to make.",
    };
  }

  const access = await canAccess(session, applicationId);
  if (!access.ok) return access;
  const app = access.app;

  await prisma.$transaction(async (tx) => {
    await tx.correctionRequest.create({
      data: {
        applicationId,
        raisedById: session.userId,
        raisedByRole: session.role,
        items: itemList.join("\n"),
        message,
      },
    });
    await tx.applicationPostGraduate.update({
      where: { id: applicationId },
      data: { verificationStatus: "CORRECTION_REQUESTED", verifiedAt: null },
    });
    // Mirror onto the declaration so the existing review trail stays accurate.
    const declaration = await tx.applicantDeclaration.findFirst({
      where: { applicationId },
      orderBy: { id: "desc" },
    });
    if (declaration) {
      const comment = `Corrections requested by ${session.role}: ${itemList.join("; ")}`;
      await tx.applicantDeclaration.update({
        where: { id: declaration.id },
        data:
          session.role === "FACULTY_ADMIN"
            ? { status: "CORRECTION_REQUESTED", facultyComment: comment }
            : session.role === "REGISTRAR"
              ? { status: "CORRECTION_REQUESTED", registrarComment: comment }
              : { status: "CORRECTION_REQUESTED", adminComment: comment },
      });
    }
  });

  const senderLabel = roleSenderName(session.role, session.fullName);

  const notified = await notifyApplicationStudent(app, {
    title: "Corrections requested on your application",
    message: `${senderLabel} asked you to correct ${itemList.length} item${itemList.length === 1 ? "" : "s"}: ${itemList[0]}${itemList.length > 1 ? " …" : ""}`,
    applicationId,
    category: "correction",
    senderName: senderLabel,
    link: "/student/corrections",
  });

  const email = app.emails[0];
  let emailSent = false;
  if (email) {
    emailSent = await sendCorrectionRequestEmail({
      to: email,
      name: app.fullName,
      items: itemList,
      message,
      senderLabel,
    });
  }

  if (emailSent) {
    const correction = await prisma.correctionRequest.findFirst({
      where: { applicationId },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (correction) {
      await prisma.correctionRequest.update({
        where: { id: correction.id },
        data: { emailSent: true },
      });
    }
  }

  // The Registrar is the channel for applicants without a portal account.
  if (session.role !== "REGISTRAR") {
    await notifyRole("REGISTRAR", {
      title: notified
        ? "Corrections requested — student notified"
        : "Corrections requested — please inform the applicant",
      message: notified
        ? `${senderLabel} requested corrections from ${app.fullName}. The student has been notified by email and in the portal.`
        : `${senderLabel} requested corrections from ${app.fullName}, who has no portal account yet. Please relay: ${itemList.join("; ")}`,
      applicationId,
      category: "correction",
      senderName: senderLabel,
      link: `/registrar/registrations/${applicationId}`,
    });
  }
  if (session.role !== "MAIN_ADMIN") {
    await notifyRole("MAIN_ADMIN", {
      title: "Corrections requested",
      message: `${senderLabel} requested corrections from ${app.fullName}.`,
      applicationId,
      category: "correction",
      senderName: senderLabel,
      link: `/admin/applications/${applicationId}`,
    });
  }
  if (session.role !== "FACULTY_ADMIN") {
    await notifyFacultyAdmins(app.faculty, {
      title: "Corrections requested",
      message: `${senderLabel} requested corrections from ${app.fullName}.`,
      applicationId,
      category: "correction",
      senderName: senderLabel,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/registrar/registrations/${applicationId}`);
  revalidatePath(`/faculty-admin/applications/${applicationId}`);
  revalidatePath("/student/corrections");
  return { ok: true };
}

/** Close a correction request once the reviewer is satisfied. */
export async function resolveCorrection(
  form: FormData,
): Promise<ReviewActionResult> {
  const auth = await reviewer();
  if (!auth.ok) return auth;
  const { session } = auth;

  const correctionId = Number(form.get("correctionId"));
  const applicationId = Number(form.get("applicationId"));
  if (!Number.isInteger(correctionId) || !Number.isInteger(applicationId)) {
    return { ok: false, error: "Invalid correction." };
  }

  const access = await canAccess(session, applicationId);
  if (!access.ok) return access;
  const app = access.app;

  const correction = await prisma.correctionRequest.findFirst({
    where: { id: correctionId, applicationId },
  });
  if (!correction) return { ok: false, error: "Correction request not found." };

  await prisma.correctionRequest.update({
    where: { id: correctionId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  const openLeft = await prisma.correctionRequest.count({
    where: { applicationId, status: "OPEN" },
  });
  if (openLeft === 0) {
    await prisma.applicationPostGraduate.update({
      where: { id: applicationId },
      data: { verificationStatus: "UNDER_REVIEW" },
    });
  }

  const senderLabel = roleSenderName(session.role, session.fullName);
  await notifyApplicationStudent(app, {
    title: "Correction accepted",
    message: `${senderLabel} closed the correction request. Your application is back under review.`,
    applicationId,
    category: "correction",
    senderName: senderLabel,
    link: "/student/corrections",
  });
  const email = app.emails[0];
  if (email) {
    await sendPortalEmail({
      to: email,
      name: app.fullName,
      subject: "Correction Accepted - Application Back Under Review",
      heading: "Your correction has been accepted",
      paragraphs: [
        `${senderLabel} reviewed what you sent and closed the correction request.`,
        "Your application is now back under review.",
      ],
      senderLabel,
      ctaLabel: "Open the portal",
      ctaPath: "/student/corrections",
    });
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/registrar/registrations/${applicationId}`);
  revalidatePath(`/faculty-admin/applications/${applicationId}`);
  revalidatePath("/student/corrections");
  return { ok: true };
}

/**
 * Free-form notification to a student: written to their portal notification
 * centre and emailed to the address on their application. This is the "notify
 * the students through the system and Email" action.
 */
export async function notifyStudent(
  form: FormData,
): Promise<ReviewActionResult> {
  const auth = await reviewer();
  if (!auth.ok) return auth;
  const { session } = auth;

  const applicationId = Number(form.get("applicationId"));
  const title = str(form, "title");
  const message = str(form, "message");
  const sendEmailToo = form.get("sendEmail") !== null;

  if (!Number.isInteger(applicationId)) {
    return { ok: false, error: "Invalid application." };
  }
  if (!title || !message) {
    return { ok: false, error: "A subject and a message are required." };
  }

  const access = await canAccess(session, applicationId);
  if (!access.ok) return access;
  const app = access.app;

  const senderLabel = roleSenderName(session.role, session.fullName);
  const notified = await notifyApplicationStudent(app, {
    title,
    message,
    applicationId,
    category: "message",
    senderName: senderLabel,
    link: "/student/notifications",
  });

  const email = app.emails[0];
  if (sendEmailToo && email) {
    await sendPortalEmail({
      to: email,
      name: app.fullName,
      subject: title,
      heading: title,
      paragraphs: [message],
      senderLabel,
      ctaLabel: "Open the portal",
      ctaPath: "/student/notifications",
    });
  }

  if (!notified && session.role !== "REGISTRAR") {
    // No portal account yet — hand the message to the Registrar to relay.
    await notifyRole("REGISTRAR", {
      title: `Please relay to ${app.fullName}`,
      message: `${senderLabel}: ${title} — ${message}`,
      applicationId,
      category: "message",
      senderName: senderLabel,
      link: `/registrar/registrations/${applicationId}`,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath(`/registrar/registrations/${applicationId}`);
  revalidatePath(`/faculty-admin/applications/${applicationId}`);
  revalidatePath("/student/notifications");
  return { ok: true };
}
