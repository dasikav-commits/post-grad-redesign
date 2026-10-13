"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { nextUserCode } from "@/lib/user-code";
import { nextRegistrationNumber } from "@/lib/registration-number";
import { notifyFacultyAdmins, notifyRole } from "@/lib/notify";
import {
  sendStudentApprovalNotification,
  sendPasswordResetNotification,
  sendRegistrationRejectedNotification,
} from "@/lib/email";

export type ApproveResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; error: string };
export type RejectResult = { ok: true } | { ok: false; error: string };

function generateTempPassword(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `WU-${hex}!`;
}

const MIN_TEMP_PASSWORD = 6;

// Registrar approves a registration and provisions the student's portal account.
// An optional custom temporary password may be supplied; if blank, one is
// generated automatically.
export async function approveRegistration(
  applicationId: number,
  customPassword?: string,
): Promise<ApproveResult> {
  const session = await requireRole("REGISTRAR");

  const custom = (customPassword ?? "").trim();
  if (custom && custom.length < MIN_TEMP_PASSWORD) {
    return {
      ok: false,
      error: `Temporary password must be at least ${MIN_TEMP_PASSWORD} characters.`,
    };
  }

  const registrar = await prisma.registrarProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!registrar) return { ok: false, error: "Registrar profile not found." };

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    include: { emails: true, declarations: true },
  });
  if (!app) return { ok: false, error: "Application not found." };
  if (app.status !== "ACTIVE") {
    return { ok: false, error: "This application has already been decided." };
  }
  if (app.userId) {
    return { ok: false, error: "A portal account already exists for this student." };
  }

  const email = (app.emails[0]?.email ?? "").toLowerCase().trim();
  if (!email) {
    return { ok: false, error: "Applicant has no email on record." };
  }

  const existingUser = await prisma.portalUser.findUnique({ where: { email } });
  if (existingUser) {
    return {
      ok: false,
      error: "A user with the applicant's email already exists.",
    };
  }

  const tempPassword = custom || generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  // "Reg No" — handed out when the registration is completed.
  const registrationNumber = app.registrationNumber ?? (await nextRegistrationNumber(app.registrationDate));

  try {
    await prisma.$transaction(async (tx) => {
      const userCode = await nextUserCode(tx, "STUDENT");
      const user = await tx.portalUser.create({
        data: {
          userCode,
          fullName: app.fullName,
          email,
          passwordHash,
          role: "STUDENT",
          mustChangePassword: true,
          // Retained so the registrar can relay credentials from the Approved
          // dashboard; cleared on the student's first password change.
          initialPassword: tempPassword,
        },
      });

      await tx.applicationPostGraduate.update({
        where: { id: app.id },
        data: { status: "APPROVED", userId: user.id, registrationNumber },
      });

      // Move the declaration forward to the admin/faculty sign-off stage.
      const decl = app.declarations[0];
      if (decl) {
        await tx.applicantDeclaration.update({
          where: { id: decl.id },
          data: {
            status: "FORWARDED_TO_ADMIN",
            registrarId: registrar.id,
            registrarComment: "Approved by registrar.",
          },
        });
      }
    });

    // Send email notification to student with login credentials
    await sendStudentApprovalNotification(email, app.fullName, tempPassword);

    // The Main Admin and the faculty admins pick the student up from here.
    await notifyRole("MAIN_ADMIN", {
      title: "Registration completed",
      message: `${app.fullName} (${registrationNumber}) has been approved by the Registrar and can now be verified.`,
      applicationId: app.id,
      category: "verification",
      senderName: "Registrar",
      link: `/admin/applications/${app.id}`,
    });
    await notifyFacultyAdmins(app.faculty, {
      title: "Registration completed",
      message: `${app.fullName} (${registrationNumber}) has been approved by the Registrar.`,
      applicationId: app.id,
      category: "verification",
      senderName: "Registrar",
      link: `/faculty-admin/applications/${app.id}`,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A user with that email already exists." };
    }
    return { ok: false, error: "Could not approve the application." };
  }

  revalidatePath("/registrar/registrations");
  revalidatePath("/registrar/approved");
  return { ok: true, email, tempPassword };
}

export type ResetResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string };

// Registrar sets/resets the temporary password for an already-approved student.
// The student is again required to change it on next login.
export async function resetStudentPassword(
  applicationId: number,
  newPassword: string,
): Promise<ResetResult> {
  await requireRole("REGISTRAR");

  const temp = (newPassword ?? "").trim();
  if (temp.length < MIN_TEMP_PASSWORD) {
    return {
      ok: false,
      error: `Temporary password must be at least ${MIN_TEMP_PASSWORD} characters.`,
    };
  }

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    select: { status: true, userId: true, fullName: true, emails: true },
  });
  if (!app || app.status !== "APPROVED" || !app.userId) {
    return { ok: false, error: "No approved student account for this application." };
  }

  const passwordHash = await hashPassword(temp);
  await prisma.portalUser.update({
    where: { id: app.userId },
    data: {
      passwordHash,
      initialPassword: temp,
      mustChangePassword: true,
    },
  });

  // Send email notification to student
  const studentEmail = app.emails[0]?.email;
  if (studentEmail) {
    await sendPasswordResetNotification(studentEmail, app.fullName, temp);
  }

  revalidatePath("/registrar/approved");
  revalidatePath(`/registrar/registrations/${applicationId}`);
  return { ok: true, tempPassword: temp };
}

export async function rejectRegistration(
  applicationId: number,
  comment: string,
): Promise<RejectResult> {
  const session = await requireRole("REGISTRAR");

  const registrar = await prisma.registrarProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!registrar) return { ok: false, error: "Registrar profile not found." };

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    include: { declarations: true, emails: true },
  });
  if (!app) return { ok: false, error: "Application not found." };
  if (app.status !== "ACTIVE") {
    return { ok: false, error: "This application has already been decided." };
  }

  const rejectionReason = comment.trim() || "Rejected by registrar.";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationPostGraduate.update({
        where: { id: app.id },
        data: { status: "REJECTED" },
      });
      const decl = app.declarations[0];
      if (decl) {
        await tx.applicantDeclaration.update({
          where: { id: decl.id },
          data: {
            status: "REJECTED",
            registrarId: registrar.id,
            registrarComment: rejectionReason,
          },
        });
      }
    });

    const email = app.emails[0]?.email;
    if (email) {
      await sendRegistrationRejectedNotification(email, app.fullName, rejectionReason);
    }
  } catch {
    return { ok: false, error: "Could not reject the application." };
  }

  revalidatePath("/registrar/registrations");
  revalidatePath("/registrar/rejected");
  return { ok: true };
}
