"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { nextUserCode } from "@/lib/user-code";
import {
  sendStudentApprovalNotification,
  sendPresentationApprovedNotification,
  sendPortalEmail,
} from "@/lib/email";
import { nextRegistrationNumber } from "@/lib/registration-number";
import { notifyFacultyAdmins, notifyRole, notifySupervisor, notifyApplicationStudent } from "@/lib/notify";
import { forwardSchedule, scheduleSupervisorsForProposal } from "@/lib/schedule";

export type AssignPresentationResult =
  | { ok: true; presentationId: number }
  | { ok: false; error: string };

export type ReschedulePresentationResult =
  | { ok: true }
  | { ok: false; error: string };

export type ApprovePresentationResult =
  | { ok: true }
  | { ok: false; error: string };

export type NotRecommendedResult =
  | { ok: true }
  | { ok: false; error: string };

type FacultyScope =
  | { ok: true; facultyAdminId: number; faculty: string | null }
  | { ok: false; error: string };

/**
 * The faculty admin acting right now, plus their faculty. Every presentation
 * action is scoped to applications of that faculty.
 */
async function facultyScope(): Promise<FacultyScope> {
  const session = await requireRole("FACULTY_ADMIN");
  const profile = await prisma.facultyAdminProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, faculty: true },
  });
  if (!profile) return { ok: false, error: "Faculty admin profile not found." };
  return {
    ok: true,
    facultyAdminId: profile.id,
    faculty: profile.faculty || null,
  };
}

/** Applications outside the admin's faculty may not be touched. */
function inFaculty(scope: FacultyScope & { ok: true }, appFaculty: string | null): boolean {
  return !(scope.faculty && appFaculty && scope.faculty !== appFaculty);
}

/**
 * Faculty Admin assigns a presentation date (and venue) to an application of
 * their faculty. Creates a Presentation record linked to the student's research
 * proposal and forwards the schedule to the student and every supervisor.
 */
export async function assignPresentationDate(
  applicationId: number,
  presentationDate: Date,
  title?: string,
  venue?: string,
): Promise<AssignPresentationResult> {
  const scope = await facultyScope();
  if (!scope.ok) return scope;

  const app = await prisma.applicationPostGraduate.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      fullName: true,
      faculty: true,
      userId: true,
      emails: true,
      researchProposals: {
        select: {
          id: true,
          title: true,
        },
        take: 1,
      },
    },
  });

  if (!app) return { ok: false, error: "Application not found." };
  if (!inFaculty(scope, app.faculty)) {
    return { ok: false, error: "This application belongs to another faculty." };
  }
  if (app.status !== "ACTIVE" && app.status !== "APPROVED") {
    return { ok: false, error: "Can only assign presentations to active or approved applications." };
  }

  const proposal = app.researchProposals[0];
  if (!proposal) {
    return { ok: false, error: "Student has no research proposal." };
  }

  if (presentationDate < new Date()) {
    return { ok: false, error: "Presentation date must be in the future." };
  }

  try {
    const presentation = await prisma.presentation.create({
      data: {
        proposalId: proposal.id,
        title: title || `${app.fullName} - Research Presentation`,
        presentationDate,
        venue: venue?.trim() || null,
        createdByFacultyAdminId: scope.facultyAdminId,
      },
    });

    // Student + every supervisor get the date, time and venue (portal + email).
    await forwardSchedule({
      mode: "assigned",
      applicationId,
      studentName: app.fullName,
      studentUserId: app.userId,
      studentEmail: app.emails[0]?.email ?? null,
      proposalTitle: proposal.title,
      presentationDate,
      venue: venue?.trim() || null,
      supervisors: await scheduleSupervisorsForProposal(proposal.id),
    });

    revalidatePath("/faculty-admin/presentations");
    return { ok: true, presentationId: presentation.id };
  } catch (error) {
    console.error("Error assigning presentation:", error);
    return { ok: false, error: "Failed to assign presentation date." };
  }
}

/**
 * Faculty Admin moves a scheduled presentation (date/time and/or venue).
 * The new schedule is forwarded to the student and every supervisor, exactly
 * like the original assignment.
 */
export async function reschedulePresentation(
  presentationId: number,
  presentationDate: Date,
  venue?: string,
): Promise<ReschedulePresentationResult> {
  const scope = await facultyScope();
  if (!scope.ok) return scope;

  const presentation = await prisma.presentation.findUnique({
    where: { id: presentationId },
    select: {
      isDone: true,
      venue: true,
      proposal: {
        select: {
          id: true,
          title: true,
          application: {
            select: {
              id: true,
              fullName: true,
              faculty: true,
              userId: true,
              emails: true,
            },
          },
        },
      },
    },
  });

  if (!presentation) return { ok: false, error: "Presentation not found." };
  const app = presentation.proposal.application;
  if (!inFaculty(scope, app.faculty)) {
    return { ok: false, error: "This presentation belongs to another faculty." };
  }
  if (presentation.isDone) {
    return { ok: false, error: "A completed presentation cannot be rescheduled." };
  }
  if (presentationDate < new Date()) {
    return { ok: false, error: "Presentation date must be in the future." };
  }

  try {
    await prisma.presentation.update({
      where: { id: presentationId },
      data: {
        presentationDate,
        venue: venue?.trim() || null,
      },
    });

    await forwardSchedule({
      mode: "rescheduled",
      applicationId: app.id,
      studentName: app.fullName,
      studentUserId: app.userId,
      studentEmail: app.emails[0]?.email ?? null,
      proposalTitle: presentation.proposal.title,
      presentationDate,
      venue: venue?.trim() || null,
      supervisors: await scheduleSupervisorsForProposal(presentation.proposal.id),
    });

    revalidatePath("/faculty-admin/presentations");
    revalidatePath(`/faculty-admin/presentations/${presentationId}`);
    return { ok: true };
  } catch (error) {
    console.error("Error rescheduling presentation:", error);
    return { ok: false, error: "Failed to reschedule the presentation." };
  }
}

/**
 * Faculty Admin records the outcome "Recommended": the presentation is
 * approved and the registration is completed — the student account (with a
 * temporary password) and the PG/<year>/<seq> registration number are created.
 */
export async function approvePresentationResult(
  presentationId: number,
): Promise<ApprovePresentationResult> {
  const scope = await facultyScope();
  if (!scope.ok) return scope;

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
  const application = presentation.proposal.application;
  if (!inFaculty(scope, application.faculty)) {
    return { ok: false, error: "This presentation belongs to another faculty." };
  }
  if (!presentation.isDone) {
    return { ok: false, error: "Presentation must be marked complete first." };
  }
  if (presentation.outcome) {
    return { ok: false, error: "An outcome has already been recorded." };
  }

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
        data: {
          isFinal: true,
          outcome: "RECOMMENDED",
          outcomeNote: null,
          outcomeById: scope.facultyAdminId,
          decidedAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          title: "Postgraduate Approval",
          message: "Your presentation has been approved. You are now registered as a postgraduate student.",
          applicationId: application.id,
          recipientUserId: userId,
          category: "presentation",
          senderName: "Faculty Admin",
          link: "/student/presentations",
        },
      });
    });

    if (generatedPassword) {
      await sendStudentApprovalNotification(studentEmail, application.fullName, generatedPassword);
    } else {
      await sendPresentationApprovedNotification(studentEmail, application.fullName);
    }

    // Registration completed: the Main Admin can now verify the student's
    // information and the faculty admins pick the student up for progress.
    await notifyRole("MAIN_ADMIN", {
      title: "Registration completed",
      message: `${application.fullName} (${registrationNumber}) passed the presentation and is now a registered postgraduate.`,
      applicationId: application.id,
      category: "verification",
      senderName: "Faculty Admin",
      link: `/admin/applications/${application.id}`,
    });
    await notifyFacultyAdmins(application.faculty, {
      title: "New registered postgraduate",
      message: `${application.fullName} (${registrationNumber}) has completed registration.`,
      applicationId: application.id,
      category: "verification",
      senderName: "Faculty Admin",
      link: `/faculty-admin/applications/${application.id}`,
    });

    revalidatePath("/faculty-admin/presentations");
    revalidatePath("/faculty-admin/presentations/completed");
    revalidatePath("/registrar/approved");
    revalidatePath("/registrar/registrations");
    return { ok: true };
  } catch (error) {
    console.error("Error approving presentation:", error);
    return { ok: false, error: "Failed to record the presentation outcome." };
  }
}

/**
 * Faculty Admin records the outcome "Not recommended" with a reason: the
 * application is rejected and the reason is sent to the student, every
 * supervisor, the Registrar and the Main Admin (portal + email).
 */
export async function markPresentationNotRecommended(
  presentationId: number,
  note: string,
): Promise<NotRecommendedResult> {
  const scope = await facultyScope();
  if (!scope.ok) return scope;

  const reason = (note ?? "").trim();
  if (!reason) {
    return { ok: false, error: "Give the reason for 'Not recommended'." };
  }

  const presentation = await prisma.presentation.findUnique({
    where: { id: presentationId },
    select: {
      isDone: true,
      outcome: true,
      proposal: {
        select: {
          id: true,
          title: true,
          application: {
            select: {
              id: true,
              status: true,
              userId: true,
              fullName: true,
              faculty: true,
              emails: true,
            },
          },
        },
      },
    },
  });

  if (!presentation) return { ok: false, error: "Presentation not found." };
  const app = presentation.proposal.application;
  if (!inFaculty(scope, app.faculty)) {
    return { ok: false, error: "This presentation belongs to another faculty." };
  }
  if (!presentation.isDone) {
    return { ok: false, error: "Presentation must be marked complete first." };
  }
  if (presentation.outcome) {
    return { ok: false, error: "An outcome has already been recorded." };
  }
  if (app.status !== "ACTIVE" && app.status !== "APPROVED") {
    return { ok: false, error: "This application has already been decided." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.presentation.update({
        where: { id: presentationId },
        data: {
          outcome: "NOT_RECOMMENDED",
          outcomeNote: reason,
          outcomeById: scope.facultyAdminId,
          decidedAt: new Date(),
        },
      });

      await tx.applicationPostGraduate.update({
        where: { id: app.id },
        data: { status: "REJECTED" },
      });

      await tx.applicantDeclaration.updateMany({
        where: { applicationId: app.id },
        data: {
          status: "REJECTED",
          facultyAdminId: scope.facultyAdminId,
          facultyComment: reason,
        },
      });
    });

    // The reason goes to the student and every supervisor (portal + email).
    const itemLines = [
      `Student: ${app.fullName}`,
      `Research proposal: ${presentation.proposal.title}`,
      `Outcome: Not recommended`,
      `Reason: ${reason}`,
    ];
    await notifyApplicationStudent(app, {
      title: "Presentation outcome — Not recommended",
      message: `Your presentation outcome is "Not recommended". Reason: ${reason}`,
      category: "presentation",
      senderName: "Faculty Admin",
      link: "/student/presentations",
    });
    const studentEmail = app.emails[0]?.email;
    if (studentEmail) {
      await sendPortalEmail({
        to: studentEmail,
        name: app.fullName,
        subject: "Presentation outcome — Not recommended",
        heading: "Presentation outcome — Not recommended",
        paragraphs: [
          "The Faculty Admin has recorded the outcome of your research presentation as \"Not recommended\". Your application has been rejected.",
          `Reason: ${reason}`,
        ],
        items: itemLines,
        senderLabel: "Faculty Admin, Postgraduate Portal",
        ctaLabel: "Open your presentations",
        ctaPath: "/student/presentations",
      });
    }

    const supervisors = await scheduleSupervisorsForProposal(presentation.proposal.id);
    for (const s of supervisors) {
      await notifySupervisor(s.supervisorId, {
        title: "Presentation outcome — Not recommended",
        message: `The presentation outcome for ${app.fullName} is "Not recommended". Reason: ${reason}`,
        category: "presentation",
        senderName: "Faculty Admin",
        link: "/supervisor/presentations",
      });
      if (s.email) {
        await sendPortalEmail({
          to: s.email,
          name: s.name,
          subject: `Presentation outcome — ${app.fullName} (Not recommended)`,
          heading: "Presentation outcome — Not recommended",
          paragraphs: [
            `The Faculty Admin has recorded the outcome of ${app.fullName}'s research presentation as "Not recommended". The application has been rejected.`,
            `Reason: ${reason}`,
          ],
          items: itemLines,
          senderLabel: "Faculty Admin, Postgraduate Portal",
          ctaLabel: "Open your presentations",
          ctaPath: "/supervisor/presentations",
        });
      }
    }

    // Registrar and Main Admin are informed too (portal + email).
    await notifyRole("REGISTRAR", {
      title: "Presentation outcome — Not recommended",
      message: `${app.fullName}'s presentation was marked \"Not recommended\" and the application was rejected. Reason: ${reason}`,
      applicationId: app.id,
      category: "presentation",
      senderName: "Faculty Admin",
      link: `/registrar/registrations/${app.id}`,
    });
    await notifyRole("MAIN_ADMIN", {
      title: "Presentation outcome — Not recommended",
      message: `${app.fullName}'s presentation was marked \"Not recommended\" and the application was rejected. Reason: ${reason}`,
      applicationId: app.id,
      category: "presentation",
      senderName: "Faculty Admin",
      link: `/admin/applications/${app.id}`,
    });
    const staff = await prisma.portalUser.findMany({
      where: { role: { in: ["REGISTRAR", "MAIN_ADMIN"] } },
      select: { fullName: true, email: true },
    });
    for (const u of staff) {
      await sendPortalEmail({
        to: u.email,
        name: u.fullName,
        subject: `Presentation outcome — ${app.fullName} (Not recommended)`,
        heading: "Presentation outcome — Not recommended",
        paragraphs: [
          `The Faculty Admin has recorded the outcome of ${app.fullName}'s research presentation as "Not recommended". The application has been rejected.`,
          `Reason: ${reason}`,
        ],
        items: itemLines,
        senderLabel: "Faculty Admin, Postgraduate Portal",
      });
    }

    revalidatePath("/faculty-admin/presentations");
    revalidatePath("/faculty-admin/presentations/completed");
    revalidatePath("/registrar/rejected");
    revalidatePath("/admin/rejected");
    revalidatePath("/faculty-admin/rejected");
    return { ok: true };
  } catch (error) {
    console.error("Error recording presentation outcome:", error);
    return { ok: false, error: "Failed to record the presentation outcome." };
  }
}
