"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireApprovedSupervisor } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { nextUserCode } from "@/lib/user-code";
import {
  sendPresentationDateNotification,
  sendPresentationApprovedNotification,
  sendStudentApprovalNotification,
} from "@/lib/email";
import { nextRegistrationNumber } from "@/lib/registration-number";
import { notifyFacultyAdmins, notifyRole } from "@/lib/notify";

export type AssignPresentationResult = 
  | { ok: true; presentationId: number }
  | { ok: false; error: string };

export type MarkPresentationCompleteResult =
  | { ok: true }
  | { ok: false; error: string };

export type ApprovePresentationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Registrar assigns a presentation date to an approved application.
 * Creates a Presentation record linked to the student's research proposal.
 */
export async function assignPresentationDate(
  applicationId: number,
  presentationDate: Date,
  title?: string,
): Promise<AssignPresentationResult> {
  const session = await requireRole("REGISTRAR");

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      fullName: true,
      userId: true,
      emails: true,
      researchProposals: {
        select: {
          id: true,
          title: true,
          supervisors: {
            select: {
              supervisor: { select: { name: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!app) return { ok: false, error: "Application not found." };
  if (app.status !== "ACTIVE" && app.status !== "APPROVED") {
    return { ok: false, error: "Can only assign presentations to active or approved applications." };
  }

  const proposal = app.researchProposals[0];
  if (!proposal) {
    return { ok: false, error: "Student has no research proposal." };
  }

  const admin = await prisma.adminProfile.upsert({
    where: { userId: session.userId },
    update: {},
    create: { userId: session.userId },
  });

  if (presentationDate < new Date()) {
    return { ok: false, error: "Presentation date must be in the future." };
  }

  try {
    const presentation = await prisma.presentation.create({
      data: {
        proposalId: proposal.id,
        title: title || `${app.fullName} - Research Presentation`,
        presentationDate,
        createdByAdminId: admin.id,
      },
    });

    // Create notification for student (visible in their panel once they have
    // a portal account).
    await prisma.notification.create({
      data: {
        title: "Presentation Date Assigned",
        message: `Your presentation has been scheduled for ${presentationDate.toLocaleDateString()}`,
        applicationId,
        recipientUserId: app.userId ?? undefined,
      },
    });

    // Send email notification to student
    const studentEmail = app.emails[0]?.email;
    if (studentEmail) {
      const supervisorNames = proposal.supervisors.map((s) => s.supervisor.name);
      await sendPresentationDateNotification(
        studentEmail,
        app.fullName,
        presentationDate,
        proposal.title,
        supervisorNames,
      );
    }

    revalidatePath("/registrar/presentations");
    return { ok: true, presentationId: presentation.id };
  } catch (error) {
    console.error("Error assigning presentation:", error);
    return { ok: false, error: "Failed to assign presentation date." };
  }
}

/**
 * Supervisor marks a presentation as completed.
 * This is the first step after the presentation; registrar then reviews the result.
 */
export async function markPresentationComplete(
  presentationId: number,
): Promise<MarkPresentationCompleteResult> {
  // Called by the supervisor: portal access must be approved by the Main Admin.
  const gate = await requireApprovedSupervisor();
  if (!gate.ok) return gate;
  const { session } = gate;

  const presentation = await prisma.presentation.findUnique({
    where: { id: presentationId },
    include: {
      proposal: {
        select: {
          supervisors: {
            select: { supervisorId: true },
          },
        },
      },
    },
  });

  if (!presentation) return { ok: false, error: "Presentation not found." };

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!supervisor) return { ok: false, error: "Supervisor profile not found." };

  // Verify the supervisor is assigned to this proposal
  const isAssigned = presentation.proposal.supervisors.some(
    (s) => s.supervisorId === supervisor.id
  );
  if (!isAssigned) {
    return { ok: false, error: "You are not assigned to this proposal." };
  }

  try {
    await prisma.presentation.update({
      where: { id: presentationId },
      data: { isDone: true },
    });

    revalidatePath("/supervisor/presentations");
    return { ok: true };
  } catch (error) {
    console.error("Error marking presentation complete:", error);
    return { ok: false, error: "Failed to mark presentation complete." };
  }
}

/**
 * Registrar approves the presentation result and marks the student as postgraduate.
 * This finalizes the student's postgraduate status after presentation completion.
 */
export async function approvePresentationResult(
  presentationId: number,
): Promise<ApprovePresentationResult> {
  await requireRole("REGISTRAR");

  const presentation = await prisma.presentation.findUnique({
    where: { id: presentationId },
    include: {
      proposal: {
        select: {
          applicationId: true,
          application: {
            select: {
              id: true,
              status: true,
              userId: true,
              fullName: true,
              faculty: true,
              registrationDate: true,
              registrationNumber: true,
              emails: true,
            },
          },
        },
      },
    },
  });

  if (!presentation) return { ok: false, error: "Presentation not found." };
  if (!presentation.isDone) {
    return { ok: false, error: "Presentation must be marked complete first." };
  }

  const application = presentation.proposal.application;
  const studentEmail = application.emails[0]?.email;
  if (!studentEmail) {
    return { ok: false, error: "Applicant has no email to notify." };
  }

  let generatedPassword: string | null = null;
  // Completing the presentation completes the registration: hand out the Reg No.
  const registrationNumber =
    application.registrationNumber ??
    (await nextRegistrationNumber(application.registrationDate));

  try {
    await prisma.$transaction(async (tx) => {
      let userId = application.userId;

      if (!userId) {
        const tempPassword = `WU-${crypto.getRandomValues(new Uint8Array(3)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")}!`;
        generatedPassword = tempPassword;

        const userCode = await nextUserCode(tx, "STUDENT");
        const user = await tx.portalUser.create({
          data: {
            userCode,
            fullName: application.fullName,
            email: studentEmail,
            passwordHash: await hashPassword(tempPassword),
            role: "STUDENT",
            mustChangePassword: true,
            initialPassword: tempPassword,
          },
        });

        userId = user.id;
        await tx.applicationPostGraduate.update({
          where: { id: application.id },
          data: { status: "APPROVED", userId: user.id, registrationNumber },
        });
      } else {
        await tx.applicationPostGraduate.update({
          where: { id: application.id },
          data: { status: "APPROVED", registrationNumber },
        });
      }

      await tx.presentation.update({
        where: { id: presentationId },
        data: { isFinal: true },
      });

      await tx.notification.create({
        data: {
          title: "Postgraduate Approval",
          message: "Your presentation has been approved. You are now registered as a postgraduate student.",
          applicationId: application.id,
          recipientUserId: userId,
        },
      });
    });

    if (generatedPassword) {
      await sendStudentApprovalNotification(studentEmail, application.fullName, generatedPassword);
    } else {
      await sendPresentationApprovedNotification(studentEmail, application.fullName);
    }

    // Registration completed: the Main Admin can now verify the student's
    // information and the faculty admin picks the student up for progress.
    await notifyRole("MAIN_ADMIN", {
      title: "Registration completed",
      message: `${application.fullName} (${registrationNumber}) passed the presentation and is now a registered postgraduate.`,
      applicationId: application.id,
      category: "verification",
      senderName: "Registrar",
      link: `/admin/applications/${application.id}`,
    });
    await notifyFacultyAdmins(application.faculty, {
      title: "New registered postgraduate",
      message: `${application.fullName} (${registrationNumber}) has completed registration.`,
      applicationId: application.id,
      category: "verification",
      senderName: "Registrar",
    });

    revalidatePath("/registrar/presentations");
    revalidatePath("/registrar/approved");
    revalidatePath("/registrar/registrations");
    return { ok: true };
  } catch (error) {
    console.error("Error approving presentation:", error);
    return { ok: false, error: "Failed to approve presentation." };
  }
}

/**
 * Get all presentations awaiting registrar review
 */
export async function getPresentationsAwaitingReview() {
  await requireRole("REGISTRAR");

  const presentations = await prisma.presentation.findMany({
    where: { isDone: true, isFinal: false },
    include: {
      proposal: {
        select: {
          applicationId: true,
          title: true,
          application: {
            select: {
              fullName: true,
              degreeProgram: true,
            },
          },
        },
      },
    },
    orderBy: { presentationDate: "asc" },
  });

  return presentations;
}
